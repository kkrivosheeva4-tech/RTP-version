# PostgreSQL Migration Runbook (Stage C2)

Дата: 16.03.2026  
Контур: test AD / staging rehearsal

## 1. Цель

Перевести backend с SQLite на PostgreSQL с повторяемым dry-run, smoke-проверкой и rollback-планом.

## 2. Предусловия

- PostgreSQL доступен и создана БД (`DB_NAME`).
- Применен профиль переменных окружения с `DB_ENGINE=postgresql` (см. `backend/.env.test.example`).
- Установлены Python и зависимости backend.

## 3. Dry-run (рекомендуемый путь)

Из корня репозитория:

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

Что делает скрипт:

1. Экспортирует данные из SQLite в `backend/data-migration.json`.
2. Подключается к PostgreSQL, выполняет `migrate`.
3. Загружает fixture в PostgreSQL.
4. Выполняет sequence reset.
5. Запускает smoke-check (`scripts/postgres-smoke-check.py`) и backend tests (опционально).

## 4. Smoke-критерии успешности

- `GET /api/v1/health` -> `200`.
- `GET /api/v1/openapi.json` -> `200`.
- auth flow: `login -> 2fa verify -> refresh -> logout` проходит.
- CRUD технологий проходит на PostgreSQL.
- Sequence sanity: новый `id` больше предыдущего `max(id)`.

## 5. Cutover checklist

1. Зафиксировать backup SQLite (`backend/db.sqlite3`) и fixture export.
2. Переключить env на PostgreSQL профиль.
3. Выполнить `python backend/manage.py migrate`.
4. Выполнить загрузку/проверку данных (dry-run шаги без повторного экспорта при необходимости).
5. Прогнать smoke и ключевые e2e.
6. Зафиксировать go/no-go решение.

## 6. Rollback

Если PostgreSQL cutover не проходит:

1. Вернуть `DB_ENGINE=sqlite3` и `DB_NAME=db.sqlite3`.
2. Перезапустить backend.
3. Проверить `health` и auth smoke на SQLite.
4. Зафиксировать причину отката и повторить dry-run после исправлений.

## 7. Риски

- Несовпадение последовательностей ID после `loaddata`.
- Некорректные charset/encoding при fixture.
- Поведенческие различия ORM-запросов на PostgreSQL.

## 8. Артефакты прогона

- `backend/data-migration.json`
- Логи выполнения `postgres-dry-run.ps1`
- Результаты smoke (`scripts/postgres-smoke-check.py`)

## 9. Local production-like shortcut

Для локального production-like contour не нужно вручную собирать все параметры PostgreSQL.
Можно использовать обертку:

```powershell
npm run prodlike:postgres
```

или:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-postgres.ps1 `
  -RunSmokeChecks `
  -RunBackendTests
```

Параметры будут взяты из `backend/.env.prodlike.local`.
