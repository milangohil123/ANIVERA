"""Repository for database health and connectivity verification."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger


class HealthRepository:
    """Performs raw and safe ping verification against the database."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def ping(self) -> bool:
        """Executes a simple SELECT 1 query to confirm connectivity.
        
        Returns:
            bool: True if connection is alive and responding, False otherwise.
        """
        try:
            result = await self.session.execute(text("SELECT 1"))
            scalar = result.scalar()
            return scalar == 1
        except Exception as ex:
            # Explicitly log error type without exposing connection strings or passwords
            logger.warning("Database ping failed: %s", type(ex).__name__)
            return False

