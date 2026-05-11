import asyncio, asyncpg
from app.config import settings

async def go():
    conn = await asyncpg.connect(dsn=settings.database_url)
    rows = await conn.fetch("""
        SELECT c.id, c.slug,
               (SELECT COUNT(*) FROM course_modules WHERE course_id=c.id) AS mods,
               (SELECT COUNT(*) FROM lessons l JOIN course_modules m ON m.id=l.module_id WHERE m.course_id=c.id) AS lessons,
               (SELECT COUNT(*) FROM assignments a JOIN lessons l ON l.id=a.lesson_id JOIN course_modules m ON m.id=l.module_id WHERE m.course_id=c.id) AS assignments
        FROM courses c ORDER BY c.id LIMIT 5
    """)
    for r in rows:
        print(f"id={r['id']} slug={r['slug']} modules={r['mods']} lessons={r['lessons']} assignments={r['assignments']}")

    # Check one lesson content
    lesson = await conn.fetchrow("SELECT id, title, content_text FROM lessons ORDER BY id LIMIT 1")
    if lesson:
        ct = lesson['content_text'] or ''
        print(f"\nSample lesson: id={lesson['id']} title={lesson['title']}")
        print(f"Content length: {len(ct)} chars")
        print(ct[:500])
    await conn.close()

asyncio.run(go())
