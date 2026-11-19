"""FastAPI RESTful endpoints for Field Worker Duty Management, Live Location Tracking & Smart Assignments."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.models.geography import District
from app.modules.authentication.models import User
from app.modules.duty.grouping_service import ComplaintGroupingService
from app.modules.duty.recommendation_engine import FwRecommendationEngine
from app.modules.duty.schemas import (
    AssignFwRequest,
    AssignmentActionResponse,
    ComplaintGroupResponse,
    ComplaintItemResponse,
    CreateHelpRequestPayload,
    DutyEndRequest,
    DutyEndResponse,
    DutyStartRequest,
    DutyStartResponse,
    DutyStatusResponse,
    FwStatusUpdateRequest,
    GroupRecommendationsResponse,
    LocationUpdateRequest,
    LocationUpdateResponse,
    VoLiveFieldWorkersResponse,
)
from app.modules.duty.service import DutyService
from app.modules.duty.table_setup import ensure_duty_tables

router = APIRouter(prefix="", tags=["Duty & Smart Location Tracking"])


# ==============================================================================
# 1. Field Worker Duty Session Lifecycle
# ==============================================================================

@router.post("/start", response_model=DutyStartResponse, summary="Start Field Worker duty session with live GPS")
async def start_duty(
    payload: DutyStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DutyStartResponse:
    """Start active duty session. Requires authenticated FW role and valid device GPS coordinates."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    return await service.start_duty(
        current_user=current_user,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        device_status=payload.device_status
    )


@router.post("/end", response_model=DutyEndResponse, summary="End active Field Worker duty session")
async def end_duty(
    payload: Optional[DutyEndRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DutyEndResponse:
    """Complete active duty session. Halts location tracking."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    session_id = await service.end_duty(current_user=current_user, reason=payload.reason if payload else None)
    return DutyEndResponse(
        session_id=session_id,
        fw_user_id=current_user.id,
        status="INACTIVE"
    )


@router.post("/location", response_model=LocationUpdateResponse, summary="Periodic location update during active duty")
async def update_location(
    payload: LocationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> LocationUpdateResponse:
    """Submit periodic GPS location during duty (recommended interval: 10 mins)."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    session_id = await service.record_location_update(
        current_user=current_user,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy=payload.accuracy,
        source=payload.source,
        recorded_at=payload.recorded_at,
        session_id=payload.session_id
    )
    return LocationUpdateResponse(
        success=True,
        session_id=session_id,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc)
    )


@router.get("/status", response_model=DutyStatusResponse, summary="Get caller's current duty & location status")
async def get_duty_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DutyStatusResponse:
    """Check if the Field Worker is currently on duty and get last recorded position."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    return await service.get_duty_status(current_user)


@router.get("/assignments", response_model=List[ComplaintGroupResponse], summary="List assigned complaint groups for FW")
async def get_fw_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[ComplaintGroupResponse]:
    """Retrieve all complaint groups assigned to the authenticated Field Worker."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    return await service.list_complaint_groups(current_user)


@router.post("/assignments/{group_id}/status", summary="Update assignment progress status by FW")
async def update_assignment_status(
    group_id: uuid.UUID,
    payload: FwStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Field Worker updates status: ACCEPT, START_VISIT, COMPLETE."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    group = await service.update_fw_assignment_status(
        group_id=group_id,
        action=payload.action,
        complaint_id=payload.complaint_id,
        outcome_note=payload.outcome_note,
        current_user=current_user
    )
    return {
        "success": True,
        "group_id": group.id,
        "status": group.status,
        "message": "કામગીરી સ્થિતિ સફળતાપૂર્વક અપડેટ થઈ ગઈ છે."
    }


# ==============================================================================
# 2. VO Live Tracking & GIS Map Endpoints
# ==============================================================================

@router.get("/vo/live-field-workers", response_model=VoLiveFieldWorkersResponse, summary="Live Field Worker locations for VO map")
async def get_vo_live_field_workers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VoLiveFieldWorkersResponse:
    """Fetch live location and duty status of all Field Workers in VO's jurisdiction."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    return await service.get_live_field_workers_for_vo(current_user)


# ==============================================================================
# 3. VO Complaint Groups & Intelligent Recommendation Endpoints
# ==============================================================================

@router.get("/vo/complaint-groups", response_model=List[ComplaintGroupResponse], summary="List complaint assignment groups for VO")
async def list_complaint_groups_vo(
    status_filter: Optional[str] = Query(None, description="Optional status filter"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[ComplaintGroupResponse]:
    """List all complaint assignment groups in VO's jurisdiction."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    return await service.list_complaint_groups(current_user, status_filter=status_filter)


@router.post("/vo/complaint-groups/generate", response_model=List[ComplaintGroupResponse], summary="Trigger automatic complaint grouping")
async def generate_complaint_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[ComplaintGroupResponse]:
    """Identify pending unassigned complaints in nearby villages and group them automatically."""
    await ensure_duty_tables(db)
    scope = await DutyService(db).authz.get_user_scope(current_user)

    district_ids = list(scope.assigned_district_ids)
    if not district_ids:
        # Fallback to Botad District ID if not explicitly assigned
        d_res = await db.execute(select(District.id).limit(1))
        d_id = d_res.scalar()
        if d_id:
            district_ids = [d_id]

    if not district_ids:
        raise HTTPException(status_code=400, detail="કોઈ માન્ય જિલ્લો મળ્યો નથી.")

    grouping_svc = ComplaintGroupingService(db)
    created_groups = []
    for d_id in district_ids:
        groups = await grouping_svc.generate_groups_for_district(
            district_id=d_id,
            assigned_village_ids=scope.assigned_village_ids if current_user.role != "DAHO" else None
        )
        created_groups.extend(groups)

    service = DutyService(db)
    return await service.list_complaint_groups(current_user)


@router.get("/vo/complaint-groups/{group_id}/recommendations", response_model=GroupRecommendationsResponse, summary="Get top 2-3 recommended FWs for group")
async def get_group_recommendations(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GroupRecommendationsResponse:
    """Calculate and return top 2-3 suitable Field Workers ranked by distance, availability, and workload."""
    await ensure_duty_tables(db)
    engine = FwRecommendationEngine(db)
    return await engine.get_recommendations_for_group(group_id, current_user)


@router.post("/vo/complaint-groups/{group_id}/assign", response_model=AssignmentActionResponse, summary="VO final assignment confirmation or manual override")
async def assign_group(
    group_id: uuid.UUID,
    payload: AssignFwRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AssignmentActionResponse:
    """Confirm assignment of a complaint group to a Field Worker (recommended or manual)."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    group = await service.assign_group_to_fw(
        group_id=group_id,
        fw_user_id=payload.fw_user_id,
        reason=payload.reason,
        current_user=current_user
    )

    # Get FW full name
    fw_name_res = await db.execute(select(User.full_name).where(User.id == payload.fw_user_id))
    fw_name = fw_name_res.scalar() or "ક્ષેત્રીય કાર્યકર"

    return AssignmentActionResponse(
        success=True,
        group_id=group.id,
        assigned_fw_id=payload.fw_user_id,
        assigned_fw_name=fw_name,
        status="ASSIGNED",
        message=f"ફરિયાદ જૂથ સફળતાપૂર્વક {fw_name} ને સોંપવામાં આવ્યું છે."
    )


@router.post("/vo/complaints/create", summary="VO manual registration of a farmer complaint / help request")
async def create_complaint(
    payload: CreateHelpRequestPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Register a new animal medical complaint / help request."""
    await ensure_duty_tables(db)
    service = DutyService(db)
    req = await service.create_help_request(payload, current_user)
    return {
        "success": True,
        "complaint_id": req.id,
        "reference_no": req.reference_no,
        "message": f"ફરિયાદ નોંધણી સફળ થઈ. સંદર્ભ નંબર: {req.reference_no}"
    }
