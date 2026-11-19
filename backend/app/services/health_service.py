"""Service layer for system and database health checks."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.health import HealthRepository
from app.schemas.health import HealthResponse


class HealthService:
    """Orchestrates health verification checks across components."""

    @staticmethod
    async def get_health_status(session: AsyncSession) -> HealthResponse:
        """Determines overall system and database health status."""
        health_repo = HealthRepository(session)
        is_db_connected = await health_repo.ping()

        if is_db_connected:
            return HealthResponse(
                status="healthy",
                database="connected"
            )
        else:
            return HealthResponse(
                status="unhealthy",
                database="disconnected"
            )

