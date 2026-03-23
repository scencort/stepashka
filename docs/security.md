# Безопасность

## 1. Аутентификация
- JWT access token (короткий TTL)
- Refresh token rotation
- Хранение хэша refresh в таблице refresh_tokens

## 2. Защита API
- helmet
- CORS с whitelisted origin
- rate limiting (global и auth)
- DTO/Schema validation через zod

## 3. Контроль доступа
- middleware authRequired + requireRoles
- проверка ролей на сервере
- запрет эскалации привилегий через публичные формы

## 4. Аудит и трассируемость
- audit_logs на критичные действия
- morgan access logs

## 5. Рекомендации для production
- секреты только через env/secret manager
- обязательная ротация JWT секретов
- отдельный WAF/Reverse proxy
- SAST и dependency scanning в CI
