# RTP-3 Backend

## Quick start

1. Install dependencies:
   `pip install -r backend/requirements.txt`
2. Create local env file:
   `copy backend/.env.example backend/.env`
3. Run migrations:
   `python backend/manage.py migrate`
4. Seed reference data:
   `python backend/manage.py seed_references`
5. Seed technologies:
   `python backend/manage.py seed_technologies`
6. Seed test users:
   `python backend/manage.py seed_users`
7. Start server:
   `python backend/manage.py runserver`

## Run frontend from Django (single server)

1. Build frontend in repository root:
   `npm run build`
2. Configure frontend API mode in `src/js/config/api-config.local.js`:
   - `window.API_BASE_URL = window.location.origin`
   - `window.USE_API = true`
3. Enable frontend serving from Django:
   - PowerShell: `$env:SERVE_FRONTEND_FROM_DJANGO='1'`
4. Start backend:
   `python backend/manage.py runserver`

Then open `http://127.0.0.1:8000/` (Django will serve files from `dist/`).

## Health endpoint

- `GET /api/v1/health`
- `GET /api/v1/metrics` (admin only, in-memory counters for auth/http/audit)
- `GET /api/v1/openapi.json` (OpenAPI schema)
- `GET /api/v1/docs` (Swagger UI)

## Auth endpoints

- `POST /api/v1/auth/login/` -> `{ requires_2fa: true, session_id, is_2fa_setup }`
- `POST /api/v1/auth/2fa/setup/` -> `{ secret, qr_url }`
- `POST /api/v1/auth/2fa/verify/` -> `{ access_token, refresh_token }`
- `POST /api/v1/auth/refresh` -> rotate refresh token and issue new tokens
- `POST /api/v1/auth/logout/` -> revoke refresh token
- `GET /api/v1/users/me/` -> current user profile and role

Use header:
- `Authorization: Bearer <access_token>`

## Observability

- Unified app logs are configured via `LOG_LEVEL` (`INFO` by default).
- Audit trail is recorded for key CRUD operations in technologies/references/admin-panel APIs.
- Auth events are logged for login/logout/refresh (success/failure).

## Security baseline

- In production mode (`DEBUG=False`), backend validates secure config on startup:
  - `SECRET_KEY` must be set and must not use placeholders.
  - `ALLOWED_HOSTS` must be non-empty and must not contain `*`.
  - `CORS_ALLOW_ALL_ORIGINS` must be disabled and `CORS_ALLOWED_ORIGINS` must be explicit.
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

- Run all backend tests:
  - `python backend/manage.py test auth_custom references technologies admin_panel config`
- Run focused checks:
  - `python backend/manage.py test auth_custom config`
- JWT unit tests:
  - `python backend/manage.py test auth_custom.test_jwt_utils`

## Frontend Smoke

- Manual frontend/backend smoke checklist:
  - `docs/FRONTEND_BACKEND_SMOKE_CHECKLIST.md`
- Open risks and limitations:
  - `docs/BACKEND_OPEN_RISKS_AND_LIMITATIONS.md`

## Seed commands

- `python backend/manage.py seed_references`
  Imports: `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprises-blocks-mapping`.
- `python backend/manage.py seed_technologies`
  Imports all records from `src/data/ru/technologies.json` and syncs related entities.
- `python backend/manage.py seed_users`
  Creates test accounts for roles: `admin`, `architect`, `director`, `project_manager`, `analyst`, `viewer`.

Optional flags:
- `python backend/manage.py seed_references --clear-mappings`
- `python backend/manage.py seed_technologies --clear`
- `python backend/manage.py seed_users --reset-passwords`

## Test users (dev only)

- `admin` / `admin123`
- `architect` / `architect123`
- `director` / `director123`
- `project_manager` / `pm123`
- `analyst` / `analyst123`
- `viewer` / `viewer123`
