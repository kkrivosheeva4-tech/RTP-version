# RTP-3 Backend

## Quick start

1. Install dependencies:
   `pip install -r backend/requirements.txt`
2. Create local env file:
   `copy backend/.env.example backend/.env`
3. Configure PostgreSQL credentials in `backend/.env`
4. Run migrations:
   `python backend/manage.py migrate`
5. Seed reference data:
   `python backend/manage.py seed_references`
6. Seed technologies:
   `python backend/manage.py seed_technologies`
7. Seed test users:
   `python backend/manage.py seed_users`
8. Start server:
   `python backend/manage.py runserver`

## Django-served UI (single origin)

1. Configure frontend API mode in `src/js/config/api-config.local.js`:
   - `window.API_BASE_URL = window.location.origin`
2. Start backend:
   `python backend/manage.py runserver`

Then open `http://127.0.0.1:8000/` and Django will serve UI pages and static assets directly.

## Production WSGI start

Production baseline entrypoint:

`gunicorn --config gunicorn.conf.py config.wsgi:application`

Config lives in `gunicorn.conf.py` and defaults to:

- `chdir=backend`
- bind `0.0.0.0:8000`
- worker/thread settings via `GUNICORN_*` env vars

Production transport baseline:

- external TLS termination happens in `nginx`;
- `nginx` must redirect `80 -> 443`;
- `nginx` must forward `X-Forwarded-Proto=https`, `X-Forwarded-Port=443`, `X-Forwarded-Host`;
- reference config: `ops/nginx/rtp3.conf.example`.

## Local production-like contour

If you want local runtime to behave closer to the target deployment profile:

1. Bootstrap local prodlike files:
   `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-setup.ps1`
2. Prepare PostgreSQL runtime:
   `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-postgres.ps1`
3. Start local HTTPS contour:
   `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1`
4. Run external smoke:
   `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1`
5. Stop contour:
   `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-stop.ps1`

This mode uses:

- `backend/.env.prodlike.local` as the local secure env profile;
- `PostgreSQL` as the runtime database;
- `Django runserver` as the local application entrypoint;
- `https://127.0.0.1:8443` as the public origin;
- Django templates/staticfiles for same-origin frontend/API behavior.

Detailed instructions live in:

- `docs/LOCAL_PRODLIKE_SETUP.md`

## Health endpoint

- `GET /api/v1/health`
- `GET /api/v1/metrics` (admin only, in-memory counters for auth/http/audit)
- `GET /api/v1/openapi.json` (OpenAPI schema)
- `GET /api/v1/docs` (Swagger UI)

## Auth endpoints

- `POST /api/v1/auth/login/` -> either direct tokens or `{ requires_2fa: true, session_id, is_2fa_setup }`
- `POST /api/v1/auth/2fa/setup/` -> `{ secret, qr_url }`
- `POST /api/v1/auth/2fa/verify/` -> `{ access_token }` and refresh cookie in target profile
- `POST /api/v1/auth/refresh` -> rotate refresh cookie / issue new access token (`X-CSRFToken` required in cookie-mode when refresh-cookie exists)
- `POST /api/v1/auth/logout/` -> revoke refresh cookie/session (`X-CSRFToken` required in cookie-mode when refresh-cookie exists)
- `GET /api/v1/users/me/` -> current user profile and role

Use header:
- `Authorization: Bearer <access_token>`

Target storage model:

- refresh in HttpOnly cookie;
- auth truth via backend + runtime state;
- policy fixed in `docs/FRONTEND_STORAGE_POLICY.md`.

2FA optionality contract:

- `is_2fa_enabled=false` -> login completes immediately and returns tokens;
- `is_2fa_enabled=true` + empty `totp_secret` -> login requires `2fa/setup -> 2fa/verify`;
- `is_2fa_enabled=true` + existing `totp_secret` -> login requires `2fa/verify`.

JWT decision:

- backend uses the custom implementation in `auth_custom/jwt_utils.py`;
- token types: `access`, `refresh`, `2fa_session`;
- `simplejwt` is not the current runtime contract.

## Containers

Build image:

- `docker build -t rtp3:local .`

Run container baseline:

- `docker compose up --build`

The compose baseline uses:

- PostgreSQL service;
- Django templates/staticfiles for frontend delivery;
- cookie refresh auth;
- same-origin API/frontend on `http://localhost:8000`.

## Observability

- Unified app logs are configured via `LOG_LEVEL` (`INFO` by default).
- Audit trail is recorded for key CRUD operations in technologies/references/admin-panel APIs.
- Auth events are logged for login/logout/refresh (success/failure).
- Runtime counters are exposed via `GET /api/v1/metrics` for `admin`.
- Minimum alerting/runbook baseline is documented in `docs/OBSERVABILITY_V2_MINIMUM.md`.

## Security baseline

- In production mode (`DEBUG=False`), backend validates secure config on startup:
  - `SECRET_KEY` must be set and must not use placeholders.
  - `TOTP_SECRET_ENCRYPTION_KEY` must be set and must be a valid Fernet key for encrypted-at-rest 2FA secrets.
  - `ALLOWED_HOSTS` must be non-empty and must not contain `*`.
  - `CORS_ALLOW_ALL_ORIGINS` must be disabled and `CORS_ALLOWED_ORIGINS` must be explicit.
  - `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` must be enabled.
  - `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` must use `https://`.
  - `SECURE_HSTS_SECONDS` must be greater than `0`.
- CSP is backend-managed and emitted by middleware.
- Temporary third-party allowances for script/style/img/connect sources must be declared through `CSP_*_EXTRA` env vars.
- `CSP_INCLUDE_UPGRADE_INSECURE_REQUESTS=True` is recommended for reverse-proxied HTTPS contours.
- Auth endpoints are throttled (DRF scoped throttling):
  - `auth_login` -> `AUTH_LOGIN_RATE` (default `20/min`)
  - `auth_2fa` -> `AUTH_2FA_RATE` (default `30/min`)
  - `auth_refresh` -> `AUTH_REFRESH_RATE` (default `30/min`)
  - `auth_logout` -> `AUTH_LOGOUT_RATE` (default `60/min`)
- Refresh tokens use rotation: every successful `/api/v1/auth/refresh` revokes old refresh token and returns a new pair.

## Error format

All API errors are normalized to a single structure:

```json
{
  "ok": false,
  "error": "Human-readable message",
  "message": "Human-readable message",
  "code": "bad_request|unauthorized|forbidden|not_found|...",
  "details": {}
}
```

- `details` contains raw validation or backend error details when available.

## OpenAPI / Swagger

- Generate schema file:
  - `python backend/manage.py export_openapi --output docs/openapi.json`
- Runtime endpoints:
  - `/api/v1/openapi.json`
  - `/api/v1/docs`

## Tests

- Stable local test workflow:
  - backend: `python backend/manage.py test auth_custom references technologies admin_panel config --noinput`
  - focused auth/config: `python backend/manage.py test auth_custom config --noinput`
  - production-like smoke: `powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1`
- Run all backend tests:
  - `python backend/manage.py test auth_custom references technologies admin_panel config --noinput`
- Run focused checks:
  - `python backend/manage.py test auth_custom config`
- JWT unit tests:
  - `python backend/manage.py test auth_custom.test_jwt_utils`

**PostgreSQL test database:** Django creates a temporary `test_*` database for each run. The DB user must have `CREATEDB` privilege. If you see "нет прав для создания базы данных":

```sql
-- As superuser (e.g. postgres):
ALTER USER rtp3 CREATEDB;
```

## Frontend Smoke

- Local prodlike smoke checklist:
  - `docs/LOCAL_PRODLIKE_SETUP.md`
  - `docs/TEST_AD_SMOKE_PROTOCOL.md`
- Load / release baseline:
  - `docs/LOAD_SMOKE_RUNBOOK.md`
  - `docs/RELEASE_PROCESS.md`

## Seed commands

- `python backend/manage.py seed_references`
  Imports: `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprises-blocks-mapping`.
- `python backend/manage.py seed_technologies`
  Imports all records from `src/data/ru/technologies.json` and syncs related entities.
- `python backend/manage.py seed_users`
  Creates test accounts for roles: `admin`, `owner`, `editor`, `guest`, `architect`, `director`, `project_manager`, `analyst`, `viewer`.

Optional flags:
- `python backend/manage.py seed_references --clear-mappings`
- `python backend/manage.py seed_technologies --clear`
- `python backend/manage.py seed_users --reset-passwords`

## Test users (dev only)

- `admin@example.com` / `Admin123!`
- `owner@example.com` / `Owner123!`
- `editor@example.com` / `Editor123!`
- `guest@example.com` / `Guest123!`
- `architect@example.com` / `Architect123!`
- `director@example.com` / `Director123!`
- `project_manager@example.com` / `Manager123!`
- `analyst@example.com` / `Analyst123!`
- `viewer@example.com` / `Viewer123!`
