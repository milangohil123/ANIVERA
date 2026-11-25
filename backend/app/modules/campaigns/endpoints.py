"""FastAPI RESTful endpoints for Campaigns domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.campaigns.schemas import (
    CampaignActivateRequest,
    CampaignAssignmentCreate,
    CampaignAssignmentResponse,
    CampaignBulkAssignWorkersRequest,
    CampaignCreate,
    CampaignCreationMetaResponse,
    CampaignDetailResponse,
    CampaignMonitoringResponse,
    CampaignPendingVaccinationsResponse,
    CampaignRejectRequest,
    CampaignResponse,
    CampaignUpdate,
    CampaignVillageVerificationItem,
    CampaignVillageVerificationReviewRequest,
    CampaignVillageVerificationSubmitRequest,
    VoCampaignAssignmentItem,
)
from app.modules.campaigns.service import CampaignService

router = APIRouter(prefix="", tags=["Campaign Management"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get(
    "/meta/creation-context",
    response_model=CampaignCreationMetaResponse,
    summary="Get campaign creation master data (species, talukas, villages with assigned VOs)"
)
async def get_creation_meta(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignCreationMetaResponse:
    service = CampaignService(db)
    return await service.get_creation_meta(current_user, _extract_ip(request))


@router.get(
    "/vo/my-assignments",
    response_model=List[VoCampaignAssignmentItem],
    summary="Get all campaign village assignments for the logged-in VO (legacy alias)"
)
@router.get(
    "/my-assignments",
    response_model=List[VoCampaignAssignmentItem],
    summary="Get all campaign village assignments for the logged-in staff member (VO or Field Worker)"
)
async def list_my_vo_campaign_assignments(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VoCampaignAssignmentItem]:
    service = CampaignService(db)
    return await service.list_my_vo_campaign_assignments(current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/villages/{village_id}/accept",
    response_model=VoCampaignAssignmentItem,
    summary="Accept campaign village assignment (VO action)"
)
async def accept_vo_campaign_assignment(
    campaign_id: uuid.UUID,
    village_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VoCampaignAssignmentItem:
    service = CampaignService(db)
    return await service.accept_vo_campaign_assignment(campaign_id, village_id, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/villages/{village_id}/reject",
    response_model=VoCampaignAssignmentItem,
    summary="Reject campaign village assignment with reason (VO action)"
)
async def reject_vo_campaign_assignment(
    campaign_id: uuid.UUID,
    village_id: uuid.UUID,
    payload: CampaignRejectRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VoCampaignAssignmentItem:
    service = CampaignService(db)
    return await service.reject_vo_campaign_assignment(campaign_id, village_id, payload, current_user, _extract_ip(request))


@router.get(
    "/{campaign_id}/monitoring",
    response_model=CampaignMonitoringResponse,
    summary="Get complete campaign monitoring and village-wise status breakdown"
)
async def get_campaign_monitoring(
    campaign_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignMonitoringResponse:
    service = CampaignService(db)
    return await service.get_campaign_monitoring(campaign_id, current_user, _extract_ip(request))



@router.post(
    "",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new vaccination campaign (DAHO authority)"
)
async def create_campaign(
    payload: CampaignCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignResponse:
    service = CampaignService(db)
    return await service.create_campaign(payload, current_user, _extract_ip(request))


@router.get(
    "",
    response_model=List[CampaignResponse],
    summary="List campaigns scoped to caller's authority"
)
async def list_campaigns(
    status: Optional[str] = Query(None, description="Filter by status (DRAFT, ACTIVE, CLOSED, CANCELLED)"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampaignResponse]:
    service = CampaignService(db)
    return await service.list_campaigns(status, offset, limit, current_user, _extract_ip(request))


@router.get(
    "/{campaign_id}",
    response_model=CampaignDetailResponse,
    summary="Get detailed campaign metrics and targets"
)
async def get_campaign(
    campaign_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignDetailResponse:
    service = CampaignService(db)
    return await service.get_campaign(campaign_id, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/activate",
    response_model=CampaignResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate campaign and snapshot animal population targets (DAHO authority)"
)
async def activate_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignActivateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignResponse:
    service = CampaignService(db)
    return await service.activate_campaign(campaign_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/assignments",
    response_model=CampaignAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign a field worker to a campaign village (VO authority)"
)
async def assign_worker(
    campaign_id: uuid.UUID,
    payload: CampaignAssignmentCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignAssignmentResponse:
    service = CampaignService(db)
    return await service.assign_worker(campaign_id, payload, current_user, _extract_ip(request))


@router.get(
    "/{campaign_id}/assignments",
    response_model=List[CampaignAssignmentResponse],
    summary="List active worker assignments for a campaign"
)
async def list_assignments(
    campaign_id: uuid.UUID,
    village_id: Optional[uuid.UUID] = Query(None, description="Optional village filter"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampaignAssignmentResponse]:
    service = CampaignService(db)
    return await service.list_assignments(campaign_id, village_id, current_user, _extract_ip(request))


@router.get(
    "/{campaign_id}/pending-vaccinations",
    response_model=CampaignPendingVaccinationsResponse,
    summary="Get pending vaccinations grouped by farmer in village"
)
async def get_pending_vaccinations(
    campaign_id: uuid.UUID,
    village_id: Optional[uuid.UUID] = Query(None, description="Target village filter"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignPendingVaccinationsResponse:
    service = CampaignService(db)
    return await service.get_pending_vaccinations(campaign_id, village_id, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/assignments/bulk",
    response_model=List[CampaignAssignmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Assign a worker (VO or FW) to multiple campaign villages"
)
async def assign_workers_bulk(
    campaign_id: uuid.UUID,
    payload: CampaignBulkAssignWorkersRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampaignAssignmentResponse]:
    service = CampaignService(db)
    return await service.assign_workers_bulk(campaign_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/villages/{village_id}/submit-verification",
    response_model=CampaignVillageVerificationItem,
    summary="Submit completed campaign village work for verification"
)
async def submit_village_verification(
    campaign_id: uuid.UUID,
    village_id: uuid.UUID,
    payload: CampaignVillageVerificationSubmitRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignVillageVerificationItem:
    service = CampaignService(db)
    return await service.submit_village_verification(campaign_id, village_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{campaign_id}/villages/{village_id}/verify",
    response_model=CampaignVillageVerificationItem,
    summary="DAHO / TAHO verify, approve or reject village campaign work completion"
)
async def verify_village_completion(
    campaign_id: uuid.UUID,
    village_id: uuid.UUID,
    payload: CampaignVillageVerificationReviewRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CampaignVillageVerificationItem:
    service = CampaignService(db)
    return await service.verify_village_completion(campaign_id, village_id, payload, current_user, _extract_ip(request))


@router.get(
    "/{campaign_id}/verifications",
    response_model=List[CampaignVillageVerificationItem],
    summary="List village verification status for a campaign"
)
async def list_village_verifications(
    campaign_id: uuid.UUID,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ASSIGNED, IN_PROGRESS, SUBMITTED_FOR_VERIFICATION, VERIFIED_COMPLETED, REJECTED, REOPENED)"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampaignVillageVerificationItem]:
    service = CampaignService(db)
    return await service.list_village_verifications(campaign_id, status_filter, current_user, _extract_ip(request))



