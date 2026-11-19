"""FastAPI RESTful endpoints for Farmer Management domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.farmers.schemas import (
    FarmerAccountProvisionRequest,
    FarmerAccountProvisionResponse,
    FarmerCreate,
    FarmerDetailResponse,
    FarmerResponse,
    FarmerUpdate,
    FarmerVerificationRequest,
    FarmerVerificationResponse,
)
from app.modules.farmers.service import FarmerService

router = APIRouter(prefix="", tags=["Farmer Management"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("", response_model=List[FarmerResponse], summary="List farmers in caller scope")
async def list_farmers(
    village_id: Optional[uuid.UUID] = Query(None, description="Optional village filter"),
    search: Optional[str] = Query(None, description="Search by name, code, or phone"),
    active_only: bool = Query(True, description="Filter only active farmers"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[FarmerResponse]:
    service = FarmerService(db)
    return await service.list_farmers(current_user, village_id, search, active_only, offset, limit)


@router.get("/{farmer_id}", response_model=FarmerDetailResponse, summary="Get farmer profile details")
async def get_farmer(
    farmer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FarmerDetailResponse:
    service = FarmerService(db)
    return await service.get_farmer(farmer_id, current_user)


@router.post("", response_model=FarmerResponse, status_code=status.HTTP_201_CREATED, summary="Register a farmer")
async def register_farmer(
    payload: FarmerCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FarmerResponse:
    service = FarmerService(db)
    return await service.register_farmer(payload, current_user, _extract_ip(request))


@router.put("/{farmer_id}", response_model=FarmerResponse, summary="Update farmer profile")
async def update_farmer(
    farmer_id: uuid.UUID,
    payload: FarmerUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FarmerResponse:
    service = FarmerService(db)
    return await service.update_farmer(farmer_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{farmer_id}/provision-account",
    response_model=FarmerAccountProvisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision login account for existing farmer"
)
async def provision_farmer_account(
    farmer_id: uuid.UUID,
    payload: FarmerAccountProvisionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FarmerAccountProvisionResponse:
    service = FarmerService(db)
    return await service.provision_farmer_account(farmer_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{farmer_id}/verify",
    response_model=FarmerVerificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record formal farmer verification"
)
async def verify_farmer(
    farmer_id: uuid.UUID,
    payload: FarmerVerificationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FarmerVerificationResponse:
    service = FarmerService(db)
    return await service.verify_farmer(farmer_id, payload, current_user, _extract_ip(request))

