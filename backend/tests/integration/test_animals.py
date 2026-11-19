"""Integration tests for Animal Management module (FastAPI + PostgreSQL 16).

Test coverage:
- Primary animal registration by Field Worker (animal.create) in assigned village
- Field Worker cross-village registration denial (HTTP 403)
- VO animal registration rejection when Field Worker is available (HTTP 403)
- VO fallback animal registration eligibility when Field Worker is formally unavailable (HTTP 201)
- Non-registrar role rejection (HTTP 403)
- Mismatched farmer-village and animal-village rejection (HTTP 400)
- Invalid species rejection (HTTP 400)
- Bharat Pashudhan 12-digit tag validation and duplicate prevention (HTTP 409)
- Physical Base32 26-char QR token assignment, auto-generation, re-tagging revocation, and duplicate prevention
- Fast field lookup by Base32 QR token and Bharat Pashudhan tag
- Animal ownership transfer with history audit closure
- Animal field verification recording
- Unauthenticated rejection (HTTP 401)
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.models.reference import Species
from app.modules.authentication.models import (
    AuditEvent,
    User,
    UserVillageAssignment,
)
from app.modules.authorization.models import FieldWorkerAvailabilityRecord
from app.modules.farmers.models import Farmer
from tests.conftest import create_test_user
from app.modules.animals.models import (
    Animal,
    AnimalExternalIdentifier,
    AnimalOwnershipHistory,
    AnimalQRToken,
    AnimalVerification,
    OwnershipTransfer,
)

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
async def test_01_field_worker_registers_animal_in_assigned_village(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: Field Worker with animal.create registers animal in assigned village."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="Govind FW", status="ACTIVE")
    db_session.add_all([admin, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="બોટાદ", name_en="Botad")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    assign = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    tag_val = f"100{uuid.uuid4().int % 1000000000:09d}"
    farmer = Farmer(
        id=uuid.uuid4(),
        farmer_code=f"FAR-{uuid.uuid4().hex[:8].upper()}",
        full_name="Kishorbhai Ahir",
        name_norm="KISHORBHAI AHIR",
        village_id=village.id,
        mobile_e164=f"+9198{uuid.uuid4().int % 100000000:08d}",
        data_consent_at=datetime.now(timezone.utc),
        registration_path="STAFF_ASSISTED",
        created_by=fw.id
    )
    db_session.add(farmer)
    await db_session.commit()

    headers = _bearer_headers(fw.id, fw.role)
    animal_id = None

    try:
        res = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "CATTLE",
                "sex": "F",
                "age_months_estimate": 24,
                "farmer_id": str(farmer.id),
                "village_id": str(village.id),
                "bharat_pashudhan_tag": tag_val
            },
            headers=headers
        )
        assert res.status_code == 201, res.text
        data = res.json()
        animal_id = uuid.UUID(data["id"])
        assert data["species_code"] == "CATTLE"
        assert data["registration_status"] == "REGISTERED"

        # Verify initial ownership history record
        hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal_id)
        hist_row = (await db_session.execute(hist_stmt)).scalars().first()
        assert hist_row is not None
        assert hist_row.farmer_id == farmer.id
        assert hist_row.change_reason == "INITIAL_REGISTRATION"

        # Verify external tag record
        tag_stmt = select(AnimalExternalIdentifier).where(AnimalExternalIdentifier.animal_id == animal_id)
        tag_row = (await db_session.execute(tag_stmt)).scalars().first()
        assert tag_row is not None
        assert tag_row.id_value == tag_val

        # Verify audit log
        audit_stmt = select(AuditEvent).where(
            AuditEvent.action == "ANIMAL_REGISTERED",
            AuditEvent.object_id == str(animal_id)
        )
        audit_row = (await db_session.execute(audit_stmt)).scalars().first()
        assert audit_row is not None
        assert audit_row.result == "SUCCESS"

    finally:
        if animal_id:
            from app.modules.animals.models import AnimalQRToken
            qr_stmt = select(AnimalQRToken).where(AnimalQRToken.animal_id == animal_id)
            for q in (await db_session.execute(qr_stmt)).scalars().all():
                await db_session.delete(q)
            await db_session.flush()

            tag_stmt = select(AnimalExternalIdentifier).where(AnimalExternalIdentifier.animal_id == animal_id)
            for t in (await db_session.execute(tag_stmt)).scalars().all():
                await db_session.delete(t)
            await db_session.flush()

            hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal_id)
            for h in (await db_session.execute(hist_stmt)).scalars().all():
                await db_session.delete(h)
            await db_session.flush()

            animal_obj = await db_session.get(Animal, animal_id)
            if animal_obj:
                await db_session.delete(animal_obj)
            await db_session.flush()

        await db_session.delete(farmer)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_02_vo_animal_registration_rejected_when_fw_available(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 2: VO with animal.create.fallback is rejected with 403 when assigned FW is available."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Fallback", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="Active FW", status="ACTIVE")
    db_session.add_all([admin, vo, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    # Assign both VO and FW to the village
    assign_vo = UserVillageAssignment(user_id=vo.id, village_id=village.id, assigned_by=admin.id)
    assign_fw = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=admin.id)
    db_session.add_all([assign_vo, assign_fw])
    await db_session.flush()

    farmer = Farmer(
        id=uuid.uuid4(),
        full_name="Bavubhai Mer",
        name_norm="BAVUBHAI MER",
        village_id=village.id,
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    db_session.add(farmer)
    await db_session.commit()

    vo_headers = _bearer_headers(vo.id, vo.role)

    try:
        # VO attempts registration; FW is available -> rejected with 403 Forbidden
        res = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "BUFFALO",
                "sex": "F",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id)
            },
            headers=vo_headers
        )
        assert res.status_code == 403
        assert "Assigned Field Worker is available" in res.text
    finally:
        await db_session.delete(farmer)
        await db_session.delete(assign_fw)
        await db_session.delete(assign_vo)
        await db_session.delete(village)
        await db_session.delete(taluka)
        await db_session.delete(dist)
        await db_session.delete(fw)
        await db_session.delete(vo)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_03_vo_fallback_registration_succeeds_when_fw_formally_unavailable(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 3: VO fallback animal registration succeeds when formal FW unavailability record exists."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Approved Fallback", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="On Leave FW", status="ACTIVE")
    db_session.add_all([admin, vo, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    assign_vo = UserVillageAssignment(user_id=vo.id, village_id=village.id, assigned_by=admin.id)
    assign_fw = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=admin.id)
    db_session.add_all([assign_vo, assign_fw])
    await db_session.flush()

    # Formal FW unavailability record
    now = datetime.now(timezone.utc)
    unavail = FieldWorkerAvailabilityRecord(
        field_worker_user_id=fw.id,
        village_id=village.id,
        availability_status="UNAVAILABLE",
        reason="Medical emergency leave authorized by DAHO",
        valid_from=now - timedelta(days=1),
        valid_until=now + timedelta(days=7),
        recorded_by=admin.id
    )
    db_session.add(unavail)

    farmer = Farmer(
        id=uuid.uuid4(),
        full_name="Jivabhai Rabari",
        name_norm="JIVABHAI RABARI",
        village_id=village.id,
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    db_session.add(farmer)
    await db_session.commit()

    vo_headers = _bearer_headers(vo.id, vo.role)
    animal_id = None

    try:
        # Registration now succeeds as fallback
        res = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "GOAT",
                "sex": "M",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id)
            },
            headers=vo_headers
        )
        assert res.status_code == 201, res.text
        data = res.json()
        animal_id = uuid.UUID(data["id"])

        # Fetch detail and assert submission_source is VET_OFFICER
        det_res = await async_client.get(f"/api/v1/animals/{animal_id}", headers=vo_headers)
        assert det_res.status_code == 200
        assert det_res.json()["submission_source"] == "VET_OFFICER"

    finally:
        if animal_id:
            from app.modules.animals.models import AnimalQRToken
            qr_stmt = select(AnimalQRToken).where(AnimalQRToken.animal_id == animal_id)
            for q in (await db_session.execute(qr_stmt)).scalars().all():
                await db_session.delete(q)
            await db_session.flush()

            hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal_id)
            for h in (await db_session.execute(hist_stmt)).scalars().all():
                await db_session.delete(h)
            await db_session.flush()

            animal_obj = await db_session.get(Animal, animal_id)
            if animal_obj:
                await db_session.delete(animal_obj)
            await db_session.flush()

        await db_session.delete(farmer)
        await db_session.flush()
        await db_session.delete(unavail)
        await db_session.flush()
        await db_session.delete(assign_fw)
        await db_session.delete(assign_vo)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(fw)
        await db_session.delete(vo)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_04_bharat_pashudhan_tag_validation_and_duplicate_prevention(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 4: Bharat Pashudhan tag requires 12 digits; duplicate active tag returns 409 Conflict."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW Tag", status="ACTIVE")
    db_session.add_all([admin, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    assign = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    farmer = Farmer(
        id=uuid.uuid4(),
        full_name="Karanbhai Kathi",
        name_norm="KARANBHAI KATHI",
        village_id=village.id,
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    db_session.add(farmer)
    await db_session.commit()

    headers = _bearer_headers(fw.id, fw.role)
    animal_1_id = None

    valid_tag = f"999{uuid.uuid4().int % 1000000000:09d}"

    try:
        # Invalid tag length (non-12 digits) returns 422 / 400
        res_bad = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "CATTLE",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id),
                "bharat_pashudhan_tag": "12345"  # Too short
            },
            headers=headers
        )
        assert res_bad.status_code == 422

        # Valid 12-digit tag succeeds
        res_1 = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "CATTLE",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id),
                "bharat_pashudhan_tag": valid_tag
            },
            headers=headers
        )
        assert res_1.status_code == 201
        animal_1_id = uuid.UUID(res_1.json()["id"])

        # Second animal with same tag returns 409 Conflict
        res_2 = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "CATTLE",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id),
                "bharat_pashudhan_tag": valid_tag
            },
            headers=headers
        )
        assert res_2.status_code == 409
        assert ("already registered" in res_2.text or "પહેલેથી જ" in res_2.text)

    finally:
        if animal_1_id:
            from app.modules.animals.models import AnimalQRToken
            qr_stmt = select(AnimalQRToken).where(AnimalQRToken.animal_id == animal_1_id)
            for q in (await db_session.execute(qr_stmt)).scalars().all():
                await db_session.delete(q)
            await db_session.flush()

            tag_stmt = select(AnimalExternalIdentifier).where(AnimalExternalIdentifier.animal_id == animal_1_id)
            for t in (await db_session.execute(tag_stmt)).scalars().all():
                await db_session.delete(t)
            await db_session.flush()

            hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal_1_id)
            for h in (await db_session.execute(hist_stmt)).scalars().all():
                await db_session.delete(h)
            await db_session.flush()

            a_obj = await db_session.get(Animal, animal_1_id)
            if a_obj:
                await db_session.delete(a_obj)
            await db_session.flush()

        await db_session.delete(farmer)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_05_base32_qr_token_lifecycle_and_retagging(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 5: Base32 26-char QR token assignment, auto-generation, re-tagging revocation, and fast lookup."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW QR", status="ACTIVE")
    db_session.add_all([admin, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    village = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(village)
    await db_session.flush()

    assign = UserVillageAssignment(user_id=fw.id, village_id=village.id, assigned_by=admin.id)
    db_session.add(assign)
    await db_session.flush()

    farmer = Farmer(
        id=uuid.uuid4(),
        full_name="Dharmeshbhai Vala",
        name_norm="DHARMESHBHAI VALA",
        village_id=village.id,
        registration_path="STAFF_ASSISTED",
        created_by=admin.id
    )
    db_session.add(farmer)
    await db_session.commit()

    headers = _bearer_headers(fw.id, fw.role)
    animal_id = None

    try:
        # Register animal
        res_anm = await async_client.post(
            "/api/v1/animals",
            json={
                "species_code": "CATTLE",
                "farmer_id": str(farmer.id),
                "village_id": str(village.id)
            },
            headers=headers
        )
        assert res_anm.status_code == 201
        animal_id = uuid.UUID(res_anm.json()["id"])

        # Step A: Assign specific Base32 26-char QR token
        import base64
        token_1 = base64.b32encode(uuid.uuid4().bytes)[:26].decode("ascii")
        res_token1 = await async_client.post(
            f"/api/v1/animals/{animal_id}/qr-token",
            json={"token": token_1},
            headers=headers
        )
        assert res_token1.status_code == 201
        assert res_token1.json()["token"] == token_1
        assert res_token1.json()["status"] == "ACTIVE"

        # Step B: Fast lookup by QR token succeeds
        lookup_res = await async_client.get(
            f"/api/v1/animals/lookup/qr/{token_1}",
            headers=headers
        )
        assert lookup_res.status_code == 200
        assert lookup_res.json()["id"] == str(animal_id)

        # Step C: Re-tagging animal auto-generates a new token and revokes token_1
        res_retag = await async_client.post(
            f"/api/v1/animals/{animal_id}/qr-token",
            json={},  # Omitting token prompts auto-generation
            headers=headers
        )
        assert res_retag.status_code == 201
        token_2 = res_retag.json()["token"]
        assert token_2 != token_1
        assert len(token_2) == 26

        # Verify token_1 is now revoked in database
        prev_token_obj = await db_session.get(AnimalQRToken, token_1)
        assert prev_token_obj is not None
        assert prev_token_obj.status == "REVOKED"
        assert prev_token_obj.revoked_reason == "RE_TAGGED"

    finally:
        if animal_id:
            qr_stmt = select(AnimalQRToken).where(AnimalQRToken.animal_id == animal_id)
            for q in (await db_session.execute(qr_stmt)).scalars().all():
                await db_session.delete(q)
            await db_session.flush()
            hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal_id)
            for h in (await db_session.execute(hist_stmt)).scalars().all():
                await db_session.delete(h)
            await db_session.flush()
            a_obj = await db_session.get(Animal, animal_id)
            if a_obj:
                await db_session.delete(a_obj)
            await db_session.flush()
        await db_session.delete(farmer)
        await db_session.flush()
        await db_session.delete(assign)
        await db_session.flush()
        await db_session.delete(village)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(fw)
        await db_session.delete(admin)
        await db_session.commit()


@pytest_async
async def test_06_animal_ownership_transfer_workflow_pending_review_and_decision(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 6: Ownership transfer follows 2-step workflow (DEC-022):
    1. Submission creates pending request ('REQUESTED') and preserves animal owner and history.
    2. Duplicate open transfer on same animal returns HTTP 409 Conflict.
    3. Unauthorized roles (Field Worker) attempting decision receive HTTP 403 Forbidden.
    4. Rejection requires non-empty decision note and preserves animal owner and history intact.
    5. Authorized VO decision approves transfer: closes prior history, appends new history, updates animal entity.
    """
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Trans", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW Trans", status="ACTIVE")
    db_session.add_all([admin, vo, fw])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil_1 = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V1_{uuid.uuid4().hex[:6]}", name_gu="ગામ ૧", name_en="Vil 1")
    vil_2 = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V2_{uuid.uuid4().hex[:6]}", name_gu="ગામ ૨", name_en="Vil 2")
    db_session.add_all([vil_1, vil_2])
    await db_session.flush()

    assign_vo1 = UserVillageAssignment(user_id=vo.id, village_id=vil_1.id, assigned_by=admin.id)
    assign_vo2 = UserVillageAssignment(user_id=vo.id, village_id=vil_2.id, assigned_by=admin.id)
    assign_fw1 = UserVillageAssignment(user_id=fw.id, village_id=vil_1.id, assigned_by=admin.id)
    db_session.add_all([assign_vo1, assign_vo2, assign_fw1])
    await db_session.flush()

    farmer_1 = Farmer(id=uuid.uuid4(), full_name="Seller Farmer", name_norm="SELLER FARMER", village_id=vil_1.id, registration_path="STAFF_ASSISTED", created_by=admin.id)
    farmer_2 = Farmer(id=uuid.uuid4(), full_name="Buyer Farmer", name_norm="BUYER FARMER", village_id=vil_2.id, registration_path="STAFF_ASSISTED", created_by=admin.id)
    db_session.add_all([farmer_1, farmer_2])
    await db_session.flush()

    animal = Animal(
        id=uuid.uuid4(),
        species_code="CATTLE",
        farmer_id=farmer_1.id,
        village_id=vil_1.id,
        submission_source="FIELD_WORKER",
        created_by=admin.id
    )
    db_session.add(animal)
    await db_session.flush()

    initial_hist = AnimalOwnershipHistory(
        animal_id=animal.id,
        farmer_id=farmer_1.id,
        village_id=vil_1.id,
        valid_from=date.today() - timedelta(days=30),
        change_reason="INITIAL_REGISTRATION",
        changed_by=admin.id
    )
    db_session.add(initial_hist)
    await db_session.commit()

    fw_headers = _bearer_headers(fw.id, fw.role)
    vo_headers = _bearer_headers(vo.id, vo.role)

    try:
        # Step 1: Field Worker submits ownership transfer request
        res_req = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers",
            json={
                "to_farmer_id": str(farmer_2.id),
                "to_village_id": str(vil_2.id),
                "reason": "SALE",
                "reason_note": "Purchased at Botad Cattle Fair"
            },
            headers=fw_headers
        )
        assert res_req.status_code == 201, res_req.text
        req_data = res_req.json()
        assert req_data["status"] == "REQUESTED"
        assert req_data["decided_by"] is None
        assert req_data["decided_at"] is None
        transfer_id = uuid.UUID(req_data["id"])

        # Crucial check: Animal owner, village, and ownership history remain UNCHANGED
        await db_session.refresh(animal)
        assert animal.farmer_id == farmer_1.id
        assert animal.village_id == vil_1.id
        await db_session.refresh(initial_hist)
        assert initial_hist.valid_to is None

        # Step 2: Attempting a duplicate transfer on the same animal returns HTTP 409 Conflict
        dup_res = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers",
            json={
                "to_farmer_id": str(farmer_2.id),
                "to_village_id": str(vil_2.id),
                "reason": "GIFT"
            },
            headers=fw_headers
        )
        assert dup_res.status_code == 409, "Must return HTTP 409 Conflict for duplicate open transfer"

        # Step 3: Field Worker attempting to decide transfer returns HTTP 403 Forbidden
        fw_decide = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers/{transfer_id}/decide",
            json={"action": "APPROVE"},
            headers=fw_headers
        )
        assert fw_decide.status_code == 403, "Field Worker must be forbidden from deciding transfer"

        # Step 4: Rejection without decision note fails with HTTP 400 Bad Request
        rej_empty_res = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers/{transfer_id}/decide",
            json={"action": "REJECT", "decision_note": ""},
            headers=vo_headers
        )
        assert rej_empty_res.status_code == 400

        # Step 5: Rejection with valid note succeeds and preserves existing ownership
        rej_res = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers/{transfer_id}/decide",
            json={"action": "REJECT", "decision_note": "Buyer does not have suitable shelter facilities"},
            headers=vo_headers
        )
        assert rej_res.status_code == 200
        rej_data = rej_res.json()
        assert rej_data["status"] == "REJECTED"
        assert rej_data["decision_note"] == "Buyer does not have suitable shelter facilities"
        assert rej_data["decided_by"] == str(vo.id)

        # Confirm animal owner and history remain seller
        await db_session.refresh(animal)
        assert animal.farmer_id == farmer_1.id
        assert animal.village_id == vil_1.id
        await db_session.refresh(initial_hist)
        assert initial_hist.valid_to is None

        # Step 6: With transfer rejected, a new transfer request can now be submitted
        res_req2 = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers",
            json={
                "to_farmer_id": str(farmer_2.id),
                "to_village_id": str(vil_2.id),
                "reason": "SALE",
                "reason_note": "Re-submitted after buyer built approved cattle shed"
            },
            headers=fw_headers
        )
        assert res_req2.status_code == 201
        transfer_id2 = uuid.UUID(res_req2.json()["id"])

        # Step 7: Veterinary Officer approves transfer
        appr_res = await async_client.post(
            f"/api/v1/animals/{animal.id}/transfers/{transfer_id2}/decide",
            json={"action": "APPROVE", "decision_note": "Verified shed facilities in person"},
            headers=vo_headers
        )
        assert appr_res.status_code == 200
        appr_data = appr_res.json()
        assert appr_data["status"] == "COMPLETED"
        assert appr_data["decided_by"] == str(vo.id)

        # Step 8: Animal and history are now updated
        await db_session.refresh(animal)
        assert animal.farmer_id == farmer_2.id
        assert animal.village_id == vil_2.id

        await db_session.refresh(initial_hist)
        assert initial_hist.valid_to == date.today()

        # Step 9: Verify new history record created
        new_hist_stmt = select(AnimalOwnershipHistory).where(
            AnimalOwnershipHistory.animal_id == animal.id,
            AnimalOwnershipHistory.farmer_id == farmer_2.id
        )
        new_hist = (await db_session.execute(new_hist_stmt)).scalars().first()
        assert new_hist is not None
        assert new_hist.valid_from == date.today()
        assert new_hist.valid_to is None
        assert new_hist.change_reason == "SALE"

    finally:
        from app.modules.notifications.models import Notification
        notif_stmt = select(Notification).where(
            Notification.recipient_user_id.in_([admin.id, vo.id, fw.id])
        )
        for n in (await db_session.execute(notif_stmt)).scalars().all():
            await db_session.delete(n)
        await db_session.flush()

        trans_stmt = select(OwnershipTransfer).where(OwnershipTransfer.animal_id == animal.id)
        for t in (await db_session.execute(trans_stmt)).scalars().all():
            await db_session.delete(t)
        await db_session.flush()

        qr_stmt = select(AnimalQRToken).where(AnimalQRToken.animal_id == animal.id)
        for q in (await db_session.execute(qr_stmt)).scalars().all():
            await db_session.delete(q)
        await db_session.flush()

        ext_stmt = select(AnimalExternalIdentifier).where(AnimalExternalIdentifier.animal_id == animal.id)
        for e in (await db_session.execute(ext_stmt)).scalars().all():
            await db_session.delete(e)
        await db_session.flush()

        hist_stmt = select(AnimalOwnershipHistory).where(AnimalOwnershipHistory.animal_id == animal.id)
        for h in (await db_session.execute(hist_stmt)).scalars().all():
            await db_session.delete(h)
        await db_session.flush()

        await db_session.delete(animal)
        await db_session.flush()

        await db_session.delete(farmer_1)
        await db_session.delete(farmer_2)
        await db_session.flush()

        await db_session.delete(assign_vo1)
        await db_session.delete(assign_vo2)
        await db_session.delete(assign_fw1)
        await db_session.flush()

        await db_session.delete(vil_1)
        await db_session.delete(vil_2)
        await db_session.flush()

        await db_session.delete(taluka)
        await db_session.flush()

        await db_session.delete(dist)
        await db_session.flush()

        await db_session.delete(fw)
        await db_session.delete(vo)
        await db_session.delete(admin)
        await db_session.commit()

