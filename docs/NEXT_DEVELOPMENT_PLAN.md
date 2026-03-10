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

- [ ] P3: ролевой интерактивный тур (master-flow + role-based step filters).
- [ ] P2: подключение новых факторов (включая отрицательные) без переработки ядра.
- [ ] P4: cutover на PostgreSQL и отключение `localStorage`-зависимого refresh flow.
- [ ] P5: security/prod-hardening блок и финальный интеграционный smoke.

---

## 5. Артефакты, которые нужно создать в этом цикле

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
