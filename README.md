# Gradus — EdTech Platform

Полнофункциональная образовательная платформа с ролевой моделью доступа, AI-проверкой кода и модульной архитектурой курсов.

## Стек технологий

| Часть | Технологии |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Python 3.12, FastAPI, asyncpg |
| **БД** | PostgreSQL 15 |
| **AI** | OpenAI API / Gemini / Groq (с fallback) |
| **Auth** | JWT (access + refresh tokens), 2FA (TOTP) |
| **Deploy** | Docker, Nginx |

## Возможности

- **Курсы** — модульная структура, шаги с кодом/видео/тестами, прогресс студента
- **AI Code Review** — анализ кода с оценкой качества, списком ошибок по строкам и рекомендациями
- **AI-ассистент** — чат с GPT для помощи в обучении
- **Автопроверка заданий** — запуск кода студента в sandbox с тестами
- **Аналитика** — личный прогресс (студент) и статистика по курсам (учитель/админ)
- **RBAC** — роли: студент, учитель, администратор
- **2FA** — двухфакторная аутентификация через Google Authenticator
- **Активные сессии** — управление устройствами, завершение сессий
- **Платежи** — покупка курсов, история транзакций
- **Уведомления** — система оповещений в реальном времени

## Структура проекта

```
gradus/
├── backend/              # FastAPI приложение
│   ├── app/
│   │   ├── routes/       # API endpoints
│   │   │   ├── auth.py           # Авторизация, регистрация, 2FA
│   │   │   ├── account.py        # Профиль, сессии, смена пароля
│   │   │   ├── student.py        # Курсы, прогресс, задания
│   │   │   ├── teacher_admin.py  # Управление курсами и аналитика
│   │   │   └── ai.py             # AI-ревью, чат, аналитика
│   │   ├── services.py   # Бизнес-логика, выполнение кода
│   │   ├── schemas.py    # Pydantic модели
│   │   ├── deps.py       # FastAPI зависимости (auth guard)
│   │   └── init_db.py    # Миграции и seed данные
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # React приложение
│   ├── src/
│   │   ├── pages/        # Страницы (Dashboard, Course, Analytics…)
│   │   ├── components/   # UI компоненты
│   │   ├── layout/       # MainLayout с навигацией
│   │   ├── store/        # Глобальное состояние (AppStore)
│   │   ├── services/     # API клиент
│   │   └── router/       # Маршрутизация
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.dev.yml
└── start.ps1             # Быстрый запуск на Windows
```

## Быстрый старт (Windows)

### Требования
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+

### Запуск одной командой

```powershell
.\start.ps1
```

Скрипт автоматически:
1. Создаст `backend/.env` (спросит данные БД)
2. Установит зависимости Python и Node.js
3. Запустит бэкенд на `:4000` и фронтенд на `:5173`

### Ручной запуск

```bash
# Бэкенд
cd backend
python -m venv venv && venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 4000

# Фронтенд
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker compose -f docker-compose.dev.yml up --build
```

После запуска:
- Сайт: http://localhost:5173
- API Docs: http://localhost:4000/api/docs

## Конфигурация

Скопируйте `backend/.env.example` в `backend/.env` и заполните:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/gradus
SECRET_KEY=your-secret-key
AI_PROVIDER=groq          # groq | openai | gemini
GROQ_API_KEY=...
```

## Демо-аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | admin@gradus.dev | Admin@12345 |
| Учитель | teacher@gradus.dev | Teacher@12345 |
| Студент | student@gradus.dev | Student@12345 |
