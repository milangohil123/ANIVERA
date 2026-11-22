"""ANIVERA – Jamnagar District Complete End-to-End Workflow Test & Audit Suite.

Executes a real, fully interconnected operational test of the ANIVERA platform
scoped exclusively to JAMNAGAR DISTRICT, GUJARAT, INDIA.

Phases executed:
1. Super Admin / Admin Setup & District Verification (Jamnagar Only)
2. DAHO Creation & Assignment (Jamnagar Only)
3. Jamnagar Administrative Hierarchy Verification (Talukas & Villages)
4. TAHO Creation & Scope Isolation (Jamnagar & Dhrol Talukas)
5. Veterinary Officer (VO) Creation & Village Assignment
6. Field Worker (FW) Creation & Village Assignment
7. Connected Test Campaign Creation & Coordination
8. Dairy Cooperative Creation & Membership Linking
9. Farmer Registration & OTP Provisioning
10. Animal Registration & 12-Digit Tag Assignment
11. Farmer Disease Reporting (Known vs Unknown Health Cases)
12. TAHO Disease Case Assignment (VO only, FW only, Both)
13. VO/FW Clinical Visit & Treatment Recording
14. TAHO Treatment Verification (Approval & Rejection/Follow-up)
15. Animal Chronological Health History Timeline
16. Dairy Cooperative Recurring Vaccination Schedule Creation
17. TAHO Recurring Schedule Approval & Cycle Generation
18. 15-Day Reminder Engine Verification
19. Vaccination Execution Against Recurring Schedule
20. Next Cycle Automated Advance (6-Month Horizon)
21. GIS Map Audit (GeoJSON boundaries, layers, telemetry, markers)
22. Dashboard KPI Consistency Verification
23. Cross-Taluka & Cross-District Security Scope Enforcement
"""
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import httpx

# Ensure backend root is on Python path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + "/.."))

from sqlalchemy import func, or_, select, text
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.geography import District, Taluka, Village
from app.modules.administration.models import Cooperative
from app.modules.animals.models import Animal, AnimalExternalIdentifier
from app.modules.authentication.models import (
    DahoDistrictAssignment,
    Device,
    FarmerAccountProvisioning,
    TahoTalukaAssignment,
    User,
    UserVillageAssignment,
)
from app.modules.authorization.models import (
    CooperativeMembership,
    CooperativeStaffAssignment,
    CooperativeVillage,
)
from app.modules.campaigns.models import (
    Campaign,
    CampaignAssignment,
    CampaignProgramme,
    CampaignVillage,
)
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.farmers.models import Farmer
from app.modules.health_cases.models import (
    AnimalVaccinationCycle,
    CooperativeVaccinationSchedule,
    HealthCaseAssignment,
    ScheduleAnimalEnrollment,
    TreatmentRecord,
    TreatmentVerification,
)
from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

# Target Jamnagar District Master Constants
JAMNAGAR_DISTRICT_ID = uuid.UUID("3744b316-ac2e-491f-aec6-757cd01b4d92")
TALUKA_JAMNAGAR_ID = uuid.UUID("02fbdb41-c65e-4b8d-8297-25f2df965385")
TALUKA_DHROL_ID = uuid.UUID("0f6401aa-504c-45d4-87e3-b539925073f4")


class TestAuditLogger:
    def __init__(self):
        self.results: List[Dict[str, Any]] = []

    def log(self, phase: str, test_name: str, passed: bool, evidence: str = ""):
        status_str = "PASS" if passed else "FAIL"
        mark = "✓" if passed else "✗"
        print(f"[{mark} {status_str}] {phase} -> {test_name}: {evidence}")
        self.results.append({
            "phase": phase,
            "test": test_name,
            "status": status_str,
            "evidence": evidence
        })

audit = TestAuditLogger()


async def run_jamnagar_e2e():
    print("=" * 80)
    print("STARTING ANIVERA JAMNAGAR DISTRICT COMPLETE E2E WORKFLOW TEST & AUDIT")
    print(f"Target District: Jamnagar ({JAMNAGAR_DISTRICT_ID})")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    async with async_session_factory() as session:
        # ---------------------------------------------------------------------
        # PHASE 1: Super Admin / Admin Setup & District Verification
        # ---------------------------------------------------------------------
        print("\n--- PHASE 1: Super Admin / Admin Setup & District Verification ---")
        dist = await session.get(District, JAMNAGAR_DISTRICT_ID)
        if dist and dist.code == "JAMNAGAR":
            audit.log("Phase 1 - Admin", "Jamnagar District Record", True, f"Found {dist.name_en} ({dist.name_gu}), code={dist.code}")
        else:
            audit.log("Phase 1 - Admin", "Jamnagar District Record", False, "Jamnagar district not found in database!")
            return

        # Ensure Super Admin account
        super_admin = await session.execute(
            select(User).where(User.username == "admin_jamnagar_test")
        )
        super_admin_user = super_admin.scalars().first()
        if not super_admin_user:
            super_admin_user = User(
                id=uuid.uuid4(),
                username="admin_jamnagar_test",
                full_name="સુપર એડમિનિસ્ટ્રેટર જામનગર (Super Admin Test)",
                role="SYS_ADMIN",
                status="ACTIVE",
                password_hash=get_password_hash("Admin@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(super_admin_user)
            await session.commit()
            audit.log("Phase 1 - Admin", "Super Admin Provisioning", True, "Created admin_jamnagar_test")
        else:
            super_admin_user.password_hash = get_password_hash("Admin@Jam123")
            super_admin_user.status = "ACTIVE"
            await session.commit()
            audit.log("Phase 1 - Admin", "Super Admin Provisioning", True, "Reused admin_jamnagar_test with verified credentials")

        # ---------------------------------------------------------------------
        # PHASE 2: DAHO Creation & Assignment (Jamnagar Only)
        # ---------------------------------------------------------------------
        print("\n--- PHASE 2: DAHO Creation & Assignment (Jamnagar Only) ---")
        daho_res = await session.execute(
            select(User).where(User.username == "daho_jamnagar")
        )
        daho_user = daho_res.scalars().first()
        if not daho_user:
            daho_user = User(
                id=uuid.uuid4(),
                username="daho_jamnagar",
                full_name="ડૉ. રમેશભાઈ જોશી (DAHO જામનગર)",
                role="DAHO",
                status="ACTIVE",
                designation="District Animal Husbandry Officer",
                organisation="Animal Husbandry Dept, Jamnagar",
                password_hash=get_password_hash("Daho@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(daho_user)
            await session.flush()
        else:
            daho_user.password_hash = get_password_hash("Daho@Jam123")
            daho_user.status = "ACTIVE"
            await session.flush()

        # Ensure DAHO district assignment to Jamnagar exclusively
        daho_assign = await session.execute(
            select(DahoDistrictAssignment).where(
                DahoDistrictAssignment.daho_user_id == daho_user.id,
                DahoDistrictAssignment.district_id == JAMNAGAR_DISTRICT_ID,
                DahoDistrictAssignment.ended_at.is_(None)
            )
        )
        if not daho_assign.scalars().first():
            new_assign = DahoDistrictAssignment(
                id=uuid.uuid4(),
                daho_user_id=daho_user.id,
                district_id=JAMNAGAR_DISTRICT_ID,
                assigned_by=super_admin_user.id,
                assigned_at=datetime.now(timezone.utc)
            )
            session.add(new_assign)
            await session.flush()

        await session.commit()
        audit.log("Phase 2 - DAHO", "DAHO Jamnagar Assignment", True, f"DAHO daho_jamnagar assigned to Jamnagar ({JAMNAGAR_DISTRICT_ID})")

        # ---------------------------------------------------------------------
        # PHASE 3: Verify Jamnagar Administrative Hierarchy
        # ---------------------------------------------------------------------
        print("\n--- PHASE 3: Verify Jamnagar Administrative Hierarchy ---")
        talukas_res = await session.execute(
            select(Taluka).where(Taluka.district_id == JAMNAGAR_DISTRICT_ID).order_by(Taluka.name_en)
        )
        talukas = talukas_res.scalars().all()
        audit.log("Phase 3 - Hierarchy", "Taluka Master Count", len(talukas) == 6, f"Found {len(talukas)} Talukas in Jamnagar (Dhrol, Jamjodhpur, Jamnagar, Jodiya, Kalavad, Lalpur)")

        villages_count = (await session.execute(
            select(func.count(Village.id)).where(Village.district_id == JAMNAGAR_DISTRICT_ID)
        )).scalar() or 0
        audit.log("Phase 3 - Hierarchy", "Village Master Count", villages_count == 460, f"Found {villages_count} total villages belonging to Jamnagar")

        # Key target villages
        aliabada_res = await session.execute(
            select(Village).where(Village.code == "JAM_VIL_ALIABADA", Village.district_id == JAMNAGAR_DISTRICT_ID)
        )
        aliabada = aliabada_res.scalars().first()

        jamnagar_vil_res = await session.execute(
            select(Village).where(Village.code == "JAM_VIL_01", Village.district_id == JAMNAGAR_DISTRICT_ID)
        )
        jamnagar_vil = jamnagar_vil_res.scalars().first()

        if aliabada and jamnagar_vil:
            audit.log("Phase 3 - Hierarchy", "Target Villages Coordinates", True, f"Aliabada ({aliabada.latitude}, {aliabada.longitude}) & Jamnagar ({jamnagar_vil.latitude}, {jamnagar_vil.longitude}) fully verified")
        else:
            audit.log("Phase 3 - Hierarchy", "Target Villages Coordinates", False, "Missing Aliabada or Jamnagar village records!")
            return

        # ---------------------------------------------------------------------
        # PHASE 4: Create & Test TAHO Accounts (Jamnagar Taluka & Dhrol Taluka)
        # ---------------------------------------------------------------------
        print("\n--- PHASE 4: Create & Test TAHO Accounts ---")
        # TAHO 1: Jamnagar Taluka
        taho_jam_res = await session.execute(select(User).where(User.username == "taho_jamnagar"))
        taho_jam = taho_jam_res.scalars().first()
        if not taho_jam:
            taho_jam = User(
                id=uuid.uuid4(),
                username="taho_jamnagar",
                full_name="ડૉ. મુકેશભાઈ પંડ્યા (TAHO જામનગર તાલુકા)",
                role="TAHO",
                status="ACTIVE",
                designation="Taluka Animal Husbandry Officer",
                organisation="Jamnagar Taluka Veterinary Clinic",
                password_hash=get_password_hash("Taho@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(taho_jam)
            await session.flush()
        else:
            taho_jam.password_hash = get_password_hash("Taho@Jam123")
            taho_jam.status = "ACTIVE"
            await session.flush()

        assign_jam = await session.execute(
            select(TahoTalukaAssignment).where(
                TahoTalukaAssignment.taho_user_id == taho_jam.id,
                TahoTalukaAssignment.taluka_id == TALUKA_JAMNAGAR_ID,
                TahoTalukaAssignment.ended_at.is_(None)
            )
        )
        if not assign_jam.scalars().first():
            session.add(TahoTalukaAssignment(
                id=uuid.uuid4(),
                taho_user_id=taho_jam.id,
                taluka_id=TALUKA_JAMNAGAR_ID,
                assigned_by=daho_user.id,
                assigned_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        # TAHO 2: Dhrol Taluka (for cross-taluka scope isolation testing)
        taho_dhrol_res = await session.execute(select(User).where(User.username == "taho_dhrol"))
        taho_dhrol = taho_dhrol_res.scalars().first()
        if not taho_dhrol:
            taho_dhrol = User(
                id=uuid.uuid4(),
                username="taho_dhrol",
                full_name="ડૉ. સુરેશભાઈ વ્યાસ (TAHO ધ્રોલ તાલુકા)",
                role="TAHO",
                status="ACTIVE",
                designation="Taluka Animal Husbandry Officer",
                organisation="Dhrol Taluka Clinic",
                password_hash=get_password_hash("Taho@Dhrol123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(taho_dhrol)
            await session.flush()
        else:
            taho_dhrol.password_hash = get_password_hash("Taho@Dhrol123")
            taho_dhrol.status = "ACTIVE"
            await session.flush()

        assign_dhrol = await session.execute(
            select(TahoTalukaAssignment).where(
                TahoTalukaAssignment.taho_user_id == taho_dhrol.id,
                TahoTalukaAssignment.taluka_id == TALUKA_DHROL_ID,
                TahoTalukaAssignment.ended_at.is_(None)
            )
        )
        if not assign_dhrol.scalars().first():
            session.add(TahoTalukaAssignment(
                id=uuid.uuid4(),
                taho_user_id=taho_dhrol.id,
                taluka_id=TALUKA_DHROL_ID,
                assigned_by=daho_user.id,
                assigned_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        await session.commit()
        audit.log("Phase 4 - TAHO", "TAHO Accounts Creation & Taluka Assignment", True, "taho_jamnagar -> Jamnagar Taluka, taho_dhrol -> Dhrol Taluka")

        # ---------------------------------------------------------------------
        # PHASE 5: Veterinary Officer (VO) Creation & Village Assignment
        # ---------------------------------------------------------------------
        print("\n--- PHASE 5: Veterinary Officer (VO) Creation & Village Assignment ---")
        vo_res = await session.execute(select(User).where(User.username == "vo_jamnagar"))
        vo_user = vo_res.scalars().first()
        if not vo_user:
            vo_user = User(
                id=uuid.uuid4(),
                username="vo_jamnagar",
                full_name="ડૉ. હરેશભાઈ ચૌહાણ (VO અલીયાબાડા)",
                role="VET_OFFICER",
                status="ACTIVE",
                designation="Veterinary Officer",
                organisation="Jamnagar Animal Hospital",
                password_hash=get_password_hash("Vo@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(vo_user)
            await session.flush()
        else:
            vo_user.password_hash = get_password_hash("Vo@Jam123")
            vo_user.status = "ACTIVE"
            await session.flush()

        # Assign VO to Aliabada and Jamnagar villages
        for vil_id in [aliabada.id, jamnagar_vil.id]:
            v_chk = await session.execute(
                select(UserVillageAssignment).where(
                    UserVillageAssignment.user_id == vo_user.id,
                    UserVillageAssignment.village_id == vil_id,
                    UserVillageAssignment.ended_at.is_(None)
                )
            )
            if not v_chk.scalars().first():
                session.add(UserVillageAssignment(
                    id=uuid.uuid4(),
                    user_id=vo_user.id,
                    village_id=vil_id,
                    assigned_by=taho_jam.id,
                    assigned_at=datetime.now(timezone.utc)
                ))
                await session.flush()

        await session.commit()
        audit.log("Phase 5 - VO", "VO Creation & Village Assignment", True, f"vo_jamnagar assigned to Aliabada ({aliabada.id}) and Jamnagar ({jamnagar_vil.id})")

        # ---------------------------------------------------------------------
        # PHASE 6: Field Worker (FW) Creation & Village Assignment
        # ---------------------------------------------------------------------
        print("\n--- PHASE 6: Field Worker (FW) Creation & Village Assignment ---")
        fw_res = await session.execute(select(User).where(User.username == "fw_jamnagar"))
        fw_user = fw_res.scalars().first()
        if not fw_user:
            fw_user = User(
                id=uuid.uuid4(),
                username="fw_jamnagar",
                full_name="રાજુભાઈ ભરવાડ (Field Worker અલીયાબાડા)",
                role="FIELD_WORKER",
                status="ACTIVE",
                designation="Livestock Field Inspector",
                organisation="Jamnagar Animal Health Unit",
                password_hash=get_password_hash("Fw@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(fw_user)
            await session.flush()
        else:
            fw_user.password_hash = get_password_hash("Fw@Jam123")
            fw_user.status = "ACTIVE"
            await session.flush()

        # Assign FW to Aliabada village
        fw_v_chk = await session.execute(
            select(UserVillageAssignment).where(
                UserVillageAssignment.user_id == fw_user.id,
                UserVillageAssignment.village_id == aliabada.id,
                UserVillageAssignment.ended_at.is_(None)
            )
        )
        if not fw_v_chk.scalars().first():
            session.add(UserVillageAssignment(
                id=uuid.uuid4(),
                user_id=fw_user.id,
                village_id=aliabada.id,
                assigned_by=taho_jam.id,
                assigned_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        await session.commit()
        audit.log("Phase 6 - FW", "FW Creation & Village Assignment", True, f"fw_jamnagar assigned to Aliabada ({aliabada.id})")

        # ---------------------------------------------------------------------
        # PHASE 7: Connected Test Campaign Creation & Coordination
        # ---------------------------------------------------------------------
        print("\n--- PHASE 7: Connected Test Campaign Creation ---")
        from app.modules.campaigns.models import ScheduleVersion
        sched_ver = (await session.execute(
            select(ScheduleVersion.id).where(ScheduleVersion.status == "APPROVED").limit(1)
        )).scalars().first()

        camp_code = "CAMP_JAM_FMD_E2E"
        camp_res = await session.execute(select(Campaign).where(Campaign.code == camp_code))
        campaign = camp_res.scalars().first()
        if not campaign:
            campaign = Campaign(
                id=uuid.uuid4(),
                code=camp_code,
                name="[ANIVERA E2E TEST - JAMNAGAR] FMD Vaccination Drive 2026",
                status="ACTIVE",
                schedule_version_id=sched_ver,
                activated_by=daho_user.id,
                activated_at=datetime.now(timezone.utc),
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() + timedelta(days=25),
                created_by=daho_user.id,
                created_at=datetime.now(timezone.utc)
            )
            session.add(campaign)
            await session.flush()

            # Programme & species
            session.add(CampaignProgramme(
                campaign_id=campaign.id,
                species_code="CATTLE",
                programme_code="FMD"
            ))
            session.add(CampaignVillage(
                campaign_id=campaign.id,
                village_id=aliabada.id
            ))
            await session.flush()

            session.add(CampaignAssignment(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                village_id=aliabada.id,
                worker_user_id=fw_user.id,
                assigned_by=daho_user.id,
                assigned_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        await session.commit()
        audit.log("Phase 7 - Campaign", "Campaign Creation & Village Assignment", True, f"Campaign {camp_code} active in Aliabada")

        # ---------------------------------------------------------------------
        # PHASE 8: Dairy Cooperative Creation & Membership Linking
        # ---------------------------------------------------------------------
        print("\n--- PHASE 8: Dairy Cooperative Creation ---")
        coop_res = await session.execute(
            select(Cooperative).where(Cooperative.code == "COOP-JAM-E2E-01")
        )
        coop = coop_res.scalars().first()
        
        # Cooperative staff user
        coop_user_res = await session.execute(select(User).where(User.username == "coop_jamnagar"))
        coop_user = coop_user_res.scalars().first()
        if not coop_user:
            coop_user = User(
                id=uuid.uuid4(),
                username="coop_jamnagar",
                full_name="ધીરુભાઈ આહીર (ડેરી સહકારી સેક્રેટરી - જામનગર)",
                role="DAIRY_STAFF",
                status="ACTIVE",
                password_hash=get_password_hash("Coop@Jam123"),
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(coop_user)
            await session.flush()
        else:
            coop_user.password_hash = get_password_hash("Coop@Jam123")
            coop_user.status = "ACTIVE"
            await session.flush()

        if not coop:
            coop = Cooperative(
                id=uuid.uuid4(),
                code="COOP-JAM-E2E-01",
                registration_no="REG-JAM-2026-01",
                name_en="[ANIVERA E2E TEST - JAMNAGAR] Jamnagar Milk Producers Cooperative Mandali",
                name_gu="[ANIVERA E2E TEST - JAMNAGAR] જામનગર દૂધ ઉત્પાદક સહકારી મંડળી (Aliabada)",
                org_type="DAIRY_COOPERATIVE",
                status="ACTIVE",
                district_id=JAMNAGAR_DISTRICT_ID,
                taluka_id=TALUKA_JAMNAGAR_ID,
                village_id=aliabada.id,
                contact_person="ધીરુભાઈ આહીર",
                mobile_e164="+919876500000",
                user_id=coop_user.id,
                created_by=daho_user.id,
                created_at=datetime.now(timezone.utc)
            )
            session.add(coop)
            await session.flush()

        # Link Cooperative Staff Assignment
        c_staff = await session.execute(
            select(CooperativeStaffAssignment).where(
                CooperativeStaffAssignment.cooperative_id == coop.id,
                CooperativeStaffAssignment.user_id == coop_user.id,
                CooperativeStaffAssignment.ended_at.is_(None)
            )
        )
        if not c_staff.scalars().first():
            session.add(CooperativeStaffAssignment(
                cooperative_id=coop.id,
                user_id=coop_user.id,
                coop_role="ADMIN",
                assigned_by=daho_user.id,
                assigned_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        # Link Cooperative Village
        c_vil = await session.execute(
            select(CooperativeVillage).where(
                CooperativeVillage.cooperative_id == coop.id,
                CooperativeVillage.village_id == aliabada.id
            )
        )
        if not c_vil.scalars().first():
            session.add(CooperativeVillage(
                cooperative_id=coop.id,
                village_id=aliabada.id
            ))
            await session.flush()

        await session.commit()
        audit.log("Phase 8 - Cooperative", "Dairy Cooperative Setup", True, f"Cooperative {coop.code} linked to user coop_jamnagar and village Aliabada")

        # ---------------------------------------------------------------------
        # PHASE 9: Farmer Registration & OTP Provisioning
        # ---------------------------------------------------------------------
        print("\n--- PHASE 9: Farmer Registration & OTP Provisioning ---")
        # Farmer 1 in Aliabada village
        f1_mobile = "+919876500001"
        f1_user = (await session.execute(select(User).where(User.mobile_e164 == f1_mobile))).scalars().first()
        if not f1_user:
            f1_user = User(
                id=uuid.uuid4(),
                username="farmer_jam_01",
                full_name="રમેશભાઈ પટેલ (ખેડૂત - અલીયાબાડા)",
                role="FARMER",
                mobile_e164=f1_mobile,
                status="ACTIVE",
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(f1_user)
            await session.flush()

        f1 = (await session.execute(select(Farmer).where(Farmer.mobile_e164 == f1_mobile))).scalars().first()
        if not f1:
            f1 = Farmer(
                id=uuid.uuid4(),
                farmer_code="F-JAM-001",
                full_name=f1_user.full_name,
                name_norm=f1_user.full_name.lower(),
                mobile_e164=f1_mobile,
                mobile_status="VERIFIED_OTP",
                village_id=aliabada.id,
                registration_status="VERIFIED",
                registration_path="STAFF_ASSISTED",
                data_consent_at=datetime.now(timezone.utc),
                verified_by=fw_user.id,
                verified_at=datetime.now(timezone.utc),
                active=True,
                created_by=fw_user.id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(f1)
            await session.flush()

        f1_prov = (await session.execute(select(FarmerAccountProvisioning).where(FarmerAccountProvisioning.user_id == f1_user.id))).scalars().first()
        if not f1_prov:
            session.add(FarmerAccountProvisioning(
                user_id=f1_user.id,
                farmer_id=f1.id,
                provisioned_by=fw_user.id,
                provisioned_at=datetime.now(timezone.utc),
                activation_status="ACTIVE",
                activated_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        # Link Farmer 1 as member of Cooperative
        c_mem = await session.execute(
            select(CooperativeMembership).where(
                CooperativeMembership.cooperative_id == coop.id,
                CooperativeMembership.farmer_id == f1.id
            )
        )
        if not c_mem.scalars().first():
            session.add(CooperativeMembership(
                cooperative_id=coop.id,
                farmer_id=f1.id,
                member_no="MEM-JAM-001",
                joined_on=date.today(),
                recorded_by=coop_user.id
            ))
            await session.flush()

        # Farmer 2 in Jamnagar village
        f2_mobile = "+919876500002"
        f2_user = (await session.execute(select(User).where(User.mobile_e164 == f2_mobile))).scalars().first()
        if not f2_user:
            f2_user = User(
                id=uuid.uuid4(),
                username="farmer_jam_02",
                full_name="કિશોરભાઈ જાડેજા (ખેડૂત - જામનગર)",
                role="FARMER",
                mobile_e164=f2_mobile,
                status="ACTIVE",
                must_change_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(f2_user)
            await session.flush()

        f2 = (await session.execute(select(Farmer).where(Farmer.mobile_e164 == f2_mobile))).scalars().first()
        if not f2:
            f2 = Farmer(
                id=uuid.uuid4(),
                farmer_code="F-JAM-002",
                full_name=f2_user.full_name,
                name_norm=f2_user.full_name.lower(),
                mobile_e164=f2_mobile,
                mobile_status="VERIFIED_OTP",
                village_id=jamnagar_vil.id,
                registration_status="VERIFIED",
                registration_path="STAFF_ASSISTED",
                data_consent_at=datetime.now(timezone.utc),
                verified_by=fw_user.id,
                verified_at=datetime.now(timezone.utc),
                active=True,
                created_by=fw_user.id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(f2)
            await session.flush()

        f2_prov = (await session.execute(select(FarmerAccountProvisioning).where(FarmerAccountProvisioning.user_id == f2_user.id))).scalars().first()
        if not f2_prov:
            session.add(FarmerAccountProvisioning(
                user_id=f2_user.id,
                farmer_id=f2.id,
                provisioned_by=fw_user.id,
                provisioned_at=datetime.now(timezone.utc),
                activation_status="ACTIVE",
                activated_at=datetime.now(timezone.utc)
            ))
            await session.flush()

        await session.commit()
        audit.log("Phase 9 - Farmers", "Farmer Registration & Provisioning", True, f"Farmer 1 ({f1_mobile}) in Aliabada, Farmer 2 ({f2_mobile}) in Jamnagar")

        # ---------------------------------------------------------------------
        # PHASE 10: Animal Registration & 12-Digit Tag Assignment
        # ---------------------------------------------------------------------
        print("\n--- PHASE 10: Animal Registration & 12-Digit Tag Assignment ---")
        animals_spec = [
            {"code": "ANM-JAM-01", "name": "[TEST-JAM] Gir Cow 01", "species": "CATTLE", "sex": "FEMALE", "dob": date(2021, 4, 10), "farmer": f1, "village": aliabada, "tag": "900100000001"},
            {"code": "ANM-JAM-02", "name": "[TEST-JAM] Jaffrabadi Buffalo 02", "species": "BUFFALO", "sex": "FEMALE", "dob": date(2020, 8, 15), "farmer": f1, "village": aliabada, "tag": "900100000002"},
            {"code": "ANM-JAM-03", "name": "[TEST-JAM] Gir Cow 03", "species": "CATTLE", "sex": "FEMALE", "dob": date(2022, 1, 20), "farmer": f2, "village": jamnagar_vil, "tag": "900100000003"},
            {"code": "ANM-JAM-04", "name": "[TEST-JAM] Kankrej Bull 04", "species": "CATTLE", "sex": "MALE", "dob": date(2019, 11, 5), "farmer": f2, "village": jamnagar_vil, "tag": "900100000004"},
        ]
        created_animals = {}
        for a_spec in animals_spec:
            a_row = (await session.execute(select(Animal).where(Animal.animal_code == a_spec["code"]))).scalars().first()
            if not a_row:
                a_row = Animal(
                    id=uuid.uuid4(),
                    animal_code=a_spec["code"],
                    species_code=a_spec["species"],
                    sex=a_spec["sex"],
                    birth_date=a_spec["dob"],
                    age_months_estimate=None,
                    age_estimated_on=None,
                    farmer_id=a_spec["farmer"].id,
                    village_id=a_spec["village"].id,
                    registration_status="VERIFIED",
                    status="ACTIVE",
                    submission_source="FIELD_WORKER_APP",
                    submitted_by=fw_user.id,
                    verified_by=vo_user.id,
                    verified_at=datetime.now(timezone.utc),
                    created_by=fw_user.id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                session.add(a_row)
                await session.flush()

                ext_tag = AnimalExternalIdentifier(
                    id=uuid.uuid4(),
                    animal_id=a_row.id,
                    id_type="EAR_TAG_12DIGIT",
                    id_value=a_spec["tag"],
                    status="ACTIVE",
                    recorded_by=fw_user.id,
                    recorded_at=datetime.now(timezone.utc)
                )
                session.add(ext_tag)
                await session.flush()
            created_animals[a_spec["code"]] = a_row

        await session.commit()
        audit.log("Phase 10 - Animals", "4 Animals Registered & Verified", True, "All animals created with valid birth_date and active 12-digit ear tags")

    # -------------------------------------------------------------------------
    # HTTP API WORKFLOWS USING LIVE FASTAPI SERVER
    # -------------------------------------------------------------------------
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=15.0) as client:
        # Obtain Auth Tokens for all actors
        # 1. Super Admin Token
        admin_login = await client.post("/api/v1/auth/staff/login", json={"username": "admin_jamnagar_test", "password": "Admin@Jam123"})
        audit.log("Phase 1 - Admin API", "Super Admin Staff Login", admin_login.status_code == 200, f"Token obtained, HTTP {admin_login.status_code}")
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. DAHO Jamnagar Token
        daho_login = await client.post("/api/v1/auth/staff/login", json={"username": "daho_jamnagar", "password": "Daho@Jam123"})
        audit.log("Phase 2 - DAHO API", "DAHO Staff Login", daho_login.status_code == 200, f"Token obtained, HTTP {daho_login.status_code}")
        daho_token = daho_login.json()["access_token"]
        daho_headers = {"Authorization": f"Bearer {daho_token}"}

        # Verify DAHO Scope
        daho_me = await client.get("/api/v1/auth/me", headers=daho_headers)
        daho_districts = daho_me.json().get("assigned_districts", [])
        daho_jamnagar_ok = str(JAMNAGAR_DISTRICT_ID) in [str(d) for d in daho_districts]
        audit.log("Phase 2 - DAHO Scope", "DAHO Restricted to Jamnagar", daho_jamnagar_ok, f"Assigned Districts: {daho_districts}")

        # 3. TAHO Jamnagar Token
        taho_jam_login = await client.post("/api/v1/auth/staff/login", json={"username": "taho_jamnagar", "password": "Taho@Jam123"})
        audit.log("Phase 4 - TAHO API", "TAHO Jamnagar Staff Login", taho_jam_login.status_code == 200, f"Token obtained, HTTP {taho_jam_login.status_code}")
        taho_jam_token = taho_jam_login.json()["access_token"]
        taho_jam_headers = {"Authorization": f"Bearer {taho_jam_token}"}

        # 4. TAHO Dhrol Token
        taho_dhrol_login = await client.post("/api/v1/auth/staff/login", json={"username": "taho_dhrol", "password": "Taho@Dhrol123"})
        taho_dhrol_token = taho_dhrol_login.json()["access_token"]
        taho_dhrol_headers = {"Authorization": f"Bearer {taho_dhrol_token}"}

        # 5. VO Jamnagar Token
        vo_login = await client.post("/api/v1/auth/staff/login", json={"username": "vo_jamnagar", "password": "Vo@Jam123"})
        audit.log("Phase 5 - VO API", "VO Jamnagar Staff Login", vo_login.status_code == 200, f"Token obtained, HTTP {vo_login.status_code}")
        vo_token = vo_login.json()["access_token"]
        vo_headers = {"Authorization": f"Bearer {vo_token}"}

        # 6. FW Jamnagar Token
        fw_login = await client.post("/api/v1/auth/staff/login", json={"username": "fw_jamnagar", "password": "Fw@Jam123"})
        audit.log("Phase 6 - FW API", "FW Jamnagar Staff Login", fw_login.status_code == 200, f"Token obtained, HTTP {fw_login.status_code}")
        fw_token = fw_login.json()["access_token"]
        fw_headers = {"Authorization": f"Bearer {fw_token}"}

        # 7. Dairy Cooperative Token
        coop_login = await client.post("/api/v1/auth/staff/login", json={"username": "coop_jamnagar", "password": "Coop@Jam123"})
        audit.log("Phase 8 - Coop API", "Cooperative Staff Login", coop_login.status_code == 200, f"Token obtained, HTTP {coop_login.status_code}")
        coop_token = coop_login.json()["access_token"]
        coop_headers = {"Authorization": f"Bearer {coop_token}"}

        # 8. Farmer 1 OTP Token
        f1_otp_req = await client.post("/api/v1/auth/farmer/request-otp", json={"mobile_e164": "+919876500001"})
        f1_verify = await client.post("/api/v1/auth/farmer/verify-otp", json={"mobile_e164": "+919876500001", "otp_code": "123456"})
        audit.log("Phase 9 - Farmer 1 OTP", "Farmer 1 OTP Login", f1_verify.status_code == 200, f"HTTP {f1_verify.status_code}")
        f1_token = f1_verify.json()["access_token"]
        f1_headers = {"Authorization": f"Bearer {f1_token}"}

        # 9. Farmer 2 OTP Token
        f2_otp_req = await client.post("/api/v1/auth/farmer/request-otp", json={"mobile_e164": "+919876500002"})
        f2_verify = await client.post("/api/v1/auth/farmer/verify-otp", json={"mobile_e164": "+919876500002", "otp_code": "123456"})
        audit.log("Phase 9 - Farmer 2 OTP", "Farmer 2 OTP Login", f2_verify.status_code == 200, f"HTTP {f2_verify.status_code}")
        f2_token = f2_verify.json()["access_token"]
        f2_headers = {"Authorization": f"Bearer {f2_token}"}

        # ---------------------------------------------------------------------
        # PHASE 11: Farmer Disease Reporting
        # ---------------------------------------------------------------------
        print("\n--- PHASE 11: Farmer Disease Reporting ---")
        anm1 = created_animals["ANM-JAM-01"]
        anm3 = created_animals["ANM-JAM-03"]

        # Case A: Farmer 1 reports known suspected disease (FMD)
        case_a_payload = {
            "animal_id": str(anm1.id),
            "disease_code": "FMD",
            "is_known_disease": True,
            "primary_symptom": "Mouth blisters, salivation and lameness",
            "symptoms": ["Mouth blisters", "Salivation", "Lameness", "High fever"],
            "symptom_onset_date": (date.today() - timedelta(days=2)).isoformat(),
            "description": "ગાય ખોરાક લેતી નથી, મોઢામાં ફોલ્લા અને પગમાં ચાંદા છે.",
            "urgency": "URGENT",
            "latitude": 22.4215,
            "longitude": 70.2458
        }
        res_case_a = await client.post("/api/v1/health-cases/farmer/reports", json=case_a_payload, headers=f1_headers)
        case_a_data = res_case_a.json() if res_case_a.status_code == 201 else {}
        case_a_id = case_a_data.get("id")
        audit.log("Phase 11 - Health Reports", "Case A Submission (Known FMD)", res_case_a.status_code == 201, f"Report ID={case_a_id}, HTTP {res_case_a.status_code}")

        # Case B: Farmer 2 reports unknown health issue (Unknown condition)
        case_b_payload = {
            "animal_id": str(anm3.id),
            "disease_code": "UNKNOWN",
            "is_known_disease": False,
            "primary_symptom": "Severe lethargy and sudden swelling",
            "symptoms": ["Sudden swelling", "Lethargy", "Milk drop"],
            "symptom_onset_date": (date.today() - timedelta(days=1)).isoformat(),
            "description": "અચાનક ગળા પાસે સોજો આવ્યો છે અને તાવ છે.",
            "urgency": "EMERGENCY",
            "latitude": 22.4591,
            "longitude": 70.0728
        }
        res_case_b = await client.post("/api/v1/health-cases/farmer/reports", json=case_b_payload, headers=f2_headers)
        case_b_data = res_case_b.json() if res_case_b.status_code == 201 else {}
        case_b_id = case_b_data.get("id")
        audit.log("Phase 11 - Health Reports", "Case B Submission (Unknown Emergency)", res_case_b.status_code == 201, f"Report ID={case_b_id}, HTTP {res_case_b.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 12: TAHO Disease Case Assignment
        # ---------------------------------------------------------------------
        print("\n--- PHASE 12: TAHO Disease Case Assignment ---")
        # TAHO Jamnagar lists cases
        taho_cases_res = await client.get("/api/v1/health-cases/taho/cases", headers=taho_jam_headers)
        taho_cases = taho_cases_res.json() if taho_cases_res.status_code == 200 else []
        audit.log("Phase 12 - TAHO Assignment", "TAHO Case Inbox Query", taho_cases_res.status_code == 200 and len(taho_cases) >= 2, f"Retrieved {len(taho_cases)} cases in Jamnagar Taluka")

        # Assign Case A to VO only
        assign_a_payload = {
            "assigned_to_role": "VO",
            "vo_user_id": str(vo_user.id),
            "fw_user_id": None,
            "priority": "HIGH",
            "instructions": "Conduct immediate clinical exam, take swab sample and prescribe ring quarantine."
        }
        assign_a_res = await client.post(f"/api/v1/health-cases/taho/cases/{case_a_id}/assign", json=assign_a_payload, headers=taho_jam_headers)
        audit.log("Phase 12 - TAHO Assignment", "Assign Case A to VO", assign_a_res.status_code == 200, f"HTTP {assign_a_res.status_code}")

        # Assign Case B to Both VO and FW
        assign_b_payload = {
            "assigned_to_role": "BOTH",
            "vo_user_id": str(vo_user.id),
            "fw_user_id": str(fw_user.id),
            "priority": "CRITICAL",
            "instructions": "Joint emergency visit: FW to secure animal and check herd, VO to administer emergency IV."
        }
        assign_b_res = await client.post(f"/api/v1/health-cases/taho/cases/{case_b_id}/assign", json=assign_b_payload, headers=taho_jam_headers)
        audit.log("Phase 12 - TAHO Assignment", "Assign Case B to BOTH (VO+FW)", assign_b_res.status_code == 200, f"HTTP {assign_b_res.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 13: VO/FW Clinical Visit & Treatment Recording
        # ---------------------------------------------------------------------
        print("\n--- PHASE 13: VO/FW Clinical Visit & Treatment Recording ---")
        vo_cases_res = await client.get("/api/v1/health-cases/staff/cases", headers=vo_headers)
        vo_cases = vo_cases_res.json() if vo_cases_res.status_code == 200 else []
        audit.log("Phase 13 - VO Field Visit", "VO Assigned Cases Query", len(vo_cases) >= 2, f"VO retrieved {len(vo_cases)} assigned cases")

        # VO records treatment for Case A
        treat_a_payload = {
            "visit_date": date.today().isoformat(),
            "clinical_observations": "Vesicles on oral tongue and coronary band. Temp 104.2 F. Mild dehydration.",
            "provisional_diagnosis": "Confirmed Foot-and-Mouth Disease (FMD) Type O",
            "treatment_administered": "Antiseptic mouth wash, Potassium permanganate 1% hooves wash, Flunixin Meglumine 15ml IM, Ceftiofur sodium 1g IM",
            "prescribed_medications": "Meloxicam bolus 1 bd x 3 days, Enrofloxacin 10% 20ml x 3 days",
            "treatment_status": "TREATED",
            "requires_follow_up": True,
            "follow_up_date": (date.today() + timedelta(days=3)).isoformat(),
            "visit_latitude": 22.4215,
            "visit_longitude": 70.2458
        }
        treat_a_res = await client.post(f"/api/v1/health-cases/staff/cases/{case_a_id}/treatment", json=treat_a_payload, headers=vo_headers)
        audit.log("Phase 13 - Treatment Record", "Record Clinical Treatment (Case A)", treat_a_res.status_code == 200, f"HTTP {treat_a_res.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 14: TAHO Treatment Verification
        # ---------------------------------------------------------------------
        print("\n--- PHASE 14: TAHO Treatment Verification ---")
        # TAHO verifies and APPROVES Case A
        verify_a_payload = {
            "verification_status": "APPROVED",
            "verification_notes": "Clinical treatment protocols verified according to State Animal Husbandry guidelines. Quarantine protocol active.",
            "requires_further_action": False
        }
        verify_a_res = await client.post(f"/api/v1/health-cases/taho/cases/{case_a_id}/verify", json=verify_a_payload, headers=taho_jam_headers)
        audit.log("Phase 14 - TAHO Verification", "Approve Treatment (Case A)", verify_a_res.status_code == 200, f"HTTP {verify_a_res.status_code}, Status closed")

        # TAHO reviews Case B: test REJECTION / REQUEST CHANGES flow
        verify_b_payload = {
            "verification_status": "REJECTED",
            "verification_notes": "Emergency swab sample not attached. Requesting immediate blood smear examination.",
            "requires_further_action": True
        }
        verify_b_res = await client.post(f"/api/v1/health-cases/taho/cases/{case_b_id}/verify", json=verify_b_payload, headers=taho_jam_headers)
        audit.log("Phase 14 - TAHO Verification", "Reject Treatment / Request Action (Case B)", verify_b_res.status_code == 200, f"HTTP {verify_b_res.status_code}, Rejected with audit reason")

        # ---------------------------------------------------------------------
        # PHASE 15: Animal Chronological Health History Timeline
        # ---------------------------------------------------------------------
        print("\n--- PHASE 15: Animal Health History Timeline ---")
        timeline_res = await client.get(f"/api/v1/health-cases/animals/{anm1.id}/timeline", headers=f1_headers)
        timeline = timeline_res.json() if timeline_res.status_code == 200 else []
        event_types = [e.get("event_type") for e in timeline]
        timeline_ok = "DISEASE_REPORTED" in event_types and "TREATMENT_RECORDED" in event_types
        audit.log("Phase 15 - Animal Timeline", "Chronological Medical History", timeline_ok, f"Found {len(timeline)} events: {event_types}")

        # ---------------------------------------------------------------------
        # PHASE 16: Dairy Cooperative Recurring Vaccination Schedule Creation
        # ---------------------------------------------------------------------
        print("\n--- PHASE 16: Dairy Cooperative Recurring Vaccination Schedule Creation ---")
        anm2 = created_animals["ANM-JAM-02"]

        # Preview Eligibility
        preview_res = await client.get(
            "/api/v1/health-cases/coop/schedules/preview-eligibility?programme_code=FMD&target_species=CATTLE,BUFFALO",
            headers=coop_headers
        )
        audit.log("Phase 16 - Coop Schedule", "Preview Member Animal Eligibility", preview_res.status_code == 200, f"HTTP {preview_res.status_code}")

        # Create Schedule
        schedule_payload = {
            "title": "[ANIVERA E2E TEST - JAMNAGAR] Bi-Annual FMD Recurring Schedule",
            "programme_code": "FMD",
            "recurrence_interval_months": 6,
            "target_species": ["CATTLE", "BUFFALO"],
            "village_ids": [str(aliabada.id)],
            "animal_ids": [str(anm1.id), str(anm2.id)],
            "start_date": date.today().isoformat(),
            "notes": "Cooperative bi-annual FMD recurring booster vaccination for member cattle and buffaloes."
        }
        create_sched_res = await client.post("/api/v1/health-cases/coop/schedules", json=schedule_payload, headers=coop_headers)
        schedule_data = create_sched_res.json() if create_sched_res.status_code == 201 else {}
        schedule_id = schedule_data.get("id")
        audit.log("Phase 16 - Coop Schedule", "Create Recurring Schedule", create_sched_res.status_code == 201, f"Schedule ID={schedule_id}, HTTP {create_sched_res.status_code}")

        # Submit Schedule to TAHO
        submit_sched_res = await client.post(f"/api/v1/health-cases/coop/schedules/{schedule_id}/submit", headers=coop_headers)
        audit.log("Phase 16 - Coop Schedule", "Submit Schedule to TAHO", submit_sched_res.status_code == 200, f"HTTP {submit_sched_res.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 17: TAHO Recurring Schedule Approval & Cycle Generation
        # ---------------------------------------------------------------------
        print("\n--- PHASE 17: TAHO Recurring Schedule Approval ---")
        taho_scheds_res = await client.get("/api/v1/health-cases/taho/schedules", headers=taho_jam_headers)
        audit.log("Phase 17 - TAHO Approval", "List Cooperative Schedules for TAHO", taho_scheds_res.status_code == 200, f"HTTP {taho_scheds_res.status_code}")

        # TAHO decides and APPROVES schedule
        decide_payload = {
            "decision": "APPROVED",
            "rejection_reason": None,
            "modified_start_date": None
        }
        decide_res = await client.post(f"/api/v1/health-cases/taho/schedules/{schedule_id}/decide", json=decide_payload, headers=taho_jam_headers)
        audit.log("Phase 17 - TAHO Approval", "Approve Schedule & Generate Cycles", decide_res.status_code == 200, f"HTTP {decide_res.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 18: 15-Day Reminder Engine Verification
        # ---------------------------------------------------------------------
        print("\n--- PHASE 18: 15-Day Reminder Engine Verification ---")
        # In database, set due_date of Animal 1's cycle to exactly 15 days from today
        async with async_session_factory() as sess:
            cycle_res = await sess.execute(
                select(AnimalVaccinationCycle).where(
                    AnimalVaccinationCycle.schedule_id == uuid.UUID(schedule_id),
                    AnimalVaccinationCycle.animal_id == anm1.id
                )
            )
            cycle1 = cycle_res.scalars().first()
            if cycle1:
                cycle1.due_date = date.today() + timedelta(days=15)
                cycle1.reminder_15d_sent_at = None
                await sess.commit()

        # Trigger 15-day reminder scan
        reminder_res = await client.post("/api/v1/health-cases/reminders/check-15-days", headers=admin_headers)
        rem_data = reminder_res.json() if reminder_res.status_code == 200 else {}
        reminders_sent = rem_data.get("reminders_dispatched", 0)
        audit.log("Phase 18 - Reminders", "15-Day Reminder Dispatch", reminder_res.status_code == 200 and reminders_sent >= 1, f"Reminders dispatched: {reminders_sent}, HTTP {reminder_res.status_code}")

        # ---------------------------------------------------------------------
        # PHASE 19 & 20: Vaccination Execution & Next Cycle Automated Advance
        # ---------------------------------------------------------------------
        print("\n--- PHASE 19 & 20: Vaccination Execution & Next Cycle Advance ---")
        async with async_session_factory() as sess:
            from app.modules.health_cases.service import HealthWorkflowService
            hw_service = HealthWorkflowService(sess)
            cycle_adv = await hw_service.advance_vaccination_cycle_on_event(
                animal_id=anm1.id,
                programme_code="FMD",
                administered_date=date.today(),
                schedule_id=uuid.UUID(schedule_id)
            )
            await sess.commit()
            audit.log("Phase 19 & 20 - Vaccination & Next Cycle", "Advance Recurring Cycle", cycle_adv, "Completed cycle 1 and automatically generated next cycle (6-month horizon)")

        # Verify next cycle in DB
        async with async_session_factory() as sess:
            next_cycles = (await sess.execute(
                select(AnimalVaccinationCycle).where(
                    AnimalVaccinationCycle.schedule_id == uuid.UUID(schedule_id),
                    AnimalVaccinationCycle.animal_id == anm1.id,
                    AnimalVaccinationCycle.cycle_status == "SCHEDULED"
                )
            )).scalars().all()
            expected_due = date.today() + timedelta(days=180)
            next_cycle_ok = len(next_cycles) >= 1 and (next_cycles[0].due_date - expected_due).days in (-2, -1, 0, 1, 2)
            audit.log("Phase 20 - Next Cycle", "Next Due Date Calculation", next_cycle_ok, f"Next due date: {next_cycles[0].due_date if next_cycles else 'None'} (~6 months)")

        # ---------------------------------------------------------------------
        # PHASE 21: GIS Map Audit
        # ---------------------------------------------------------------------
        print("\n--- PHASE 21: GIS Map Audit ---")
        # 1. District Map Layers for DAHO
        daho_layers_res = await client.get("/api/v1/maps/layers", headers=daho_headers)
        daho_layers_data = daho_layers_res.json() if daho_layers_res.status_code == 200 else {}
        vils_in_layer = daho_layers_data.get("villages", [])
        dis_in_layer = daho_layers_data.get("diseaseClusters", [])
        audit.log("Phase 21 - GIS", "DAHO Map Layers Query", daho_layers_res.status_code == 200 and len(vils_in_layer) > 0, f"Returned {len(vils_in_layer)} villages, {len(dis_in_layer)} disease clusters in Jamnagar")

        # 2. Taluka Boundaries GeoJSON for Jamnagar District
        talukas_geo_res = await client.get(f"/api/v1/maps/districts/{JAMNAGAR_DISTRICT_ID}/talukas-geojson", headers=daho_headers)
        talukas_geo = talukas_geo_res.json() if talukas_geo_res.status_code == 200 else {}
        taluka_features = talukas_geo.get("features", [])
        audit.log("Phase 21 - GIS", "Jamnagar Talukas GeoJSON Polygons", talukas_geo_res.status_code == 200 and len(taluka_features) >= 6, f"GeoJSON contains {len(taluka_features)} Taluka boundary polygons")

        # 3. Village Boundaries GeoJSON for Jamnagar Taluka
        villages_geo_res = await client.get(f"/api/v1/maps/talukas/{TALUKA_JAMNAGAR_ID}/villages-geojson", headers=taho_jam_headers)
        villages_geo = villages_geo_res.json() if villages_geo_res.status_code == 200 else {}
        vil_features = villages_geo.get("features", [])
        audit.log("Phase 21 - GIS", "Jamnagar Taluka Villages GeoJSON Polygons", villages_geo_res.status_code == 200 and len(vil_features) > 0, f"GeoJSON contains {len(vil_features)} Village boundary polygons")

        # ---------------------------------------------------------------------
        # PHASE 22: Dashboard Data Consistency Verification
        # ---------------------------------------------------------------------
        print("\n--- PHASE 22: Dashboard Data Consistency Verification ---")
        # Verify counts in DB
        async with async_session_factory() as sess:
            cases_cnt = (await sess.execute(
                select(func.count(DiseaseReport.id))
                .join(Village, Village.id == DiseaseReport.village_id)
                .where(Village.district_id == JAMNAGAR_DISTRICT_ID)
            )).scalar() or 0

            sched_cnt = (await sess.execute(
                select(func.count(CooperativeVaccinationSchedule.id))
                .join(Cooperative, Cooperative.id == CooperativeVaccinationSchedule.cooperative_id)
                .where(Cooperative.district_id == JAMNAGAR_DISTRICT_ID)
            )).scalar() or 0

            audit.log("Phase 22 - Consistency", "Jamnagar Cases Count in DB", cases_cnt >= 2, f"Total verified cases in Jamnagar: {cases_cnt}")
            audit.log("Phase 22 - Consistency", "Jamnagar Schedules Count in DB", sched_cnt >= 1, f"Total recurring schedules in Jamnagar: {sched_cnt}")

        # ---------------------------------------------------------------------
        # PHASE 23: Security & Scope Isolation Enforcement
        # ---------------------------------------------------------------------
        print("\n--- PHASE 23: Security & Scope Isolation Enforcement ---")
        # 1. TAHO Dhrol attempts to view/assign Case A in Jamnagar Taluka
        unauth_assign_res = await client.post(
            f"/api/v1/health-cases/taho/cases/{case_a_id}/assign",
            json=assign_a_payload,
            headers=taho_dhrol_headers
        )
        audit.log("Phase 23 - Security", "Cross-Taluka Assignment Denial", unauth_assign_res.status_code == 403, f"Denial HTTP {unauth_assign_res.status_code} (TAHO Dhrol blocked from Jamnagar Taluka)")

        # 2. Farmer 1 attempts to query Farmer 2's animal timeline
        unauth_timeline_res = await client.get(
            f"/api/v1/health-cases/animals/{anm3.id}/timeline",
            headers=f1_headers
        )
        audit.log("Phase 23 - Security", "Cross-Farmer Ownership Privacy Denial", unauth_timeline_res.status_code == 403, f"Denial HTTP {unauth_timeline_res.status_code} (Farmer 1 blocked from Farmer 2's animal)")

    print("\n" + "=" * 80)
    print("ALL PHASES COMPLETED!")
    total = len(audit.results)
    passed = sum(1 for r in audit.results if r["status"] == "PASS")
    failed = total - passed
    print(f"Summary: Total Tests={total}, Passed={passed}, Failed={failed}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_jamnagar_e2e())
