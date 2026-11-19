"""Diagnostic script to inspect staff and DAHO users in pashurakshak_db."""
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.db.session import async_session_factory
from app.modules.authentication.models import User, DahoDistrictAssignment


async def inspect_users():
    async with async_session_factory() as session:
        result = await session.execute(
            select(User.id, User.username, User.role, User.full_name, User.status)
            .order_by(User.role, User.username)
        )
        users = result.all()
        print("\n" + "=" * 65)
        print(" EXISTING USERS IN PASHURAKSHAK_DB:")
        print("=" * 65)
        if not users:
            print("  No users found in database.")
        for u in users:
            print(f"  Role: {u.role:<14} | Username: {str(u.username):<15} | Status: {u.status:<8} | Name: {u.full_name}")

        daho_res = await session.execute(
            select(DahoDistrictAssignment)
        )
        assignments = daho_res.scalars().all()
        print("\n DAHO DISTRICT ASSIGNMENTS:")
        if not assignments:
            print("  No DAHO district assignments found.")
        for a in assignments:
            print(f"  DAHO User ID: {a.daho_user_id} -> District ID: {a.district_id} (Active: {a.ended_at is None})")
        print("=" * 65 + "\n")

if __name__ == "__main__":
    asyncio.run(inspect_users())
