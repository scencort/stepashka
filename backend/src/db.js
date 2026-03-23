import dotenv from "dotenv"
import pg from "pg"
import bcrypt from "bcryptjs"

dotenv.config()

const { Pool } = pg

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/stepashka"

export const pool = new Pool({ connectionString })

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
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

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address TEXT NOT NULL DEFAULT '';
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NOT NULL DEFAULT NOW();
`

export async function initDb() {
  await pool.query(schemaSql)

  const usersCount = await pool.query("SELECT COUNT(*)::int AS count FROM users")
  if (usersCount.rows[0].count === 0) {
    const adminPass = await bcrypt.hash("Admin@12345", 10)
    const teacherPass = await bcrypt.hash("Teacher@12345", 10)
    const studentPass = await bcrypt.hash("Student@12345", 10)

    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES
       ('admin@stepashka.dev', $1, 'Системный администратор', 'admin'),
       ('teacher@stepashka.dev', $2, 'Ирина Преподаватель', 'teacher'),
       ('student@stepashka.dev', $3, 'Алексей Студент', 'student')`,
      [adminPass, teacherPass, studentPass]
    )
  }

  await pool.query(
    `INSERT INTO account_profiles (user_id)
     SELECT id FROM users
     ON CONFLICT (user_id) DO NOTHING`
  )

  const coursesCount = await pool.query("SELECT COUNT(*)::int AS count FROM courses")
  if (coursesCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
       VALUES
       ('Python Backend с FastAPI', 'python-backend-fastapi', 'Практический курс по разработке API, авторизации и деплою.', 'Intermediate', 'Programming', 249000, 2, 'published', 4.9, 1420, 42),
       ('React + TypeScript для продукта', 'react-typescript-product', 'Создание production фронтенда с архитектурой и тестами.', 'Intermediate', 'Programming', 199000, 2, 'published', 4.8, 1180, 36),
       ('DevOps: Docker, CI/CD, Monitoring', 'devops-docker-cicd-monitoring', 'Контейнеризация, деплой и наблюдаемость в реальных проектах.', 'Advanced', 'DevOps', 329000, 2, 'published', 4.7, 760, 48),
       ('UI/UX Design Практика', 'ui-ux-practice', 'UX-исследования, дизайн-система и передача макетов в разработку.', 'Beginner', 'Design', 179000, 2, 'pending_review', 4.6, 390, 28),
       ('Data Science: прикладной ML', 'data-science-applied-ml', 'Полный цикл ML-проекта: от EDA до продакшн-метрик.', 'Advanced', 'Data Science', 359000, 2, 'published', 4.9, 540, 52),
       ('QA Engineer Pro', 'qa-engineer-pro', 'Тест-дизайн, API/UI автотесты и интеграция в CI.', 'Intermediate', 'QA', 189000, 2, 'published', 4.8, 880, 34)`
    )

    await pool.query(
      `INSERT INTO course_modules (course_id, title, module_order) VALUES
       (1, 'Основы Python и архитектуры сервера', 1),
       (1, 'FastAPI и REST', 2),
       (1, 'PostgreSQL и миграции', 3),
       (2, 'TypeScript Core', 1),
       (2, 'React архитектура', 2),
       (2, 'Тестирование и качество', 3)`
    )

    await pool.query(
      `INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order) VALUES
       (1, 'Типы и функции Python', 'text', 'Практика на типизацию и функции.', 1),
       (2, 'FastAPI роуты и валидация', 'interactive', 'Создайте CRUD и валидацию входных данных.', 1),
       (4, 'Типы, generics, utility types', 'video', 'Разбор типизации в продуктовых приложениях.', 1),
       (5, 'Feature-based архитектура React', 'text', 'Проектирование слоев entities/features/widgets/pages.', 1)`
    )

    await pool.query(
      `INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score) VALUES
       (2, 'code', 'Реализовать эндпоинт заказов', 'Создайте POST /orders с валидацией и тестами.', '[{"name":"creates order"},{"name":"validates payload"}]'::jsonb, '{"tests":50,"quality":20,"style":20,"efficiency":10}'::jsonb, 100),
       (4, 'essay', 'UX-аудит формы регистрации', 'Опишите 5 UX-проблем и предложите улучшения.', '[]'::jsonb, '{"relevance":30,"depth":30,"clarity":20,"practicality":20}'::jsonb, 100)`
    )
  }

  const flagsCount = await pool.query("SELECT COUNT(*)::int AS count FROM feature_flags")
  if (flagsCount.rows[0].count === 0) {
    await pool.query(
      `INSERT INTO feature_flags (name, enabled, description) VALUES
       ('ai_hints', true, 'Подсказки студентам в заданиях'),
       ('marketplace_enabled', true, 'Маркетплейс курсов преподавателей'),
       ('gamification_enabled', true, 'XP, уровни и бейджи')`
    )
  }
}
