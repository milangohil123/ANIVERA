"""Database session dependencies for FastAPI route handlers."""
from typing import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI route dependency that yields a managed AsyncSession."""
    async for session in get_db():
        yield session

