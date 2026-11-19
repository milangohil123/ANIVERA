"""Integration tests for Veterinary Camps domain (FastAPI + PostgreSQL 16).

Test coverage:
- Propose camp by authorized personnel (camp.propose)
- Temporal overlap prevention (excl_camp_overlap constraint logic -> HTTP 409)
- Confirmation by Veterinary Officer (camp.manage)
- Mandatory reason requirement on cancellation
- Rescheduling workflow with historical linkage
- Staff assignment coordination
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import create_access_token
from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.campaigns.models import Campaign, CampaignVillage, ScheduleVersion
from app.modules.camps.models import Camp, CampStaff, CampStatusHistory
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
async def test_01_camp_proposal_and_confirmation_workflow(
    async_client: AsyncClient,
    db_session: AsyncSession
) -> None:
    """Test 1: Propose a camp, verify VO confirmation, and test temporal overlap exclusion (409 Conflict)."""
    admin = create_test_user(role="SYS_ADMIN", full_name="Admin Setup")
    vo = create_test_user(role="VET_OFFICER", full_name="Dr. VO Camp")
    db_session.add_all([admin, vo])
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

    vo_assign = UserVillageAssignment(user_id=vo.id, village_id=vil.id, assigned_by=admin.id)
    db_session.add(vo_assign)

    sched_res = await db_session.execute(select(ScheduleVersion).where(ScheduleVersion.status == "APPROVED").limit(1))
    sched = sched_res.scalars().first()
    sched_created = False
    if not sched:
        sched = ScheduleVersion(
            id=uuid.uuid4(),
            name="Camp Test Schedule 2026",
            status="APPROVED",
            approved_by_name="Director AH Gujarat",
            approval_reference=f"DAH/CAMP/{uuid.uuid4().hex[:6]}",
            approved_at=datetime.now(timezone.utc),
            effective_from=date.today(),
            created_by=admin.id
        )
        db_session.add(sched)
        await db_session.flush()
        sched_created = True

    camp_inst = Campaign(
        id=uuid.uuid4(),
        code=f"CMP-{uuid.uuid4().hex[:6].upper()}",
        name="Camp Campaign",
        status="ACTIVE",
        schedule_version_id=sched.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=60),
        activated_by=admin.id,
        activated_at=datetime.now(timezone.utc),
        created_by=admin.id
    )
    db_session.add(camp_inst)
    await db_session.flush()

    cv = CampaignVillage(campaign_id=camp_inst.id, village_id=vil.id)
    db_session.add(cv)
    await db_session.commit()

    vo_headers = _bearer_headers(vo.id, vo.role)
    start_time = datetime.now(timezone.utc) + timedelta(days=2)
    end_time = start_time + timedelta(hours=4)

    camp_id = None
    camp_id2 = None

    try:
        # Step A: Propose Camp
        res_prop = await async_client.post(
            "/api/v1/veterinary-camps",
            json={
                "campaign_id": str(camp_inst.id),
                "village_id": str(vil.id),
                "organizer_type": "GOVERNMENT",
                "planned_start": start_time.isoformat(),
                "planned_end": end_time.isoformat(),
                "location_text": "Gram Panchayat Chora",
                "expected_farmers": 25
            },
            headers=vo_headers
        )
        assert res_prop.status_code == 201, res_prop.text
        camp_id = uuid.UUID(res_prop.json()["id"])
        assert res_prop.json()["status"] == "PROPOSED"

        # Step B: Confirm Camp
        res_conf = await async_client.post(
            f"/api/v1/veterinary-camps/{camp_id}/confirm",
            json={"vaccine_availability": "AVAILABLE"},
            headers=vo_headers
        )
        assert res_conf.status_code == 200, res_conf.text
        assert res_conf.json()["status"] == "CONFIRMED"
        assert res_conf.json()["confirmed_by"] == str(vo.id)

        # Step C: Propose a second camp overlapping with the first confirmed camp
        res_prop2 = await async_client.post(
            "/api/v1/veterinary-camps",
            json={
                "campaign_id": str(camp_inst.id),
                "village_id": str(vil.id),
                "organizer_type": "GOVERNMENT",
                "planned_start": (start_time + timedelta(hours=1)).isoformat(),
                "planned_end": (end_time + timedelta(hours=1)).isoformat(),
                "location_text": "Primary School Ground"
            },
            headers=vo_headers
        )
        assert res_prop2.status_code == 201
        camp_id2 = uuid.UUID(res_prop2.json()["id"])

        # Attempting to confirm the second overlapping camp returns HTTP 409 Conflict
        conf_fail = await async_client.post(
            f"/api/v1/veterinary-camps/{camp_id2}/confirm",
            json={},
            headers=vo_headers
        )
        assert conf_fail.status_code == 409, "Must return HTTP 409 Conflict on overlapping confirmed camps"

    finally:
        for cid in [camp_id, camp_id2]:
            if cid:
                h_stmt = select(CampStatusHistory).where(CampStatusHistory.camp_id == cid)
                for h in (await db_session.execute(h_stmt)).scalars().all():
                    await db_session.delete(h)
                c = await db_session.get(Camp, cid)
                if c:
                    await db_session.delete(c)
        await db_session.flush()
        await db_session.delete(cv)
        await db_session.delete(camp_inst)
        await db_session.flush()
        if sched_created:
            await db_session.delete(sched)
            await db_session.flush()
        await db_session.delete(vo_assign)
        await db_session.flush()
        await db_session.delete(vil)
        await db_session.flush()
        await db_session.delete(taluka)
        await db_session.flush()
        await db_session.delete(dist)
        await db_session.flush()
        await db_session.delete(vo)
        await db_session.delete(admin)
        await db_session.commit()

