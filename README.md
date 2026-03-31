# Stepashka EdTech Platform

Production-ready образовательная платформа с RBAC, AI-проверкой заданий и модульной архитектурой.

## Монорепо структура
- frontend/ — React приложение
- backend/ — API, RBAC, JWT, AI grading
- docs/ — архитектура, безопасность, каталоги курсов
- infra/ — мониторинг и инфраструктурные шаблоны

## Быстрый старт
1. Запустите из корня проекта:
   - ./start.ps1
2. Откройте:
   - Frontend: http://localhost:5173
   - Backend health: http://localhost:4000/api/health

Если backend не стартует, проверьте:
- файл backend/.env (можно создать из backend/.env.example)
- запущенный локальный PostgreSQL и корректный DATABASE_URL

## Тестовые пользователи
- admin@stepashka.dev / Admin@12345
- teacher@stepashka.dev / Teacher@12345
- student@stepashka.dev / Student@12345
