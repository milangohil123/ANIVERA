"""Integration tests for Role-Based Access Control and Geographic Scope Enforcement.

Covers all required security testing scenarios:
1. Valid permission (HTTP 200).
2. Missing permission (HTTP 403 + audit event).
3. Cross-district access (DAHO accessing unassigned district returns 403).
4. Cross-village access (FW/VO accessing unassigned village returns 403).
5. Farmer accessing another farmer's records (returns 403).
6. SYS_ADMIN operational permission restrictions (denied operational district/village scope).
7. Individual permission grant and revocation lifecycle (unpermitted -> granted -> revoked).
8. Inactive account access rejection (HTTP 403).
9. Expired or invalid JWT rejection (HTTP 401).
10. VO fallback registration prerequisites (requires formal FW unavailability & reason).
11. Vaccinator clinical credential authorization.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import (
    AuditEvent,
    DahoDistrictAssignment,
    User,
    UserPermissionGrant,
    UserVillageAssignment,
)
from app.modules.authorization.models import (
    FarmerUserLink,
    FieldWorkerAvailabilityRecord,
    VaccinatorAuthorization,
)
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


def _bearer_headers(user_id: uuid.UUID, role: str, expires_delta: Optional[timedelta] = None) -> dict:
    """Generate Authorization header with signed JWT token."""
    token = create_access_token(
        subject=str(user_id),
        claims={"role": role},
        expires_delta=expires_delta
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_async
async def test_01_valid_permission(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 1: User with canonical permission succeeds (HTTP 200)."""
    user = create_test_user(
        role="DAHO",
        full_name="DAHO Test User",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(user)
    await db_session.commit()

    try:
        # DAHO holds campaign.manage by default seed
        headers = _bearer_headers(user.id, user.role)
        res = await async_client.get(
            "/api/v1/rbac/test-permission/campaign.manage",
            headers=headers
        )
        assert res.status_code == 200, res.text
        assert res.json() == {"status": "authorized", "permission": "campaign.manage"}
    finally:
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_02_missing_permission(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 2: User lacking permission is denied with HTTP 403 and audited."""
    user = create_test_user(
        role="FIELD_WORKER",
        full_name="FW Missing Perm",
        status="ACTIVE",
        must_change_password=False
    )
    db_session.add(user)
    await db_session.commit()

    try:
        # FIELD_WORKER does not hold campaign.manage
        headers = _bearer_headers(user.id, user.role)
        res = await async_client.get(
            "/api/v1/rbac/test-permission/campaign.manage",
            headers=headers
        )
        assert res.status_code == 403
        assert "Permission denied: missing required permission 'campaign.manage'" in res.text

        # Verify audit log was recorded
        audit_stmt = (
            select(AuditEvent)
            .where(
                AuditEvent.actor_user_id == user.id,
                AuditEvent.action == "PERMISSION_CHECK",
                AuditEvent.result == "DENIED"
            )
        )
        audit_res = await db_session.execute(audit_stmt)
        event = audit_res.scalars().first()
        assert event is not None
        assert "campaign.manage" in (event.reason or "")
    finally:
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_03_cross_district_access(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 3: DAHO cross-district access is rejected with HTTP 403."""
    admin = create_test_user(
        role="SYS_ADMIN",
        full_name="Admin Setup",
        status="ACTIVE"
    )
    daho = create_test_user(
        role="DAHO",
        full_name="Dr. Botad DAHO",
        status="ACTIVE"
    )
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist_a = District(id=uuid.uuid4(), code=f"DST_A_{uuid.uuid4().hex[:6]}", name_gu="જિલ્લો એ", name_en="District A")
    dist_b = District(id=uuid.uuid4(), code=f"DST_B_{uuid.uuid4().hex[:6]}", name_gu="જિલ્લો બી", name_en="District B")
    db_session.add_all([dist_a, dist_b])
    await db_session.flush()

    # Assign DAHO only to District A
    assignment = DahoDistrictAssignment(
        daho_user_id=daho.id,
        district_id=dist_a.id,
        assigned_by=admin.id
    )
    db_session.add(assignment)
    await db_session.commit()

    try:
        headers = _bearer_headers(daho.id, daho.role)

        # Accessing assigned District A succeeds
        res_a = await async_client.get(f"/api/v1/rbac/test-district/{dist_a.id}", headers=headers)
        assert res_a.status_code == 200

        # Accessing unassigned District B must fail with 403
        res_b = await async_client.get(f"/api/v1/rbac/test-district/{dist_b.id}", headers=headers)
        assert res_b.status_code == 403
        assert "not assigned to this district" in res_b.text
    finally:
        await db_session.delete(assignment)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.delete(dist_a)
        await db_session.delete(dist_b)
        await db_session.commit()


@pytest_async
async def test_04_cross_village_access(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 4: Field Worker cross-village access is rejected with HTTP 403."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Assign", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW Village Test", status="ACTIVE")
    db_session.add_all([admin, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    v1 = Village(id=uuid.uuid4(), taluka_id=taluka.id, district_id=dist.id, code=f"V1_{uuid.uuid4().hex[:6]}", name_gu="ગામ ૧", name_en="Village 1")
    v2 = Village(id=uuid.uuid4(), taluka_id=taluka.id, district_id=dist.id, code=f"V2_{uuid.uuid4().hex[:6]}", name_gu="ગામ ૨", name_en="Village 2")
    db_session.add_all([v1, v2])
    await db_session.flush()

    # Assign FW only to Village 1
    assignment = UserVillageAssignment(user_id=fw.id, village_id=v1.id, assigned_by=admin.id)
    db_session.add(assignment)
    await db_session.commit()

    try:
        headers = _bearer_headers(fw.id, fw.role)

        # Assigned Village 1 succeeds
        res_v1 = await async_client.get(f"/api/v1/rbac/test-village/{v1.id}", headers=headers)
        assert res_v1.status_code == 200

        # Unassigned Village 2 fails with 403
        res_v2 = await async_client.get(f"/api/v1/rbac/test-village/{v2.id}", headers=headers)
        assert res_v2.status_code == 403
        assert "not assigned to this village" in res_v2.text
    finally:
        await db_session.delete(assignment)
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.delete(v1)
        await db_session.delete(v2)
        await db_session.delete(taluka)
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_05_farmer_cross_access(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 5: Farmer accessing another farmer's records is rejected with HTTP 403."""
    from app.modules.farmers.models import Farmer

    v_res = await db_session.execute(select(Village).limit(1))
    village = v_res.scalars().first()

    farmer_a_id = uuid.uuid4()
    farmer_b_id = uuid.uuid4()

    farmer_user_a = create_test_user(role="FARMER", full_name="Farmer Ramesh", status="ACTIVE")
    farmer_user_b = create_test_user(role="FARMER", full_name="Farmer Suresh", status="ACTIVE")
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Link", status="ACTIVE")
    db_session.add_all([farmer_user_a, farmer_user_b, admin])
    await db_session.flush()

    farmer_a = Farmer(
        id=farmer_a_id,
        village_id=village.id,
        full_name="Farmer Ramesh",
        name_norm="farmer ramesh",
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    farmer_b = Farmer(
        id=farmer_b_id,
        village_id=village.id,
        full_name="Farmer Suresh",
        name_norm="farmer suresh",
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    db_session.add_all([farmer_a, farmer_b])
    await db_session.flush()

    link_a = FarmerUserLink(user_id=farmer_user_a.id, farmer_id=farmer_a_id, linked_by=admin.id)
    link_b = FarmerUserLink(user_id=farmer_user_b.id, farmer_id=farmer_b_id, linked_by=admin.id)
    db_session.add_all([link_a, link_b])
    await db_session.commit()

    try:
        headers_a = _bearer_headers(farmer_user_a.id, farmer_user_a.role)

        # Farmer A accessing own record succeeds
        res_own = await async_client.get(f"/api/v1/rbac/test-farmer/{farmer_a_id}", headers=headers_a)
        assert res_own.status_code == 200

        # Farmer A accessing Farmer B record fails with 403
        res_other = await async_client.get(f"/api/v1/rbac/test-farmer/{farmer_b_id}", headers=headers_a)
        assert res_other.status_code == 403
        assert "another farmer" in res_other.text.lower()
    finally:
        await db_session.delete(link_a)
        await db_session.delete(link_b)
        await db_session.flush()
        await db_session.delete(farmer_a)
        await db_session.delete(farmer_b)
        await db_session.flush()
        await db_session.delete(farmer_user_a)
        await db_session.delete(farmer_user_b)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_06_sys_admin_operational_restrictions(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 6: SYS_ADMIN platform role does not grant operational district/village scope."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Platform Admin", status="ACTIVE")
    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add_all([admin, dist])
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), taluka_id=taluka.id, district_id=dist.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    try:
        headers = _bearer_headers(admin.id, admin.role)

        # SYS_ADMIN cannot claim operational district scope
        res_dist = await async_client.get(f"/api/v1/rbac/test-district/{dist.id}", headers=headers)
        assert res_dist.status_code == 403
        assert "Platform administrator" in res_dist.text

        # SYS_ADMIN cannot claim operational village scope
        res_vil = await async_client.get(f"/api/v1/rbac/test-village/{village.id}", headers=headers)
        assert res_vil.status_code == 403
        assert "Platform administrator" in res_vil.text
    finally:
        await db_session.delete(admin)
        await db_session.delete(village)
        await db_session.delete(taluka)
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_07_individual_permission_grant_and_revocation(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 7: Explicit user_permission_grant lifecycle (missing -> granted -> revoked)."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Granter", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. Qualified VO", status="ACTIVE")
    db_session.add_all([admin, vo])
    await db_session.commit()

    grant = None

    try:
        headers = _bearer_headers(vo.id, vo.role)

        # Stage 1: By default, VO lacks disease.confirm
        res1 = await async_client.get("/api/v1/rbac/test-disease-confirm", headers=headers)
        assert res1.status_code == 403
        assert "disease.confirm" in res1.text

        # Stage 2: Admin explicitly grants disease.confirm
        grant = UserPermissionGrant(
            user_id=vo.id,
            permission_code="disease.confirm",
            granted_by=admin.id,
            revoked_at=None
        )
        db_session.add(grant)
        await db_session.commit()

        res2 = await async_client.get("/api/v1/rbac/test-disease-confirm", headers=headers)
        assert res2.status_code == 200
        assert res2.json()["disease_confirmation"] == "authorized"

        # Stage 3: Admin revokes the grant
        grant.revoked_at = datetime.now(timezone.utc)
        await db_session.commit()

        res3 = await async_client.get("/api/v1/rbac/test-disease-confirm", headers=headers)
        assert res3.status_code == 403
        assert "disease.confirm" in res3.text
    finally:
        if grant:
            await db_session.delete(grant)
        await db_session.delete(vo)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_08_inactive_account_access_rejection(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 8: Inactive user account is rejected with HTTP 403."""
    user = create_test_user(
        role="FIELD_WORKER",
        full_name="Deactivated FW",
        status="INACTIVE"
    )
    db_session.add(user)
    await db_session.commit()

    try:
        headers = _bearer_headers(user.id, user.role)
        res = await async_client.get("/api/v1/rbac/scope", headers=headers)
        assert res.status_code == 403
        assert "inactive" in res.text.lower()
    finally:
        await db_session.delete(user)
        await db_session.commit()


@pytest_async
async def test_09_expired_or_invalid_jwt_rejection(async_client: AsyncClient) -> None:
    """Test 9: Expired or forged JWT access token returns HTTP 401."""
    # Expired token
    expired_headers = _bearer_headers(
        uuid.uuid4(),
        "FIELD_WORKER",
        expires_delta=timedelta(seconds=-30)
    )
    res_exp = await async_client.get("/api/v1/rbac/scope", headers=expired_headers)
    assert res_exp.status_code == 401
    assert "expired" in res_exp.text.lower()

    # Forged / malformed token
    res_bad = await async_client.get(
        "/api/v1/rbac/scope",
        headers={"Authorization": "Bearer bad.token.content"}
    )
    assert res_bad.status_code == 401
    assert "credentials" in res_bad.text.lower()


@pytest_async
async def test_10_vo_fallback_prerequisites(async_client: AsyncClient, db_session: AsyncSession) -> None:
    """Test 10: VO fallback animal registration requires formal FW unavailability."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Fallback", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. Fallback VO", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="Field Worker On Leave", status="ACTIVE")
    db_session.add_all([admin, vo, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), taluka_id=taluka.id, district_id=dist.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    # Assign VO to this village
    vo_assign = UserVillageAssignment(user_id=vo.id, village_id=village.id, assigned_by=admin.id)
    db_session.add(vo_assign)
    await db_session.commit()

    headers = _bearer_headers(vo.id, vo.role)
    unavail = None

    try:
        # Step A: Fallback attempt without formal unavailability record fails
        res_fail = await async_client.post(
            "/api/v1/rbac/test-vo-fallback",
            json={
                "village_id": str(village.id),
                "field_worker_user_id": str(fw.id),
                "reason": "FW is currently on medical leave"
            },
            headers=headers
        )
        assert res_fail.status_code == 403
        assert "unavailability declaration" in res_fail.text

        # Step B: Record formal FW unavailability declaration
        unavail = FieldWorkerAvailabilityRecord(
            field_worker_user_id=fw.id,
            village_id=village.id,
            availability_status="UNAVAILABLE",
            reason="Medical emergency leave approved by VO",
            valid_from=datetime.now(timezone.utc) - timedelta(hours=1),
            valid_until=datetime.now(timezone.utc) + timedelta(days=2),
            recorded_by=vo.id
        )
        db_session.add(unavail)
        await db_session.commit()

        # Step C: Fallback attempt now succeeds
        res_succ = await async_client.post(
            "/api/v1/rbac/test-vo-fallback",
            json={
                "village_id": str(village.id),
                "field_worker_user_id": str(fw.id),
                "reason": "FW is on medical leave; emergency calf registration"
            },
            headers=headers
        )
        assert res_succ.status_code == 200, res_succ.text
        assert res_succ.json() == {"status": "authorized", "fallback": "validated"}
    finally:
        if unavail:
            await db_session.delete(unavail)
        await db_session.delete(vo_assign)
        await db_session.delete(vo)
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.delete(village)
        await db_session.delete(taluka)
        await db_session.delete(dist)
        await db_session.commit()


@pytest_async
async def test_11_vaccinator_clinical_authorization(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 11: Administering/recording vaccinations requires approved vaccinator authorization."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Clinical", status="ACTIVE")
    user = create_test_user(role="FIELD_WORKER", full_name="Vaccinator Candidate", status="ACTIVE")
    db_session.add_all([admin, user])
    await db_session.commit()

    vauth = None

    try:
        headers = _bearer_headers(user.id, user.role)

        # Before clinical authorization: denied with 403
        res1 = await async_client.get("/api/v1/rbac/test-vaccinator", headers=headers)
        assert res1.status_code == 403
        assert "vaccinator authorization" in res1.text.lower()

        # Department issues approved vaccinator authorization
        vauth = VaccinatorAuthorization(
            user_id=user.id,
            authority_type="GOVERNMENT_FIELD_WORKER",
            status="APPROVED",
            authorization_reference="DEPT-VA-2026-0042",
            authorized_by_name="Dr. Director",
            valid_from=date.today() - timedelta(days=1),
            valid_to=date.today() + timedelta(days=365),
            requested_by=admin.id,
            approved_by=admin.id,
            approved_at=datetime.now(timezone.utc)
        )
        db_session.add(vauth)
        await db_session.commit()

        # After approval: succeeds with 200
        res2 = await async_client.get("/api/v1/rbac/test-vaccinator", headers=headers)
        assert res2.status_code == 200
        assert res2.json() == {"status": "authorized", "vaccinator": "approved"}
    finally:
        if vauth:
            await db_session.delete(vauth)
            await db_session.flush()
        await db_session.delete(user)
        await db_session.delete(admin)
        await db_session.commit()

