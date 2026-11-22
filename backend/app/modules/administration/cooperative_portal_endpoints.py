"""API Endpoints for Dairy Cooperative Portal (/api/v1/cooperative/...).

Dedicated portal endpoints for users logged in with role DAIRY_STAFF.
Enforces:
- Cooperative scope (only data linked to the caller's assigned cooperative)
- Member farmer filtering (only farmers linked in cooperative_memberships)
- Member livestock filtering (only animals owned by linked members)
- Read-only vaccination telemetry, campaigns, and disease surveillance
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.administration.cooperative_schemas import (
    CoopAnimalItem,
    CoopCampaignItem,
    CoopDashboardAnalyticsResponse,
    CooperativeDetailResponse,
    CooperativeMemberItem,
    CooperativeMemberLinkRequest,
    CoopSurveillanceItem,
    CoopVaccinationItem,
    CoopVillageItem,
)
from app.modules.administration.daho_cooperative_service import DahoCooperativeService
from app.modules.authentication.models import User

router = APIRouter()


def _extract_ip(request: Request) -> Optional[str]:
    if request.client:
        return request.client.host
    return None


@router.get("/me", response_model=CooperativeDetailResponse, summary="Retrieve caller's cooperative profile")
async def get_my_cooperative_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve detailed profile of the logged-in user's cooperative."""
    if current_user.role not in ("DAIRY_STAFF", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ડેરી સહકારી મંડળી પોર્ટલ ફક્ત ડેરી સ્ટાફ માટે ઉપલબ્ધ છે (Access restricted to Dairy Staff)",
        )
    service = DahoCooperativeService(db)
    coop = await service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="તમારા એકાઉન્ટ સાથે કોઈ ડેરી સહકારી મંડળી સંકળાયેલ નથી",
        )
    return await service.get_cooperative(current_user, coop.id)


@router.get("/analytics", response_model=CoopDashboardAnalyticsResponse, summary="10-KPI and 8-Chart cooperative dashboard analytics")
async def get_cooperative_analytics(
    coop_id: Optional[uuid.UUID] = Query(None, description="Optional cooperative ID for DAHO/Admin overview"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Calculate 10 real KPIs and 8 dynamic charts strictly for linked member livestock."""
    service = DahoCooperativeService(db)
    return await service.get_coop_dashboard_analytics(current_user, coop_id)


@router.get("/farmers", response_model=List[CooperativeMemberItem], summary="List linked member farmers")
async def list_member_farmers(
    search: Optional[str] = Query(None, description="Search by name, code, mobile, or member number"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List member farmers linked to caller's cooperative."""
    service = DahoCooperativeService(db)
    coop = await service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="મંડળી મળી નથી")
    return await service.list_cooperative_members(current_user, coop.id, search=search, limit=limit, offset=offset)


@router.post("/farmers", response_model=CooperativeMemberItem, summary="Link a farmer to cooperative")
async def link_member_farmer(
    payload: CooperativeMemberLinkRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Link a registered farmer as a member of this cooperative."""
    service = DahoCooperativeService(db)
    coop = await service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="મંડળી મળી નથી")
    return await service.link_farmer(current_user, coop.id, payload, _extract_ip(request))


@router.delete("/farmers/{farmer_id}", summary="Unlink a farmer from cooperative")
async def unlink_member_farmer(
    farmer_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Remove a farmer from cooperative membership."""
    service = DahoCooperativeService(db)
    coop = await service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="મંડળી મળી નથી")
    return await service.unlink_farmer(current_user, coop.id, farmer_id, _extract_ip(request))


@router.get("/animals", response_model=List[CoopAnimalItem], summary="List member livestock")
async def list_member_animals(
    species: Optional[str] = Query(None, description="Filter by CATTLE, BUFFALO, GOAT, SHEEP"),
    status: Optional[str] = Query(None, description="Filter by COVERED, PARTIAL, PENDING, OVERDUE"),
    search: Optional[str] = Query(None, description="Search by tag, animal code, owner name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List only livestock owned by linked member farmers."""
    service = DahoCooperativeService(db)
    return await service.list_coop_animals(
        current_user,
        species_filter=species,
        status_filter=status,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/vaccinations", response_model=List[CoopVaccinationItem], summary="Vaccination telemetry (Read-Only)")
async def list_member_vaccinations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Read-only vaccination events for linked member livestock."""
    service = DahoCooperativeService(db)
    return await service.list_coop_vaccinations(current_user, limit=limit, offset=offset)


@router.get("/surveillance", response_model=List[CoopSurveillanceItem], summary="Disease surveillance alerts (Read-Only)")
async def list_village_surveillance(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Read-only observation of disease alerts in cooperative operational villages."""
    service = DahoCooperativeService(db)
    return await service.list_coop_surveillance(current_user, limit=limit, offset=offset)


@router.get("/reports", summary="Exportable cooperative reports data")
async def get_cooperative_reports(
    report_type: str = Query("farmers", description="farmers, animals, vaccinations, pending, coverage"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Exportable structured tabular reports for CSV, JSON, and Print formats."""
    service = DahoCooperativeService(db)
    coop = await service._resolve_user_cooperative(current_user)
    if not coop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="મંડળી મળી નથી")

    if report_type == "farmers":
        data = await service.list_cooperative_members(current_user, coop.id, limit=500)
        return {
            "title": f"{coop.name_gu} — સભાસદ ખેડૂત યાદી (Member Farmers Directory)",
            "generated_at": datetime.utcnow().isoformat(),
            "cooperative": coop.name_gu,
            "rows": [d.model_dump() for d in data],
        }
    elif report_type == "animals":
        data = await service.list_coop_animals(current_user, limit=500)
        return {
            "title": f"{coop.name_gu} — સંલગ્ન પશુધન રજીસ્ટર (Livestock Register)",
            "generated_at": datetime.utcnow().isoformat(),
            "cooperative": coop.name_gu,
            "rows": [d.model_dump() for d in data],
        }
    elif report_type == "vaccinations":
        data = await service.list_coop_vaccinations(current_user, limit=500)
        return {
            "title": f"{coop.name_gu} — રસીકરણ વિગતવાર યાદી (Vaccination Telemetry)",
            "generated_at": datetime.utcnow().isoformat(),
            "cooperative": coop.name_gu,
            "rows": [d.model_dump() for d in data],
        }
    else:
        analytics = await service.get_coop_dashboard_analytics(current_user, coop.id)
        return {
            "title": f"{coop.name_gu} — રસીકરણ કવરેજ સારાંશ (Coverage Summary)",
            "generated_at": datetime.utcnow().isoformat(),
            "cooperative": coop.name_gu,
            "kpis": analytics.kpis,
            "charts": analytics.charts,
        }


@router.get("/village-map", summary="GIS Map data with color-coded operational villages and coverage")
async def get_cooperative_village_map(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve GeoJSON boundaries and live coverage telemetry for cooperative operational villages."""
    service = DahoCooperativeService(db)
    return await service.get_coop_village_map(current_user)


@router.get("/villages/{village_id}/details", summary="Deep telemetry of what happened in a specific village")
async def get_cooperative_village_details(
    village_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve comprehensive breakdown (farmers, animals, vaccinations, disease surveillance, camps) for a village."""
    service = DahoCooperativeService(db)
    return await service.get_coop_village_details(current_user, village_id)
