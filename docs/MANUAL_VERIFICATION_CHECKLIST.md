# Чек-Лист Ручных Проверок

## 1. Базовый запуск

- Открыть `/`
- Убедиться, что главная страница рендерится через Django
- Убедиться, что CSS и JS загружаются из `/static/...`

## 2. Маршруты UI

Проверить открытие страниц:

- `/`
- `/radar/`
- `/admin-panel/`
- `/auth/login/`
- `/auth/2fa/setup/`
- `/auth/2fa/verify/`
- `/help/`

Проверить:

- нет переходов на `/src/pages/...`
- нет ошибок `404` на CSS/JS/изображения
- нет ссылок на `dist`

## 3. Авторизация и 2FA

- Войти тестовым пользователем
- Пройти `2FA setup`
- Пройти `2FA verify`
- Проверить `logout`
- Проверить, что refresh/logout работают в штатном Django runtime без отдельного frontend build-контура

## 4. Админка и роли

- Проверить доступ администратора к `/admin-panel/`
- Проверить, что обычный пользователь не получает лишних прав
- Проверить `users/me`
- Проверить `metrics`

## 5. Статика

В DevTools проверить:

- `main.js` грузится из `/static/main.js`
- auth-скрипты грузятся из `/static/js/...`
- CSS грузится из `/static/css/...`
- изображения грузятся из `/static/img/...`
- JSON-данные грузятся из `/static/data/...`

## 6. API и docs

Проверить:

- `/api/v1/health`
- `/api/v1/openapi.json`
- `/api/v1/docs`

## 7. Local production-like

- Запустить `scripts/local-prodlike-setup.ps1`
- Запустить `scripts/local-prodlike-init.ps1`
- Запустить `scripts/local-prodlike-start.ps1`
- Открыть `http://127.0.0.1:8000/`
- Запустить `scripts/local-prodlike-smoke.ps1`

## 8. Docker

- Выполнить `docker compose up --build`
- Убедиться, что контейнер поднимает:
  - PostgreSQL
  - Django/gunicorn
- Проверить доступ к приложению на `http://localhost:8000/`

## 9. Linux / Debian 12

- Проверить steps из `docs/DEBIAN12_DEPLOY_RUNBOOK.md`
- Проверить `gunicorn`
- Проверить `collectstatic`
- Проверить `nginx` config при необходимости
- Проверить `systemd` unit

## 10. Финальная проверка миграции

Подтвердить:

- запуск не требует отдельного frontend toolchain
- `Caddy` не нужен для запуска
- UI отдается через Django
- статика обслуживается Django
- основной runtime работает на `Python + Django + PostgreSQL`
- production entrypoint — `gunicorn`

## 11. Отдельный контрольный пункт

Остается отдельно подтвердить запуск именно на `Python 3.14`, если локальная машина пока работает на другой версии Python.

## 12. Remediation Checks 2026-03-26

### Auth, 2FA, Role Contract

- Проверить, что `/api/v1/auth/login/` в ветке `requires_2fa` не возвращает `legacy_role`
- Проверить, что `/api/v1/users/me/` не возвращает `legacy_role`
- Проверить, что список пользователей админки не содержит `legacy_role`
- Проверить, что при ручном добавлении `isLoggedIn`, `username`, `role`, `rmk_access_token`, `rmk_refresh_token` в `localStorage` интерфейс не считает пользователя авторизованным

### 2FA Secret Storage

- Выполнить `python backend/manage.py migrate`
- Проверить, что в рабочем env задан `TOTP_SECRET_ENCRYPTION_KEY`
- Открыть пользователя с уже настроенной 2FA и убедиться, что verify продолжает работать
- Убедиться в БД, что значение TOTP secret хранится как ciphertext, а не как открытый base32 secret

### Backup / Restore

- Создать backup через `/api/v1/admin-panel/backups`
- Изменить несколько сущностей: предприятие, технологию, proposal, справочник
- Выполнить `dry-run restore` и проверить counts
- Выполнить фактический restore и убедиться, что snapshot-состояние восстановилось
- При необходимости открыть JSON backup и проверить наличие `schema_version=2`, `references`, `technologies`

### Audit

- Проверить, что действия login/export/delete/backup/restore попадают в backend audit
- Проверить, что в браузере больше не создается `adminAuditLogs`

### HTTPS And CSP

- Проверить redirect `http -> https`
- Проверить, что secure cookies выставляются как `Secure`
- Открыть `/`, `/radar/`, `/admin-panel/`, `/auth/login/`, `/auth/2fa/setup/`, `/api/v1/docs`
- Проверить консоль браузера на `CSP violations`
- Отдельно проверить QR на 2FA setup и экспорт PDF, так как это зоны с временными внешними зависимостями
