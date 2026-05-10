from __future__ import annotations

import json
import logging

from app import db
from app.services import hash_password

log = logging.getLogger(__name__)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  language TEXT NOT NULL DEFAULT 'ru',
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT NOT NULL DEFAULT '',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_temp_code_hash TEXT,
  two_factor_temp_expires_at TIMESTAMP,
  pending_email TEXT,
  pending_email_code_hash TEXT,
  pending_email_expires_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  category TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  access_type TEXT NOT NULL DEFAULT 'open' CHECK (access_type IN ('open', 'invite_only', 'moderated')),
  cover_url TEXT NOT NULL DEFAULT '',
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  duration_hours INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_modules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  module_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, module_order)
);

CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL CHECK (lesson_type IN ('video', 'text', 'interactive')),
  content_url TEXT,
  content_text TEXT,
  lesson_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (module_id, lesson_order)
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('code', 'essay', 'quiz')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  max_score INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL DEFAULT '',
  code_text TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'passed', 'failed', 'manual_review')),
  ai_feedback TEXT NOT NULL DEFAULT '',
  plagiarism_score INTEGER NOT NULL DEFAULT 0,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS step_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  step_id INTEGER NOT NULL,
  step_kind TEXT NOT NULL CHECK (step_kind IN ('theory', 'quiz', 'code')),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed')),
  score INTEGER NOT NULL DEFAULT 0,
  answer_text TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, step_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  cert_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RUB',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  provider TEXT NOT NULL DEFAULT 'mockpay',
  external_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS course_steps (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('theory','quiz','code','text_input','matching','sorting','fill_blanks')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discussion_messages (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollment_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  message TEXT NOT NULL DEFAULT '',
  teacher_comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);
"""


MIGRATIONS_SQL = """
ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'open';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE course_steps ADD COLUMN IF NOT EXISTS lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE course_steps ADD COLUMN IF NOT EXISTS step_type TEXT;
ALTER TABLE course_steps ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE course_steps ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 10;
ALTER TABLE course_steps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE step_progress DROP CONSTRAINT IF EXISTS step_progress_step_kind_check;
ALTER TABLE step_progress ALTER COLUMN step_kind DROP NOT NULL;

CREATE TABLE IF NOT EXISTS ai_reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    quality INTEGER NOT NULL DEFAULT 0,
    correctness INTEGER NOT NULL DEFAULT 0,
    style INTEGER NOT NULL DEFAULT 0,
    summary TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS weekly_goal INTEGER NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
    admin_reply TEXT NOT NULL DEFAULT '',
    replied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assignments ALTER COLUMN lesson_id DROP NOT NULL;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE courses ADD CONSTRAINT courses_level_check CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'beginner', 'intermediate', 'advanced'));
UPDATE courses
   SET cover_url = '/covers/' || slug || '.svg'
 WHERE cover_url = '' OR cover_url IS NULL OR cover_url LIKE 'https://picsum%';

CREATE TABLE IF NOT EXISTS faq_items (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);
"""


async def init_db() -> None:
    p = await db.get_pool()
    async with p.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
        try:
            await conn.execute(MIGRATIONS_SQL)
        except Exception as exc:
            log.warning("migrations failed: %s", exc)
    await _seed_users()
    await _seed_profiles()
    await _seed_courses()
    await _seed_course_steps()
    await _seed_enrollments_and_progress()
    await _seed_extra_users()
    await _seed_more_enrollments()
    await _seed_submissions_for_analytics()
    await _seed_payments()
    await _seed_support_tickets()
    await _seed_new_courses()
    await _seed_python_steps_content()
    await _seed_feature_flags()
    await _seed_faq()


async def _seed_users() -> None:
    demo_users = [
        ("admin@gradus.dev", "Admin@12345", "Системный администратор", "admin"),
        ("teacher@gradus.dev", "Teacher@12345", "Ирина Преподаватель", "teacher"),
        ("student@gradus.dev", "Student@12345", "Алексей Студент", "student"),
    ]

    for email, password, full_name, role in demo_users:
        password_hash = hash_password(password)
        await db.execute(
            """INSERT INTO users (email, password_hash, full_name, role, status)
               VALUES ($1, $2, $3, $4, 'active')
               ON CONFLICT (email) DO NOTHING""",
            email,
            password_hash,
            full_name,
            role,
        )


async def _seed_profiles() -> None:
    await db.execute(
        """INSERT INTO account_profiles (user_id)
           SELECT id FROM users
           ON CONFLICT (user_id) DO NOTHING"""
    )


async def _seed_courses() -> None:
    count = await db.fetchval("SELECT COUNT(*)::int FROM courses")
    if count > 0:
        return

    teacher = await db.fetchrow(
        "SELECT id FROM users WHERE email = 'teacher@gradus.dev' LIMIT 1"
    )
    tid = teacher["id"] if teacher else None

    courses_data = [
        (
            "Python: Большой практический курс",
            "python-backend-fastapi",
            "Расширенный курс по Python: много теории, практические кейсы и проверка кода по тестам.",
            "Intermediate",
            "Programming",
            0,
            tid,
            "published",
            4.9,
            980,
            52,
        ),
        (
            "React + TypeScript для продукта",
            "react-typescript-product",
            "Создание production фронтенда с архитектурой и тестами.",
            "Intermediate",
            "Programming",
            199000,
            tid,
            "published",
            4.8,
            1180,
            36,
        ),
        (
            "DevOps: Docker, CI/CD, Monitoring",
            "devops-docker-cicd-monitoring",
            "Контейнеризация, деплой и наблюдаемость в реальных проектах.",
            "Advanced",
            "DevOps",
            329000,
            tid,
            "published",
            4.7,
            760,
            48,
        ),
        (
            "UI/UX Design Практика",
            "ui-ux-practice",
            "UX-исследования, дизайн-система и передача макетов в разработку.",
            "Beginner",
            "Design",
            179000,
            tid,
            "pending_review",
            4.6,
            390,
            28,
        ),
        (
            "Data Science: прикладной ML",
            "data-science-applied-ml",
            "Полный цикл ML-проекта: от EDA до продакшн-метрик.",
            "Advanced",
            "Data Science",
            359000,
            tid,
            "published",
            4.9,
            540,
            52,
        ),
        (
            "QA Engineer Pro",
            "qa-engineer-pro",
            "Тест-дизайн, API/UI автотесты и интеграция в CI.",
            "Intermediate",
            "QA",
            189000,
            tid,
            "published",
            4.8,
            880,
            34,
        ),
        (
            "JavaScript Backend: Node.js API",
            "javascript-nodejs-api",
            "Курс по JavaScript/Node.js: роутинг, валидация, middleware и тесты API.",
            "Intermediate",
            "Programming",
            219000,
            tid,
            "published",
            4.8,
            910,
            44,
        ),
        (
            "Go Backend Fundamentals",
            "go-backend-fundamentals",
            "Практика на Go: структура проекта, HTTP handlers и работа со структурами данных.",
            "Intermediate",
            "Programming",
            229000,
            tid,
            "published",
            4.7,
            620,
            40,
        ),
    ]

    for c in courses_data:
        await db.execute(
            """INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (slug) DO NOTHING""",
            *c,
        )

    # --- Python course modules, lessons, assignments ---
    python_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='python-backend-fastapi'"
    )
    if not python_id:
        return

    modules = [
        (1, "База Python: синтаксис и типы"),
        (2, "Условия, циклы и функции"),
        (3, "Коллекции, строки и ошибки"),
        (4, "ООП и модули"),
        (5, "FastAPI: маршруты и валидация"),
        (6, "База данных и SQLAlchemy"),
        (7, "Тестирование и отладка"),
        (8, "Проектный мини-кейс"),
    ]

    mod_ids: dict[int, int] = {}
    for order, title in modules:
        mid = await db.fetchval(
            """INSERT INTO course_modules (course_id, title, module_order)
               VALUES ($1, $2, $3)
               ON CONFLICT (course_id, module_order) DO UPDATE SET title=EXCLUDED.title
               RETURNING id""",
            python_id,
            title,
            order,
        )
        mod_ids[order] = mid

    lessons_data = [
        (
            1,
            1,
            "Переменные, типы и приведение",
            "text",
            "Python динамически типизирован, но это не отменяет аккуратную работу с типами. Разбираем int, float, str, bool, приведение типов и типичные ошибки при смешивании строк и чисел.",
        ),
        (
            1,
            2,
            "Индексация, срезы и строки",
            "text",
            "Подробно изучаем индексацию с нуля, отрицательные индексы, срезы и операции над строками.",
        ),
        (
            2,
            1,
            "Условия и логические выражения",
            "text",
            "Разбираем if/elif/else, приоритет операторов, составные условия и читаемость кода.",
        ),
        (
            2,
            2,
            "Циклы for/while и шаблон елочки",
            "interactive",
            "Учимся писать циклы и формировать текстовый вывод построчно.",
        ),
        (
            2,
            3,
            "Функции, аргументы и return",
            "text",
            "Пишем функции с позиционными и именованными аргументами, разбираем return, области видимости.",
        ),
        (
            3,
            1,
            "Списки, словари, множества",
            "text",
            "Сравниваем коллекции Python, выбираем структуры данных под задачу.",
        ),
        (
            3,
            2,
            "Исключения и защищенный код",
            "text",
            "Разбираем try/except/finally, типы исключений и стратегию обработки ошибок в API.",
        ),
        (
            4,
            1,
            "ООП: классы и методы",
            "text",
            "Практика с классами, self, инкапсуляцией и простым наследованием.",
        ),
        (
            4,
            2,
            "Модули и структура проекта",
            "text",
            "Структурируем проект: package layout, импорты, __init__.py и разделение ответственности.",
        ),
        (
            5,
            1,
            "FastAPI роуты и схемы Pydantic",
            "interactive",
            "Создаем endpoint, описываем модели запросов и ответов, делаем базовую валидацию payload через Pydantic.",
        ),
        (
            5,
            2,
            "HTTP-ошибки и статус-коды",
            "text",
            "Учимся правильно возвращать 200/201/400/404/422/500.",
        ),
        (
            6,
            1,
            "SQLAlchemy модели и CRUD",
            "interactive",
            "Базовое моделирование сущностей, создание записей, чтение и обновление.",
        ),
        (
            7,
            1,
            "Тесты на pytest: основы",
            "text",
            "Пишем unit- и интеграционные тесты, проверяем сценарии успеха и ошибок.",
        ),
        (
            8,
            1,
            "Мини-проект: API заметок",
            "interactive",
            "Собираем небольшой API-сервис заметок с валидацией и тестами.",
        ),
    ]

    lesson_ids: dict[str, int] = {}
    for mod_order, lesson_order, title, ltype, text in lessons_data:
        mid = mod_ids.get(mod_order)
        if not mid:
            continue
        lid = await db.fetchval(
            """INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (module_id, lesson_order) DO UPDATE SET title=EXCLUDED.title, content_text=EXCLUDED.content_text
               RETURNING id""",
            mid,
            title,
            ltype,
            text,
            lesson_order,
        )
        lesson_ids[f"{mod_order}:{lesson_order}"] = lid

    assignments_data = [
        (
            "2:2",
            "Елочка через цикл",
            "code",
            "Напишите цикл, который печатает елочку минимум из двух строк.",
            [
                {
                    "name": "Есть цикл и print",
                    "type": "includesAll",
                    "tokens": ["for", "print"],
                },
                {"name": "Есть символ *", "type": "regex", "pattern": "\\*"},
                {"name": "Елочка 1..2", "type": "treePattern", "levels": [1, 2]},
            ],
            {"tests": 70, "quality": 15, "style": 15},
            100,
        ),
        (
            "5:1",
            "FastAPI endpoint c валидацией",
            "code",
            "Реализуйте endpoint POST /orders с валидацией входных данных.",
            [
                {
                    "name": "Используется FastAPI",
                    "type": "includesAny",
                    "tokens": ["FastAPI", "fastapi"],
                },
                {
                    "name": "Есть декоратор post",
                    "type": "regex",
                    "pattern": "@app\\.post|@router\\.post",
                },
                {
                    "name": "Есть валидация схемы",
                    "type": "includesAny",
                    "tokens": ["BaseModel", "pydantic"],
                },
            ],
            {"tests": 60, "quality": 20, "style": 20},
            100,
        ),
        (
            "6:1",
            "CRUD для сущности Product",
            "code",
            "Добавьте CRUD-операции для Product с использованием SQLAlchemy.",
            [
                {
                    "name": "Есть SQLAlchemy модель",
                    "type": "includesAny",
                    "tokens": ["declarative_base", "Mapped", "Column"],
                },
                {
                    "name": "Есть создание записи",
                    "type": "includesAny",
                    "tokens": ["add(", "session.add"],
                },
                {
                    "name": "Есть коммит",
                    "type": "includesAny",
                    "tokens": ["commit(", "session.commit"],
                },
            ],
            {"tests": 60, "quality": 20, "style": 20},
            100,
        ),
        (
            "8:1",
            "Мини-проект API заметок",
            "code",
            "Сделайте API заметок с endpoint для создания и получения списка.",
            [
                {
                    "name": "Есть минимум два endpoint",
                    "type": "minCountRegex",
                    "pattern": "@app\\.(get|post)|@router\\.(get|post)",
                    "min": 2,
                },
                {
                    "name": "Есть список заметок",
                    "type": "includesAny",
                    "tokens": ["notes", "list_notes", "get_notes"],
                },
                {
                    "name": "Есть создание заметки",
                    "type": "includesAny",
                    "tokens": ["create_note", "post_note", "add_note"],
                },
            ],
            {"tests": 65, "quality": 20, "style": 15},
            100,
        ),
    ]

    for key, title, atype, desc, tests, rubric, max_score in assignments_data:
        lid = lesson_ids.get(key)
        if not lid:
            continue
        exists = await db.fetchval(
            "SELECT id FROM assignments WHERE lesson_id=$1 AND title=$2 LIMIT 1",
            lid,
            title,
        )
        tests_json = json.dumps(tests)
        rubric_json = json.dumps(rubric)
        if exists:
            await db.execute(
                """UPDATE assignments SET assignment_type=$1, description=$2, tests=$3::jsonb,
                   rubric=$4::jsonb, max_score=$5, updated_at=NOW() WHERE id=$6""",
                atype,
                desc,
                tests_json,
                rubric_json,
                max_score,
                exists,
            )
        else:
            await db.execute(
                """INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
                   VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)""",
                lid,
                atype,
                title,
                desc,
                tests_json,
                rubric_json,
                max_score,
            )


async def _seed_enrollments_and_progress() -> None:
    student = await db.fetchrow(
        "SELECT id FROM users WHERE email='student@gradus.dev' LIMIT 1"
    )
    if not student:
        return
    sid = student["id"]

    python_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='python-backend-fastapi'"
    )
    react_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='react-typescript-product'"
    )

    if python_id:
        await db.execute(
            """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
               VALUES ($1, $2, 'active', 45) ON CONFLICT (user_id, course_id) DO NOTHING""",
            sid,
            python_id,
        )
        await db.execute(
            "UPDATE courses SET students_count = GREATEST(students_count, 1) WHERE id=$1",
            python_id,
        )

    if react_id:
        await db.execute(
            """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
               VALUES ($1, $2, 'active', 20) ON CONFLICT (user_id, course_id) DO NOTHING""",
            sid,
            react_id,
        )
        await db.execute(
            "UPDATE courses SET students_count = GREATEST(students_count, 1) WHERE id=$1",
            react_id,
        )

    assignments = await db.fetch("SELECT id FROM assignments LIMIT 3")
    for a in assignments:
        await db.execute(
            """INSERT INTO submissions (user_id, assignment_id, answer_text, score, status, ai_feedback)
               VALUES ($1, $2, 'print("hello")', 85, 'passed', 'Хорошее решение')
               ON CONFLICT DO NOTHING""",
            sid,
            a["id"],
        )

    await db.execute(
        """INSERT INTO notifications (user_id, title, body)
           SELECT $1, 'Добро пожаловать в Gradus!', 'Начните обучение с курса Python — он уже доступен в вашем профиле.'
           WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id=$1 AND title='Добро пожаловать в Gradus!')""",
        sid,
    )


async def _seed_feature_flags() -> None:
    count = await db.fetchval("SELECT COUNT(*)::int FROM feature_flags")
    if count > 0:
        return
    await db.execute(
        """INSERT INTO feature_flags (name, enabled, description) VALUES
           ('ai_hints', true, 'Подсказки студентам в заданиях'),
           ('marketplace_enabled', true, 'Маркетплейс курсов преподавателей'),
           ('gamification_enabled', true, 'XP, уровни и бейджи')"""
    )


async def _seed_course_steps() -> None:
    """Seed course_steps for Python course so dashboard/steps work correctly."""
    python_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='python-backend-fastapi'"
    )
    if not python_id:
        return

    existing = await db.fetchval(
        "SELECT COUNT(*)::int FROM course_steps WHERE course_id=$1", python_id
    )
    if existing > 0:
        return

    # Get all lessons for python course ordered
    lessons = await db.fetch(
        """SELECT l.id, l.title, l.lesson_type
           FROM lessons l
           INNER JOIN course_modules cm ON cm.id = l.module_id
           WHERE cm.course_id = $1
           ORDER BY cm.module_order ASC, l.lesson_order ASC""",
        python_id,
    )

    step_order = 1
    for lesson in lessons:
        lid = lesson["id"]
        # Theory step for every lesson
        await db.execute(
            """INSERT INTO course_steps (course_id, lesson_id, title, step_order, step_type, content, xp)
               VALUES ($1, $2, $3, $4, 'theory', '{"text": ""}'::jsonb, 10)
               ON CONFLICT DO NOTHING""",
            python_id,
            lid,
            f"Теория: {lesson['title']}",
            step_order,
        )
        step_order += 1

        # Check if lesson has assignment → add code/quiz step
        assignment = await db.fetchrow(
            'SELECT id, assignment_type AS "assignmentType", title FROM assignments WHERE lesson_id=$1 LIMIT 1',
            lid,
        )
        if assignment:
            stype = "code" if assignment["assignmentType"] == "code" else "quiz"
            await db.execute(
                """INSERT INTO course_steps (course_id, lesson_id, title, step_order, step_type, content, xp)
                   VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, 20)
                   ON CONFLICT DO NOTHING""",
                python_id,
                lid,
                assignment["title"],
                step_order,
                stype,
            )
            step_order += 1

    # For other courses add at least 5 placeholder steps each
    other_courses = await db.fetch(
        "SELECT id, title FROM courses WHERE slug != 'python-backend-fastapi' AND status IN ('published', 'pending_review')"
    )
    for course in other_courses:
        cid = course["id"]
        cexisting = await db.fetchval(
            "SELECT COUNT(*)::int FROM course_steps WHERE course_id=$1", cid
        )
        if cexisting > 0:
            continue
        step_titles = [
            "Введение и основы",
            "Практика: первое задание",
            "Углублённая теория",
            "Практика: задание со звёздочкой",
            "Финальное задание модуля",
        ]
        for i, title in enumerate(step_titles, 1):
            stype = "code" if i % 2 == 0 else "theory"
            await db.execute(
                """INSERT INTO course_steps (course_id, lesson_id, title, step_order, step_type, content, xp)
                   VALUES ($1, NULL, $2, $3, $4, '{}'::jsonb, $5)
                   ON CONFLICT DO NOTHING""",
                cid,
                title,
                i,
                stype,
                10 if stype == "theory" else 20,
            )


async def _seed_extra_users() -> None:
    """Add realistic student accounts for community stats."""
    extra_users = [
        ("maria.sidorova@example.com", "Student@12345", "Мария Сидорова", "student"),
        ("dmitry.volkov@example.com", "Student@12345", "Дмитрий Волков", "student"),
        ("elena.kozlova@example.com", "Student@12345", "Елена Козлова", "student"),
        ("andrey.morozov@example.com", "Student@12345", "Андрей Морозов", "student"),
        (
            "svetlana.novikova@example.com",
            "Student@12345",
            "Светлана Новикова",
            "student",
        ),
        ("igor.petrov@example.com", "Student@12345", "Игорь Петров", "student"),
        ("olga.smirnova@example.com", "Student@12345", "Ольга Смирнова", "student"),
        (
            "alexey.kuznetsov@example.com",
            "Student@12345",
            "Алексей Кузнецов",
            "student",
        ),
        ("natalia.ivanova@example.com", "Student@12345", "Наталья Иванова", "student"),
        ("mikhail.sokolov@example.com", "Student@12345", "Михаил Соколов", "student"),
        ("teacher2@gradus.dev", "Teacher@12345", "Андрей Лектор", "teacher"),
    ]
    for email, password, full_name, role in extra_users:
        password_hash = hash_password(password)
        await db.execute(
            """INSERT INTO users (email, password_hash, full_name, role, status)
               VALUES ($1, $2, $3, $4, 'active')
               ON CONFLICT (email) DO NOTHING""",
            email,
            password_hash,
            full_name,
            role,
        )
    await db.execute(
        """INSERT INTO account_profiles (user_id)
           SELECT id FROM users
           ON CONFLICT (user_id) DO NOTHING"""
    )


async def _seed_more_enrollments() -> None:
    """Enroll extra students in courses to get realistic student counts."""
    courses = await db.fetch(
        "SELECT id, slug FROM courses WHERE status IN ('published', 'pending_review') ORDER BY id ASC"
    )
    extra_students = await db.fetch(
        "SELECT id FROM users WHERE email LIKE '%@example.com' ORDER BY id ASC"
    )
    if not courses or not extra_students:
        return

    import random as rnd

    rnd.seed(42)

    for student in extra_students:
        sid = student["id"]
        # Enroll in 1-3 random courses
        chosen = rnd.sample([c["id"] for c in courses], min(3, len(courses)))
        for cid in chosen:
            progress = rnd.randint(10, 95)
            await db.execute(
                """INSERT INTO enrollments (user_id, course_id, status, progress_percent)
                   VALUES ($1, $2, 'active', $3) ON CONFLICT (user_id, course_id) DO NOTHING""",
                sid,
                cid,
                progress,
            )
            await db.execute(
                "UPDATE courses SET students_count = students_count + 1 WHERE id=$1",
                cid,
            )


async def _seed_submissions_for_analytics() -> None:
    """Add submissions with past dates for demo student analytics."""
    from datetime import date, timedelta

    student = await db.fetchrow(
        "SELECT id FROM users WHERE email='student@gradus.dev' LIMIT 1"
    )
    if not student:
        return
    sid = student["id"]

    existing_count = await db.fetchval(
        "SELECT COUNT(*)::int FROM submissions WHERE user_id=$1", sid
    )
    if existing_count >= 15:
        return

    assignments = await db.fetch("SELECT id FROM assignments ORDER BY id ASC LIMIT 5")
    if not assignments:
        return

    a_ids = [a["id"] for a in assignments]
    today = date.today()

    # Realistic score progression over 30 days
    history = [
        (28, 65),
        (27, 68),
        (25, 72),
        (24, 70),
        (22, 75),
        (21, 74),
        (19, 78),
        (18, 80),
        (16, 77),
        (15, 82),
        (13, 84),
        (12, 79),
        (10, 85),
        (9, 83),
        (7, 88),
        (6, 86),
        (4, 90),
        (3, 87),
        (1, 92),
        (0, 91),
    ]

    from datetime import datetime as _dt
    for i, (days_ago, score) in enumerate(history):
        sub_date = today - timedelta(days=days_ago)
        sub_ts = _dt.combine(sub_date, _dt.min.time()).replace(hour=9 + (i % 8))
        a_id = a_ids[i % len(a_ids)]
        status = "passed" if score >= 70 else "failed"
        await db.execute(
            """INSERT INTO submissions
               (user_id, assignment_id, answer_text, code_text, score, status, ai_feedback, created_at, updated_at)
               VALUES ($1, $2, 'print("solution")', 'def solution():\n    pass', $3, $4, 'Хорошее решение', $5, $5)""",
            sid,
            a_id,
            score,
            status,
            sub_ts,
        )

    # Also add step_progress for the Python course
    python_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='python-backend-fastapi'"
    )
    if python_id:
        steps = await db.fetch(
            "SELECT id FROM course_steps WHERE course_id=$1 ORDER BY step_order ASC LIMIT 8",
            python_id,
        )
        from datetime import datetime as _dt2
        for step in steps:
            comp_date = today - timedelta(days=14)
            comp_ts = _dt2.combine(comp_date, _dt2.min.time()).replace(hour=10)
            await db.execute(
                """INSERT INTO step_progress
                   (user_id, course_id, step_id, step_kind, lesson_id, status, score, completed_at, created_at, updated_at)
                   SELECT $1, $2, $3, 'theory', COALESCE(lesson_id, (SELECT id FROM lessons LIMIT 1)), 'completed', 100, $4, $4, $4
                   FROM course_steps WHERE id=$3
                   ON CONFLICT (user_id, step_id) DO NOTHING""",
                sid,
                python_id,
                step["id"],
                comp_ts,
            )


async def _seed_payments() -> None:
    """Add payment records for admin revenue analytics."""
    existing = await db.fetchval("SELECT COUNT(*)::int FROM payments")
    if existing > 0:
        return

    students = await db.fetch(
        "SELECT id FROM users WHERE role='student' ORDER BY id ASC LIMIT 6"
    )
    paid_courses = await db.fetch(
        "SELECT id, price_cents FROM courses WHERE price_cents > 0 AND status='published' ORDER BY id ASC LIMIT 5"
    )
    if not students or not paid_courses:
        return

    import random as rnd
    from datetime import date, timedelta

    rnd.seed(99)

    today = date.today()
    from datetime import datetime as _dt3
    for i, student in enumerate(students):
        for j, course in enumerate(paid_courses[:2]):
            days_ago = rnd.randint(1, 60)
            pay_date = today - timedelta(days=days_ago)
            pay_ts = _dt3.combine(pay_date, _dt3.min.time()).replace(hour=12)
            await db.execute(
                """INSERT INTO payments (user_id, course_id, amount_cents, currency, status, provider, created_at)
                   VALUES ($1, $2, $3, 'RUB', 'paid', 'mockpay', $4)""",
                student["id"],
                course["id"],
                course["price_cents"],
                pay_ts,
            )


async def _seed_support_tickets() -> None:
    """Add sample support tickets for feedback page."""
    existing = await db.fetchval("SELECT COUNT(*)::int FROM support_tickets")
    if existing > 0:
        return

    student = await db.fetchrow(
        "SELECT id FROM users WHERE email='student@gradus.dev' LIMIT 1"
    )
    if not student:
        return
    sid = student["id"]

    tickets = [
        ("Не могу пройти задание по циклам — подсказка не отображается", "new"),
        ("Предложение: добавить тёмную тему в редактор кода", "in_progress"),
        ("Видеоурок по FastAPI не загружается в Safari", "closed"),
    ]
    for message, status in tickets:
        await db.execute(
            """INSERT INTO support_tickets (user_id, message, subject, status)
               VALUES ($1, $2, 'Обращение пользователя', $3)""",
            sid,
            message,
            status,
        )


async def _seed_new_courses() -> None:
    """Add additional courses (languages, etc.) if not already present."""
    teacher = await db.fetchrow(
        "SELECT id FROM users WHERE email = 'teacher@gradus.dev' LIMIT 1"
    )
    t2 = await db.fetchrow(
        "SELECT id FROM users WHERE email = 'teacher2@gradus.dev' LIMIT 1"
    )
    tid = teacher["id"] if teacher else None
    tid2 = t2["id"] if t2 else tid

    new_courses = [
        (
            "Английский язык A1-B1: с нуля до разговорного",
            "english-a1-b1-beginner",
            "Практический курс английского: грамматика, разговор, чтение и письмо. 500+ упражнений с AI-проверкой ответов.",
            "Beginner",
            "Languages",
            50000,
            tid2,
            "published",
            4.8,
            2340,
            40,
        ),
        (
            "Деловой английский B2-C1",
            "business-english-b2",
            "Переговоры, переписка, презентации на английском. Курс для IT-специалистов и менеджеров.",
            "Intermediate",
            "Languages",
            250000,
            tid2,
            "published",
            4.7,
            870,
            30,
        ),
        (
            "SQL и PostgreSQL: от запросов до оптимизации",
            "sql-postgresql-full",
            "Полный курс SQL: SELECT, JOIN, оконные функции, индексы, EXPLAIN ANALYZE и оптимизация запросов.",
            "Beginner",
            "Databases",
            120000,
            tid,
            "published",
            4.9,
            1540,
            28,
        ),
        (
            "Алгоритмы и структуры данных на Python",
            "algorithms-python",
            "Массивы, списки, деревья, графы, сортировки, динамическое программирование. Разбор задач LeetCode.",
            "Intermediate",
            "Programming",
            200000,
            tid,
            "published",
            4.8,
            1220,
            36,
        ),
        (
            "Figma: дизайн интерфейсов с нуля",
            "figma-ui-design",
            "Компоненты, автолейаут, прототипирование, дизайн-система. Практика на реальных проектах.",
            "Beginner",
            "Design",
            150000,
            tid2,
            "published",
            4.6,
            980,
            24,
        ),
        (
            "Machine Learning на практике",
            "machine-learning-practice",
            "Regression, Classification, Clustering, Neural Networks. Sklearn, Pandas, Matplotlib и боевые датасеты.",
            "Intermediate",
            "Data Science",
            300000,
            tid,
            "published",
            4.9,
            730,
            44,
        ),
        (
            "Математика для программистов",
            "math-for-programmers",
            "Линейная алгебра, теория вероятностей, комбинаторика и дискретная математика для разработчиков.",
            "Beginner",
            "Math",
            70000,
            tid2,
            "published",
            4.5,
            1680,
            32,
        ),
        (
            "iOS-разработка на Swift",
            "ios-swift-development",
            "UIKit, SwiftUI, Core Data, работа с API и публикация приложений в App Store.",
            "Intermediate",
            "Mobile",
            450000,
            tid,
            "published",
            4.7,
            420,
            48,
        ),
        (
            "Android разработка на Kotlin",
            "android-kotlin-development",
            "Jetpack Compose, ViewModel, Room, Retrofit, WorkManager и публикация в Google Play.",
            "Intermediate",
            "Mobile",
            450000,
            tid,
            "published",
            4.7,
            380,
            48,
        ),
        (
            "Основы кибербезопасности",
            "cybersecurity-basics",
            "OWASP Top 10, пентест, анализ трафика, CTF-задачи и защита веб-приложений.",
            "Intermediate",
            "Security",
            220000,
            tid2,
            "published",
            4.8,
            560,
            36,
        ),
        (
            "Rust: системное программирование",
            "rust-systems-programming",
            "Ownership, borrowing, lifetimes, async/await, написание CLI-инструментов и работа с памятью.",
            "Advanced",
            "Programming",
            350000,
            tid,
            "published",
            4.9,
            310,
            40,
        ),
        (
            "Английский для IT: технический словарь и документация",
            "english-for-it",
            "Читаем документацию, пишем README, участвуем в code review и обсуждаем баги по-английски.",
            "Beginner",
            "Languages",
            80000,
            tid2,
            "published",
            4.6,
            1890,
            20,
        ),
    ]

    for c in new_courses:
        await db.execute(
            """INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (slug) DO NOTHING""",
            *c,
        )

    # Seed steps for new courses (5 theory + 2 code each)
    new_slugs = [c[1] for c in new_courses]
    for slug in new_slugs:
        cid = await db.fetchval("SELECT id FROM courses WHERE slug=$1", slug)
        if not cid:
            continue
        existing_steps = await db.fetchval(
            "SELECT COUNT(*)::int FROM course_steps WHERE course_id=$1", cid
        )
        if existing_steps > 0:
            continue

        # Get course info for step content
        course_row = await db.fetchrow(
            "SELECT title, category FROM courses WHERE id=$1", cid
        )
        if not course_row:
            continue
        category = course_row["category"]

        if category == "Languages":
            step_titles = [
                (
                    "Введение: как учить язык эффективно",
                    "theory",
                    '{"text": "В этом модуле мы разберём методики и подходы к изучению языка. Ключевые принципы: регулярность, погружение, практика."}',
                    10,
                ),
                (
                    "Базовый словарный запас",
                    "theory",
                    '{"text": "500 самых частых слов языка. Учимся их произносить, писать и использовать в контексте."}',
                    10,
                ),
                (
                    "Грамматика: основные конструкции",
                    "quiz",
                    '{"question": "Выберите правильный вариант: \\"I ___ a student.\\"", "options": ["am", "is", "are", "be"], "correctIndex": 0}',
                    15,
                ),
                (
                    "Практика: составляем предложения",
                    "code",
                    '{"taskDescription": "Напишите 5 предложений на английском, описывающих ваш день. Используйте Present Simple.", "starterCode": "# Пример:\\n# 1. I wake up at 7 am.\\n# 2. ...\\n"}',
                    20,
                ),
                (
                    "Разговорные фразы и выражения",
                    "theory",
                    '{"text": "Повседневные фразы: приветствия, прощания, благодарность, извинения. Примеры диалогов."}',
                    10,
                ),
                (
                    "Тест: закрепление базы",
                    "quiz",
                    '{"question": "What does \\"schedule\\" mean?", "options": ["расписание", "задача", "встреча", "звонок"], "correctIndex": 0}',
                    15,
                ),
                (
                    "Итоговое практическое задание",
                    "code",
                    '{"taskDescription": "Напишите короткое письмо-знакомство на английском (50-80 слов). Используйте изученную лексику.", "starterCode": "# My introduction letter:\\n# Dear...,\\n"}',
                    25,
                ),
            ]
        elif category == "Databases":
            step_titles = [
                (
                    "Что такое базы данных и SQL",
                    "theory",
                    '{"text": "Реляционные БД, таблицы, строки и столбцы. Что такое СУБД и почему PostgreSQL — лучший выбор."}',
                    10,
                ),
                (
                    "SELECT, WHERE, ORDER BY",
                    "code",
                    '{"taskDescription": "Напишите запрос, который выбирает всех пользователей с именем, начинающимся на \\"А\\", отсортированных по дате регистрации.", "starterCode": "SELECT * FROM users\\nWHERE ...\\nORDER BY ...;"}',
                    20,
                ),
                (
                    "JOIN: объединение таблиц",
                    "theory",
                    '{"text": "INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL JOIN. Разбираем на примере таблиц orders и customers."}',
                    10,
                ),
                (
                    "Агрегации: COUNT, SUM, AVG, GROUP BY",
                    "code",
                    '{"taskDescription": "Напишите запрос, подсчитывающий количество заказов по каждому клиенту, исключая клиентов с менее чем 2 заказами.", "starterCode": "SELECT customer_id, COUNT(*) as order_count\\nFROM orders\\nGROUP BY ...\\nHAVING ...;"}',
                    20,
                ),
                (
                    "Индексы и производительность",
                    "theory",
                    '{"text": "B-tree, Hash, GIN, GiST индексы. EXPLAIN ANALYZE — читаем план запроса. Основы оптимизации."}',
                    10,
                ),
                (
                    "Оконные функции ROW_NUMBER, RANK, LAG",
                    "code",
                    '{"taskDescription": "Напишите запрос, который выводит топ-3 продукта по продажам в каждой категории используя оконные функции.", "starterCode": "SELECT *, ROW_NUMBER() OVER (\\n  PARTITION BY category\\n  ORDER BY sales DESC\\n) as rank\\nFROM products;"}',
                    25,
                ),
                (
                    "Финальный проект: аналитический запрос",
                    "code",
                    '{"taskDescription": "Напишите комплексный SQL-запрос с JOIN, GROUP BY, HAVING и оконными функциями для анализа данных интернет-магазина.", "starterCode": "-- Ваш финальный запрос:\\nSELECT\\n  ...\\nFROM orders o\\nJOIN customers c ON ...\\nWHERE ...\\nGROUP BY ...\\nHAVING ...;"}',
                    30,
                ),
            ]
        elif category == "Math":
            step_titles = [
                (
                    "Векторы и матрицы: основы линейной алгебры",
                    "theory",
                    '{"text": "Вектор — это направление и величина. Матрица — таблица чисел. Разбираем умножение матриц и зачем оно нужно в ML."}',
                    10,
                ),
                (
                    "Практика: операции с матрицами на Python",
                    "code",
                    '{"taskDescription": "Используя NumPy, создайте матрицу 3x3 и найдите её детерминант и обратную матрицу.", "starterCode": "import numpy as np\\n\\nA = np.array([[1, 2, 3], [0, 1, 4], [5, 6, 0]])\\n# Найдите определитель:\\ndet = ...\\n# Найдите обратную матрицу:\\ninverse = ..."}',
                    20,
                ),
                (
                    "Теория вероятностей: основные понятия",
                    "theory",
                    '{"text": "Событие, вероятность, условная вероятность. Теорема Байеса. Закон больших чисел."}',
                    10,
                ),
                (
                    "Комбинаторика: перестановки и сочетания",
                    "quiz",
                    '{"question": "Сколько способов выбрать 3 человека из 10 для команды?", "options": ["720", "120", "30", "10"], "correctIndex": 1}',
                    15,
                ),
                (
                    "Статистика: среднее, дисперсия, корреляция",
                    "code",
                    '{"taskDescription": "Подсчитайте среднее, стандартное отклонение и корреляцию Пирсона для двух массивов данных.", "starterCode": "import numpy as np\\n\\nx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\\ny = [2, 4, 5, 4, 5, 7, 8, 9, 10, 12]\\n\\nmean_x = ...\\nstd_x = ...\\ncorr = ..."}',
                    20,
                ),
                (
                    "Дискретная математика: графы и деревья",
                    "theory",
                    '{"text": "Граф — множество вершин и рёбер. Обход в глубину (DFS) и ширину (BFS). Применение в алгоритмах."}',
                    10,
                ),
                (
                    "Итоговое задание",
                    "code",
                    '{"taskDescription": "Реализуйте алгоритм BFS для нахождения кратчайшего пути в графе.", "starterCode": "from collections import deque\\n\\ndef bfs(graph, start, end):\\n    queue = deque([[start]])\\n    visited = set([start])\\n    while queue:\\n        path = queue.popleft()\\n        node = path[-1]\\n        # Ваш код здесь..."}',
                    30,
                ),
            ]
        else:
            # Generic steps for other categories
            step_titles = [
                (
                    "Введение в курс",
                    "theory",
                    '{"text": "Добро пожаловать! В этом курсе вы научитесь ключевым навыкам. Начнём с основ."}',
                    10,
                ),
                (
                    "Базовые концепции",
                    "theory",
                    '{"text": "Изучаем фундаментальные понятия. Теория + практические примеры."}',
                    10,
                ),
                (
                    "Практика: первое задание",
                    "code",
                    '{"taskDescription": "Применяем изученное на практике. Реализуйте базовый пример.", "starterCode": "# Ваш код здесь\\n"}',
                    20,
                ),
                (
                    "Углублённая теория",
                    "theory",
                    '{"text": "Погружаемся глубже. Разбираем сложные случаи и исключения."}',
                    10,
                ),
                (
                    "Проверочный тест",
                    "quiz",
                    '{"question": "Что из перечисленного является ключевым принципом изучаемой темы?", "options": ["Регулярная практика", "Изучение одной теории", "Копирование решений", "Случайный подход"], "correctIndex": 0}',
                    15,
                ),
                (
                    "Практика: задание со звёздочкой",
                    "code",
                    '{"taskDescription": "Решите более сложную задачу, применяя всё изученное.", "starterCode": "# Сложное задание\\n# Ваш подход:\\n"}',
                    25,
                ),
                (
                    "Финальное задание модуля",
                    "code",
                    '{"taskDescription": "Итоговое задание: объедините все изученные концепции в одном решении.", "starterCode": "# Финальный проект\\n"}',
                    30,
                ),
            ]

        for i, (title, stype, content_json, xp) in enumerate(step_titles, 1):
            await db.execute(
                """INSERT INTO course_steps (course_id, lesson_id, title, step_order, step_type, content, xp)
                   VALUES ($1, NULL, $2, $3, $4, $5::jsonb, $6)
                   ON CONFLICT DO NOTHING""",
                cid,
                title,
                i,
                stype,
                content_json,
                xp,
            )


async def _seed_python_steps_content() -> None:
    """Update Python course steps with rich content."""
    python_id = await db.fetchval(
        "SELECT id FROM courses WHERE slug='python-backend-fastapi'"
    )
    if not python_id:
        return

    steps = await db.fetch(
        "SELECT id, title, step_type FROM course_steps WHERE course_id=$1 ORDER BY step_order ASC",
        python_id,
    )

    content_map = {
        "Теория: Переменные, типы и приведение": '{"text": "Python динамически типизирован. Основные типы: int, float, str, bool, None. Приведение: int(\\"5\\") → 5, str(42) → \\"42\\". Важно: \\"5\\" + \\"3\\" = \\"53\\", но int(\\"5\\") + 3 = 8."}',
        "Теория: Индексация, срезы и строки": '{"text": "Строки — неизменяемые последовательности. s[0] — первый символ, s[-1] — последний. Срезы: s[1:4], s[::-1] — реверс. Методы: .upper(), .split(), .strip(), .join()."}',
        "Теория: Условия и логические выражения": '{"text": "if/elif/else. Операторы: and, or, not. Тернарный: x if условие else y. Важно: в Python нет switch — используют if-elif или словарь."}',
        "Теория: Функции, аргументы и return": '{"text": "def func(a, b=10, *args, **kwargs). Позиционные и ключевые аргументы. return может вернуть несколько значений через tuple. Лямбда: f = lambda x: x**2."}',
        "Теория: Списки, словари, множества": '{"text": "list: изменяемая последовательность [1,2,3]. dict: ключ→значение {\'a\': 1}. set: уникальные элементы {1,2,3}. Comprehensions: [x*2 for x in range(10) if x%2==0]."}',
        "Теория: Исключения и защищенный код": '{"text": "try/except/finally. Типы: ValueError, TypeError, KeyError, IndexError. raise MyError(). Кастомные исключения: class MyError(Exception): pass. Контекст: with open() as f."}',
        "Теория: ООП: классы и методы": '{"text": "class Dog:\\n    def __init__(self, name):\\n        self.name = name\\n    def bark(self):\\n        return f\'{self.name}: Woof!\'\\nИнкапсуляция через _private. Наследование: class Cat(Animal). super()."}',
        "Теория: Модули и структура проекта": '{"text": "import os, sys. from pathlib import Path. package = папка с __init__.py. Разделение: models.py, services.py, utils.py. Относительные импорты: from .utils import helper."}',
        "Теория: FastAPI роуты и схемы Pydantic": '{"text": "from fastapi import FastAPI\\nfrom pydantic import BaseModel\\napp = FastAPI()\\n\\nclass Item(BaseModel):\\n    name: str\\n    price: float\\n\\n@app.post(\'/items/\')\\nasync def create(item: Item):\\n    return item"}',
        "Теория: HTTP-ошибки и статус-коды": '{"text": "200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable, 500 Server Error. raise HTTPException(status_code=404, detail=\'Not found\')."}',
        "Теория: SQLAlchemy модели и CRUD": '{"text": "from sqlalchemy.orm import Mapped, mapped_column\\nclass User(Base):\\n    __tablename__ = \'users\'\\n    id: Mapped[int] = mapped_column(primary_key=True)\\n    name: Mapped[str]\\nsession.add(user); session.commit()"}',
        "Теория: Тесты на pytest: основы": '{"text": "def test_add():\\n    assert add(2, 3) == 5\\npytest автоматически находит тесты. Фикстуры: @pytest.fixture. Параметризация: @pytest.mark.parametrize. Моки: monkeypatch, unittest.mock."}',
        "Теория: Мини-проект: API заметок": '{"text": "Итоговый проект: REST API для заметок с FastAPI. GET /notes/ — список, POST /notes/ — создать, DELETE /notes/{id} — удалить. Данные в памяти или SQLite через SQLAlchemy."}',
        "Теория: Циклы for/while и шаблон елочки": '{"text": "for i in range(5): print(\'*\' * i). while с break и continue. enumerate() для индексов. zip() для параллельного перебора. Генераторы: (x for x in range(10))."}',
    }

    for step in steps:
        content_key = step["title"]
        if content_key in content_map and step["step_type"] == "theory":
            await db.execute(
                "UPDATE course_steps SET content=$1::jsonb WHERE id=$2",
                content_map[content_key],
                step["id"],
            )

    # Update code/quiz steps content for Python course assignments
    code_steps = [s for s in steps if s["step_type"] in ("code", "quiz")]
    code_contents = [
        '{"taskDescription": "Напишите цикл, печатающий елочку из *, где строка i содержит i звёздочек. Например: строка 1 = \'*\', строка 2 = \'**\', строка 3 = \'***\'", "starterCode": "# Елочка\\nn = 5  # высота\\nfor i in range(1, n + 1):\\n    print(...)"}',
        '{"taskDescription": "Реализуйте POST /orders endpoint с Pydantic-схемой. Схема: OrderCreate(item: str, quantity: int, price: float). Endpoint должен возвращать order с id.", "starterCode": "from fastapi import FastAPI\\nfrom pydantic import BaseModel\\n\\napp = FastAPI()\\n\\nclass OrderCreate(BaseModel):\\n    item: str\\n    quantity: int\\n    price: float\\n\\n@app.post(\'/orders/\')\\nasync def create_order(order: OrderCreate):\\n    # Ваш код здесь\\n    pass"}',
        '{"taskDescription": "Добавьте SQLAlchemy модель Product с полями: id, name (str), price (float), in_stock (bool). Реализуйте функции create_product() и get_all_products().", "starterCode": "from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session\\n\\nclass Base(DeclarativeBase):\\n    pass\\n\\nclass Product(Base):\\n    __tablename__ = \'products\'\\n    id: Mapped[int] = mapped_column(primary_key=True)\\n    # Добавьте поля:\\n    ..."}',
        '{"taskDescription": "Создайте полноценный API заметок: GET /notes/ (список), POST /notes/ (создать заявку с title и body), DELETE /notes/{id}. Используйте словарь для хранения.", "starterCode": "from fastapi import FastAPI, HTTPException\\nfrom pydantic import BaseModel\\nfrom typing import Dict\\n\\napp = FastAPI()\\nnotes: Dict[int, dict] = {}\\ncounter = 0\\n\\nclass NoteCreate(BaseModel):\\n    title: str\\n    body: str\\n\\n# Реализуйте endpoints:\\n@app.get(\'/notes/\')\\nasync def list_notes():\\n    pass"}',
    ]

    for i, step in enumerate(code_steps[: len(code_contents)]):
        await db.execute(
            "UPDATE course_steps SET content=$1::jsonb WHERE id=$2",
            code_contents[i],
            step["id"],
        )


async def _seed_faq():
    exists = await db.fetchval("SELECT COUNT(*) FROM faq_items")
    if exists:
        return

    items = [
        ("Обучение", "Как начать обучение на платформе?", "Зарегистрируйтесь, перейдите в каталог курсов и запишитесь на интересующий курс. После записи курс появится на вашей панели управления."),
        ("Обучение", "Как отправить решение на проверку?", "Откройте страницу задачи, введите код или текст ответа в поле ввода и нажмите кнопку «Проверить». Результат проверки появится сразу."),
        ("Обучение", "Где отслеживать прогресс?", "Ваш прогресс отображается на панели управления (Dashboard) и на странице каждого курса в виде процента завершения."),
        ("Обучение", "Сколько попыток для решения задачи?", "Количество попыток не ограничено. Вы можете отправлять решения столько раз, сколько нужно, пока не получите максимальный балл."),
        ("Обучение", "Можно ли проходить несколько курсов одновременно?", "Да, вы можете записаться на любое количество курсов и проходить их параллельно. Прогресс по каждому курсу отслеживается независимо."),
        ("AI-функции", "Как работает AI-проверка кода?", "AI-ассистент анализирует ваш код по трём критериям: качество, корректность и стиль. Вы получите числовые оценки и текстовые рекомендации по улучшению."),
        ("AI-функции", "Что делает AI-чат?", "AI-чат — это ваш персональный помощник по обучению. Задавайте вопросы по программированию, просите объяснить тему или помочь с кодом."),
        ("AI-функции", "AI-ассистент платный?", "Нет, AI-функции доступны бесплатно для всех зарегистрированных пользователей без ограничений."),
        ("Аккаунт", "Как сменить пароль?", "Перейдите в «Настройки аккаунта» → раздел «Безопасность» → «Сменить пароль». Введите текущий и новый пароль."),
        ("Аккаунт", "Как включить двухфакторную аутентификацию?", "В настройках аккаунта в разделе «Безопасность» нажмите «Включить 2FA». Вам будет отправлен код подтверждения."),
        ("Аккаунт", "Забыл пароль, что делать?", "На странице входа нажмите «Забыли пароль?», введите свой email. Вы получите код для сброса пароля."),
        ("Аккаунт", "Как изменить email?", "В настройках аккаунта нажмите «Сменить email», введите новый адрес и подтвердите его кодом, который придёт на новый email."),
        ("Курсы", "Как записаться на закрытый курс?", "Для закрытых курсов нужно отправить заявку. Преподаватель рассмотрит её и примет решение о допуске."),
        ("Курсы", "Курсы платные?", "На платформе есть как бесплатные, так и платные курсы. Информация о стоимости указана на странице каждого курса."),
        ("Курсы", "Как получить сертификат?", "Сертификат выдаётся автоматически после прохождения всех шагов курса на 100%."),
        ("Преподавателям", "Как создать свой курс?", "Перейдите в «Кабинет преподавателя» → «Создать курс». Заполните информацию, добавьте модули, уроки и шаги. После этого отправьте курс на модерацию."),
        ("Преподавателям", "Как добавить задания в курс?", "В конструкторе заданий выберите тип (код, тест, эссе), настройте условия и прикрепите задание к уроку."),
        ("Техническое", "Какие браузеры поддерживаются?", "Поддерживаются последние версии Chrome, Firefox, Safari и Edge. Рекомендуем Chrome для лучшей производительности."),
        ("Техническое", "Как связаться с поддержкой?", "Используйте раздел «Обратная связь» в меню. Ваше обращение будет рассмотрено администрацией в кратчайшие сроки."),
    ]

    for i, (category, question, answer) in enumerate(items):
        await db.execute(
            "INSERT INTO faq_items (question, answer, category, sort_order) VALUES ($1, $2, $3, $4)",
            question, answer, category, i,
        )
