# Архитектура платформы Stepashka EdTech

## 1. Контекст
Платформа реализует 4 роли: guest, student, teacher, admin. Основной стек:
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express
- БД: PostgreSQL
- Кэш/очереди: Redis
- Файлы: S3-совместимое хранилище

## 2. Логические модули backend
- auth: регистрация, логин, refresh, logout
- users: профиль, статусы, роли
- courses: каталог, публикация, модерация
- learning: модули, уроки, зачисления, прогресс
- assignments: задания, rubrics, тесты
- submissions: отправки, AI-проверка, история
- finance: платежи, возвраты, агрегаты
- admin: фичефлаги, аудит, управление платформой

## 3. Потоки
### 3.1 Регистрация
1. Пользователь отправляет fullName/email/password.
2. Сервер всегда назначает роль student.
3. Возвращаются access/refresh токены.
4. Действие пишется в audit_logs.

### 3.2 AI-проверка кода
1. Студент отправляет решение.
2. Сервис вычисляет score по метрикам tests/quality/style/efficiency.
3. Сохраняется plagiarism_score.
4. Возвращаются feedback и hints.

### 3.3 Назначение ролей
1. Только admin endpoint может менять роль.
2. Любое изменение фиксируется в audit_logs.

## 4. Эволюция в микросервисы
Текущая архитектура — модульный монолит. При росте нагрузки выделяются:
- grading-service
- payment-service
- notification-service
- analytics-service

## 5. SLA и отказоустойчивость
- Readiness check: /api/health
- Graceful degraded mode при недоступности PostgreSQL
- Rate limiting на auth и global API
- Структурированное логирование через morgan + JSON payload в бизнес-логах
