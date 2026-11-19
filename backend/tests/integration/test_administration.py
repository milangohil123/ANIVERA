"""Integration tests for Administrative Management APIs (FastAPI + PostgreSQL 16).

Covers all test scenarios specified in Step 5:
- District access and cross-district boundary enforcement
- SYS_ADMIN platform setup and operational restrictions
- Taluka and Village parent hierarchy validation
- Gram Panchayat management and village mapping
- Cooperative creation, village mapping, and dairy staff scope isolation
- Veterinary Officer provisioning, profile management, and role restriction preservation
- Field Worker provisioning, status activation/deactivation, and role separation
- Administrative assignments (VO to village, DAHO to district)
- Authentication (401), Authorisation (403), Inactive account checks, and audit logging
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from httpx import AsyncClient
from sqlalchemy import select, delete
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
from app.modules.administration.models import (
    Cooperative,
    GramPanchayat,
    GramPanchayatVillage,
    VeterinaryOfficerProfile,
)
from app.modules.notifications.models import Notification
from app.modules.authorization.models import (
    CooperativeStaffAssignment,
    CooperativeVillage,
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


def _bearer_headers(user_id: uuid.UUID, role: str) -> dict:
    token = create_access_token(subject=str(user_id), claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


@pytest_async
async def test_01_daho_district_access_and_cross_district_denial(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: DAHO can access assigned district; cross-district access returns 403."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="Dr. Botad DAHO", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist_a = District(id=uuid.uuid4(), code=f"BOT_{uuid.uuid4().hex[:6]}", name_gu="બોટાદ", name_en="Botad")
    dist_b = District(id=uuid.uuid4(), code=f"AHM_{uuid.uuid4().hex[:6]}", name_gu="અમદાવાદ", name_en="Ahmedabad")
    db_session.add_all([dist_a, dist_b])
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist_a.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        # Accessing assigned district A succeeds
        res_a = await async_client.get(f"/api/v1/administration/districts/{dist_a.id}", headers=headers)
        assert res_a.status_code == 200, res_a.text
        assert res_a.json()["code"] == dist_a.code

        # Accessing unassigned district B fails with 403
        res_b = await async_client.get(f"/api/v1/administration/districts/{dist_b.id}", headers=headers)
        assert res_b.status_code == 403
        assert "not assigned to this district" in res_b.text
    finally:
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.flush()
        await db_session.delete(dist_a)
        await db_session.delete(dist_b)
        await db_session.commit()


@pytest_async
async def test_02_sys_admin_district_creation_authority_and_audit(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 2: SYS_ADMIN without grant is rejected with 403; granted user succeeds and logs audit."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Platform Admin", status="ACTIVE")
    db_session.add(admin)
    await db_session.commit()

    code = f"DIS_{uuid.uuid4().hex[:6].upper()}"
    headers = _bearer_headers(admin.id, admin.role)
    dist_id = None
    grant = None

    try:
        # Step A: SYS_ADMIN lacks district.setup.manage by default -> rejected with 403
        res_denied = await async_client.post(
            "/api/v1/administration/districts",
            json={
                "code": code,
                "name_gu": "નવો જિલ્લો",
                "name_en": "New District",
                "active": True
            },
            headers=headers
        )
        assert res_denied.status_code == 403
        assert "district.setup.manage" in res_denied.text

        # Step B: Explicit grant added in user_permission_grants
        grant = UserPermissionGrant(
            user_id=admin.id,
            permission_code="district.setup.manage",
            granted_by=admin.id
        )
        db_session.add(grant)
        await db_session.commit()

        # Step C: Creation now succeeds with 201
        res = await async_client.post(
            "/api/v1/administration/districts",
            json={
                "code": code,
                "name_gu": "નવો જિલ્લો",
                "name_en": "New District",
                "active": True
            },
            headers=headers
        )
        assert res.status_code == 201, res.text
        dist_id = uuid.UUID(res.json()["id"])

        # Step D: Duplicate code returns 409 Conflict
        res_dup = await async_client.post(
            "/api/v1/administration/districts",
            json={
                "code": code,
                "name_gu": "નવો જિલ્લો",
                "name_en": "New District",
                "active": True
            },
            headers=headers
        )
        assert res_dup.status_code == 409

        # Step E: Verify audit log
        audit_stmt = select(AuditEvent).where(
            AuditEvent.action == "ADMIN_DISTRICT_CREATED",
            AuditEvent.object_id == str(dist_id)
        )
        audit_res = await db_session.execute(audit_stmt)
        event = audit_res.scalars().first()
        assert event is not None
        assert event.result == "SUCCESS"

    finally:
        if dist_id:
            created_dist = await db_session.get(District, dist_id)
            if created_dist:
                await db_session.delete(created_dist)
                await db_session.flush()
        if grant:
            await db_session.delete(grant)
            await db_session.flush()
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_03_taluka_parent_validation_and_creation(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 3: Taluka creation enforces district existence and scope."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Taluka", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Taluka", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist_a = District(id=uuid.uuid4(), code=f"DA_{uuid.uuid4().hex[:6]}", name_gu="જિ એ", name_en="Dist A")
    dist_b = District(id=uuid.uuid4(), code=f"DB_{uuid.uuid4().hex[:6]}", name_gu="જિ બી", name_en="Dist B")
    db_session.add_all([dist_a, dist_b])
    await db_session.flush()

    # Assign DAHO only to District A
    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist_a.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)
    taluka_id = None
    admin_grant = None

    try:
        # Creating taluka in assigned District A succeeds
        tal_code = f"TAL_{uuid.uuid4().hex[:6].upper()}"
        res_ok = await async_client.post(
            "/api/v1/administration/talukas",
            json={
                "district_id": str(dist_a.id),
                "code": tal_code,
                "name_gu": "તાલુકો ૧",
                "name_en": "Taluka 1"
            },
            headers=headers
        )
        assert res_ok.status_code == 201, res_ok.text
        taluka_id = uuid.UUID(res_ok.json()["id"])

        # Creating taluka in unassigned District B fails with 403
        res_cross = await async_client.post(
            "/api/v1/administration/talukas",
            json={
                "district_id": str(dist_b.id),
                "code": f"TAL_{uuid.uuid4().hex[:6].upper()}",
                "name_gu": "તાલુકો ૨",
                "name_en": "Taluka 2"
            },
            headers=headers
        )
        assert res_cross.status_code == 403

        # Non-existent district returns 404 when requested by authorized staff
        admin_grant = UserPermissionGrant(user_id=admin.id, permission_code="district.setup.manage", granted_by=admin.id)
        db_session.add(admin_grant)
        await db_session.commit()

        res_404 = await async_client.post(
            "/api/v1/administration/talukas",
            json={
                "district_id": str(uuid.uuid4()),
                "code": f"TAL_{uuid.uuid4().hex[:6].upper()}",
                "name_gu": "તાલુકો ૩",
                "name_en": "Taluka 3"
            },
            headers=_bearer_headers(admin.id, admin.role)
        )
        assert res_404.status_code == 404

    finally:
        if taluka_id:
            tal = await db_session.get(Taluka, taluka_id)
            if tal:
                await db_session.delete(tal)
                await db_session.flush()
        if admin_grant:
            await db_session.delete(admin_grant)
            await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.flush()
        await db_session.delete(dist_a)
        await db_session.delete(dist_b)
        await db_session.commit()


@pytest_async
async def test_04_village_creation_and_mismatched_taluka_rejection(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 4: Village creation rejects mismatched taluka-district relationships."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Vil", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW Vil", status="ACTIVE")
    db_session.add_all([admin, fw])
    await db_session.flush()

    dist_1 = District(id=uuid.uuid4(), code=f"D1_{uuid.uuid4().hex[:6]}", name_gu="જિ ૧", name_en="Dist 1")
    dist_2 = District(id=uuid.uuid4(), code=f"D2_{uuid.uuid4().hex[:6]}", name_gu="જિ ૨", name_en="Dist 2")
    db_session.add_all([dist_1, dist_2])
    await db_session.flush()

    tal_1 = Taluka(id=uuid.uuid4(), district_id=dist_1.id, code=f"T1_{uuid.uuid4().hex[:6]}", name_gu="તા ૧", name_en="Tal 1")
    db_session.add(tal_1)
    await db_session.commit()

    admin_headers = _bearer_headers(admin.id, admin.role)
    fw_headers = _bearer_headers(fw.id, fw.role)
    village_id = None

    try:
        # Step A: Mismatched taluka and district (tal_1 belongs to dist_1, but dist_2 is sent)
        res_mismatch = await async_client.post(
            "/api/v1/administration/villages",
            json={
                "district_id": str(dist_2.id),
                "taluka_id": str(tal_1.id),
                "code": f"VIL_{uuid.uuid4().hex[:6].upper()}",
                "name_gu": "ગામ ૧",
                "name_en": "Village 1"
            },
            headers=admin_headers
        )
        assert res_mismatch.status_code == 400
        assert "does not belong" in res_mismatch.text

        # Step B: Valid creation under matching parents succeeds
        vil_code = f"VIL_{uuid.uuid4().hex[:6].upper()}"
        res_ok = await async_client.post(
            "/api/v1/administration/villages",
            json={
                "district_id": str(dist_1.id),
                "taluka_id": str(tal_1.id),
                "code": vil_code,
                "name_gu": "ગામ ૧",
                "name_en": "Village 1",
                "latitude": 22.1700,
                "longitude": 71.6700
            },
            headers=admin_headers
        )
        assert res_ok.status_code == 201, res_ok.text
        village_id = uuid.UUID(res_ok.json()["id"])
        assert res_ok.json()["coord_status"] == "VERIFIED"

        # Step C: Field worker lacks village.manage permission -> 403
        res_fw = await async_client.post(
            "/api/v1/administration/villages",
            json={
                "district_id": str(dist_1.id),
                "taluka_id": str(tal_1.id),
                "code": f"VIL_{uuid.uuid4().hex[:6].upper()}",
                "name_gu": "ગામ ૨",
                "name_en": "Village 2"
            },
            headers=fw_headers
        )
        assert res_fw.status_code == 403

    finally:
        if village_id:
            vil = await db_session.get(Village, village_id)
            if vil:
                await db_session.delete(vil)
                await db_session.flush()
        await db_session.delete(tal_1)
        await db_session.flush()
        await db_session.delete(dist_1)
        await db_session.delete(dist_2)
        await db_session.flush()
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_05_gram_panchayat_lifecycle_and_village_mapping(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 5: Gram Panchayat creation and village mapping under DAHO scope."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin GP", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO GP", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)
    gp_id = None

    try:
        # Create GP
        gp_code = f"GP_{uuid.uuid4().hex[:6].upper()}"
        gp_res = await async_client.post(
            "/api/v1/administration/gram-panchayats",
            json={
                "taluka_id": str(taluka.id),
                "code": gp_code,
                "name_gu": "ગ્રામ પંચાયત ૧",
                "name_en": "Gram Panchayat 1",
                "active": True
            },
            headers=headers
        )
        assert gp_res.status_code == 201, gp_res.text
        gp_id = uuid.UUID(gp_res.json()["id"])

        # Map village to GP
        map_res = await async_client.post(
            f"/api/v1/administration/gram-panchayats/{gp_id}/villages",
            json={"village_id": str(village.id)},
            headers=headers
        )
        assert map_res.status_code == 201, map_res.text
        assert map_res.json()["gram_panchayat_id"] == str(gp_id)

        # Retrieve GP details showing mapped village
        get_res = await async_client.get(f"/api/v1/administration/gram-panchayats/{gp_id}", headers=headers)
        assert get_res.status_code == 200
        assert str(village.id) in [str(vid) for vid in get_res.json()["associated_village_ids"]]

    finally:
        if gp_id:
            gp_v = await db_session.execute(select(GramPanchayatVillage).where(GramPanchayatVillage.gram_panchayat_id == gp_id))
            for row in gp_v.scalars().all():
                await db_session.delete(row)
            await db_session.flush()
            gp_obj = await db_session.get(GramPanchayat, gp_id)
            if gp_obj:
                await db_session.delete(gp_obj)
            await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_06_cooperative_lifecycle_and_staff_scoping(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 6: Cooperative creation, village mapping, and dairy staff scope restriction."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Coop", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Coop", status="ACTIVE")
    dairy_staff = create_test_user(role="DAIRY_STAFF", full_name="Dairy Staff User", status="ACTIVE")
    db_session.add_all([admin, daho, dairy_staff])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    daho_headers = _bearer_headers(daho.id, daho.role)
    coop_id = None

    try:
        # Step A: DAHO creates cooperative
        coop_code = f"COOP_{uuid.uuid4().hex[:6].upper()}"
        res_coop = await async_client.post(
            "/api/v1/administration/cooperatives",
            json={
                "code": coop_code,
                "name_gu": "દૂધ મંડળી ૧",
                "name_en": "Milk Cooperative 1",
                "org_type": "DAIRY_COOPERATIVE",
                "status": "ACTIVE"
            },
            headers=daho_headers
        )
        assert res_coop.status_code == 201, res_coop.text
        coop_id = uuid.UUID(res_coop.json()["id"])

        # Step B: Map village to cooperative
        res_map = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop_id}/villages",
            json={"village_id": str(village.id)},
            headers=daho_headers
        )
        assert res_map.status_code == 201

        # Step C: Assign dairy staff to cooperative
        res_staff = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop_id}/staff",
            json={
                "user_id": str(dairy_staff.id),
                "coop_role": "COORDINATOR"
            },
            headers=daho_headers
        )
        assert res_staff.status_code == 201

        # Step D: Dairy staff accessing another unrelated cooperative fails with 403
        other_coop_id = uuid.uuid4()
        dairy_headers = _bearer_headers(dairy_staff.id, dairy_staff.role)
        res_other = await async_client.get(
            f"/api/v1/administration/cooperatives/{other_coop_id}",
            headers=dairy_headers
        )
        assert res_other.status_code == 403

    finally:
        if coop_id:
            cv_stmt = select(CooperativeVillage).where(CooperativeVillage.cooperative_id == coop_id)
            for row in (await db_session.execute(cv_stmt)).scalars().all():
                await db_session.delete(row)
            await db_session.flush()

            csa_stmt = select(CooperativeStaffAssignment).where(CooperativeStaffAssignment.cooperative_id == coop_id)
            for row in (await db_session.execute(csa_stmt)).scalars().all():
                await db_session.delete(row)
            await db_session.flush()

            coop_obj = await db_session.get(Cooperative, coop_id)
            if coop_obj:
                await db_session.delete(coop_obj)
            await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(dairy_staff)
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_07_veterinary_officer_provisioning_and_fallback_preservation(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 7: VO provisioning creates profile and preserves fallback-only animal registration."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin VO", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO VO", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.commit()

    vo_username = f"dr_vo_{uuid.uuid4().hex[:6]}"
    daho_headers = _bearer_headers(daho.id, daho.role)
    vo_user_id = None

    try:
        # Provision Veterinary Officer
        res = await async_client.post(
            "/api/v1/administration/veterinary-officers",
            json={
                "full_name": "Dr. Aniruddh Joshi",
                "username": vo_username,
                "password": "Password1234!",
                "mobile_e164": f"+9198{uuid.uuid4().int % 100000000:08d}",
                "designation": "Veterinary Officer Grade 1",
                "office_name": "Botad Central Dispensary",
                "employee_ref": f"EMP-VO-{uuid.uuid4().hex[:4].upper()}"
            },
            headers=daho_headers
        )
        assert res.status_code == 201, res.text
        data = res.json()
        vo_user_id = uuid.UUID(data["id"])

        # Password hash must not be exposed in response
        assert "password" not in data
        assert "password_hash" not in data
        assert data["designation"] == "Veterinary Officer Grade 1"
        assert data["office_name"] == "Botad Central Dispensary"

        # Verify VO in DB does NOT receive primary animal.create
        scope_res = await async_client.get(
            "/api/v1/rbac/scope",
            headers=_bearer_headers(vo_user_id, "VET_OFFICER")
        )
        assert scope_res.status_code == 200
        permissions = scope_res.json()["permissions"]
        assert "animal.create" not in permissions
        assert "animal.create.fallback" in permissions

    finally:
        if vo_user_id:
            notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([admin.id, daho.id, vo_user_id]))
            for n in (await db_session.execute(notif_stmt)).scalars().all():
                await db_session.delete(n)
            await db_session.flush()

            prof = await db_session.get(VeterinaryOfficerProfile, vo_user_id)
            if prof:
                await db_session.delete(prof)
            await db_session.flush()
            vo_user = await db_session.get(User, vo_user_id)
            if vo_user:
                await db_session.delete(vo_user)
            await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_08_field_worker_provisioning_and_role_separation(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 8: Field Worker provisioning, activation/deactivation, and role separation."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin FW", status="ACTIVE")
    db_session.add(admin)
    await db_session.commit()

    fw_username = f"fw_{uuid.uuid4().hex[:6]}"
    admin_headers = _bearer_headers(admin.id, admin.role)
    fw_id = None

    try:
        # Provision Field Worker
        res = await async_client.post(
            "/api/v1/administration/field-workers",
            json={
                "full_name": "Mansukhbhai Rathod",
                "username": fw_username,
                "password": "Password1234!",
                "mobile_e164": f"+9198{uuid.uuid4().int % 100000000:08d}",
                "designation": "Livestock Field Worker",
                "organisation": "Botad Animal Husbandry Division"
            },
            headers=admin_headers
        )
        assert res.status_code == 201, res.text
        fw_id = uuid.UUID(res.json()["id"])
        assert res.json()["status"] == "ACTIVE"

        # Verify FW receives primary animal.create
        scope_res = await async_client.get(
            "/api/v1/rbac/scope",
            headers=_bearer_headers(fw_id, "FIELD_WORKER")
        )
        assert scope_res.status_code == 200
        assert "animal.create" in scope_res.json()["permissions"]

        # Deactivate Field Worker
        deact_res = await async_client.patch(
            f"/api/v1/administration/field-workers/{fw_id}/status",
            json={"status": "INACTIVE", "reason": "Transferred to other department"},
            headers=admin_headers
        )
        assert deact_res.status_code == 200
        assert deact_res.json()["new_status"] == "INACTIVE"

        # Inactive FW is rejected on authenticated routes with 403
        blocked_res = await async_client.get(
            "/api/v1/rbac/scope",
            headers=_bearer_headers(fw_id, "FIELD_WORKER")
        )
        assert blocked_res.status_code == 403

        # Self-status modification is rejected with 400
        self_res = await async_client.patch(
            f"/api/v1/administration/field-workers/{admin.id}/status",
            json={"status": "INACTIVE"},
            headers=admin_headers
        )
        assert self_res.status_code == 400

    finally:
        if fw_id:
            notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([admin.id, fw_id]))
            for n in (await db_session.execute(notif_stmt)).scalars().all():
                await db_session.delete(n)
            await db_session.flush()

            fw_user = await db_session.get(User, fw_id)
            if fw_user:
                await db_session.delete(fw_user)
            await db_session.flush()
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_09_vo_village_assignment_management(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 9: Assigning and ending VO village assignments within DAHO district scope."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Assign", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Assign", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Assignee", status="ACTIVE")
    db_session.add_all([admin, daho, vo])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    daho_assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(daho_assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    daho_headers = _bearer_headers(daho.id, daho.role)

    try:
        # Step A: DAHO assigns VO to village in assigned district
        assign_res = await async_client.post(
            "/api/v1/administration/assignments/vo-village",
            json={
                "user_id": str(vo.id),
                "village_id": str(village.id)
            },
            headers=daho_headers
        )
        assert assign_res.status_code == 201, assign_res.text
        assert assign_res.json()["village_id"] == str(village.id)

        # Step B: Ending assignment sets ended_at
        end_res = await async_client.post(
            "/api/v1/administration/assignments/vo-village/end",
            json={
                "user_id": str(vo.id),
                "village_id": str(village.id)
            },
            headers=daho_headers
        )
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "ended"

    finally:
        notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([admin.id, daho.id, vo.id]))
        for n in (await db_session.execute(notif_stmt)).scalars().all():
            await db_session.delete(n)
        await db_session.flush()

        uva_stmt = select(UserVillageAssignment).where(UserVillageAssignment.user_id == vo.id)
        for row in (await db_session.execute(uva_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.flush()

        await db_session.delete(daho_assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(vo)
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_10_daho_district_assignment_by_sys_admin_only(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 10: Only SYS_ADMIN platform administrator can assign DAHO to district."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Super Admin", status="ACTIVE")
    daho_1 = create_test_user(role="DAHO", full_name="DAHO User 1", status="ACTIVE")
    daho_2 = create_test_user(role="DAHO", full_name="DAHO User 2", status="ACTIVE")
    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add_all([admin, daho_1, daho_2, dist])
    await db_session.commit()

    assign_id = None

    try:
        # DAHO cannot assign another DAHO to district -> 403
        daho_res = await async_client.post(
            "/api/v1/administration/assignments/daho-district",
            json={
                "daho_user_id": str(daho_2.id),
                "district_id": str(dist.id)
            },
            headers=_bearer_headers(daho_1.id, daho_1.role)
        )
        assert daho_res.status_code == 403

        # SYS_ADMIN assignment succeeds
        admin_res = await async_client.post(
            "/api/v1/administration/assignments/daho-district",
            json={
                "daho_user_id": str(daho_1.id),
                "district_id": str(dist.id)
            },
            headers=_bearer_headers(admin.id, admin.role)
        )
        assert admin_res.status_code == 201
        assign_id = uuid.UUID(admin_res.json()["id"])

    finally:
        if assign_id:
            dda = await db_session.get(DahoDistrictAssignment, assign_id)
            if dda:
                await db_session.delete(dda)
                await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho_1)
        await db_session.delete(daho_2)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_11_unauthenticated_and_unauthorized_rejections(async_client: AsyncClient) -> None:
    """Test 11: Unauthenticated requests return 401."""
    res_no_auth = await async_client.get("/api/v1/administration/districts")
    assert res_no_auth.status_code == 401


@pytest_async
async def test_12_administrative_get_endpoints_reject_unauthorized_roles(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 12: Administrative GET endpoints reject roles lacking administrative viewing authority."""
    farmer = create_test_user(role="FARMER", full_name="Farmer Khedut", status="ACTIVE")
    db_session.add(farmer)
    await db_session.commit()

    farmer_headers = _bearer_headers(farmer.id, farmer.role)

    try:
        # Districts
        res_dist = await async_client.get("/api/v1/administration/districts", headers=farmer_headers)
        assert res_dist.status_code == 403

        # Gram Panchayats
        res_gp = await async_client.get("/api/v1/administration/gram-panchayats", headers=farmer_headers)
        assert res_gp.status_code == 403

        # Cooperatives
        res_coop = await async_client.get("/api/v1/administration/cooperatives", headers=farmer_headers)
        assert res_coop.status_code == 403

        # Veterinary Officers
        res_vo = await async_client.get("/api/v1/administration/veterinary-officers", headers=farmer_headers)
        assert res_vo.status_code == 403
    finally:
        await db_session.delete(farmer)
        await db_session.commit()


@pytest_async
async def test_13_duplicate_gp_village_mapping_returns_409(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 13: Mapping an already mapped village to a Gram Panchayat returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin GP Dup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO GP Dup", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    gp = GramPanchayat(id=uuid.uuid4(), taluka_id=taluka.id, code=f"GP_{uuid.uuid4().hex[:6]}", name_gu="પંચાયત", name_en="Panchayat", created_by=admin.id)
    db_session.add(gp)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        # First mapping succeeds
        res_1 = await async_client.post(
            f"/api/v1/administration/gram-panchayats/{gp.id}/villages",
            json={"village_id": str(village.id)},
            headers=headers
        )
        assert res_1.status_code == 201

        # Second mapping returns 409 Conflict
        res_2 = await async_client.post(
            f"/api/v1/administration/gram-panchayats/{gp.id}/villages",
            json={"village_id": str(village.id)},
            headers=headers
        )
        assert res_2.status_code == 409
        assert "already actively mapped" in res_2.text

        # Cleanup mapping
        gp_v = await db_session.execute(select(GramPanchayatVillage).where(GramPanchayatVillage.gram_panchayat_id == gp.id))
        for row in gp_v.scalars().all():
            await db_session.delete(row)
        await db_session.commit()
    finally:
        gp_v = await db_session.execute(select(GramPanchayatVillage).where(GramPanchayatVillage.gram_panchayat_id == gp.id))
        for row in gp_v.scalars().all():
            await db_session.delete(row)
        await db_session.flush()
        await db_session.delete(gp)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_14_mismatched_taluka_gp_village_mapping_returns_400(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 14: Mapping a village from a different taluka to a Gram Panchayat returns 400 Bad Request."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin GP Tal", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO GP Tal", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    tal_1 = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T1_{uuid.uuid4().hex[:6]}", name_gu="તા ૧", name_en="Tal 1")
    tal_2 = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T2_{uuid.uuid4().hex[:6]}", name_gu="તા ૨", name_en="Tal 2")
    db_session.add_all([tal_1, tal_2])
    await db_session.flush()

    # Village in Taluka 2, GP in Taluka 1
    village_2 = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=tal_2.id, code=f"V2_{uuid.uuid4().hex[:6]}", name_gu="ગામ ૨", name_en="Vil 2")
    gp_1 = GramPanchayat(id=uuid.uuid4(), taluka_id=tal_1.id, code=f"GP1_{uuid.uuid4().hex[:6]}", name_gu="પંચાયત ૧", name_en="Panchayat 1", created_by=admin.id)
    db_session.add_all([village_2, gp_1])
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        res = await async_client.post(
            f"/api/v1/administration/gram-panchayats/{gp_1.id}/villages",
            json={"village_id": str(village_2.id)},
            headers=headers
        )
        assert res.status_code == 400
        assert "does not belong to the same taluka" in res.text
    finally:
        await db_session.delete(gp_1)
        await db_session.flush()
        await db_session.delete(village_2)
        await db_session.flush()
        await db_session.delete(tal_1)
        await db_session.delete(tal_2)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_15_duplicate_cooperative_village_mapping_returns_409(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 15: Mapping an already mapped village to a cooperative returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Coop Dup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Coop Dup", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    coop = Cooperative(id=uuid.uuid4(), code=f"COOP_{uuid.uuid4().hex[:6]}", name_gu="મંડળી", name_en="Coop", org_type="DAIRY_COOPERATIVE", created_by=admin.id)
    db_session.add_all([village, coop])
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        # First mapping succeeds
        res_1 = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop.id}/villages",
            json={"village_id": str(village.id)},
            headers=headers
        )
        assert res_1.status_code == 201

        # Second mapping returns 409 Conflict
        res_2 = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop.id}/villages",
            json={"village_id": str(village.id)},
            headers=headers
        )
        assert res_2.status_code == 409
        assert "already mapped" in res_2.text

        # Cleanup mapping
        cv_stmt = select(CooperativeVillage).where(CooperativeVillage.cooperative_id == coop.id)
        for row in (await db_session.execute(cv_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.commit()
    finally:
        cv_stmt = select(CooperativeVillage).where(CooperativeVillage.cooperative_id == coop.id)
        for row in (await db_session.execute(cv_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.flush()
        await db_session.delete(coop)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_16_duplicate_cooperative_staff_assignment_returns_409(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 16: Assigning staff to a cooperative with the same active role returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Staff Dup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Staff Dup", status="ACTIVE")
    staff = create_test_user(role="DAIRY_STAFF", full_name="Dairy Staff Dup", status="ACTIVE")
    db_session.add_all([admin, daho, staff])
    await db_session.flush()

    coop = Cooperative(id=uuid.uuid4(), code=f"COOP_{uuid.uuid4().hex[:6]}", name_gu="મંડળી", name_en="Coop", org_type="DAIRY_COOPERATIVE", created_by=admin.id)
    db_session.add(coop)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        # First assignment succeeds
        res_1 = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop.id}/staff",
            json={"user_id": str(staff.id), "coop_role": "COORDINATOR"},
            headers=headers
        )
        assert res_1.status_code == 201

        # Second assignment with same role returns 409 Conflict
        res_2 = await async_client.post(
            f"/api/v1/administration/cooperatives/{coop.id}/staff",
            json={"user_id": str(staff.id), "coop_role": "COORDINATOR"},
            headers=headers
        )
        assert res_2.status_code == 409
        assert "already actively assigned" in res_2.text

        # Cleanup assignments
        csa_stmt = select(CooperativeStaffAssignment).where(CooperativeStaffAssignment.cooperative_id == coop.id)
        for row in (await db_session.execute(csa_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.commit()
    finally:
        csa_stmt = select(CooperativeStaffAssignment).where(CooperativeStaffAssignment.cooperative_id == coop.id)
        for row in (await db_session.execute(csa_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.flush()
        await db_session.delete(coop)
        await db_session.flush()
        await db_session.delete(staff)
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_17_duplicate_vo_village_assignment_returns_409(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 17: Assigning a VO to a village they are already actively assigned to returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin VO Dup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO VO Dup", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Dup", status="ACTIVE")
    db_session.add_all([admin, daho, vo])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    headers = _bearer_headers(daho.id, daho.role)

    try:
        # First assignment succeeds
        res_1 = await async_client.post(
            "/api/v1/administration/assignments/vo-village",
            json={"user_id": str(vo.id), "village_id": str(village.id)},
            headers=headers
        )
        assert res_1.status_code == 201

        # Second active assignment returns 409 Conflict
        res_2 = await async_client.post(
            "/api/v1/administration/assignments/vo-village",
            json={"user_id": str(vo.id), "village_id": str(village.id)},
            headers=headers
        )
        assert res_2.status_code == 409
        assert "already actively assigned" in res_2.text

    finally:
        notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([admin.id, daho.id, vo.id]))
        for n in (await db_session.execute(notif_stmt)).scalars().all():
            await db_session.delete(n)
        await db_session.flush()

        uva_stmt = select(UserVillageAssignment).where(UserVillageAssignment.user_id == vo.id)
        for row in (await db_session.execute(uva_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.flush()

        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(vo)
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_18_duplicate_daho_district_assignment_returns_409(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 18: Assigning a DAHO to a district they are already actively assigned to returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin DAHO Dup", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Dup Target", status="ACTIVE")
    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add_all([admin, daho, dist])
    await db_session.commit()

    admin_headers = _bearer_headers(admin.id, admin.role)
    assign_id = None

    try:
        # First assignment succeeds
        res_1 = await async_client.post(
            "/api/v1/administration/assignments/daho-district",
            json={"daho_user_id": str(daho.id), "district_id": str(dist.id)},
            headers=admin_headers
        )
        assert res_1.status_code == 201
        assign_id = uuid.UUID(res_1.json()["id"])

        # Second assignment returns 409 Conflict
        res_2 = await async_client.post(
            "/api/v1/administration/assignments/daho-district",
            json={"daho_user_id": str(daho.id), "district_id": str(dist.id)},
            headers=admin_headers
        )
        assert res_2.status_code == 409
        assert "already actively assigned" in res_2.text

    finally:
        if assign_id:
            dda = await db_session.get(DahoDistrictAssignment, assign_id)
            if dda:
                await db_session.delete(dda)
                await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_19_field_worker_provisioning_rejected_without_user_manage(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 19: Field Worker provisioning strictly requires user.manage; VO cannot provision FWs."""
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Non-Admin", status="ACTIVE")
    db_session.add(vo)
    await db_session.commit()

    vo_headers = _bearer_headers(vo.id, vo.role)

    try:
        res = await async_client.post(
            "/api/v1/administration/field-workers",
            json={
                "full_name": "FW Candidate",
                "username": f"fw_cand_{uuid.uuid4().hex[:6]}",
                "password": "Password1234!",
                "mobile_e164": f"+9198{uuid.uuid4().int % 100000000:08d}",
                "designation": "Livestock Worker"
            },
            headers=vo_headers
        )
        assert res.status_code == 403
        assert ("user.manage" in res.text or "Permission denied" in res.text)
    finally:
        child_users = (await db_session.execute(select(User).where(User.created_by == vo.id))).scalars().all()
        for u in child_users:
            await db_session.delete(u)
        await db_session.flush()

        await db_session.delete(vo)
        await db_session.commit()


@pytest_async
async def test_20_vo_assignment_ended_at_preservation(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 20: Ending VO assignment updates ended_at without deleting the historical row."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Hist", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Hist", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Hist", status="ACTIVE")
    db_session.add_all([admin, daho, vo])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    daho_assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist.id, assigned_by=admin.id)
    db_session.add(daho_assign)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.commit()

    daho_headers = _bearer_headers(daho.id, daho.role)

    try:
        # Create assignment
        assign_res = await async_client.post(
            "/api/v1/administration/assignments/vo-village",
            json={"user_id": str(vo.id), "village_id": str(village.id)},
            headers=daho_headers
        )
        assert assign_res.status_code == 201

        # End assignment
        end_res = await async_client.post(
            "/api/v1/administration/assignments/vo-village/end",
            json={"user_id": str(vo.id), "village_id": str(village.id)},
            headers=daho_headers
        )
        assert end_res.status_code == 200

        # Verify row still exists in database with ended_at populated
        uva_stmt = select(UserVillageAssignment).where(
            UserVillageAssignment.user_id == vo.id,
            UserVillageAssignment.village_id == village.id
        )
        assignment_row = (await db_session.execute(uva_stmt)).scalars().first()
        assert assignment_row is not None
        assert assignment_row.ended_at is not None

    finally:
        notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([admin.id, daho.id, vo.id]))
        for n in (await db_session.execute(notif_stmt)).scalars().all():
            await db_session.delete(n)
        await db_session.flush()

        uva_stmt = select(UserVillageAssignment).where(UserVillageAssignment.user_id == vo.id)
        for row in (await db_session.execute(uva_stmt)).scalars().all():
            await db_session.delete(row)
        await db_session.flush()

        await db_session.delete(daho_assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(vo)
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_21_district_summary_scope_enforcement(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 21: District summary enforces DAHO assigned district boundary."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Summ", status="ACTIVE")
    daho = create_test_user(role="DAHO", full_name="DAHO Summ", status="ACTIVE")
    db_session.add_all([admin, daho])
    await db_session.flush()

    dist_1 = District(id=uuid.uuid4(), code=f"D1_{uuid.uuid4().hex[:6]}", name_gu="જિ ૧", name_en="Dist 1")
    dist_2 = District(id=uuid.uuid4(), code=f"D2_{uuid.uuid4().hex[:6]}", name_gu="જિ ૨", name_en="Dist 2")
    db_session.add_all([dist_1, dist_2])
    await db_session.flush()

    assign = DahoDistrictAssignment(daho_user_id=daho.id, district_id=dist_1.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.commit()

    daho_headers = _bearer_headers(daho.id, daho.role)

    try:
        # Assigned district summary succeeds
        res_assigned = await async_client.get(
            f"/api/v1/administration/districts/{dist_1.id}/summary",
            headers=daho_headers
        )
        assert res_assigned.status_code == 200
        data = res_assigned.json()
        assert data["code"] == dist_1.code
        assert "taluka_count" in data
        assert "village_count" in data

        # Unassigned district summary returns 403 Forbidden
        res_unassigned = await async_client.get(
            f"/api/v1/administration/districts/{dist_2.id}/summary",
            headers=daho_headers
        )
        assert res_unassigned.status_code == 403
    finally:
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(dist_1)
        await db_session.delete(dist_2)
        await db_session.flush()
        await db_session.delete(daho)
        await db_session.delete(admin)
        await db_session.commit()


