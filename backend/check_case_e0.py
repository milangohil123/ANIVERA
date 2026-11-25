
import asyncio
from app.db.session import async_engine
from sqlalchemy import text

async def run():
    async with async_engine.connect() as conn:
        res = await conn.execute(text('''
            SELECT 
                report_id, report_no, disease_code, status, treatment_status, 
                assigned_vo_id, animal_id, village_id
            FROM disease_reports
            WHERE CAST(report_id AS TEXT) LIKE 'e0bc2a73%'
               OR report_no LIKE '%e0bc2a73%';
        '''))
        for r in res.fetchall():
            print(dict(r._mapping))

asyncio.run(run())
