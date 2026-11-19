"""PashuRakshak Botad — One-Click Demo Staff Seeder.

Creates or updates working staff accounts in your database:
1. DAHO:         daho_botad / Pashu@1234
2. Vet Officer:  vo_botad   / Pashu@1234
3. Field Worker: fw_botad   / Pashu@1234 (Assigned to Botad pilot village)

Usage in PowerShell:
    python create_demo_users.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path so app imports work seamlessly
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from sqlalchemy import select
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.geography import District, Village
from app.modules.administration.models import Cooperative, VeterinaryOfficerProfile
from app.modules.authorization.models import CooperativeStaffAssignment, CooperativeVillage, FarmerUserLink
from app.modules.authentication.models import (
    DahoDistrictAssignment,
    User,
    UserVillageAssignment,
)
from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
from app.modules.animals.models import Animal, AnimalExternalIdentifier

STAFF_ACCOUNTS = [
    {
        "role": "DAHO",
        "username": "daho_botad",
        "password": "Pashu@1234",
        "full_name": "ડૉ. ડી.એચ.ઓ. બોટાદ (Dr. D.A.H.O. Botad)",
        "designation": "જિલ્લા પશુપાલન અધિકારી (DAHO)",
        "organisation": "જિલ્લા પંચાયત પશુપાલન શાખા બોટાદ",
        "mobile_e164": "+919876543201",
    },
    {
        "role": "VET_OFFICER",
        "username": "vo_botad",
        "password": "Pashu@1234",
        "full_name": "ડૉ. સુરેશભાઈ પટેલ (Dr. Suresh Patel)",
        "designation": "વેટરનરી ઓફિસર (VO)",
        "organisation": "પશુ દવાખાનું બોટાદ",
        "office_name": "તાલુકા પશુ ચિકિત્સાલય બોટાદ",
        "employee_ref": "EMP-VO-101",
        "mobile_e164": "+919876543202",
    },
    {
        "role": "FIELD_WORKER",
        "username": "fw_botad",
        "password": "Pashu@1234",
        "full_name": "રમેશભાઈ ચૌહાણ (Ramesh Chauhan)",
        "designation": "ક્ષેત્રીય કાર્યકર (Field Worker)",
        "organisation": "જિલ્લા પંચાયત પશુપાલન શાખા",
        "mobile_e164": "+919876543203",
    },
    {
        "role": "FIELD_WORKER",
        "username": "fw_botad_01",
        "password": "Pashu@1234",
        "full_name": "રમેશભાઈ ચૌહાણ (Ramesh Chauhan)",
        "designation": "ક્ષેત્રીય કાર્યકર (Field Worker)",
        "organisation": "જિલ્લા પંચાયત પશુપાલન શાખા",
        "mobile_e164": "+919876543204",
    },
    {
        "role": "SYS_ADMIN",
        "username": "admin_botad",
        "password": "Pashu@1234",
        "full_name": "સિસ્ટમ એડમિનિસ્ટ્રેટર બોટાદ (System Admin)",
        "designation": "સિસ્ટમ એડમિનિસ્ટ્રેટર (Technical Admin)",
        "organisation": "રાજ્ય એનિમલ હસબન્ડ્રી આઈટી સેલ",
        "mobile_e164": "+919876543205",
    },
    {
        "role": "DAIRY_STAFF",
        "username": "coop_botad",
        "password": "Pashu@1234",
        "full_name": "દૂધ મંડળી પ્રતિનિધિ (Dairy Cooperative Staff)",
        "designation": "ડેરી સ્ટાફ (Dairy Staff)",
        "organisation": "બોટાદ જિલ્લા સહકારી દૂધ ઉત્પાદક સંઘ",
        "mobile_e164": "+919876543206",
    },
]


async def main():
    print("=" * 60)
    print(" PashuRakshak Botad — Staff Credentials Setup")
    print("=" * 60)
    db_target = settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else settings.DATABASE_URL
    print(f"Connecting to database: {db_target}")

    async with async_session_factory() as session:
        created_users = {}

        # 1. Create or update each staff user (DAHO, VO, FW)
        for item in STAFF_ACCOUNTS:
            stmt = select(User).where(User.username == item["username"])
            res = await session.execute(stmt)
            user = res.scalar_one_or_none()

            pw_hash = get_password_hash(item["password"])
            now = datetime.now(timezone.utc)

            if user:
                user.password_hash = pw_hash
                user.role = item["role"]
                user.status = "ACTIVE"
                user.failed_attempts = 0
                user.locked_until = None
                print(f"[UPDATED] {item['role']:<14} | Username: {item['username']:<12} | Password: {item['password']}")
            else:
                user = User(
                    id=uuid.uuid4(),
                    role=item["role"],
                    full_name=item["full_name"],
                    username=item["username"],
                    password_hash=pw_hash,
                    mobile_e164=item["mobile_e164"],
                    designation=item["designation"],
                    organisation=item["organisation"],
                    status="ACTIVE",
                    must_change_password=False,
                    failed_attempts=0,
                    created_at=now,
                    updated_at=now,
                )
                session.add(user)
                await session.flush()
                print(f"[CREATED] {item['role']:<14} | Username: {item['username']:<12} | Password: {item['password']}")

            created_users[item["role"]] = user

            # Profile for VO if table exists
            if item["role"] == "VET_OFFICER":
                try:
                    prof_stmt = select(VeterinaryOfficerProfile).where(VeterinaryOfficerProfile.user_id == user.id)
                    prof = (await session.execute(prof_stmt)).scalar_one_or_none()
                    daho_actor_id = created_users.get("DAHO").id if "DAHO" in created_users else user.id
                    if not prof:
                        session.add(VeterinaryOfficerProfile(
                            user_id=user.id,
                            employee_ref=item.get("employee_ref"),
                            designation=item.get("designation"),
                            office_name=item.get("office_name"),
                            contact_mobile=item.get("mobile_e164"),
                            created_by=daho_actor_id,
                            created_at=now,
                        ))
                except Exception as e:
                    print(f"Notice (VO Profile): {e}")

        # Commit users first so they are permanently saved
        await session.commit()
        print("✓ All 3 user accounts successfully committed to database.")

    # 2. In a new transaction, assign District and Villages
    async with async_session_factory() as session:
        district = None
        villages = []
        try:
            dist_res = await session.execute(select(District).limit(1))
            district = dist_res.scalar_one_or_none()
        except Exception:
            pass

        try:
            vil_res = await session.execute(select(Village).limit(5))
            villages = list(vil_res.scalars().all())
        except Exception:
            pass

        daho_user = (await session.execute(select(User).where(User.username == "daho_botad"))).scalar_one_or_none()
        vo_user = (await session.execute(select(User).where(User.username == "vo_botad"))).scalar_one_or_none()
        fw_user = (await session.execute(select(User).where(User.username == "fw_botad"))).scalar_one_or_none()

        # Assign District to DAHO
        if daho_user and district:
            try:
                daho_assign_stmt = select(DahoDistrictAssignment).where(
                    DahoDistrictAssignment.daho_user_id == daho_user.id,
                    DahoDistrictAssignment.district_id == district.id,
                    DahoDistrictAssignment.ended_at.is_(None)
                )
                daho_assign = (await session.execute(daho_assign_stmt)).scalar_one_or_none()
                if not daho_assign:
                    session.add(DahoDistrictAssignment(
                        id=uuid.uuid4(),
                        daho_user_id=daho_user.id,
                        district_id=district.id,
                        assigned_by=daho_user.id,
                        assigned_at=datetime.now(timezone.utc),
                    ))
                    print(f"[ASSIGNED] DAHO ({daho_user.username}) -> District ({district.code})")
            except Exception as e:
                print(f"Notice (DAHO District Assignment): {e}")

        # Assign Villages to all VO and Field Worker users in the system
        staff_stmt = select(User).where(User.role.in_(["VET_OFFICER", "VO", "FIELD_WORKER", "FW"]))
        staff_users = list((await session.execute(staff_stmt)).scalars().all())

        for staff_user in staff_users:
            if staff_user and villages:
                try:
                    for vil in villages:
                        assign_stmt = select(UserVillageAssignment).where(
                            UserVillageAssignment.user_id == staff_user.id,
                            UserVillageAssignment.village_id == vil.id,
                            UserVillageAssignment.ended_at.is_(None)
                        )
                        assign = (await session.execute(assign_stmt)).scalar_one_or_none()
                        if not assign:
                            session.add(UserVillageAssignment(
                                id=uuid.uuid4(),
                                user_id=staff_user.id,
                                village_id=vil.id,
                                assigned_by=daho_user.id if daho_user else staff_user.id,
                                assigned_at=datetime.now(timezone.utc),
                            ))
                            print(f"[ASSIGNED] {staff_user.role} ({staff_user.username}) -> Village ({vil.name_gu} / {vil.code})")
                except Exception as e:
                    print(f"Notice (Village Assignment): {e}")

        # 3. Create demo farmer in pilot village if none exists
        if villages and fw_user:
            pilot_vil = villages[0]
            try:
                f_stmt = select(Farmer).where(Farmer.village_id == pilot_vil.id)
                existing_farmer = (await session.execute(f_stmt)).scalars().first()
                if not existing_farmer:
                    demo_farmer = Farmer(
                        id=uuid.uuid4(),
                        farmer_code="FRM-BOT-000001",
                        full_name="ગોવિંદભાઈ મોહનભાઈ પટેલ (Govindbhai Patel)",
                        name_norm="GOVINDBHAI MOHANBHAI PATEL",
                        mobile_e164="+919876543001",
                        mobile_status="VERIFIED_STAFF",
                        mobile_shared=False,
                        has_smartphone="YES",
                        village_id=pilot_vil.id,
                        address_text="મુ. બોટાદ, રામપરા રોડ",
                        registration_status="VERIFIED",
                        registration_path="STAFF_ASSISTED",
                        registered_by=fw_user.id,
                        data_consent_at=datetime.now(timezone.utc),
                        outreach_consent="GRANTED",
                        consent_basis="DIRECT_CONSENT",
                        consent_recorded_by=fw_user.id,
                        consent_recorded_at=datetime.now(timezone.utc),
                        verified_by=fw_user.id,
                        verified_at=datetime.now(timezone.utc),
                        active=True,
                        created_by=fw_user.id,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    session.add(demo_farmer)
                    await session.flush()
                    print(f"[CREATED] Demo Farmer: {demo_farmer.full_name} ({demo_farmer.farmer_code}) in {pilot_vil.name_gu}")

                    # Demo animal for this farmer
                    animal_stmt = select(Animal).where(Animal.animal_code == "ANM-BOT-000001")
                    demo_animal = (await session.execute(animal_stmt)).scalar_one_or_none()
                    if not demo_animal:
                        demo_animal = Animal(
                            id=uuid.uuid4(),
                            animal_code="ANM-BOT-000001",
                            species_code="CATTLE",
                            sex="F",
                            age_months_estimate=36,
                            farmer_id=demo_farmer.id,
                            village_id=pilot_vil.id,
                            registration_status="VERIFIED",
                            status="ACTIVE",
                            submission_source="FIELD_WORKER",
                            submitted_by=fw_user.id,
                            verified_by=fw_user.id,
                            verified_at=datetime.now(timezone.utc),
                            created_by=fw_user.id,
                            created_at=datetime.now(timezone.utc),
                            updated_at=datetime.now(timezone.utc),
                        )
                        session.add(demo_animal)
                        await session.flush()
                        print(f"[CREATED] Demo Animal: {demo_animal.animal_code} for {demo_farmer.full_name}")
                    else:
                        demo_animal.farmer_id = demo_farmer.id
                        demo_animal.village_id = pilot_vil.id
                        await session.flush()
                        print(f"[REUSED] Demo Animal: {demo_animal.animal_code} for {demo_farmer.full_name}")

                    # 12-digit ear tag
                    tag_stmt = select(AnimalExternalIdentifier).where(
                        AnimalExternalIdentifier.id_value == "100000000001"
                    )
                    demo_tag = (await session.execute(tag_stmt)).scalar_one_or_none()
                    if not demo_tag:
                        demo_tag = AnimalExternalIdentifier(
                            id=uuid.uuid4(),
                            animal_id=demo_animal.id,
                            id_type="BHARAT_PASHUDHAN_12",
                            id_value="100000000001",
                            status="ACTIVE",
                            recorded_by=fw_user.id,
                            recorded_at=datetime.now(timezone.utc),
                        )
                        session.add(demo_tag)
                        await session.flush()
                        print(f"[CREATED] Animal Tag: 100000000001")
            except Exception as e:
                await session.rollback()
                print(f"Notice (Demo Farmer/Animal Seed): {e}")

        # 4. Create and map Cooperative for coop_botad
        coop_user = (await session.execute(select(User).where(User.username == "coop_botad"))).scalar_one_or_none()
        if coop_user and villages:
            try:
                coop_stmt = select(Cooperative).where(Cooperative.code == "COOP-BOT-001")
                coop = (await session.execute(coop_stmt)).scalar_one_or_none()
                if not coop:
                    coop = Cooperative(
                        id=uuid.uuid4(),
                        code="COOP-BOT-001",
                        name_gu="બોટાદ જિલ્લા સહકારી દૂધ ઉત્પાદક સંઘ",
                        name_en="Botad District Cooperative Milk Producers Union",
                        org_type="DAIRY_COOPERATIVE",
                        status="ACTIVE",
                        created_by=daho_user.id if daho_user else coop_user.id,
                        created_at=datetime.now(timezone.utc),
                    )
                    session.add(coop)
                    await session.flush()
                    print(f"[CREATED] Cooperative: {coop.name_gu} ({coop.code})")

                # Map cooperative to pilot villages
                for vil in villages[:3]:
                    cv_stmt = select(CooperativeVillage).where(
                        CooperativeVillage.cooperative_id == coop.id,
                        CooperativeVillage.village_id == vil.id,
                    )
                    if not (await session.execute(cv_stmt)).scalar_one_or_none():
                        session.add(CooperativeVillage(cooperative_id=coop.id, village_id=vil.id))
                        print(f"[MAPPED] Cooperative -> Village ({vil.name_gu})")

                # Assign coop_botad staff to this cooperative
                assign_stmt = select(CooperativeStaffAssignment).where(
                    CooperativeStaffAssignment.cooperative_id == coop.id,
                    CooperativeStaffAssignment.user_id == coop_user.id,
                    CooperativeStaffAssignment.ended_at.is_(None),
                )
                if not (await session.execute(assign_stmt)).scalar_one_or_none():
                    session.add(CooperativeStaffAssignment(
                        id=uuid.uuid4(),
                        cooperative_id=coop.id,
                        user_id=coop_user.id,
                        coop_role="STAFF",
                        assigned_by=daho_user.id if daho_user else coop_user.id,
                        assigned_at=datetime.now(timezone.utc),
                    ))
                    print(f"[ASSIGNED] Coop Staff ({coop_user.username}) -> Cooperative ({coop.name_gu})")
            except Exception as coop_err:
                await session.rollback()
                print(f"Notice (Cooperative Seed): {coop_err}")

        # 5. Provision Farmer User Login Accounts (+918200738693 and +919876543001)
        farmer_mobiles = ["+918200738693", "+919876543001"]
        for frm_mobile in farmer_mobiles:
            try:
                f_user_stmt = select(User).where(User.mobile_e164 == frm_mobile)
                farmer_user = (await session.execute(f_user_stmt)).scalar_one_or_none()
                now_dt = datetime.now(timezone.utc)
                if not farmer_user:
                    farmer_user = User(
                        id=uuid.uuid4(),
                        role="FARMER",
                        full_name="ગોવિંદભાઈ મોહનભાઈ પટેલ (Govindbhai Patel)",
                        username=f"farmer_{frm_mobile.replace('+', '')}",
                        password_hash=get_password_hash("Farmer@1234"),
                        mobile_e164=frm_mobile,
                        status="ACTIVE",
                        must_change_password=False,
                        failed_attempts=0,
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                    session.add(farmer_user)
                    await session.flush()
                    print(f"[CREATED] Farmer User Account: {farmer_user.full_name} ({farmer_user.mobile_e164})")
                else:
                    farmer_user.status = "ACTIVE"
                    farmer_user.failed_attempts = 0
                    farmer_user.locked_until = None
                    await session.flush()
                    print(f"[ACTIVE] Farmer User Account: {farmer_user.full_name} ({farmer_user.mobile_e164})")

                # Ensure Farmer record exists
                f_rec = (await session.execute(select(Farmer).where(Farmer.mobile_e164 == frm_mobile))).scalars().first()
                if not f_rec and villages:
                    f_rec = Farmer(
                        id=uuid.uuid4(),
                        farmer_code=f"FRM-BOT-{frm_mobile[-6:]}",
                        full_name=farmer_user.full_name,
                        name_norm="GOVINDBHAI MOHANBHAI PATEL",
                        mobile_e164=frm_mobile,
                        mobile_status="VERIFIED_STAFF",
                        mobile_shared=False,
                        has_smartphone="YES",
                        village_id=villages[0].id,
                        address_text="મુ. બોટાદ, રામપરા રોડ",
                        registration_status="VERIFIED",
                        registration_path="STAFF_ASSISTED",
                        registered_by=fw_user.id if fw_user else farmer_user.id,
                        data_consent_at=now_dt,
                        outreach_consent="GRANTED",
                        consent_basis="DIRECT_CONSENT",
                        consent_recorded_by=fw_user.id if fw_user else farmer_user.id,
                        consent_recorded_at=now_dt,
                        verified_by=fw_user.id if fw_user else farmer_user.id,
                        verified_at=now_dt,
                        active=True,
                        created_by=fw_user.id if fw_user else farmer_user.id,
                        created_at=now_dt,
                        updated_at=now_dt,
                    )
                    session.add(f_rec)
                    await session.flush()
                    print(f"[CREATED] Farmer Profile Record: {f_rec.farmer_code} ({f_rec.mobile_e164})")

                # Link user account to farmer record
                if f_rec:
                    link_stmt = select(FarmerUserLink).where(
                        FarmerUserLink.user_id == farmer_user.id,
                        FarmerUserLink.farmer_id == f_rec.id,
                    )
                    if not (await session.execute(link_stmt)).scalar_one_or_none():
                        session.add(FarmerUserLink(
                            user_id=farmer_user.id,
                            farmer_id=f_rec.id,
                            linked_by=fw_user.id if fw_user else farmer_user.id,
                            linked_at=now_dt,
                        ))
                        print(f"[LINKED] Farmer User Link: {farmer_user.id} <-> {f_rec.id}")

                    # Provisioning record
                    prov_stmt = select(FarmerAccountProvisioning).where(
                        FarmerAccountProvisioning.user_id == farmer_user.id,
                        FarmerAccountProvisioning.farmer_id == f_rec.id,
                    )
                    prov = (await session.execute(prov_stmt)).scalar_one_or_none()
                    if not prov:
                        session.add(FarmerAccountProvisioning(
                            user_id=farmer_user.id,
                            farmer_id=f_rec.id,
                            provisioned_by=fw_user.id if fw_user else farmer_user.id,
                            provisioned_at=now_dt,
                            activation_status="ACTIVE",
                            activated_at=now_dt,
                        ))
                        print(f"[PROVISIONED] Farmer Account Provisioning: ACTIVE for {f_rec.full_name} ({frm_mobile})")
                    elif prov.activation_status != "ACTIVE":
                        prov.activation_status = "ACTIVE"
                        prov.activated_at = now_dt
            except Exception as f_err:
                await session.rollback()
                print(f"Notice (Farmer Provisioning Seed for {frm_mobile}): {f_err}")

        await session.commit()

    print("=" * 60)
    print("SUCCESS! All Demo Accounts Ready:")
    print("  Field Worker:      fw_botad / fw_botad_01 | Password: Pashu@1234")
    print("  Veterinary Officer:vo_botad               | Password: Pashu@1234")
    print("  DAHO:              daho_botad             | Password: Pashu@1234")
    print("  System Admin:      admin_botad            | Password: Pashu@1234")
    print("  Cooperative Staff: coop_botad             | Password: Pashu@1234")
    print("  Farmer (OTP):      +919876543001          | Mobile OTP Login")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
