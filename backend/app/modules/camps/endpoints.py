"""FastAPI RESTful endpoints for Veterinary Camps domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.camps.schemas import (
    CampCancelRequest,
    CampCompleteRequest,
    CampConfirmRequest,
    CampCreate,
    CampRescheduleRequest,
    CampResponse,
    CampStaffCreate,
    CampStaffResponse,
)
from app.modules.camps.service import CampService

router = APIRouter(prefix="", tags=["Veterinary Camps"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "",
    response_model=CampResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Propose a veterinary camp or doorstep round"
)
async def propose_camp(
    payload: CampCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.propose_camp(payload, current_user, _extract_ip(request))


@router.get(
    "",
    response_model=List[CampResponse],
    summary="List veterinary camps scoped to caller's authority"
)
async def list_camps(
    status: Optional[str] = Query(None, description="Filter by status (PROPOSED, CONFIRMED, RESCHEDULED, CANCELLED, COMPLETED)"),
    campaign_id: Optional[uuid.UUID] = Query(None, description="Filter by campaign"),
    cooperative_id: Optional[uuid.UUID] = Query(None, description="Filter by cooperative"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampResponse]:
    service = CampService(db)
    return await service.list_camps(status, campaign_id, cooperative_id, offset, limit, current_user, _extract_ip(request))


@router.get(
    "/{camp_id}",
    response_model=CampResponse,
    summary="Get details of a veterinary camp"
)
async def get_camp(
    camp_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.get_camp(camp_id, current_user, _extract_ip(request))


@router.post(
    "/{camp_id}/confirm",
    response_model=CampResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm a proposed camp (Veterinary Officer authority)"
)
async def confirm_camp(
    camp_id: uuid.UUID,
    payload: CampConfirmRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.confirm_camp(camp_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{camp_id}/cancel",
    response_model=CampResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a camp with mandatory reason"
)
async def cancel_camp(
    camp_id: uuid.UUID,
    payload: CampCancelRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.cancel_camp(camp_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{camp_id}/reschedule",
    response_model=CampResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Reschedule a camp to a new planned window"
)
async def reschedule_camp(
    camp_id: uuid.UUID,
    payload: CampRescheduleRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.reschedule_camp(camp_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{camp_id}/complete",
    response_model=CampResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a confirmed camp as completed"
)
async def complete_camp(
    camp_id: uuid.UUID,
    payload: CampCompleteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampResponse:
    service = CampService(db)
    return await service.complete_camp(camp_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{camp_id}/staff",
    response_model=CampStaffResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign staff attendee to a camp"
)
async def add_staff(
    camp_id: uuid.UUID,
    payload: CampStaffCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampStaffResponse:
    service = CampService(db)
    return await service.add_staff(camp_id, payload, current_user, _extract_ip(request))

