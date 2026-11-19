"""Pytest fixtures and test helpers for backend integration testing."""
import asyncio
import os
import urllib.parse
import uuid
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory, get_db
from app.dependencies.db import get_db_session
from app.main import app
from app.modules.authentication.models import User

try:
    import pytest  # type: ignore
except ImportError:  # pragma: no cover
    pytest = None

try:
    import pytest_asyncio  # type: ignore
except ImportError:  # pragma: no cover
    pytest_asyncio = None

if pytest is not None:
    session_fixture = pytest.fixture(scope="session")
else:
    def session_fixture(func):  # type: ignore
        return func

if pytest_asyncio is not None:
    async_fixture = pytest_asyncio.fixture
elif pytest is not None:
    async_fixture = pytest.fixture
else:
    def async_fixture(func):  # type: ignore
        return func


_test_engine: Optional[AsyncEngine] = None
_test_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def _verify_test_db_isolation() -> str:
    """Verify that integration tests run against an isolated test database.
    
    Refuses to execute if:
    - TEST_DATABASE_URL environment variable is unset or empty.
    - TEST_DATABASE_URL points to the development/production 'pashurakshak_db'.
    - TEST_DATABASE_URL resolves to the same database as DATABASE_URL.
    """
    test_db_url = os.getenv("TEST_DATABASE_URL")
    if not test_db_url or not test_db_url.strip():
        raise RuntimeError(
            "CRITICAL DATABASE ISOLATION ERROR: TEST_DATABASE_URL environment variable is mandatory "
            "for running integration tests. Refusing to run tests against primary or unverified database. "
            "Set TEST_DATABASE_URL=postgresql+asyncpg://user:pass@host:port/pashurakshak_test_db"
        )

    test_db_url = test_db_url.strip()
    if test_db_url.startswith("postgresql://"):
        test_db_url = test_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif test_db_url.startswith("postgres://"):
        test_db_url = test_db_url.replace("postgres://", "postgresql+asyncpg://", 1)

    # Parse and compare
    test_parsed = urllib.parse.urlparse(test_db_url.replace("postgresql+asyncpg://", "http://"))
    main_url = settings.DATABASE_URL
    main_parsed = urllib.parse.urlparse(main_url.replace("postgresql+asyncpg://", "http://"))

    test_dbname = test_parsed.path.strip("/")
    main_dbname = main_parsed.path.strip("/")

    if test_dbname.lower() == "pashurakshak_db":
        raise RuntimeError(
            "CRITICAL DATABASE ISOLATION ERROR: TEST_DATABASE_URL points to 'pashurakshak_db'. "
            "Tests must be executed against a dedicated, isolated test database "
            "(e.g., 'pashurakshak_test_db'), never the development or production database."
        )

    if (test_parsed.hostname == main_parsed.hostname and
        test_parsed.port == main_parsed.port and
        test_dbname == main_dbname):
        raise RuntimeError(
            f"CRITICAL DATABASE ISOLATION ERROR: TEST_DATABASE_URL resolves to the same database "
            f"as DATABASE_URL ('{main_dbname}'). Database isolation violation detected. Aborting."
        )

    return test_db_url


def get_test_session_factory() -> async_sessionmaker[AsyncSession]:
    """Lazy initializer for isolated test database engine and session factory."""
    global _test_engine, _test_session_factory
    if _test_session_factory is None:
        test_url = _verify_test_db_isolation()
        _test_engine = create_async_engine(
            test_url,
            echo=False,
            pool_pre_ping=True
        )
        _test_session_factory = async_sessionmaker(
            bind=_test_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
    return _test_session_factory


DEFAULT_TEST_PASSWORD = "PashuRakshakTestPass123!"
_cached_default_hash: Optional[str] = None


def _get_default_hash() -> str:
    global _cached_default_hash
    if _cached_default_hash is None:
        _cached_default_hash = get_password_hash(DEFAULT_TEST_PASSWORD)
    return _cached_default_hash


def create_test_user(
    *,
    id: Optional[uuid.UUID] = None,
    role: str = "SYS_ADMIN",
    full_name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    password_hash: Optional[str] = None,
    mobile_e164: Optional[str] = None,
    status: str = "ACTIVE",
    must_change_password: bool = False,
    failed_attempts: int = 0,
    locked_until: Optional[datetime] = None,
    designation: Optional[str] = None,
    organisation: Optional[str] = None,
    created_by: Optional[uuid.UUID] = None,
    deactivated_at: Optional[datetime] = None,
    deactivated_reason: Optional[str] = None,
    **kwargs
) -> User:
    """Create a User instance satisfying database check constraints.

    Enforces:
    - Non-FARMER roles require unique username and valid Argon2id password_hash.
    - FARMER role requires valid E.164 mobile number without staff credentials.
    - INACTIVE status requires deactivated_at timestamp.
    """
    user_id = id or uuid.uuid4()
    if role == "FARMER":
        if not mobile_e164:
            mobile_e164 = f"+9198{user_id.int % 100000000:08d}"
    else:
        if not username:
            username = f"{role.lower()}_{user_id.hex[:8]}"
        if not password_hash:
            if password is not None:
                password_hash = get_password_hash(password)
            else:
                password_hash = _get_default_hash()

    if status == "INACTIVE" and deactivated_at is None:
        deactivated_at = datetime.now(timezone.utc)
        deactivated_reason = deactivated_reason or "Deactivated for test"

    return User(
        id=user_id,
        role=role,
        full_name=full_name or f"Test {role.replace('_', ' ').title()}",
        username=username,
        password_hash=password_hash,
        mobile_e164=mobile_e164,
        designation=designation,
        organisation=organisation,
        status=status,
        must_change_password=must_change_password,
        failed_attempts=failed_attempts,
        locked_until=locked_until,
        deactivated_at=deactivated_at,
        deactivated_reason=deactivated_reason,
        created_by=created_by,
        **kwargs
    )


@session_fixture
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    global _test_engine
    if _test_engine is not None:
        loop.run_until_complete(_test_engine.dispose())
    loop.close()


@async_fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yields an isolated database session connected strictly to TEST_DATABASE_URL."""
    factory = get_test_session_factory()
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()


@async_fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Yields an HTTP client connected to the FastAPI application with isolated db session override."""
    factory = get_test_session_factory()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_db_session] = _override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_db_session, None)
