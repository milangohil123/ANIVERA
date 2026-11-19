"""Seed or reset a known DAHO user with full Botad district assignments and password."""
import asyncio
import sys
from pathlib import Path
import uuid

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, update
from app.db.session import async_session_factory
from app.core.security import get_password_hash
from app.modules.authentication.models import User, DahoDistrictAssignment
from app.modules.administration.models import District


async def seed_or_reset_daho():
    async with async_session_factory() as session:
        # 1. Ensure Botad district exists
        dist_res = await session.execute(
            select(District).where(District.code == "BOTAD")
        )
        district = dist_res.scalar_one_or_none()
        if not district:
            district = District(
                id=uuid.uuid4(),
                code="BOTAD",
                name_gu="બોટાદ",
                name_en="Botad",
                active=True
            )
            session.add(district)
            await session.flush()
            print(f"Created District BOTAD (ID: {district.id})")
        else:
            print(f"Found District BOTAD (ID: {district.id})")

        # 2. Check if daho_botad or daho_0ccdb379 exists
        target_username = "daho_botad"
        known_password = "Password123!"
        pwd_hash = get_password_hash(known_password)

        user_res = await session.execute(
            select(User).where(User.username == target_username)
        )
        daho_user = user_res.scalar_one_or_none()

        if not daho_user:
            daho_user = User(
                id=uuid.uuid4(),
                role="DAHO",
                full_name="ડૉ. ડી.એ.એચ.ઓ. બોટાદ (Dr. Botad DAHO)",
                username=target_username,
                password_hash=pwd_hash,
                status="ACTIVE",
                must_change_password=False,
                failed_attempts=0
            )
            session.add(daho_user)
            await session.flush()
            print(f"Created User: {target_username} (ID: {daho_user.id})")
        else:
            daho_user.password_hash = pwd_hash
            daho_user.status = "ACTIVE"
            daho_user.must_change_password = False
            daho_user.failed_attempts = 0
            session.add(daho_user)
            await session.flush()
            print(f"Updated User: {target_username} password reset")

        # Also reset daho_0ccdb379 to Password123! if it exists
        other_res = await session.execute(
            select(User).where(User.username == "daho_0ccdb379")
        )
        other_daho = other_res.scalar_one_or_none()
        if other_daho:
            other_daho.password_hash = pwd_hash
            other_daho.status = "ACTIVE"
            other_daho.must_change_password = False
            other_daho.failed_attempts = 0
            session.add(other_daho)
            print(f"Also reset password for daho_0ccdb379 to '{known_password}'")

            # Ensure district assignment for other_daho as well
            other_asgn = await session.execute(
                select(DahoDistrictAssignment).where(
                    DahoDistrictAssignment.daho_user_id == other_daho.id,
                    DahoDistrictAssignment.district_id == district.id,
                    DahoDistrictAssignment.ended_at.is_(None)
                )
            )
            if not other_asgn.scalar_one_or_none():
                session.add(DahoDistrictAssignment(
                    id=uuid.uuid4(),
                    daho_user_id=other_daho.id,
                    district_id=district.id,
                    assigned_by=other_daho.id
                ))
                print(f"Assigned daho_0ccdb379 to BOTAD district")

        # 3. Ensure active district assignment for daho_botad
        asgn_res = await session.execute(
            select(DahoDistrictAssignment).where(
                DahoDistrictAssignment.daho_user_id == daho_user.id,
                DahoDistrictAssignment.district_id == district.id,
                DahoDistrictAssignment.ended_at.is_(None)
            )
        )
        if not asgn_res.scalar_one_or_none():
            assignment = DahoDistrictAssignment(
                id=uuid.uuid4(),
                daho_user_id=daho_user.id,
                district_id=district.id,
                assigned_by=daho_user.id
            )
            session.add(assignment)
            print(f"Assigned {target_username} to BOTAD district (ID: {district.id})")

        await session.commit()
        print("\n" + "=" * 60)
        print(" DAHO CREDENTIALS READY FOR TESTING:")
        print("=" * 60)
        print(f"  Username: {target_username} (or daho_0ccdb379)")
        print(f"  Password: {known_password}")
        print(f"  Role:     DAHO")
        print(f"  District: BOTAD ({district.id})")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(seed_or_reset_daho())
