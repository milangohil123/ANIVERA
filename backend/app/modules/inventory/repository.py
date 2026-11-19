"""Asynchronous database repository for Vaccine Inventory domain."""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.authentication.models import AuditEvent
from app.modules.inventory.models import (
    VaccineProduct,
    VaccineStockLot,
    VaccineStockTransaction,
)


class VaccineInventoryRepository:
    """Repository managing vaccine products, district stock lots, and transaction ledgers."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_product_by_id(self, product_id: uuid.UUID) -> Optional[VaccineProduct]:
        """Fetch vaccine product by primary key."""
        stmt = select(VaccineProduct).where(VaccineProduct.id == product_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_product_by_code(self, code: str) -> Optional[VaccineProduct]:
        """Fetch vaccine product by code."""
        stmt = select(VaccineProduct).where(VaccineProduct.code == code.strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_products(self, active_only: bool = True) -> List[VaccineProduct]:
        """List vaccine products."""
        stmt = select(VaccineProduct)
        if active_only:
            stmt = stmt.where(VaccineProduct.active.is_(True))
        stmt = stmt.order_by(VaccineProduct.name.asc())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_product(
        self,
        code: str,
        name: str,
        programme_code: Optional[str],
        unit_name: str,
        created_by: uuid.UUID
    ) -> VaccineProduct:
        """Register a new vaccine product."""
        product = VaccineProduct(
            id=uuid.uuid4(),
            code=code.strip(),
            name=name.strip(),
            programme_code=programme_code.strip() if programme_code else None,
            unit_name=unit_name.strip(),
            active=True,
            created_by=created_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(product)
        await self.db.flush()
        return product

    async def get_lot_by_id(self, lot_id: uuid.UUID) -> Optional[VaccineStockLot]:
        """Fetch vaccine stock lot by primary key."""
        stmt = select(VaccineStockLot).where(VaccineStockLot.id == lot_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_lots(
        self,
        district_id: Optional[uuid.UUID] = None,
        product_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 50
    ) -> List[VaccineStockLot]:
        """List stock lots filtered by district, product, and status."""
        stmt = select(VaccineStockLot)
        if district_id:
            stmt = stmt.where(VaccineStockLot.district_id == district_id)
        if product_id:
            stmt = stmt.where(VaccineStockLot.product_id == product_id)
        if status:
            stmt = stmt.where(VaccineStockLot.status == status)
        stmt = stmt.order_by(VaccineStockLot.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_stock_lot_and_receipt(
        self,
        product_id: uuid.UUID,
        district_id: uuid.UUID,
        batch_number: Optional[str],
        expiry_date: Optional[date],
        received_date: Optional[date],
        storage_location: Optional[str],
        quantity_received: Decimal,
        source_reference: Optional[str],
        notes: Optional[str],
        recorded_by: uuid.UUID
    ) -> VaccineStockLot:
        """Create a new stock lot with initial receipt transaction."""
        now_utc = datetime.now(timezone.utc)
        lot = VaccineStockLot(
            id=uuid.uuid4(),
            product_id=product_id,
            district_id=district_id,
            batch_number=batch_number.strip() if batch_number else None,
            expiry_date=expiry_date,
            received_date=received_date,
            storage_location=storage_location.strip() if storage_location else None,
            quantity_received=quantity_received,
            quantity_on_hand=Decimal("0"),  # Trigger apply_vaccine_stock_movement adds RECEIPT quantity
            status="AVAILABLE",
            source_reference=source_reference.strip() if source_reference else None,
            notes=notes.strip() if notes else None,
            created_by=recorded_by,
            created_at=now_utc,
            updated_at=now_utc
        )
        self.db.add(lot)
        await self.db.flush()

        # Add initial RECEIPT transaction
        txn = VaccineStockTransaction(
            id=uuid.uuid4(),
            stock_lot_id=lot.id,
            transaction_type="RECEIPT",
            quantity=quantity_received,
            from_location="SUPPLIER / DEPOT",
            to_location=lot.storage_location,
            reference_type="DELIVERY_RECEIPT",
            reference_id=lot.id,
            reason=f"Initial stock receipt: batch {lot.batch_number or 'N/A'}",
            recorded_by=recorded_by,
            recorded_at=now_utc
        )
        self.db.add(txn)
        await self.db.flush()
        await self.db.refresh(lot)
        return lot

    async def record_stock_transaction(
        self,
        stock_lot_id: uuid.UUID,
        transaction_type: str,
        quantity: Decimal,
        from_location: Optional[str],
        to_location: Optional[str],
        reference_type: Optional[str],
        reference_id: Optional[uuid.UUID],
        reason: Optional[str],
        recorded_by: uuid.UUID
    ) -> VaccineStockTransaction:
        """Record an inventory transaction and let database trigger update balance."""
        txn = VaccineStockTransaction(
            id=uuid.uuid4(),
            stock_lot_id=stock_lot_id,
            transaction_type=transaction_type,
            quantity=quantity,
            from_location=from_location.strip() if from_location else None,
            to_location=to_location.strip() if to_location else None,
            reference_type=reference_type.strip() if reference_type else None,
            reference_id=reference_id,
            reason=reason.strip() if reason else None,
            recorded_by=recorded_by,
            recorded_at=datetime.now(timezone.utc)
        )
        self.db.add(txn)
        await self.db.flush()
        return txn

    async def list_lot_transactions(self, stock_lot_id: uuid.UUID) -> List[VaccineStockTransaction]:
        """List all transactions for a specific stock lot in reverse chronological order."""
        stmt = select(VaccineStockTransaction).where(
            VaccineStockTransaction.stock_lot_id == stock_lot_id
        ).order_by(VaccineStockTransaction.recorded_at.desc())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID],
        actor_role: Optional[str],
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None
    ) -> None:
        """Record an immutable audit event for stock movements."""
        evt = AuditEvent(
            action=action,
            result=result,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            reason=reason,
            ip=ip
        )
        self.db.add(evt)
        await self.db.flush()

