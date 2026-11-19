"""FastAPI route handlers for Reports and CSV Exports domain."""
import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.reports.formula_guard import generate_safe_csv
from app.modules.reports.schemas import (
    CampaignCoverageReportItem,
    CoopProgressReportItem,
    ExportLogItem,
    InventoryReportItem,
    RegistryCountsReportItem,
    StaffActivityReportItem,
    SurveillanceReportItem,
)
from app.modules.reports.service import ReportService

router = APIRouter(prefix="", tags=["Reports & Analytics"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ------------------------------------------------------------------------------
# 1. Campaign Coverage Report
# ------------------------------------------------------------------------------

@router.get("/campaign-coverage", response_model=List[CampaignCoverageReportItem], summary="Campaign vaccination coverage report")
async def get_campaign_coverage_report(
    campaign_id: Optional[uuid.UUID] = Query(None, description="Campaign ID filter"),
    village_id: Optional[uuid.UUID] = Query(None, description="Village ID filter"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CampaignCoverageReportItem]:
    service = ReportService(db)
    return await service.get_campaign_coverage_report(current_user, campaign_id, village_id, _extract_ip(request))


@router.get("/campaign-coverage/csv", summary="Export campaign coverage report as formula-safe CSV")
async def export_campaign_coverage_csv(
    campaign_id: Optional[uuid.UUID] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_campaign_coverage_report(current_user, campaign_id, village_id, _extract_ip(request))

    headers = ["ઝુંબેશનું નામ", "ગામનું નામ", "કાર્યક્રમ", "લાયક પશુઓ (Eligible)", "રસી અપાયેલ (Covered)", "લક્ષ્યાંક નોંધ"]
    rows = [
        [i.campaign_name, i.village_name_gu, i.programme_code, i.eligible_count, i.covered_count, i.note]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="CAMPAIGN_COVERAGE",
        filters={"campaign_id": str(campaign_id) if campaign_id else None, "village_id": str(village_id) if village_id else None},
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"campaign_coverage_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 2. Inventory & Stock Report
# ------------------------------------------------------------------------------

@router.get("/inventory", response_model=List[InventoryReportItem], summary="District vaccine inventory report")
async def get_inventory_report(
    district_id: Optional[uuid.UUID] = Query(None, description="District ID filter"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[InventoryReportItem]:
    service = ReportService(db)
    return await service.get_inventory_report(current_user, district_id, _extract_ip(request))


@router.get("/inventory/csv", summary="Export vaccine inventory report as formula-safe CSV")
async def export_inventory_csv(
    district_id: Optional[uuid.UUID] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_inventory_report(current_user, district_id, _extract_ip(request))

    headers = ["ઉત્પાદન કોડ", "રસીનું નામ", "કાર્યક્રમ", "બેચ નંબર", "આવેલ ડોઝ", "વિતરિત ડોઝ", "વ્યય / ફેરફાર", "વર્તમાન સ્ટોક", "મુદત પૂર્ણ તારીખ"]
    rows = [
        [
            i.product_code,
            i.product_name,
            i.programme_code or "-",
            i.batch_number,
            i.received_doses,
            i.issued_doses,
            i.adjusted_doses,
            i.current_balance,
            i.expiry_date.strftime("%d/%m/%Y") if i.expiry_date else "-"
        ]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="INVENTORY_STOCK",
        filters={"district_id": str(district_id) if district_id else None},
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"vaccine_inventory_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 3. Surveillance Report
# ------------------------------------------------------------------------------

@router.get("/surveillance", response_model=List[SurveillanceReportItem], summary="Disease surveillance summary report")
async def get_surveillance_report(
    disease_code: Optional[str] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[SurveillanceReportItem]:
    service = ReportService(db)
    return await service.get_surveillance_report(current_user, disease_code, village_id, start_date, end_date, _extract_ip(request))


@router.get("/surveillance/csv", summary="Export surveillance report as formula-safe CSV")
async def export_surveillance_csv(
    disease_code: Optional[str] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_surveillance_report(current_user, disease_code, village_id, start_date, end_date, _extract_ip(request))

    headers = [
        "ગામનું નામ",
        "રોગનું નામ (Disease)",
        "શંકાસ્પદ કેસ (Suspected)",
        "પુષ્ટિ થયેલ (Confirmed)",
        "અનપુષ્ટિ (Not Confirmed)",
        "અપૂર્ણ માહિતી",
        "છેલ્લા રિપોર્ટની તારીખ",
        "સ્થિતિ"
    ]
    rows = [
        [
            i.village_name_gu,
            i.disease_code,
            i.suspected_count,
            i.confirmed_count,
            i.not_confirmed_count,
            i.insufficient_count,
            i.latest_report_date.strftime("%d/%m/%Y") if i.latest_report_date else "-",
            i.data_freshness_status
        ]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="SURVEILLANCE",
        filters={"disease_code": disease_code, "village_id": str(village_id) if village_id else None},
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"surveillance_summary_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 4. Registry Counts Report
# ------------------------------------------------------------------------------

@router.get("/registry-counts", response_model=List[RegistryCountsReportItem], summary="Village livestock registry counts")
async def get_registry_report(
    village_id: Optional[uuid.UUID] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[RegistryCountsReportItem]:
    service = ReportService(db)
    return await service.get_registry_report(current_user, village_id, _extract_ip(request))


@router.get("/registry-counts/csv", summary="Export registry counts as formula-safe CSV")
async def export_registry_csv(
    village_id: Optional[uuid.UUID] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_registry_report(current_user, village_id, _extract_ip(request))

    headers = [
        "ગામનું નામ",
        "પશુપાલકોની સંખ્યા (Farmers)",
        "ગાય (Cattle)",
        "ભેંસ (Buffalo)",
        "બકરી (Goat)",
        "ઘેટાં (Sheep)",
        "કુલ નોંધાયેલ પશુઓ",
        "ચકાસાયેલ પશુઓ (Verified)"
    ]
    rows = [
        [
            i.village_name_gu,
            i.farmer_count,
            i.cattle_count,
            i.buffalo_count,
            i.goat_count,
            i.sheep_count,
            i.total_animals,
            i.verified_animals
        ]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="REGISTRY_COUNTS",
        filters={"village_id": str(village_id) if village_id else None},
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"registry_counts_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 5. Staff Activity Report
# ------------------------------------------------------------------------------

@router.get("/staff-activity", response_model=List[StaffActivityReportItem], summary="Field Worker and VO activity report")
async def get_staff_activity_report(
    role_filter: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[StaffActivityReportItem]:
    service = ReportService(db)
    return await service.get_staff_activity_report(current_user, role_filter, start_date, end_date, _extract_ip(request))


@router.get("/staff-activity/csv", summary="Export staff activity as formula-safe CSV")
async def export_staff_activity_csv(
    role_filter: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_staff_activity_report(current_user, role_filter, start_date, end_date, _extract_ip(request))

    headers = ["કર્મચારીનું નામ", "હોદ્દો (Role)", "પશુ નોંધણી (Registrations)", "રસીકરણ (Vaccinations)", "રોગ અહેવાલો (Disease Reports)"]
    rows = [
        [i.staff_name, i.role, i.registrations_count, i.vaccinations_count, i.disease_reports_count]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="STAFF_ACTIVITY",
        filters={"role": role_filter},
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"staff_activity_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 6. Cooperative Village Progress Report (Aggregate only)
# ------------------------------------------------------------------------------

@router.get("/coop-progress", response_model=List[CoopProgressReportItem], summary="Dairy cooperative aggregate vaccination progress")
async def get_coop_progress_report(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CoopProgressReportItem]:
    service = ReportService(db)
    return await service.get_coop_progress_report(current_user, _extract_ip(request))


@router.get("/coop-progress/csv", summary="Export cooperative progress as formula-safe CSV")
async def export_coop_progress_csv(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Response:
    service = ReportService(db)
    items = await service.get_coop_progress_report(current_user, _extract_ip(request))

    headers = ["ગામનું નામ", "કુલ પશુઓ", "રસી અપાયેલ પશુઓ", "બાકી પશુઓ (Pending)"]
    rows = [
        [i.village_name_gu, i.total_animals, i.vaccinated_count, i.pending_count]
        for i in items
    ]
    csv_text = generate_safe_csv(headers, rows)

    await service.log_export(
        user_id=current_user.id,
        export_type="COOP_PROGRESS",
        row_count=len(rows),
        formula_safe=True
    )

    filename = f"coop_progress_{date.today().isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ------------------------------------------------------------------------------
# 7. Export History
# ------------------------------------------------------------------------------

@router.get("/export-history", response_model=List[ExportLogItem], summary="List export logs for authenticated user")
async def get_export_history(
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[ExportLogItem]:
    service = ReportService(db)
    return await service.get_export_history(current_user, limit, _extract_ip(request))

