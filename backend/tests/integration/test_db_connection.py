
import asyncio
from sqlalchemy import text
from app.db.session import async_engine

async def main():
    try:
        async with async_engine.connect() as conn:
            result = await conn.execute(
                text("SELECT current_database(), current_user")
            )
            database, user = result.fetchone()

            print("DATABASE CONNECTION: SUCCESS")
            print("Database:", database)
            print("User:", user)

    except Exception as exc:
        print("DATABASE CONNECTION: FAILED")
        print("Error type:", type(exc).__name__)
        print("Check your .env configuration.")

    finally:
        await async_engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
