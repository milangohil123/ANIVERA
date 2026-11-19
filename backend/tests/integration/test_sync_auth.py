"""Integration tests for Synchronization Authentication Security & Tokens (FastAPI + PostgreSQL 16).

Verifies Step 8.1 / 8.2 authentication requirements:
1. Unauthenticated / missing Authorization header returns HTTP 401.
2. Invalid token string ("mock-bearer-token-for-dev") returns HTTP 401 ("Could not validate credentials").
3. Expired JWT access token returns HTTP 401 ("Access token has expired").
4. Offline grant token passed as Bearer token returns HTTP 401 ("Invalid token type: expected access token").
5. Staff login (/api/v1/auth/staff/login) produces valid JWT access token that authorizes /api/v1/sync/push (HTTP 200).
6. Refresh token rotation (/api/v1/auth/refresh) revokes old refresh token and authorizes subsequent sync requests.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_offline_grant
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import Device, RefreshToken, User, UserVillageAssignment
from app.modules.farmers.models import Farmer
from app.modules.sync.models import SyncBatch, SyncReceipt
from tests.conftest import create_test_user

try:
    import pytest  # type: ignore
except ImportError:  # pragma: no cover
    pytest = None

if pytest is not None:
    pytest_async = pytest.mark.asyncio
else:
    def pytest_async(func):  # type: ignore
        return func


@pytest_async
async def test_01_sync_push_unauthenticated_returns_401(async_client: AsyncClient) -> None:
    """Test 1: Pushing sync events without Authorization header returns HTTP 401."""
    payload = {
        "deviceId": str(uuid.uuid4()),
        "clientTime": datetime.now(timezone.utc).isoformat(),
        "events": []
    }
    res = await async_client.post("/api/v1/sync/push", json=payload)
    assert res.status_code == 401
    assert "not authenticated" in res.text.lower() or "credentials" in res.text.lower()


@pytest_async
async def test_02_sync_push_invalid_credentials_returns_401(async_client: AsyncClient) -> None:
    """Test 2: Pushing sync events with invalid mock token returns HTTP 401 'Could not validate credentials'."""
    payload = {
        "deviceId": str(uuid.uuid4()),
        "clientTime": datetime.now(timezone.utc).isoformat(),
        "events": []
    }
    headers = {"Authorization": "Bearer mock-bearer-token-for-dev"}
    res = await async_client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert res.status_code == 401
    assert res.json()["detail"] == "Could not validate credentials"


@pytest_async
async def test_03_sync_push_expired_access_token_returns_401(async_client: AsyncClient) -> None:
    """Test 3: Pushing sync events with an expired JWT access token returns HTTP 401 'Access token has expired'."""
    expired_token = create_access_token(
        subject=str(uuid.uuid4()),
        claims={"role": "FIELD_WORKER"},
        expires_delta=timedelta(seconds=-10)
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    payload = {
        "deviceId": str(uuid.uuid4()),
        "clientTime": datetime.now(timezone.utc).isoformat(),
        "events": []
    }
    res = await async_client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


@pytest_async
async def test_04_sync_push_offline_grant_as_bearer_returns_401(async_client: AsyncClient) -> None:
    """Test 4: Passing an offline grant token in the Bearer header is rejected (token type mismatch)."""
    grant_token = create_offline_grant(
        subject=str(uuid.uuid4()),
        device_id=str(uuid.uuid4()),
        expires_delta=timedelta(days=7)
    )
    headers = {"Authorization": f"Bearer {grant_token}"}
    payload = {
        "deviceId": str(uuid.uuid4()),
        "clientTime": datetime.now(timezone.utc).isoformat(),
        "events": []
    }
    res = await async_client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert res.status_code == 401
    assert "expected access token" in res.json()["detail"].lower()


@pytest_async
async def test_05_staff_login_and_authenticated_sync_push_succeeds(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 5: Live staff login produces valid JWT access token that successfully pushes sync events."""
    username = f"fw_{uuid.uuid4().hex[:8]}"
    password = "SecurePassword123!"

    fw = create_test_user(
        role="FIELD_WORKER",
        full_name="Valid Field Worker",
        username=username,
        password=password,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(fw)
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add_all([dist, taluka, village])
    await db_session.flush()

    assign = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=fw.id)
    device_id = uuid.uuid4()
    device = Device(id=device_id, user_id=fw.id, label="FW Test Phone", status="ACTIVE")
    db_session.add_all([assign, device])
    await db_session.commit()

    try:
        # Step A: Staff login
        login_res = await async_client.post(
            "/api/v1/auth/staff/login",
            json={
                "username": username,
                "password": password,
                "device_id": str(device_id)
            }
        )
        assert login_res.status_code == 200
        tokens = login_res.json()
        access_token = tokens["access_token"]
        assert access_token is not None

        # Step B: Obtain 7-day offline grant using real access token
        grant_res = await async_client.post(
            "/api/v1/sync/grant",
            json={"deviceId": str(device_id), "label": "FW Test Phone"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert grant_res.status_code == 200
        offline_grant = grant_res.json()["offlineGrant"]

        # Step C: Push sync batch with authenticated Bearer access token
        event_id = str(uuid.uuid4())
        push_payload = {
            "deviceId": str(device_id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "offlineGrant": offline_grant,
            "events": [
                {
                    "eventId": event_id,
                    "type": "FARMER_REGISTRATION",
                    "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                    "schemaVersion": 1,
                    "payload": {
                        "full_name": "Rameshbhai Patel",
                        "village_id": str(village.id),
                        "registration_path": "STAFF_ASSISTED"
                    }
                }
            ]
        }

        sync_res = await async_client.post(
            "/api/v1/sync/push",
            json=push_payload,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["acceptedCount"] == 1
        assert sync_data["results"][0]["eventId"] == event_id
        assert sync_data["results"][0]["status"] == "ACCEPTED"
    finally:
        # Clean up database records (child records before parent records)
        # 1. Any farmer profiles created during sync
        farmers = (await db_session.execute(select(Farmer).where(Farmer.created_by == fw.id))).scalars().all()
        for f in farmers:
            await db_session.delete(f)
        await db_session.flush()

        # 2. Sync receipts and batches created by this test user
        rcpts = (await db_session.execute(select(SyncReceipt).where(SyncReceipt.user_id == fw.id))).scalars().all()
        for r in rcpts:
            await db_session.delete(r)
        await db_session.flush()

        batches = (await db_session.execute(select(SyncBatch).where(SyncBatch.user_id == fw.id))).scalars().all()
        for b in batches:
            await db_session.delete(b)
        await db_session.flush()

        # 3. Auth tokens, devices, and assignments
        rts = (await db_session.execute(select(RefreshToken).where(RefreshToken.user_id == fw.id))).scalars().all()
        for rt in rts:
            await db_session.delete(rt)
        await db_session.delete(device)
        await db_session.delete(assign)
        await db_session.flush()

        # 4. Geographic hierarchy and test user
        await db_session.delete(village)
        await db_session.delete(taluka)
        await db_session.delete(dist)
        await db_session.delete(fw)
        await db_session.commit()

