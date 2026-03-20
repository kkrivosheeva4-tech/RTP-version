# Observability V2 Minimum

Дата: 18.03.2026  
Контур: test AD / production-like baseline

## Цель

Зафиксировать минимальный observability-пакет, который обязателен для test AD readiness.

Минимум должен покрывать:

- метрики;
- логи;
- alerting minimum;
- короткий operational runbook.

## 1. Метрики

Источником текущих runtime-метрик является backend endpoint:

- `GET /api/v1/metrics` — только для `admin`

На текущем этапе собираются in-memory counters, включая:

- `http.requests.total`
- `http.responses.<status>.total`
- `http.errors.4xx.total`
- `http.errors.5xx.total`
- `auth.login.success`
- `auth.login.failure`
- `auth.refresh.success`
- `auth.refresh.failure`
- `audit.<action>.total`

## 2. Логирование

Обязательный log-baseline:

- `rtp3.app` — HTTP requests, audit, unhandled exceptions;
- `rtp3.auth` — auth events success/failure;
- `django.request` — warnings по request-level ошибкам.

Минимальный runtime формат:

```text
%(asctime)s | %(levelname)s | %(name)s | %(message)s
```

## 3. Alerting Minimum

На текущем этапе alerting minimum не требует отдельной внешней платформы, но требует фиксированных trigger-условий.

Alert trigger считается сработавшим, если наблюдается одно из:

1. повторяющиеся `5xx` на `/api/*`;
2. систематические auth failures выше нормального уровня;
3. `/api/v1/health` или `/api/v1/openapi.json` недоступны;
4. `/api/v1/docs` не открывается или зависит от внешнего CDN;
5. metrics endpoint недоступен для admin при штатной авторизации.

## 4. Operational Runbook Minimum

При обнаружении алерта оператор должен:

1. Проверить `GET /api/v1/health`.
2. Проверить `GET /api/v1/openapi.json`.
3. Проверить `GET /api/v1/docs`.
4. Проверить `GET /api/v1/metrics` под `admin`.
5. Сопоставить recent logs для `rtp3.app`, `rtp3.auth`, `django.request`.
6. Зафиксировать:
   - время инцидента;
   - affected endpoint / flow;
   - тип ошибки;
   - решение: workaround / rollback / no-go.

## 5. Release Expectation

Для `D10` observability minimum считается выполненным, если:

- метрики доступны;
- request/auth/audit logs включены;
- alert triggers формализованы;
- есть короткий runbook реакции на инцидент.

## 6. Ограничения

- метрики пока in-memory и не переживают restart процесса;
- внешняя alerting-интеграция еще не включена;
- полноценная observability platform остается задачей следующего этапа развития.
