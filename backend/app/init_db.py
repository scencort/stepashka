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
  two_factor_secret TEXT,
  two_factor_pending_secret TEXT,
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
  step_id INTEGER,
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
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS source_code TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS issues JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS improvements JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS good_parts JSONB NOT NULL DEFAULT '[]';
ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS weekly_goal INTEGER NOT NULL DEFAULT 10;
ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE account_profiles ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT;

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
