"""Integration tests for Authentication & Login workflows (FastAPI + PostgreSQL 16).

Covers all 11 required scenarios:
1. Valid staff login (returns JWT + refresh token).
2. Invalid staff password (returns 401, increments failed attempts).
3. Inactive/locked staff account (returns 403).
4. Valid provisioned farmer OTP flow (request -> simulated OTP -> verify -> tokens).
5. Invalid OTP code (returns 400).
6. Expired OTP challenge (returns 400).
7. OTP reuse prevention / replay protection (second verify attempt fails).
8. Unprovisioned farmer login rejection (neutral response, OTP suppressed).
9. Expired JWT access token (returns 401).
10. Invalid JWT access token (returns 401).
11. Logout & refresh token invalidation (refresh fails after logout).
"""
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import (
    FarmerAccountProvisioning,
    OtpChallenge,
    RefreshToken,
    User,
)
from app.modules.farmers.models import Farmer
from app.modules.authentication.otp_provider import SimulatedOTPProvider, get_otp_provider
from tests.conftest import create_test_user

try:
    import pytest  # type: ignore
except ImportError:  # pragma: no cover
    pytest = None

# Decorator fallback helper
if pytest is not None:
    pytest_async = pytest.mark.asyncio
else:
    def pytest_async(func):  # type: ignore
        return func


@pytest_async
async def test_01_valid_staff_login(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 1: Valid staff login returns JWT access token and refresh token."""
    username = f"vet_{uuid.uuid4().hex[:8]}"
    password = "CorrectHorseBatteryStaple123!"

    user = create_test_user(
        role="VET_OFFICER",
        full_name="Dr. Test Officer",
        username=username,
        password=password,
        status="ACTIVE",
        must_change_password=False,
        failed_attempts=0
    )
    db_session.add(user)
    await db_session.commit()

    try:
        response = await async_client.post(
            "/api/v1/auth/staff/login",
            json={
                "username": username,
                "password": password
            }
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == username
        assert data["user"]["role"] == "VET_OFFICER"
        assert "offline_valid_until" in data
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == user.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        await db_session.flush()
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_02_invalid_staff_password(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 2: Invalid password increments failed_attempts and returns 401."""
    username = f"worker_{uuid.uuid4().hex[:8]}"
    password = "CorrectPassword123!"

    user = create_test_user(
        role="FIELD_WORKER",
        full_name="Field Worker One",
        username=username,
        password=password,
        status="ACTIVE",
        must_change_password=False,
        failed_attempts=0
    )
    db_session.add(user)
    await db_session.commit()

    try:
        response = await async_client.post(
            "/api/v1/auth/staff/login",
            json={
                "username": username,
                "password": "WrongPassword!"
            }
        )
        assert response.status_code == 401
        assert "Invalid username or password" in response.text

        # Verify failed_attempts incremented in DB
        await db_session.refresh(user)
        assert user.failed_attempts == 1
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == user.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        await db_session.flush()
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_03_inactive_staff_account(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 3: Inactive staff account is rejected with 403."""
    username = f"inactive_{uuid.uuid4().hex[:8]}"
    password = "CorrectPassword123!"

    user = create_test_user(
        role="FIELD_WORKER",
        full_name="Deactivated Worker",
        username=username,
        password=password,
        status="INACTIVE",
        must_change_password=False,
        failed_attempts=0
    )
    db_session.add(user)
    await db_session.commit()

    try:
        response = await async_client.post(
            "/api/v1/auth/staff/login",
            json={
                "username": username,
                "password": password
            }
        )
        assert response.status_code == 403
        assert "inactive" in response.text.lower()
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == user.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        await db_session.flush()
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_04_valid_provisioned_farmer_otp_flow(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 4: Full OTP login flow for pre-provisioned farmer."""
    mobile = f"+91{uuid.uuid4().int % 9000000000 + 1000000000}"

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(vil)
    await db_session.flush()

    provisioner = create_test_user(
        role="FIELD_WORKER",
        full_name="Staff Provisioner",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(provisioner)
    await db_session.flush()

    farmer_entity = Farmer(
        id=uuid.uuid4(),
        full_name="Patel Rameshbhai",
        name_norm="PATEL RAMESHBHAI",
        village_id=vil.id,
        mobile_e164=mobile,
        registration_path="STAFF_ASSISTED",
        created_by=provisioner.id,
    )
    db_session.add(farmer_entity)
    await db_session.flush()

    farmer_user = create_test_user(
        role="FARMER",
        full_name="Patel Rameshbhai",
        mobile_e164=mobile,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(farmer_user)
    await db_session.flush()

    provisioning = FarmerAccountProvisioning(
        user_id=farmer_user.id,
        farmer_id=farmer_entity.id,
        provisioned_by=provisioner.id,
        activation_status="ACTIVE",
        activated_at=datetime.now(timezone.utc)
    )
    db_session.add(provisioning)
    await db_session.commit()

    otp_provider = get_otp_provider()
    if isinstance(otp_provider, SimulatedOTPProvider):
        otp_provider.clear()

    try:
        # Step A: Request OTP
        req_res = await async_client.post(
            "/api/v1/auth/farmer/request-otp",
            json={"mobile_e164": mobile}
        )
        assert req_res.status_code == 200
        assert "If this mobile number is registered" in req_res.json()["message"]

        # Step B: Retrieve simulated OTP from buffer
        assert isinstance(otp_provider, SimulatedOTPProvider)
        sent_code = otp_provider.get_last_otp(mobile)
        assert sent_code is not None
        assert len(sent_code) == 6

        # Step C: Verify OTP
        verify_res = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={
                "mobile_e164": mobile,
                "otp_code": sent_code
            }
        )
        assert verify_res.status_code == 200, verify_res.text
        data = verify_res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["mobile_e164"] == mobile
        assert data["user"]["role"] == "FARMER"
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == farmer_user.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == farmer_user.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        otp_stmt = select(OtpChallenge).where(OtpChallenge.mobile_e164 == mobile)
        for oc in (await db_session.execute(otp_stmt)).scalars().all():
            await db_session.delete(oc)
        await db_session.delete(provisioning)
        await db_session.flush()
        await db_session.delete(farmer_entity)
        await db_session.flush()
        await db_session.delete(farmer_user)
        await db_session.delete(provisioner)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_05_invalid_otp_code(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 5: Providing an incorrect OTP code fails with 400."""
    mobile = f"+91{uuid.uuid4().int % 9000000000 + 1000000000}"

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(vil)
    await db_session.flush()

    provisioner = create_test_user(
        role="FIELD_WORKER",
        full_name="Provisioner Test",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(provisioner)
    await db_session.flush()

    farmer_entity = Farmer(
        id=uuid.uuid4(),
        full_name="Farmer OTP Test",
        name_norm="FARMER OTP TEST",
        village_id=vil.id,
        mobile_e164=mobile,
        registration_path="STAFF_ASSISTED",
        created_by=provisioner.id,
    )
    db_session.add(farmer_entity)
    await db_session.flush()

    farmer = create_test_user(
        role="FARMER",
        full_name="Farmer OTP Test",
        mobile_e164=mobile,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(farmer)
    await db_session.flush()

    prov = FarmerAccountProvisioning(
        user_id=farmer.id,
        farmer_id=farmer_entity.id,
        provisioned_by=provisioner.id,
        activation_status="ACTIVE",
        activated_at=datetime.now(timezone.utc)
    )
    db_session.add(prov)
    await db_session.commit()

    try:
        # Request OTP
        await async_client.post("/api/v1/auth/farmer/request-otp", json={"mobile_e164": mobile})

        # Submit wrong OTP
        res = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={"mobile_e164": mobile, "otp_code": "000000"}
        )
        assert res.status_code == 400
        assert "Invalid OTP code" in res.text
    finally:
        otp_stmt = select(OtpChallenge).where(OtpChallenge.mobile_e164 == mobile)
        for oc in (await db_session.execute(otp_stmt)).scalars().all():
            await db_session.delete(oc)
        await db_session.delete(prov)
        await db_session.flush()
        await db_session.delete(farmer_entity)
        await db_session.flush()
        await db_session.delete(farmer)
        await db_session.delete(provisioner)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_06_expired_otp_challenge(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 6: Expired OTP challenge is rejected with 400."""
    mobile = f"+91{uuid.uuid4().int % 9000000000 + 1000000000}"

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(vil)
    await db_session.flush()

    provisioner = create_test_user(
        role="FIELD_WORKER",
        full_name="Provisioner Expired",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(provisioner)
    await db_session.flush()

    farmer_entity = Farmer(
        id=uuid.uuid4(),
        full_name="Farmer Expired",
        name_norm="FARMER EXPIRED",
        village_id=vil.id,
        mobile_e164=mobile,
        registration_path="STAFF_ASSISTED",
        created_by=provisioner.id,
    )
    db_session.add(farmer_entity)
    await db_session.flush()

    farmer = create_test_user(
        role="FARMER",
        full_name="Farmer Expired",
        mobile_e164=mobile,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(farmer)
    await db_session.flush()

    prov = FarmerAccountProvisioning(
        user_id=farmer.id,
        farmer_id=farmer_entity.id,
        provisioned_by=provisioner.id,
        activation_status="ACTIVE",
        activated_at=datetime.now(timezone.utc)
    )
    db_session.add(prov)

    # Insert already-expired OTP challenge
    past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    expired_challenge = OtpChallenge(
        id=uuid.uuid4(),
        mobile_e164=mobile,
        code_hash="dummy_expired_hash",
        expires_at=past_time,
        attempts=0,
        consumed_at=None
    )
    db_session.add(expired_challenge)
    await db_session.commit()

    try:
        res = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={"mobile_e164": mobile, "otp_code": "123456"}
        )
        assert res.status_code == 400
        assert "expired" in res.text.lower()
    finally:
        await db_session.delete(expired_challenge)
        otp_stmt = select(OtpChallenge).where(OtpChallenge.mobile_e164 == mobile)
        for oc in (await db_session.execute(otp_stmt)).scalars().all():
            await db_session.delete(oc)
        await db_session.delete(prov)
        await db_session.flush()
        await db_session.delete(farmer_entity)
        await db_session.flush()
        await db_session.delete(farmer)
        await db_session.delete(provisioner)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_07_otp_reuse_prevention(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 7: Consumed OTP cannot be reused in replay attacks."""
    mobile = f"+91{uuid.uuid4().int % 9000000000 + 1000000000}"

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(vil)
    await db_session.flush()

    provisioner = create_test_user(
        role="FIELD_WORKER",
        full_name="Provisioner Replay",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(provisioner)
    await db_session.flush()

    farmer_entity = Farmer(
        id=uuid.uuid4(),
        full_name="Farmer Replay Test",
        name_norm="FARMER REPLAY TEST",
        village_id=vil.id,
        mobile_e164=mobile,
        registration_path="STAFF_ASSISTED",
        created_by=provisioner.id,
    )
    db_session.add(farmer_entity)
    await db_session.flush()

    farmer = create_test_user(
        role="FARMER",
        full_name="Farmer Replay Test",
        mobile_e164=mobile,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(farmer)
    await db_session.flush()

    prov = FarmerAccountProvisioning(
        user_id=farmer.id,
        farmer_id=farmer_entity.id,
        provisioned_by=provisioner.id,
        activation_status="ACTIVE",
        activated_at=datetime.now(timezone.utc)
    )
    db_session.add(prov)
    await db_session.commit()

    try:
        # Request OTP
        await async_client.post("/api/v1/auth/farmer/request-otp", json={"mobile_e164": mobile})
        otp_provider = get_otp_provider()
        assert isinstance(otp_provider, SimulatedOTPProvider)
        code = otp_provider.get_last_otp(mobile)
        assert code is not None

        # First verification succeeds
        res1 = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={"mobile_e164": mobile, "otp_code": code}
        )
        assert res1.status_code == 200

        # Second verification with exact same code must fail
        res2 = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={"mobile_e164": mobile, "otp_code": code}
        )
        assert res2.status_code == 400
        assert "expired or is invalid" in res2.text.lower()
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == farmer.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == farmer.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        otp_stmt = select(OtpChallenge).where(OtpChallenge.mobile_e164 == mobile)
        for oc in (await db_session.execute(otp_stmt)).scalars().all():
            await db_session.delete(oc)
        await db_session.delete(prov)
        await db_session.flush()
        await db_session.delete(farmer_entity)
        await db_session.flush()
        await db_session.delete(farmer)
        await db_session.delete(provisioner)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_08_unprovisioned_farmer_login_rejected(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 8: Unprovisioned farmer gets neutral response; OTP is suppressed."""
    mobile = f"+91{uuid.uuid4().int % 9000000000 + 1000000000}"
    farmer = create_test_user(
        role="FARMER",
        full_name="Unprovisioned Farmer",
        mobile_e164=mobile,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(farmer)
    await db_session.commit()

    otp_provider = get_otp_provider()
    if isinstance(otp_provider, SimulatedOTPProvider):
        otp_provider.clear()

    try:
        # Request OTP returns neutral 200 message
        req_res = await async_client.post(
            "/api/v1/auth/farmer/request-otp",
            json={"mobile_e164": mobile}
        )
        assert req_res.status_code == 200
        assert "If this mobile number is registered" in req_res.json()["message"]

        # No OTP was dispatched
        assert isinstance(otp_provider, SimulatedOTPProvider)
        assert otp_provider.get_last_otp(mobile) is None

        # Direct verify attempt fails with 403 (not provisioned)
        verify_res = await async_client.post(
            "/api/v1/auth/farmer/verify-otp",
            json={"mobile_e164": mobile, "otp_code": "123456"}
        )
        assert verify_res.status_code == 403
        assert "provisioned" in verify_res.text.lower()
    finally:
        await db_session.delete(farmer)
        await db_session.commit()


@pytest_async
async def test_09_expired_jwt_access_token(async_client: AsyncClient) -> None:
    """Test 9: Expired JWT access token returns 401."""
    expired_token = create_access_token(
        subject=str(uuid.uuid4()),
        claims={"role": "FIELD_WORKER"},
        expires_delta=timedelta(seconds=-10)
    )

    res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert res.status_code == 401
    assert "expired" in res.text.lower()


@pytest_async
async def test_10_invalid_jwt_access_token(async_client: AsyncClient) -> None:
    """Test 10: Malformed or forged JWT access token returns 401."""
    res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not.a.valid.jwt.token"}
    )
    assert res.status_code == 401
    assert "credentials" in res.text.lower()


@pytest_async
async def test_11_logout_and_token_invalidation(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 11: Refresh token rotation, logout, and subsequent refresh rejection."""
    username = f"daho_{uuid.uuid4().hex[:8]}"
    password = "SecurePassword123!"

    user = create_test_user(
        role="DAHO",
        full_name="Dr. District Officer",
        username=username,
        password=password,
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(user)
    await db_session.commit()

    try:
        # Step A: Staff login
        login_res = await async_client.post(
            "/api/v1/auth/staff/login",
            json={"username": username, "password": password}
        )
        assert login_res.status_code == 200
        refresh_token_1 = login_res.json()["refresh_token"]

        # Step B: Refresh token rotation
        refresh_res = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token_1}
        )
        assert refresh_res.status_code == 200
        refresh_token_2 = refresh_res.json()["refresh_token"]

        # The old refresh token 1 is now revoked and cannot be reused
        reuse_res = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token_1}
        )
        assert reuse_res.status_code == 401

        # Step C: Logout with active refresh token 2
        logout_res = await async_client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token_2}
        )
        assert logout_res.status_code == 200

        # Step D: Refreshing with refresh token 2 after logout fails
        post_logout_refresh = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token_2}
        )
        assert post_logout_refresh.status_code == 401
    finally:
        await db_session.execute(
            update(RefreshToken).where(RefreshToken.user_id == user.id).values(rotated_from=None)
        )
        await db_session.flush()
        rt_stmt = select(RefreshToken).where(RefreshToken.user_id == user.id)
        for rt in (await db_session.execute(rt_stmt)).scalars().all():
            await db_session.delete(rt)
        await db_session.flush()
        await db_session.delete(user)
        await db_session.commit()

