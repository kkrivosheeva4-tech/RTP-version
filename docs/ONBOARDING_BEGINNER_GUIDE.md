# Onboarding Guide: RTP-3 для начинающего разработчика

Дата: 2026-04-03

## 1) Что это за проект

`RTP-3` — Django + DRF приложение, которое отдает:
- UI-страницы (через Django templates),
- API (`/api/v1/...`),
- статику фронтенда (JS/CSS/данные).

Ключевая идея сопровождения:
- правим исходники в `src/` и `backend/*`,
- не правим вручную сборочные/зеркальные артефакты (`backend/staticfiles`, обычно и `backend/static`),
- проверяем миграции, smoke-checks, роль/безопасность.

Полный список файлов проекта (для аудита “все файлы”) сохранен в [FILE_INVENTORY_FULL.txt](./FILE_INVENTORY_FULL.txt).

## 2) План обучения новичка (исполненный)

1. Зафиксировать архитектуру и точки входа.
2. Разобрать backend по приложениям и маршрутам.
3. Разобрать frontend по страницам, модулям и конфигам.
4. Разобрать DevOps, CI/CD и runbooks.
5. Отдельно отметить сгенерированные/служебные файлы.
6. Сформировать маршрут сопровождения после деплоя.

## 3) Карта файлов: что за что отвечает

### 3.1 Корень репозитория

- `.dockerignore` — исключения для Docker build context.
- `.gitignore` — глобальные git-исключения (env, логи, venv, локальные конфиги).
- `.pre-commit-config.yaml` — pre-commit хуки (ruff/black/isort + базовые проверки).
- `docker-compose.yml` — локальный стек (app + postgres), миграции/seed/collectstatic.
- `Dockerfile` — образ приложения для прода/CI.
- `gunicorn.conf.py` — конфиг Gunicorn.
- `README.md` — основной обзор проекта и запуск.
- `GIT_SETUP_INSTRUCTIONS.md` — памятка по git-процессу.
- `index.html` — исторический/статический entry.
- `favicon.ico` — иконка проекта.
- `start-server.bat`, `start-server.sh` — локальный запуск простого статического сервера.
- `ЗАПУСК_БЕЗ_NODE.md`, `КАК_ЗАПУСТИТЬ.txt` — инструкции по локальному запуску.
- `PROPOSAL_NOTIFICATIONS_SYSTEM.md` — заметки по системе уведомлений для предложений.
- `SETUP_NOTIFICATIONS.md` — настройка уведомлений.
- `Пользователи` — служебный текстовый файл с результатом поиска по коду.

### 3.2 CI/CD и служебные каталоги

- `.github/copilot-instructions.md` — правила для AI-ассистентов в репозитории.
- `.github/workflows/quality.yml` — CI: линтеры, тесты Django, smoke, сборка image.
- `.github/workflows/deploy.yml` — деплой на Debian 12 через SSH/GitHub Secrets.
- `.revision/package-docs.pathspec` — пакет документов (исторический tooling).
- `.revision/package-feature-b.pathspec` — пакет feature B (исторический tooling).
- `.revision/package-infra-c.pathspec` — пакет infra C (исторический tooling).

### 3.3 assets/

- `assets/fonts/download_dejavu.ps1` — скачивание шрифтов для PDF/кириллицы.
- `assets/fonts/README.md` — инструкция по шрифтам.
- `assets/images/expotr.png`, `filter-clean.svg`, `icon.png`, `logo.png`, `search_icon.png`, `Vector.png` — изображения интерфейса.

## 4) Backend: Django/DRF

### 4.1 backend/ базовые файлы

- `backend/manage.py` — CLI-точка входа Django.
- `backend/requirements.txt` — Python-зависимости рантайма.
- `backend/pyproject.toml` — настройки ruff/black/isort.
- `backend/README.md` — backend-инструкции.
- `backend/data-migration.json` — данные для миграционных сценариев.
- `backend/.env.example` — базовый шаблон env.
- `backend/.env.prodlike.example` — шаблон env для prod-like.
- `backend/.env.test.example` — шаблон env для тестов.

### 4.2 backend/config/ (ядро проекта)

- `__init__.py` — пакет.
- `settings.py` — все настройки: DB, security, cookies, CORS/CSRF/CSP, DRF, logging.
- `urls.py` — root маршруты.
- `api_urls.py` — API namespace `/api/v1/...`.
- `views.py` — health/openapi/docs + UI route handlers.
- `api_errors.py` — унификация API-ошибок.
- `exceptions.py` — кастомные исключения.
- `middleware.py` — middleware (включая security/observability).
- `observability.py` — метрики/наблюдаемость.
- `schema.py` — OpenAPI schema генерация.
- `seed_utils.py` — общие утилиты для seed-команд.
- `tests.py` — интеграционные проверки config-слоя.
- `asgi.py`, `wsgi.py` — ASGI/WSGI entrypoints.

### 4.3 backend/auth_custom/ (аутентификация, JWT, 2FA, безопасность)

- `models.py` — `UserProfile`, роли, 2FA поля, блокировки входа, password policy, refresh tokens.
- `views.py` — login, 2FA setup/verify, refresh, logout, me, смена пароля.
- `serializers.py` — валидация auth payloads/responses.
- `urls.py` — маршруты auth API.
- `jwt_utils.py` — выпуск/проверка JWT (access/refresh).
- `authentication.py` — DRF auth backend.
- `permissions.py` — role-based permissions.
- `throttling.py` — ограничения частоты запросов auth.
- `totp_utils.py` — генерация/проверка TOTP.
- `security.py` — правила безопасности пароля/сессий.
- `secret_encryption.py` — шифрование чувствительных секретов (например, TOTP secret).
- `admin.py`, `apps.py`, `__init__.py` — стандартные файлы Django app.
- `tests.py`, `test_jwt_utils.py` — модульные и интеграционные тесты auth.
- `management/commands/seed_users.py` — сиды пользователей/ролей.
- `management/commands/export_openapi.py` — выгрузка OpenAPI.
- `migrations/0001...0007` — эволюция схемы auth (refresh tokens, role v2, 2FA и security поля).

### 4.4 backend/references/ (справочники)

- `models.py` — модели справочников (блоки, функции, направления и связи).
- `views.py` — API для чтения/обновления справочников.
- `urls.py` — роутинг references API.
- `tests.py` — тесты references.
- `management/commands/seed_references.py` — начальная загрузка справочников.
- `admin.py`, `apps.py`, `__init__.py`, `migrations/0001_initial.py`, `migrations/__init__.py` — стандартный каркас app.

### 4.5 backend/technologies/ (главный домен: технологии и модерация)

- `models.py` — технология, связи, предложения, уведомления.
- `serializers.py` — DTO и доменная валидация технологий/предложений.
- `views.py` — CRUD технологий, batch операции, модерация, история/уведомления.
- `urls.py` — роутинг technologies API.
- `tests.py` — тесты технологий/модерации.
- `management/commands/seed_technologies.py` — сид данных технологий.
- `admin.py`, `apps.py`, `__init__.py` — стандартные файлы app.
- `migrations/0001...0005` — миграции технологий.

Важно: есть два файла с номером `0004`:
- `0004_alter_technologyproposal_status.py`
- `0004_proposal_notifications.py`

Это потенциальный риск ветвления миграций. Перед релизом нужно проверить `showmigrations` и согласовать единый graph.

### 4.6 backend/admin_panel/ (админ API)

- `models.py` — `AuditLog`, `BackupSnapshot`.
- `views.py` — управление пользователями, audit, backup/restore, предприятия.
- `serializers.py` — сериализация админ-операций.
- `urls.py` — роутинг admin panel API.
- `tests.py` — тесты админ-панели.
- `admin.py`, `apps.py`, `__init__.py`, `migrations/0001_initial.py`, `migrations/__init__.py` — каркас app.

### 4.7 backend/templates/ (серверные HTML страницы)

- `base.html` — базовый layout сайта.
- `pages/home.html` — главная.
- `pages/radar.html` — страница радара.
- `pages/admin.html` — админ-страница.
- `pages/help.html` — help.
- `pages/auth/base_auth.html` — базовый layout auth-страниц.
- `pages/auth/login.html` — логин.
- `pages/auth/change_password.html` — принудительная смена пароля.
- `pages/auth/2fa_setup.html` — настройка 2FA.
- `pages/auth/2fa_verify.html` — подтверждение 2FA.

### 4.8 backend/storage/ и backend/.certs/

- `backend/storage/backups/*.json` — тестовые backup snapshots.
- `backend/.certs/localhost-cert.pem`, `localhost-key.pem` — локальные HTTPS сертификаты для dev.

## 5) Frontend исходники: src/

### 5.1 Корневые entrypoints

- `src/main.js` — главный entry радара (импортирует практически все модули).
- `src/home-public.js` — публичный home entry.

### 5.2 Страницы

- `src/pages/index.html` — главная страница.
- `src/pages/radar.html` — страница радара.
- `src/pages/admin.html` — админ-панель UI.
- `src/pages/help.html` — help-страница.
- `src/pages/auth.html` — логин.
- `src/pages/auth-2fa-setup.html` — setup 2FA.
- `src/pages/auth-2fa-verify.html` — verify 2FA.

### 5.3 Стили: src/css/

- `about.css` — стили about/инфо блоков.
- `admin.css` — стили админки.
- `auth.css` — стили auth-flow.
- `common.css` — общие базовые стили.
- `help.css` — стили help.
- `styles.css` — общий слой стилизации legacy-частей.
- `RMK.css` — исторический/legacy стиль.
- `RMK.css.bak` — backup-копия legacy-стилей.
- `rmk-base.css` — базовые rmk стили.
- `rmk-components.css` — компоненты rmk.
- `rmk-inline-styles.css` — inline-like поправки/overrides.
- `rmk-layout.css` — layout/raster.
- `rmk-modals.css` — модальные окна.
- `rmk-radar.css` — визуал радара.

### 5.4 Данные: src/data/ru/

- `blocks.json` — блоки.
- `digitalDirections.json` — цифровые направления.
- `directionToQuadrant.json` — сопоставление направлений квадрантам.
- `enterprises.json` — предприятия.
- `enterprises-blocks-mapping.json` — связи предприятия-блоки.
- `functions.json` — функции.
- `functionToBlock.json` — связи функция-блок.
- `functionWeights.json` — веса функций.
- `integrators.json` — интеграторы.
- `technologies.json` — каталог технологий.
- `vendors.json` — вендоры.

### 5.5 JS вне modules/

- `src/js/script.js` — legacy orchestration + runtime UI actions.
- `src/js/radar-utils.js` — утилиты для радара.
- `src/js/help.js` — logic страницы помощи.
- `src/js/auth.js` — логика логина.
- `src/js/auth-2fa.js` — общая 2FA логика.
- `src/js/auth-2fa-setup.js` — setup flow 2FA.
- `src/js/auth-2fa-verify.js` — verify flow 2FA.
- `src/js/audit-logger.js` — клиентский audit helper.
- `src/js/admin.js` — entry админ-панели.
- `src/js/RMK-director.js` — сценарии директорского режима/legacy.
- `src/js/vendor/radar-vendors.js` — vendor bundle helpers.

`src/js/admin/`
- `admin-common.js` — общее состояние/утилиты админки.
- `admin-dashboard.js` — экран dashboard.
- `admin-users.js` — управление пользователями.
- `admin-enterprises.js` — управление предприятиями.
- `admin-audit.js` — аудит.
- `admin-backups.js` — backup/restore UI.
- `admin-export.js` — экспорт админ-данных.

`src/js/config/`
- `api-config.js` — базовые API настройки.
- `api-config-loader.js` — безопасная загрузка/мердж API config.
- `api-config.local.example.js` — пример локального конфигуратора API.
- `form-field-options.js` — опции полей форм.
- `radar-model-config.example.js` — пример конфигурации модели радара.
- `roles-config.js` — роли и фронтовые политики.
- `roles-config.test.js` — тест конфигурации ролей.

### 5.6 JS modules/

`src/js/modules/analytics/`
- `model-analytics.js` — расчеты/аналитика модели.
- `adaptive-calibration.js` — адаптивная калибровка.
- `missing-data-predictor.js` — прогнозирование отсутствующих данных.
- `temporal-dynamics.js` — динамика во времени.
- `weight-optimizer.js` — оптимизация весов.

`src/js/modules/business/`
- `auth.js` — бизнес-слой аутентификации и сессии.
- `export.js` — экспорт данных.
- `export-fields-config.js` — конфиг полей экспорта.
- `export-filters.js` — фильтрация в экспорте.
- `export-pdf.js` — PDF-экспорт.
- `moderation.js` — бизнес-логика модерации предложений.
- `priorities.js` — приоритизация/доменные правила.
- `auth-logout.test.js` — тест logout-сценариев.

`src/js/modules/core/`
- `app-init.js` — orchestrator инициализации приложения.
- `api-client.js` — HTTP клиент к backend API.
- `data-source.js` — источник данных (API/local).
- `data-loader.js` — загрузка наборов данных.
- `data-service.js` — единый сервис данных.
- `data-normalize.js` — нормализация данных.
- `data-indexing.js` — индексация наборов для быстрых lookup.
- `state-manager.js` — central state.
- `state-utils.js` — утилиты состояния.
- `validators.js` — валидация.
- `error-handler.js` — обработка ошибок.
- `dom-utils.js` — DOM утилиты.
- `escape-utils.js` — escaping/sanitization helpers.
- `core-utils.js` — вспомогательные core-функции.
- `logger.js` — логгер.
- `api-client.test.js` — тест API клиента.

`src/js/modules/integration/`
- `events.js` — интеграция event-driven слоя между модулями.

`src/js/modules/radar/`
- `factor-engine.js` — движок факторов позиционирования.
- `positioning.js` — вычисление позиций blips.
- `quadrants.js` — управление квадрантами.
- `quadrant-cache.js` — кэширование квадрантных вычислений.
- `radar-renderer.js` — отрисовка радара.
- `radar-update.js` — обновление отображения радара.
- `radar-events.js` — события радара.
- `radar-wrappers.js` — обертки интеграции рендерера.
- `spatial-index.js` — пространственный индекс.
- `factor-engine.test.js` — тест factor-engine.

`src/js/modules/ui/`
- `common-ui.js` — общий UI слой.
- `filters.js` — фильтры.
- `filter-init.js` — инициализация фильтров.
- `forms.js` — базовая работа с формами.
- `form-management.js` — оркестрация form flows.
- `detail-panel.js` — панель деталей технологии.
- `modals.js` — модальные окна.
- `modal-forms.js` — формы внутри модалок.
- `focus-trap.js` — focus trap.
- `keyboard-nav.js` — клавиатурная навигация.
- `touch-handlers.js` — мобильные/тач обработчики.
- `mobile-nav.js` — мобильная навигация.
- `sidebar.js` — sidebar.
- `tooltips.js` — тултипы.
- `toast.js` — toast уведомления.
- `notifications.js` — уведомления интерфейса.
- `error-display.js` — отображение ошибок.
- `loading.js` — loader-индикаторы.
- `skeleton.js` — skeleton placeholders.
- `report-status.js` — статусные сообщения/репорты.
- `offline-handler.js` — обработка offline режима.
- `onboarding.js` — onboarding тур.
- `aria-manager.js` — accessibility helper.
- `select-events.js` — селекты и их события.
- `vendors-files.js` — привязка файлов вендоров.
- `tech-tabs-manager.js` — вкладки технологии (view).
- `edit-tech-tabs-manager.js` — вкладки технологии (edit).
- `func-cover-calculator.js` — расчет покрытия функций.
- `auto-func-cover.js` — автоподбор покрытия.
- `onboarding.test.js` — тест onboarding.

`src/js/modules/utils/`
- `func-cover-utils.js` — утилиты покрытия функций.

## 6) Ops и scripts

### 6.1 ops/

- `ops/nginx/rtp3.conf.example` — пример конфигурации Nginx.
- `ops/systemd/rtp3-gunicorn.service` — unit для systemd.

### 6.2 scripts/

- `local-prodlike-common.ps1` — общие функции prod-like сценариев.
- `local-prodlike-setup.ps1` — подготовка local prod-like окружения.
- `local-prodlike-start.ps1` — старт local prod-like стека.
- `local-prodlike-stop.ps1` — остановка local prod-like стека.
- `local-prodlike-init.ps1` — migrate + seed pipeline.
- `local-prodlike-smoke.ps1` — smoke-проверки prod-like.
- `local-prodlike-postgres.ps1` — dry-run pipeline для Postgres режима.
- `postgres-dry-run.ps1` — dry-run миграции/инициализации в PostgreSQL.
- `local_prodlike_smoke.py` — Python smoke в prod-like.
- `postgres-smoke-check.py` — e2e smoke API/auth/CRUD в PostgreSQL.
- `load-smoke.py` — легкая нагрузочная smoke-проверка.
- `dev_https_server.py` — локальный HTTPS dev сервер с автосертификатом.

## 7) docs/: назначение каждого документа

- `RUN_INSTRUCTIONS.md` — как запускать проект.
- `PRODUCTION_SECRETS_AND_CERTIFICATES_RUNBOOK.md` — что выносить из репозитория перед production: env, ключи, TLS сертификаты, backup/dump артефакты.
- `LOCAL_PRODLIKE_SETUP.md` — сценарий локального окружения “как прод”.
- `RELEASE_PROCESS.md` — release-процесс.
- `REGRESSION_CHECKLIST.md` — регресс-чеклист.
- `MANUAL_VERIFICATION_CHECKLIST.md` — ручная приемка.
- `BACKEND_API_SPEC.md` — API-спека.
- `openapi.json` — OpenAPI snapshot.
- `CSS_DOCUMENTATION.md` — описание CSS файлов.
- `HTML_DOCUMENTATION.md` — описание HTML файлов.
- `JS_NON_MODULES_DOCUMENTATION.md` — описание JS вне `modules`.
- `MODULES_DOCUMENTATION.md` — описание JS модулей.
- `MATHEMATICAL_MODEL_DOCUMENTATION.md` — описание матмодели.
- `MATH_MODEL_FACTOR_ENGINE.md` — детали factor engine.
- `QUADRANT_POSITIONING_ANALYSIS.md` — анализ позиционирования.
- `MODERATION_WORKFLOW.md` — процесс модерации.
- `ROLE_ACCESS_MATRIX.md` — матрица доступа ролей.
- `ROLE_MODEL_V2.md` — новая модель ролей.
- `ROLE_MIGRATION_PLAN.md` — план миграции ролей.
- `COOKIE_AUTH_MIGRATION_PLAN.md` — миграция auth на cookie.
- `POSTGRES_MIGRATION_RUNBOOK.md` — runbook миграции БД в PostgreSQL.
- `DEBIAN12_DEPLOY_RUNBOOK.md` — деплой на Debian 12.
- `BACKUP_RESTORE_RUNBOOK.md` — backup/restore сценарии.
- `LOAD_SMOKE_RUNBOOK.md` — нагрузочный smoke.
- `TEST_AD_DEPLOYMENT_RUNBOOK.md` — deployment runbook тестового контура.
- `TEST_AD_SMOKE_PROTOCOL.md` — smoke-протокол тестового контура.
- `OBSERVABILITY_V2_MINIMUM.md` — минимальный baseline наблюдаемости.
- `FRONTEND_STORAGE_POLICY.md` — политика хранения на фронтенде.
- `INTERACTIVE_TOUR_ROLE_SCENARIOS.md` — сценарии интерактивного тура.
- `DOCUMENTATION_BASELINE.md` — baseline комплекта документации.
- `TEAM_RESPONSIBILITIES.md` — зоны ответственности команды.
- `CURRENT_SYSTEM_IMPLEMENTATION_AUDIT.md` — аудит текущей реализации.
- `PROJECT_QA_AUDIT_2026-03-27.md` — QA-аудит.
- `REMEDIATION_PLAN_2026-03-27.md` — план исправлений после аудита.
- `REMEDIATION_ROADMAP.md` — дорожная карта исправлений.
- `AGREED_STACK_MIGRATION_PLAN.md` — исторический план миграции стека.
- `ARCHITECT_TARGET_ARCHITECTURE.md` — целевая архитектура (архитектурный документ).
- `Документация для заявки на архитектуру Радара Технологий.txt` — документ заявки на архитектуру.
- `Техническое задание v2.txt` — ТЗ версии 2.

## 8) Сгенерированные и зеркальные файлы: как с ними работать

- `backend/static/` — зеркало фронтенд-ассетов для Django static.
  - В основном соответствует `src/` и `assets/`.
  - Редактировать предпочтительно исходники в `src/` и источники ассетов.
  - Особые файлы, которые есть только тут: `js/auth-change-password.js`, `js/config/api-config.local.js`.
- `backend/staticfiles/` — результат `collectstatic` (включая admin/DRF ассеты), вручную не редактировать.
- `dist/` — build output, не источник правды.
- `venv/` — локальное виртуальное окружение, не часть бизнес-кода.
- `.ruff_cache/`, `logs/`, `test-results/` — кэш и артефакты выполнения.

## 9) Что должен уметь новичок после изучения

1. Поднять проект локально в SQLite и в PostgreSQL.
2. Понимать поток auth: login -> 2FA -> refresh/logout.
3. Добавить поле в технологию (backend model/serializer/view + frontend form).
4. Прогнать smoke и регрессию перед деплоем.
5. Проверить миграции и не допустить конфликтов graph.
6. Прочитать и применить runbook деплоя/отката.

## 10) Рекомендованный порядок чтения (7 шагов)

1. `README.md` -> `docs/RUN_INSTRUCTIONS.md`.
2. `backend/config/settings.py`, `backend/config/urls.py`, `backend/config/api_urls.py`.
3. `backend/auth_custom/*` и `docs/ROLE_MODEL_V2.md`.
4. `backend/technologies/*` и `docs/MODERATION_WORKFLOW.md`.
5. `src/main.js` -> `src/js/modules/core/app-init.js` -> `src/js/modules/radar/*`.
6. `docs/REGRESSION_CHECKLIST.md`, `docs/RELEASE_PROCESS.md`, `docs/DEBIAN12_DEPLOY_RUNBOOK.md`.
7. `scripts/*` и `ops/*` для операционного сопровождения.
