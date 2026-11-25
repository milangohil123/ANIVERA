
import asyncio
from app.db.session import async_engine
from sqlalchemy import text

async def run():
    async with async_engine.connect() as conn:
        res = await conn.execute(text('''
            SELECT report_id, report_no, disease_code, status, treatment_status, received_at
            FROM disease_reports
            ORDER BY received_at DESC;
        '''))
        print("ALL CASES IN DB:")
        for r in res.fetchall():
            print(dict(r._mapping))

asyncio.run(run())
