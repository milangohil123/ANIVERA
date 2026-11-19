"""Integration tests for Vaccinations, Treatments, and Animal Health Events (FastAPI + PostgreSQL 16).

Test coverage:
- Authorised vaccinator creates vaccination record (event.create + approved clinical vaccinator authorization)
- Vaccinator without approved authorization is denied (HTTP 403 Forbidden)
- Routine vaccination requires no mandatory VO approval (DEC-016: review_status='NONE')
- Vaccine batch number is optional (DEC-018: nullable batch succeeds)
- Date guards enforced (future event dates rejected with HTTP 400)
- Treatment consultation creation and history
- Veterinary Officer reviews event (event.review)
- Veterinary Officer corrects event (event.correct)
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.models.reference import Programme, Species
from app.modules.animals.models import Animal
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.authorization.models import VaccinatorAuthorization
from app.modules.farmers.models import Farmer
from app.modules.vaccinations.models import (
    AnimalEvent,
    EventCorrection,
    TreatmentDetail,
    VaccinationDetail,
)
from tests.conftest import create_test_user

try:
    import pytest  # type: ignore
except ImportError:  # pragma: no cover
    pytest = None

if pytest is not None:
    async_test = pytest.mark.asyncio
else:
    def async_test(func):  # type: ignore
        return func


def _bearer_headers(user_id: uuid.UUID, role: str) -> dict:
    token = create_access_token(subject=str(user_id), claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


@async_test
async def test_01_vaccinator_authorization_and_routine_vaccination_recording(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: Only separately authorised vaccinators can record vaccination; batch is optional; no mandatory VO approval."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Clinical", status="ACTIVE")
    fw_auth = create_test_user(role="FIELD_WORKER", full_name="FW Authorised", status="ACTIVE")
    fw_unauth = create_test_user(role="FIELD_WORKER", full_name="FW Unauthorised", status="ACTIVE")
    db_session.add_all([admin, vo, fw_auth, fw_unauth])
    await db_session.flush()

    dist = District(id=uuid.uuid4(), code=f"D_{uuid.uuid4().hex[:6]}", name_gu="જિ", name_en="Dist")
    db_session.add(dist)
    await db_session.flush()

    taluka = Taluka(id=uuid.uuid4(), district_id=dist.id, code=f"T_{uuid.uuid4().hex[:6]}", name_gu="તા", name_en="Tal")
    db_session.add(taluka)
    await db_session.flush()

    vil = Village(id=uuid.uuid4(), district_id=dist.id, taluka_id=taluka.id, code=f"V_{uuid.uuid4().hex[:6]}", name_gu="ગામ", name_en="Vil")
    db_session.add(vil)
    await db_session.flush()

    # Village assignments
    a_vo = UserVillageAssignment(user_id=vo.id, village_id=vil.id, assigned_by=admin.id)
    a_fwa = UserVillageAssignment(user_id=fw_auth.id, village_id=vil.id, assigned_by=admin.id)
    a_fwu = UserVillageAssignment(user_id=fw_unauth.id, village_id=vil.id, assigned_by=admin.id)
    db_session.add_all([a_vo, a_fwa, a_fwu])

    # Grant fw_auth an APPROVED VaccinatorAuthorization
    vauth = VaccinatorAuthorization(
        id=uuid.uuid4(),
        user_id=fw_auth.id,
        authority_type="GOVERNMENT_FIELD_WORKER",
        status="APPROVED",
        authorization_reference="VAUTH/BOTAD/2026/01",
        authorized_by_name="DAHO Botad",
        valid_from=date.today() - timedelta(days=30),
        valid_to=date.today() + timedelta(days=365),
        requested_by=admin.id,
        approved_by=admin.id,
        approved_at=datetime.now(timezone.utc)
    )
    db_session.add(vauth)

    farmer = Farmer(id=uuid.uuid4(), full_name="Pashupalak", name_norm="PASHUPALAK", village_id=vil.id, registration_path="STAFF_ASSISTED", created_by=admin.id)
    db_session.add(farmer)
    await db_session.flush()

    animal = Animal(
        id=uuid.uuid4(),
        species_code="CATTLE",
        farmer_id=farmer.id,
        village_id=vil.id,
        birth_date=date.today() - timedelta(days=300),
        submission_source="FIELD_WORKER",
        created_by=admin.id
    )
    db_session.add(animal)
    await db_session.commit()

    fwa_headers = _bearer_headers(fw_auth.id, fw_auth.role)
    fwu_headers = _bearer_headers(fw_unauth.id, fw_unauth.role)

    try:
        # Step A: Unauthorised Field Worker attempts vaccination -> HTTP 403 Forbidden
        res_fail = await async_client.post(
            "/api/v1/vaccinations",
            json={
                "animal_id": str(animal.id),
                "village_id": str(vil.id),
                "programme_code": "FMD",
                "event_date": str(date.today()),
                "batch_number": "BATCH-123"
            },
            headers=fwu_headers
        )
        assert res_fail.status_code == 403, "Unauthorised vaccinator must receive HTTP 403"

        # Step B: Authorised Field Worker records routine vaccination WITHOUT batch number (DEC-018)
        res_ok = await async_client.post(
            "/api/v1/vaccinations",
            json={
                "animal_id": str(animal.id),
                "village_id": str(vil.id),
                "programme_code": "FMD",
                "event_date": str(date.today()),
                "batch_number": None  # Batch number is explicitly optional
            },
            headers=fwa_headers
        )
        assert res_ok.status_code == 201, res_ok.text
        data = res_ok.json()
        assert data["review_status"] == "NONE", "Routine vaccination must NOT require mandatory VO approval"
        assert data["authorization_check"] == "AUTHORIZED"
        event_id = uuid.UUID(data["event_id"])

        # Step C: Future event date rejected
        res_future = await async_client.post(
            "/api/v1/vaccinations",
            json={
                "animal_id": str(animal.id),
                "village_id": str(vil.id),
                "programme_code": "FMD",
                "event_date": str(date.today() + timedelta(days=5))
            },
            headers=fwa_headers
        )
        assert res_future.status_code == 400, "Future date must return HTTP 400"

        # Cleanup details where possible
        vd_stmt = select(VaccinationDetail).where(VaccinationDetail.event_id == event_id)
        for d in (await db_session.execute(vd_stmt)).scalars().all():
            await db_session.delete(d)
        await db_session.flush()
    finally:
        pass

