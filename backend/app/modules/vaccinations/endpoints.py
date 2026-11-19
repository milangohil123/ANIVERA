"""FastAPI RESTful endpoints for Vaccinations, Treatments, and Animal Events."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.vaccinations.schemas import (
    EventCorrectionRequest,
    EventCorrectionResponse,
    EventReviewRequest,
    ObservationRecordCreate,
    ObservationResponse,
    TreatmentRecordCreate,
    TreatmentResponse,
    VaccinationRecordCreate,
    VaccinationResponse,
)
from app.modules.vaccinations.service import VaccinationService

router = APIRouter(prefix="", tags=["Vaccination & Animal Events"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "",
    response_model=VaccinationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an animal vaccination event (separately authorised vaccinator)"
)
async def record_vaccination(
    payload: VaccinationRecordCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VaccinationResponse:
    service = VaccinationService(db)
    return await service.record_vaccination(payload, current_user, _extract_ip(request))


@router.get(
    "",
    response_model=List[VaccinationResponse],
    summary="List vaccination events within caller's scope"
)
async def list_vaccinations(
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by animal"),
    village_id: Optional[uuid.UUID] = Query(None, description="Filter by village"),
    programme_code: Optional[str] = Query(None, description="Filter by programme"),
    campaign_id: Optional[uuid.UUID] = Query(None, description="Filter by campaign"),
    camp_id: Optional[uuid.UUID] = Query(None, description="Filter by camp"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VaccinationResponse]:
    service = VaccinationService(db)
    return await service.list_vaccinations(
        animal_id=animal_id,
        village_id=village_id,
        programme_code=programme_code,
        campaign_id=campaign_id,
        camp_id=camp_id,
        offset=offset,
        limit=limit,
        current_user=current_user,
        client_ip=_extract_ip(request)
    )


@router.post(
    "/treatments",
    response_model=TreatmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an animal veterinary treatment consultation"
)
async def record_treatment(
    payload: TreatmentRecordCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TreatmentResponse:
    service = VaccinationService(db)
    return await service.record_treatment(payload, current_user, _extract_ip(request))


@router.get(
    "/treatments",
    response_model=List[TreatmentResponse],
    summary="List animal veterinary treatment consultations"
)
async def list_treatments(
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by animal"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TreatmentResponse]:
    service = VaccinationService(db)
    return await service.list_treatments(
        animal_id=animal_id,
        offset=offset,
        limit=limit,
        current_user=current_user,
        client_ip=_extract_ip(request)
    )


@router.post(
    "/events/{event_id}/review",
    status_code=status.HTTP_200_OK,
    summary="Review or flag an animal event (Veterinary Officer authority)"
)
async def review_event(
    event_id: uuid.UUID,
    payload: EventReviewRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> dict:
    service = VaccinationService(db)
    await service.review_event(event_id, payload, current_user, _extract_ip(request))
    return {"status": "SUCCESS", "message": f"Event review status updated to {payload.review_status}"}


@router.post(
    "/events/{event_id}/correct",
    response_model=EventCorrectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Amend or void an animal event with mandatory reason (Veterinary Officer authority)"
)
async def correct_event(
    event_id: uuid.UUID,
    payload: EventCorrectionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> EventCorrectionResponse:
    service = VaccinationService(db)
    return await service.correct_event(event_id, payload, current_user, _extract_ip(request))

