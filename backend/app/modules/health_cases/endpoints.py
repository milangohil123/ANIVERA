"""FastAPI RESTful endpoints for connected Animal Health, Case Assignment,
Treatment Verification, Dairy Cooperative Recurring Vaccination Schedules, and Timeline.
"""
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.administration.daho_cooperative_service import DahoCooperativeService
from app.modules.authentication.models import User
from app.modules.health_cases.schemas import (
    AnimalTimelineEventItem,
    CaseAssignmentRequest,
    CaseTreatmentRecordRequest,
    CaseTreatmentVerificationRequest,
    CooperativeScheduleSummary,
    DiseaseClusterAlert,
    FarmerDiseaseReportCreate,
    FarmerDiseaseReportItem,
    RecurringScheduleCreateRequest,
    ScheduleDecisionRequest,
    ScheduleEligibilityPreviewResponse,
)
from app.modules.health_cases.service import HealthWorkflowService

router = APIRouter(prefix="/health-cases", tags=["Connected Health & Recurring Vaccination Workflows"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# Part A: Farmer Disease Reporting
# ---------------------------------------------------------------------------
@router.post(
    "/farmer/reports",
    response_model=FarmerDiseaseReportItem,
    status_code=status.HTTP_201_CREATED,
    summary="Farmer reports an animal health issue or suspected disease"
)
async def submit_farmer_health_report(
    payload: FarmerDiseaseReportCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.submit_farmer_report(payload, current_user, _extract_ip(request))


@router.get(
    "/farmer/reports",
    response_model=List[FarmerDiseaseReportItem],
    summary="List disease reports filed by current farmer"
)
async def list_farmer_health_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.list_farmer_reports(current_user)


# ---------------------------------------------------------------------------
# Part B: TAHO Case Assignment & Treatment Verification
# ---------------------------------------------------------------------------
@router.get(
    "/taho/cases",
    response_model=List[FarmerDiseaseReportItem],
    summary="List health cases in caller's Taluka for TAHO assignment and review"
)
async def list_taho_cases(
    taluka_id: Optional[uuid.UUID] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    disease_code: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.list_taho_cases(
        current_user,
        taluka_id=taluka_id,
        village_id=village_id,
        disease_code=disease_code,
        urgency=urgency,
        status_filter=status_filter,
        limit=limit
    )


@router.post(
    "/taho/cases/{report_id}/assign",
    summary="TAHO assigns a case to VO, FW, or both with priority and instructions"
)
async def assign_case(
    report_id: uuid.UUID,
    payload: CaseAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.assign_taho_case(report_id, payload, current_user)


@router.post(
    "/taho/cases/{report_id}/verify",
    summary="TAHO approves or rejects treatment verification"
)
async def verify_treatment(
    report_id: uuid.UUID,
    payload: CaseTreatmentVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.verify_taho_treatment(report_id, payload, current_user)


# ---------------------------------------------------------------------------
# Part B.2: DAHO District-Wide Case Monitoring, Overdue Escalation & Assignment
# ---------------------------------------------------------------------------
@router.get(
    "/daho/cases",
    response_model=List[FarmerDiseaseReportItem],
    summary="List disease cases across District for DAHO monitoring and overdue escalation"
)
async def list_daho_cases(
    taluka_id: Optional[uuid.UUID] = Query(None),
    disease_code: Optional[str] = Query(None),
    is_overdue_only: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.list_daho_cases(
        current_user,
        taluka_id=taluka_id,
        disease_code=disease_code,
        is_overdue_only=is_overdue_only,
        limit=limit
    )


@router.post(
    "/daho/cases/{report_id}/assign",
    summary="DAHO directly assigns an authorized VO to an overdue or escalated case"
)
async def assign_daho_case(
    report_id: uuid.UUID,
    payload: CaseAssignmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.assign_taho_case(report_id, payload, current_user)


@router.get(
    "/gis/clusters",
    response_model=List[DiseaseClusterAlert],
    summary="Data-driven potential disease clusters and suspected outbreak alerts"
)
async def get_disease_clusters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.get_disease_clusters(current_user)


# ---------------------------------------------------------------------------
# Part C: VO / FW Treatment Workflow
# ---------------------------------------------------------------------------
@router.get(
    "/staff/cases",
    response_model=List[FarmerDiseaseReportItem],
    summary="List health cases assigned to current VO or Field Worker"
)
async def list_assigned_cases_for_staff(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.list_assigned_cases_for_staff(current_user)


@router.post(
    "/staff/cases/{report_id}/treatment",
    summary="VO/FW records clinical treatment, medicines, and submits for TAHO verification"
)
async def record_case_treatment(
    report_id: uuid.UUID,
    payload: CaseTreatmentRecordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.record_case_treatment(report_id, payload, current_user)


# ---------------------------------------------------------------------------
# Part D: Dairy Cooperative Recurring Vaccination Schedules
# ---------------------------------------------------------------------------
@router.get(
    "/coop/schedules/preview-eligibility",
    response_model=ScheduleEligibilityPreviewResponse,
    summary="Preview eligible linked member animals for proposed schedule"
)
async def preview_schedule_eligibility(
    programme_code: str = Query("FMD"),
    target_species: str = Query("CATTLE,BUFFALO"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    coop_service = DahoCooperativeService(db)
    coop = await coop_service._resolve_user_cooperative(current_user)
    if not coop:
        return ScheduleEligibilityPreviewResponse(
            total_selected_farmers=0,
            total_selected_animals=0,
            species_breakdown={},
            village_breakdown={},
            already_vaccinated_count=0,
            existing_schedule_conflicts_count=0,
            eligible_count=0,
            preview_animals=[]
        )

    species_list = [s.strip() for s in target_species.split(",") if s.strip()]
    service = HealthWorkflowService(db)
    return await service.preview_schedule_eligibility(coop.id, programme_code, species_list, [])


@router.post(
    "/coop/schedules",
    response_model=CooperativeScheduleSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Dairy Cooperative creates a recurring vaccination schedule"
)
async def create_cooperative_schedule(
    payload: RecurringScheduleCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    coop_service = DahoCooperativeService(db)
    coop = await coop_service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ડેરી સહકારી મંડળી મળી નથી (Cooperative not found)"
        )
    service = HealthWorkflowService(db)
    return await service.create_recurring_schedule(coop.id, payload, current_user)


@router.get(
    "/coop/schedules",
    response_model=List[CooperativeScheduleSummary],
    summary="List all recurring schedules for caller's Dairy Cooperative"
)
async def list_cooperative_schedules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    coop_service = DahoCooperativeService(db)
    coop = await coop_service._resolve_user_cooperative(current_user)
    if not coop:
        return []
    service = HealthWorkflowService(db)
    return await service.list_cooperative_schedules(coop.id)


@router.post(
    "/coop/schedules/{schedule_id}/submit",
    summary="Cooperative submits a draft schedule to TAHO for approval"
)
async def submit_schedule_to_taho(
    schedule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.submit_schedule_to_taho(schedule_id, current_user)


# ---------------------------------------------------------------------------
# Part E: TAHO Schedule Approval
# ---------------------------------------------------------------------------
@router.get(
    "/taho/schedules",
    response_model=List[CooperativeScheduleSummary],
    summary="List cooperative schedules in caller's Taluka for TAHO review"
)
async def list_taho_schedules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.list_taho_schedules(current_user)


@router.post(
    "/taho/schedules/{schedule_id}/decide",
    summary="TAHO approves, rejects, or requests changes on cooperative schedule"
)
async def decide_schedule_by_taho(
    schedule_id: uuid.UUID,
    payload: ScheduleDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.decide_schedule_by_taho(schedule_id, payload, current_user)


# ---------------------------------------------------------------------------
# Part F: 15-Day Reminders Automatic Check
# ---------------------------------------------------------------------------
@router.post(
    "/reminders/check-15-days",
    summary="Scan active cycles and dispatch automatic 15-day reminders to farmer & cooperative"
)
async def trigger_15_day_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.check_and_dispatch_15_day_reminders()


# ---------------------------------------------------------------------------
# Part G: Animal Chronological Timeline
# ---------------------------------------------------------------------------
@router.get(
    "/animals/{animal_id}/timeline",
    response_model=List[AnimalTimelineEventItem],
    summary="Complete chronological animal medical and vaccination history timeline"
)
async def get_animal_timeline(
    animal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = HealthWorkflowService(db)
    return await service.get_animal_timeline(animal_id)
