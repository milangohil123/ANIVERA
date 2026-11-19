"""Comprehensive Authentication Security Test Suite.

Enforces:
1. Strict existing user lookup (No auto-provisioning).
2. Strict Argon2id password verification (No password hash overwrite).
3. Status verification (Only ACTIVE allowed; INACTIVE and LOCKED rejected).
4. Lockout policies on repeated failed attempts.
5. Farmer OTP validation without self-registration or auto-account creation.
6. Rate limiting on farmer OTP requests.
7. Anti-replay verification (consumed OTPs cannot be reused).
8. Token integrity (tampered, expired, or revoked tokens rejected).
9. Database integrity invariants (failed auth creates zero records and mutates zero hashes).
10. Strict test database isolation (strictly targets TEST_DATABASE_URL).
"""
import asyncio
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.models.geography import Village
from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
from app.modules.authentication.models import (
    Device,
    OtpChallenge,
    RefreshToken,
    User,
)
from app.modules.authentication.otp_provider import SimulatedOTPProvider
from app.modules.authentication.service import (
    AUTH_FAILURE_DETAIL,
    AuthService,
    _hash_token,
)
from app.modules.authentication.schemas import (
    FarmerOtpRequest,
    FarmerOtpVerifyRequest,
    RefreshTokenRequest,
    StaffLoginRequest,
)
from tests.conftest import create_test_user, DEFAULT_TEST_PASSWORD


async def _create_provisioned_farmer(db_session: AsyncSession, mobile: str) -> User:
    """Helper to create a fully valid and provisioned farmer in test db."""
    # 1. Staff user who registers and provisions
    staff = create_test_user(role="FIELD_WORKER", status="ACTIVE")
    db_session.add(staff)
    await db_session.flush()

    # 2. Get an existing village
    v_res = await db_session.execute(select(Village.id).limit(1))
    village_id = v_res.scalars().first()
    if not village_id:
        village_id = uuid.uuid4()

    # 3. Farmer User account
    user = create_test_user(
        role="FARMER",
        mobile_e164=mobile,
        status="ACTIVE"
    )
    db_session.add(user)
    await db_session.flush()

    # 4. Farmer profile record
    farmer = Farmer(
        id=uuid.uuid4(),
        farmer_code=f"FRM-TEST-{uuid.uuid4().hex[:6].upper()}",
        full_name="ટેસ્ટ ખેડૂત",
        name_norm="TEST KHEDUT",
        village_id=village_id,
        mobile_e164=mobile,
        mobile_status="VERIFIED_STAFF",
        mobile_shared=False,
        has_smartphone="YES",
        registration_status="DRAFT",
        registration_path="STAFF_ASSISTED",
        outreach_consent="UNKNOWN",
        active=True,
        row_version=1,
        created_by=staff.id,
    )
    db_session.add(farmer)
    await db_session.flush()

    # 5. Provisioning link
    prov = FarmerAccountProvisioning(
        user_id=user.id,
        farmer_id=farmer.id,
        provisioned_by=staff.id,
        activation_status="ACTIVE",
        activated_at=datetime.now(timezone.utc),
    )
    db_session.add(prov)
    await db_session.commit()
    return user


@pytest.mark.asyncio
async def test_01_existing_user_correct_password_success(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 1: Existing username + correct password succeeds and issues valid tokens."""
    username = f"staff_{uuid.uuid4().hex[:8]}"
    password = "CorrectStaffPassword@2026"
    user = create_test_user(
        role="FIELD_WORKER",
        username=username,
        password=password,
        status="ACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": password}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == username
    assert data["user"]["role"] == "FIELD_WORKER"


@pytest.mark.asyncio
async def test_02_random_username_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 2: Random username + any password must be rejected with 401."""
    random_user = f"nonexistent_{uuid.uuid4().hex}"
    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": random_user, "password": "AnyRandomPassword123!"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == AUTH_FAILURE_DETAIL


@pytest.mark.asyncio
async def test_03_existing_user_wrong_password_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 3: Existing username + wrong password must be rejected with 401."""
    username = f"vet_{uuid.uuid4().hex[:8]}"
    password = "CorrectVetPassword@2026"
    user = create_test_user(
        role="VET_OFFICER",
        username=username,
        password=password,
        status="ACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": "WrongPasswordEntered!"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == AUTH_FAILURE_DETAIL


@pytest.mark.asyncio
async def test_04_empty_username_rejected(
    async_client: AsyncClient
):
    """Test 4: Empty username must be rejected."""
    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": "", "password": "Password123!"}
    )
    assert res.status_code in (401, 422)


@pytest.mark.asyncio
async def test_05_empty_password_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 5: Empty password must be rejected."""
    username = f"admin_{uuid.uuid4().hex[:8]}"
    user = create_test_user(
        role="SYS_ADMIN",
        username=username,
        password="ValidPassword123!",
        status="ACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": ""}
    )
    assert res.status_code in (401, 422)


@pytest.mark.asyncio
async def test_06_unknown_username_must_not_create_user(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 6: Attempting login with unknown username must NEVER insert a user into DB."""
    ghost_user = f"ghost_{uuid.uuid4().hex}"
    
    # Pre-condition: User does not exist
    q_pre = select(User).where(User.username == ghost_user)
    res_pre = await db_session.execute(q_pre)
    assert res_pre.scalars().first() is None

    # Attempt login
    await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": ghost_user, "password": "Password123!"}
    )

    # Post-condition: User STILL does not exist
    q_post = select(User).where(User.username == ghost_user)
    res_post = await db_session.execute(q_post)
    assert res_post.scalars().first() is None


@pytest.mark.asyncio
async def test_07_failed_password_must_not_modify_password_hash(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 7: Failed password attempt must NEVER mutate or overwrite the stored password hash."""
    username = f"secure_daho_{uuid.uuid4().hex[:8]}"
    original_pass = "OriginalImmutablePassword@2026"
    user = create_test_user(
        role="DAHO",
        username=username,
        password=original_pass,
        status="ACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    # Capture original hash
    await db_session.refresh(user)
    initial_hash = user.password_hash
    assert initial_hash is not None

    # Submit wrong password
    attacker_password = "AttackerOverridingPassword999!"
    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": attacker_password}
    )
    assert res.status_code == 401

    # Verify stored hash is byte-for-byte identical
    await db_session.refresh(user)
    assert user.password_hash == initial_hash
    assert verify_password(original_pass, user.password_hash) is True
    assert verify_password(attacker_password, user.password_hash) is False


@pytest.mark.asyncio
async def test_08_random_username_never_receives_jwt(
    async_client: AsyncClient
):
    """Test 8: Unknown username must never receive JWT tokens."""
    for candidate in ["random123", "admin_fake", "vo_test", "daho_unregistered"]:
        res = await async_client.post(
            "/api/v1/auth/staff/login",
            json={"username": candidate, "password": "RandomPassword123!"}
        )
        assert res.status_code == 401
        data = res.json()
        assert "access_token" not in data
        assert "refresh_token" not in data


@pytest.mark.asyncio
async def test_09_inactive_account_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 9: Inactive account must be rejected."""
    username = f"inactive_{uuid.uuid4().hex[:8]}"
    password = "ValidPassword123!"
    user = create_test_user(
        role="FIELD_WORKER",
        username=username,
        password=password,
        status="INACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": password}
    )
    assert res.status_code == 403
    assert "inactive" in res.text.lower()


@pytest.mark.asyncio
async def test_10_locked_account_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 10: Temporarily locked account must be rejected with 403."""
    username = f"locked_{uuid.uuid4().hex[:8]}"
    password = "ValidPassword123!"
    lock_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    user = create_test_user(
        role="FIELD_WORKER",
        username=username,
        password=password,
        status="ACTIVE",
        failed_attempts=5,
        locked_until=lock_expiry
    )
    db_session.add(user)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/staff/login",
        json={"username": username, "password": password}
    )
    assert res.status_code == 403
    assert "locked" in res.text.lower()


@pytest.mark.asyncio
async def test_11_invalid_jwt_rejected(
    async_client: AsyncClient
):
    """Test 11: Invalid JWT format or corrupted token must be rejected."""
    res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer this.is.completely.bogus.jwt.token"}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_12_expired_jwt_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 12: Expired JWT access token must be rejected."""
    user = create_test_user(role="SYS_ADMIN", status="ACTIVE")
    db_session.add(user)
    await db_session.commit()

    expired_token = create_access_token(
        subject=str(user.id),
        claims={"role": user.role},
        expires_delta=timedelta(seconds=-10)  # Expired 10 seconds ago
    )

    res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_13_tampered_jwt_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 13: JWT with forged claims or tampered signature must be rejected."""
    user = create_test_user(role="FIELD_WORKER", status="ACTIVE")
    db_session.add(user)
    await db_session.commit()

    valid_token = create_access_token(
        subject=str(user.id),
        claims={"role": user.role},
        expires_delta=timedelta(minutes=15)
    )
    # Alter the last character of signature
    tampered_token = valid_token[:-2] + ("X" if valid_token[-1] != "X" else "Y") + valid_token[-1]

    res = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_14_revoked_refresh_token_rejected(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 14: Revoked refresh token must be rejected on rotation attempt."""
    user = create_test_user(role="DAHO", status="ACTIVE")
    db_session.add(user)
    await db_session.commit()

    raw_token = f"revoked_token_{uuid.uuid4().hex}"
    token_hash = _hash_token(raw_token)
    now = datetime.now(timezone.utc)
    refresh_record = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        issued_at=now - timedelta(hours=1),
        expires_at=now + timedelta(days=7),
        revoked_at=now - timedelta(minutes=10)  # Explicitly revoked
    )
    db_session.add(refresh_record)
    await db_session.commit()

    res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": raw_token}
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_15_unknown_farmer_number_no_account_creation(
    db_session: AsyncSession,
    async_client: AsyncClient
):
    """Test 16 & 31: Unknown mobile number must NOT create a farmer user or profile."""
    unregistered_mobile = "+919999988888"

    # Pre-condition: No user exists with this mobile
    q_pre = select(User).where(User.mobile_e164 == unregistered_mobile)
    res_pre = await db_session.execute(q_pre)
    assert res_pre.scalars().first() is None

    # Request OTP
    res = await async_client.post(
        "/api/v1/auth/farmer/request-otp",
        json={"mobile_e164": unregistered_mobile}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["debug_otp"] is None

    # Post-condition: User STILL does not exist
    q_post = select(User).where(User.mobile_e164 == unregistered_mobile)
    res_post = await db_session.execute(q_post)
    assert res_post.scalars().first() is None


@pytest.mark.asyncio
async def test_16_unknown_farmer_number_no_otp_login(
    async_client: AsyncClient
):
    """Test 17: Unknown farmer number cannot log in with arbitrary OTP."""
    res = await async_client.post(
        "/api/v1/auth/farmer/verify-otp",
        json={"mobile_e164": "+919999977777", "otp_code": "123456"}
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_17_provisioned_farmer_otp_flow(
    db_session: AsyncSession
):
    """Test 18: Registered & provisioned farmer completes configured OTP flow."""
    simulated_otp = SimulatedOTPProvider()
    service = AuthService(db_session, otp_provider=simulated_otp)

    mobile = f"+9198{uuid.uuid4().int % 100000000:08d}"
    user = await _create_provisioned_farmer(db_session, mobile)

    # Request OTP
    req = FarmerOtpRequest(mobile_e164=mobile)
    res_req = await service.request_farmer_otp(req)
    assert res_req.debug_otp is None

    dispatched_otp = simulated_otp.get_last_otp(mobile)
    assert dispatched_otp is not None
    assert len(dispatched_otp) == 6

    # Verify OTP
    verify_req = FarmerOtpVerifyRequest(mobile_e164=mobile, otp_code=dispatched_otp)
    token_res = await service.verify_farmer_otp(verify_req)
    assert token_res.access_token is not None
    assert token_res.user.role == "FARMER"


@pytest.mark.asyncio
async def test_18_wrong_otp_rejected(
    db_session: AsyncSession
):
    """Test 19: Incorrect OTP code must be rejected."""
    simulated_otp = SimulatedOTPProvider()
    service = AuthService(db_session, otp_provider=simulated_otp)

    mobile = f"+9198{uuid.uuid4().int % 100000000:08d}"
    user = await _create_provisioned_farmer(db_session, mobile)

    await service.request_farmer_otp(FarmerOtpRequest(mobile_e164=mobile))

    with pytest.raises(Exception) as exc_info:
        await service.verify_farmer_otp(
            FarmerOtpVerifyRequest(mobile_e164=mobile, otp_code="000000")
        )
    assert "400" in str(exc_info.value)


@pytest.mark.asyncio
async def test_19_reused_otp_rejected(
    db_session: AsyncSession
):
    """Test 21: Reusing an already consumed OTP must be rejected (Anti-replay)."""
    simulated_otp = SimulatedOTPProvider()
    service = AuthService(db_session, otp_provider=simulated_otp)

    mobile = f"+9198{uuid.uuid4().int % 100000000:08d}"
    user = await _create_provisioned_farmer(db_session, mobile)

    await service.request_farmer_otp(FarmerOtpRequest(mobile_e164=mobile))
    dispatched_otp = simulated_otp.get_last_otp(mobile)

    # First verification succeeds
    t1 = await service.verify_farmer_otp(
        FarmerOtpVerifyRequest(mobile_e164=mobile, otp_code=dispatched_otp)
    )
    assert t1.access_token is not None

    # Immediate second verification with same OTP must FAIL
    with pytest.raises(Exception) as exc_info:
        await service.verify_farmer_otp(
            FarmerOtpVerifyRequest(mobile_e164=mobile, otp_code=dispatched_otp)
        )
    assert "400" in str(exc_info.value)


@pytest.mark.asyncio
async def test_20_farmer_otp_rate_limiting(
    db_session: AsyncSession
):
    """Test 22: Farmer OTP request rate limiting enforces maximum 5 requests per window."""
    simulated_otp = SimulatedOTPProvider()
    service = AuthService(db_session, otp_provider=simulated_otp)

    mobile = f"+9198{uuid.uuid4().int % 100000000:08d}"
    user = await _create_provisioned_farmer(db_session, mobile)

    # Perform 5 requests (all should succeed)
    for _ in range(5):
        res = await service.request_farmer_otp(FarmerOtpRequest(mobile_e164=mobile))
        assert res.debug_otp is None

    # 6th request must trigger rate limit (429)
    with pytest.raises(Exception) as exc_info:
        await service.request_farmer_otp(FarmerOtpRequest(mobile_e164=mobile))
    assert "429" in str(exc_info.value)

