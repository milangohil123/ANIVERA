"""FastAPI RESTful endpoints for Disease Surveillance and Reporting domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.disease_surveillance.schemas import (
    DiseaseReportAttachmentResponse,
    DiseaseReportConfirmRequest,
    DiseaseReportCreate,
    DiseaseReportResponse,
    DiseaseReportReviewCreate,
    DiseaseReviewResponse,
    SurveillanceSummaryResponse,
)
from app.modules.disease_surveillance.service import DiseaseSurveillanceService

router = APIRouter(prefix="", tags=["Disease Surveillance & Early Warning"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post(
    "",
    response_model=DiseaseReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a suspected livestock disease report"
)
async def submit_report(
    payload: DiseaseReportCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DiseaseReportResponse:
    service = DiseaseSurveillanceService(db)
    return await service.submit_report(payload, current_user, _extract_ip(request))


@router.get(
    "",
    response_model=List[DiseaseReportResponse],
    summary="List disease reports within caller's verified geographic scope"
)
async def list_reports(
    status: Optional[str] = Query(None, description="Filter by status (SUBMITTED, UNDER_REVIEW, SUSPECTED, CONFIRMED, NOT_CONFIRMED)"),
    disease_code: Optional[str] = Query(None, description="Filter by disease code"),
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by individual animal"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[DiseaseReportResponse]:
    service = DiseaseSurveillanceService(db)
    return await service.list_reports(status, disease_code, animal_id, offset, limit, current_user, _extract_ip(request))


@router.get(
    "/surveillance-summary",
    response_model=List[SurveillanceSummaryResponse],
    summary="Village-level disease surveillance summary"
)
async def get_surveillance_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[SurveillanceSummaryResponse]:
    service = DiseaseSurveillanceService(db)
    return await service.get_surveillance_summary(current_user, _extract_ip(request))


@router.get(
    "/{report_id}",
    response_model=DiseaseReportResponse,
    summary="Get disease report details"
)
async def get_report(
    report_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DiseaseReportResponse:
    service = DiseaseSurveillanceService(db)
    return await service.get_report(report_id, current_user, _extract_ip(request))


@router.post(
    "/{report_id}/reviews",
    response_model=DiseaseReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record veterinary triage / investigation review (Veterinary Officer authority)"
)
async def review_report(
    report_id: uuid.UUID,
    payload: DiseaseReportReviewCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DiseaseReviewResponse:
    service = DiseaseSurveillanceService(db)
    return await service.review_report(report_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{report_id}/decide",
    response_model=DiseaseReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm or disprove disease case (requires explicit departmental authorization 'disease.confirm')"
)
async def decide_report(
    report_id: uuid.UUID,
    payload: DiseaseReportConfirmRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DiseaseReportResponse:
    service = DiseaseSurveillanceService(db)
    return await service.decide_report(report_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{report_id}/attachments",
    response_model=DiseaseReportAttachmentResponse,
    response_model_by_alias=True,
    summary="Upload photographic evidence attachment (sanitized and deduplicated)"
)
async def upload_attachment(
    report_id: uuid.UUID,
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DiseaseReportAttachmentResponse:
    service = DiseaseSurveillanceService(db)
    att_resp, is_duplicate = await service.upload_attachment(
        report_id=report_id,
        file=file,
        current_user=current_user,
        client_ip=_extract_ip(request)
    )
    response.status_code = status.HTTP_200_OK if is_duplicate else status.HTTP_201_CREATED
    return att_resp


@router.get(
    "/{report_id}/attachments",
    response_model=List[DiseaseReportAttachmentResponse],
    response_model_by_alias=True,
    status_code=status.HTTP_200_OK,
    summary="List photographic attachments for a disease report"
)
async def list_attachments(
    report_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[DiseaseReportAttachmentResponse]:
    service = DiseaseSurveillanceService(db)
    return await service.list_attachments(
        report_id=report_id,
        current_user=current_user,
        client_ip=_extract_ip(request)
    )


@router.get(
    "/{report_id}/attachments/{attachment_id}",
    summary="Stream photographic attachment image with security headers"
)
async def get_attachment_stream(
    report_id: uuid.UUID,
    attachment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> StreamingResponse:
    service = DiseaseSurveillanceService(db)
    stream, mime_type, size_bytes, filename = await service.stream_attachment(
        report_id=report_id,
        attachment_id=attachment_id,
        current_user=current_user,
        client_ip=_extract_ip(request)
    )
    headers = {
        "Content-Disposition": f'inline; filename="{filename}"',
        "X-Content-Type-Options": "nosniff",
        "Content-Length": str(size_bytes),
    }
    return StreamingResponse(stream, media_type=mime_type, headers=headers)


