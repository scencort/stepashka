from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Request


from app import db
from app.deps import CurrentUser, require_roles
from app.schemas import (
    CourseBody, AssignmentBody, SubmitBody, RoleBody,
    EnrollmentRequestDecisionBody, CourseModuleBody, LessonBody, StepBody,
)
from app.services import (
    write_audit, estimate_code_quality, estimate_essay,
)

router = APIRouter(prefix="/api", tags=["teacher", "admin"])

TeacherDep = Depends(require_roles("teacher", "admin"))
AdminDep = Depends(require_roles("admin"))


# ---- Teacher ----

@router.get("/teacher/courses", dependencies=[TeacherDep])
async def teacher_courses(user: CurrentUser):
    rows = await db.fetch(
        """SELECT id, title, slug, description, level, category, price_cents AS "priceCents",
                  status, access_type AS "accessType", cover_url AS "coverUrl",
                  students_count AS "studentsCount", rating
           FROM courses
           WHERE teacher_id=$1 OR $2='admin'
           ORDER BY created_at DESC""",
        user["id"], user["role"],
    )
    return [dict(r) for r in rows]


@router.post("/teacher/courses", status_code=201, dependencies=[TeacherDep])
async def create_course(body: CourseBody, user: CurrentUser):
    row = await db.fetchrow(
        """INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, access_type, cover_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_review',$8,$9)
           RETURNING id, title, slug, description, level, category, price_cents AS "priceCents",
                     status, access_type AS "accessType", cover_url AS "coverUrl" """,
        body.title, body.slug, body.description, body.level, body.category,
        body.priceCents, user["id"], body.accessType, body.coverUrl,
    )
    await write_audit(user["id"], "course.create", "course", row["id"], {"slug": body.slug})
    return dict(row)


@router.patch("/teacher/courses/{course_id}", dependencies=[TeacherDep])
async def update_course(course_id: int, body: CourseBody, user: CurrentUser):
    row = await db.fetchrow(
        """UPDATE courses SET title=$1, slug=$2, description=$3, level=$4, category=$5,
                  price_cents=$6, access_type=$7, cover_url=$8, updated_at=NOW()
           WHERE id=$9 AND (teacher_id=$10 OR $11='admin')
           RETURNING id, title, slug, description, level, category, price_cents AS "priceCents",
                     status, access_type AS "accessType", cover_url AS "coverUrl" """,
        body.title, body.slug, body.description, body.level, body.category,
        body.priceCents, body.accessType, body.coverUrl,
        course_id, user["id"], user["role"],
    )
    if not row:
        return {"error": "Курс не найден или нет доступа"}
    await write_audit(user["id"], "course.update", "course", course_id)
    return dict(row)


@router.patch("/teacher/courses/{course_id}/publish", dependencies=[TeacherDep])
async def publish_course(course_id: int, request: Request, user: CurrentUser):
    body = await request.json()
    new_status = body.get("status", "published")
    if new_status not in ("draft", "pending_review", "published", "archived"):
        return {"error": "Некорректный статус"}
    row = await db.fetchrow(
        """UPDATE courses SET status=$1, updated_at=NOW()
           WHERE id=$2 AND (teacher_id=$3 OR $4='admin')
           RETURNING id, title, status""",
        new_status, course_id, user["id"], user["role"],
    )
    if not row:
        return {"error": "Курс не найден или нет доступа"}
    await write_audit(user["id"], "course.status_change", "course", course_id, {"status": new_status})
    return dict(row)


# ---- Course structure: modules, lessons, steps ----

@router.get("/teacher/courses/{course_id}/structure", dependencies=[TeacherDep])
async def course_structure(course_id: int, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id, title FROM courses WHERE id=$1 AND (teacher_id=$2 OR $3='admin') LIMIT 1",
        course_id, user["id"], user["role"],
    )
    if not course:
        return {"error": "Курс не найден"}

    modules = await db.fetch(
        """SELECT id, title, module_order AS "moduleOrder"
           FROM course_modules WHERE course_id=$1 ORDER BY module_order ASC""",
        course_id,
    )
    lessons = await db.fetch(
        """SELECT l.id, l.module_id AS "moduleId", l.title, l.lesson_order AS "lessonOrder",
                  l.lesson_type AS "lessonType", l.content_text AS "contentText"
           FROM lessons l INNER JOIN course_modules cm ON cm.id=l.module_id
           WHERE cm.course_id=$1 ORDER BY cm.module_order ASC, l.lesson_order ASC""",
        course_id,
    )
    steps = await db.fetch(
        """SELECT id, lesson_id AS "lessonId", title, step_order AS "stepOrder",
                  step_type AS "stepType", content, xp
           FROM course_steps WHERE course_id=$1 ORDER BY step_order ASC""",
        course_id,
    )
    return {
        "course": dict(course),
        "modules": [dict(m) for m in modules],
        "lessons": [dict(l) for l in lessons],
        "steps": [dict(s) for s in steps],
    }


@router.post("/teacher/courses/{course_id}/modules", status_code=201, dependencies=[TeacherDep])
async def create_module(course_id: int, body: CourseModuleBody, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id FROM courses WHERE id=$1 AND (teacher_id=$2 OR $3='admin') LIMIT 1",
        course_id, user["id"], user["role"],
    )
    if not course:
        return {"error": "Курс не найден"}
    row = await db.fetchrow(
        """INSERT INTO course_modules (course_id, title, module_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (course_id, module_order) DO UPDATE SET title=EXCLUDED.title
           RETURNING id, title, module_order AS "moduleOrder" """,
        course_id, body.title, body.moduleOrder,
    )
    return dict(row)


@router.post("/teacher/courses/{course_id}/lessons", status_code=201, dependencies=[TeacherDep])
async def create_lesson(course_id: int, body: LessonBody, user: CurrentUser):
    mod = await db.fetchrow(
        """SELECT cm.id FROM course_modules cm
           INNER JOIN courses c ON c.id=cm.course_id
           WHERE cm.id=$1 AND c.id=$2 AND (c.teacher_id=$3 OR $4='admin') LIMIT 1""",
        body.moduleId, course_id, user["id"], user["role"],
    )
    if not mod:
        return {"error": "Модуль не найден"}
    row = await db.fetchrow(
        """INSERT INTO lessons (module_id, title, lesson_order, lesson_type, content_text)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (module_id, lesson_order) DO UPDATE SET title=EXCLUDED.title, content_text=EXCLUDED.content_text
           RETURNING id, module_id AS "moduleId", title, lesson_order AS "lessonOrder",
                     lesson_type AS "lessonType", content_text AS "contentText" """,
        body.moduleId, body.title, body.lessonOrder, body.lessonType, body.contentText,
    )
    return dict(row)


@router.post("/teacher/courses/{course_id}/steps", status_code=201, dependencies=[TeacherDep])
async def create_step(course_id: int, body: StepBody, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id FROM courses WHERE id=$1 AND (teacher_id=$2 OR $3='admin') LIMIT 1",
        course_id, user["id"], user["role"],
    )
    if not course:
        return {"error": "Курс не найден"}
    row = await db.fetchrow(
        """INSERT INTO course_steps (course_id, lesson_id, title, step_order, step_type, content, xp)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING id, lesson_id AS "lessonId", title, step_order AS "stepOrder",
                     step_type AS "stepType", content, xp""",
        course_id, body.lessonId, body.title, body.stepOrder, body.stepType,
        json.dumps(body.content), body.xp,
    )
    return dict(row)


@router.patch("/teacher/steps/{step_id}", dependencies=[TeacherDep])
async def update_step(step_id: int, body: StepBody, user: CurrentUser):
    row = await db.fetchrow(
        """UPDATE course_steps SET title=$1, step_order=$2, step_type=$3,
                  content=$4::jsonb, xp=$5, lesson_id=$6, updated_at=NOW()
           WHERE id=$7
           RETURNING id, lesson_id AS "lessonId", title, step_order AS "stepOrder",
                     step_type AS "stepType", content, xp""",
        body.title, body.stepOrder, body.stepType,
        json.dumps(body.content), body.xp, body.lessonId, step_id,
    )
    if not row:
        return {"error": "Шаг не найден"}
    return dict(row)


@router.delete("/teacher/steps/{step_id}", dependencies=[TeacherDep])
async def delete_step(step_id: int, user: CurrentUser):
    deleted = await db.fetchrow(
        "DELETE FROM course_steps WHERE id=$1 RETURNING id", step_id
    )
    if not deleted:
        return {"error": "Шаг не найден"}
    return {"success": True}


# ---- Enrollment requests management ----

@router.get("/teacher/courses/{course_id}/enrollment-requests", dependencies=[TeacherDep])
async def list_enrollment_requests(course_id: int, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id FROM courses WHERE id=$1 AND (teacher_id=$2 OR $3='admin') LIMIT 1",
        course_id, user["id"], user["role"],
    )
    if not course:
        return {"error": "Курс не найден"}
    rows = await db.fetch(
        """SELECT er.id, er.user_id AS "userId", u.full_name AS "userName", u.email AS "userEmail",
                  er.status, er.message, er.teacher_comment AS "teacherComment",
                  er.created_at AS "createdAt", er.updated_at AS "updatedAt"
           FROM enrollment_requests er
           INNER JOIN users u ON u.id=er.user_id
           WHERE er.course_id=$1
           ORDER BY er.created_at DESC""",
        course_id,
    )
    return [dict(r) for r in rows]


@router.patch("/teacher/enrollment-requests/{request_id}", dependencies=[TeacherDep])
async def decide_enrollment_request(request_id: int, body: EnrollmentRequestDecisionBody, user: CurrentUser):
    er = await db.fetchrow(
        """SELECT er.id, er.user_id, er.course_id, c.teacher_id
           FROM enrollment_requests er INNER JOIN courses c ON c.id=er.course_id
           WHERE er.id=$1 AND er.status='pending' LIMIT 1""",
        request_id,
    )
    if not er:
        return {"error": "Заявка не найдена или уже обработана"}
    if er["teacher_id"] != user["id"] and user["role"] != "admin":
        return {"error": "Нет доступа"}

    await db.execute(
        "UPDATE enrollment_requests SET status=$1, teacher_comment=$2, updated_at=NOW() WHERE id=$3",
        body.status, body.teacherComment, request_id,
    )

    if body.status == "approved":
        await db.execute(
            """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
               VALUES ($1, $2, 'active', 0) ON CONFLICT (user_id, course_id) DO NOTHING""",
            er["user_id"], er["course_id"],
        )
        await db.execute(
            "UPDATE courses SET students_count = students_count + 1 WHERE id=$1",
            er["course_id"],
        )
        await db.execute(
            "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
            er["user_id"], "Заявка одобрена",
            "Ваша заявка на курс была одобрена преподавателем. Теперь вы можете начать обучение!",
        )
    else:
        comment_text = body.teacherComment or "Преподаватель отклонил заявку."
        await db.execute(
            "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
            er["user_id"], "Заявка отклонена", comment_text,
        )

    await write_audit(user["id"], f"enrollment_request.{body.status}", "enrollment_request", request_id)
    return {"success": True, "status": body.status}


# ---- Course enrolled students ----

@router.get("/teacher/courses/{course_id}/students", dependencies=[TeacherDep])
async def course_students(course_id: int, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id FROM courses WHERE id=$1 AND (teacher_id=$2 OR $3='admin') LIMIT 1",
        course_id, user["id"], user["role"],
    )
    if not course:
        return {"error": "Курс не найден"}
    rows = await db.fetch(
        """SELECT e.user_id AS "userId", u.full_name AS "userName", u.email,
                  e.progress_percent AS "progressPercent", e.status, e.created_at AS "enrolledAt"
           FROM enrollments e INNER JOIN users u ON u.id=e.user_id
           WHERE e.course_id=$1 ORDER BY e.created_at DESC""",
        course_id,
    )
    return [dict(r) for r in rows]


@router.post("/teacher/assignments", status_code=201, dependencies=[TeacherDep])
async def create_assignment(body: AssignmentBody, user: CurrentUser):
    row = await db.fetchrow(
        """INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
           RETURNING id, lesson_id AS "lessonId", assignment_type AS "assignmentType", title, description, tests, rubric, max_score AS "maxScore" """,
        body.lessonId, body.assignmentType, body.title, body.description,
        json.dumps(body.tests or []), json.dumps(body.rubric or {}), body.maxScore,
    )
    await write_audit(user["id"], "assignment.create", "assignment", row["id"])
    return dict(row)


@router.get("/teacher/analytics", dependencies=[TeacherDep])
async def teacher_analytics(user: CurrentUser):
    summary = await db.fetchrow(
        """SELECT COUNT(DISTINCT c.id)::int AS "coursesTotal",
                  COUNT(DISTINCT e.user_id)::int AS "studentsTotal",
                  COALESCE(AVG(e.progress_percent),0)::numeric(5,2) AS "avgProgress"
           FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id
           WHERE c.teacher_id=$1 OR $2='admin'""",
        user["id"], user["role"],
    )
    weak = await db.fetch(
        """SELECT l.id, l.title,
                  COUNT(s.id) FILTER (WHERE s.status IN ('failed','manual_review'))::int AS "problemSubmissions"
           FROM lessons l
           LEFT JOIN assignments a ON a.lesson_id=l.id
           LEFT JOIN submissions s ON s.assignment_id=a.id
           GROUP BY l.id, l.title ORDER BY "problemSubmissions" DESC LIMIT 5"""
    )
    return {"summary": dict(summary), "weakLessons": [dict(r) for r in weak]}


# ---- Submissions ----

@router.post("/submissions/{assignment_id}", status_code=201, dependencies=[Depends(require_roles("student", "teacher", "admin"))])
async def submit(assignment_id: int, body: SubmitBody, user: CurrentUser):
    if assignment_id <= 0:
        return {"error": "Некорректное задание"}

    assignment = await db.fetchrow(
        """SELECT id, assignment_type AS "assignmentType", title, rubric, tests, max_score AS "maxScore"
           FROM assignments WHERE id=$1 LIMIT 1""",
        assignment_id,
    )
    if not assignment:
        return {"error": "Задание не найдено"}

    at = assignment["assignmentType"]
    if at == "code":
        tests = assignment["tests"]
        if isinstance(tests, str):
            tests = json.loads(tests)
        base_tests = min(65, len(tests) * 15) if isinstance(tests, list) else 40
        result = estimate_code_quality(body.codeText or "", base_tests)
    elif at == "essay":
        rubric = assignment["rubric"]
        if isinstance(rubric, str):
            rubric = json.loads(rubric)
        result = estimate_essay(body.answerText or "", rubric)
    else:
        sc = min(100, 80 if body.answerText else 40)
        result = {
            "score": sc, "metrics": {"quiz": sc, "plagiarismScore": 0},
            "status": "passed" if sc >= 70 else "failed",
            "feedback": "Ответ принят" if sc >= 70 else "Ответ неполный",
            "hints": ["Проверьте формулировку ответа"],
        }

    saved = await db.fetchrow(
        """INSERT INTO submissions (user_id, assignment_id, answer_text, code_text, score, status, ai_feedback, plagiarism_score, hints)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
           RETURNING id, user_id AS "userId", assignment_id AS "assignmentId", score, status,
                     ai_feedback AS "aiFeedback", plagiarism_score AS "plagiarismScore", hints, created_at AS "createdAt" """,
        user["id"], assignment_id, body.answerText or "", body.codeText or "",
        result["score"], result["status"], result["feedback"],
        result["metrics"].get("plagiarismScore", 0), json.dumps(result.get("hints", [])),
    )
    await write_audit(user["id"], "submission.create", "submission", saved["id"])
    return {"submission": dict(saved), "evaluation": result}


@router.get("/submissions/history", dependencies=[Depends(require_roles("student", "teacher", "admin"))])
async def submissions_history(user: CurrentUser):
    rows = await db.fetch(
        """SELECT s.id, s.assignment_id AS "assignmentId", a.title AS "assignmentTitle", s.score, s.status,
                  s.ai_feedback AS "aiFeedback", s.plagiarism_score AS "plagiarismScore", s.created_at AS "createdAt"
           FROM submissions s INNER JOIN assignments a ON a.id=s.assignment_id
           WHERE s.user_id=$1 OR $2='admin'
           ORDER BY s.created_at DESC LIMIT 100""",
        user["id"], user["role"],
    )
    return [dict(r) for r in rows]


# ---- Admin ----

@router.get("/admin/users", dependencies=[AdminDep])
async def admin_users():
    rows = await db.fetch(
        """SELECT id, email, full_name AS "fullName", role, status, created_at AS "createdAt"
           FROM users ORDER BY id ASC"""
    )
    return [dict(r) for r in rows]


@router.patch("/admin/users/{user_id}/role", dependencies=[AdminDep])
async def admin_set_role(user_id: int, body: RoleBody, user: CurrentUser):
    updated = await db.fetchrow(
        """UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2
           RETURNING id, email, full_name AS "fullName", role, status""",
        body.role, user_id,
    )
    if not updated:
        return {"error": "Пользователь не найден"}
    await write_audit(user["id"], "admin.user.set_role", "user", user_id, {"newRole": body.role})
    return dict(updated)


@router.patch("/admin/users/{user_id}/ban", dependencies=[AdminDep])
async def admin_ban(user_id: int, request: Request, user: CurrentUser):
    body = await request.json()
    banned = bool(body.get("banned", False))
    updated = await db.fetchrow(
        """UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2
           RETURNING id, email, full_name AS "fullName", role, status""",
        "banned" if banned else "active", user_id,
    )
    if not updated:
        return {"error": "Пользователь не найден"}
    await write_audit(user["id"], "admin.user.set_status", "user", user_id, {"banned": banned})
    return dict(updated)


@router.get("/admin/finance", dependencies=[AdminDep])
async def admin_finance():
    fin = await db.fetchrow(
        """SELECT
             COALESCE(SUM(amount_cents) FILTER (WHERE status='paid'),0)::int AS "revenuePaid",
             COALESCE(SUM(amount_cents) FILTER (WHERE status='refunded'),0)::int AS "refunds",
             COUNT(*) FILTER (WHERE status='paid')::int AS "paidTransactions",
             COUNT(*) FILTER (WHERE status='failed')::int AS "failedTransactions"
           FROM payments"""
    )
    top = await db.fetch(
        """SELECT c.id, c.title,
                  COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status='paid'),0)::int AS revenue
           FROM courses c LEFT JOIN payments p ON p.course_id=c.id
           GROUP BY c.id, c.title ORDER BY revenue DESC LIMIT 5"""
    )
    return {"summary": dict(fin), "topCourses": [dict(r) for r in top]}


@router.get("/admin/platform", dependencies=[AdminDep])
async def admin_platform():
    flags = await db.fetch("SELECT id, name, enabled, description FROM feature_flags ORDER BY id ASC")
    audits = await db.fetch(
        """SELECT id, actor_user_id AS "actorUserId", action, target_type AS "targetType",
                  target_id AS "targetId", details, created_at AS "createdAt"
           FROM audit_logs ORDER BY created_at DESC LIMIT 100"""
    )
    return {"flags": [dict(r) for r in flags], "recentAudits": [dict(r) for r in audits]}


@router.patch("/admin/feature-flags/{name}", dependencies=[AdminDep])
async def admin_toggle_flag(name: str, request: Request, user: CurrentUser):
    body = await request.json()
    enabled = bool(body.get("enabled", False))
    updated = await db.fetchrow(
        "UPDATE feature_flags SET enabled=$1 WHERE name=$2 RETURNING id, name, enabled, description",
        enabled, name,
    )
    if not updated:
        return {"error": "Фича не найдена"}
    await write_audit(user["id"], "admin.feature_flag.toggle", "feature_flag", name, {"enabled": enabled})
    return dict(updated)
