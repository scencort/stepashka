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

  const teacherRow = await pool.query(
    `SELECT id FROM users WHERE email = 'teacher@stepashka.dev' LIMIT 1`
  )
  const teacherId = teacherRow.rows[0]?.id || null

  const pythonCourseRow = await pool.query(
    `INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', 4.9, 1420, 84)
     ON CONFLICT (slug)
     DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       level = EXCLUDED.level,
       category = EXCLUDED.category,
       status = 'published',
       duration_hours = GREATEST(courses.duration_hours, EXCLUDED.duration_hours),
       updated_at = NOW()
     RETURNING id`,
    [
      'Python Backend с FastAPI',
      'python-backend-fastapi',
      'Расширенный курс по Python: много теории, практические кейсы и проверка кода по тестам.',
      'Intermediate',
      'Programming',
      249000,
      teacherId,
    ]
  )

  const pythonCourseId = pythonCourseRow.rows[0].id

  const modules = [
    { order: 1, title: 'База Python: синтаксис и типы' },
    { order: 2, title: 'Условия, циклы и функции' },
    { order: 3, title: 'Коллекции, строки и ошибки' },
    { order: 4, title: 'ООП и модули' },
    { order: 5, title: 'FastAPI: маршруты и валидация' },
    { order: 6, title: 'База данных и SQLAlchemy' },
    { order: 7, title: 'Тестирование и отладка' },
    { order: 8, title: 'Проектный мини-кейс' },
  ]

  const moduleIdByOrder = new Map()
  for (const module of modules) {
    const moduleRow = await pool.query(
      `INSERT INTO course_modules (course_id, title, module_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_id, module_order)
       DO UPDATE SET title = EXCLUDED.title
       RETURNING id`,
      [pythonCourseId, module.title, module.order]
    )
    moduleIdByOrder.set(module.order, moduleRow.rows[0].id)
  }

  const lessons = [
    {
      moduleOrder: 1,
      lessonOrder: 1,
      title: 'Переменные, типы и приведение',
      lessonType: 'text',
      contentText:
        'Python динамически типизирован, но это не отменяет аккуратную работу с типами. Разбираем int, float, str, bool, приведение типов и типичные ошибки при смешивании строк и чисел.',
    },
    {
      moduleOrder: 1,
      lessonOrder: 2,
      title: 'Индексация, срезы и строки',
      lessonType: 'text',
      contentText:
        'Подробно изучаем индексацию с нуля, отрицательные индексы, срезы и операции над строками. Понимание строковых операций важно для API, логирования и обработки входных данных.',
    },
    {
      moduleOrder: 2,
      lessonOrder: 1,
      title: 'Условия и логические выражения',
      lessonType: 'text',
      contentText:
        'Разбираем if/elif/else, приоритет операторов, составные условия и читаемость кода. Отдельно обсуждаем, как минимизировать вложенность и делать ветвления понятными.',
    },
    {
      moduleOrder: 2,
      lessonOrder: 2,
      title: 'Циклы for/while и шаблон елочки',
      lessonType: 'interactive',
      contentText:
        'Учимся писать циклы и формировать текстовый вывод построчно. На практике строим елочку: первая строка *, вторая ** и так далее.',
    },
    {
      moduleOrder: 2,
      lessonOrder: 3,
      title: 'Функции, аргументы и return',
      lessonType: 'text',
      contentText:
        'Пишем функции с позиционными и именованными аргументами, разбираем return, области видимости и простые принципы декомпозиции.',
    },
    {
      moduleOrder: 3,
      lessonOrder: 1,
      title: 'Списки, словари, множества',
      lessonType: 'text',
      contentText:
        'Сравниваем коллекции Python, выбираем структуры данных под задачу, изучаем итерацию, фильтрацию и базовые алгоритмические приемы.',
    },
    {
      moduleOrder: 3,
      lessonOrder: 2,
      title: 'Исключения и защищенный код',
      lessonType: 'text',
      contentText:
        'Разбираем try/except/finally, типы исключений и стратегию обработки ошибок в API. Учимся выдавать корректные сообщения, а не скрывать ошибки.',
    },
    {
      moduleOrder: 4,
      lessonOrder: 1,
      title: 'ООП: классы и методы',
      lessonType: 'text',
      contentText:
        'Практика с классами, self, инкапсуляцией и простым наследованием. Когда ООП помогает, а когда лучше оставить функциональный подход.',
    },
    {
      moduleOrder: 4,
      lessonOrder: 2,
      title: 'Модули и структура проекта',
      lessonType: 'text',
      contentText:
        'Структурируем проект: package layout, импорты, __init__.py и разделение ответственности между файлами.',
    },
    {
      moduleOrder: 5,
      lessonOrder: 1,
      title: 'FastAPI роуты и схемы Pydantic',
      lessonType: 'interactive',
      contentText:
        'Создаем endpoint, описываем модели запросов и ответов, делаем базовую валидацию payload через Pydantic.',
    },
    {
      moduleOrder: 5,
      lessonOrder: 2,
      title: 'HTTP-ошибки и статус-коды',
      lessonType: 'text',
      contentText:
        'Учимся правильно возвращать 200/201/400/404/422/500. Корректные статус-коды делают API предсказуемым для клиента.',
    },
    {
      moduleOrder: 6,
      lessonOrder: 1,
      title: 'SQLAlchemy модели и CRUD',
      lessonType: 'interactive',
      contentText:
        'Базовое моделирование сущностей, создание записей, чтение и обновление. Работаем с таблицами, связями и транзакциями.',
    },
    {
      moduleOrder: 7,
      lessonOrder: 1,
      title: 'Тесты на pytest: основы',
      lessonType: 'text',
      contentText:
        'Пишем unit- и интеграционные тесты, проверяем сценарии успеха и ошибок, добавляем понятные ассершены.',
    },
    {
      moduleOrder: 8,
      lessonOrder: 1,
      title: 'Мини-проект: API заметок',
      lessonType: 'interactive',
      contentText:
        'Собираем небольшой API-сервис заметок: список, создание, валидация и простые тесты для ключевых сценариев.',
    },
  ]

  const lessonIdByKey = new Map()
  for (const lesson of lessons) {
    const moduleId = moduleIdByOrder.get(lesson.moduleOrder)
    if (!moduleId) {
      continue
    }

    const lessonRow = await pool.query(
      `INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (module_id, lesson_order)
       DO UPDATE SET
         title = EXCLUDED.title,
         lesson_type = EXCLUDED.lesson_type,
         content_text = EXCLUDED.content_text
       RETURNING id`,
      [moduleId, lesson.title, lesson.lessonType, lesson.contentText, lesson.lessonOrder]
    )

    lessonIdByKey.set(`${lesson.moduleOrder}:${lesson.lessonOrder}`, lessonRow.rows[0].id)
  }

  const assignments = [
    {
      moduleOrder: 2,
      lessonOrder: 2,
      title: 'Елочка через цикл',
      assignmentType: 'code',
      description:
        'Напишите цикл, который печатает елочку минимум из двух строк. Для примера: первая строка "*", вторая "**". Используйте цикл (for или while) и print.',
      tests: [
        { name: 'Есть цикл и print', type: 'includesAll', tokens: ['for', 'print'] },
        { name: 'Есть символ *', type: 'regex', pattern: '\\*' },
        { name: 'Елочка 1..2', type: 'treePattern', levels: [1, 2] },
      ],
      rubric: { tests: 70, quality: 15, style: 15 },
      maxScore: 100,
    },
    {
      moduleOrder: 5,
      lessonOrder: 1,
      title: 'FastAPI endpoint c валидацией',
      assignmentType: 'code',
      description:
        'Реализуйте endpoint POST /orders с валидацией входных данных и возвратом корректного HTTP-статуса.',
      tests: [
        { name: 'Используется FastAPI', type: 'includesAny', tokens: ['FastAPI', 'fastapi'] },
        { name: 'Есть декоратор post', type: 'regex', pattern: '@app\\.post|@router\\.post' },
        { name: 'Есть валидация схемы', type: 'includesAny', tokens: ['BaseModel', 'pydantic'] },
      ],
      rubric: { tests: 60, quality: 20, style: 20 },
      maxScore: 100,
    },
    {
      moduleOrder: 6,
      lessonOrder: 1,
      title: 'CRUD для сущности Product',
      assignmentType: 'code',
      description:
        'Добавьте CRUD-операции для Product с использованием SQLAlchemy и базовой обработкой ошибок.',
      tests: [
        { name: 'Есть SQLAlchemy модель', type: 'includesAny', tokens: ['declarative_base', 'Mapped', 'Column'] },
        { name: 'Есть создание записи', type: 'includesAny', tokens: ['add(', 'session.add'] },
        { name: 'Есть коммит', type: 'includesAny', tokens: ['commit(', 'session.commit'] },
      ],
      rubric: { tests: 60, quality: 20, style: 20 },
      maxScore: 100,
    },
    {
      moduleOrder: 8,
      lessonOrder: 1,
      title: 'Мини-проект API заметок',
      assignmentType: 'code',
      description:
        'Сделайте API заметок с endpoint для создания и получения списка. Добавьте хотя бы одну проверку входных данных.',
      tests: [
        { name: 'Есть как минимум два endpoint', type: 'minCountRegex', pattern: '@app\\.(get|post)|@router\\.(get|post)', min: 2 },
        { name: 'Есть список заметок', type: 'includesAny', tokens: ['notes', 'list_notes', 'get_notes'] },
        { name: 'Есть создание заметки', type: 'includesAny', tokens: ['create_note', 'post_note', 'add_note'] },
      ],
      rubric: { tests: 65, quality: 20, style: 15 },
      maxScore: 100,
    },
  ]

  for (const assignment of assignments) {
    const lessonId = lessonIdByKey.get(`${assignment.moduleOrder}:${assignment.lessonOrder}`)
    if (!lessonId) {
      continue
    }

    const existing = await pool.query(
      `SELECT id FROM assignments WHERE lesson_id = $1 AND title = $2 LIMIT 1`,
      [lessonId, assignment.title]
    )

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE assignments
         SET assignment_type = $1,
             description = $2,
             tests = $3::jsonb,
             rubric = $4::jsonb,
             max_score = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          assignment.assignmentType,
          assignment.description,
          JSON.stringify(assignment.tests),
          JSON.stringify(assignment.rubric),
          assignment.maxScore,
          existing.rows[0].id,
        ]
      )
    } else {
      await pool.query(
        `INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
        [
          lessonId,
          assignment.assignmentType,
          assignment.title,
          assignment.description,
          JSON.stringify(assignment.tests),
          JSON.stringify(assignment.rubric),
          assignment.maxScore,
        ]
      )
    }
  }

  const additionalCourses = [
    {
      title: "JavaScript Backend: Node.js API",
      slug: "javascript-nodejs-api",
      description: "Курс по JavaScript/Node.js: роутинг, валидация, middleware и тесты API.",
      level: "Intermediate",
      category: "Programming",
      priceCents: 219000,
      rating: 4.8,
      studentsCount: 910,
      durationHours: 44,
      modules: [
        { order: 1, title: "Node.js основы и async" },
        { order: 2, title: "Express и архитектура API" },
        { order: 3, title: "Тестирование endpoint-ов" },
      ],
      lessons: [
        {
          moduleOrder: 1,
          lessonOrder: 1,
          title: "Event loop, promises и async/await",
          lessonType: "text",
          contentText: "Разбираем неблокирующую модель Node.js и правильную работу с async/await в сервисах.",
        },
        {
          moduleOrder: 2,
          lessonOrder: 1,
          title: "Express роуты и middleware",
          lessonType: "interactive",
          contentText: "Создаем API с middleware-цепочкой, обработкой ошибок и валидацией payload.",
        },
        {
          moduleOrder: 3,
          lessonOrder: 1,
          title: "Тестирование API через supertest",
          lessonType: "interactive",
          contentText: "Пишем базовые тесты на статусы и формат ответа для REST endpoint-ов.",
        },
      ],
      assignments: [
        {
          moduleOrder: 2,
          lessonOrder: 1,
          title: "POST /tasks с валидацией",
          assignmentType: "code",
          description: "Реализуйте endpoint POST /tasks, который валидирует title и возвращает 201 при успешном создании.",
          tests: [
            { name: "Есть express маршрут POST", type: "regex", pattern: "post\\s*\\(" },
            { name: "Есть статус 201", type: "includesAny", tokens: ["201", "created"] },
            { name: "Есть валидация title", type: "includesAny", tokens: ["title", "trim", "length"] },
          ],
          rubric: { tests: 65, quality: 20, style: 15 },
          maxScore: 100,
        },
      ],
    },
    {
      title: "Go Backend Fundamentals",
      slug: "go-backend-fundamentals",
      description: "Практика на Go: структура проекта, HTTP handlers и работа со структурами данных.",
      level: "Intermediate",
      category: "Programming",
      priceCents: 229000,
      rating: 4.7,
      studentsCount: 620,
      durationHours: 40,
      modules: [
        { order: 1, title: "Go синтаксис и структуры" },
        { order: 2, title: "HTTP handlers" },
        { order: 3, title: "Практика и тесты" },
      ],
      lessons: [
        {
          moduleOrder: 1,
          lessonOrder: 1,
          title: "Struct, methods и interfaces",
          lessonType: "text",
          contentText: "Изучаем модели данных в Go, методы и интерфейсы для сервисного слоя.",
        },
        {
          moduleOrder: 2,
          lessonOrder: 1,
          title: "net/http и обработчики",
          lessonType: "interactive",
          contentText: "Пишем HTTP endpoint и обрабатываем JSON-запросы/ответы.",
        },
        {
          moduleOrder: 3,
          lessonOrder: 1,
          title: "Проверка API и edge cases",
          lessonType: "interactive",
          contentText: "Добавляем проверки на пустой payload и корректные статусы ошибок.",
        },
      ],
      assignments: [
        {
          moduleOrder: 2,
          lessonOrder: 1,
          title: "GET /health и JSON ответ",
          assignmentType: "code",
          description: "Сделайте endpoint /health, который возвращает JSON с полем status=ok и HTTP 200.",
          tests: [
            { name: "Есть handler /health", type: "includesAny", tokens: ["/health", "HandleFunc"] },
            { name: "Есть JSON ответ", type: "includesAny", tokens: ["json", "Marshal", "NewEncoder"] },
            { name: "Есть статус ok", type: "includesAny", tokens: ["ok", "StatusOK", "200"] },
          ],
          rubric: { tests: 65, quality: 20, style: 15 },
          maxScore: 100,
        },
      ],
    },
  ]

  for (const course of additionalCourses) {
    const courseRow = await pool.query(
      `INSERT INTO courses (title, slug, description, level, category, price_cents, teacher_id, status, rating, students_count, duration_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, $9, $10)
       ON CONFLICT (slug)
       DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         level = EXCLUDED.level,
         category = EXCLUDED.category,
         status = 'published',
         rating = EXCLUDED.rating,
         students_count = GREATEST(courses.students_count, EXCLUDED.students_count),
         duration_hours = GREATEST(courses.duration_hours, EXCLUDED.duration_hours),
         updated_at = NOW()
       RETURNING id`,
      [
        course.title,
        course.slug,
        course.description,
        course.level,
        course.category,
        course.priceCents,
        teacherId,
        course.rating,
        course.studentsCount,
        course.durationHours,
      ]
    )

    const courseId = courseRow.rows[0].id
    const moduleIdByOrderMap = new Map()

    for (const module of course.modules) {
      const moduleRow = await pool.query(
        `INSERT INTO course_modules (course_id, title, module_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (course_id, module_order)
         DO UPDATE SET title = EXCLUDED.title
         RETURNING id`,
        [courseId, module.title, module.order]
      )
      moduleIdByOrderMap.set(module.order, moduleRow.rows[0].id)
    }

    const lessonIdByKeyMap = new Map()
    for (const lesson of course.lessons) {
      const moduleId = moduleIdByOrderMap.get(lesson.moduleOrder)
      if (!moduleId) {
        continue
      }
      const lessonRow = await pool.query(
        `INSERT INTO lessons (module_id, title, lesson_type, content_text, lesson_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (module_id, lesson_order)
         DO UPDATE SET
           title = EXCLUDED.title,
           lesson_type = EXCLUDED.lesson_type,
           content_text = EXCLUDED.content_text
         RETURNING id`,
        [moduleId, lesson.title, lesson.lessonType, lesson.contentText, lesson.lessonOrder]
      )

      lessonIdByKeyMap.set(`${lesson.moduleOrder}:${lesson.lessonOrder}`, lessonRow.rows[0].id)
    }

    for (const assignment of course.assignments) {
      const lessonId = lessonIdByKeyMap.get(`${assignment.moduleOrder}:${assignment.lessonOrder}`)
      if (!lessonId) {
        continue
      }

      const existing = await pool.query(
        `SELECT id FROM assignments WHERE lesson_id = $1 AND title = $2 LIMIT 1`,
        [lessonId, assignment.title]
      )

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE assignments
           SET assignment_type = $1,
               description = $2,
               tests = $3::jsonb,
               rubric = $4::jsonb,
               max_score = $5,
               updated_at = NOW()
           WHERE id = $6`,
          [
            assignment.assignmentType,
            assignment.description,
            JSON.stringify(assignment.tests),
            JSON.stringify(assignment.rubric),
            assignment.maxScore,
            existing.rows[0].id,
          ]
        )
      } else {
        await pool.query(
          `INSERT INTO assignments (lesson_id, assignment_type, title, description, tests, rubric, max_score)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
          [
            lessonId,
            assignment.assignmentType,
            assignment.title,
            assignment.description,
            JSON.stringify(assignment.tests),
            JSON.stringify(assignment.rubric),
            assignment.maxScore,
          ]
        )
      }
    }
  }
}
