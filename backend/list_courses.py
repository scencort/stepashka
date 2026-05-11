import asyncio, asyncpg
from app.config import settings

async def go():
    conn = await asyncpg.connect(dsn=settings.database_url)
    rows = await conn.fetch("SELECT id, slug, title FROM courses ORDER BY id")
    for r in rows:
        print(r["id"], r["slug"], r["title"])
    await conn.close()

asyncio.run(go())
