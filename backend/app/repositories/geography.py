"""Repository for Geography entities (Districts, Talukas, Villages)."""
from typing import List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District, Taluka, Village
from app.repositories.base import BaseRepository


class GeographyRepository(BaseRepository[District]):
    """Data access repository for geographic reference data."""

    def __init__(self, session: AsyncSession):
        super().__init__(District, session)

    async def list_districts(self, active_only: bool = True) -> List[District]:
        """Fetch all districts."""
        stmt = select(District)
        if active_only:
            stmt = stmt.where(District.active.is_(True))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_district_by_code(self, code: str) -> Optional[District]:
        """Fetch district by unique code."""
        stmt = select(District).where(District.code == code)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_villages_by_district(self, district_id: uuid.UUID) -> List[Village]:
        """Fetch all villages belonging to a district."""
        stmt = select(Village).where(Village.district_id == district_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

