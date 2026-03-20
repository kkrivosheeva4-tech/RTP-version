# Test AD Deployment Runbook

Дата: 18.03.2026  
Контур: test AD

## 1. Цель

Документ фиксирует воспроизводимый порядок выката `RTP-3` в test AD контур и набор обязательных проверок до принятия решения `go/no-go`.

Этот runbook опирается на уже подготовленные артефакты:

- `docs/POSTGRES_MIGRATION_RUNBOOK.md`
- `docs/COOKIE_AUTH_MIGRATION_PLAN.md`
- `docs/INTERACTIVE_TOUR_ROLE_SCENARIOS.md`
- `docs/RELEASE_PROCESS.md`
- `docs/LOCAL_PRODLIKE_SETUP.md`

## 2. Scope выката

Текущий test AD deployment scope включает:

- backend на Django/DRF;
- PostgreSQL как целевую БД для test contour;
- cookie auth flow;
- локальный Swagger UI без CDN;
- role-based onboarding;
- moderation/admin-path.

Не входит в этот этап:

- production-only hardening beyond approved test AD profile;
- backend parity для factor-engine;
- PostgreSQL-only removal of SQLite fallback;
- Django-first frontend serving как обязательный deployment mode.

## 3. Предусловия

До начала dry-run или выката должны быть готовы:

1. Актуальная ветка/сборка с зелеными quality/tests/build gates.
2. Подготовленный env-профиль на основе `backend/.env.test.example`.
3. Доступный PostgreSQL instance.
4. Доступный test AD frontend origin, если frontend поднимается отдельно.
5. Назначенный release owner, который фиксирует итоговое решение `go/no-go`.

Для локальной rehearsal-сборки теперь доступен отдельный production-like contour:

- `backend/.env.prodlike.example` -> шаблон secure local env;
- `scripts/local-prodlike-postgres.ps1` -> bootstrap PostgreSQL по локальному env;
- `scripts/local-prodlike-start.ps1` -> локальный HTTPS + reverse proxy contour;
- `scripts/local-prodlike-smoke.ps1` -> runtime smoke по публичному `https://` origin.

## 4. Env baseline для test AD

Минимальный baseline:

- `DEBUG=False`
- `DB_ENGINE=postgresql`
- `CORS_ALLOW_CREDENTIALS=True`
- `AUTH_REFRESH_COOKIE_ENABLED=True`
- `AUTH_RETURN_REFRESH_TOKEN_IN_BODY=False`
- `AUTH_REFRESH_REQUIRE_CSRF=True`
- `CSP_ENABLED=True`
- `SERVE_FRONTEND_FROM_DJANGO=False` на текущем этапе допустим

Auth baseline для smoke:

- пользователь с `is_2fa_enabled=false` входит сразу и получает токены без шага verify;
- пользователь с `is_2fa_enabled=true` проходит `login -> 2fa/setup|verify -> tokens`;
- cookie-based `refresh` и `logout` выполняются только с `credentials: include` и `X-CSRFToken`, если уже выставлен refresh-cookie.

HTTPS-профиль для test AD теперь считается целевым baseline, а не опцией:

- `SECURE_SSL_REDIRECT=True`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- `AUTH_REFRESH_COOKIE_SECURE=True`
- `USE_X_FORWARDED_HOST=True`
- `USE_X_FORWARDED_PORT=True`
- `SECURE_PROXY_SSL_HEADER_ENABLED=True`
- `SECURE_HSTS_SECONDS>0`

## 5. Артефакты до выката

Перед выкатом release owner должен собрать:

- ссылку на commit / release candidate;
- ссылку на зеленые CI/local verification результаты;
- файл env baseline или безопасную ссылку на секретный профиль;
- лог PostgreSQL dry-run;
- smoke-результаты по auth/API/onboarding/moderation/admin path;
- список известных ограничений.

## 6. Dry-Run перед cutover

Рекомендуемый путь:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/postgres-dry-run.ps1 `
  -PostgresHost localhost `
  -PostgresPort 5432 `
  -PostgresDb rtp3 `
  -PostgresUser rtp3 `
  -PostgresPassword rtp3 `
  -RunSmokeChecks `
  -RunBackendTests
```

Dry-run считается успешным, если:

- миграции применились;
- fixture загрузился;
- sequence reset выполнен;
- `scripts/postgres-smoke-check.py` прошел;
- backend tests на PostgreSQL прошли.

## 7. Deployment Procedure

### Шаг 1. Freeze scope

1. Зафиксировать commit / tag / RC build.
2. Подтвердить, что scope выката совпадает с описанием release candidate.

### Шаг 2. Подготовить окружение

1. Применить env-профиль test AD.
2. Проверить доступность PostgreSQL.
3. Проверить `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`.

### Шаг 3. Backend bootstrap

1. Установить backend dependencies.
2. Выполнить:

```bash
python backend/manage.py migrate
```

3. При необходимости загрузить/синхронизировать данные по dry-run protocol.

### Шаг 4. Frontend / Docs availability

Проверить:

- frontend build доступен и совместим с backend API;
- `/api/v1/openapi.json` отвечает;
- `/api/v1/docs` открывается;
- Swagger UI не использует внешний CDN.

### Шаг 5. Runtime smoke

Обязательный smoke после старта backend:

1. `GET /api/v1/health` -> `200`
2. `GET /api/v1/openapi.json` -> `200`
3. `GET /api/v1/docs` -> `200`
4. cookie auth flow:
   - login без 2FA для пользователя с `is_2fa_enabled=false`
   - login -> 2FA setup/verify для пользователя с `is_2fa_enabled=true`
   - refresh
   - logout
5. onboarding / roles:
   - `guest`
   - `editor`
   - `owner`
   - `admin`
6. moderation flow:
   - editor создает proposal
   - owner/admin approve/reject
7. admin path:
   - users/me
   - admin panel user-management
8. PostgreSQL smoke:
   - CRUD technology
   - sequence sanity
9. HTTPS/security baseline:
   - HTTP requests redirect to HTTPS where applicable
   - secure cookies выставляются как `Secure`
   - trusted origins и CORS настроены на `https://` origins
10. observability baseline:

- `GET /api/v1/metrics` доступен под `admin`
- request/auth/audit counters обновляются

## 8. Smoke Matrix

### API baseline

- `GET /api/v1/health`
- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`

### Auth baseline

- login + 2FA verify
- refresh через cookie-mode
- logout
- refresh-token не остается в storage как источник истины для test contour flow

### Role / UI baseline

- onboarding flow соответствует роли;
- нерелевантные steps не участвуют в visible-flow;
- proposal/admin UI скрыты для неразрешенных ролей.

### Admin / moderation baseline

- admin panel отдает пользователей через backend API;
- proposal flow проходит на реальном API.

### Database baseline

- backend использует PostgreSQL;
- CRUD проходит без sequence drift.

## 9. Go / No-Go Evidence

До решения release owner должен зафиксировать:

- дату и контур прогона;
- версию/commit;
- кто запускал deployment;
- какие smoke-checks выполнены;
- какие ограничения приняты;
- итог: `GO` или `NO-GO`.
- локальный пример заполненного protocol: `docs/TEST_AD_SMOKE_PROTOCOL.md`.

Рекомендуемый шаблон:

```text
Date:
Contour:
Commit/RC:
Release owner:
Smoke results:
- PostgreSQL:
- cookie auth:
- API docs:
- onboarding/roles:
- moderation/admin:
Known limitations:
Decision: GO / NO-GO
```

## 10. Rollback

Если smoke не проходит:

1. Зафиксировать `NO-GO`.
2. Остановить rollout.
3. Вернуть предыдущий env/profile или предыдущий backend build.
4. Если проблема связана с PostgreSQL cutover, применить rollback из `docs/POSTGRES_MIGRATION_RUNBOOK.md`.
5. Если проблема связана с cookie auth, использовать rollback steps из `docs/COOKIE_AUTH_MIGRATION_PLAN.md`.
6. Зафиксировать причину отката и blocker для следующего запуска.

## 11. Exit Criteria

Runbook считается выполненным для конкретного test AD запуска, если:

- есть dry-run evidence;
- runtime smoke пройден;
- release owner зафиксировал `GO` или `NO-GO`;
- все отклонения от baseline перечислены явно.
