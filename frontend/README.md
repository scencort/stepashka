# Степашка: образовательная веб-платформа

Фронтенд React + TypeScript + Vite, работающий через backend API и PostgreSQL.

## Что реализовано

- Публичные страницы: лендинг, вход, регистрация.
- Основные разделы: панель, курсы, задания.
- Дополнительные рабочие вкладки:
  - Учебные траектории
  - Интеллектуальная проверка
  - Конструктор заданий
  - Аналитика и успеваемость
  - Роли и доступы
  - Обратная связь
  - Справочный центр
- Адаптивный интерфейс для телефонов:
  - мобильное выезжающее меню
  - нижняя навигация
  - адаптивные всплывающие окна

## Технологии

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Router

## Источник данных

Проект больше не использует локальные массивы как основной источник.
Рабочие данные (курсы, уведомления, траектории, аналитика, роли, обратная связь, FAQ, проверки) загружаются с backend API, который работает с PostgreSQL.

## Запуск с PostgreSQL

1. Поднимите PostgreSQL и backend в корне репозитория:

```bash
docker compose up --build
```

2. В папке frontend создайте .env на основе .env.example и проверьте URL API:

```env
VITE_API_URL=http://localhost:4000/api
```

3. Установите зависимости и запустите фронтенд:

```bash
npm install
npm run dev
```

## Локальная проверка фронтенда

1. Установить зависимости:

```bash
npm install
```

2. Запустить проект:

```bash
npm run dev
```

3. Сборка проекта:

```bash
npm run build
```

4. Проверка качества и готовности к деплою:

```bash
npm run check
```

## Подготовка к деплою

Проект подготовлен как SPA-приложение с fallback на index.html.

Backend подготовлен для контейнерного деплоя с PostgreSQL:

- docker-compose.yml в корне
- backend/Dockerfile
- backend/.env.example

### Netlify

В проекте есть файл netlify.toml с нужными параметрами:

- команда сборки: npm run build
- папка публикации: dist
- fallback-редирект на /index.html

### Vercel

В проекте есть файл vercel.json с rewrite на /index.html для всех маршрутов.

## Структура маршрутов

- /
- /login
- /register
- /dashboard
- /course
- /task
- /learning-paths
- /ai-review
- /assignment-builder
- /analytics
- /roles-access
- /feedback
- /help-center
