"""Vaccine Inventory Management Service.

Coordinates:
- Vaccine product catalogue creation
- Vaccine stock batch receipts, issues, and adjustments
- District inventory scope enforcement (DAHO via 'vaccine_stock.manage')
- Non-negative stock balance protection
- Immutable security audit trails
"""
import logging
import uuid
from decimal import Decimal
from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.inventory.models import (
    VaccineProduct,
    VaccineStockLot,
    VaccineStockTransaction,
)
from app.modules.inventory.repository import VaccineInventoryRepository
from app.modules.inventory.schemas import (
    VaccineProductCreate,
    VaccineProductResponse,
    VaccineStockAdjustRequest,
    VaccineStockIssueRequest,
    VaccineStockLotCreate,
    VaccineStockLotResponse,
    VaccineStockTransactionResponse,
)

logger = logging.getLogger("pashurakshak.inventory.service")


def localize_vaccine_name_gu(name: str) -> str:
    """Translate standard departmental vaccine names to Gujarati."""
    if not name:
        return ""
    lower = name.lower()
    if "fmd" in lower:
        return "FMD (ખરવા-મોવાસા) ઓઇલ એડજુવન્ટ રસી"
    if "hs" in lower or "hemorrhagic" in lower:
        return "HS (ગળસૂંઠો) એલમ પ્રેસિપિટેટેડ રસી"
    if "bq" in lower or "black quarter" in lower:
        return "BQ (ગાઠીયો તાવ) પોલિવેલેન્ટ રસી"
    if "brucella" in lower or "brucellosis" in lower:
        return "Brucella (બ્રુસેલોસિસ) S19 રસી"
    if "ppr" in lower:
        return "PPR (પીપીઆર) જીવંત રસી"
    return name


class VaccineInventoryService:
    """Service managing vaccine supplies, district lot balances, and disbursements."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = VaccineInventoryRepository(db)
        self.authz_service = AuthorizationService(db)

    async def create_product(
        self,
        payload: VaccineProductCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VaccineProductResponse:
        """Register a new vaccine product in catalogue."""
        await self.authz_service.assert_permission(
            current_user,
            "vaccine_stock.manage",
            ip=client_ip
        )

        existing = await self.repo.get_product_by_code(payload.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vaccine product with code '{payload.code}' already exists"
            )

        product = await self.repo.create_product(
            code=payload.code,
            name=payload.name,
            programme_code=payload.programme_code,
            unit_name=payload.unit_name,
            created_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="VACCINE_PRODUCT_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="vaccine_product",
            object_id=str(product.id),
            reason=f"Added product {product.code} ({product.name})",
            ip=client_ip
        )
        await self.db.commit()
        return VaccineProductResponse.model_validate(product)

    async def list_products(
        self,
        active_only: bool = True
    ) -> List[VaccineProductResponse]:
        """List vaccine products catalogue."""
        products = await self.repo.list_products(active_only=active_only)
        res_list = []
        for p in products:
            item = VaccineProductResponse.model_validate(p)
            item.name = localize_vaccine_name_gu(item.name)
            res_list.append(item)
        return res_list

    async def receive_stock_lot(
        self,
        payload: VaccineStockLotCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VaccineStockLotResponse:
        """Receive a new batch lot into district vaccine stock."""
        await self.authz_service.assert_permission(
            current_user,
            "vaccine_stock.manage",
            ip=client_ip
        )

        # Enforce district boundary
        await self.authz_service.assert_district_scope(current_user, payload.district_id, ip=client_ip)

        product = await self.repo.get_product_by_id(payload.product_id)
        if not product or not product.active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active vaccine product required")

        if payload.expiry_date and payload.received_date and payload.expiry_date < payload.received_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Batch expiry date cannot be prior to delivery receipt date"
            )

        lot = await self.repo.create_stock_lot_and_receipt(
            product_id=payload.product_id,
            district_id=payload.district_id,
            batch_number=payload.batch_number,
            expiry_date=payload.expiry_date,
            received_date=payload.received_date,
            storage_location=payload.storage_location,
            quantity_received=payload.quantity_received,
            source_reference=payload.source_reference,
            notes=payload.notes,
            recorded_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="STOCK_LOT_RECEIVED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="vaccine_stock_lot",
            object_id=str(lot.id),
            reason=f"Received {lot.quantity_received} doses of batch {lot.batch_number or 'N/A'}",
            ip=client_ip
        )
        await self.db.commit()
        return VaccineStockLotResponse.model_validate(lot)

    async def issue_stock(
        self,
        stock_lot_id: uuid.UUID,
        payload: VaccineStockIssueRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VaccineStockTransactionResponse:
        """Issue vaccine stock doses from a district batch lot."""
        await self.authz_service.assert_permission(
            current_user,
            "vaccine_stock.manage",
            ip=client_ip
        )

        lot = await self.repo.get_lot_by_id(stock_lot_id)
        if not lot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock lot not found")

        await self.authz_service.assert_district_scope(current_user, lot.district_id, ip=client_ip)

        if lot.status != "AVAILABLE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock lot cannot be issued because status is '{lot.status}'"
            )

        # Enforce non-negative inventory rule
        if payload.quantity > lot.quantity_on_hand:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient vaccine stock on hand ({lot.quantity_on_hand} available, {payload.quantity} requested)"
            )

        txn = await self.repo.record_stock_transaction(
            stock_lot_id=lot.id,
            transaction_type="ISSUE",
            quantity=payload.quantity,
            from_location=lot.storage_location,
            to_location=payload.to_location,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            reason=payload.reason or "Operational issue to field location",
            recorded_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="STOCK_LOT_ISSUED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="vaccine_stock_lot",
            object_id=str(lot.id),
            reason=f"Issued {payload.quantity} doses to {payload.to_location or 'field'}",
            ip=client_ip
        )
        await self.db.commit()
        return VaccineStockTransactionResponse.model_validate(txn)

    async def adjust_stock(
        self,
        stock_lot_id: uuid.UUID,
        payload: VaccineStockAdjustRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VaccineStockTransactionResponse:
        """Record a stock adjustment, return, or wastage."""
        await self.authz_service.assert_permission(
            current_user,
            "vaccine_stock.manage",
            ip=client_ip
        )

        lot = await self.repo.get_lot_by_id(stock_lot_id)
        if not lot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock lot not found")

        await self.authz_service.assert_district_scope(current_user, lot.district_id, ip=client_ip)

        if payload.transaction_type in ("ADJUSTMENT_OUT", "WASTAGE"):
            if payload.quantity > lot.quantity_on_hand:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Adjustment quantity {payload.quantity} exceeds available stock on hand {lot.quantity_on_hand}"
                )

        txn = await self.repo.record_stock_transaction(
            stock_lot_id=lot.id,
            transaction_type=payload.transaction_type,
            quantity=payload.quantity,
            from_location=lot.storage_location,
            to_location=None,
            reference_type="STOCK_ADJUSTMENT",
            reference_id=lot.id,
            reason=payload.reason,
            recorded_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="STOCK_LOT_ADJUSTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="vaccine_stock_lot",
            object_id=str(lot.id),
            reason=f"{payload.transaction_type} {payload.quantity} doses: {payload.reason}",
            ip=client_ip
        )
        await self.db.commit()
        return VaccineStockTransactionResponse.model_validate(txn)

    async def list_lots(
        self,
        district_id: Optional[uuid.UUID] = None,
        product_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[VaccineStockLotResponse]:
        """List vaccine stock lots within caller's district scope."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["vaccine_stock.manage", "aggregate.view"],
            ip=client_ip
        )

        target_district_id = district_id
        if current_user.role == "DAHO":
            # Confine to DAHO's assigned district
            if scope.assigned_district_ids:
                target_district_id = next(iter(scope.assigned_district_ids))

        lots = await self.repo.list_lots(
            district_id=target_district_id,
            product_id=product_id,
            status=status,
            offset=offset,
            limit=limit
        )
        return [VaccineStockLotResponse.model_validate(l) for l in lots]

    async def list_lot_transactions(
        self,
        stock_lot_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[VaccineStockTransactionResponse]:
        """List audit transactions for a specific stock lot."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["vaccine_stock.manage", "aggregate.view"],
            ip=client_ip
        )

        lot = await self.repo.get_lot_by_id(stock_lot_id)
        if not lot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock lot not found")

        txns = await self.repo.list_lot_transactions(stock_lot_id)
        return [VaccineStockTransactionResponse.model_validate(t) for t in txns]

