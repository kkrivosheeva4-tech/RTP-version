# Актуальное состояние проекта RTP-3

**Дата проверки:** 26.03.2026  
**Основание:** сверка кода, API, настроек runtime и существующей документации  
**Назначение:** единый подробный документ по фактически реализованной системе

## Важное Обновление На 26.03.2026

После завершения remediation-итерации часть выводов ниже в документе уже устарела. Актуальный superseding-статус такой:

- `backup/restore` больше не ограничен `users/audit/enterprises`: логический backup покрывает предметную модель, использует `schema_version=2` и проходит интеграционный restore-тест;
- `totp_secret` больше не хранится в БД в открытом виде: secret переведен на `encrypted-at-rest`, а production требует `TOTP_SECRET_ENCRYPTION_KEY`;
- production auth-state на фронтенде больше не зависит от `localStorage/sessionStorage`; legacy auth keys очищаются, но не используются как источник истины;
- `adminAuditLogs` больше не является рабочим журналом аудита; канонический аудит теперь только backend-driven;
- `legacy_role` убран из runtime/API-контрактов и больше не должен использоваться фронтендом как часть актуального профиля пользователя.

Ниже по тексту исторические разделы про неполный backup, plaintext `totp_secret`, `adminAuditLogs` как рабочий журнал и legacy auth fallback нужно воспринимать как состояние до исправлений, если они не были явно обновлены.

## 1. Краткий вывод

Проект сейчас реализован как `Django`-приложение, которое:

- само отдает HTML-страницы и статические frontend-ассеты;
- предоставляет REST API по префиксу `/api/v1/`;
- использует `PostgreSQL` как обязательную runtime-БД;
- работает с аутентификацией через access JWT + refresh token;
- в целевом runtime использует `HttpOnly` refresh-cookie и backend как source of truth для auth-состояния;
- поддерживает TOTP-based 2FA;
- хранит бизнес-данные в БД, а не в frontend storage;
- содержит отдельные внутренние compatibility-следы старой модели ролей, но production runtime/API уже не должны использовать их как источник истины.

## 2. Статус существующей документации

### 2.1 Документы, которые в целом соответствуют реализации

- `docs/FRONTEND_STORAGE_POLICY.md`
  - В целом соответствует коду и целевому runtime.
  - Корректно фиксирует, что auth truth не должен жить в `localStorage/sessionStorage`.
- `docs/RUN_INSTRUCTIONS.md`
  - В целом соответствует текущему способу запуска.
  - Особенно актуален раздел про локальный HTTPS через `scripts/dev_https_server.py`.
- `backend/README.md`
  - В целом соответствует бэкенду: PostgreSQL, Gunicorn, cookie refresh auth, health/metrics/docs.
- `docs/ROLE_MODEL_V2.md`
  - Соответствует текущей ролевой модели `guest/editor/owner/admin` и legacy mapping.
- `docs/BACKEND_API_SPEC.md`
  - В основном соответствует реализованным endpoint-ам и auth flow.
  - Но документ местами смешивает target baseline и legacy rollback path, поэтому лучше использовать вместе с кодом.

### 2.2 Документы, которые описывают не текущее состояние, а целевую/проектную архитектуру

- `docs/ARCHITECT_TARGET_ARCHITECTURE.md`
  - Это не описание текущей реализации, а именно целевой архитектуры.
  - В самом документе это прямо указано: он рассматривает систему как проектируемое решение.
  - Использовать его как источник по текущему состоянию нельзя без сверки с кодом.

### 2.3 Документы/артефакты, где есть риск устаревания или частичного расхождения

- `README.md`
  - Содержит следы старой структуры и старых сценариев.
  - Как основной источник по текущему runtime использовать не стоит.
- `ops/nginx/rtp3.conf.example`
  - Конфиг показывает reverse proxy на backend, но сам пример только на `listen 80`.
  - Для production HTTPS этого примера недостаточно: TLS-терминацию надо настраивать отдельно.
- часть frontend-кода и комментариев
  - в коде остались legacy-комментарии про старые auth-флаги и localStorage;
  - это уже не соответствует целевой политике хранения auth-state.

## 3. Фактическая архитектура системы

### 3.1 Общая схема

Текущая система фактически двухконтурная внутри одного Django runtime:

1. Django отдает UI:
   - `/`
   - `/radar/`
   - `/admin-panel/`
   - `/auth/login/`
   - `/auth/2fa/setup/`
   - `/auth/2fa/verify/`
   - `/help/`
2. Django же отдает API:
   - `/api/v1/...`
3. Бизнес-данные хранятся в PostgreSQL.
4. Frontend обращается к backend API либо same-origin, либо через явно заданный `API_BASE_URL`.

### 3.2 Основные runtime-компоненты

- Frontend:
  - HTML-страницы из Django templates;
  - JS/CSS-ассеты из static;
  - модульный JS-клиент без React/Vue.
- Backend:
  - `Django 6.0.3`;
  - `Django REST Framework`;
  - кастомная JWT-аутентификация;
  - модули `auth_custom`, `technologies`, `references`, `admin_panel`.
- БД:
  - `PostgreSQL`;
  - SQLite runtime запрещен настройками по умолчанию.

## 4. Что находится на фронтенде

### 4.1 Страницы

По маршрутам Django UI сейчас используются:

- главная страница: `/`
- радар: `/radar/`
- админ-панель: `/admin-panel/`
- логин: `/auth/login/`
- 2FA setup: `/auth/2fa/setup/`
- 2FA verify: `/auth/2fa/verify/`
- help: `/help/`

Legacy URL вида `src/pages/*.html` оставлены только для совместимости.

### 4.2 Структура frontend-кода

Основной frontend находится в `src/js/` и делится на:

- `config/`
  - runtime-конфиг API, ролей и опций;
- `modules/core/`
  - `api-client`, `data-service`, `data-loader`, `state-manager`, error handling;
- `modules/business/`
  - auth/logout, export, moderation, бизнес-правила;
- `modules/ui/`
  - фильтры, модалки, формы, onboarding, notifications;
- `modules/radar/`
  - отрисовка радара, позиционирование, квадранты, факторный движок;
- `modules/analytics/`
  - вспомогательная аналитика и история;
- отдельные entry-скрипты:
  - `auth.js`
  - `auth-2fa.js`
  - `admin.js`
  - `help.js`
  - `main.js`

### 4.3 Роли и frontend-gating

Канонические роли:

- `guest`
- `editor`
- `owner`
- `admin`

Legacy mapping:

- `architect` -> `owner`
- `director` -> `owner`
- `project_manager` -> `owner`
- `analyst` -> `guest`
- `viewer` -> `guest`

Frontend gating строится через `src/js/config/roles-config.js` и capabilities, а не через прямые legacy-строки.

## 5. Что находится на бэкенде

### 5.1 Django apps

#### `auth_custom`

Отвечает за:

- login;
- refresh;
- logout;
- `/users/me`;
- 2FA setup/verify/QR;
- кастомную JWT-логику;
- хранение refresh token state в БД;
- `UserProfile` с ролью и 2FA-настройками.

#### `technologies`

Отвечает за:

- CRUD технологий;
- bulk update;
- связи технологий со справочниками;
- workflow proposal/moderation.

#### `references`

Отвечает за:

- справочники блоков;
- функций;
- направлений;
- вендоров;
- интеграторов;
- предприятий;
- mapping предприятия -> функциональные блоки.

#### `admin_panel`

Отвечает за:

- пользователей;
- аудит;
- backup/restore;
- предприятия в админском CRUD.

#### `config`

Содержит:

- settings;
- UI routes;
- API routes;
- middleware;
- schema/docs;
- observability;
- единый error format.

### 5.2 Основные API-группы

- `/api/v1/auth/*`
- `/api/v1/users/me`
- `/api/v1/technologies*`
- `/api/v1/technology-proposals*`
- `/api/v1/references/*`
- `/api/v1/admin-panel/*`
- `/api/v1/health`
- `/api/v1/metrics`
- `/api/v1/openapi.json`
- `/api/v1/docs`

## 6. Как фронтенд и бэкенд связаны между собой

### 6.1 Базовый сценарий

1. Браузер загружает HTML и JS от Django.
2. Frontend инициализирует `ApiConfig`.
3. `ApiClient` работает с backend API.
4. Для auth bootstrap frontend вызывает `GET /api/v1/users/me/`.
5. Если access token истек, `ApiClient` автоматически пытается сделать refresh.
6. Бизнес-данные загружаются через `DataService`, который читает API:
   - справочники;
   - технологии;
   - административные сущности.

### 6.2 Источник истины по данным

Текущий intended contract:

- auth truth:
  - backend session model + refresh-cookie lifecycle + runtime state + `/api/v1/users/me/`;
- бизнес-данные:
  - backend API и PostgreSQL;
- frontend storage:
  - только UI/UX state, кэш, вспомогательные данные.

### 6.3 Основные потоки данных

#### Логин

1. `POST /api/v1/auth/login`
2. Если 2FA не нужна:
   - backend выдает `access_token`;
   - в cookie-mode одновременно ставит refresh cookie;
   - frontend запрашивает `/api/v1/users/me`;
   - runtime auth state помечается как активный.
3. Если 2FA нужна:
   - backend выдает `requires_2fa`, `session_id`, `is_2fa_setup`;
   - frontend сохраняет только временный pre-auth state в `sessionStorage`;
   - далее идет на setup или verify.

#### Refresh

1. API получает `401`.
2. `ApiClient` вызывает `POST /api/v1/auth/refresh`.
3. В целевом режиме refresh берется из `HttpOnly` cookie.
4. Если refresh успешен:
   - выдается новый access token;
   - старый refresh revoke-ится;
   - backend выдает новый refresh cookie;
   - исходный запрос повторяется.

#### Logout

1. Frontend вызывает `POST /api/v1/auth/logout/`.
2. Backend revoke-ит refresh token.
3. Refresh cookie очищается.
4. Frontend очищает runtime auth state и legacy auth artifacts.

#### Загрузка предметных данных

Frontend через `DataService` и `ApiClient` загружает:

- `blocks`
- `functions`
- `functionToBlock`
- `digitalDirections`
- `directionToQuadrant`
- `vendors`
- `integrators`
- `enterprises`
- `enterprisesBlocksMapping`
- `technologies`

## 7. Политика хранения данных на фронтенде

## 7.1 Что является корректной политикой сейчас

Текущая целевая политика в коде и документации такая:

- нельзя считать `localStorage` и `sessionStorage` источником истины для авторизации;
- в cookie-mode refresh token должен храниться только в `HttpOnly` cookie;
- access token должен жить в runtime памяти JS-процесса;
- состояние пользователя должно восстанавливаться через backend, прежде всего через `/api/v1/users/me/`.

Это соответствует `docs/FRONTEND_STORAGE_POLICY.md`.

### 7.2 Что реально хранится на фронтенде при работе через API

#### Auth-sensitive

- `sessionStorage.auth2faPending`
  - временное pre-auth состояние между login и 2FA setup/verify;
  - хранит `session_id`, username, role, remember flag, api_base_url;
  - после завершения flow удаляется.

#### Runtime-only

- access token в `ApiClient` runtime memory;
- runtime auth profile в `window.__RMK_AUTH_STATE__`.

#### Legacy fallback

В коде все еще существует fallback на:

- `localStorage['rmk_access_token']`
- `sessionStorage['rmk_access_token']`
- `localStorage['rmk_refresh_token']`
- `sessionStorage['rmk_refresh_token']`

Но это не production baseline. Это переходный/legacy путь, который должен использоваться только как rollback-compatible логика.

### 7.3 Что допустимо хранить в `localStorage`

По фактическому коду туда попадают:

- `theme`
- `selectedEnterprise`
- `rmk_onboarding_completed`
- `rmk_onboarding_progress`
- `rmk_onboarding_version`
- `adminSidebarCollapsed`
- `rmk_position_cache`
- `rmk_position_cache_version`
- `rtp_functionWeights`
- `techFormState`
- `tech_notifications`
- `rmk_vendors_list`
- `rmk_integrators_list`
- `rtp_tech_history`

Это допустимо только как:

- UX-state;
- пользовательские настройки;
- локальный кэш;
- черновики;
- вспомогательные клиентские данные.

### 7.4 Важное уточнение по несоответствиям в коде

В репозитории еще есть модули, которые читают старые ключи:

- `role`
- `username`
- `userName`
- `isLoggedIn`
- `adminAuditLogs`

Это видно, например, в:

- `src/js/modules/ui/common-ui.js`
- `src/js/audit-logger.js`
- `src/js/modules/business/export.js`
- `src/js/modules/ui/notifications.js`

Вывод:

- policy как документ корректна;
- но в коде остались legacy-чтения и fallback-механизмы;
- они не должны использоваться как source of truth для auth или фактических серверных данных.

## 8. Как работает HTTPS

### 8.1 Локальный HTTPS

Локальный рекомендованный запуск идет через `scripts/dev_https_server.py`.

Что делает скрипт:

- поднимает Django WSGI over HTTPS;
- сам генерирует self-signed сертификат и ключ, если их нет;
- сохраняет их в `backend/.certs/`;
- выставляет `wsgi.url_scheme=https` и `HTTPS=on`.

Адрес по умолчанию:

- `https://127.0.0.1:8443/`

### 8.2 Production-like

Есть отдельный local prodlike contour и Docker-режим.  
Там система приближается к production-профилю:

- PostgreSQL;
- Django/Gunicorn;
- cookie refresh auth;
- same-origin frontend/API.

### 8.3 Production baseline

Production entrypoint:

- `gunicorn --config gunicorn.conf.py config.wsgi:application`

Предполагается reverse proxy перед Django/Gunicorn.  
В проекте есть пример `ops/nginx/rtp3.conf.example`, но он:

- проксирует backend;
- пробрасывает `X-Forwarded-*`;
- не является полным готовым HTTPS-конфигом.

То есть HTTPS в production должен завершаться на внешнем reverse proxy / web server, а не на самом Gunicorn.

### 8.4 Security-настройки HTTPS в Django

При `DEBUG=False` и включенном security enforcement backend требует:

- непустой `SECRET_KEY`;
- корректный `ALLOWED_HOSTS`;
- явные `CORS_ALLOWED_ORIGINS`;
- `SECURE_SSL_REDIRECT=True`;
- `SESSION_COOKIE_SECURE=True`;
- `CSRF_COOKIE_SECURE=True`;
- `SECURE_HSTS_SECONDS > 0`;
- `https://` origins для CORS и CSRF trusted origins.

## 9. Как работает 2FA

### 9.1 Тип 2FA

Используется `TOTP` через библиотеку `pyotp`.

Сервер:

- генерирует Base32 secret;
- строит `otpauth://` URI;
- умеет отдавать QR как SVG.

### 9.2 Сценарий первого включения

1. Пользователь проходит login.
2. Backend возвращает `requires_2fa=true` и `is_2fa_setup=false`.
3. Frontend сохраняет временный `auth2faPending` в `sessionStorage`.
4. `POST /api/v1/auth/2fa/setup/` возвращает:
   - `secret`
   - `qr_url`
   - `qr_svg_url`
5. Пользователь сканирует QR в authenticator app.
6. `POST /api/v1/auth/2fa/verify/` проверяет шестизначный код.
7. Если verify успешен:
   - `is_2fa_enabled` у профиля выставляется в `True`;
   - пользователь получает обычные auth tokens.

### 9.3 Сценарий повторного входа

1. Login возвращает `requires_2fa=true`, `is_2fa_setup=true`.
2. Пользователь сразу вводит TOTP code.
3. После verify выдаются access token и refresh lifecycle.

### 9.4 Где хранится 2FA secret

TOTP secret хранится в БД в таблице профиля пользователя:

- `auth_custom.UserProfile.totp_secret`

Важно:

- secret хранится в базе как строка;
- в коде нет отдельного шифрования этого поля на уровне приложения.

Это нужно учитывать как отдельный security fact текущей реализации.

## 10. Где хранятся токены, секреты и ключи

### 10.1 Access token

В текущем target runtime:

- живет в runtime памяти frontend (`ApiClient`);
- используется в заголовке `Authorization: Bearer <access_token>`.

Legacy fallback:

- может временно читаться из `localStorage/sessionStorage`.

### 10.2 Refresh token

В target runtime:

- хранится в `HttpOnly` cookie;
- имя по умолчанию: `rtp3_refresh_token`;
- path по умолчанию: `/api/v1/auth/`.

На backend refresh token не только криптографически подписан, но и дополнительно отслеживается в БД через запись `RefreshToken` с `jti`, `expires_at`, `revoked_at`.

### 10.3 2FA session token

Это отдельный JWT типа `2fa_session`, который:

- живет только на коротком pre-auth этапе;
- передается во frontend;
- хранится временно в `sessionStorage.auth2faPending`.

### 10.4 JWT signing secret

JWT подписываются через `SECRET_KEY` Django.

Текущая реализация:

- кастомная;
- алгоритм `HS256`;
- secret берется из env `SECRET_KEY`.

### 10.5 Прочие секреты и ключи

- Django `SECRET_KEY`:
  - из `backend/.env` или environment;
- DB credentials:
  - `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`;
- TLS dev cert/key:
  - `backend/.certs/localhost-cert.pem`
  - `backend/.certs/localhost-key.pem`
- TOTP issuer:
  - `TOTP_ISSUER`

### 10.6 Где это хранится организационно

В проекте принята env-based конфигурация:

- локально: `backend/.env`;
- prodlike: отдельный env profile;
- в Docker: через `docker-compose.yml`.

## 11. Как устроена база данных

### 11.1 Основные сущности

#### Пользователи и auth

- Django `User`
- `auth_custom.UserProfile`
  - `role`
  - `legacy_role`
  - `is_2fa_enabled`
  - `totp_secret`
- `auth_custom.RefreshToken`
  - `user`
  - `jti`
  - `expires_at`
  - `revoked_at`

#### Справочники

- `references.FunctionalBlock`
- `references.FunctionReference`
- `references.DigitalDirection`
- `references.Vendor`
- `references.Integrator`
- `references.Enterprise`
- `references.EnterpriseBlockMapping`

#### Технологии

- `technologies.Technology`
  - имя;
  - описание;
  - primary block;
  - legacy function;
  - TRL;
  - статус;
  - market examples;
  - documentation files.

Связи:

- `TechnologyBlock`
- `TechnologyFunctionCoverage`
- `TechnologyDirection`
- `TechnologyVendor`
- `TechnologyVendorIntegrator`
- `TechnologyEnterpriseReadiness`

#### Модерация

- `technologies.TechnologyProposal`
  - action;
  - status;
  - payload;
  - comment;
  - review_comment;
  - hidden_from_creator_history;
  - created_by;
  - reviewed_by;
  - reviewed_at.

#### Администрирование

- `admin_panel.AuditLog`
- `admin_panel.BackupSnapshot`

### 11.2 Что хранится в БД по бизнес-смыслу

#### В БД хранятся

- пользователи;
- роли и 2FA состояние;
- refresh token lifecycle;
- предприятия;
- функциональные блоки;
- функции;
- цифровые направления;
- вендоры и интеграторы;
- технологии;
- покрытие технологий по функциям;
- зрелость технологий по предприятиям;
- предложения на изменение технологий;
- аудит действий;
- метаданные резервных копий.

#### В БД не хранятся как полноценная отдельная доменная сущность

- frontend UX-state;
- тема интерфейса;
- локальные уведомления и onboarding-state;
- client-side caches;
- self-signed dev cert trust state браузера.

### 11.3 Особенности и ограничения БД-модели

- `Technology.market_examples` и `Technology.documentation_files` лежат в `JSONField`;
- часть справочников синхронизируется seed-командами из JSON-файлов в `src/data/ru/`;
- роли в рантайме канонизированы к v2-модели, но legacy usernames и legacy mapping еще поддерживаются;
- refresh token rotation реализована через revoke старой записи и выпуск новой.

## 12. Как устроены backup/restore

Это важный факт текущей реализации:

### 12.1 Что реально попадает в backup

Текущий backup payload включает только:

- пользователей;
- audit logs;
- enterprises.

### 12.2 Что не попадает в backup текущей реализацией

Не видно включения в backup:

- technologies;
- reference dictionaries полностью;
- technology proposals;
- refresh token table;
- 2FA secret history отдельно;
- прочих предметных сущностей, кроме enterprises.

Это означает, что backup/restore сейчас покрывает не всю предметную БД.

## 13. Observability и аудит

Система сейчас имеет:

- HTTP metrics counters в памяти процесса;
- audit log в БД;
- auth event logging;
- health endpoint;
- metrics endpoint только для `admin`.

Метрики не пишутся в отдельную внешнюю time-series систему внутри текущего кода.  
Они держатся в memory counter и отдаются через `/api/v1/metrics`.

## 14. Проверка TODO/FIXME/HACK

Выполнен поиск по репозиторию без `node_modules`, `dist`, `venv`, `.git`, `staticfiles`.

Результат:

- явных незакрытых `TODO`, `FIXME`, `XXX`, `HACK`, `BUGBUG`, `TEMP` в рабочем коде не найдено.

Практический вывод:

- формально устаревших TODO в кодовой базе сейчас не обнаружено;
- но есть legacy-комментарии и legacy-пути, которые уже не являются target behavior и требуют помнить о миграционном контексте.

## 15. Практические расхождения и риски

### 15.1 Главное расхождение по документации

`docs/ARCHITECT_TARGET_ARCHITECTURE.md` нельзя считать описанием текущей системы.  
Это документ о целевой архитектуре, а не о фактической реализации.

### 15.2 Главное расхождение по frontend storage

Политика хранения auth-state уже правильная, но в коде еще остались legacy-чтения старых localStorage-ключей.  
Это не ломает target contract само по себе, но показывает, что миграция еще не до конца вычищена.

### 15.3 Главное расхождение по backup coverage

Backup/restore реализован не на всю предметную модель.  
Сейчас это не полноценный снимок всей системы.

### 15.4 Главное расхождение по HTTPS-инфраструктуре docs vs code

Локальный HTTPS реализован и описан хорошо.  
Но пример `nginx` в `ops/nginx/rtp3.conf.example` не является полной production HTTPS-конфигурацией.

## 16. Рекомендованный порядок изучения проекта

Если изучать систему с нуля, лучше идти так:

1. этот документ;
2. `docs/RUN_INSTRUCTIONS.md`;
3. `backend/README.md`;
4. `docs/FRONTEND_STORAGE_POLICY.md`;
5. `docs/ROLE_MODEL_V2.md`;
6. `backend/config/settings.py`;
7. `backend/auth_custom/*`;
8. `backend/technologies/*`;
9. `backend/references/*`;
10. `backend/admin_panel/*`;
11. `src/js/modules/core/api-client.js` и `src/js/modules/business/auth.js`.

## 17. Итог

На текущий момент проект уже работает как единое Django-приложение с backend API, PostgreSQL, JWT auth, refresh rotation, TOTP 2FA и same-origin frontend delivery.  
Главный operational truth сейчас находится в коде backend/runtime-конфигурации, а не в проектных архитектурных документах.  
Для изучения текущего состояния этот файл следует считать главным сводным документом по фактической реализации.
