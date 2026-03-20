# План развития RTP-3 до готовности к тестовому AD и production baseline

**Версия плана:** 3.0
**Дата обновления:** 19.03.2026
**Основание:** фактическая сверка кода, workflow и документации в репозитории
**Допущение:** под `test AD` понимается тестовый контур с интеграцией в **Active Directory**
**Связанные артефакты:** `docs/JIRA_REMAINING_TASKS.md`, `docs/FRONTEND_STORAGE_POLICY.md`

---

## 1. Текущее состояние

### 1.1 Что подтверждено фактом в репозитории

- **Backend:** `ruff`, `black`, `isort` через `backend/pyproject.toml`; DRF с auth, references, technologies, admin-panel; PostgreSQL-only (SQLite fallback удалён).
- **Frontend:** `vite`, `vitest`, `playwright`; `eslint`, `prettier`; скрипты `lint:frontend`, `format:check:frontend`, `quality:frontend` в `package.json`.
- **CI:** `.github/workflows/quality.yml` (lint, backend-tests, frontend-unit-tests, postgres-smoke, docker-build); `.github/workflows/e2e.yml`.
- **Доменная логика:** role model v2; moderation API (`technology-proposals`); factor-engine; role-based onboarding с `master-flow`.
- **Auth:** cookie auth flow с refresh в HttpOnly cookie; auth-state **не хранится** в `localStorage/sessionStorage` (источник истины — `/api/v1/users/me`); backend 2FA через `pyotp`.
- **Admin:** frontend admin-панель (users, audit, backups, enterprises) **переведена на backend API**.
- **Инфраструктура:** `Dockerfile`, `docker-compose.yml`; `SERVE_FRONTEND_FROM_DJANGO=True` в env-примерах; PostgreSQL runbook/smoke.
- **Документация:** `RELEASE_PROCESS.md`, `TEAM_RESPONSIBILITIES.md`, `ROLE_MODEL_V2.md`, `ROLE_MIGRATION_PLAN.md`, `MODERATION_WORKFLOW.md`, `MATH_MODEL_FACTOR_ENGINE.md`, `INTERACTIVE_TOUR_ROLE_SCENARIOS.md`, `TEST_AD_DEPLOYMENT_RUNBOOK.md` — все присутствуют.
- **Swagger UI:** раздаётся с локальных ассетов (`swagger-ui-bundle`), не с CDN.

### 1.2 Что нельзя считать полностью закрытым

- **CDN-зависимости:** Chart.js (admin.html) и jsPDF/html2canvas (radar.html) загружаются с CDN; для автономного deployment желательно перевести на локальные пакеты.
- **Legacy auth fallback на frontend:** runtime UI в API-режиме больше не опирается на `isLoggedIn` / `username` / `role`; legacy storage оставлен только для mock/offline path.
- **2FA:** optional flow синхронизирован по пользовательскому флагу `is_2fa_enabled`: без флага login сразу выдаёт токены, с флагом требует setup/verify.
- **JWT:** в docs зафиксирован текущий baseline на кастомной реализации `auth_custom.jwt_utils`, а не на `simplejwt`.
- **localStorage:** UI/UX storage (theme, onboarding, positioning cache, vendors VFS) остаётся; policy описана в `FRONTEND_STORAGE_POLICY.md`, но при API-режиме admin-данные берутся с backend.
- **Refresh CSRF contract:** cookie refresh/logout синхронизированы вокруг явного production/test baseline: `AUTH_REFRESH_REQUIRE_CSRF=True`, frontend отправляет `X-CSRFToken`, backend tests и runbook отражают тот же сценарий.
- **Воспроизводимость локальных тестов:** frontend unit tests локально упираются в `spawn EPERM` при старте Vitest/esbuild, а backend tests неустойчивы при повторном запуске из-за интерактивного конфликта с `test_rtp3`; нужен стабильный non-interactive test workflow.

### 1.3 Оставшиеся разрывы (приоритетные)

1. **Test workflow hardening:** сделать frontend/backend тесты локально воспроизводимыми без ручного вмешательства.
2. **Negative weights:** решение и синхронизация с `MATH_MODEL_FACTOR_ENGINE.md`.
3. **TODO в select-events:** убрать или формально задокументировать legacy sync для обратной совместимости.

---

## 2. Целевое состояние (Definition of Done)

Проект считается готовым к тестовому развертыванию и стабилизации baseline, когда одновременно выполнены:

1. **Quality Gate**
   - локально работают `pre-commit`, backend lint, frontend lint/format checks;
   - любой PR проходит `lint + backend-tests + frontend-unit-tests`;
   - quality workflow выполняет также frontend build;
   - release gates описаны документально.
2. **Security/Auth**
   - refresh хранится только в HttpOnly cookie;
   - login/refresh/logout/me и 2FA синхронизированы между frontend и backend;
   - backend 2FA использует целевой TOTP provider без legacy fallback;
   - CORS/CSRF/prod origins формализованы;
   - frontend logout и refresh идут через backend-first flow;
   - auth-state не хранится в `localStorage/sessionStorage` как source of truth.
3. **Role/Gating**
   - единая role model v2 без legacy-hardcode в runtime UI;
   - роли и moderation flow синхронизированы на backend, frontend и в документации;
   - admin/frontend используют реальные API, а не локальное состояние.
4. **Math Model**
   - factor-engine поддерживает конфигурационное расширение без изменения ядра;
   - определено и реализовано поведение для negative factors / negative weights;
   - динамический pipeline покрывает `priorities`, `positioning`, analytics;
   - есть регресс-тесты по базовому набору данных.
5. **Operations**
   - проект работает в PostgreSQL-only режиме без SQLite fallback;
   - frontend может обслуживаться через Django как целевой deployment mode;
   - HTTPS и secure cookie policy являются целевым профилем, а не опцией;
   - есть deployment runbook для test AD;
   - есть PostgreSQL smoke и dry-run protocol;
   - есть healthchecks, observability baseline и alerting минимум;
   - Swagger UI работает на локальных ассетах.
6. **Documentation**
   - release process, responsibilities, role model, moderation, factor engine и tour scenarios актуальны;
   - docs не противоречат коду, CI и OpenAPI.

---

## 3. Обновленный план этапов

### Этап A. Quality Gate closure

**Статус:** `done`
**Цель:** сделать quality pipeline реально исполняемым и обязательным для PR.

- [x] A1. Backend quality stack оформлен через `backend/pyproject.toml`.
- [x] A2. Созданы `.pre-commit-config.yaml`, `eslint.config.cjs`, `.prettierrc.json`, `.prettierignore`.
- [x] A3. Введен отдельный workflow `.github/workflows/quality.yml`.
- [x] A4. Добавить в `package.json` рабочие frontend scripts:
  - `lint:frontend`
  - `format:check:frontend`
  - `quality:frontend`
- [x] A5. Добавить отсутствующие frontend devDependencies для `eslint` и `prettier`.
- [x] A6. Расширить `quality.yml` шагом `frontend build`.
- [x] A7. Добавить документацию:
  - `docs/RELEASE_PROCESS.md`
  - `docs/TEAM_RESPONSIBILITIES.md`
- [x] A8. Явно зафиксировать release gates и quality DoD в docs.

**Критерий завершения:** quality pipeline воспроизводимо запускается локально и в CI без фиктивных шагов.

### Этап B. Role model v2 и moderation closure

**Статус:** `done`
**Цель:** довести role model v2 до полного согласования между backend, frontend, API и docs.

- [x] B1. Backend role model v2 (`guest/editor/owner/admin`) внедрена.
- [x] B2. Capability-layer на frontend собран в `src/js/config/roles-config.js`.
- [x] B3. Moderation API approve/reject/create/mine/pending реализованы.
- [x] B4. Удалить остаточные legacy-role checks и legacy runtime-gating из `src/js/script.js` и связанных non-module сценариев.
- [x] B5. Выпустить актуальные docs:
  - `docs/ROLE_MODEL_V2.md`
  - `docs/ROLE_MIGRATION_PLAN.md`
  - `docs/MODERATION_WORKFLOW.md`
- [x] B6. Привести `Technology.status` к согласованной конечной модели:
  - либо `draft/pending_review/published/rejected`,
  - либо зафиксировать иной фактический контракт в code+docs.
- [x] B7. Подключить frontend moderation flow к backend endpoints.
- [x] B8. Перевести admin user-management frontend на backend API.
- [x] B9. Закрыть acceptance-тестами сценарии:
  - `editor` создает черновик;
  - `owner/admin` approve/reject;
  - UI скрывает недоступные действия.

**Критерий завершения:** нет legacy-role поведения в runtime, moderation и admin flow работают на реальном API, docs и тесты совпадают с кодом.

### Этап C. Factor Engine closure

**Статус:** `done`
**Цель:** довести матмодель до конфигурационной и тестируемой архитектуры.

- [x] C1. Базовый `factor-engine` и registry на frontend реализованы.
- [x] C2. Поддержан `negative impact` на уровне engine.
- [x] C3. Создать `docs/MATH_MODEL_FACTOR_ENGINE.md`.
- [x] C4. Перевести `src/js/modules/business/priorities.js` на dynamic factor registry.
- [x] C5. Убрать baseline-зашитые допущения из `positioning` и связанного preprocessing pipeline.
- [x] C6. Реализовать общий `fallbackPolicy: predict`, а не точечные обходы.
- [x] C7. Принять и зафиксировать решение:
  - поддерживаем отрицательные **веса**;
  - либо оставляем только отрицательный **impact** и корректируем требования/docs.
- [x] C8. Определить backend strategy:
  - либо backend parity factor-engine;
  - либо явно зафиксирован frontend-only расчет.
- [x] C9. Добавить регресс-тесты на `positioning`, analytics и базовое совпадение старой/новой модели.

**Критерий завершения:** новый фактор подключается конфигурацией, динамический pipeline работает сквозным образом, решение по negative weights/impact formalized и протестировано.

### Этап D. Hardening и test AD readiness

**Статус:** `done`
**Цель:** довести проект до первого контролируемого выката в test AD.

- [x] D1. Cookie auth flow переведен в HttpOnly-cookie режим.
- [x] D2. PostgreSQL runbook/smoke artifacts подготовлены.
- [x] D3. Role-based onboarding с `master-flow` реализован.
- [x] D4. Создать `docs/INTERACTIVE_TOUR_ROLE_SCENARIOS.md`.
- [x] D5. Подтвердить role-tour acceptance production-like тестами, включая скрытие нерелевантных шагов вне DOM.
- [x] D6. Ввести backend-enforced CSP и обновить security headers policy.
- [x] D7. Перевести Swagger UI на локальные ассеты без CDN.
- [x] D8. Подготовить `docs/TEST_AD_DEPLOYMENT_RUNBOOK.md`.
- [x] D9. Формализовать go/no-go критерии релиза.
- [x] D10. Добавить observability v2 minimum:
  - метрики;
  - логирование;
  - alerting/runbook минимум.
- [x] D11. Включить HTTPS-by-default конфигурацию:
  - `SECURE_SSL_REDIRECT=True`
  - `SESSION_COOKIE_SECURE=True`
  - `CSRF_COOKIE_SECURE=True`
  - proxy/HSTS/trusted origins согласованы с окружением.
- [x] D12. Провести full smoke:
  - PostgreSQL
  - cookie auth
  - HTTPS
  - API docs
  - onboarding/roles
  - moderation/admin path

**Критерий завершения:** есть воспроизводимый dry-run и финальный smoke-протокол для test AD.

### Этап E. Production-ready baseline

**Статус:** `done`
**Цель:** довести решение до устойчивого промышленного контура.

- [x] E1. Перейти на PostgreSQL-only без SQLite fallback:
  - `backend/config/settings.py`
  - `backend/.env.example`
  - CI/smoke/runbook.
- [x] E2. Сделать запуск frontend через Django целевым deployment mode:
  - включить `SERVE_FRONTEND_FROM_DJANGO=True`;
  - проверить раздачу `dist` через Django;
  - задокументировать runbook.
- [x] E3. Перевести auth-state на cookie/session-driven модель:
  - убрать `localStorage/sessionStorage` как источник истины для auth;
  - убрать legacy-флаги `isLoggedIn`, `username`, `role`;
  - синхронизировать logout/refresh/me flow.
- [x] E4. Зафиксировать политику по остальному `localStorage`:
  - что мигрирует в cookies/session/backend;
  - что остается как UI/UX storage;
  - что удаляется.
- [x] E5. Убрать legacy fallback из backend TOTP слоя и закрепить `pyotp` как единственный provider.
- [x] E6. Контейнеризация:
  - `Dockerfile`
  - `docker-compose.yml`
- [x] E7. Build-ready CI/CD:
  - frontend build
  - migrate/seed smoke
  - docker build
- [x] E8. Backup/restore регламент и проверка восстановления.
- [x] E9. Нагрузочный smoke по ключевым endpoint-ам.
- [x] E10. Подготовка release `v1.0.0-rc`.

**Критерий завершения:** v1.0.0-rc checklist выполнен, RC Evidence Package собран.

---

## 4. Приоритетный backlog

### P0. Высокий приоритет

1. [x] Перевести Chart.js, jsPDF, html2canvas с CDN на локальные npm-пакеты (admin.html, radar.html).
2. [x] Актуализировать `docs/FRONTEND_STORAGE_POLICY.md`: при API-режиме admin-данные не дублируются в localStorage.

### P1. Средний приоритет

3. [x] Зафиксировать в docs решение по JWT: кастомная реализация или `djangorestframework-simplejwt`.
4. [x] Проверить и довести 2FA до опциональности по признаку пользователя.
5. [x] Убрать runtime-зависимость frontend от legacy auth flags (`isLoggedIn`, `username`, `role`) или жестко изолировать ее как mock-only path.
6. [x] Синхронизировать cookie refresh/logout contract по CSRF: backend settings, frontend запросы, backend tests, runbook.
7. [x] Провести финальный production smoke: cookie auth + PostgreSQL + HTTPS.

### P2. Низкий приоритет

8. [x] Сделать локальный test workflow невзаимодействующим: frontend unit tests без `spawn EPERM`, backend tests без интерактивного конфликта с `test_rtp3`.
9. [x] Принять и зафиксировать решение по negative weights в `MATH_MODEL_FACTOR_ENGINE.md`.
10. [x] Закрыть TODO в `select-events.js` (синхронизация для обратной совместимости).

---

## 5. Риски и меры

- **Риск:** runtime UI всё ещё частично читает legacy auth flags из browser storage.
  **Мера:** изолировать mock-only path и убрать чтение legacy auth из production runtime (P1).

- **Риск:** cookie refresh/logout могут вести себя по-разному в тестах, docs и фактическом CSRF contract.
  **Мера:** синхронизировать backend settings, frontend и test-suite вокруг одного явного сценария (P1).

- **Риск:** docs baseline станет противоречить новому факту.
  **Мера:** после изменений обновлять `docs/DOCUMENTATION_BASELINE.md` и `JIRA_REMAINING_TASKS.md`.

---

## 6. Definition of Ready / Done

### DoR

- [ ] Есть цель задачи и измеримый measurable outcome.
- [ ] Понятны затрагиваемые модули и контракты.
- [ ] Описаны риски, тестирование и артефакты приемки.

### DoD

- [ ] Код, тесты, CI и docs синхронизированы.
- [ ] Acceptance criteria доказаны фактом в репозитории или runbook.
- [ ] В `docs/JIRA_REMAINING_TASKS.md` и kanban-статусах нет расхождений.

---

## 7. Следующее практическое действие

1. Выполнить P2: test workflow hardening, negative weights, TODO в select-events.
