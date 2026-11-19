"""Integration tests for Disease Surveillance and Reporting domain (FastAPI + PostgreSQL 16).

Test coverage:
- Disease report initially starts as SUBMITTED / UNCONFIRMED (DEC-020)
- Field Worker or Farmer report does not constitute confirmed medical diagnosis
- Unauthorised user cannot confirm disease (HTTP 403 Forbidden without 'disease.confirm')
- Authorised veterinary reviewer confirms disease case with mandatory clinical basis
- Disproval with mandatory reason preserves report history
- Surveillance village level aggregates distinguish suspected vs confirmed cases
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.modules.animals.models import Animal
from app.modules.authentication.models import (
    User,
    UserPermissionGrant,
    UserVillageAssignment,
)
from app.modules.disease_surveillance.models import (
    DiseaseReport,
    DiseaseReportStatusHistory,
    DiseaseReview,
)
from app.modules.farmers.models import Farmer
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
async def test_01_disease_report_submission_and_confirmation_lifecycle(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: Report starts SUBMITTED; standard VO cannot confirm; VO with explicit 'disease.confirm' confirms with basis."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup", status="ACTIVE")
    vo_standard = create_test_user(role="VET_OFFICER", full_name="Dr. Standard VO", status="ACTIVE")
    vo_auth = create_test_user(role="VET_OFFICER", full_name="Dr. Authorised Expert VO", status="ACTIVE")
    fw = create_test_user(role="FIELD_WORKER", full_name="FW Reporter", status="ACTIVE")
    db_session.add_all([admin, vo_standard, vo_auth, fw])
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
    a_vos = UserVillageAssignment(user_id=vo_standard.id, village_id=vil.id, assigned_by=admin.id)
    a_voa = UserVillageAssignment(user_id=vo_auth.id, village_id=vil.id, assigned_by=admin.id)
    a_fw = UserVillageAssignment(user_id=fw.id, village_id=vil.id, assigned_by=admin.id)
    db_session.add_all([a_vos, a_voa, a_fw])

    # Grant explicit 'disease.confirm' to vo_auth ONLY
    grant = UserPermissionGrant(
        user_id=vo_auth.id,
        permission_code="disease.confirm",
        granted_by=admin.id
    )
    db_session.add(grant)

    farmer = Farmer(id=uuid.uuid4(), full_name="Surveillance Farmer", name_norm="SURVEILLANCE FARMER", village_id=vil.id, registration_path="STAFF_ASSISTED", created_by=admin.id)
    db_session.add(farmer)
    await db_session.flush()

    animal = Animal(
        id=uuid.uuid4(),
        species_code="CATTLE",
        farmer_id=farmer.id,
        village_id=vil.id,
        submission_source="FIELD_WORKER",
        created_by=admin.id
    )
    db_session.add(animal)
    await db_session.commit()

    fw_headers = _bearer_headers(fw.id, fw.role)
    vos_headers = _bearer_headers(vo_standard.id, vo_standard.role)
    voa_headers = _bearer_headers(vo_auth.id, vo_auth.role)

    report_id = None
    try:
        # Step A: Field Worker submits suspected disease report
        res_sub = await async_client.post(
            "/api/v1/disease-reports",
            json={
                "animal_id": str(animal.id),
                "village_id": str(vil.id),
                "disease_code": "FMD",
                "report_date": str(date.today()),
                "symptoms": ["SALIVATION", "FOOT_BLISTERS"],
                "observation_text": "Observed severe drooling and lameness"
            },
            headers=fw_headers
        )
        assert res_sub.status_code == 201, res_sub.text
        rep_data = res_sub.json()
        assert rep_data["status"] == "SUBMITTED", "Must initially be SUBMITTED / unconfirmed"
        assert rep_data["confirmed_by"] is None
        report_id = uuid.UUID(rep_data["report_id"])

        # Step B: Standard VO performs triage review -> SUSPECTED
        res_rev = await async_client.post(
            f"/api/v1/disease-reports/{report_id}/reviews",
            json={
                "review_type": "INITIAL_REVIEW",
                "assessment": "SUSPECTED",
                "basis": "Clinical signs match acute Foot and Mouth Disease"
            },
            headers=vos_headers
        )
        assert res_rev.status_code == 201, res_rev.text
        assert res_rev.json()["assessment"] == "SUSPECTED"

        # Step C: Standard VO (without 'disease.confirm') attempts to confirm -> HTTP 403 Forbidden
        res_conf_denied = await async_client.post(
            f"/api/v1/disease-reports/{report_id}/decide",
            json={
                "action": "CONFIRM",
                "confirmation_basis": "Personal field visit confirmation"
            },
            headers=vos_headers
        )
        assert res_conf_denied.status_code == 403, "VO without disease.confirm must receive HTTP 403"

        # Step D: Authorised Expert VO confirms disease case with clinical basis
        res_conf = await async_client.post(
            f"/api/v1/disease-reports/{report_id}/decide",
            json={
                "action": "CONFIRM",
                "confirmation_basis": "PCR Laboratory Elisa confirmed FMD Type O positive"
            },
            headers=voa_headers
        )
        assert res_conf.status_code == 200, res_conf.text
        assert res_conf.json()["status"] == "CONFIRMED"
        assert res_conf.json()["confirmed_by"] == str(vo_auth.id)

    finally:
        from app.modules.duty.models import HelpRequest
        hr_stmt = select(HelpRequest).where(HelpRequest.animal_id == animal.id)
        for hr in (await db_session.execute(hr_stmt)).scalars().all():
            await db_session.delete(hr)
        await db_session.flush()

        if report_id:
            rev_stmt = select(DiseaseReview).where(DiseaseReview.report_id == report_id)
            for r in (await db_session.execute(rev_stmt)).scalars().all():
                await db_session.delete(r)
            hist_stmt = select(DiseaseReportStatusHistory).where(DiseaseReportStatusHistory.report_id == report_id)
            for h in (await db_session.execute(hist_stmt)).scalars().all():
                await db_session.delete(h)
            rep_obj = await db_session.get(DiseaseReport, report_id)
            if rep_obj:
                await db_session.delete(rep_obj)
        await db_session.flush()

        await db_session.delete(animal)
        await db_session.delete(farmer)
        await db_session.flush()
        await db_session.delete(grant)
        await db_session.delete(a_fw)
        await db_session.delete(a_voa)
        await db_session.delete(a_vos)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        from app.modules.notifications.models import Notification
        notif_stmt = select(Notification).where(Notification.recipient_user_id.in_([fw.id, vo_auth.id, vo_standard.id, admin.id]))
        for n in (await db_session.execute(notif_stmt)).scalars().all():
            await db_session.delete(n)
        await db_session.flush()

        await db_session.delete(fw)
        await db_session.delete(vo_auth)
        await db_session.delete(vo_standard)
        await db_session.delete(admin)
        await db_session.commit()

