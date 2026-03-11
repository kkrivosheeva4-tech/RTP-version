# Анализ текущего состояния и план дальнейшей разработки

**Проверено:** 06.03.2026
**Обновлено с учетом новых согласований по ролям:** 06.03.2026

## 1. Текущее состояние приложения (по факту репозитория)

### 1.1 Что уже реализовано

- Backend MVP закрыт: auth (JWT + 2FA), CRUD технологий, справочники, admin-panel, аудит, метрики, OpenAPI/Swagger.
- Frontend интегрирован с API-слоем (`ApiClient`, `DataService`, конфиг переключения mock/API), есть 2FA-экраны и модульная архитектура.
- Документация по API и smoke-сценариям присутствует (`docs/BACKEND_API_SPEC.md`, `docs/FRONTEND_BACKEND_SMOKE_CHECKLIST.md`).

### 1.2 Актуальный baseline качества

- Backend тесты: `python backend/manage.py test auth_custom references technologies admin_panel config` -> **45/45 passed** (06.03.2026).
- Frontend unit тесты: `npm.cmd run test:run` -> **63/63 passed** (06.03.2026).
- CI в `.github/workflows` сейчас покрывает только `Playwright E2E` (`e2e.yml`).

### 1.3 Новые требования после согласований

1. Новая ролевая модель:
   - `guest` (просмотр/фильтры/отчеты),
   - `owner` (полный CRUD и публикация технологий),
   - `editor` (предложение изменений через модерацию),
   - `admin` (управление системой и пользователями).
2. Интерактивный тур должен показывать только шаги, доступные текущей роли.
3. Математическая модель должна быть расширяема: добавление/удаление факторов без полной переработки ядра.
4. В обязательный scope следующего цикла включены:
   - переход backend c SQLite на PostgreSQL,
   - переход frontend auth-хранилища с `localStorage` на cookie-модель (HttpOnly refresh + безопасная схема access).

### 1.4 Ключевые пробелы на старте нового цикла

- Текущие роли в коде и документации (`architect/director/project_manager/analyst/viewer`) не соответствуют новой модели.
- Логика прав и UI-гейтинга распределена по многим модулям и hardcode-условиям.
- Onboarding-тур реализован единым сценарием и привязан к старым ролям.
- Расчетные модули (`priorities`, `positioning`, `analytics`) используют фиксированный набор факторов.
- Нет единого pre-commit/lint/CI quality-gate на каждый PR.

---

## 2. Рекомендованная последовательность реализации

### 2.1 Почему именно такой порядок

1. Сначала стабилизируем процесс разработки (quality-gate), чтобы безопасно вносить крупный role-refactor.
2. Затем делаем миграцию ролевой модели как базовый слой прав и workflow.
3. Параллельно закладываем инфраструктурные миграции (PostgreSQL + cookie auth), так как они влияют на интеграцию и безопасность.
4. После фиксации прав включаем ролевой onboarding (иначе тур придется переписывать повторно).
5. Отдельно выносим рефактор матмодели в факторный движок, и только после этого добавляем новые (в том числе отрицательные) факторы.

---

## 3. Приоритеты и этапы

### Приоритет P0 (1-2 недели)

1. Ввести единый quality-gate:
   - backend: `ruff` + `black` + `isort` + pre-commit hooks;
   - frontend: `eslint` + `prettier` + pre-commit hooks.
2. Расширить CI:
   - job `lint` (backend + frontend);
   - job `backend-tests`;
   - job `frontend-unit-tests`;
   - e2e оставить отдельным job (PR/nightly).
3. Формализовать delivery-процесс:
   - шаблон задачи (DoR/DoD/риски/чек тестов),
   - схема versioning API,
   - owner-матрица и kickoff-протокол.

**Критерий завершения P0:** любой PR проходит единый CI, локально работает pre-commit, процесс релиза формализован.

### Приоритет P1 (2-4 недели) - ролевая модель v2

1. Подготовить миграцию ролей и контракты:
   - mapping старых ролей -> новых,
   - обновление API-контрактов и документации по доступам.
2. Реализовать role model v2 на backend:
   - роли `guest/owner/editor/admin` в модели и permissions,
   - политика доступа к endpoint-ам,
   - workflow модерации для `editor` (draft -> approve/reject owner/admin).
3. Реализовать role model v2 на frontend:
   - единый role-capabilities слой,
   - переработка гейтинга кнопок/форм/страниц и меню,
   - обновление админ-панели управления пользователями по новым ролям.

**Критерий завершения P1:** права по всем ключевым сценариям соответствуют новой ролевой модели, покрыты API/UI тестами.

### Приоритет P2 (параллельно с P1, затем завершение в следующем спринте) - матмодель и факторный движок

1. Рефактор математической модели в расширяемую архитектуру факторов:
   - реестр факторов (`factor registry`) и конфиг весов,
   - единый pipeline нормализации/валидации факторов,
   - независимость ядра расчета от количества факторов.
2. Добавить поддержку динамики факторов:
   - добавление/отключение фактора через конфиг без переписывания формулы,
   - fallback для отсутствующих данных,
   - тесты совместимости со старой моделью.
3. После рефактора внедрить новые факторы (включая отрицательные) как отдельный слой.

**Критерий завершения P2:** новый фактор подключается конфигурационно и не требует изменения ядра расчета/позиционирования.

### Приоритет P3 (после завершения P1) - ролевой интерактивный тур

1. Сделать единый полный сценарий тура (master-flow) по всем возможным шагам.
2. Ввести ролевые профили отображения шагов:
   - `guest`: только просмотр, фильтры, отчеты;
   - `owner`: плюс CRUD/публикация;
   - `editor`: плюс создание предложений и статусы модерации;
   - `admin`: плюс функции админ-панели.
3. Добавить автопроверки, что скрытые шаги не показываются ролям без прав.

**Критерий завершения P3:** каждый пользователь видит только релевантные шаги тура согласно реальным правам.

### Приоритет P4 (обязательные миграции данных и auth-хранилища)

1. Переход на PostgreSQL:
   - целевой профиль окружений (dev/stage/prod) только на PostgreSQL;
   - runbook миграции (dump/load, sequence fix, rollback);
   - полный smoke/regression в PostgreSQL-контуре перед cutover.
2. Переход с `localStorage` на cookie auth-модель:
   - refresh token -> HttpOnly Secure SameSite cookie;
   - пересмотр refresh/login/logout flow на frontend/backend;
   - удаление зависимости критичного auth-состояния от `localStorage`.
3. Security hardening вокруг cookie-схемы:
   - CSRF strategy для cookie-based auth,
   - CSP/policy headers,
   - ревизия CORS/credentials режима.

**Критерий завершения P4:** backend работает на PostgreSQL, auth-поток не хранит refresh в `localStorage`, миграция и rollback формализованы.

### Приоритет P5 (hardening и production readiness)

1. Локальные Swagger assets (без CDN зависимости).
2. Observability v2 и алерты.
3. Финальный production smoke + release checklist.

---

## 4. План-график на ближайшие 3 спринта

### Спринт A

- [ ] P0: quality-gate (pre-commit + lint + quality CI).
- [ ] P1: дизайн role model v2, mapping ролей и матрица доступов.
- [ ] P2: дизайн factor registry и спецификация расширяемой матмодели.
- [ ] Синхронизация документации по ролям и доступам (`docs/BACKEND_API_SPEC.md`, `docs/ARCHITECTURE_BRIEF.md`).

### Спринт B

- [ ] P1: backend/frontend реализация role model v2 + moderation workflow (`editor`).
- [ ] P2: рефактор расчетного ядра под подключаемые факторы + регресс-тесты модели.
- [ ] P4: подготовка PostgreSQL migration runbook и staging-прогон.
- [ ] P4: внедрение cookie auth flow (backend + frontend) в staging.

### Спринт C

- [x] P3: ролевой интерактивный тур (master-flow + role-based step filters).
- [ ] P2: подключение новых факторов (включая отрицательные) без переработки ядра.
- [ ] P4: cutover на PostgreSQL и отключение `localStorage`-зависимого refresh flow.
- [ ] P5: security/prod-hardening блок и финальный интеграционный smoke.

---

## 5. Артефакты, которые нужно создать в этом цикле

- `docs/TASK_TEMPLATE.md` (шаблон задачи: DoR/DoD/риски/чек тестов)
- `.pre-commit-config.yaml`
- `pyproject.toml` (или эквивалент с backend lint/format конфигом)
- `eslint`/`prettier` конфиги для frontend
- `.github/workflows/quality.yml`
- `docs/ROLE_MODEL_V2.md`
- `docs/ROLE_MIGRATION_PLAN.md`
- `docs/MODERATION_WORKFLOW.md`
- `docs/INTERACTIVE_TOUR_ROLE_SCENARIOS.md`
- `docs/MATH_MODEL_FACTOR_ENGINE.md`
- `docs/POSTGRES_MIGRATION_RUNBOOK.md`
- `docs/COOKIE_AUTH_MIGRATION_PLAN.md`
- `docs/RELEASE_PROCESS.md`
- `docs/API_VERSIONING_POLICY.md`
- `docs/TEAM_RESPONSIBILITIES.md`
- `docs/KICKOFF_<дата>.md`

---

## 6. Отложенный scope (после развертывания в контуре)

- Роль `vendor` и отдельный внешний сервис подачи технологий.
- Отдельный vendor-тур и сценарии модерации внешних заявок.

---

## 7. Фиксация выполнения этапов

### ✅ Этап 1 (P0.1): единый quality-gate (lint/format/pre-commit) — 10.03.2026 (ретро-фиксация)

- Почему фиксируется ретро:
  - Изначально работа стартовала с `Этапа 2` по вашему запросу, поэтому `P0.1` не был отдельно занесен в журнал этапов.
- Что сделано:
  - Настроены backend quality-инструменты `ruff + black + isort` через `backend/pyproject.toml`.
  - Добавлены frontend quality-команды `eslint + prettier` в `package.json` (`lint:frontend`, `format:check:frontend`, `quality:frontend`).
  - Добавлен единый pre-commit pipeline `.pre-commit-config.yaml` с backend и frontend hooks.
- Измененные/используемые файлы:
  - `backend/pyproject.toml`
  - `package.json`
  - `.pre-commit-config.yaml`
- Ручная проверка:
  - Локально выполнить `npm.cmd run quality:frontend` и убедиться, что eslint/prettier проходят без ошибок.
  - Локально выполнить `python -m ruff check --config backend/pyproject.toml backend`, `python -m black --check --config backend/pyproject.toml backend`, `python -m isort --check-only --settings-path backend/pyproject.toml backend`.
  - Выполнить `pre-commit run --all-files` и убедиться, что хуки отрабатывают для backend/frontend.
- Статус этапа: выполнен.

### ✅ Этап 2 (P0.2): расширение CI — 10.03.2026

- Что сделано:
  - Добавлен отдельный quality workflow `.github/workflows/quality.yml` с jobs: `lint`, `backend-tests`, `frontend-unit-tests`.
  - E2E оставлен отдельным workflow `.github/workflows/e2e.yml` и переведен на запуск в `pull_request` и по nightly-расписанию (`cron: 0 1 * * *`), плюс ручной запуск (`workflow_dispatch`).
- Измененные файлы:
  - `.github/workflows/quality.yml`
  - `.github/workflows/e2e.yml`
- Ручная проверка:
  - В любом PR в ветки `main/master/develop` проверить, что запускаются `Quality Gate` и `E2E Tests`.
  - Проверить в GitHub Actions наличие scheduled-run для `E2E Tests` (ежедневно в `01:00 UTC`).
  - Проверить, что падение E2E прикладывает артефакт `playwright-report`.
- Статус этапа: выполнен.

### ✅ Этап 3 (P0.3): формализация delivery-процесса — 10.03.2026

- Что сделано:
  - Создан шаблон постановки/приемки задач с `DoR/DoD/рисками/чек-листом тестов`: `docs/TASK_TEMPLATE.md`.
  - Зафиксирована политика версионирования API: `docs/API_VERSIONING_POLICY.md`.
  - Зафиксирована owner-матрица (RACI и владельцы артефактов): `docs/TEAM_RESPONSIBILITIES.md`.
  - Зафиксирован регламент релизного процесса и rollback: `docs/RELEASE_PROCESS.md`.
  - Создан kickoff-протокол текущего цикла: `docs/KICKOFF_2026-03-10.md`.
- Измененные файлы:
  - `docs/TASK_TEMPLATE.md`
  - `docs/API_VERSIONING_POLICY.md`
  - `docs/TEAM_RESPONSIBILITIES.md`
  - `docs/RELEASE_PROCESS.md`
  - `docs/KICKOFF_2026-03-10.md`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Провести короткий review документов с участием PO/BE Lead/FE Lead/QA/DevOps и подтвердить, что роли и зоны ответственности в `TEAM_RESPONSIBILITIES.md` соответствуют фактической команде.
  - Подтвердить, что политика `API_VERSIONING_POLICY.md` совместима с текущим процессом обновления `docs/openapi.json` и `docs/BACKEND_API_SPEC.md`.
  - Подтвердить, что шаблон `TASK_TEMPLATE.md` будет обязателен для новых задач спринта (минимум 1 пилотная задача заполнена по шаблону).
  - Подтвердить, что `RELEASE_PROCESS.md` покрывает текущий цикл выката (go/no-go, smoke, rollback) и согласован Release Owner.
- Статус этапа: выполнен.

### ✅ Этап 4 (P1.1): mapping legacy ролей и обновление контрактной документации — 10.03.2026

- Что сделано:
  - Зафиксирована целевая ролевая модель v2 (`guest/editor/owner/admin`) и capability matrix: `docs/ROLE_MODEL_V2.md`.
  - Зафиксирован план миграции ролей с формальным mapping legacy->v2 и фазами внедрения: `docs/ROLE_MIGRATION_PLAN.md`.
  - Обновлена API-спецификация с разделом о role model v2, переходном периоде и матрице доступов по endpoint-группам: `docs/BACKEND_API_SPEC.md`.
  - Обновлен архитектурный бриф: ролевая модель, категории пользователей, migration mapping и резюме по архитектурным ограничениям миграции: `docs/ARCHITECTURE_BRIEF.md`.
- Измененные файлы:
  - `docs/ROLE_MODEL_V2.md`
  - `docs/ROLE_MIGRATION_PLAN.md`
  - `docs/BACKEND_API_SPEC.md`
  - `docs/ARCHITECTURE_BRIEF.md`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Подтвердить с бизнес-владельцем и архитекторами, что mapping `analyst -> guest` и отсутствие авто-mapping в `editor` соответствует ожиданиям.
  - Подтвердить с backend/frontend лидами, что target матрица прав в `ROLE_MODEL_V2.md` покрывает все ключевые сценарии до начала `P1.2`.
  - Подтвердить, что раздел `1.3` в `BACKEND_API_SPEC.md` корректно отражает переходный период (legacy в runtime, v2 как target-контракт).
  - Подтвердить, что обновленные роли и численность категорий пользователей в `ARCHITECTURE_BRIEF.md` приемлемы для архитектурного сайзинга.
- Статус этапа: выполнен.

### ✅ Этап 5 (P1.2): role model v2 на backend + moderation workflow — 10.03.2026

- Что сделано:
  - В backend-модели пользователя внедрены роли `guest/editor/owner/admin`, добавлен `legacy_role` и mapping legacy->v2.
  - Обновлен permission-слой: read для всех v2-ролей, write технологий только для `owner/admin`.
  - Реализован moderation workflow:
    - `POST /api/v1/technology-proposals`
    - `GET /api/v1/technology-proposals/mine`
    - `GET /api/v1/technology-proposals/pending`
    - `POST /api/v1/technology-proposals/:id/approve`
    - `POST /api/v1/technology-proposals/:id/reject`
  - Добавлена модель `TechnologyProposal`, миграции и аудит для действий по предложениям.
  - Обновлены backend тесты на роли v2 и сценарии модерации.
  - Синхронизирована документация: `BACKEND_API_SPEC`, `ARCHITECTURE_BRIEF`, `MODERATION_WORKFLOW`.
- Измененные файлы (ключевые):
  - `backend/auth_custom/models.py`
  - `backend/auth_custom/permissions.py`
  - `backend/auth_custom/views.py`
  - `backend/auth_custom/migrations/0003_role_model_v2.py`
  - `backend/technologies/models.py`
  - `backend/technologies/serializers.py`
  - `backend/technologies/views.py`
  - `backend/technologies/migrations/0003_technologyproposal.py`
  - `backend/config/api_urls.py`
  - `backend/admin_panel/serializers.py`
  - `backend/admin_panel/views.py`
  - `backend/*/tests.py` (auth_custom, technologies, references, admin_panel, config)
  - `docs/BACKEND_API_SPEC.md`
  - `docs/ARCHITECTURE_BRIEF.md`
  - `docs/MODERATION_WORKFLOW.md`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Прогнать миграции в локальной БД и убедиться, что existing legacy пользователи корректно маппятся в v2 роли (`role`) с заполнением `legacy_role`.
  - Проверить сценарий `editor -> create proposal -> owner approve` и убедиться, что технология меняется только после approve.
  - Проверить сценарий `editor -> create proposal -> owner reject` и убедиться, что технология не меняется.
  - Проверить, что `guest` не может:
    - писать в `/technologies*`,
    - создавать предложения,
    - заходить в `/admin-panel/*`.
  - Проверить, что `owner` не может писать в `PUT /references/:name`.
- Автопроверки:
  - `python backend/manage.py test auth_custom references technologies admin_panel config` -> passed.
  - `ruff`/`isort` -> passed.
  - `black` в текущем окружении не удалось выполнить (команда зависает по таймауту), требуется локальная перепроверка.
- Статус этапа: выполнен.

### ✅ Этап 6 (P1.3): role model v2 на frontend (capabilities + UI gating + admin users UI) — 11.03.2026

- Что сделано:
  - Введен единый frontend слой ролей и возможностей: `RolesConfig` + `RoleCapabilities` (`guest/editor/owner/admin`) с mapping legacy->v2.
  - Подключен единый role/capabilities конфиг в основном entrypoint фронтенда (`src/main.js`), чтобы гейтинг работал одинаково на страницах radar/index.
  - Обновлен auth/UI-гейтинг в `modules/business/auth.js` и `modules/ui/common-ui.js`:
    - отображение роли по новой модели,
    - гейтинг кнопок/меню через capability-проверки (`manage_technologies`, `export_reports`, `manage_admin_panel`),
    - доступ к админ-панели только через capability `manage_admin_panel`.
  - Обновлен гейтинг действий на радаре:
    - открытие popover добавления технологии через capability `manage_technologies`,
    - экспорт PDF через capability `export_reports`,
    - интерактивный тур использует capability-условия вместо hardcode legacy-ролей.
  - Обновлен auth flow (включая 2FA): роль нормализуется в v2 и сохраняется в `localStorage` в целевом формате.
  - Обновлен UI админ-панели управления пользователями:
    - фильтры и формы ролей только `admin/owner/editor/guest`,
    - дефолтные пользователи админки переведены на новую модель,
    - normalize users переводит legacy-роли в v2.
  - Актуализированы e2e mock-сценарии логина/радара под `owner` (вместо `architect`).
  - Добавлены unit-тесты для role-capabilities слоя: `src/js/config/roles-config.test.js`.
- Измененные файлы (ключевые):
  - `src/js/config/roles-config.js`
  - `src/main.js`
  - `src/js/modules/business/auth.js`
  - `src/js/modules/ui/common-ui.js`
  - `src/js/modules/business/export.js`
  - `src/js/modules/ui/onboarding.js`
  - `src/js/script.js`
  - `src/js/auth.js`
  - `src/js/auth-2fa.js`
  - `src/js/admin.js`
  - `src/js/admin/admin-common.js`
  - `src/js/admin/admin-users.js`
  - `src/pages/admin.html`
  - `e2e/auth.spec.js`
  - `e2e/radar.spec.js`
  - `e2e/add-technology.spec.js`
  - `e2e/helpers/auth.js`
  - `src/js/config/roles-config.test.js`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Проверить логин под ролями `guest`, `editor`, `owner`, `admin` (mock/API) и видимость UI:
    - `guest/editor`: есть экспорт/отчеты, нет add/edit/delete.
    - `owner`: есть add/edit/delete + экспорт, нет перехода в админ-панель.
    - `admin`: есть add/edit/delete + экспорт + переход в админ-панель.
  - Проверить страницу `/src/pages/admin.html`:
    - фильтр ролей и форма пользователя содержат только `admin/owner/editor/guest`;
    - изменение роли пользователя сохраняется и корректно отображается.
  - Проверить тур (`Интерактивный тур`) на радаре:
    - шаги про экспорт доступны всем авторизованным ролям;
    - шаги про добавление/редактирование доступны только `owner/admin`.
  - Проверить переходный сценарий legacy роли:
    - при входе legacy-пользователя (`architect/director/project_manager/analyst`) UI показывает и применяет корректную v2 роль.
- Автопроверки:
  - `npm.cmd run lint:frontend` -> passed.
  - `npm.cmd run format:check:frontend` -> passed.
  - `npm.cmd run test:run` -> passed (`66/66`).
- Статус этапа: выполнен.

### ✅ Этап 7 (P2.1): factor engine в матмодели позиционирования — 11.03.2026

- Что сделано:
  - Добавлен модуль факторного движка `src/js/modules/radar/factor-engine.js`:
    - реестр факторов по умолчанию (`techRead`, `organRead`, `funcCover`, `trlStage`);
    - единый pipeline: извлечение -> fallback -> нормализация -> учет знака влияния -> перенормировка весов;
    - поддержка `impact: negative` для отрицательных факторов;
    - поддержка нового конфига `RadarModelConfig.factors`, `RadarModelConfig.radius`, `RadarModelConfig.minValidFactors`;
    - сохранена обратная совместимость с legacy-конфигом `weights`, `r_min`, `r_max`.
  - Переведен расчет радиуса в `src/js/modules/radar/positioning.js` на `FactorEngine.calculateReadinessIndex(...)`.
  - Обновлена сигнатура модели в кеше позиционирования (учет полного factor-конфига через `FactorEngine.getModelSignature(...)`).
  - Обновлен пример конфига `src/js/config/radar-model-config.example.js` под новый формат (с сохранением legacy-полей).
  - Добавлены unit-тесты `src/js/modules/radar/factor-engine.test.js`.
- Измененные файлы:
  - `src/js/modules/radar/factor-engine.js`
  - `src/js/modules/radar/positioning.js`
  - `src/js/config/radar-model-config.example.js`
  - `src/js/modules/radar/factor-engine.test.js`
  - `docs/MATHEMATICAL_MODEL_DOCUMENTATION.md`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Проверить baseline-поведение радара на стандартной 4-факторной конфигурации: распределение в секторах и радиусы не имеют визуальной регрессии.
  - Включить в `RadarModelConfig` дополнительный фактор с `enabled: false` и убедиться, что поведение не меняется.
  - Включить тестовый отрицательный фактор (`impact: "negative"`) и проверить, что при росте значения риск-фактора технология смещается дальше от центра.
- Автопроверки:
  - `npm.cmd run lint:frontend -- src/js/modules/radar/factor-engine.js src/js/modules/radar/positioning.js src/js/config/radar-model-config.example.js src/js/modules/radar/factor-engine.test.js` -> passed.
  - `npm.cmd run test:run -- src/js/modules/radar/factor-engine.test.js` -> passed (`7/7`).
- Статус этапа: выполнен.

### ✅ Этап 8 (P2.2): динамика факторов + fallback + совместимость — 11.03.2026

- Что сделано:
  - Убраны жесткие списки факторов в аналитических модулях:
    - `missing-data-predictor` использует активный registry факторов, scale-диапазоны и динамический набор признаков.
    - `adaptive-calibration` использует активный registry факторов вместо fixed-массива.
    - `weight-optimizer` переведен на factor engine и линейную модель радиуса (как в `positioning`), с динамическим числом факторов.
    - `model-analytics` переведен на динамический список факторов для корреляций/метрик/чувствительности.
  - Добавлены регресс-проверки совместимости baseline-модели в `factor-engine.test.js`:
    - совпадение `z_i` с legacy-линейной формулой для базовой 4-факторной конфигурации;
    - проверка отключения дополнительного фактора без изменений ядра.
- Измененные файлы:
  - `src/js/modules/analytics/missing-data-predictor.js`
  - `src/js/modules/analytics/adaptive-calibration.js`
  - `src/js/modules/analytics/weight-optimizer.js`
  - `src/js/modules/analytics/model-analytics.js`
  - `src/js/modules/radar/factor-engine.test.js`
- Статус этапа: выполнен.

### ✅ Этап 9 (P2.3): подключение новых факторов (включая отрицательные) — 11.03.2026

- Что сделано:
  - В factor engine добавлен слой новых факторов (по умолчанию disabled):
    - `implementationCostPressure` (negative, источник `costProm`);
    - `integrationRisk` (negative, источник `risks`/`integrationRisk`);
    - `integrationComplexity` (negative, источник `complexity`/`integrationComplexity`).
  - Добавлено извлечение значений факторов через alias-слой (`FactorEngine.extractRawFactorValue`), чтобы новые факторы подключались конфигурационно без правок ядра позиционирования.
  - Обновлен пример конфига `radar-model-config.example.js` для новых факторов.
  - Добавлены тесты:
    - влияние `implementationCostPressure` на `z_i`;
    - проверка negative-impact логики.
- Измененные файлы:
  - `src/js/modules/radar/factor-engine.js`
  - `src/js/config/radar-model-config.example.js`
  - `src/js/modules/radar/factor-engine.test.js`
- `docs/MATHEMATICAL_MODEL_DOCUMENTATION.md`
- `docs/NEXT_DEVELOPMENT_PLAN.md`
- Статус этапа: выполнен.

### ✅ Этап 10 (P3): ролевой интерактивный тур (master-flow + role-based step filters) — 11.03.2026

- Что сделано:
  - В `onboarding.js` зафиксирован единый `master-flow` и введены явные ролевые профили шагов (`guest/editor/owner/admin`).
  - Фильтрация шагов переведена на единый механизм `isStepVisible` (роль + runtime-условия), чтобы скрытые шаги не показывались ролям без прав.
  - В тур добавлены ролевые шаги:
    - `proposal-workflow` для сценария `editor/owner/admin` (предложения + статусы модерации);
    - `admin-panel-entry` для `admin` (доступ к функциям админ-панели).
  - Версия тура увеличена до `1.1`, чтобы обновленный сценарий применился для пользователей.
  - Добавлены автотесты `onboarding.test.js` на матрицу видимости шагов по ролям и проверку master-flow.
- Измененные файлы:
  - `src/js/modules/ui/onboarding.js`
  - `src/js/modules/ui/onboarding.test.js`
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Ручная проверка:
  - Проверить тур под `guest`: шаги `add-technology`, `add-block`, `proposal-workflow`, `admin-panel-entry` не отображаются.
  - Проверить тур под `editor`: отображается `proposal-workflow`, не отображаются `add-technology`, `add-block`, `admin-panel-entry`.
  - Проверить тур под `owner`: отображаются `add-technology`, `add-block`, `proposal-workflow`, не отображается `admin-panel-entry`.
  - Проверить тур под `admin`: отображаются все шаги master-flow, включая `admin-panel-entry`.
- Автопроверки:
  - `npm.cmd run lint:frontend -- src/js/modules/ui/onboarding.js src/js/modules/ui/onboarding.test.js` -> passed.
  - `npm.cmd run test:run -- src/js/modules/ui/onboarding.test.js` -> passed (`5/5`).
- Статус этапа: выполнен.
