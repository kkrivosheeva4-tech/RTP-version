# Debian 12 Deploy Runbook

## Целевой стек

- Debian 12
- Python 3.14
- Django 6
- PostgreSQL 14+
- gunicorn
- nginx

## 1. Пакеты ОС

```bash
sudo apt update
sudo apt install -y python3.14 python3.14-venv python3-pip python3-dev build-essential libpq-dev postgresql-client nginx
```

## 2. Подготовка приложения

```bash
cd /opt/rtp3
python3.14 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## 3. Переменные окружения

Создайте `backend/.env` на основе `backend/.env.example` и задайте:

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DB_*`
- `AUTH_REFRESH_COOKIE_*`

## 4. Инициализация Django

```bash
. .venv/bin/activate
python backend/manage.py migrate
python backend/manage.py collectstatic --noinput
python backend/manage.py seed_references
python backend/manage.py seed_technologies
python backend/manage.py seed_users
```

## 5. gunicorn

```bash
. .venv/bin/activate
gunicorn --config gunicorn.conf.py config.wsgi:application
```

Для systemd используйте шаблон `ops/systemd/rtp3-gunicorn.service`.

## 6. nginx / TLS

Используйте пример `ops/nginx/rtp3.conf.example`.

Что должно быть настроено в production baseline:

- отдельный `server` на `80` с redirect на `https://`;
- отдельный `server` на `443 ssl http2`;
- валидные пути к `ssl_certificate` и `ssl_certificate_key`;
- `proxy_set_header X-Forwarded-Proto https`;
- `proxy_set_header X-Forwarded-Port 443`;
- раздача `/static/` напрямую из `backend/staticfiles`;
- proxy в `gunicorn` на `127.0.0.1:8000`.

После размещения конфига и сертификатов:

```bash
sudo ln -s /opt/rtp3/ops/nginx/rtp3.conf.example /etc/nginx/sites-enabled/rtp3.conf
sudo nginx -t
sudo systemctl reload nginx
```

Перед reload проверьте:

- `server_name`;
- пути `ssl_certificate` и `ssl_certificate_key`;
- путь `alias /opt/rtp3/backend/staticfiles/`;
- что `gunicorn` слушает `127.0.0.1:8000`.

## 7. Smoke

```bash
. .venv/bin/activate
python backend/manage.py test auth_custom config --noinput
python scripts/local_prodlike_smoke.py --base-url https://rtp3.example.com
```

## 8. Примечания

- Для production рекомендуется запускать `gunicorn` за `nginx`.
- Для локального Linux rehearsal можно временно обойтись без `nginx` и использовать только `gunicorn`.
- Backend `CSP` теперь задается из Django settings/middleware; временные внешние CDN-источники описываются через `CSP_*_EXTRA` env-переменные, а не через правку шаблонов.
