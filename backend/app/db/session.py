"""Database session management with SQLAlchemy 2.0 and asyncpg."""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from app.core.logging import logger

# Initialize async engine with connection pooling parameters
async_engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
)

# Async session factory
async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields a managed async database session per request.
    
    Guarantees session cleanup upon completion or failure.
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception as ex:
            await session.rollback()
            logger.error("Database session transaction rolled back due to error: %s", type(ex).__name__)
            raise
        finally:
            await session.close()


async def close_db_connection() -> None:
    """Safely disposes all active connections in the connection pool upon application shutdown."""
    if async_engine is not None:
        logger.info("Disposing PostgreSQL async connection pool...")
        await async_engine.dispose()
        logger.info("PostgreSQL connection pool disposed cleanly.")
