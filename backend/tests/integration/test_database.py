"""PostgreSQL database connectivity and health endpoint integration tests.

Verifies:
1. Successful database connection.
2. Failed database connection handling.
3. Session creation and cleanup.
4. Basic read-only query on reference tables.
5. Health endpoint database status (connected & disconnected).
"""
try:
    import pytest  # type: ignore
except ImportError:  # pragma: no cover
    class _MockPytestMark:
        def __getattr__(self, name):
            return lambda func: func

    class _MockPytest:
        mark = _MockPytestMark()

    pytest = _MockPytest()  # type: ignore

from httpx import AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.dependencies.db import get_db_session
from app.main import app
from app.models.geography import District
from app.models.reference import Species
from app.repositories.health import HealthRepository


@pytest.mark.asyncio
async def test_database_connection_success(db_session: AsyncSession):
    """Test 1: Verify direct SQL execution works against the PostgreSQL instance."""
    result = await db_session.execute(text("SELECT 1 AS alive"))
    assert result.scalar() == 1


@pytest.mark.asyncio
async def test_basic_readonly_query(db_session: AsyncSession):
    """Test 2: Perform read-only query on pre-existing reference tables without modifying data."""
    # Query species reference table
    stmt = select(Species)
    result = await db_session.execute(stmt)
    species_list = result.scalars().all()
    assert len(species_list) > 0
    codes = [s.code for s in species_list]
    assert "CATTLE" in codes

    # Query districts reference table
    stmt_dist = select(District)
    result_dist = await db_session.execute(stmt_dist)
    districts = result_dist.scalars().all()
    assert len(districts) > 0
    district_codes = [d.code for d in districts]
    assert "BOTAD" in district_codes


@pytest.mark.asyncio
async def test_session_creation_and_cleanup():
    """Test 3: Verify session lifecycle: active during context and closed on exit."""
    from app.db.session import get_db

    session_gen = get_db()
    session = await anext(session_gen)
    assert isinstance(session, AsyncSession)
    assert session.is_active

    # Execute a simple query
    res = await session.execute(text("SELECT 1"))
    assert res.scalar() == 1

    # Close the generator and ensure cleanup
    with pytest.raises(StopAsyncIteration):
        await anext(session_gen)


@pytest.mark.asyncio
async def test_failed_database_connection_handling():
    """Test 4: Verify that connection failures are caught cleanly without exposing secrets."""
    # Connect to an unreachable port to simulate network/database outage
    bad_engine = create_async_engine(
        "postgresql+asyncpg://invalid_user:invalid_pass@127.0.0.1:59999/pashurakshak_db",
        connect_args={"timeout": 1}
    )
    bad_session_factory = async_sessionmaker(bad_engine, class_=AsyncSession)
    
    async with bad_session_factory() as bad_session:
        repo = HealthRepository(bad_session)
        is_connected = await repo.ping()
        assert is_connected is False

    await bad_engine.dispose()


@pytest.mark.asyncio
async def test_health_endpoint_connected(async_client: AsyncClient):
    """Test 5: Verify GET /api/v1/health returns 200 with connected database."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_health_endpoint_disconnected_handling(async_client: AsyncClient):
    """Test 6: Verify GET /api/v1/health returns 503 when database is unavailable."""
    # Mock / override dependency to simulate a disconnected database session
    class MockDisconnectedSession:
        async def execute(self, *args, **kwargs):
            raise ConnectionError("Simulated database unreachable error")

    async def override_get_db_session():
        yield MockDisconnectedSession()

    app.dependency_overrides[get_db_session] = override_get_db_session

    try:
        response = await async_client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
    finally:
        # Reset dependency overrides
        app.dependency_overrides.clear()
