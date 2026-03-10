# Backend MVP: Open Risks and Limitations

Дата фиксации: 06.03.2026

## 1. Security / auth storage on frontend

- Риск: access/refresh токены сейчас хранятся во frontend в `localStorage`.
- Последствие: при XSS-уязвимости токены могут быть скомпрометированы.
- Рекомендация: перейти на HttpOnly cookie-модель для refresh-токена и усилить CSP.

## 2. Swagger UI external dependency

- Риск: страница `/api/v1/docs` использует Swagger UI через CDN (`unpkg.com`).
- Последствие: при недоступности внешней сети документация в UI может не загрузиться.
- Рекомендация: зафиксировать локальные статические assets Swagger UI в проекте.

## 3. Local/dev defaults vs production hardening

- Риск: для удобства локальной разработки часть security-параметров может быть ослаблена (`DEBUG=True`, relaxed cookies).
- Последствие: перенос dev-конфига в production создаст критический риск.
- Рекомендация: перед релизом проверить production `.env` по чек-листу из `docs/FRONTEND_BACKEND_SMOKE_CHECKLIST.md` (раздел 9).

## 4. DB profile for production

- Риск: в локальном контуре используется SQLite.
- Последствие: ограничения по конкурентной записи и блокировкам в нагрузке.
- Рекомендация: для production использовать PostgreSQL и прогнать smoke/regression на PostgreSQL-конфигурации.

## 5. Process maturity

- Риск: процессы pre-commit/CI/release governance еще не доведены до обязательного quality-gate на каждый PR.
- Последствие: выше вероятность регрессий при активной разработке и интеграции.
- Рекомендация: закрыть блок P0 из `docs/NEXT_DEVELOPMENT_PLAN.md` перед следующим релизным циклом.
