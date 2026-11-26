"""FastAPI endpoints for Vaccination and Disease Inference Analytics Dashboard."""
import uuid
from datetime import date
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.reports.analytics_service import AnalyticsService

router = APIRouter(prefix="", tags=["Inference & Analytics"])


@router.get(
    "/metadata",
    summary="Get permitted filter options (districts, talukas, programmes, diseases, species)",
    description="Returns available filter options strictly filtered by the authenticated user's geographic and organizational scope."
)
async def get_analytics_metadata(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    service = AnalyticsService(db)
    return await service.get_filter_metadata(current_user)


@router.get(
    "/vaccination",
    summary="Get aggregated vaccination analytics, coverage %, and trend telemetry",
    description="Calculates coverage percentage, eligible vs vaccinated animals, district comparisons, and time trends strictly scoped to user authority."
)
async def get_vaccination_analytics(
    programme_code: Optional[str] = Query(None, description="Filter by programme code"),
    vaccine_code: Optional[str] = Query(None, description="Filter by vaccine product code"),
    disease_code: Optional[str] = Query(None, description="Filter by disease code"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    district_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected district IDs"),
    taluka_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected taluka IDs"),
    village_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected village IDs"),
    species_codes: Optional[List[str]] = Query(None, description="Selected species codes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    service = AnalyticsService(db)
    return await service.get_vaccination_analytics(
        current_user=current_user,
        programme_code=programme_code,
        vaccine_code=vaccine_code,
        disease_code=disease_code,
        start_date=start_date,
        end_date=end_date,
        district_ids=district_ids,
        taluka_ids=taluka_ids,
        village_ids=village_ids,
        species_codes=species_codes,
    )


@router.get(
    "/disease",
    summary="Get aggregated disease surveillance analytics, report patterns, and hotspots",
    description="Aggregates reported cases, confirmations, pending investigations, status distribution, and regional clusters strictly scoped to user authority."
)
async def get_disease_analytics(
    disease_code: Optional[str] = Query(None, description="Filter by disease code"),
    status: Optional[str] = Query(None, description="Filter by disease report status"),
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    district_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected district IDs"),
    taluka_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected taluka IDs"),
    village_ids: Optional[List[uuid.UUID]] = Query(None, description="Selected village IDs"),
    species_codes: Optional[List[str]] = Query(None, description="Selected species codes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    service = AnalyticsService(db)
    return await service.get_disease_analytics(
        current_user=current_user,
        disease_code=disease_code,
        status=status,
        start_date=start_date,
        end_date=end_date,
        district_ids=district_ids,
        taluka_ids=taluka_ids,
        village_ids=village_ids,
        species_codes=species_codes,
    )
