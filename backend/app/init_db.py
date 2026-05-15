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
    await _seed_python_course()


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


async def _seed_python_course() -> None:
    # Демо-курс "Python с нуля до уверенного уровня" — создаётся один раз при первом запуске
    exists = await db.fetchval(
        "SELECT id FROM courses WHERE slug = 'python-zero-to-confident'"
    )
    if exists:
        return

    teacher_id = await db.fetchval(
        "SELECT id FROM users WHERE email = 'teacher@gradus.dev'"
    )

    course_id = await db.fetchval(
        """INSERT INTO courses
             (title, slug, description, level, category, price_cents, teacher_id,
              status, access_type, cover_url, rating, students_count, duration_hours)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'published','open','',$8,$9,$10)
           RETURNING id""",
        "Python с нуля до уверенного уровня",
        "python-zero-to-confident",
        "Полный курс Python для начинающих: переменные, типы данных, условия, циклы, функции, ООП, работа с файлами и модулями. Более 50 практических заданий с автопроверкой.",
        "Beginner",
        "programming",
        0,
        teacher_id,
        4.8,
        12,
        6,
    )

    # fmt: off
    modules = [
        {"title": "Модуль 1: Основы Python", "steps": [
            {"title": "Что такое Python и как его установить", "lesson_type": "text", "step_type": "essay", "content": {"taskDescription": "Напишите, для каких задач вы хотите использовать Python, и объясните, почему выбрали именно этот язык. Укажите хотя бы 3 причины.", "essayKeywords": ["python", "программ", "задач", "потому"]}, "xp": 25},
            {"title": "Переменные и типы данных", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Задание: Создайте переменные для хранения информации о себе:\n- name (имя, строка)\n- age (возраст, число)\n- height (рост, float)\n- is_programmer (bool)\n\nВыведите их через print() и тип каждой через type().", "tests": [{"type": "regex", "pattern": "name\\s*=", "description": "Есть переменная name"}, {"type": "regex", "pattern": "age\\s*=\\s*\\d+", "description": "Есть переменная age с числом"}, {"type": "regex", "pattern": "print\\s*\\(", "description": "Используется print()"}, {"type": "regex", "pattern": "type\\s*\\(", "description": "Используется type()"}]}, "xp": 25},
            {"title": "Ввод данных от пользователя. Функция input()", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите программу, которая:\n1. Запрашивает имя пользователя через input()\n2. Запрашивает год рождения\n3. Вычисляет возраст (2024 - год рождения)\n4. Выводит ровно одну строку в формате:\n   Привет, {имя}! Тебе {возраст} лет.", "tests": [{"input": "Алексей\n2000", "expectedOutput": "Привет, Алексей! Тебе 24 лет."}, {"input": "Мария\n1995", "expectedOutput": "Привет, Мария! Тебе 29 лет."}]}, "xp": 25},
            {"title": "Арифметические операции и математика", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите программу для вычисления площади круга:\n1. Импортируйте модуль math\n2. Запросите радиус через input()\n3. Вычислите площадь: S = π * r²  (используйте math.pi и **)\n4. Выведите одно число — площадь, округлённую до 2 знаков.\n   (без слов, только число)", "tests": [{"input": "5", "expectedOutput": "78.54"}, {"input": "1", "expectedOutput": "3.14"}, {"input": "10", "expectedOutput": "314.16"}]}, "xp": 25},
            {"title": "Строки: методы и операции", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите программу, которая:\n1. Запрашивает строку у пользователя\n2. Выводит её длину (len)\n3. Выводит в верхнем регистре (.upper())\n4. Подсчитывает количество слов (split + len)\n5. Выводит, начинается ли строка с заглавной буквы", "tests": [{"type": "regex", "pattern": "len\\s*\\(", "description": "Используется len()"}, {"type": "regex", "pattern": "\\.upper\\(\\)", "description": "Используется .upper()"}, {"type": "regex", "pattern": "\\.split\\(\\)", "description": "Используется .split()"}, {"type": "regex", "pattern": "input\\s*\\(", "description": "Есть input()"}]}, "xp": 25},
            {"title": "Условные операторы: if, elif, else", "lesson_type": "text", "step_type": "quiz", "content": {"text": "Что выведет код: x = 10; print('big') if x > 5 else print('small')?", "options": [{"text": "big", "correct": True}, {"text": "small", "correct": False}, {"text": "10", "correct": False}, {"text": "Ошибка", "correct": False}]}, "xp": 15},
            {"title": "Циклы: for и while", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите программу, которая выводит таблицу умножения от 1 до 9.\nИспользуйте вложенные циклы for.\nФормат каждой строки СТРОГО: A x B = C\nПример:\n1 x 1 = 1\n1 x 2 = 2\n...\n9 x 9 = 81", "tests": [{"input": "", "expectedOutput": "1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3\n1 x 4 = 4\n1 x 5 = 5\n1 x 6 = 6\n1 x 7 = 7\n1 x 8 = 8\n1 x 9 = 9\n2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27\n4 x 1 = 4\n4 x 2 = 8\n4 x 3 = 12\n4 x 4 = 16\n4 x 5 = 20\n4 x 6 = 24\n4 x 7 = 28\n4 x 8 = 32\n4 x 9 = 36\n5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n6 x 1 = 6\n6 x 2 = 12\n6 x 3 = 18\n6 x 4 = 24\n6 x 5 = 30\n6 x 6 = 36\n6 x 7 = 42\n6 x 8 = 48\n6 x 9 = 54\n7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35\n7 x 6 = 42\n7 x 7 = 49\n7 x 8 = 56\n7 x 9 = 63\n8 x 1 = 8\n8 x 2 = 16\n8 x 3 = 24\n8 x 4 = 32\n8 x 5 = 40\n8 x 6 = 48\n8 x 7 = 56\n8 x 8 = 64\n8 x 9 = 72\n9 x 1 = 9\n9 x 2 = 18\n9 x 3 = 27\n9 x 4 = 36\n9 x 5 = 45\n9 x 6 = 54\n9 x 7 = 63\n9 x 8 = 72\n9 x 9 = 81"}]}, "xp": 25},
            {"title": "Списки (list): создание и методы", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Создайте список из 5 любимых фильмов.\nЗатем:\n1. Добавьте ещё один фильм через append()\n2. Выведите длину списка\n3. Отсортируйте список и выведите\n4. Выведите первый и последний элемент", "tests": [{"type": "regex", "pattern": "\\[.*\\]", "description": "Создан список"}, {"type": "regex", "pattern": "\\.append\\s*\\(", "description": "Используется .append()"}, {"type": "regex", "pattern": "\\.sort\\s*\\(\\)", "description": "Используется .sort()"}, {"type": "regex", "pattern": "len\\s*\\(", "description": "Используется len()"}]}, "xp": 25},
            {"title": "Словари (dict) и множества (set)", "lesson_type": "text", "step_type": "quiz", "content": {"text": "Какой метод словаря возвращает все пары ключ-значение?", "options": [{"text": ".keys()", "correct": False}, {"text": ".values()", "correct": False}, {"text": ".items()", "correct": True}, {"text": ".pairs()", "correct": False}]}, "xp": 15},
            {"title": "Функции: определение и вызов", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите функцию calculator(a, b, operation), которая:\n- принимает два числа и операцию (\"+\", \"-\", \"*\", \"/\")\n- возвращает результат\n- если операция неизвестна — возвращает None\n\nВ конце вызовите функцию и выведите результаты через print():\nprint(calculator(10, 5, \"+\"))\nprint(calculator(10, 5, \"-\"))\nprint(calculator(10, 5, \"*\"))\nprint(calculator(10, 5, \"/\"))", "tests": [{"input": "", "expectedOutput": "15\n5\n50\n2.0"}]}, "xp": 25},
        ]},
        {"title": "Модуль 2: Управляющие структуры и алгоритмы", "steps": [
            {"title": "Рекурсия: функции, вызывающие себя", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите рекурсивную функцию power(base, exp), которая возводит число в степень\nбез использования ** и math.pow.\n\nПодсказка: base^n = base * base^(n-1), base^0 = 1\n\nВ конце добавьте:\nprint(power(2, 10))\nprint(power(3, 3))\nprint(power(5, 0))", "tests": [{"input": "", "expectedOutput": "1024\n27\n1"}]}, "xp": 25},
            {"title": "Обработка исключений: try/except", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите функцию safe_divide(a, b), которая:\n1. Делит a на b\n2. Обрабатывает ZeroDivisionError — возвращает None\n3. Обрабатывает TypeError — возвращает None\n4. В любом случае выводит «Вычисление завершено» (блок finally)\n\nВ конце вызовите:\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))\nprint(safe_divide(10, \"x\"))", "tests": [{"input": "", "expectedOutput": "Вычисление завершено\n5.0\nВычисление завершено\nNone\nВычисление завершено\nNone"}]}, "xp": 25},
            {"title": "Генераторы списков и map/filter", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Используя list comprehension, создайте и выведите через print():\n1. Список кубов чисел от 1 до 10\n2. Список только нечётных чисел от 1 до 20 (включительно)\n3. Список длин слов из: [\"python\", \"is\", \"awesome\", \"language\"]\n\nКаждый список выведите отдельным print().", "tests": [{"input": "", "expectedOutput": "[1, 8, 27, 64, 125, 216, 343, 512, 729, 1000]\n[1, 3, 5, 7, 9, 11, 13, 15, 17, 19]\n[6, 2, 7, 8]"}]}, "xp": 25},
            {"title": "Работа с файлами", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите программу, которая:\n1. Создаёт файл \"notes.txt\" и записывает в него 3 строки текста\n2. Закрывает файл\n3. Открывает файл снова и читает его содержимое\n4. Выводит каждую строку с номером (1: текст, 2: текст...)\n\nИспользуйте конструкцию with open(...).", "tests": [{"type": "regex", "pattern": "open\\s*\\(.*[\"\\']w[\"\\']", "description": "Открытие на запись"}, {"type": "regex", "pattern": "open\\s*\\(.*[\"\\']r[\"\\']", "description": "Открытие на чтение"}, {"type": "regex", "pattern": "with\\s+open", "description": "Используется with open"}, {"type": "regex", "pattern": "\\.write\\s*\\(", "description": "Используется .write()"}]}, "xp": 25},
            {"title": "Модули и пакеты Python", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите короткую программу используя модуль random:\n1. Создайте список из 10 случайных чисел от 1 до 100\n2. Найдите минимальное, максимальное и среднее значение\n3. Отсортируйте список и выведите\n\nПосле кода напишите: какие ещё модули Python вы хотите изучить и зачем.", "tests": [{"type": "essay", "keywords": ["random", "список", "модул"], "minLength": 60}]}, "xp": 25},
            {"title": "ООП: классы и объекты", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Создайте класс Student с:\n- атрибутами: name, age, grades (список оценок)\n- методом add_grade(grade) — добавить оценку\n- методом average() — вернуть среднюю оценку\n- методом __str__ — красивый вывод\n\nСоздайте 2 объекта, добавьте оценки и выведите среднее.", "tests": [{"type": "regex", "pattern": "class\\s+Student", "description": "Определён класс Student"}, {"type": "regex", "pattern": "def\\s+__init__", "description": "Есть конструктор"}, {"type": "regex", "pattern": "def\\s+add_grade", "description": "Есть метод add_grade"}, {"type": "regex", "pattern": "def\\s+average", "description": "Есть метод average"}]}, "xp": 25},
            {"title": "Наследование и полиморфизм", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Создайте иерархию классов геометрических фигур:\n- Shape (базовый): метод area() возвращает 0\n- Rectangle(Shape): width, height → area() = w * h\n- Circle(Shape): radius → area() = π * r²\n- Triangle(Shape): base, height → area() = 0.5 * b * h\n\nСоздайте объекты, добавьте в список, выведите площадь каждого.", "tests": [{"type": "regex", "pattern": "class\\s+Shape", "description": "Есть базовый класс Shape"}, {"type": "regex", "pattern": "class\\s+Rectangle\\s*\\(\\s*Shape\\s*\\)", "description": "Rectangle наследует Shape"}, {"type": "regex", "pattern": "class\\s+Circle\\s*\\(\\s*Shape\\s*\\)", "description": "Circle наследует Shape"}, {"type": "regex", "pattern": "def\\s+area", "description": "Определён метод area"}]}, "xp": 25},
        ]},
        {"title": "Модуль 3: Структуры данных", "steps": [
            {"title": "Кортежи (tuple) и их применение", "lesson_type": "text", "step_type": "quiz", "content": {"text": "Что произойдёт при попытке изменить элемент кортежа: t = (1,2,3); t[0] = 10?", "options": [{"text": "Элемент изменится", "correct": False}, {"text": "Возникнет TypeError", "correct": True}, {"text": "Создастся новый кортеж", "correct": False}, {"text": "Ничего не произойдёт", "correct": False}]}, "xp": 15},
            {"title": "Алгоритмы сортировки", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Реализуйте функцию insertion_sort(arr) — сортировку вставками:\n- Берём элемент и вставляем его на правильную позицию среди уже отсортированных\n- Алгоритм: для каждого i от 1 до n, двигаем arr[i] влево пока больше предыдущего\n\nВ конце добавьте:\narr = [64, 34, 25, 12, 22, 11, 90]\ninsertion_sort(arr)\nprint(arr)", "tests": [{"input": "", "expectedOutput": "[11, 12, 22, 25, 34, 64, 90]"}]}, "xp": 25},
            {"title": "Работа с JSON и CSV", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Создайте программу, которая:\n1. Хранит список из 3 студентов (имя, оценки как список)\n2. Вычисляет среднюю оценку каждого\n3. Сохраняет всё в JSON файл \"students.json\"\n4. Читает файл обратно и выводит имена с их средними оценками", "tests": [{"type": "regex", "pattern": "import json", "description": "Импортирован json"}, {"type": "regex", "pattern": "json\\.dump", "description": "Запись в JSON"}, {"type": "regex", "pattern": "json\\.load", "description": "Чтение из JSON"}, {"type": "regex", "pattern": "sum\\s*\\(|average|средн", "description": "Вычисляется среднее"}]}, "xp": 25},
        ]},
        {"title": "Модуль 4: Практические проекты", "steps": [
            {"title": "Проект: Контактная книга", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "По аналогии создайте класс TaskManager:\n- add_task(title, priority=\"normal\") — добавить задачу\n- complete_task(title) — отметить как выполненную\n- list_tasks() — вывести все задачи (с отметкой выполнена/нет)\n- save(filename) / load(filename) — сохранение в JSON\n\nСоздайте менеджер, добавьте 3 задачи, одну выполните, выведите список.", "tests": [{"type": "regex", "pattern": "class\\s+TaskManager", "description": "Определён класс TaskManager"}, {"type": "regex", "pattern": "def\\s+add_task", "description": "Есть метод add_task"}, {"type": "regex", "pattern": "def\\s+complete_task", "description": "Есть метод complete_task"}, {"type": "regex", "pattern": "json", "description": "Используется json"}]}, "xp": 25},
            {"title": "Проект: Анализ текста", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите функцию analyze_text(text), которая возвращает словарь:\n{\n  \"chars\": количество символов,\n  \"words\": количество слов,\n  \"sentences\": количество предложений (по точкам),\n  \"unique_words\": количество уникальных слов,\n  \"top5\": список из 5 самых частых слов\n}\n\nПротестируйте на тексте минимум из 3 предложений.", "tests": [{"type": "regex", "pattern": "def\\s+analyze_text", "description": "Определена функция analyze_text"}, {"type": "regex", "pattern": "Counter|\\.count\\(|collections", "description": "Подсчёт частоты слов"}, {"type": "regex", "pattern": "set\\s*\\(|unique", "description": "Уникальные слова"}, {"type": "regex", "pattern": "return\\s*\\{", "description": "Возвращается словарь"}]}, "xp": 25},
            {"title": "Регулярные выражения (regex)", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Используя re, напишите функции:\n1. is_valid_email(s) → True/False\n2. is_valid_phone(s) → True/False (формат +7XXXXXXXXXX — 11 цифр)\n3. extract_numbers(s) → список всех чисел из строки\n\nВ конце добавьте ровно эти вызовы:\nprint(is_valid_email(\"user@example.com\"))\nprint(is_valid_email(\"not-an-email\"))\nprint(is_valid_phone(\"+79991234567\"))\nprint(is_valid_phone(\"89991234567\"))\nprint(extract_numbers(\"У меня 3 кошки и 12 рыбок\"))", "tests": [{"input": "", "expectedOutput": "True\nFalse\nTrue\nFalse\n['3', '12']"}]}, "xp": 25},
            {"title": "Декораторы и замыкания", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Напишите декоратор @timer, который:\n1. Замеряет время выполнения функции (import time)\n2. Выводит: \"Функция {name} выполнена за {ms} мс\"\n3. Возвращает результат функции без изменений\n\nПримените его к функции, которая суммирует числа от 1 до миллиона.", "tests": [{"type": "regex", "pattern": "import time", "description": "Импортирован time"}, {"type": "regex", "pattern": "def\\s+timer|def\\s+wrapper", "description": "Определён декоратор"}, {"type": "regex", "pattern": "time\\.time\\(\\)|time\\.perf_counter\\(\\)", "description": "Измеряется время"}, {"type": "regex", "pattern": "@timer", "description": "Декоратор применяется через @"}]}, "xp": 25},
        ]},
        {"title": "Модуль 5: Финальный проект", "steps": [
            {"title": "Итоговый проект: Система управления библиотекой", "lesson_type": "text", "step_type": "code", "content": {"taskDescription": "Реализуйте полную систему управления библиотекой:\n\n1. Класс Book с методами borrow(), return_book(), to_dict()\n2. Класс Library с методами add_book(), search(), available_books(), save(), load()\n3. Добавьте 5+ книг разных жанров\n4. Выдайте 2 книги разным читателям\n5. Выведите список доступных книг\n6. Найдите книги по запросу\n7. Верните одну книгу\n8. Сохраните библиотеку в JSON", "tests": [{"type": "regex", "pattern": "class\\s+Book", "description": "Определён класс Book"}, {"type": "regex", "pattern": "class\\s+Library", "description": "Определён класс Library"}, {"type": "regex", "pattern": "def\\s+borrow|def\\s+return_book", "description": "Есть методы выдачи/возврата"}, {"type": "regex", "pattern": "json\\.dump", "description": "Сохранение в JSON"}, {"type": "regex", "pattern": "def\\s+search", "description": "Есть поиск"}]}, "xp": 25},
            {"title": "Итоговое эссе: Python в реальном мире", "lesson_type": "text", "step_type": "essay", "content": {"taskDescription": "Напишите эссе (минимум 150 символов) на тему:\n«Что я узнал на курсе Python и как планирую использовать эти знания?»\n\nУкажите:\n- 3 самые полезные темы курса для вас лично\n- Область, в которой хотите применять Python\n- Что планируете изучить дальше", "essayKeywords": ["python", "изучил", "курс", "планир"]}, "xp": 25},
        ]},
    ]
    # fmt: on

    for module_order, module in enumerate(modules, start=1):
        module_id = await db.fetchval(
            """INSERT INTO course_modules (course_id, title, module_order)
               VALUES ($1, $2, $3) RETURNING id""",
            course_id, module["title"], module_order,
        )
        for lesson_order, step in enumerate(module["steps"], start=1):
            lesson_id = await db.fetchval(
                """INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order)
                   VALUES ($1, $2, $3, $4, $5) RETURNING id""",
                module_id, step["title"], step["lesson_type"],
                step["content"].get("text", ""), lesson_order,
            )
            if step["step_type"] in ("code", "quiz", "essay"):
                atype = "code" if step["step_type"] == "code" else step["step_type"]
                desc_text = step["content"].get("taskDescription") or step["content"].get("text", "")
                if step["step_type"] == "quiz":
                    tests_val = json.dumps([{"options": step["content"].get("options", [])}], ensure_ascii=False)
                else:
                    tests_val = json.dumps(step["content"].get("tests", []), ensure_ascii=False)
                await db.execute(
                    """INSERT INTO assignments (lesson_id, assignment_type, title, description, tests)
                       VALUES ($1,$2,$3,$4,$5::jsonb)""",
                    lesson_id, atype, step["title"], desc_text, tests_val,
                )
            await db.execute(
                """INSERT INTO course_steps
                     (course_id, lesson_id, title, step_order, step_type, content, xp)
                   VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)""",
                course_id, lesson_id, step["title"], lesson_order,
                step["step_type"], json.dumps(step["content"], ensure_ascii=False), step["xp"],
            )

    log.info("Course 'Python с нуля до уверенного уровня' seeded (id=%s)", course_id)
