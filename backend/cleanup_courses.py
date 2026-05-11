import asyncio
import asyncpg
from app.config import settings

async def go():
    conn = await asyncpg.connect(dsn=settings.database_url)
    # Delete imported courses by ID range (285+)
    r = await conn.execute("DELETE FROM courses WHERE id >= 285")
    print(f"Deleted: {r}")
    await conn.close()

asyncio.run(go())
