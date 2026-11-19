"""Integration tests for Disease Report Registration & Offline Synchronization (FastAPI + PostgreSQL 16).

Verifies Step 8.2 requirements:
1. Valid UUIDs: Disease report with valid village, animal, and farmer records is accepted (HTTP 200, ACCEPTED).
2. Optional null fields: animal_id and farmer_id can be null or omitted; report is successfully accepted.
3. Invalid UUID formats: Non-UUID strings (e.g. tag strings, names) are rejected with INVALID_UUID_FORMAT (never generic PROCESSING_ERROR).
4. Nonexistent foreign keys: Nonexistent village, animal, and farmer records return VILLAGE_NOT_FOUND, ANIMAL_NOT_FOUND, FARMER_NOT_FOUND.
5. Cross-village authorization: Reports submitted outside the user's assigned village scope return FORBIDDEN_SCOPE.
6. Safe retry and idempotency: Retrying a previously rejected event with a corrected payload updates the receipt to ACCEPTED,
   does not throw primary key violations, and subsequent submissions return ALREADY_ACCEPTED.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.modules.animals.models import Animal
from app.modules.authentication.models import Device, RefreshToken, User, UserVillageAssignment
from app.modules.disease_surveillance.models import DiseaseReport
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


async def _setup_geography_and_worker(
    db: AsyncSession,
    role: str = "FIELD_WORKER"
) -> tuple[User, Device, District, Taluka, Village, UserVillageAssignment]:
    """Helper to provision test geography, device, and authenticated worker in isolated test db.
    
    Enforces check constraint 'villages_check1':
    When latitude and longitude are NULL, coord_status must be 'UNAVAILABLE'.
    """
    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિલ્લો", name_en="District")
    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તાલુકો", name_en="Taluka")
    village = Village(
        id=uuid.uuid4(),
        district_id=dist.id,
        taluka_id=taluka.id,
        code=f"V_{uuid.uuid4().hex[:6]}",
        name_gu="ગામ",
        name_en="Village",
        coord_status="UNAVAILABLE",
        is_pilot=True,
        active=True
    )
    db.add_all([dist, taluka, village])
    await db.flush()

    worker = create_test_user(
        role=role,
        full_name="Dr. Test Worker",
        status="ACTIVE",
        must_change_password=False
    )
    db.add(worker)
    await db.flush()

    assignment = UserVillageAssignment(user_id=worker.id, village_id=village.id, assigned_by=worker.id)
    device = Device(id=uuid.uuid4(), user_id=worker.id, label="Test Field Device", status="ACTIVE")
    db.add_all([assignment, device])
    await db.commit()

    return worker, device, dist, taluka, village, assignment


async def _cleanup_worker_hierarchy(
    db: AsyncSession,
    worker_id: uuid.UUID,
    extra_entities: list = None
) -> None:
    """Safe teardown removing only test entities created during execution."""
    try:
        # 1. Disease reports
        reports = (await db.execute(select(DiseaseReport).where(DiseaseReport.reported_by == worker_id))).scalars().all()
        for r in reports:
            await db.delete(r)
        await db.flush()

        # 2. Sync receipts and batches
        rcpts = (await db.execute(select(SyncReceipt).where(SyncReceipt.user_id == worker_id))).scalars().all()
        for rc in rcpts:
            await db.delete(rc)
        await db.flush()

        batches = (await db.execute(select(SyncBatch).where(SyncBatch.user_id == worker_id))).scalars().all()
        for b in batches:
            await db.delete(b)
        await db.flush()

        # 3. Extra custom entities (animals, farmers, unassigned villages)
        if extra_entities:
            for entity in extra_entities:
                try:
                    await db.delete(entity)
                except Exception:
                    pass
            await db.flush()

        # 4. Refresh tokens, assignments, and devices
        rts = (await db.execute(select(RefreshToken).where(RefreshToken.user_id == worker_id))).scalars().all()
        for rt in rts:
            await db.delete(rt)
        assignments = (await db.execute(select(UserVillageAssignment).where(UserVillageAssignment.user_id == worker_id))).scalars().all()
        for a in assignments:
            await db.delete(a)
        devices = (await db.execute(select(Device).where(Device.user_id == worker_id))).scalars().all()
        for d in devices:
            await db.delete(d)
        await db.flush()

        # 5. Worker user
        worker = await db.get(User, worker_id)
        if worker:
            await db.delete(worker)
        await db.commit()
    except Exception:
        await db.rollback()


@pytest_async
async def test_01_disease_report_valid_full_payload_accepted(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: Valid disease report with verified village, animal, farmer, and GPS is ACCEPTED."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)

    farmer = Farmer(
        id=uuid.uuid4(),
        village_id=village.id,
        full_name="Rameshbhai Patel",
        name_norm="rameshbhai patel",
        mobile_e164="+919876543210",
        registration_path="STAFF_ASSISTED",
        created_by=worker.id
    )
    db_session.add(farmer)
    await db_session.flush()

    animal = Animal(
        id=uuid.uuid4(),
        species_code="CATTLE",
        animal_code=f"ANM_{uuid.uuid4().hex[:6]}",
        farmer_id=farmer.id,
        village_id=village.id,
        submission_source="FIELD_WORKER",
        status="ACTIVE",
        registration_status="SUBMITTED",
        created_by=worker.id
    )
    db_session.add(animal)
    await db_session.commit()

    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    event_id = uuid.uuid4()

    try:
        payload = {
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [
                {
                    "eventId": str(event_id),
                    "type": "DISEASE_REPORT",
                    "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                    "payload": {
                        "village_id": str(village.id),
                        "animal_id": str(animal.id),
                        "farmer_id": str(farmer.id),
                        "disease_code": "FMD",
                        "report_date": date.today().isoformat(),
                        "symptoms": ["MOUTH_BLISTERS", "SALIVATION"],
                        "observation_text": "Cattle showing typical foot-and-mouth lesions.",
                        "latitude": 21.961234,
                        "longitude": 71.654321,
                    }
                }
            ]
        }

        headers = {"Authorization": f"Bearer {token}"}
        res = await async_client.post("/api/v1/sync/push", json=payload, headers=headers)
        assert res.status_code == 200, res.text

        body = res.json()
        assert body["acceptedCount"] == 1
        assert body["rejectedCount"] == 0
        assert body["results"][0]["status"] == "ACCEPTED"
        assert body["results"][0]["code"] == "SUCCESS"

        # Verify database persistence in disease_reports
        created_report = await db_session.get(DiseaseReport, event_id)
        assert created_report is not None
        assert created_report.village_id == village.id
        assert created_report.animal_id == animal.id
        assert created_report.farmer_id == farmer.id
        assert created_report.disease_code == "FMD"
        assert created_report.status == "SUBMITTED"
        assert created_report.latitude == Decimal("21.961234")
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[animal, farmer, village, taluka, dist])


@pytest_async
async def test_02_disease_report_optional_null_animal_and_farmer_accepted(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 2: Optional null animal_id and farmer_id are safely accepted."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)
    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    event_id = uuid.uuid4()

    try:
        payload = {
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [
                {
                    "eventId": str(event_id),
                    "type": "DISEASE_REPORT",
                    "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                    "payload": {
                        "village_id": str(village.id),
                        "animal_id": None,
                        "farmer_id": None,
                        "disease_code": "LSD",
                        "report_date": date.today().isoformat(),
                        "symptoms": ["SKIN_NODULES"],
                    }
                }
            ]
        }

        headers = {"Authorization": f"Bearer {token}"}
        res = await async_client.post("/api/v1/sync/push", json=payload, headers=headers)
        assert res.status_code == 200

        body = res.json()
        assert body["acceptedCount"] == 1
        assert body["results"][0]["status"] == "ACCEPTED"

        created_report = await db_session.get(DiseaseReport, event_id)
        assert created_report is not None
        assert created_report.animal_id is None
        assert created_report.farmer_id is None
        assert created_report.disease_code == "LSD"
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[village, taluka, dist])


@pytest_async
async def test_03_disease_report_invalid_uuid_formats_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 3: Malformed UUID values return INVALID_UUID_FORMAT (never generic PROCESSING_ERROR)."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)
    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Case A: Malformed village_id (e.g. tag or name string)
        event_id_a = uuid.uuid4()
        res_a = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(event_id_a),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": "botad-main-village",
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_a.status_code == 200
        ack_a = res_a.json()["results"][0]
        assert ack_a["status"] == "REJECTED"
        assert ack_a["code"] == "INVALID_UUID_FORMAT"

        # Case B: Malformed animal_id (e.g. ear tag string)
        event_id_b = uuid.uuid4()
        res_b = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(event_id_b),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "animal_id": "TAG-1234567890",
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_b.status_code == 200
        ack_b = res_b.json()["results"][0]
        assert ack_b["status"] == "REJECTED"
        assert ack_b["code"] == "INVALID_UUID_FORMAT"

        # Case C: Malformed farmer_id (e.g. farmer name)
        event_id_c = uuid.uuid4()
        res_c = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(event_id_c),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "farmer_id": "Ramesh Patel",
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_c.status_code == 200
        ack_c = res_c.json()["results"][0]
        assert ack_c["status"] == "REJECTED"
        assert ack_c["code"] == "INVALID_UUID_FORMAT"
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[village, taluka, dist])


@pytest_async
async def test_04_disease_report_nonexistent_records_rejected(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 4: Nonexistent foreign key records return specific meaningful rejection codes."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)
    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        # Case A: Nonexistent village
        random_village_id = uuid.uuid4()
        res_a = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(uuid.uuid4()),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(random_village_id),
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_a.status_code == 200
        ack_a = res_a.json()["results"][0]
        assert ack_a["status"] == "REJECTED"
        assert ack_a["code"] == "VILLAGE_NOT_FOUND"

        # Case B: Nonexistent animal
        random_animal_id = uuid.uuid4()
        res_b = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(uuid.uuid4()),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "animal_id": str(random_animal_id),
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_b.status_code == 200
        ack_b = res_b.json()["results"][0]
        assert ack_b["status"] == "REJECTED"
        assert ack_b["code"] == "ANIMAL_NOT_FOUND"

        # Case C: Nonexistent farmer
        random_farmer_id = uuid.uuid4()
        res_c = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(uuid.uuid4()),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "farmer_id": str(random_farmer_id),
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res_c.status_code == 200
        ack_c = res_c.json()["results"][0]
        assert ack_c["status"] == "REJECTED"
        assert ack_c["code"] == "FARMER_NOT_FOUND"
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[village, taluka, dist])


@pytest_async
async def test_05_disease_report_cross_village_scope_forbidden(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 5: Submitting disease reports outside worker's assigned village returns FORBIDDEN_SCOPE."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)

    # Create a second village that worker is NOT assigned to
    unassigned_village = Village(
        id=uuid.uuid4(),
        district_id=dist.id,
        taluka_id=taluka.id,
        code=f"V_{uuid.uuid4().hex[:6]}",
        name_gu="બીજું ગામ",
        name_en="Unassigned Village",
        coord_status="UNAVAILABLE",
        is_pilot=True,
        active=True
    )
    db_session.add(unassigned_village)
    await db_session.commit()

    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    headers = {"Authorization": f"Bearer {token}"}

    try:
        res = await async_client.post("/api/v1/sync/push", json={
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(uuid.uuid4()),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(unassigned_village.id),
                    "disease_code": "FMD",
                    "report_date": date.today().isoformat(),
                }
            }]
        }, headers=headers)
        assert res.status_code == 200
        ack = res.json()["results"][0]
        assert ack["status"] == "REJECTED"
        assert ack["code"] == "FORBIDDEN_SCOPE"
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[unassigned_village, village, taluka, dist])


@pytest_async
async def test_06_disease_report_safe_retry_and_idempotency(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 6: Safe retry after initial rejection transitions to ACCEPTED without duplicate errors."""
    worker, device, dist, taluka, village, assignment = await _setup_geography_and_worker(db_session)
    token = create_access_token(subject=str(worker.id), claims={"role": worker.role})
    headers = {"Authorization": f"Bearer {token}"}

    stable_event_id = uuid.uuid4()

    try:
        # Step A: Initial push with invalid non-UUID animal string -> REJECTED
        bad_payload = {
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(stable_event_id),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "animal_id": "NOT-A-UUID",
                    "disease_code": "BQ",
                    "report_date": date.today().isoformat(),
                }
            }]
        }
        res_1 = await async_client.post("/api/v1/sync/push", json=bad_payload, headers=headers)
        assert res_1.status_code == 200
        assert res_1.json()["rejectedCount"] == 1
        assert res_1.json()["results"][0]["status"] == "REJECTED"
        assert res_1.json()["results"][0]["code"] == "INVALID_UUID_FORMAT"

        # Verify no disease_reports record exists yet
        report_pre = await db_session.get(DiseaseReport, stable_event_id)
        assert report_pre is None

        # Step B: User corrects the report payload (removing the invalid string, leaving animal_id=None)
        # and retries with the SAME event_id
        corrected_payload = {
            "deviceId": str(device.id),
            "clientTime": datetime.now(timezone.utc).isoformat(),
            "events": [{
                "eventId": str(stable_event_id),
                "type": "DISEASE_REPORT",
                "clientCreatedAt": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "village_id": str(village.id),
                    "animal_id": None,
                    "disease_code": "BQ",
                    "report_date": date.today().isoformat(),
                }
            }]
        }
        res_2 = await async_client.post("/api/v1/sync/push", json=corrected_payload, headers=headers)
        assert res_2.status_code == 200
        body_2 = res_2.json()
        assert body_2["acceptedCount"] == 1
        assert body_2["rejectedCount"] == 0
        assert body_2["results"][0]["status"] == "ACCEPTED"
        assert body_2["results"][0]["code"] == "SUCCESS"

        # Verify report is now successfully created in disease_reports table
        report_post = await db_session.get(DiseaseReport, stable_event_id)
        assert report_post is not None
        assert report_post.disease_code == "BQ"

        # Step C: Replay the already accepted event (idempotency check)
        res_3 = await async_client.post("/api/v1/sync/push", json=corrected_payload, headers=headers)
        assert res_3.status_code == 200
        body_3 = res_3.json()
        assert body_3["alreadyAcceptedCount"] == 1
        assert body_3["results"][0]["status"] == "ALREADY_ACCEPTED"
        assert body_3["results"][0]["code"] == "IDEMPOTENT_DUPLICATE"
    finally:
        await _cleanup_worker_hierarchy(db_session, worker.id, extra_entities=[village, taluka, dist])
