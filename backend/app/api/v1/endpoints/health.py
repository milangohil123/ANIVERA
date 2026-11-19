"""Health and database readiness check endpoint."""
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.db import get_db_session
from app.schemas.health import HealthResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check & Database Connectivity",
    description="Reports application runtime status and PostgreSQL connectivity status separately.",
    responses={
        200: {
            "description": "Application and database are healthy and responding.",
            "content": {
                "application/json": {
                    "example": {"status": "healthy", "database": "connected"}
                }
            },
        },
        503: {
            "description": "Database connectivity failure or degraded service.",
            "content": {
                "application/json": {
                    "example": {"status": "unhealthy", "database": "disconnected"}
                }
            },
        },
    },
)
async def check_health(
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> HealthResponse:
    """Verifies service operational health and database connectivity."""
    health_status = await HealthService.get_health_status(session)
    
    if health_status.database != "connected":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health_status

