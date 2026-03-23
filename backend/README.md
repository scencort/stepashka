# Backend API (Production-ready RBAC)

Сервис API для платформы Stepashka с JWT, refresh token rotation, role-based доступом и аудитом действий.

## Технологии

- Node.js + Express
- PostgreSQL (pg)
- Zod (валидация)
- Helmet + rate-limit
- JWT + bcryptjs

## Переменные окружения

Скопируйте .env.example в .env и настройте:

- PORT
- DATABASE_URL
- FRONTEND_ORIGIN
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- JWT_ACCESS_TTL
- JWT_REFRESH_DAYS

## Запуск

```bash
npm install
npm run dev
```

## Доступы по ролям

- student: /api/student/*, /api/submissions/*
- teacher: /api/teacher/*, /api/submissions/*
- admin: /api/admin/*

## Основные эндпоинты

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me

### Catalog
- GET /api/catalog

### Student
- GET /api/student/dashboard
- POST /api/student/enroll/:courseId

### Teacher
- GET /api/teacher/courses
- POST /api/teacher/courses
- POST /api/teacher/assignments
- GET /api/teacher/analytics

### Submissions and AI grading
- POST /api/submissions/:assignmentId
- GET /api/submissions/history

### Admin
- GET /api/admin/users
- PATCH /api/admin/users/:id/role
- PATCH /api/admin/users/:id/ban
- GET /api/admin/finance
- GET /api/admin/platform
- PATCH /api/admin/feature-flags/:name

### Infra
- GET /api/health
