# Local Prodlike Quickstart

Короткая инструкция для ежедневного запуска локального production-like контура.

## Запуск

Из корня репозитория:

```powershell
npm run prodlike:setup      # первый раз; если env уже есть — пропустить или -Force
npm run prodlike:init      # migrate + seed (PostgreSQL-only, без SQLite)
# или: npm run prodlike:postgres  # если есть backend/db.sqlite3
npm run prodlike:start
npm run prodlike:smoke
```

После старта рабочий origin:

- `https://rtp3.localhost`

## Остановка

```powershell
npm run prodlike:stop
```

Скрипт останавливает локальные процессы на портах:

- `443`
- `8000`
- `2019`

## Когда что использовать

- `prodlike:setup`:
  первый запуск или пересоздание локального env/profile. Если файл уже есть — пропустить или `npm run prodlike:setup -- -Force`.
- `prodlike:init`:
  migrate + seed для PostgreSQL-only (без SQLite). Рекомендуется для свежей установки.
- `prodlike:postgres`:
  миграция из SQLite в PostgreSQL + smoke (требует `backend/db.sqlite3`).
- `prodlike:start`:
  поднимает Django + HTTPS contour.
- `prodlike:smoke`:
  внешний smoke по public/auth/moderation/admin сценариям.
- `prodlike:stop`:
  штатная остановка локального контура.
