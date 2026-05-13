import asyncio, asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/gradus")

    # Count real enrollments and lessons for course 414
    students = await conn.fetchval(
        "SELECT COUNT(*) FROM enrollments WHERE course_id=414 AND status='active'"
    )
    lessons = await conn.fetchval(
        "SELECT COUNT(*) FROM lessons l JOIN course_modules m ON l.module_id=m.id WHERE m.course_id=414"
    )
    duration = max(0, round(lessons * 10 / 60 * 2) / 2)

    await conn.execute(
        "UPDATE courses SET students_count=$1, rating=0, duration_hours=$2 WHERE id=414",
        students, int(duration)
    )
    print(f"Updated: students={students}, lessons={lessons}, duration={duration}h, rating=0")
    await conn.close()

asyncio.run(main())
