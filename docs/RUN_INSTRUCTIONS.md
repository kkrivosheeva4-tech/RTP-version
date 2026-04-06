# Инструкция по запуску

## Локальный запуск

Требования:

- Python `3.14+`
- PostgreSQL `14+`

Подготовка:

```powershell
py -3.14 -m venv backend/.venv
backend/.venv/Scripts/python -m pip install --upgrade pip
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

Заполните в `backend/.env`:

- `SECRET_KEY`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`

Инициализация:

```powershell
backend/.venv/Scripts/python backend/manage.py migrate
backend/.venv/Scripts/python backend/manage.py seed_references
backend/.venv/Scripts/python backend/manage.py seed_technologies
backend/.venv/Scripts/python backend/manage.py seed_users
backend/.venv/Scripts/python backend/manage.py collectstatic --noinput
```

Запуск по HTTPS:

```powershell
backend/.venv/Scripts/python scripts/dev_https_server.py --bind 127.0.0.1:8443
```

Рабочий адрес:

- `https://127.0.0.1:8443/`

Важно:

- при первом старте будут автоматически созданы `backend/.certs/localhost-cert.pem` и `backend/.certs/localhost-key.pem`;
- используется self-signed сертификат, поэтому браузер может показать предупреждение до добавления сертификата в доверенные;
- обычный `manage.py runserver` остаётся только как служебный HTTP-режим, основной локальный запуск теперь через HTTPS.

## Local production-like

Если у вас уже есть старый `backend/.env.prodlike.local`, пересоздайте его под HTTPS:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-setup.ps1 -Force
```

Далее:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-init.ps1
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1
```

Smoke:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1
```

Остановка:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-stop.ps1
```

## Production / Linux

См. [docs/DEBIAN12_DEPLOY_RUNBOOK.md](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/docs/DEBIAN12_DEPLOY_RUNBOOK.md).

Основной production entrypoint:

```bash
gunicorn --config gunicorn.conf.py config.wsgi:application
```

Production HTTPS baseline:

- внешний трафик завершается на `nginx`;
- `nginx` делает redirect `80 -> 443`;
- `nginx` проксирует в `gunicorn` на `127.0.0.1:8000`;
- пример конфига: [ops/nginx/rtp3.conf.example](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/ops/nginx/rtp3.conf.example);
- для production env должны быть заданы `USE_X_FORWARDED_HOST=True`, `USE_X_FORWARDED_PORT=True`, `SECURE_PROXY_SSL_HEADER_ENABLED=True`, `SECURE_SSL_REDIRECT=True`, `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`.

## Проверки после запуска

Минимум:

```powershell
backend/.venv/Scripts/python backend/manage.py test config.tests auth_custom.tests --noinput
```

Или production-like smoke:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1
```
