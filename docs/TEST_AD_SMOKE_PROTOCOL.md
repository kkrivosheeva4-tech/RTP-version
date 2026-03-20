# TEST AD Smoke Protocol

## 1. Purpose

Зафиксировать финальный `D12 full smoke` в логике локальной подготовки к развертыванию: что подтверждено на рабочей станции, какие артефакты готовы для test AD и какие проверки остаются contour-only.

## 2. Execution Context

- Date: `2026-03-18`
- Contour: `local development workstation`
- OS: `Windows 10`
- Workspace profile: `backend/.env` -> `DB_ENGINE=sqlite3`, `SERVE_FRONTEND_FROM_DJANGO=True`
- Test AD target profile: `backend/.env.test.example` -> HTTPS-by-default + cookie auth + production-like security baseline

## 3. Executed Commands

### Backend smoke suites

```text
python backend/manage.py test auth_custom technologies admin_panel config
```

Result:

- `45 tests`
- `OK`
- covers auth, cookie mode, API docs, metrics, moderation/proposals, admin panel, HTTPS/test env validations

### Frontend smoke suites

```text
npm run test:run
```

Result:

- `11 files passed`
- `96 tests passed`

Note:

- `package.json` test scripts were normalized to `vitest --pool=threads --maxWorkers=1`, because the default multi-worker startup was unstable on this Windows workstation path and produced false-negative worker timeouts.

### Frontend production build

```text
npm run build
```

Result:

- build completed successfully
- `dist/` generated
- Vite reported only known warnings about non-module scripts in HTML and large chunks; no build failure

## 4. Coverage Matrix

### PostgreSQL

Status: `prepared locally, contour execution pending`

Confirmed locally:

- PostgreSQL dry-run and smoke artifacts already exist:
  - `scripts/postgres-dry-run.ps1`
  - `scripts/postgres-smoke-check.py`
  - `docs/POSTGRES_MIGRATION_RUNBOOK.md`
- backend smoke suites validated database-sensitive paths:
  - technology CRUD
  - moderation apply/reject flow
  - admin CRUD
  - metrics/docs/auth runtime

Limitation:

- actual `PostgreSQL engine` smoke was not executed on this workstation because current local runtime profile is `sqlite3`
- required contour command remains `python scripts/postgres-smoke-check.py` after switching environment to PostgreSQL

### Cookie Auth

Status: `passed`

Confirmed by backend smoke:

- login without 2FA returns tokens immediately
- login with 2FA flag follows setup / verify
- refresh through cookie-mode
- logout through cookie-mode
- CSRF guard behavior for cookie-based refresh/logout (`X-CSRFToken` required when refresh-cookie exists)

### HTTPS

Status: `validated by config/tests, runtime contour check pending`

Confirmed locally:

- `config.tests` validates HTTPS-by-default profile in `backend/.env.test.example`
- secure cookies / trusted origins / HSTS expectations are encoded in settings and covered by tests

Contour-only validation still required:

- real HTTP -> HTTPS redirect behind target proxy
- real `Secure` cookie behavior in HTTPS environment
- real trusted origin / proxy header behavior in deployed contour

### API Docs

Status: `passed`

Confirmed by backend smoke:

- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`
- local Swagger assets served from backend
- no CDN dependency required for docs UI

### Onboarding / Roles

Status: `passed`

Confirmed by frontend smoke:

- role-driven onboarding scenarios
- conditional hiding of irrelevant steps when target DOM nodes are absent
- role config and UI gating regressions remain covered in automated tests

### Moderation / Admin Path

Status: `passed`

Confirmed by backend and frontend smoke:

- editor creates proposal
- owner/admin sees pending proposals
- approve/reject flow updates status and target technology
- admin user CRUD works through backend API
- metrics endpoint remains admin-protected
- frontend `DataService` proposal flow passes against mocked API contract

## 5. Final Assessment

Local result:

- `GO for deployment handoff / environment preparation`

Residual contour-only checks:

- final PostgreSQL engine smoke in target profile
- live HTTPS/proxy verification in deployed test AD contour

This means `Этап D` is complete from the development side: the application is locally validated, the runbook is ready, and the remaining checks are deployment-environment validations rather than coding blockers.

## 6. Update After Local Prodlike Enablement

После добавления `docs/LOCAL_PRODLIKE_SETUP.md` и связанных scripts часть бывших contour-only проверок можно прогонять локально:

- HTTPS через локальный reverse proxy;
- `Secure` cookies на публичном `https://` origin;
- PostgreSQL runtime вне SQLite fallback;
- внешний auth/admin/moderation smoke через `scripts/local_prodlike_smoke.py`.

Иными словами, теперь у проекта есть не только deployment runbook, но и локальный rehearsal contour, максимально приближенный к будущему развертыванию.
