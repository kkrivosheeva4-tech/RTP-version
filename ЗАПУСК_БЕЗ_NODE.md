# Запуск проекта на согласованном стеке

Этот файл сохранен по историческому имени, но описывает актуальный способ запуска проекта на стеке:

- `HTML5`, `CSS3`, `JavaScript ES6+`
- `Python 3.14+`
- `Django 6`
- `PostgreSQL 14+`

Приложение работает через Django runtime. Отдельный frontend toolchain и локальная JS-сборка для штатного запуска не требуются.

## Быстрый старт

### Локальный запуск по HTTPS

1. Создайте виртуальное окружение:

```powershell
py -3.14 -m venv backend/.venv
```

2. Установите зависимости:

```powershell
backend/.venv/Scripts/python -m pip install --upgrade pip
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
```

3. Создайте локальный env-файл:

```powershell
Copy-Item backend/.env.example backend/.env
```

4. Заполните в `backend/.env` как минимум:

- `SECRET_KEY`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`

5. Инициализируйте базу и статические файлы:

```powershell
backend/.venv/Scripts/python backend/manage.py migrate
backend/.venv/Scripts/python backend/manage.py seed_references
backend/.venv/Scripts/python backend/manage.py seed_technologies
backend/.venv/Scripts/python backend/manage.py seed_users
backend/.venv/Scripts/python backend/manage.py collectstatic --noinput
```

6. Запустите локальный HTTPS-сервер:

```powershell
backend/.venv/Scripts/python scripts/dev_https_server.py --bind 127.0.0.1:8443
```

7. Откройте:

- `https://127.0.0.1:8443/`

## Local production-like

Если нужен локальный контур, близкий к целевому deployment-профилю:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-setup.ps1
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-init.ps1
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1
```

Smoke-проверка:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1
```

Остановка:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-stop.ps1
```

## Production / Linux

Целевой production entrypoint:

```bash
gunicorn --config gunicorn.conf.py config.wsgi:application
```

Подробный Linux-runbook:

- `docs/DEBIAN12_DEPLOY_RUNBOOK.md`

## Что не требуется

- отдельный frontend toolchain
- локальная JS-сборка для штатного запуска
- `node_modules`
- установка JS-зависимостей и отдельная frontend-сборка как обязательный шаг запуска

## Что используется

- Django templates и staticfiles
- PostgreSQL как основная СУБД
- Python management commands для bootstrap и smoke
- CDN-подключения для части клиентских библиотек

## Важно

- основной локальный запуск сейчас идет через Django-контур, а не через раздачу статических HTML-файлов
- для локального HTTPS используются сертификаты в `backend/.certs/`
- браузер может показать предупреждение из-за self-signed сертификата при первом открытии

## Полезные документы

- `docs/RUN_INSTRUCTIONS.md`
- `docs/LOCAL_PRODLIKE_SETUP.md`
- `docs/LOCAL_PRODLIKE_QUICKSTART.md`
- `docs/DEBIAN12_DEPLOY_RUNBOOK.md`
