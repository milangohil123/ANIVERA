"""FastAPI endpoints for Geospatial and Map layers."""
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

