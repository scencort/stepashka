from __future__ import annotations

import json
import time
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Request

from app import db, cache
from app.deps import CurrentUser, require_roles
from app.schemas import EnrollmentRequestBody, SubmitBody, WeeklyGoalBody
from app.services import evaluate_code_by_tests, estimate_essay, utcnow, write_audit
from app.routes.ai import _ai_generate

# Track AI rate limit: if we got 429 recently, skip AI calls for a cooldown period
_ai_rate_limited_until: float = 0.0
_AI_COOLDOWN_SECONDS = 120  # 2 minutes cooldown after 429

router = APIRouter(prefix="/api/student", tags=["student"])

AllRoles = Depends(require_roles("student", "teacher", "admin"))


@router.get("/my-progress", dependencies=[AllRoles])
async def my_progress(user: CurrentUser):
    """Return {courseId: progressPercent} for all user enrollments."""
    rows = await db.fetch(
        """SELECT course_id AS "courseId", progress_percent AS "progressPercent"
           FROM enrollments WHERE user_id=$1 AND status='active'""",
        user["id"],
    )
    return {r["courseId"]: r["progressPercent"] or 0 for r in rows}


@router.get("/dashboard", dependencies=[AllRoles])
async def dashboard(user: CurrentUser):
    uid = user["id"]

    enrollments = await db.fetch(
        """SELECT e.course_id AS "courseId", c.title, e.progress_percent AS "progressPercent", e.status
           FROM enrollments e
           INNER JOIN courses c ON c.id = e.course_id
           WHERE e.user_id=$1 ORDER BY e.created_at DESC""",
        uid,
    )

    certs = await db.fetch(
        """SELECT cert_code AS "certCode", course_id AS "courseId", issued_at AS "issuedAt"
           FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC""",
        uid,
    )

    subs_week = await db.fetchval(
        "SELECT COUNT(*)::int FROM submissions WHERE user_id=$1 AND created_at >= NOW()-INTERVAL '7 days'",
        uid,
    )

    daily = await db.fetch(
        """SELECT DISTINCT day FROM (
             SELECT DATE(created_at) AS day FROM submissions WHERE user_id=$1
             UNION
             SELECT DATE(completed_at) AS day FROM step_progress WHERE user_id=$1 AND status='completed' AND completed_at IS NOT NULL
           ) activity ORDER BY day DESC LIMIT 365""",
        uid,
    )

    def to_key(d) -> str:
        if isinstance(d, date):
            return d.isoformat()
        return str(d)[:10]

    days_set = {to_key(r["day"]) for r in daily}
    today = date.today()
    today_key = today.isoformat()
    start_offset = 0 if today_key in days_set else 1

    streak = 0
    for i in range(start_offset, 365):
        check = (today - timedelta(days=i)).isoformat()
        if check in days_set:
            streak += 1
        else:
            break

    active = [dict(e) for e in enrollments if e["status"] == "active"]
    avg_progress = (
        round(sum(e["progressPercent"] or 0 for e in active) / len(active))
        if active
        else 0
    )
    active_ids = [e["courseId"] for e in active]

    continue_step = None
    total_steps = 0
    completed_steps = 0

    if active_ids:
        summary = await db.fetchrow(
            """SELECT COUNT(cs.id)::int AS total,
                      COUNT(cs.id) FILTER (WHERE sp.id IS NOT NULL)::int AS completed
               FROM course_steps cs
               LEFT JOIN step_progress sp ON sp.step_id=cs.id AND sp.user_id=$1 AND sp.status='completed'
               WHERE cs.course_id = ANY($2::int[])""",
            uid,
            active_ids,
        )
        total_steps = summary["total"] or 0
        completed_steps = summary["completed"] or 0

        ns = await db.fetchrow(
            """SELECT cs.course_id AS "courseId", c.title AS "courseTitle",
                      cs.id AS "stepId", cs.title AS "stepTitle", cs.step_order AS "stepOrder"
               FROM enrollments e
               INNER JOIN courses c ON c.id=e.course_id
               INNER JOIN course_steps cs ON cs.course_id=c.id
               LEFT JOIN step_progress sp ON sp.step_id=cs.id AND sp.user_id=$1 AND sp.status='completed'
               WHERE e.user_id=$1 AND e.status='active' AND sp.id IS NULL
               ORDER BY e.progress_percent DESC, cs.step_order ASC LIMIT 1""",
            uid,
        )
        if ns:
            continue_step = {
                "courseId": ns["courseId"],
                "courseTitle": ns["courseTitle"],
                "stepId": ns["stepId"],
                "stepTitle": ns["stepTitle"],
                "stepOrder": ns["stepOrder"],
            }

    csw = await db.fetchval(
        """SELECT COUNT(*)::int FROM step_progress
           WHERE user_id=$1 AND status='completed' AND completed_at IS NOT NULL
                 AND completed_at >= NOW()-INTERVAL '7 days'""",
        uid,
    )
    completed_steps_week = csw or 0

    wg = await db.fetchval(
        "SELECT weekly_goal FROM account_profiles WHERE user_id=$1",
        uid,
    )
    weekly_goal = wg if wg and 3 <= wg <= 50 else 10
    remaining_course = max(total_steps - completed_steps, 0)
    steps_per_day = completed_steps_week / 7 if completed_steps_week else 0
    forecast = (
        0
        if remaining_course == 0
        else int(remaining_course / max(steps_per_day, 0.5)) + 1
    )

    audits = await db.fetch(
        """SELECT al.id, al.action, al.target_type AS "targetType", al.target_id AS "targetId",
                  al.created_at AS "createdAt",
                  CASE WHEN al.target_type='course' THEN c.title ELSE NULL END AS "courseTitle"
           FROM audit_logs al
           LEFT JOIN courses c ON al.target_type = 'course'
               AND al.target_id IS NOT NULL
               AND c.id = al.target_id::bigint
           WHERE al.actor_user_id=$1 ORDER BY al.created_at DESC LIMIT 5""",
        uid,
    )

    ACTION_LABELS: dict[str, str] = {
        "user.register": "Регистрация аккаунта",
        "auth.login": "Вход в аккаунт",
        "auth.logout": "Выход из аккаунта",
        "auth.password_reset_requested": "Запрос сброса пароля",
        "auth.password_reset_completed": "Пароль успешно сброшен",
        "account.profile.update": "Обновление профиля",
        "account.email.confirmed": "Email подтверждён",
        "account.password.changed": "Пароль изменён",
        "account.session.revoked": "Сессия завершена",
        "account.logout_all": "Выход со всех устройств",
        "enrollment.create": "Записался на курс",
        "enrollment_request.create": "Подал заявку на курс",
        "ai.chat.request": "Вопрос AI-ассистенту",
        "ai.chat.stream.request": "Диалог с AI-ассистентом",
        "ai.review.check": "Проверка кода через AI",
        "submission.create": "Отправка решения",
    }

    activities = []
    for r in audits:
        label = ACTION_LABELS.get(
            r["action"], r["action"].replace(".", " → ").capitalize()
        )
        course_title = r["courseTitle"]
        if course_title and r["action"] in ("enrollment.create", "enrollment_request.create"):
            label = f"{label} «{course_title}»"
        created = r["createdAt"]
        ts = created.strftime("%d.%m %H:%M") if created else ""
        activities.append({"id": r["id"], "text": label, "time": ts})

    deadline_row = await db.fetchrow(
        """SELECT a.id, a.title, l.title AS "lessonTitle"
           FROM enrollments e
           INNER JOIN courses c ON c.id=e.course_id
           INNER JOIN course_modules cm ON cm.course_id=c.id
           INNER JOIN lessons l ON l.module_id=cm.id
           INNER JOIN assignments a ON a.lesson_id=l.id
           LEFT JOIN submissions s ON s.assignment_id=a.id AND s.user_id=e.user_id
           WHERE e.user_id=$1 AND e.status='active' AND s.id IS NULL
           ORDER BY a.created_at ASC LIMIT 1""",
        uid,
    )
    deadline = (
        {
            "title": f"Следующий дедлайн: {deadline_row['title']}",
            "text": f"Урок: {deadline_row['lessonTitle']}",
        }
        if deadline_row
        else {
            "title": "Дедлайнов пока нет",
            "text": "Вы завершили все назначенные задания в активных курсах.",
        }
    )

    return {
        "user": user,
        "enrollments": [dict(e) for e in enrollments],
        "certificates": [dict(c) for c in certs],
        "stats": {
            "activeCourses": len(active),
            "streakDays": streak,
            "averageScore": f"{avg_progress}%",
            "tasksWeek": completed_steps_week,
        },
        "continue": continue_step,
        "weeklyPlan": {
            "goalSteps": weekly_goal,
            "completedSteps": completed_steps_week,
            "remainingSteps": max(weekly_goal - completed_steps_week, 0),
            "forecastDays": forecast,
        },
        "courses": [
            {
                "id": e["courseId"],
                "title": e["title"],
                "progress": e["progressPercent"] or 0,
            }
            for e in active[:6]
        ],
        "activities": activities,
        "deadline": deadline,
        "activeDays": sorted(
            [d for d in days_set if d >= (today - timedelta(days=89)).isoformat()]
        ),
    }


@router.patch("/weekly-goal", dependencies=[AllRoles])
async def update_weekly_goal(body: WeeklyGoalBody, user: CurrentUser):
    await db.execute(
        "UPDATE account_profiles SET weekly_goal=$1, updated_at=NOW() WHERE user_id=$2",
        body.goal,
        user["id"],
    )
    return {"goal": body.goal}


@router.post("/enroll/{course_id}", dependencies=[AllRoles])
async def enroll(course_id: int, user: CurrentUser):
    if course_id <= 0:
        return {"error": "Некорректный курс"}

    course = await db.fetchrow(
        "SELECT id, title, status, access_type FROM courses WHERE id=$1 LIMIT 1",
        course_id,
    )
    if not course or course["status"] != "published":
        return {"error": "Курс недоступен для записи"}

    access = course["access_type"] or "open"

    if access == "invite_only":
        return {
            "error": "Этот курс доступен только по приглашению. Отправьте заявку преподавателю."
        }

    if access == "moderated":
        existing = await db.fetchrow(
            "SELECT id, status FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
            user["id"],
            course_id,
        )
        if existing:
            if existing["status"] == "approved":
                pass  # allow enrollment below
            elif existing["status"] == "pending":
                return {"error": "Ваша заявка уже на рассмотрении"}
            else:
                return {
                    "error": "Ваша заявка была отклонена. Свяжитесь с преподавателем."
                }
        else:
            return {
                "error": "Для этого курса необходимо сначала отправить заявку на вступление."
            }

    inserted = await db.fetchrow(
        """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
           VALUES ($1, $2, 'active', 0) ON CONFLICT (user_id, course_id) DO NOTHING
           RETURNING id""",
        user["id"],
        course_id,
    )
    if inserted:
        await db.execute(
            "UPDATE courses SET students_count = students_count + 1 WHERE id=$1",
            course_id,
        )
    await db.execute(
        "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
        user["id"],
        f"Вы записались на курс «{course['title']}»",
        "",
    )
    await write_audit(user["id"], "enrollment.create", "course", course_id)
    return {"success": True}


@router.post("/courses/{course_id}/request-enrollment", dependencies=[AllRoles])
async def request_enrollment(
    course_id: int, body: EnrollmentRequestBody, user: CurrentUser
):
    course = await db.fetchrow(
        "SELECT id, title, status, access_type FROM courses WHERE id=$1 LIMIT 1",
        course_id,
    )
    if not course or course["status"] != "published":
        return {"error": "Курс недоступен"}

    access = course["access_type"] or "open"
    if access == "open":
        return {"error": "Этот курс открытый — просто запишитесь на него."}

    already_enrolled = await db.fetchrow(
        "SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"],
        course_id,
    )
    if already_enrolled:
        return {"error": "Вы уже записаны на этот курс"}

    existing = await db.fetchrow(
        "SELECT id, status FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"],
        course_id,
    )
    if existing:
        if existing["status"] == "pending":
            return {"error": "Заявка уже отправлена и ожидает рассмотрения"}
        if existing["status"] == "approved":
            return {"error": "Заявка уже одобрена — запишитесь на курс"}
        # rejected — allow resend
        await db.execute(
            "UPDATE enrollment_requests SET status='pending', message=$1, teacher_comment='', updated_at=NOW() WHERE id=$2",
            body.message,
            existing["id"],
        )
        return {"success": True, "message": "Заявка повторно отправлена"}

    await db.execute(
        "INSERT INTO enrollment_requests (user_id, course_id, message) VALUES ($1, $2, $3)",
        user["id"],
        course_id,
        body.message,
    )
    # Notify teacher
    teacher_id = await db.fetchval(
        "SELECT teacher_id FROM courses WHERE id=$1", course_id
    )
    if teacher_id:
        await db.execute(
            "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
            teacher_id,
            "Новая заявка на курс",
            f"Студент {user.get('fullName', user['email'])} подал заявку на курс «{course['title']}»",
        )
    await write_audit(user["id"], "enrollment_request.create", "course", course_id)
    return {"success": True, "message": "Заявка отправлена"}


@router.get("/courses/{course_id}/enrollment-status", dependencies=[AllRoles])
async def enrollment_status(course_id: int, user: CurrentUser):
    enrollment = await db.fetchrow(
        "SELECT id, status, progress_percent FROM enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"],
        course_id,
    )
    if enrollment:
        return {
            "enrolled": True,
            "status": enrollment["status"],
            "progress": enrollment["progress_percent"],
        }

    request_row = await db.fetchrow(
        "SELECT id, status, teacher_comment FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"],
        course_id,
    )
    if request_row:
        return {
            "enrolled": False,
            "requestStatus": request_row["status"],
            "teacherComment": request_row["teacher_comment"],
        }

    return {"enrolled": False, "requestStatus": None}


@router.get("/courses/{course_id}/steps", dependencies=[AllRoles])
async def get_steps(course_id: int, user: CurrentUser):
    if course_id <= 0:
        return {"error": "Некорректный курс"}

    course_row = await db.fetchrow(
        """SELECT c.id, c.title, c.level, c.category, c.students_count AS "studentsCount",
                  c.access_type, u.full_name AS author
           FROM courses c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.id=$1 LIMIT 1""",
        course_id,
    )
    if not course_row:
        return {"error": "Курс не найден"}

    lessons = await db.fetch(
        """SELECT l.id, l.title, l.content_text AS "contentText", l.lesson_order AS "lessonOrder",
                  cm.module_order AS "moduleOrder"
           FROM lessons l
           INNER JOIN course_modules cm ON cm.id=l.module_id
           WHERE cm.course_id=$1
           ORDER BY cm.module_order ASC, l.lesson_order ASC""",
        course_id,
    )

    lesson_ids = [l["id"] for l in lessons]
    assignments_rows = []
    if lesson_ids:
        assignments_rows = await db.fetch(
            """SELECT id, lesson_id AS "lessonId", title, description,
                      assignment_type AS "assignmentType", tests
               FROM assignments WHERE lesson_id = ANY($1::int[]) ORDER BY id ASC""",
            lesson_ids,
        )

    order = 1
    steps = []
    for lesson in lessons:
        assignment = next(
            (a for a in assignments_rows if a["lessonId"] == lesson["id"]), None
        )

        theory_text = lesson["contentText"] or "Изучите материал урока."

        if assignment:
            atype = assignment["assignmentType"] or "code"
            desc = assignment["description"] or ""
            tests_raw = assignment["tests"]
            if isinstance(tests_raw, str):
                tests_raw = json.loads(tests_raw)

            if atype == "quiz":
                # Extract and normalize options to plain strings for display
                raw_opts = []
                if tests_raw and isinstance(tests_raw, list):
                    first = tests_raw[0]
                    if isinstance(first, dict):
                        raw_opts = first.get("options", [])
                # Normalize: both old (strings) and new ({text, correct}) formats
                option_strings = []
                for opt in raw_opts:
                    if isinstance(opt, str):
                        option_strings.append(opt)
                    elif isinstance(opt, dict):
                        option_strings.append(str(opt.get("text", "")))
                steps.append({
                    "id": lesson["id"] * 10 + 1,
                    "title": lesson["title"],
                    "kind": "quiz",
                    "taskTypeLabel": "Тест",
                    "theoryText": theory_text,
                    "quizQuestion": desc,
                    "options": option_strings,
                    "stepOrder": order,
                    "xp": 15,
                })
            elif atype == "essay":
                steps.append({
                    "id": lesson["id"] * 10 + 1,
                    "title": lesson["title"],
                    "kind": "essay",
                    "taskTypeLabel": "Эссе",
                    "theoryText": desc,
                    "checks": [],
                    "checkCount": 0,
                    "options": [],
                    "stepOrder": order,
                    "xp": 20,
                })
            else:
                # code assignment
                steps.append({
                    "id": lesson["id"] * 10 + 1,
                    "title": lesson["title"],
                    "kind": "code",
                    "taskTypeLabel": "Практика",
                    "theoryText": theory_text + "\n\n---\n\n" + desc,
                    "checks": [],
                    "checkCount": 0,
                    "options": [],
                    "stepOrder": order,
                    "xp": 25,
                })
        else:
            steps.append({
                "id": lesson["id"] * 10 + 1,
                "title": lesson["title"],
                "kind": "theory",
                "taskTypeLabel": "Теория",
                "theoryText": theory_text,
                "options": [],
                "stepOrder": order,
                "xp": 10,
            })
        order += 1

    progress_rows = await db.fetch(
        """SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
           FROM step_progress WHERE user_id=$1 AND course_id=$2""",
        user["id"],
        course_id,
    )

    completed = sum(1 for r in progress_rows if r["status"] == "completed")
    total = len(steps)
    xp = sum(r["score"] or 0 for r in progress_rows)
    percent = round(completed / total * 100) if total else 0

    return {
        "course": {
            "id": course_row["id"],
            "title": course_row["title"],
            "lessons": total,
            "progress": percent,
            "type": course_row["category"] or "General",
            "level": course_row["level"] or "Beginner",
            "author": course_row["author"] or "Gradus Team",
        },
        "steps": steps,
        "progress": [dict(r) for r in progress_rows],
        "summary": {
            "total": total,
            "completed": completed,
            "xp": xp,
            "percent": percent,
        },
    }


@router.post("/steps/{step_id}/check", dependencies=[AllRoles])
async def check_step(step_id: int, request: Request, user: CurrentUser):
    global _ai_rate_limited_until
    if step_id <= 0:
        return {"error": "Некорректный шаг"}

    body = await request.json()
    answer = str(body.get("answer", "")).strip()
    lesson_id = step_id // 10
    slot = step_id % 10

    lesson = await db.fetchrow(
        """SELECT l.id, l.title, cm.course_id AS "courseId"
           FROM lessons l INNER JOIN course_modules cm ON cm.id=l.module_id
           WHERE l.id=$1 LIMIT 1""",
        lesson_id,
    )
    if not lesson:
        return {"error": "Шаг не найден"}

    course_id = lesson["courseId"]

    # For restricted courses, verify enrollment before allowing submission
    course_access = await db.fetchrow(
        "SELECT access_type FROM courses WHERE id=$1 LIMIT 1",
        course_id,
    )
    if course_access:
        access_type = course_access["access_type"] or "open"
        if access_type in ("invite_only", "moderated"):
            enrolled = await db.fetchrow(
                "SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2 AND status='active' LIMIT 1",
                user["id"],
                course_id,
            )
            if not enrolled:
                return {"error": "Доступ запрещён. Вы не записаны на этот курс."}
    kind = "theory"
    passed = False
    feedback = ""
    score = 0
    assignment_id = None
    check_results = None
    evaluation: dict = {}

    if slot == 1:
        assignment = await db.fetchrow(
            "SELECT id, assignment_type, tests, rubric, description FROM assignments WHERE lesson_id=$1 ORDER BY id ASC LIMIT 1",
            lesson_id,
        )
        if assignment:
            atype = assignment["assignment_type"] or "code"
            assignment_id = assignment["id"]
            task_description = str(assignment["description"] or "").strip()
            tests_data = assignment["tests"] or []
            if isinstance(tests_data, str):
                try:
                    tests_data = json.loads(tests_data)
                except Exception:
                    tests_data = []
            rubric_data = assignment["rubric"] or {}
            if isinstance(rubric_data, str):
                try:
                    rubric_data = json.loads(rubric_data)
                except Exception:
                    rubric_data = {}

            if atype == "quiz":
                kind = "quiz"
                # Find correct answer — support both old and new formats
                correct_answer = None
                if tests_data and isinstance(tests_data, list):
                    first = tests_data[0]
                    if isinstance(first, dict):
                        # Old format: {"options": ["A","B"], "correct": "A"}
                        old_correct = first.get("correct")
                        if old_correct and isinstance(old_correct, str):
                            correct_answer = old_correct
                        else:
                            # New format: {"options": [{"text":"A","correct":true}, ...]}
                            opts = first.get("options", [])
                            for opt in opts:
                                if isinstance(opt, dict) and opt.get("correct"):
                                    correct_answer = str(opt.get("text", ""))
                                    break
                if correct_answer and answer.strip() == correct_answer.strip():
                    passed = True
                    score = 15
                    feedback = "Верно"
                elif answer:
                    passed = False
                    score = 0
                    feedback = "Неверно, попробуйте ещё раз."
                else:
                    passed = False
                    score = 0
                    feedback = "Выберите вариант ответа."

            elif atype == "essay":
                kind = "essay"
                if len(answer) < 20:
                    passed = False
                    score = 0
                    feedback = "Ответ слишком короткий. Напишите развёрнутый ответ."
                    check_results = None
                else:
                    essay_eval = await estimate_essay(answer, rubric_data)
                    passed = essay_eval["status"] == "passed"
                    score = max(0, min(20, round(essay_eval["score"] / 5)))
                    # Short pass/fail message in the feedback box
                    total_score = essay_eval.get("score", 0)
                    feedback = (
                        "Верно"
                        if passed
                        else f"Эссе требует доработки. Набрано {total_score}/100 баллов."
                    )
                    # AI detailed analysis → shown in the robot box
                    ai_feedback = essay_eval.get("feedback", "")
                    ai_strengths = essay_eval.get("strengths", [])
                    ai_improvements = essay_eval.get("improvements", [])
                    ai_hints = essay_eval.get("hints", [])
                    ai_comment_parts = []
                    if ai_feedback:
                        ai_comment_parts.append(ai_feedback)
                    if ai_strengths:
                        ai_comment_parts.append(
                            "ЧТО ХОРОШО:\n" + "\n".join(f"- {s}" for s in ai_strengths)
                        )
                    if ai_improvements:
                        ai_comment_parts.append(
                            "ЧТО ДОРАБОТАТЬ:\n" + "\n".join(f"- {s}" for s in ai_improvements)
                        )
                    elif ai_hints:
                        ai_comment_parts.append("СОВЕТЫ:\n" + "\n".join(f"- {s}" for s in ai_hints))
                    evaluation["aiComment"] = "\n\n".join(ai_comment_parts) if ai_comment_parts else None
                    kw_matches = essay_eval.get("keywordMatches", [])
                    check_results = [
                        {"name": f"Ключевое слово: {m['keyword']}", "passed": m["found"]}
                        for m in kw_matches
                    ] if kw_matches else None

            else:
                kind = "code"
                no_tests = not tests_data

                # --- Redis cache: cache only test evaluation (not AI comment) ---
                step_cache_key = f"gradus:step:{step_id}:{cache.sha256_text(answer)}"
                cached_eval = await cache.get_json(step_cache_key)

                if no_tests:
                    # No tests defined — AI fully evaluates correctness
                    evaluation = {"passed": False, "scorePercent": 0, "feedback": "", "checkResults": None, "aiComment": None}
                    ai_cache_key = f"gradus:ai:{step_id}:{cache.sha256_text(answer)}"
                    cached_ai = await cache.get_json(ai_cache_key)

                    if cached_ai and cached_ai.get("comment") is not None:
                        ai_passed_cached = bool(cached_ai.get("passed", True))
                        evaluation["passed"] = ai_passed_cached
                        evaluation["scorePercent"] = 100 if ai_passed_cached else 0
                        evaluation["feedback"] = "Верно" if ai_passed_cached else "Решение неверное"
                        evaluation["aiComment"] = cached_ai["comment"]  # always show AI comment
                    elif time.monotonic() < _ai_rate_limited_until:
                        # AI in cooldown — run code at least to check syntax
                        base = evaluate_code_by_tests(answer, [])
                        evaluation["passed"] = base["passed"]
                        evaluation["scorePercent"] = base["scorePercent"]
                        evaluation["feedback"] = base["feedback"]
                        evaluation["checkResults"] = base.get("checkResults")
                    else:
                        try:
                            task_ctx = f"Описание задания: {task_description}\n\n" if task_description else ""
                            ai_eval_prompt = (
                                f"Задание: «{lesson['title']}»\n"
                                f"{task_ctx}"
                                f"Код студента:\n```\n{answer[:1500]}\n```\n\n"
                                "СТРОГО проверь: задание выполнено ПОЛНОСТЬЮ и ТОЧНО?\n\n"
                                "КРИТЕРИИ — ВСЕ должны быть выполнены для passed=true:\n"
                                "1. Код производит ИМЕННО тот вывод/результат, который требует задание (не похожий, а точный)\n"
                                "2. Если задание требует вывести строку — print() должен содержать правильный аргумент, print() без аргументов = ОШИБКА\n"
                                "3. Если задание требует конкретное значение/формат — оно должно совпадать точно\n"
                                "4. Код решает именно поставленную задачу, а не что-то похожее\n"
                                "5. Нет логических ошибок (пустой вывод вместо требуемого — это ошибка)\n\n"
                                "ВАЖНО: частично правильный код = passed=false. "
                                "Например: задание 'выведи Привет, Иван' + код 'print()' = passed=false (пустой вывод ≠ 'Привет, Иван').\n\n"
                                "Ответь СТРОГО в JSON без лишнего текста:\n"
                                '{"passed": true/false, "comment": "если passed=true — разбор ЧТО ХОРОШО и ЧТО МОЖНО ДОРАБОТАТЬ; если passed=false — объясни КОНКРЕТНО что неверно (например: функция вызвана без аргументов, вывод пустой вместо требуемого) и в каком направлении думать, НЕ показывай готовое решение"}'
                            )
                            raw_eval = await _ai_generate(
                                ai_eval_prompt,
                                "Ты строгий ментор-программист. Ты не принимаешь частично верные решения. "
                                "Если код не производит ТОЧНО тот результат, который требует задание — ставишь passed=false. "
                                "print() без аргументов — всегда ошибка, если задание требует что-то вывести. "
                                "Обращайся к пользователю напрямую на 'ты'. "
                                "Никогда не упоминай слово 'студент'. "
                                "Пиши ТОЛЬКО на русском языке. "
                                "Отвечаешь только JSON. Без markdown вокруг JSON."
                            )
                            import re as _re
                            json_match = _re.search(r'\{.*\}', raw_eval, _re.DOTALL)
                            if json_match:
                                parsed = json.loads(json_match.group())
                                ai_passed = bool(parsed.get("passed", False))
                                ai_cmt = str(parsed.get("comment", ""))
                            else:
                                ai_passed = False
                                ai_cmt = raw_eval.strip()

                            evaluation["passed"] = ai_passed
                            evaluation["scorePercent"] = 100 if ai_passed else 0
                            evaluation["feedback"] = "Верно" if ai_passed else "Решение неверное"
                            evaluation["aiComment"] = ai_cmt if ai_cmt else ("Верно." if ai_passed else "Решение неверное.")
                            await cache.set_json(
                                ai_cache_key,
                                {"passed": ai_passed, "feedback": evaluation["feedback"], "comment": evaluation["aiComment"]},
                                ttl_seconds=86400,
                            )
                        except Exception as exc:
                            if "429" in str(exc):
                                _ai_rate_limited_until = time.monotonic() + _AI_COOLDOWN_SECONDS
                            # Fallback: just check if code runs
                            base = evaluate_code_by_tests(answer, [])
                            evaluation["passed"] = base["passed"]
                            evaluation["scorePercent"] = base["scorePercent"]
                            evaluation["feedback"] = "Верно" if base["passed"] else "Решение неверное"
                            evaluation["aiComment"] = "Верно." if base["passed"] else "Решение неверное."
                            evaluation["checkResults"] = base.get("checkResults")
                else:
                    if cached_eval:
                        evaluation = cached_eval
                    else:
                        evaluation = evaluate_code_by_tests(answer, tests_data)
                        await cache.set_json(step_cache_key, evaluation, ttl_seconds=3600)

                    # AI review — detailed for both passed and failed
                    has_execution_error = "\n" in evaluation.get("feedback", "")
                    all_passed = evaluation.get("passed", False)
                    evaluation["aiComment"] = None  # will be set below
                    if len(answer) >= 10 and not has_execution_error:
                        ai_cache_key = f"gradus:ai:{step_id}:{cache.sha256_text(answer)}"
                        cached_ai = await cache.get_json(ai_cache_key)
                        if cached_ai and cached_ai.get("comment"):
                            evaluation["aiComment"] = cached_ai["comment"]
                        elif time.monotonic() < _ai_rate_limited_until:
                            evaluation["aiComment"] = "Верно." if all_passed else "Решение неверное."
                        else:
                            try:
                                if all_passed:
                                    ai_prompt = (
                                        f"Задание: «{lesson['title']}»\n\n"
                                        f"Код:\n```\n{answer[:1500]}\n```\n\n"
                                        "Все тесты пройдены.\n\n"
                                        "Напиши развёрнутый разбор по двум блокам.\n\n"
                                        "ЧТО ХОРОШО:\n"
                                        "- назови конкретные конструкции и решения, которые использованы правильно\n"
                                        "- объясни, почему это хороший подход\n"
                                        "- если есть элегантные решения — отметь их отдельно\n\n"
                                        "ЧТО МОЖНО ДОРАБОТАТЬ:\n"
                                        "- укажи конкретные места в коде, которые можно улучшить\n"
                                        "- предложи альтернативные подходы с примером кода\n"
                                        "- упомяни про читаемость, производительность или best practices\n\n"
                                        "Пиши по делу, конкретно, без воды. На русском языке."
                                    )
                                else:
                                    failed_tests = [r for r in (evaluation.get("checkResults") or []) if not r.get("passed")]
                                    tests_info = "\n".join(
                                        f"- {t.get('name', 'Тест')}: ожидалось «{t.get('expected', '?')}», получено «{t.get('output', '?')}»"
                                        for t in failed_tests[:5]
                                    ) if failed_tests else "Не все тесты пройдены."
                                    ai_prompt = (
                                        f"Задание: «{lesson['title']}»\n\n"
                                        f"Код:\n```\n{answer[:1500]}\n```\n\n"
                                        f"Провальные тесты:\n{tests_info}\n\n"
                                        "Объясни конкретно:\n"
                                        "1. В чём именно ошибка в коде\n"
                                        "2. Почему тесты не проходят — разбери логику\n"
                                        "3. В каком направлении думать чтобы исправить (НЕ показывай готовое решение — только наводящие подсказки)\n\n"
                                        "Будь прямым и конкретным. На русском языке."
                                    )
                                ai_comment = await _ai_generate(
                                    ai_prompt,
                                    "Ты строгий ментор-программист на платформе Gradus. "
                                    "Обращайся к пользователю напрямую на 'ты': 'ты написал...', 'у тебя...', 'ты использовал...'. "
                                    "Никогда не упоминай слово 'студент'. "
                                    "Анализируешь ТОЛЬКО предоставленный код, не придумываешь контекст. "
                                    "Пиши ТОЛЬКО на русском языке. Никаких иероглифов, китайских, японских или других символов. "
                                    "Даёшь конкретный и полезный разбор на русском языке. "
                                    "Используй заголовки блоков и дефисы для списков. Без эмодзи."
                                )
                                evaluation["aiComment"] = ai_comment.strip()
                                await cache.set_json(ai_cache_key, {"comment": ai_comment.strip()}, ttl_seconds=86400)
                            except Exception as exc:
                                if "429" in str(exc):
                                    _ai_rate_limited_until = time.monotonic() + _AI_COOLDOWN_SECONDS
                                evaluation["aiComment"] = "Верно." if all_passed else "Решение неверное."

                passed = evaluation["passed"]
                score = 25 if passed else max(0, round(evaluation.get("scorePercent", 0) / 100 * 25))
                feedback = "Верно" if passed else evaluation["feedback"]
                check_results = evaluation.get("checkResults")
        else:
            kind = "theory"
            passed = True
            score = 10
            feedback = "Теоретический шаг отмечен как пройденный"
    elif slot == 2:
        kind = "quiz"
        passed = len(answer) > 0
        score = 12 if passed else 0
        feedback = "Ответ принят" if passed else "Выберите вариант ответа"
    elif slot == 3:
        kind = "code"
        assignment = await db.fetchrow(
            "SELECT id, tests FROM assignments WHERE lesson_id=$1 ORDER BY id ASC LIMIT 1",
            lesson_id,
        )
        assignment_id = assignment["id"] if assignment else None
        tests_data = assignment["tests"] if assignment else []
        if isinstance(tests_data, str):
            tests_data = json.loads(tests_data)
        evaluation = evaluate_code_by_tests(answer, tests_data)
        passed = evaluation["passed"]
        score = 20 if passed else max(0, round(evaluation["scorePercent"] / 100 * 20))
        feedback = evaluation["feedback"]
        check_results = evaluation["checkResults"]
    else:
        return {"error": "Некорректный тип шага"}

    existing = await db.fetchrow(
        "SELECT id, attempts FROM step_progress WHERE user_id=$1 AND step_id=$2 LIMIT 1",
        user["id"],
        step_id,
    )

    if existing:
        await db.execute(
            """UPDATE step_progress
               SET status=$1, score=$2, answer_text=$3, attempts=$4, completed_at=$5, updated_at=NOW(),
                   course_id=$6, step_kind=$7, lesson_id=$8, assignment_id=$9
               WHERE id=$10""",
            "completed" if passed else "started",
            score,
            answer,
            (existing["attempts"] or 0) + 1,
            utcnow() if passed else None,
            course_id,
            kind,
            lesson_id,
            assignment_id,
            existing["id"],
        )
    else:
        await db.execute(
            """INSERT INTO step_progress (user_id, course_id, step_id, step_kind, lesson_id, assignment_id, status, score, answer_text, attempts, completed_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10)""",
            user["id"],
            course_id,
            step_id,
            kind,
            lesson_id,
            assignment_id,
            "completed" if passed else "started",
            score,
            answer,
            utcnow() if passed else None,
        )

    total_val = await db.fetchval(
        """SELECT COUNT(l.id)::int * 2 + COUNT(a.id)::int
           FROM course_modules cm
           LEFT JOIN lessons l ON l.module_id=cm.id
           LEFT JOIN assignments a ON a.lesson_id=l.id
           WHERE cm.course_id=$1""",
        course_id,
    )
    completed_val = await db.fetchval(
        "SELECT COUNT(*)::int FROM step_progress WHERE user_id=$1 AND course_id=$2 AND status='completed'",
        user["id"],
        course_id,
    )
    total_val = total_val or 0
    completed_val = completed_val or 0
    percent = round(completed_val / total_val * 100) if total_val else 0

    await db.execute(
        "UPDATE enrollments SET progress_percent=$1 WHERE user_id=$2 AND course_id=$3",
        percent,
        user["id"],
        course_id,
    )

    cur = await db.fetchrow(
        """SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
           FROM step_progress WHERE user_id=$1 AND step_id=$2 LIMIT 1""",
        user["id"],
        step_id,
    )

    return {
        "passed": passed,
        "feedback": feedback,
        "checkResults": check_results,
        "aiComment": evaluation.get("aiComment") if isinstance(evaluation, dict) else None,
        "progress": dict(cur) if cur else None,
        "courseSummary": {
            "total": total_val,
            "completed": completed_val,
            "percent": percent,
        },
    }


# ── Course rating ─────────────────────────────────────────────────────────────

@router.get("/courses/{course_id}/my-rating", dependencies=[AllRoles])
async def get_my_rating(course_id: int, user: CurrentUser):
    """Return current user's rating for this course (if any) and overall stats."""
    row = await db.fetchrow(
        "SELECT score, comment FROM course_ratings WHERE course_id=$1 AND user_id=$2",
        course_id, user["id"],
    )
    stats = await db.fetchrow(
        "SELECT ROUND(AVG(score)::numeric, 1) AS avg, COUNT(*) AS cnt FROM course_ratings WHERE course_id=$1",
        course_id,
    )
    enrollment = await db.fetchrow(
        "SELECT progress_percent FROM enrollments WHERE course_id=$1 AND user_id=$2 AND status='active'",
        course_id, user["id"],
    )
    return {
        "myScore": row["score"] if row else None,
        "myComment": row["comment"] if row else "",
        "avgRating": float(stats["avg"]) if stats and stats["avg"] else 0,
        "ratingCount": int(stats["cnt"]) if stats else 0,
        "progress": int(enrollment["progress_percent"]) if enrollment else 0,
        "canRate": bool(enrollment and (enrollment["progress_percent"] or 0) >= 75),
    }


@router.post("/courses/{course_id}/rate", dependencies=[AllRoles])
async def rate_course(course_id: int, request: Request, user: CurrentUser):
    """Submit or update a course rating (requires ≥75% progress)."""
    body = await request.json()
    score = int(body.get("score", 0))
    comment = str(body.get("comment", "")).strip()[:500]

    if not (1 <= score <= 5):
        return {"error": "Оценка должна быть от 1 до 5"}

    # Check enrollment & progress
    enrollment = await db.fetchrow(
        "SELECT progress_percent FROM enrollments WHERE course_id=$1 AND user_id=$2 AND status='active'",
        course_id, user["id"],
    )
    if not enrollment:
        return {"error": "Вы не записаны на этот курс"}
    if (enrollment["progress_percent"] or 0) < 75:
        return {"error": "Нужно пройти хотя бы 75% курса, чтобы оставить оценку"}

    # Upsert rating
    await db.execute(
        """INSERT INTO course_ratings (course_id, user_id, score, comment)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (course_id, user_id) DO UPDATE
           SET score=$3, comment=$4, created_at=NOW()""",
        course_id, user["id"], score, comment,
    )

    # Update courses.rating with real average
    await db.execute(
        """UPDATE courses
           SET rating = (SELECT ROUND(AVG(score)::numeric, 2) FROM course_ratings WHERE course_id=$1)
           WHERE id=$1""",
        course_id,
    )

    stats = await db.fetchrow(
        "SELECT ROUND(AVG(score)::numeric, 1) AS avg, COUNT(*) AS cnt FROM course_ratings WHERE course_id=$1",
        course_id,
    )
    return {
        "success": True,
        "avgRating": float(stats["avg"]) if stats and stats["avg"] else 0,
        "ratingCount": int(stats["cnt"]) if stats else 0,
    }
