from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app import db as database
from app.init_db import init_db

from app.routes.auth import router as auth_router
from app.routes.account import router as account_router
from app.routes.student import router as student_router
from app.routes.teacher_admin import router as teacher_admin_router
from app.routes.ai import router as ai_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="Stepashka API", version="2.0.0", docs_url="/api/docs", redoc_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins = [o.strip() for o in settings.frontend_origin.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info("Connecting to PostgreSQL...")
    try:
        await database.get_pool()
        await init_db()
        logger.info("PostgreSQL connected and initialized")
    except Exception as e:
        logger.error(f"PostgreSQL unavailable: {e}")


@app.on_event("shutdown")
async def shutdown():
    await database.close_pool()


@app.get("/api/health")
async def health():
    try:
        row = await database.fetchrow("SELECT NOW() AS now")
        return {"status": "ok", "dbReady": True, "dbTime": str(row["now"])}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "dbReady": False})


@app.get("/api/catalog")
async def catalog():
    rows = await database.fetch(
        """SELECT c.id, c.title, c.slug, c.description, c.level, c.category, c.status, c.rating,
                  c.students_count AS "studentsCount", c.duration_hours AS "durationHours",
                  c.price_cents AS "priceCents", c.currency, c.access_type AS "accessType",
                  c.cover_url AS "coverUrl", u.full_name AS "teacherName"
           FROM courses c LEFT JOIN users u ON u.id=c.teacher_id
           WHERE c.status IN ('published','pending_review')
           ORDER BY c.created_at DESC"""
    )
    return [dict(r) for r in rows]


@app.get("/api/courses/{course_id}")
async def course_detail(course_id: int):
    row = await database.fetchrow(
        """SELECT c.id, c.title, c.slug, c.description, c.level, c.category, c.status, c.rating,
                  c.students_count AS "studentsCount", c.duration_hours AS "durationHours",
                  c.price_cents AS "priceCents", c.currency, c.access_type AS "accessType",
                  c.cover_url AS "coverUrl", u.full_name AS "teacherName", u.id AS "teacherId"
           FROM courses c LEFT JOIN users u ON u.id=c.teacher_id
           WHERE c.id=$1 LIMIT 1""",
        course_id,
    )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Курс не найден"})

    modules = await database.fetch(
        """SELECT id, title, module_order AS "moduleOrder"
           FROM course_modules WHERE course_id=$1 ORDER BY module_order ASC""",
        course_id,
    )
    lessons_count = await database.fetchval(
        """SELECT COUNT(*)::int FROM lessons l
           INNER JOIN course_modules cm ON cm.id=l.module_id
           WHERE cm.course_id=$1""",
        course_id,
    )
    steps_count = await database.fetchval(
        "SELECT COUNT(*)::int FROM course_steps WHERE course_id=$1", course_id
    )

    return {
        **dict(row),
        "modules": [dict(m) for m in modules],
        "lessonsCount": lessons_count or 0,
        "stepsCount": steps_count or 0,
    }


@app.get("/api/public/stats")
async def public_stats():
    cat = await database.fetchrow(
        """SELECT COUNT(*)::int AS "coursesTotal",
                  COALESCE(SUM(students_count),0)::int AS "studentsTotal",
                  COALESCE(AVG(rating),0)::numeric(5,2) AS "averageRating"
           FROM courses WHERE status IN ('published','pending_review')"""
    )
    comm = await database.fetchval("SELECT COUNT(*)::int FROM users WHERE status='active'")

    return {
        "coursesTotal": cat["coursesTotal"] or 0,
        "studentsTotal": cat["studentsTotal"] or 0,
        "averageRating": float(cat["averageRating"] or 0),
        "communityMembers": comm or 0,
    }


app.include_router(auth_router)
app.include_router(account_router)
app.include_router(student_router)
app.include_router(teacher_admin_router)
app.include_router(ai_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Внутренняя ошибка сервера"})
