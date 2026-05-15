from __future__ import annotations

import logging
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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
from app.deps import CurrentUser, require_roles

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(title="Gradus API", version="2.0.0", docs_url="/api/docs", redoc_url=None)
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
        # migration: add step_id to discussion_messages if missing (no FK constraint)
        await database.execute(
            "ALTER TABLE discussion_messages ADD COLUMN IF NOT EXISTS step_id INTEGER"
        )
        # drop FK constraint if it was previously added with reference
        await database.execute(
            """DO $$
               BEGIN
                 IF EXISTS (
                   SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'discussion_messages_step_id_fkey'
                     AND table_name = 'discussion_messages'
                 ) THEN
                   ALTER TABLE discussion_messages DROP CONSTRAINT discussion_messages_step_id_fkey;
                 END IF;
               END$$"""
        )
        # migration: course ratings table
        await database.execute("""
            CREATE TABLE IF NOT EXISTS course_ratings (
                id SERIAL PRIMARY KEY,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
                comment TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE (course_id, user_id)
            )
        """)
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


# ── Alias: /api/courses → /api/catalog (Landing page compatibility) ──
@app.get("/api/courses")
async def courses_alias():
    rows = await database.fetch(
        """SELECT
               c.id, c.title, c.slug, c.description, c.level, c.category, c.status,
               c.price_cents AS "priceCents", c.currency, c.access_type AS "accessType",
               c.cover_url AS "coverUrl", u.full_name AS "author",

               -- real student count from enrollments
               COUNT(DISTINCT e.user_id) FILTER (WHERE e.status = 'active') AS "studentsCount",

               -- real average rating from completed submissions (0–100 → 0–5 stars)
               ROUND(
                 COALESCE(AVG(sub.score) FILTER (WHERE sub.score IS NOT NULL), 0) / 20.0,
               1) AS rating,

               -- real lesson count
               COUNT(DISTINCT l.id) AS "lessonsCount",

               -- estimated duration: 10 min per lesson, rounded to 0.5h
               ROUND(COUNT(DISTINCT l.id) * 10.0 / 60 * 2) / 2.0 AS "durationHours"

           FROM courses c
           LEFT JOIN users u ON u.id = c.teacher_id
           LEFT JOIN enrollments e ON e.course_id = c.id
           LEFT JOIN course_modules cm ON cm.course_id = c.id
           LEFT JOIN lessons l ON l.module_id = cm.id
           LEFT JOIN submissions sub ON sub.lesson_id = l.id AND sub.score IS NOT NULL
           WHERE c.status = 'published'
           GROUP BY c.id, u.full_name
           ORDER BY c.created_at DESC"""
    )
    result = []
    for r in rows:
        row = dict(r)
        price_cents = row.get("priceCents") or 0
        row["price"] = "Бесплатно" if price_cents == 0 else f"{price_cents // 100} ₽"
        students = int(row.get("studentsCount") or 0)
        row["students"] = str(students)
        raw_rating = float(row.get("rating") or 0)
        row["rating"] = str(raw_rating) if raw_rating > 0 else "—"
        lessons = int(row.get("lessonsCount") or 0)
        row["lessons"] = lessons
        duration = float(row.get("durationHours") or 0)
        row["duration"] = f"{int(duration)} ч" if duration >= 1 else (f"{int(duration * 60)} мин" if duration > 0 else "—")
        row["progress"] = 0
        result.append(row)
    return result


# ── Alias: /api/dashboard → /api/student/dashboard ──
# (frontend calls /dashboard but student router prefix is /api/student)
@app.get("/api/dashboard")
async def dashboard_alias(user: CurrentUser):
    from app.routes.student import dashboard as _dashboard
    return await _dashboard(user)


# ── Alias: /api/my-progress → /api/student/my-progress ──
@app.get("/api/my-progress")
async def my_progress_alias(user: CurrentUser):
    rows = await database.fetch(
        """SELECT course_id AS "courseId", progress_percent AS "progressPercent"
           FROM enrollments WHERE user_id=$1 AND status='active'""",
        user["id"],
    )
    return {r["courseId"]: r["progressPercent"] or 0 for r in rows}


# ── /api/roles-members (used by RolesAccess page — admin only) ──
_AdminDep = Depends(require_roles("admin"))

@app.get("/api/roles-members", dependencies=[_AdminDep])
async def roles_members():
    rows = await database.fetch(
        """SELECT id, full_name AS "name", role FROM users ORDER BY id ASC"""
    )
    role_map = {"student": "student", "teacher": "instructor", "admin": "administrator"}
    return [{"id": r["id"], "name": r["name"], "role": role_map.get(r["role"], r["role"])} for r in rows]


@app.patch("/api/roles-members/{user_id}", dependencies=[_AdminDep])
async def update_roles_member(user_id: int, request: Request, user: CurrentUser):
    body = await request.json()
    new_role_display = body.get("role", "student")
    role_reverse = {"student": "student", "instructor": "teacher", "administrator": "admin", "methodologist": "teacher"}
    db_role = role_reverse.get(new_role_display, "student")
    updated = await database.fetchrow(
        'UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2 RETURNING id, full_name AS "name", role',
        db_role, user_id,
    )
    if not updated:
        return {"error": "Пользователь не найден"}
    role_map = {"student": "student", "teacher": "instructor", "admin": "administrator"}
    return {"id": updated["id"], "name": updated["name"], "role": role_map.get(updated["role"], updated["role"])}


@app.post("/api/roles-members", dependencies=[_AdminDep], status_code=201)
async def create_roles_member(request: Request):
    from app.services import hash_password
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return JSONResponse(status_code=400, content={"error": "Некорректный email"})
    exists = await database.fetchrow("SELECT id FROM users WHERE email=$1", email)
    if exists:
        return JSONResponse(status_code=409, content={"error": "Пользователь с таким email уже существует"})
    password_hash = hash_password("Change@Me123")
    row = await database.fetchrow(
        """INSERT INTO users (email, password_hash, full_name, role)
           VALUES ($1, $2, $3, 'student')
           RETURNING id, full_name AS "name", role""",
        email, password_hash, email.split("@")[0],
    )
    role_map = {"student": "student", "teacher": "instructor", "admin": "administrator"}
    return {"id": row["id"], "name": row["name"], "role": role_map.get(row["role"], row["role"])}


@app.delete("/api/roles-members/{user_id}", dependencies=[_AdminDep])
async def delete_roles_member(user_id: int, user: CurrentUser):
    if user_id == user["id"]:
        return {"error": "Нельзя удалить собственный аккаунт"}
    await database.execute("DELETE FROM users WHERE id=$1", user_id)
    return {"success": True}


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


# ── Notifications ──

@app.get("/api/notifications")
async def get_notifications(user: CurrentUser):
    rows = await database.fetch(
        """SELECT id, title, created_at AS "time"
           FROM notifications WHERE user_id=$1
           ORDER BY created_at DESC LIMIT 20""",
        user["id"],
    )
    def format_time(dt) -> str:
        from datetime import datetime, timezone
        if dt is None:
            return ""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        dt_naive = dt.replace(tzinfo=None) if dt.tzinfo else dt
        diff = now - dt_naive
        seconds = int(diff.total_seconds())
        if seconds < 60:
            return "только что"
        if seconds < 3600:
            m = seconds // 60
            if m % 10 == 1 and m != 11:
                return f"{m} минуту назад"
            elif m % 10 in (2, 3, 4) and m not in (12, 13, 14):
                return f"{m} минуты назад"
            return f"{m} минут назад"
        if seconds < 86400:
            h = seconds // 3600
            if h % 10 == 1 and h != 11:
                return f"{h} час назад"
            elif h % 10 in (2, 3, 4) and h not in (12, 13, 14):
                return f"{h} часа назад"
            return f"{h} часов назад"
        days = seconds // 86400
        if days == 1:
            return "вчера"
        if days < 7:
            if days % 10 == 1 and days != 11:
                return f"{days} день назад"
            elif days % 10 in (2, 3, 4) and days not in (12, 13, 14):
                return f"{days} дня назад"
            return f"{days} дней назад"
        return dt_naive.strftime("%d.%m.%Y")

    return [{"id": r["id"], "title": r["title"], "time": format_time(r["time"])} for r in rows]


@app.delete("/api/notifications")
async def clear_notifications(user: CurrentUser):
    await database.execute(
        "DELETE FROM notifications WHERE user_id=$1",
        user["id"],
    )
    return {"success": True}


# ── Help / FAQ ──

@app.get("/api/help/faq")
async def help_faq():
    rows = await database.fetch(
        """SELECT id, question, answer, category
           FROM faq_items ORDER BY sort_order ASC, id ASC"""
    )
    return [dict(r) for r in rows]


# ── Course Discussions ──

@app.get("/api/courses/{course_id}/discussions")
async def get_discussions(course_id: int, request: Request):
    step_id_raw = request.query_params.get("step_id")
    step_id = int(step_id_raw) if step_id_raw and step_id_raw.isdigit() else None

    if step_id is not None:
        rows = await database.fetch(
            """SELECT dm.id, dm.user_id AS "userId", u.full_name AS "userName",
                      u.avatar_url AS "avatarUrl", dm.message,
                      dm.created_at AS "createdAt"
               FROM discussion_messages dm
               JOIN users u ON u.id = dm.user_id
               WHERE dm.course_id = $1 AND dm.step_id = $2
               ORDER BY dm.created_at ASC
               LIMIT 100""",
            course_id, step_id,
        )
    else:
        rows = await database.fetch(
            """SELECT dm.id, dm.user_id AS "userId", u.full_name AS "userName",
                      u.avatar_url AS "avatarUrl", dm.message,
                      dm.created_at AS "createdAt"
               FROM discussion_messages dm
               JOIN users u ON u.id = dm.user_id
               WHERE dm.course_id = $1 AND dm.step_id IS NULL
               ORDER BY dm.created_at ASC
               LIMIT 100""",
            course_id,
        )
    return [
        {
            "id": r["id"],
            "userId": r["userId"],
            "userName": r["userName"],
            "avatarUrl": r["avatarUrl"] or "",
            "message": r["message"],
            "createdAt": r["createdAt"].isoformat() if r["createdAt"] else None,
        }
        for r in rows
    ]


@app.post("/api/courses/{course_id}/discussions")
async def post_discussion(course_id: int, request: Request, user: CurrentUser):
    body = await request.json()
    message = (body.get("message") or "").strip()
    step_id = body.get("step_id") or None
    if step_id is not None:
        try:
            step_id = int(step_id)
        except (ValueError, TypeError):
            step_id = None
    if not message:
        return JSONResponse(status_code=400, content={"error": "Сообщение не может быть пустым"})
    row = await database.fetchrow(
        """INSERT INTO discussion_messages (course_id, step_id, user_id, message)
           VALUES ($1, $2, $3, $4)
           RETURNING id, created_at AS "createdAt" """,
        course_id,
        step_id,
        user["id"],
        message,
    )
    profile = await database.fetchrow(
        "SELECT full_name, avatar_url FROM users WHERE id=$1 LIMIT 1",
        user["id"],
    )
    return {
        "id": row["id"],
        "userId": user["id"],
        "userName": (profile["full_name"] if profile else "") or user.get("fullName", ""),
        "avatarUrl": (profile["avatar_url"] if profile else "") or "",
        "message": message,
        "createdAt": row["createdAt"].isoformat() if row["createdAt"] else None,
    }


app.include_router(auth_router)
app.include_router(account_router)
app.include_router(student_router)
app.include_router(teacher_admin_router)
app.include_router(ai_router)

# ── Serve uploaded cover images as static files ──
_covers_dir = Path(__file__).resolve().parent.parent / "covers"
_covers_dir.mkdir(parents=True, exist_ok=True)
app.mount("/covers", StaticFiles(directory=str(_covers_dir)), name="covers")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Внутренняя ошибка сервера"})
