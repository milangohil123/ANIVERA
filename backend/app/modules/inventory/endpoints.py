"""FastAPI RESTful endpoints for Vaccine Inventory domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.inventory.schemas import (
    VaccineProductCreate,
    VaccineProductResponse,
    VaccineStockAdjustRequest,
    VaccineStockIssueRequest,
    VaccineStockLotCreate,
    VaccineStockLotResponse,
    VaccineStockTransactionResponse,
)
from app.modules.inventory.service import VaccineInventoryService

router = APIRouter(prefix="", tags=["Vaccine Inventory Management"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "/products",
    response_model=VaccineProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new vaccine product in catalogue"
)
async def create_product(
    payload: VaccineProductCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VaccineProductResponse:
    service = VaccineInventoryService(db)
    return await service.create_product(payload, current_user, _extract_ip(request))


@router.get(
    "/products",
    response_model=List[VaccineProductResponse],
    summary="List vaccine products in catalogue"
)
async def list_products(
    active_only: bool = Query(True, description="Filter only active products"),
    db: AsyncSession = Depends(get_db_session)
) -> List[VaccineProductResponse]:
    service = VaccineInventoryService(db)
    return await service.list_products(active_only=active_only)


@router.post(
    "/lots",
    response_model=VaccineStockLotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive new vaccine batch stock into district inventory (DAHO authority)"
)
async def receive_stock_lot(
    payload: VaccineStockLotCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VaccineStockLotResponse:
    service = VaccineInventoryService(db)
    return await service.receive_stock_lot(payload, current_user, _extract_ip(request))


@router.get(
    "/lots",
    response_model=List[VaccineStockLotResponse],
    summary="List vaccine stock lots within caller's district scope"
)
async def list_lots(
    district_id: Optional[uuid.UUID] = Query(None, description="Optional district filter"),
    product_id: Optional[uuid.UUID] = Query(None, description="Filter by vaccine product"),
    status: Optional[str] = Query(None, description="Filter by status (AVAILABLE, QUARANTINED, EXPIRED, DEPLETED, CLOSED)"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VaccineStockLotResponse]:
    service = VaccineInventoryService(db)
    return await service.list_lots(district_id, product_id, status, offset, limit, current_user, _extract_ip(request))


@router.post(
    "/lots/{lot_id}/issue",
    response_model=VaccineStockTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Issue vaccine doses to field camp or health center"
)
async def issue_stock(
    lot_id: uuid.UUID,
    payload: VaccineStockIssueRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VaccineStockTransactionResponse:
    service = VaccineInventoryService(db)
    return await service.issue_stock(lot_id, payload, current_user, _extract_ip(request))


@router.post(
    "/lots/{lot_id}/adjust",
    response_model=VaccineStockTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record inventory adjustment, return, or wastage"
)
async def adjust_stock(
    lot_id: uuid.UUID,
    payload: VaccineStockAdjustRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VaccineStockTransactionResponse:
    service = VaccineInventoryService(db)
    return await service.adjust_stock(lot_id, payload, current_user, _extract_ip(request))


@router.get(
    "/lots/{lot_id}/transactions",
    response_model=List[VaccineStockTransactionResponse],
    summary="List all stock movement transactions for a batch lot"
)
async def list_lot_transactions(
    lot_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VaccineStockTransactionResponse]:
    service = VaccineInventoryService(db)
    return await service.list_lot_transactions(lot_id, current_user, _extract_ip(request))

