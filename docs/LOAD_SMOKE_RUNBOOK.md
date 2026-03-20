# Load Smoke Runbook

## Цель

Зафиксировать минимальный нагрузочный smoke для production baseline без полноценного performance testing стенда.

## Команда

Из корня репозитория:

```bash
python scripts/load-smoke.py --iterations 10 --p95-threshold-ms 1500
```

Для более мягкого CI baseline:

```bash
python scripts/load-smoke.py --iterations 5 --p95-threshold-ms 2000
```

## Что проверяется

Скрипт сам создает временного admin-пользователя, проходит:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/2fa/verify/`

и затем замеряет latency для:

- `GET /api/v1/health`
- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`
- `GET /api/v1/users/me/`
- `GET /api/v1/technologies/`

## Acceptance Baseline

Load smoke считается успешным, если:

- все ответы возвращают ожидаемые HTTP status;
- скрипт завершился с кодом `0`;
- `p95` по каждому endpoint не превысил заданный threshold.

## Ограничения

- это не заменяет полноценный нагрузочный тест;
- скрипт проверяет baseline responsiveness и регрессии после infra/auth changes;
- результаты сравниваются только внутри одного класса окружений.

## Когда запускать

- перед `v1.0.0-rc`;
- после изменений в auth, PostgreSQL profile, Django-serving или container baseline;
- после изменений в docs/runbook, влияющих на deployment path.
