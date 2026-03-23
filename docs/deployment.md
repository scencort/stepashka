# Деплой и эксплуатация

## 1. Локальный запуск
1. Скопировать backend/.env.example в backend/.env
2. Запустить docker compose up --build
3. Проверить health: GET /api/health

## 2. Production схема
- Reverse proxy: Nginx/Traefik
- Backend replicas: 2+
- PostgreSQL: managed instance + backups
- Redis: managed instance
- Object storage: S3-compatible

## 3. CI/CD
- CI: lint/build/check для frontend и backend
- CD: сборка образов и ручной деплой

## 4. Мониторинг
- Prometheus собирает метрики backend
- Grafana дашборды для latency/error-rate
- Алерты по 5xx, росту failed логинов, queue lag

## 5. Резервирование
- Ежедневные бэкапы PostgreSQL
- Retention policy минимум 14 дней
- Регулярный restore drill
