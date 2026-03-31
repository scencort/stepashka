from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, Depends, Request


from app import db
from app.deps import CurrentUser, require_roles
from app.schemas import SubmitBody, EnrollmentRequestBody, WeeklyGoalBody
from app.services import write_audit, evaluate_code_by_tests, utcnow

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
        from datetime import timedelta
        check = (today - timedelta(days=i)).isoformat()
        if check in days_set:
            streak += 1
        else:
            break

    active = [dict(e) for e in enrollments if e["status"] == "active"]
    avg_progress = round(sum(e["progressPercent"] or 0 for e in active) / len(active)) if active else 0
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
            uid, active_ids,
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
        "SELECT weekly_goal FROM account_profiles WHERE user_id=$1", uid,
    )
    weekly_goal = wg if wg and 3 <= wg <= 50 else 10
    remaining_course = max(total_steps - completed_steps, 0)
    steps_per_day = completed_steps_week / 7 if completed_steps_week else 0
    forecast = 0 if remaining_course == 0 else int(remaining_course / max(steps_per_day, 0.5)) + 1

    audits = await db.fetch(
        """SELECT id, action, target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
           FROM audit_logs WHERE actor_user_id=$1 ORDER BY created_at DESC LIMIT 5""",
        uid,
    )

    ACTION_LABELS: dict[str, str] = {
        "user.register": "Регистрация аккаунта",
        "auth.login": "Вход в аккаунт",
        "auth.login.2fa": "Вход через двухфакторную аутентификацию",
        "auth.logout": "Выход из аккаунта",
        "auth.password_reset_requested": "Запрос сброса пароля",
        "auth.password_reset_completed": "Пароль успешно сброшен",
        "account.profile.update": "Обновление профиля",
        "account.email.confirmed": "Email подтверждён",
        "account.password.changed": "Пароль изменён",
        "account.session.revoked": "Сессия завершена",
        "account.logout_all": "Выход со всех устройств",
        "account.2fa.enabled": "Двухфакторная аутентификация включена",
        "account.2fa.disabled": "Двухфакторная аутентификация отключена",
        "enrollment.create": "Запись на курс",
        "enrollment_request.create": "Заявка на курс",
        "ai.chat.request": "Вопрос AI-ассистенту",
        "ai.chat.stream.request": "Диалог с AI-ассистентом",
        "ai.review.check": "Проверка кода через AI",
        "submission.create": "Отправка решения",
    }

    activities = []
    for r in audits:
        label = ACTION_LABELS.get(r["action"], r["action"].replace(".", " → ").capitalize())
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
        {"title": f"Следующий дедлайн: {deadline_row['title']}", "text": f"Урок: {deadline_row['lessonTitle']}"}
        if deadline_row
        else {"title": "Дедлайнов пока нет", "text": "Вы завершили все назначенные задания в активных курсах."}
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
        "courses": [{"id": e["courseId"], "title": e["title"], "progress": e["progressPercent"] or 0} for e in active[:6]],
        "activities": activities,
        "deadline": deadline,
    }


@router.patch("/weekly-goal", dependencies=[AllRoles])
async def update_weekly_goal(body: WeeklyGoalBody, user: CurrentUser):
    await db.execute(
        "UPDATE account_profiles SET weekly_goal=$1, updated_at=NOW() WHERE user_id=$2",
        body.goal, user["id"],
    )
    return {"goal": body.goal}


@router.post("/enroll/{course_id}", dependencies=[AllRoles])
async def enroll(course_id: int, user: CurrentUser):
    if course_id <= 0:
        return {"error": "Некорректный курс"}

    course = await db.fetchrow(
        "SELECT id, title, status, access_type FROM courses WHERE id=$1 LIMIT 1", course_id
    )
    if not course or course["status"] != "published":
        return {"error": "Курс недоступен для записи"}

    access = course["access_type"] or "open"

    if access == "invite_only":
        return {"error": "Этот курс доступен только по приглашению. Отправьте заявку преподавателю."}

    if access == "moderated":
        existing = await db.fetchrow(
            "SELECT id, status FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
            user["id"], course_id,
        )
        if existing:
            if existing["status"] == "approved":
                pass  # allow enrollment below
            elif existing["status"] == "pending":
                return {"error": "Ваша заявка уже на рассмотрении"}
            else:
                return {"error": "Ваша заявка была отклонена. Свяжитесь с преподавателем."}
        else:
            return {"error": "Для этого курса необходимо сначала отправить заявку на вступление."}

    await db.execute(
        """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
           VALUES ($1, $2, 'active', 0) ON CONFLICT (user_id, course_id) DO NOTHING""",
        user["id"], course_id,
    )
    await db.execute(
        "UPDATE courses SET students_count = students_count + 1 WHERE id=$1",
        course_id,
    )
    await db.execute(
        "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
        user["id"], "Вы успешно записаны на курс", course["title"],
    )
    await write_audit(user["id"], "enrollment.create", "course", course_id)
    return {"success": True}


@router.post("/courses/{course_id}/request-enrollment", dependencies=[AllRoles])
async def request_enrollment(course_id: int, body: EnrollmentRequestBody, user: CurrentUser):
    course = await db.fetchrow(
        "SELECT id, title, status, access_type FROM courses WHERE id=$1 LIMIT 1", course_id
    )
    if not course or course["status"] != "published":
        return {"error": "Курс недоступен"}

    access = course["access_type"] or "open"
    if access == "open":
        return {"error": "Этот курс открытый — просто запишитесь на него."}

    already_enrolled = await db.fetchrow(
        "SELECT id FROM enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"], course_id,
    )
    if already_enrolled:
        return {"error": "Вы уже записаны на этот курс"}

    existing = await db.fetchrow(
        "SELECT id, status FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"], course_id,
    )
    if existing:
        if existing["status"] == "pending":
            return {"error": "Заявка уже отправлена и ожидает рассмотрения"}
        if existing["status"] == "approved":
            return {"error": "Заявка уже одобрена — запишитесь на курс"}
        # rejected — allow resend
        await db.execute(
            "UPDATE enrollment_requests SET status='pending', message=$1, teacher_comment=NULL, updated_at=NOW() WHERE id=$2",
            body.message, existing["id"],
        )
        return {"success": True, "message": "Заявка повторно отправлена"}

    await db.execute(
        "INSERT INTO enrollment_requests (user_id, course_id, message) VALUES ($1, $2, $3)",
        user["id"], course_id, body.message,
    )
    # Notify teacher
    teacher_id = await db.fetchval("SELECT teacher_id FROM courses WHERE id=$1", course_id)
    if teacher_id:
        await db.execute(
            "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
            teacher_id, "Новая заявка на курс",
            f"Студент {user.get('full_name', user['email'])} подал заявку на курс «{course['title']}»",
        )
    await write_audit(user["id"], "enrollment_request.create", "course", course_id)
    return {"success": True, "message": "Заявка отправлена"}


@router.get("/courses/{course_id}/enrollment-status", dependencies=[AllRoles])
async def enrollment_status(course_id: int, user: CurrentUser):
    enrollment = await db.fetchrow(
        "SELECT id, status, progress_percent FROM enrollments WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"], course_id,
    )
    if enrollment:
        return {"enrolled": True, "status": enrollment["status"], "progress": enrollment["progress_percent"]}

    request_row = await db.fetchrow(
        "SELECT id, status, teacher_comment FROM enrollment_requests WHERE user_id=$1 AND course_id=$2 LIMIT 1",
        user["id"], course_id,
    )
    if request_row:
        return {"enrolled": False, "requestStatus": request_row["status"], "teacherComment": request_row["teacher_comment"]}

    return {"enrolled": False, "requestStatus": None}


@router.get("/courses/{course_id}/steps", dependencies=[AllRoles])
async def get_steps(course_id: int, user: CurrentUser):
    if course_id <= 0:
        return {"error": "Некорректный курс"}

    course_row = await db.fetchrow(
        """SELECT c.id, c.title, c.level, c.category, c.students_count AS "studentsCount", u.full_name AS author
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
            """SELECT id, lesson_id AS "lessonId", title, description
               FROM assignments WHERE lesson_id = ANY($1::int[]) ORDER BY id ASC""",
            lesson_ids,
        )

    order = 1
    steps = []
    for lesson in lessons:
        steps.append({
            "id": lesson["id"] * 10 + 1,
            "title": f"{lesson['title']}: теория",
            "kind": "theory",
            "taskTypeLabel": "Теория",
            "theoryText": lesson["contentText"] or "Изучите материал урока.",
            "options": [],
            "stepOrder": order,
            "xp": 10,
        })
        order += 1

        steps.append({
            "id": lesson["id"] * 10 + 2,
            "title": f"{lesson['title']}: мини-тест",
            "kind": "quiz",
            "taskTypeLabel": "Тестовое задание",
            "theoryText": "Выберите вариант ответа и проверьте знание теории.",
            "options": ["Понял материал", "Нужно повторить", "Нужны примеры"],
            "stepOrder": order,
            "xp": 12,
        })
        order += 1

        assignment = next((a for a in assignments_rows if a["lessonId"] == lesson["id"]), None)
        if assignment:
            steps.append({
                "id": lesson["id"] * 10 + 3,
                "title": f"{assignment['title']}: практика",
                "kind": "code",
                "taskTypeLabel": "Кодовое задание",
                "theoryText": assignment["description"] or "Решите задание.",
                "checks": [],
                "checkCount": 0,
                "options": [],
                "stepOrder": order,
                "xp": 20,
            })
            order += 1

    progress_rows = await db.fetch(
        """SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
           FROM step_progress WHERE user_id=$1 AND course_id=$2""",
        user["id"], course_id,
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
            "author": course_row["author"] or "Stepashka Team",
        },
        "steps": steps,
        "progress": [dict(r) for r in progress_rows],
        "summary": {"total": total, "completed": completed, "xp": xp, "percent": percent},
    }


@router.post("/steps/{step_id}/check", dependencies=[AllRoles])
async def check_step(step_id: int, request: Request, user: CurrentUser):
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
    kind = "theory"
    passed = False
    feedback = ""
    score = 0
    assignment_id = None
    check_results = None

    if slot == 1:
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
        user["id"], step_id,
    )

    if existing:
        await db.execute(
            """UPDATE step_progress
               SET status=$1, score=$2, answer_text=$3, attempts=$4, completed_at=$5, updated_at=NOW(),
                   course_id=$6, step_kind=$7, lesson_id=$8, assignment_id=$9
               WHERE id=$10""",
            "completed" if passed else "started",
            score, answer, (existing["attempts"] or 0) + 1,
            utcnow() if passed else None,
            course_id, kind, lesson_id, assignment_id,
            existing["id"],
        )
    else:
        await db.execute(
            """INSERT INTO step_progress (user_id, course_id, step_id, step_kind, lesson_id, assignment_id, status, score, answer_text, attempts, completed_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10)""",
            user["id"], course_id, step_id, kind, lesson_id, assignment_id,
            "completed" if passed else "started",
            score, answer,
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
        user["id"], course_id,
    )
    total_val = total_val or 0
    completed_val = completed_val or 0
    percent = round(completed_val / total_val * 100) if total_val else 0

    await db.execute(
        "UPDATE enrollments SET progress_percent=$1 WHERE user_id=$2 AND course_id=$3",
        percent, user["id"], course_id,
    )

    cur = await db.fetchrow(
        """SELECT step_id AS "stepId", status, score, attempts, answer_text AS "answerText", completed_at AS "completedAt"
           FROM step_progress WHERE user_id=$1 AND step_id=$2 LIMIT 1""",
        user["id"], step_id,
    )

    return {
        "passed": passed,
        "feedback": feedback,
        "checkResults": check_results,
        "progress": dict(cur) if cur else None,
        "courseSummary": {"total": total_val, "completed": completed_val, "percent": percent},
    }
