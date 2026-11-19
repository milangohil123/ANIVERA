"""Bootstrap CLI script to create initial Staff and Administrator accounts for PashuRakshak.

Usage:
    python scripts/bootstrap_staff.py --help
    python scripts/bootstrap_staff.py --role SYS_ADMIN --username admin --password "Admin@12345" --name "System Admin"
    python scripts/bootstrap_staff.py --role FIELD_WORKER --username fw01 --password "Pashu@12345" --name "Ramesh Patel" --mobile "+919876543210"
    python scripts/bootstrap_staff.py --role VET_OFFICER --username vo01 --password "Pashu@12345" --name "Dr. Haresh Shah" --mobile "+919876543211"
"""
import argparse
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.geography import Village
from app.modules.authentication.models import User, UserVillageAssignment


VALID_ROLES = ["SYS_ADMIN", "DAHO", "VET_OFFICER", "FIELD_WORKER", "DAIRY_STAFF"]


async def create_user(
    role: str,
    username: str,
    password: str,
    full_name: str,
    mobile: str = None,
    assign_village: bool = True
) -> None:
    role_upper = role.upper()
    if role_upper not in VALID_ROLES:
        print(f"Error: Invalid role '{role}'. Allowed roles: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    clean_username = username.strip().lower()
    pw_hash = get_password_hash(password)

    async with async_session_factory() as session:
        # Check if username already exists
        stmt = select(User).where(User.username == clean_username)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            print(f"User with username '{clean_username}' already exists (ID: {existing.id}, Role: {existing.role}).")
            # Update password
            existing.password_hash = pw_hash
            existing.status = "ACTIVE"
            existing.must_change_password = False
            await session.commit()
            print(f"Updated password for '{clean_username}'.")
            return

        user_id = uuid.uuid4()
        new_user = User(
            id=user_id,
            role=role_upper,
            full_name=full_name.strip(),
            username=clean_username,
            password_hash=pw_hash,
            mobile_e164=mobile.strip() if mobile else None,
            designation=f"{role_upper.replace('_', ' ').title()}",
            organisation="Department of Animal Husbandry, Botad",
            status="ACTIVE",
            must_change_password=False,
            failed_attempts=0
        )
        session.add(new_user)
        await session.flush()

        # If staff role is FIELD_WORKER or VET_OFFICER, assign to the first available village
        if assign_village and role_upper in ("FIELD_WORKER", "VET_OFFICER"):
            village_stmt = select(Village).where(Village.active == True).limit(1)
            village = (await session.execute(village_stmt)).scalar_one_or_none()
            if village:
                assign = UserVillageAssignment(
                    id=uuid.uuid4(),
                    user_id=new_user.id,
                    village_id=village.id,
                    assigned_by=new_user.id
                )
                session.add(assign)
                print(f"Assigned user to village: {village.name_gu} ({village.name_en}) [Code: {village.code}]")
            else:
                print("Note: No active village found in 'villages' table. Assign village later via admin API.")

        await session.commit()
        print("\n" + "=" * 60)
        print("  PASHURAKSHAK STAFF USER CREATED SUCCESSFULLY")
        print("=" * 60)
        print(f"  User ID   : {new_user.id}")
        print(f"  Role      : {new_user.role}")
        print(f"  Full Name : {new_user.full_name}")
        print(f"  Username  : {new_user.username}")
        print(f"  Password  : {password}")
        print("=" * 60)
        print("You can now log in to the React frontend at http://localhost:5173\n")


def main():
    parser = argparse.ArgumentParser(description="Create PashuRakshak Staff or Administrator Account")
    parser.add_argument("--role", default="FIELD_WORKER", choices=VALID_ROLES, help="User role (default: FIELD_WORKER)")
    parser.add_argument("--username", default="fw_botad_01", help="Login username (default: fw_botad_01)")
    parser.add_argument("--password", default="Pashu@12345", help="Login password (default: Pashu@12345)")
    parser.add_argument("--name", default="Rameshbhai Field Worker", help="Full name in English/Gujarati")
    parser.add_argument("--mobile", default="+919876543210", help="E.164 Mobile number (optional)")
    parser.add_argument("--no-village", action="store_true", help="Skip auto-assigning village")

    args = parser.parse_args()

    asyncio.run(
        create_user(
            role=args.role,
            username=args.username,
            password=args.password,
            full_name=args.name,
            mobile=args.mobile,
            assign_village=not args.no_village
        )
    )


if __name__ == "__main__":
    main()

