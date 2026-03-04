# RTP-3 Backend

## Quick start

1. Install dependencies:
   `pip install -r backend/requirements.txt`
2. Create local env file:
   `copy backend/.env.example backend/.env`
3. Run migrations:
   `python backend/manage.py migrate`
4. Start server:
   `python backend/manage.py runserver`

## Health endpoint

- `GET /api/v1/health`
