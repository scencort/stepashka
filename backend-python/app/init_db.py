from __future__ import annotations

import json

from app import db
from app.services import hash_password


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
UPDATE course_steps SET step_type = kind WHERE step_type IS NULL;
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
"""


async def init_db() -> None:
    p = await db.get_pool()
    async with p.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
        try:
            await conn.execute(MIGRATIONS_SQL)
        except Exception:
            pass
    await _seed_users()
    await _seed_profiles()
    await _seed_courses()
    await _seed_feature_flags()


async def _seed_users() -> None:
    count = await db.fetchval("SELECT COUNT(*)::int FROM users")
    if count > 0:
        return

    admin_hash = hash_password("Admin@12345")
    teacher_hash = hash_password("Teacher@12345")
    student_hash = hash_password("Student@12345")

    await db.execute(
        """INSERT INTO users (email, password_hash, full_name, role) VALUES
           ('admin@stepashka.dev', $1, 'Системный администратор', 'admin'),
           ('teacher@stepashka.dev', $2, 'Ирина Преподаватель', 'teacher'),
           ('student@stepashka.dev', $3, 'Алексей Студент', 'student')""",
        admin_hash, teacher_hash, student_hash,
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

    teacher = await db.fetchrow("SELECT id FROM users WHERE email = 'teacher@stepashka.dev' LIMIT 1")
    tid = teacher["id"] if teacher else None

    courses_data = [
        ("Python: Большой практический курс", "python-backend-fastapi",
         "Расширенный курс по Python: много теории, практические кейсы и проверка кода по тестам.",
         "Intermediate", "Programming", 0, tid, "published", 4.9, 980, 52),
        ("React + TypeScript для продукта", "react-typescript-product",
         "Создание production фронтенда с архитектурой и тестами.",
         "Intermediate", "Programming", 199000, tid, "published", 4.8, 1180, 36),
        ("DevOps: Docker, CI/CD, Monitoring", "devops-docker-cicd-monitoring",
         "Контейнеризация, деплой и наблюдаемость в реальных проектах.",
         "Advanced", "DevOps", 329000, tid, "published", 4.7, 760, 48),
        ("UI/UX Design Практика", "ui-ux-practice",
         "UX-исследования, дизайн-система и передача макетов в разработку.",
         "Beginner", "Design", 179000, tid, "pending_review", 4.6, 390, 28),
        ("Data Science: прикладной ML", "data-science-applied-ml",
         "Полный цикл ML-проекта: от EDA до продакшн-метрик.",
         "Advanced", "Data Science", 359000, tid, "published", 4.9, 540, 52),
        ("QA Engineer Pro", "qa-engineer-pro",
         "Тест-дизайн, API/UI автотесты и интеграция в CI.",
         "Intermediate", "QA", 189000, tid, "published", 4.8, 880, 34),
        ("JavaScript Backend: Node.js API", "javascript-nodejs-api",
         "Курс по JavaScript/Node.js: роутинг, валидация, middleware и тесты API.",
         "Intermediate", "Programming", 219000, tid, "published", 4.8, 910, 44),
        ("Go Backend Fundamentals", "go-backend-fundamentals",
         "Практика на Go: структура проекта, HTTP handlers и работа со структурами данных.",
         "Intermediate", "Programming", 229000, tid, "published", 4.7, 620, 40),
    ]

    for c in courses_data:
        await db.execute(
            """INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (slug) DO NOTHING""",
            *c,
        )

    # --- Python course modules, lessons, assignments ---
    python_id = await db.fetchval("SELECT id FROM courses WHERE slug='python-backend-fastapi'")
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
            python_id, title, order,
        )
        mod_ids[order] = mid

    lessons_data = [
        (1, 1, "Переменные, типы и приведение", "text",
         "Python динамически типизирован, но это не отменяет аккуратную работу с типами. Разбираем int, float, str, bool, приведение типов и типичные ошибки при смешивании строк и чисел."),
        (1, 2, "Индексация, срезы и строки", "text",
         "Подробно изучаем индексацию с нуля, отрицательные индексы, срезы и операции над строками."),
        (2, 1, "Условия и логические выражения", "text",
         "Разбираем if/elif/else, приоритет операторов, составные условия и читаемость кода."),
        (2, 2, "Циклы for/while и шаблон елочки", "interactive",
         "Учимся писать циклы и формировать текстовый вывод построчно."),
        (2, 3, "Функции, аргументы и return", "text",
         "Пишем функции с позиционными и именованными аргументами, разбираем return, области видимости."),
        (3, 1, "Списки, словари, множества", "text",
         "Сравниваем коллекции Python, выбираем структуры данных под задачу."),
        (3, 2, "Исключения и защищенный код", "text",
         "Разбираем try/except/finally, типы исключений и стратегию обработки ошибок в API."),
        (4, 1, "ООП: классы и методы", "text",
         "Практика с классами, self, инкапсуляцией и простым наследованием."),
        (4, 2, "Модули и структура проекта", "text",
         "Структурируем проект: package layout, импорты, __init__.py и разделение ответственности."),
        (5, 1, "FastAPI роуты и схемы Pydantic", "interactive",
         "Создаем endpoint, описываем модели запросов и ответов, делаем базовую валидацию payload через Pydantic."),
        (5, 2, "HTTP-ошибки и статус-коды", "text",
         "Учимся правильно возвращать 200/201/400/404/422/500."),
        (6, 1, "SQLAlchemy модели и CRUD", "interactive",
         "Базовое моделирование сущностей, создание записей, чтение и обновление."),
        (7, 1, "Тесты на pytest: основы", "text",
         "Пишем unit- и интеграционные тесты, проверяем сценарии успеха и ошибок."),
        (8, 1, "Мини-проект: API заметок", "interactive",
         "Собираем небольшой API-сервис заметок с валидацией и тестами."),
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
            mid, title, ltype, text, lesson_order,
        )
        lesson_ids[f"{mod_order}:{lesson_order}"] = lid

    assignments_data = [
        ("2:2", "Елочка через цикл", "code",
         "Напишите цикл, который печатает елочку минимум из двух строк.",
         [{"name": "Есть цикл и print", "type": "includesAll", "tokens": ["for", "print"]},
          {"name": "Есть символ *", "type": "regex", "pattern": "\\*"},
          {"name": "Елочка 1..2", "type": "treePattern", "levels": [1, 2]}],
         {"tests": 70, "quality": 15, "style": 15}, 100),
        ("5:1", "FastAPI endpoint c валидацией", "code",
         "Реализуйте endpoint POST /orders с валидацией входных данных.",
         [{"name": "Используется FastAPI", "type": "includesAny", "tokens": ["FastAPI", "fastapi"]},
          {"name": "Есть декоратор post", "type": "regex", "pattern": "@app\\.post|@router\\.post"},
          {"name": "Есть валидация схемы", "type": "includesAny", "tokens": ["BaseModel", "pydantic"]}],
         {"tests": 60, "quality": 20, "style": 20}, 100),
        ("6:1", "CRUD для сущности Product", "code",
         "Добавьте CRUD-операции для Product с использованием SQLAlchemy.",
         [{"name": "Есть SQLAlchemy модель", "type": "includesAny", "tokens": ["declarative_base", "Mapped", "Column"]},
          {"name": "Есть создание записи", "type": "includesAny", "tokens": ["add(", "session.add"]},
          {"name": "Есть коммит", "type": "includesAny", "tokens": ["commit(", "session.commit"]}],
         {"tests": 60, "quality": 20, "style": 20}, 100),
        ("8:1", "Мини-проект API заметок", "code",
         "Сделайте API заметок с endpoint для создания и получения списка.",
         [{"name": "Есть минимум два endpoint", "type": "minCountRegex", "pattern": "@app\\.(get|post)|@router\\.(get|post)", "min": 2},
          {"name": "Есть список заметок", "type": "includesAny", "tokens": ["notes", "list_notes", "get_notes"]},
          {"name": "Есть создание заметки", "type": "includesAny", "tokens": ["create_note", "post_note", "add_note"]}],
         {"tests": 65, "quality": 20, "style": 15}, 100),
    ]

    for key, title, atype, desc, tests, rubric, max_score in assignments_data:
        lid = lesson_ids.get(key)
        if not lid:
            continue
        exists = await db.fetchval(
            "SELECT id FROM assignments WHERE lesson_id=$1 AND title=$2 LIMIT 1",
            lid, title,
        )
        tests_json = json.dumps(tests)
        rubric_json = json.dumps(rubric)
        if exists:
            await db.execute(
                """UPDATE assignments SET assignment_type=$1, description=$2, tests=$3::jsonb,
                   rubric=$4::jsonb, max_score=$5, updated_at=NOW() WHERE id=$6""",
                atype, desc, tests_json, rubric_json, max_score, exists,
            )
        else:
            await db.execute(
                """INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
                   VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)""",
                lid, atype, title, desc, tests_json, rubric_json, max_score,
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
