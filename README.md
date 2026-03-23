# Stepashka EdTech Platform

Production-ready образовательная платформа с RBAC, AI-проверкой заданий и модульной архитектурой.

## Монорепо структура
- frontend/ — React приложение
- backend/ — API, RBAC, JWT, AI grading
- docs/ — архитектура, безопасность, каталоги курсов, деплой
- infra/ — мониторинг и инфраструктурные шаблоны
- docker/ — production docker-compose

## Быстрый старт
1. Настройте backend/.env на основе backend/.env.example
2. Запустите локальный стек:
   - docker compose up --build
3. Откройте:
   - Frontend: http://localhost:5173
   - Backend health: http://localhost:4000/api/health

## Тестовые пользователи
- admin@stepashka.dev / Admin@12345
- teacher@stepashka.dev / Teacher@12345
- student@stepashka.dev / Student@12345
