"""FastAPI endpoints for Geospatial and Map layers."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.maps.schemas import MapLayersResponse
from app.modules.maps.service import MapService

router = APIRouter(prefix="", tags=["Geospatial & Maps"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("/layers", response_model=MapLayersResponse, summary="Scope-filtered map layers for disease surveillance and vaccination coverage")
async def get_map_layers(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> MapLayersResponse:
    """Fetch scope-filtered map points and layers.
    
    DAHO receives district villages; VO receives assigned villages.
    Villages without verified coordinates appear in unmappedVillages.
    """
    service = MapService(db)
    return await service.get_map_layers(current_user, _extract_ip(request))


@router.get("/state/gujarat", summary="Official Gujarat State district boundaries GeoJSON enriched with live database properties")
async def get_gujarat_state_map(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Gujarat state district boundaries GeoJSON with live DAHO assignment status."""
    service = MapService(db)
    return await service.get_gujarat_state_geojson()


@router.get("/districts/{district_id}/talukas-geojson", summary="Taluka boundaries GeoJSON for a selected district")
async def get_district_talukas_geojson(
    district_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Taluka boundary polygons inside the specified District."""
    service = MapService(db)
    return await service.get_district_talukas_geojson(district_id)


@router.get("/talukas-geojson", summary="Taluka boundaries GeoJSON across Gujarat or filtered by district")
async def get_all_or_district_talukas_geojson(
    district_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Taluka boundary polygons statewide (or for a district if specified)."""
    service = MapService(db)
    return await service.get_district_talukas_geojson(district_id)


@router.get("/districts/{district_id}/villages-geojson", summary="Village boundaries GeoJSON for all villages in a district")
async def get_district_villages_geojson(
    district_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Village boundary polygons for all villages in the specified District."""
    service = MapService(db)
    return await service.get_district_villages_geojson(district_id)


@router.get("/talukas/{taluka_id}/villages-geojson", summary="Village boundaries GeoJSON for a selected taluka")
async def get_taluka_villages_geojson(
    taluka_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Village boundary polygons inside the specified Taluka."""
    service = MapService(db)
    return await service.get_taluka_villages_geojson(taluka_id)


@router.get("/villages-geojson", summary="Village boundaries GeoJSON filtered by taluka or district")
async def get_villages_geojson(
    taluka_id: Optional[uuid.UUID] = None,
    district_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """Fetch official Village boundary polygons by taluka or district."""
    service = MapService(db)
    if taluka_id:
        return await service.get_taluka_villages_geojson(taluka_id)
    elif district_id:
        return await service.get_district_villages_geojson(district_id)
    return {"type": "FeatureCollection", "features": []}


