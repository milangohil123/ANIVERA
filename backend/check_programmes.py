import asyncio
import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import async_session_factory, async_engine
from sqlalchemy import text

async def check():
    try:
        async with async_session_factory() as session:
            res = await session.execute(text("SELECT code, name_en, name_gu, active FROM programmes;"))
            rows = res.fetchall()
            print("PROGRAMMES IN DB:", rows)

            res2 = await session.execute(text("SELECT code, name_en, name_gu FROM species;"))
            rows2 = res2.fetchall()
            print("SPECIES IN DB:", rows2)

            res3 = await session.execute(text("SELECT code, name_en, name_gu FROM diseases;"))
            rows3 = res3.fetchall()
            print("DISEASES IN DB:", rows3)

            res4 = await session.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaign_programmes';"))
            rows4 = res4.fetchall()
            print("CAMPAIGN_PROGRAMMES COLS:", rows4)
    finally:
        await async_engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
