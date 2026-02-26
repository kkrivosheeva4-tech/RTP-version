# Готовность фронтенда к подключению бэкенда и план разработки Backend

**Дата анализа:** 16.02.2026  
**Обновлено:** 26.02.2026 (подготовка frontend завершена; добавлен полный план разработки backend)  
**Версия фронтенда:** РТП-3  
**Статус:** **Подготовка фронтенда завершена.** Фронтенд готов к интеграции. Backend — по плану разработки (разд. 8).

---

## 1. Резюме

**Подготовка фронтенда завершена.** Выполнены: рефакторинг (этапы 0–7 и 9–12), DataService с переключением mock/API, ApiClient (request, Bearer, 401/refresh, get/post/put/patch/delete), api-config и api-config.local, MSW для тестов, Playwright E2E, docs/API_INTEGRATION.md и API_FORMAT_MAPPING.md. Фронтенд полностью готов к подключению backend API.

**Дальнейшие шаги:** разработка backend по детальному плану (разд. 8) и поэтапная интеграция по фазам 2–6 (разд. 7).

---

## 2. Текущее состояние (аналитика)

### 2.1. Источники данных

| Данные                                                                       | Текущий источник                                                                                                                                                                        | Ожидаемый источник (по ТЗ)                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Технологии                                                                   | `loadJsonPreferVfs('technologies.json')` → `/src/data/ru/technologies.json` или VFS (localStorage)                                                                                      | `GET /api/v1/technologies/`                                                                                                           |
| Справочники (блоки, функции, направления, вендоры, интеграторы, предприятия) | Статические JSON: `blocks.json`, `functions.json`, `functionToBlock.json`, `digitalDirections.json`, `directionToQuadrant.json`, `vendors.json`, `integrators.json`, `enterprises.json` | `GET /api/v1/blocks/`, `GET /api/v1/functions/`, `GET /api/v1/directions/`, `GET /api/v1/vendors/`, `GET /api/v1/enterprises/` и т.д. |
| Пользователи                                                                 | Жёстко заданный массив в `auth.js` + дублирование в `admin.js` (localStorage)                                                                                                           | `POST /api/v1/auth/login/`, пользователи из API                                                                                       |
| Аудит                                                                        | localStorage `adminAuditLogs`                                                                                                                                                           | `GET /api/v1/audit/`                                                                                                                  |
| Резервные копии, предприятия (админка)                                       | localStorage (`adminBackups`, `adminEnterprises`) + один fetch к `enterprises.json`                                                                                                     | Соответствующие API endpoints                                                                                                         |

**Файлы, где выполняется загрузка данных:**

- `src/js/modules/core/data-loader.js` — основная функция `loadData()`, пути вида `/src/data/ru/${filename}` и VFS.
- `src/js/modules/utils/func-cover-utils.js` — прямые `fetch('/src/data/ru/functionToBlock.json')`, `functionWeights.json`.
- `src/js/modules/ui/vendors-files.js` — `fetch` к `vendors.json`, `integrators.json`.
- `src/js/admin.js` — `fetch('/src/data/ru/enterprises.json')` для предприятий.

### 2.2. Аутентификация и авторизация

- **Реализация:** В `src/js/auth.js` массив `users` с логинами/паролями в открытом виде; проверка `users.find(u => u.username === username && u.password === password)`. Роль сохраняется в `localStorage` (`isLoggedIn`, `username`, `role`).
- **Модуль прав:** `src/js/modules/business/auth.js` только читает `localStorage.getItem("role")`, не взаимодействует с сервером.
- **По ТЗ:** JWT (Simple JWT), возможна 2FA. Нужны: вызов API входа, хранение/обновление токена, передача токена в заголовках запросов, обработка 401 и refresh.

**На текущий момент:** ApiClient полностью реализован (request, Bearer, 401/refresh, get/post/put/patch/delete). Интеграция auth.js с backend — по плану разд. 7 (фазы 4–5).

### 2.3. Сохранение изменений (мутации)

- **Технологии:** Добавление и редактирование в `data-loader.js` (обработчики `addTechForm`, `editTechForm`) и в `app-init.js` (удаление) обновляют только состояние и вызывают `vfsWrite('technologies.json', ...)` / `vfsWrite('enterpriseData.json', ...)`. На сервер ничего не отправляется.
- **Вендоры:** Новые вендоры пишутся в `localStorage` (`rmk_vendors_list`) в `data-loader.js` (функция `initVendorsSelect`).
- **Админка:** Пользователи, аудит, бэкапы, предприятия — только чтение/запись в localStorage в `admin.js`.

**Файлы с прямым сохранением в VFS/localStorage:**

- `src/js/modules/core/data-loader.js`: `vfsWrite('technologies.json', ...)`, `vfsWrite('enterpriseData.json', ...)`, `vfsWrite('blocks.json', ...)`; в `ensureAndPersistNewTech`, `switchEnterprise`, и в обработчиках форм добавления/редактирования.
- `src/js/admin.js`: `writeStorageJson(ADMIN_STORAGE.USERS, ...)`, `ADMIN_STORAGE.AUDIT`, `ADMIN_STORAGE.BACKUPS`, `ADMIN_STORAGE.ENTERPRISES`.

### 2.4. Сетевой слой

- Единственные вызовы `fetch` — к статическим путям (`/src/data/ru/...`). Таймауты и кэш реализованы в `data-loader.js` только для этих URL.
- **Реализовано:** `config/api-config.js` (API_BASE_URL, таймауты, ключи токенов), `core/api-client.js` (request, fetch с таймаутом, Bearer token, 401 + refresh, нормализация ошибок, get/post/put/patch/delete). Подключение к backend — по плану разд. 7–8.

---

## 3. Критические необходимые изменения

Ниже перечислены обязательные изменения с указанием затронутых файлов и сути правок.

### 3.1. Конфигурация и API-клиент

**Задача:** Иметь один базовый URL бэкенда и единую точку для всех запросов к API (с токеном, обработкой 401, таймаутами).

**Действия:**

1. **Добавить конфигурацию API** (новый файл, например `src/js/config/api-config.js` или расширить существующий конфиг):
   - `API_BASE_URL` — базовый URL (например `https://api.example.com` или `http://localhost:8000` для разработки).
   - Возможность задавать через переменные окружения или отдельный конфиг-файл, не коммитимый в репозиторий (например `api-config.local.js`).

2. **Создать модуль API-клиента** (новый файл, например `src/js/modules/core/api-client.js`):
   - Функция запроса к API: метод, путь, body, query-параметры.
   - Подстановка `Authorization: Bearer <access>` из localStorage (или из памяти) при наличии токена.
   - Обработка ответа 401: попытка обновления токена через `POST /api/v1/auth/refresh/` и повтор запроса; при неудаче — очистка сессии и редирект на `auth.html`.
   - Единая обработка ошибок сети и ответов 4xx/5xx (возврат нормализованного объекта ошибки или выброс с кодом/сообщением).
   - Таймаут запросов (например 15–30 с для тяжёлых, 8 с по умолчанию — согласовать с текущим `DEFAULT_FETCH_TIMEOUT_MS` в data-loader).

**Зависимости:** Никакой другой код не должен вызывать бэкенд через «голый» `fetch` к API; все вызовы — только через этот клиент.

---

### 3.2. Аутентификация (замена заглушки на JWT)

**Задача:** Вход через API, хранение и использование JWT, поддержка refresh и при необходимости 2FA.

**Файлы и изменения:**

| Файл                              | Изменения                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/js/auth.js`                  | Удалить массив `users`. При отправке формы вызывать `POST /api/v1/auth/login/` (через api-client) с `username`, `password`. В ответе ожидать `access`, `refresh` (и при 2FA — отдельный flow по ТЗ). Сохранять токены (например `localStorage` или sessionStorage): ключи `accessToken`, `refreshToken`; при «Запомнить меня» — длительное хранение refresh. После успешного входа сохранять роль из ответа API (или из `GET /api/v1/users/me/`) в `localStorage` для обратной совместимости с `auth.js` (renderAuth). Редирект на `index.html` как сейчас. При ошибке — показывать сообщение от сервера. |
| `src/js/modules/business/auth.js` | Оставить проверки по роли для UI. При необходимости получать роль из ответа `/users/me/` или из payload JWT (если бэкенд отдаёт роль в токене). Функцию выхода дополнить вызовом `POST /api/v1/auth/logout/` (если по ТЗ нужен logout на сервере) и очисткой `accessToken`, `refreshToken`.                                                                                                                                                                                                                                                                                                               |
| Все места выхода                  | Убедиться, что при logout очищаются и токены из хранилища (сейчас очищаются только `isLoggedIn`, `username`, `role`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

**Дополнительно:** Страница 2FA (если по ТЗ) — отдельный экран после логина при включённой 2FA; вызов `POST /api/v1/auth/2fa/verify/` с кодом.

---

### 3.3. Загрузка данных (перевод с JSON и VFS на API)

**Задача:** Первичная загрузка радара и справочников — с API; VFS/localStorage оставить только как опциональный кэш или убрать для основных сущностей.

**Файлы и изменения:**

| Файл                                       | Изменения                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/js/modules/core/data-loader.js`       | Ввести фазу «источник данных»: при наличии `API_BASE_URL` и токена — загрузка технологий через `GET /api/v1/technologies/` (с пагинацией при необходимости), справочников — через соответствующие endpoints (`/api/v1/blocks/`, `/functions/`, `/directions/`, `/vendors/`, `/integrators/`, `/enterprises/`). Маппинг ответов API в текущие структуры (например `normalizeTechnologyFromNewFormat` уже есть — адаптировать под формат ответа API). При недоступности API или отсутствии токена — fallback на текущее поведение (статичные JSON + VFS) для разработки/оффлайна, либо показ ошибки и редирект на логин. Убрать или переключить приоритет: не «сначала файл, потом VFS», а «сначала API, потом (при настройке) fallback». |
| `src/js/modules/utils/func-cover-utils.js` | Загрузку `functionToBlock.json` и `functionWeights.json` заменить на вызовы API (или один endpoint справочника функций/блоков), либо получать эти данные из уже загруженных в data-loader справочников и передавать в FuncCoverUtils.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/js/modules/ui/vendors-files.js`       | Список вендоров и интеграторов брать из state/API (загруженных в data-loader), а не из прямого fetch к статическим JSON.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/js/admin.js`                          | Список предприятий для админки — `GET /api/v1/enterprises/`. Пользователи — `GET /api/v1/users/` (с правами админа). Аудит — `GET /api/v1/audit/`. Резервные копии — по ТЗ `GET /api/v1/backups/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Важно:** Формат ответов API (имена полей, вложенность) должен быть согласован с текущими структурами или в data-loader добавлен слой нормализации под существующие форматы (например `technologies`, `enterpriseData`, `blocksList`, `functions` и т.д.).

---

### 3.4. Сохранение изменений (мутации) через API

**Задача:** Добавление/редактирование/удаление технологий и прочих сущностей должны вызывать соответствующие методы API и обновлять UI по ответу сервера.

**Файлы и изменения:**

| Файл                                                                                 | Изменения                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/js/modules/core/data-loader.js`                                                 | **Добавление технологии:** вместо немедленного `setState` и `vfsWrite` — вызов `POST /api/v1/technologies/` через api-client с телом в формате API. По успеху — обновить state из ответа и при необходимости пересчитать координаты (как сейчас). **Редактирование:** `PUT` или `PATCH /api/v1/technologies/{id}/`. **Удаление:** уже инициируется в app-init.js — там вызвать `DELETE /api/v1/technologies/{id}/`, после успеха — обновить state и UI. При ошибках API — показывать сообщение пользователю (Toast/ErrorDisplay), не писать в VFS. |
| `src/js/modules/core/app-init.js`                                                    | В обработчике удаления технологии (confirmDeleteBtn) перед изменением state вызвать `DELETE /api/v1/technologies/{id}/` через api-client; при успехе — выполнить текущую логику (обновление state, закрытие панели, уведомление, аудит на клиенте при необходимости); при ошибке — показать ошибку и не удалять из state.                                                                                                                                                                                                                          |
| `src/js/modules/core/data-loader.js` (ensureAndPersistNewTech, switchEnterprise)     | При работе с API не вызывать `vfsWrite` для технологий/enterpriseData; синхронизацию с сервером выполнять через API. Локальное обновление state — только из ответов API.                                                                                                                                                                                                                                                                                                                                                                           |
| `src/js/modules/core/data-loader.js` (initVendorsSelect — добавление нового вендора) | При наличии API — `POST /api/v1/vendors/`, затем обновить список вендоров (из ответа или повторный GET). Иначе оставить текущее поведение для оффлайна.                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/js/admin.js`                                                                    | CRUD пользователей, предприятий, бэкапов — через соответствующие API endpoints (`POST/PUT/DELETE /api/v1/users/`, `/enterprises/`, `/backups/...`). Аудит только чтение с API; очистка журнала — `DELETE /api/v1/audit/clear/` по ТЗ.                                                                                                                                                                                                                                                                                                              |

---

### 3.5. Аудит и логирование действий на клиенте

**Задача:** Критичные действия (логин, создание/изменение/удаление технологий, экспорт и т.д.) по ТЗ фиксируются на сервере. Клиент может дополнительно вызывать API для аудита или полагаться на то, что бэкенд логирует по каждому запросу.

**Рекомендация:** Оставить вызовы типа `appendAdminAudit` для локального отображения в админ-панели только если бэкенд не отдаёт полный журнал; иначе журнал аудита в админке формировать только из `GET /api/v1/audit/`. Удалить дублирование в localStorage для продакшена при работе с API.

**Файлы:** `src/js/audit-logger.js`, `src/js/admin.js`, все места вызова `appendAdminAudit` — проверить и при переходе на API убрать запись в localStorage для событий, которые бэкенд уже фиксирует.

---

### 3.6. Экспорт (PDF/CSV/JSON)

По ТЗ возможен экспорт через API: `POST /api/v1/export/pdf/`, `/export/csv/`, `/export/json/`. Текущая реализация в `src/js/modules/business/export.js` генерирует PDF на клиенте (jsPDF, html2canvas).

**Рекомендация:** Ввести переключатель или конфиг: при наличии бэкенда и необходимости экспорта с сервера — вызывать API (получение файла по ссылке или в ответе), иначе — оставить клиентскую генерацию. Для единообразия и ограничений по объёму данных предпочтительно экспорт в PDF/большие отчёты перенести на бэкенд.

---

### 3.7. Обработка ошибок и состояний

- **Сеть:** При отсутствии связи или таймауте — понятное сообщение (например через ErrorDisplay/Toast), без падения приложения.
- **401:** Централизованно в api-client: refresh или редирект на auth.
- **403:** Сообщение «Недостаточно прав», при необходимости скрыть элементы UI (уже частично по ролям в auth.js).
- **4xx/5xx:** Показывать текст ошибки от сервера (если есть) или общее сообщение. В формах (добавление/редактирование технологии) показывать ошибки валидации рядом с полями.

**Файлы:** `src/js/modules/core/api-client.js` (общая обработка), `src/js/modules/ui/error-display.js`, `src/js/modules/ui/toast.js` — использовать для уведомлений.

---

### 3.8. CORS и безопасность

- На бэкенде должен быть настроен CORS для origin фронтенда (и для локальной разработки). На фронтенде при запросах с учётными данными (cookies/токены в заголовках) использовать `credentials: 'include'` только если бэкенд использует cookies; при чистом JWT в заголовке `Authorization` обычно достаточно правильного CORS без credentials.
- Не хранить access-токен в открытом виде в localStorage в продакшене без необходимости; предпочтительно короткоживущий access и сохранение только refresh в httpOnly cookie (если бэкенд поддерживает) — уточнить по ТЗ.

---

## 4. Порядок внедрения (рекомендуемый)

1. Конфигурация и api-client (п. 3.1) — без них остальное не подключается.
2. Аутентификация по JWT (п. 3.2) — без токена запросы к защищённым endpoints невозможны.
3. Загрузка данных с API (п. 3.3) — замена статики и VFS на GET-запросы.
4. Мутации через API (п. 3.4) — сохранение и удаление технологий и админ-сущностей.
5. Аудит и экспорт (п. 3.5–3.6) по необходимости.
6. Доводка ошибок, CORS, тестов (п. 3.7–3.8).

---

## 5. Чек-лист готовности к разработке бэкенда

- [x] В проекте есть конфиг с `API_BASE_URL` и модуль api-client; JWT и 401/refresh реализованы.
- [x] ApiClient: request, Bearer token, 401 + refresh, get/post/put/patch/delete, нормализация ошибок.
- [x] DataService переключается mock/API по `USE_API` и `API_BASE_URL`; форматы запросов/ответов задокументированы.
- [ ] Вход выполняется через `POST /api/v1/auth/login/`, токены сохраняются и подставляются в запросы (ожидает backend).
- [ ] Технологии и справочники загружаются с API (ожидает backend).
- [ ] Создание/обновление/удаление технологий выполняется через REST API (ожидает backend).
- [ ] Админ-панель (пользователи, аудит, предприятия, бэкапы) работает с API (ожидает backend).
- [x] Контракты API зафиксированы в docs/API_INTEGRATION.md, API_FORMAT_MAPPING.md, BACKEND_API_REQUIREMENTS.md.

**Текущее состояние:** Подготовка фронтенда завершена. Backend — по детальному плану в разд. 8.

---

## 6. Состояние кода на фронтенде (кратко)

Подробный разбор текущего кода, перечень проблем и **пошаговый план рефакторинга** вынесены в отдельный документ:

**→ [docs/FRONTEND_FINAL_PLAN.md](FRONTEND_FINAL_PLAN.md)**, [docs/FRONTEND_COMPLETION_SUMMARY.md](FRONTEND_COMPLETION_SUMMARY.md)

Рефакторинг завершён (этапы 0–12). Детальный план разработки backend — в разд. 8 настоящего документа. Интеграция frontend с backend — по фазам 2–6 разд. 7.

<details>
<summary>Краткая сводка (раскрыть)</summary>

**Что сделано хорошо:** структура по папкам (core/ui/radar/business/integration/analytics), документация модулей, StateManager как единый источник состояния, модули доступности (ARIA, фокус, клавиатура, офлайн), escapeHtml для вывода, централизованный логгер и аудит.

**После рефакторинга (этапы 0–12):** data-loader, export, admin разбиты; DataService (mock/API), ApiClient (полная реализация), api-config, form-field-options; чтение данных через StateAccessors; E2E (Playwright), MSW для unit-тестов. Подключение к backend API — по плану разд. 7–8.

</details>

---

## 7. План разработки и подключения бэкенда

Ниже — пошаговый план совместной разработки бэкенда и интеграции с фронтендом. Проверка после изменений — по [docs/REGRESSION_CHECKLIST.md](REGRESSION_CHECKLIST.md).

### Фаза 1. Подготовка бэкенда и контрактов API

| Шаг | Действие | Ответственные / Результат |
|-----|----------|---------------------------|
| 1.1 | Определить стек бэкенда (Django + DRF по ТЗ), структуру проекта, окружение (venv, .env) | Бэкенд: репозиторий/папка, README с запуском |
| 1.2 | Описать контракты API: модели (Technology, Block, Function, Enterprise, User и т.д.), эндпоинты (список, детали, создание, обновление, удаление), форматы JSON запросов/ответов | Документ OpenAPI/Swagger или Markdown с примерами |
| 1.3 | Реализовать модели и миграции (технологии, справочники, пользователи, предприятия, аудит) | Бэкенд: модели, миграции |
| 1.4 | Реализовать аутентификацию: JWT (Simple JWT), эндпоинты `POST /api/v1/auth/login/`, `POST /api/v1/auth/refresh/`, при необходимости `logout`, 2FA | Бэкенд: auth-эндпоинты, выдача access/refresh |
| 1.5 | Реализовать эндпоинты чтения: `GET /api/v1/technologies/`, `/blocks/`, `/functions/`, `/enterprises/`, направления, вендоры и т.д. (с учётом прав и фильтров по предприятию при необходимости) | Бэкенд: GET-эндпоинты, пагинация при необходимости |
| 1.6 | Настроить CORS для origin фронтенда и локальной разработки | Бэкенд: CORS middleware |
| 1.7 | Реализовать эндпоинты мутаций: `POST/PATCH/DELETE` для технологий, пользователей, предприятий, бэкапов, аудита — по ТЗ | Бэкенд: CRUD-эндпоинты |

### Фаза 2. Реализация API-клиента на фронтенде

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 2.1 | Реализовать в `api-client.js`: сборку URL (baseUrl + path), `fetch` с таймаутом (AbortController), подстановку `Authorization: Bearer <token>` из ApiConfig.getTokenStorageKey(), парсинг JSON, возврат `{ ok, data, status, error }` | `src/js/modules/core/api-client.js` |
| 2.2 | Добавить обработку 401: вызов `POST /api/v1/auth/refresh/` с refresh-токеном, повтор запроса; при неудаче — очистка токенов, редирект на `auth.html` | `api-client.js` |
| 2.3 | Централизовать обработку 4xx/5xx и сетевых ошибок: вызов `reportError` с контекстом, при необходимости показ Toast/ErrorDisplay | `api-client.js`, `error-handler.js` |
| 2.4 | Задать `API_BASE_URL` для разработки (например в `api-config.local.js` или через переменную при сборке), не коммитить секреты | `config/api-config.js` или локальный конфиг |

### Фаза 3. Переход загрузки данных на API

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 3.1 | В `data-loader.js`: при наличии ApiConfig.getBaseUrl() и токена — загружать технологии через ApiClient.get('/api/v1/technologies/'), справочники — через соответствующие GET; маппинг ответов в существующие структуры (normalizeTechnologyFromNewFormat и т.д.) | `data-loader.js`, при необходимости `data-normalize.js` |
| 3.2 | Fallback: при отсутствии API или ошибке сети — оставить загрузку из статических JSON и VFS (для офлайна/разработки) или показ ошибки и редирект на логин | `data-loader.js` |
| 3.3 | Перевести загрузку вендоров/интеграторов и предприятий (админка) на API или на данные из state, загруженные в data-loader | `vendors-files.js`, `admin.js` / модули админки |
| 3.4 | Перевести func-cover-utils на использование справочников из state (загруженных через data-loader/API) вместо прямого fetch к JSON | `func-cover-utils.js` |

### Фаза 4. Аутентификация на фронтенде

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 4.1 | В `auth.js`: удалить mock-массив users; при отправке формы вызывать ApiClient.post('/api/v1/auth/login/', { username, password }); сохранять access/refresh в localStorage (ключи из ApiConfig); сохранять роль из ответа для обратной совместимости с UI | `auth.js` |
| 4.2 | При 401 в api-client — редирект на auth.html; при успешном входе — редирект на index.html/радар как сейчас | `api-client.js`, `auth.js` |
| 4.3 | В `modules/business/auth.js`: при выходе вызывать logout API (если есть), очищать токены и текущую сессию | `auth.js`, `business/auth.js` |

### Фаза 5. Мутации через API

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 5.1 | В data-loader: добавление технологии — ApiClient.post('/api/v1/technologies/', body); по успеху обновлять state из ответа; не вызывать vfsWrite для технологий при работе с API | `data-loader.js` |
| 5.2 | Редактирование — ApiClient.patch('/api/v1/technologies/{id}/', body); удаление — в app-init.js вызвать ApiClient.delete('/api/v1/technologies/{id}/'), по успеху обновить state и UI | `data-loader.js`, `app-init.js` |
| 5.3 | Админка: CRUD пользователей, предприятий, бэкапов — через соответствующие эндпоинты; журнал аудита — GET с API | `admin.js`, модули в `admin/` |
| 5.4 | Вендоры: при добавлении нового вендора — POST к API (если реализован эндпоинт), иначе оставить localStorage до появления API | `data-loader.js`, initVendorsSelect |

### Фаза 6. Экспорт, аудит, доводка

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 6.1 | Экспорт PDF: по ТЗ при необходимости — вызов API (POST /api/v1/export/pdf/), иначе оставить клиентскую генерацию (export-pdf.js) | `export.js`, бэкенд |
| 6.2 | Аудит: отображение записей из GET /api/v1/audit/; убрать дублирование в localStorage для событий, фиксируемых бэкендом | `admin-audit.js`, `audit-logger.js` |
| 6.3 | Проверка по REGRESSION_CHECKLIST: загрузка радара, фильтры, CRUD технологии, экспорт, вход, админка | Ручная проверка |
| 6.4 | Доводка: сообщения об ошибках, CORS, при необходимости — тесты (E2E или ручные сценарии) | По необходимости |

### Итог плана

- **Фазы 1 и 2** можно вести параллельно (бэкенд — контракты и эндпоинты, фронт — реализация api-client).
- **Фазы 3–5** — последовательно после готовности базовых эндпоинтов и api-client.
- **Фаза 6** — после стабилизации основных сценариев.

После выполнения плана все пункты чек-листа разд. 5 будут отмечены, фронтенд будет полностью работать с бэкендом.

---

## 8. План разработки Backend (полный и подробный)

Ниже — детальный план разработки backend API с нуля. Стек: **Django 5.x + Django REST Framework 3.x + djangorestframework-simplejwt**. Frontend ожидает форматы из [API_INTEGRATION.md](API_INTEGRATION.md), [API_FORMAT_MAPPING.md](API_FORMAT_MAPPING.md) и [BACKEND_API_REQUIREMENTS.md](BACKEND_API_REQUIREMENTS.md).

### 8.1. Этап 0. Подготовка проекта и окружения

| Шаг | Действие | Результат / Файлы |
|-----|----------|-------------------|
| 0.1 | Создать отдельный репозиторий/папку backend (или `backend/` в корне РТП-3) | Структура проекта |
| 0.2 | Инициализировать виртуальное окружение: `python -m venv venv` | `venv/` |
| 0.3 | Установить зависимости: `Django`, `djangorestframework`, `djangorestframework-simplejwt`, `django-cors-headers`, `PyJWT`, `python-dotenv`, `gunicorn`, `psycopg2-binary` (или `sqlite3` для dev) | `requirements.txt` |
| 0.4 | Создать Django-проект: `django-admin startproject rtp_api .` | `manage.py`, `rtp_api/settings.py`, `rtp_api/urls.py` |
| 0.5 | Создать приложения: `python manage.py startapp core`, `startapp technologies`, `startapp references`, `startapp auth_custom`, `startapp admin_panel` | `core/`, `technologies/`, `references/`, `auth_custom/`, `admin_panel/` |
| 0.6 | Настроить `.env`: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS` | `.env.example`, `.env` (в .gitignore) |
| 0.7 | Подключить `corsheaders` в `settings.py`, добавить `CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]`, `ALLOWED_HOSTS` | Готовность к запросам с frontend |

**Критерий приёмки:** `python manage.py runserver` запускается, CORS настроен.

---

### 8.2. Этап 1. Модели данных

#### 8.2.1. Справочники (references)

| Модель | Поля | Примечание |
|--------|------|------------|
| `Block` | `id`, `name` | Блоки радара |
| `Function` | `id`, `name` | Функции |
| `DigitalDirection` | `id`, `name` | Направления цифровизации |
| `Vendor` | `id`, `name` | Вендоры |
| `Integrator` | `id`, `name` | Интеграторы |
| `Enterprise` | `id`, `name`, `code`, `description` | Предприятия |
| `FunctionToBlock` | `function_name`, `block_id` (FK) | Маппинг функция → блок |
| `DirectionToQuadrant` | `direction_id`, `quadrant` | Маппинг направление → квадрант |
| `EnterpriseBlockMapping` | `enterprise_id`, `block_id` | Привязка предприятий к блокам |

**Файлы:** `references/models.py`, миграции.

#### 8.2.2. Технологии

| Модель | Поля | Примечание |
|--------|------|------------|
| `Technology` | `id`, `name`, `description`, `block_id` (FK), `trl_stage`, `market_examples` (JSONArray), `documentation_files` (JSONArray), `created_at`, `updated_at` | Основная модель |
| `TechnologyBlock` | `technology_id`, `block_id` | M2M через промежуточную для blocks[] |
| `TechnologyFunction` | `technology_id`, `function_name` | Покрытие функций |
| `TechnologyDirection` | `technology_id`, `direction_id` | Связь с направлениями |
| `TechnologyEnterprise` | `technology_id`, `enterprise_id`, `technological_readiness`, `organizational_readiness`, `status` | Рейтинги по предприятиям |
| `TechnologyVendor` | `technology_id`, `vendor_id`, `integrators` (JSONArray) | Вендоры и интеграторы |

Альтернатива: хранение `blocks`, `functionCoverage`, `enterprises`, `vendors` в JSONField на `Technology` для простоты — формат совпадает с JSON frontend. Выбор: JSONField vs нормализованные таблицы — по требованиям масштабирования.

**Рекомендация для MVP:** JSONField для `blocks`, `functionCoverage`, `directions`, `enterprises`, `vendors` на модели `Technology`; справочники — отдельные модели.

#### 8.2.3. Пользователи и аудит

| Модель | Поля | Примечание |
|--------|------|------------|
| `User` | расширение AbstractUser: `role` (choices: admin, architect, analyst, viewer), `enterprise_id` (FK, nullable) | Роли из roles-config |
| `AuditLog` | `id`, `user_id`, `action`, `model`, `object_id`, `details` (JSON), `created_at` | Журнал аудита |
| `Backup` | `id`, `name`, `data` (JSON/FileField), `created_at`, `created_by_id` | Резервные копии |

**Файлы:** `auth_custom/models.py`, `admin_panel/models.py`, миграции.

---

### 8.3. Этап 2. Сидеры и начальные данные

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 2.1 | Создать management command `load_references`: загрузка из `src/data/ru/*.json` (blocks, functions, enterprises, vendors, integrators, functionToBlock, digitalDirections, directionToQuadrant, enterprises-blocks-mapping) | `references/management/commands/load_references.py` |
| 2.2 | Создать command `load_technologies`: импорт из `technologies.json` в модель `Technology` | `technologies/management/commands/load_technologies.py` |
| 2.3 | Создать суперпользователя и тестовых пользователей (admin, architect, analyst, viewer) | Фикстуры или команда |
| 2.4 | Документировать порядок первичной настройки: миграции → load_references → load_technologies → createsuperuser | README backend |

---

### 8.4. Этап 3. Аутентификация (JWT + 2FA)

| Шаг | Действие | Файлы / Endpoints |
|-----|----------|-------------------|
| 3.1 | Установить `djangorestframework-simplejwt`, настроить в `settings.py`: `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']` = `JWTAuthentication` | `rtp_api/settings.py` |
| 3.2 | Реализовать `POST /api/v1/auth/login/`: проверка username/password, возврат `{ access_token, refresh_token }` или `{ requires_2fa: true, session_id }` при включённой 2FA | `auth_custom/views.py`, `auth_custom/urls.py` |
| 3.3 | Реализовать `POST /api/v1/auth/refresh`: приём refresh_token в body и/или Authorization, выдача новой пары токенов | Использовать Simple JWT `TokenRefreshView` или кастомный view |
| 3.4 | Реализовать `POST /api/v1/auth/logout/`: добавление refresh в blacklist (если используется Simple JWT blacklist) | `auth_custom/views.py` |
| 3.5 | Реализовать 2FA (pyotp): `POST /api/v1/auth/2fa/setup/` — генерация secret и QR; `POST /api/v1/auth/2fa/verify/` — проверка кода, выдача токенов | `auth_custom/views_2fa.py` |
| 3.6 | Модель `User2FA`: `user_id`, `secret`, `enabled` | `auth_custom/models.py` |
| 3.7 | Endpoint `GET /api/v1/users/me/`: текущий пользователь + роль для frontend | `auth_custom/views.py` |

**Формат ответа login (успех):**
```json
{ "access_token": "...", "refresh_token": "...", "token_type": "bearer", "role": "architect" }
```

**Формат при 2FA:**
```json
{ "requires_2fa": true, "session_id": "..." }
```

---

### 8.5. Этап 4. API технологий

| Шаг | Действие | Endpoint / Сериализатор |
|-----|----------|-------------------------|
| 4.1 | Сериализатор `TechnologySerializer`: вход/выход в формате API (см. API_FORMAT_MAPPING.md) | `technologies/serializers.py` |
| 4.2 | `GET /api/v1/technologies/`: список технологий, фильтр `?enterpriseId=<id>` | `technologies/views.py` |
| 4.3 | `POST /api/v1/technologies/`: создание, возврат 201 + объект | `technologies/views.py` |
| 4.4 | `GET /api/v1/technologies/<id>/`: детали | `technologies/views.py` |
| 4.5 | `PATCH /api/v1/technologies/<id>/`, `PUT /api/v1/technologies/<id>/`: обновление | `technologies/views.py` |
| 4.6 | `DELETE /api/v1/technologies/<id>/`: удаление, 204 | `technologies/views.py` |
| 4.7 | `PUT /api/v1/technologies/bulk`: массовое сохранение массива технологий | `technologies/views.py` |
| 4.8 | Permissions: IsAuthenticated; при необходимости фильтр по enterprise для analyst/viewer | `technologies/permissions.py` |

**Маппинг полей:** см. docs/API_FORMAT_MAPPING.md (API ↔ клиент).

---

### 8.6. Этап 5. API справочников (references)

| Шаг | Действие | Endpoint |
|-----|----------|----------|
| 5.1 | `GET /api/v1/references/<name>`: возврат данных справочника по имени (`blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprisesBlocksMapping`) | `references/views.py` |
| 5.2 | `PUT /api/v1/references/<name>`: сохранение справочника (для admin) | `references/views.py` |
| 5.3 | Формат ответа — как в `src/data/ru/*.json`: массив или объект | Сериализаторы под каждый тип |
| 5.4 | Permissions: GET — IsAuthenticated; PUT — IsAdminUser | `references/permissions.py` |

---

### 8.7. Этап 6. Админ-панель API

| Шаг | Действие | Endpoint |
|-----|----------|----------|
| 6.1 | `GET /api/v1/users/`, `POST /api/v1/users/`, `PATCH /api/v1/users/<id>/`, `DELETE /api/v1/users/<id>/` | `admin_panel/views_users.py` |
| 6.2 | `GET /api/v1/audit/`: журнал аудита с пагинацией; `DELETE /api/v1/audit/clear/` (опционально) | `admin_panel/views_audit.py` |
| 6.3 | `GET /api/v1/backups/`, `POST /api/v1/backups/`, `GET /api/v1/backups/<id>/download/`, `DELETE /api/v1/backups/<id>/` | `admin_panel/views_backups.py` |
| 6.4 | Предприятия: CRUD через `/api/v1/references/enterprises` или отдельные `/api/v1/enterprises/` — по согласованию с frontend | `admin_panel/` или `references/` |
| 6.5 | Permissions: IsAdminUser для всех admin endpoints | `admin_panel/permissions.py` |

---

### 8.8. Этап 7. Аудит и логирование

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 7.1 | Middleware или signal: при создании/обновлении/удалении Technology, User, Backup — запись в AuditLog | `admin_panel/signals.py` или middleware |
| 7.2 | Поля: user, action (create/update/delete), model, object_id, details (JSON с изменениями), created_at | Модель `AuditLog` |
| 7.3 | Логин/логаут — запись в AuditLog | В views аутентификации |

---

### 8.9. Этап 8. Обработка ошибок и валидация

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 8.1 | Единый формат ошибок: `{ "detail": "..." }` или `{ "detail": [{"msg": "..."}] }` — DRF по умолчанию; при необходимости кастомный exception handler | `rtp_api/exceptions.py` |
| 8.2 | Валидация в сериализаторах: обязательные поля, уникальность имён технологий, допустимые значения (status, trlStage и т.д.) | `technologies/serializers.py`, `validators.py` |
| 8.3 | 400 — ошибки валидации; 401 — не авторизован; 403 — нет прав; 404 — не найдено; 500 — логирование и общее сообщение | Стандартное поведение DRF |

---

### 8.10. Этап 9. Безопасность и CORS

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 9.1 | CORS: `django-cors-headers`, `CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "https://<prod-domain>"]` | `settings.py` |
| 9.2 | CSRF: для SPA с JWT в заголовке — отключить CSRF для API или настроить `SessionAuthentication` только для админки Django | `settings.py` |
| 9.3 | Rate limiting (опционально): `django-ratelimit` или DRF throttling для login/refresh | По необходимости |
| 9.4 | Секреты в .env, не в коде | `.env.example` |

---

### 8.11. Этап 10. Тестирование и документация

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 10.1 | Unit-тесты: модели, сериализаторы, permissions | `pytest` или `TestCase` |
| 10.2 | API-тесты: аутентификация, CRUD технологий, справочники | `rest_framework.test.APIClient` |
| 10.3 | OpenAPI/Swagger: `drf-spectacular` или `drf-yasg` | `GET /api/schema/` |
| 10.4 | README: установка, миграции, load_references, load_technologies, запуск, переменные окружения | `backend/README.md` |

---

### 8.12. Этап 11. Развёртывание (опционально)

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 11.1 | Dockerfile: Python, gunicorn, статика | `Dockerfile` |
| 11.2 | docker-compose: backend + PostgreSQL + nginx (опционально) | `docker-compose.yml` |
| 11.3 | CI: линтер, тесты, сборка образа | `.github/workflows/backend.yml` |

---

### 8.13. Порядок выполнения и зависимости

```
Этап 0 (окружение) → Этап 1 (модели) → Этап 2 (сидеры) → Этап 3 (auth) 
    → Этап 4 (technologies) → Этап 5 (references) → Этап 6 (admin) 
    → Этап 7 (аудит) → Этап 8 (ошибки) → Этап 9 (безопасность) → Этап 10 (тесты)
```

**Минимальный MVP для интеграции с frontend:**
- Этапы 0, 1, 2, 3, 4, 5, 8, 9 — позволяют загружать радар, CRUD технологий, логин, справочники.
- Этапы 6, 7 — админка и аудит.
- Этапы 10, 11 — качество и развёртывание.

**Оценка трудозатрат (ориентировочно):**
- Этапы 0–2: 2–3 дня  
- Этап 3: 2–3 дня  
- Этапы 4–5: 3–4 дня  
- Этапы 6–7: 2–3 дня  
- Этапы 8–10: 2–3 дня  
- **Итого MVP:** ~12–16 дней (1 разработчик).
