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

## Health endpoint

- `GET /api/v1/health`

## Auth endpoints

- `POST /api/v1/auth/login/` -> `{ access_token, refresh_token }`
- `POST /api/v1/auth/refresh` -> rotate refresh token and issue new tokens
- `POST /api/v1/auth/logout/` -> revoke refresh token
- `GET /api/v1/users/me/` -> current user profile and role

Use header:
- `Authorization: Bearer <access_token>`

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
