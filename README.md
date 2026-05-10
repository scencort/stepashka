# Gradus — EdTech Platform

Образовательная платформа с RBAC, AI-проверкой заданий и модульной архитектурой.

## Структура проекта
- `frontend/` — React + TypeScript (Vite, Tailwind CSS)
- `backend/` — Python FastAPI (asyncpg, PostgreSQL, JWT)

## Быстрый старт

### Требования
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+

### Запуск
1. Создайте базу данных:
   ```sql
   CREATE DATABASE gradus;
   ```
2. Скопируйте конфиг:
   ```powershell
   cp backend/.env.example backend/.env
   ```
3. Запустите из корня проекта:
   ```powershell
   .\start.ps1
   ```
4. Откройте:
   - Сайт: http://localhost:5173
   - API Docs: http://localhost:4000/api/docs

### Docker
```bash
docker compose -f docker-compose.dev.yml up --build
```

## Тестовые пользователи
| Роль | Email | Пароль |
|------|-------|--------|
| Админ | admin@gradus.dev | Admin@12345 |
| Учитель | teacher@gradus.dev | Teacher@12345 |
| Студент | student@gradus.dev | Student@12345 |
