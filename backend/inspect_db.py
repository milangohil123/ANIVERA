import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv("backend/.env")

async def main():
    db_url = os.getenv("DATABASE_URL").strip().strip('"').strip("'")
    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT code, name_en, name_gu, active FROM disease_masters;"))
        print("DISEASE_MASTERS:", res.fetchall())

        res_prog = await conn.execute(text("SELECT code, name_en, name_gu, active FROM programmes;"))
        print("PROGRAMMES:", res_prog.fetchall())

if __name__ == "__main__":
    asyncio.run(main())
