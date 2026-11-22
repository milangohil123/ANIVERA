import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')
import asyncio
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """))
        tables = [r[0] for r in res.fetchall()]
        
        counts = {}
        for t in tables:
            try:
                c_res = await conn.execute(text(f'SELECT COUNT(*) FROM "{t}"'))
                counts[t] = c_res.scalar()
            except Exception as e:
                counts[t] = f"ERROR: {e}"
            
        print("=== ALL NON-EMPTY TABLES ===")
        for t, c in counts.items():
            if c != 0:
                print(f"{t}: {c} rows")
                
        print("\n=== EMPTY TABLES ===")
        empty_tables = [t for t, c in counts.items() if c == 0]
        print(", ".join(empty_tables))
        
        # Foreign keys
        fk_res = await conn.execute(text("""
            SELECT
                tc.table_name AS child_table,
                kcu.column_name AS child_column,
                ccu.table_name AS parent_table,
                ccu.column_name AS parent_column,
                tc.constraint_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            ORDER BY tc.table_name, ccu.table_name;
        """))
        fks = fk_res.fetchall()
        print(f"\nTotal Foreign Keys: {len(fks)}")
        
        print("\n=== FOREIGN KEYS POINTING TO 'users' ===")
        user_fks = [fk for fk in fks if fk[2] == 'users']
        for fk in user_fks:
            print(f"{fk[0]}.{fk[1]} -> {fk[2]}.{fk[3]} ({fk[4]})")

if __name__ == "__main__":
    asyncio.run(main())
