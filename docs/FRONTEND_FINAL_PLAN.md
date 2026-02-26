# Единый план доработки frontend до перехода к backend

**Дата создания:** 20.02.2026  
**Обновлено:** 26.02.2026 (шаг 12.4, этап 12 завершён)  
**Версия:** 2.1  
**Назначение:** Объединённый план выполнения оставшихся задач по frontend перед переходом к разработке backend API.

---

## Статус выполненных задач

### ✅ Выполнено (из FRONTEND_FIXES.md)
- Этапы 0-6: Быстрые исправления, производительность, безопасность, рефакторинг state/auth, чистка, unit-тесты

### ✅ Выполнено (из FRONTEND_CODE_STATE_AND_REFACTORING_PLAN.md)
- Этапы 0-7: Подготовка, ошибки, разбиение data-loader/export/admin, роли, state, константы форм

### ✅ Выполнено (из PLAN_TASKS_2026.md)
- Задача 1: Валидация повторов технологий
- Задача 2: Валидация вендоров и интеграторов (CRUD)

### ✅ Выполнено (этап 9 — 25.02.2026)
- **Этап 9. Рефакторинг для замены mock на API:** все 6 шагов завершены (9.1–9.6). Флаг USE_API, DataService, переключение mock/API, data-loader и form-management через DataService, маппинг форматов, docs/API_FORMAT_MAPPING.md. state-utils: подписка на technologies использует DataService.saveTechnologies вместо vfsWrite.

### ✅ Выполнено (этап 9.5 — 25.02.2026)
- **Этап 9.5. Привязка предприятий к функциональным блокам:** шаги 9.5.1–9.5.5 выполнены. enterprises-blocks-mapping.json, DataService.loadReference, state (enterpriseIdToBlockIds, blockIdToEnterpriseIds), filters с учётом привязки, updateModalBlocksForEnterprises ограничивает блоки по выбранным предприятиям. Шаг 9.5.6 (админка) — опционально, не реализован.

### ✅ Выполнено (этап 10, шаги 10.1–10.6 — 26.02.2026)
- **Шаг 10.1. Локальная конфигурация API:** api-config.local.example.js, api-config.local.js в .gitignore, api-config-loader.js с опциональной загрузкой, prebuild ensure-api-config-local.js для сборки.
- **Шаг 10.2. ApiClient:** request (URL, Authorization: Bearer, AbortController+timeout, JSON/FormData), обработка 401 + refresh token, редирект на auth.html, нормализация ошибок, get/post/put/patch/delete.
- **Шаг 10.3. Mock API для тестов:** MSW, handlers для technologies и references/*, server в vitest.setup, тест data-service-api.test.js.
- **Шаг 10.4. Ручная проверка сценариев:** проверка mock-режима пройдена (загрузка радара, фильтры, CRUD технологий, экспорт PDF, админ-панель). Проверка USE_API = true не проводилась (тестовый API отсутствует).
- **Шаг 10.5. Smoke/E2E тесты:** Playwright, e2e/auth.spec.js (логин, ошибка пароля), e2e/radar.spec.js (загрузка, кнопка добавления), e2e/add-technology.spec.js (форма и сохранение), .github/workflows/e2e.yml.
- **Шаг 10.6. Документация:** docs/API_INTEGRATION.md — порядок включения API, авторизация и токены, refresh, обработка ошибок, endpoints и форматы запросов/ответов.

### ✅ Выполнено (этап 12, шаги 12.1–12.2 — 26.02.2026)
- **Шаг 12.1. Полная регрессионная проверка:** Проверка по чек-листу пройдена. Исправление: двухфакторная авторизация (2FA) включена для всех ролей, а не только для admin — в auth.js `requires_2fa: true` для любого успешного входа. Сценарии: загрузка радара, фильтры, CRUD технологий, экспорт PDF, вход/авторизация, 2FA (настройка и проверка кода), админ-панель — работают без ошибок.
- **Шаг 12.2. Обновление документации:** README.md — добавлены E2E, API config, 2FA; обновлена структура и версия РТП-3. PLAN_TASKS_2026.md — таблица статусов задач 1–6, версия 1.2. Создан docs/FRONTEND_COMPLETION_SUMMARY.md с итогами доработки. FRONTEND_FIXES.md и FRONTEND_CODE_STATE_AND_REFACTORING_PLAN.md не найдены в репозитории (возможно, объединены в FRONTEND_FINAL_PLAN).
- **Шаг 12.3. Code review и финальные правки:** Проведён review: TODO в select-events.js имеет контекст (приемлемо). Закомментированного кода не найдено. Линтер ошибок не выявил. Исправление: ensure-api-config-local.js → .mjs для устранения предупреждения Node MODULE_TYPELESS_PACKAGE_JSON. Production build проходит успешно.
- **Шаг 12.4. Подготовка к интеграции с backend:** Проверены api-client.js (готов: request, Bearer, 401/refresh, get/post/put/patch/delete) и data-service.js (переключение mock/API через getUseApi()). В API_INTEGRATION.md добавлена секция 5.1 «Аутентификация» с endpoints login, refresh, 2fa/setup, 2fa/verify. Создан docs/BACKEND_API_REQUIREMENTS.md — чек-лист требований к backend API.

### ✅ Выполнено (этап 7 — частично, 24.02.2026)
- **Шаг 7.1 — Инициализация Vite:** добавлен `vite.config.js` (root, publicDir, build.outDir, server.port 5173, resolve.alias `@`→src, assetsInclude для JSON), в корневой `index.html` добавлен `<script type="module" src="/src/main.js">`, в `package.json` добавлены скрипты `dev`, `build`, `preview` и зависимость Vite.
- **Шаг 7.2 — Создание точки входа:** создан `src/main.js` (аналог RMK-director.js: loadModule/loadAllModules, константы радара в window, порядок загрузки модулей), в `src/pages/radar.html` все отдельные `<script src="...">` заменены на один `<script type="module" src="/src/main.js">`. Инициализация по-прежнему выполняется из app-init.js при загрузке.
- **Шаг 7.3 — Перевод первого модуля на ES modules:** выбран `logger.js`. Модуль переписан на `export function` и `export default Logger`. В `main.js` добавлен `import Logger from './js/modules/core/logger.js'`, установка `window.Logger` для обратной совместимости, загрузка `logger.js` через `loadModule` удалена из списка. Остальные модули по-прежнему используют `window.Logger`.
- **Шаг 7.4 — Перевод модулей по группам (группа Core, 24.02.2026):** переведены на ES modules: `escape-utils.js`, `dom-utils.js`, `state-manager.js`, `validators.js`, `error-handler.js`, `data-source.js`, `data-normalize.js`, `data-loader.js`. В `main.js` добавлены статические импорты этих модулей, из списка `loadAllModules` удалены соответствующие пути. Экспорт в `window.*` оставлен для обратной совместимости.
- **Шаг 7.4 — группа UI (24.02.2026):** переведены на ES modules: `toast.js`, `loading.js`, `error-display.js`, `detail-panel.js`, `filters.js`, `filter-init.js`, `modals.js`, `form-management.js`. В `main.js` добавлены импорты этих UI-модулей, из `loadAllModules` удалены соответствующие пути. Остальные UI (focus-trap, forms, sidebar, modal-forms, report-status, tooltips, notifications, common-ui, tech-tabs-manager, edit-tech-tabs-manager, func-cover-calculator, auto-func-cover, vendors-files, skeleton, mobile-nav, touch-handlers, keyboard-nav, aria-manager, onboarding, offline-handler, select-events) — в следующих итерациях.
- **Шаг 7.5 — Удаление loadModule и старых скриптов (24.02.2026):** из `main.js` удалены функции `loadModule` и `loadAllModules`. Модули `audit-logger.js`, `script.js`, `radar-utils.js`, `core-utils.js`, `api-config.js`, `api-client.js`, `data-indexing.js`, `func-cover-utils.js`, `form-field-options.js`, `app-init.js` переведены на ES modules и подключены статическими импортами. Инициализация вызывается через `AppInit.initApp()` в `bootstrap()`. В `radar.html` только один `<script type="module" src="/src/main.js">` и внешние библиотеки (jspdf, html2canvas). Файл `src/js/RMK-director.js` помечен как deprecated. Production build выполняется успешно.
- **Шаг 7.6 — Настройка конфига для статики и JSON (24.02.2026):** в `vite.config.js` добавлен алиас `@data` → `src/data`, расширен `assetsInclude` для `src/data/ru/**/*.json`, добавлен плагин копирования `src/data` в `dist/src/data` при сборке, добавлен закомментированный пример `server.proxy` для будущего API.

---

## Оставшиеся задачи (порядок выполнения)

### Этап 7. Переход на ES modules и Vite

**Приоритет:** Высокий  
**Оценка:** 5–7 дней  
**Источник:** FRONTEND_FIXES.md, этап 7

**Цель:** Перевести проект на современную систему сборки с ES modules для упрощения поддержки и подготовки к интеграции с backend.

#### Шаг 7.1 — Инициализация Vite

**Действия:**
- Установить Vite: `npm i -D vite`
- Создать `vite.config.js` с настройками:
  - `root: './'`
  - `publicDir: 'public'` (если есть)
  - `build.outDir: 'dist'`
  - `server.port: 5173` (или другой свободный)
  - Настроить `resolve.alias` при необходимости
  - Настроить `assetsInclude` для JSON файлов
- Создать `index.html` в корне проекта с `<script type="module" src="/src/main.js">` (или адаптировать существующий)

**Критерий приёмки:** Vite запускается через `npm run dev`, статические файлы загружаются.

**Статус:** ✅ Выполнено (24.02.2026)

---

#### Шаг 7.2 — Создание точки входа

**Файл:** `src/main.js` (новый)

**Действия:**
- Создать `src/main.js` — аналог `RMK-director.js`
- Импортировать модули в правильном порядке:
  1. `logger.js`
  2. `dom-utils.js`
  3. `state-manager.js`
  4. `data-source.js`
  5. `data-normalize.js`
  6. `data-loader.js`
  7. `validators.js`
  8. `escape-utils.js`
  9. `error-handler.js`
  10. Остальные модули (ui, radar, business, analytics, integration)
- Вызвать `AppInit.initApp()` в `DOMContentLoaded`
- Обновить `radar.html`: заменить подключение `RMK-director.js` на `<script type="module" src="/src/main.js">`

**Критерий приёмки:** Приложение запускается через Vite, модули загружаются в правильном порядке.

**Статус:** ✅ Выполнено (24.02.2026). Модули пока подгружаются через `loadModule` (динамически); переход на статические ES-импорты — в шагах 7.3–7.5.

---

#### Шаг 7.3 — Перевод первого модуля на ES modules

**Выбор модуля:** Начать с простого модуля (`logger.js` или `escape-utils.js`)

**Действия:**
- Переписать выбранный модуль на `export function ...` и `export default`
- В `main.js`: заменить загрузку через `loadModule` на `import { ... } from './modules/core/logger.js'`
- Удалить экспорт в `window.*` (или оставить для обратной совместимости временно)
- Удалить загрузку модуля из `RMK-director.js`
- Проверить работу приложения

**Критерий приёмки:** Модуль работает через ES import, приложение функционирует без ошибок.

**Статус:** ✅ Выполнено (24.02.2026). Выбран модуль `logger.js`. Экспорт в `window.Logger` оставлен для обратной совместимости до перевода остальных модулей.

---

#### Шаг 7.4 — Перевод модулей по группам

**Порядок перевода:**

1. **Core модули** (первая группа):
   - `logger.js`
   - `error-handler.js`
   - `state-manager.js`
   - `dom-utils.js`
   - `data-source.js`
   - `data-normalize.js`
   - `data-loader.js`
   - `validators.js`
   - `escape-utils.js`

2. **UI модули** (вторая группа):
   - `filters.js`
   - `modals.js`
   - `form-management.js`
   - `toast.js`
   - `loading.js`
   - `error-display.js`
   - `detail-panel.js`
   - `filter-init.js`
   - И другие UI модули

3. **Radar модули** (третья группа):
   - `positioning.js`
   - `renderer.js`
   - `quadrants.js`
   - `events.js`
   - И другие модули радара

4. **Business модули** (четвёртая группа):
   - `auth.js` (business)
   - `export.js` и связанные (`export-fields-config.js`, `export-filters.js`, `export-pdf.js`)
   - `priorities.js`

5. **Analytics и Integration** (пятая группа):
   - Модули аналитики
   - `integration/events.js`

**Действия для каждой группы:**
- Переписать модули на `export/import`
- Обновить импорты в `main.js`
- Удалить загрузку через `loadModule` из `RMK-director.js`
- Удалить экспорты в `window.*` (или пометить как deprecated)
- Коммит после каждой группы + проверка регрессии

**Критерий приёмки:** Все модули переведены на ES modules, приложение работает полностью.

**Статус:** Группы Core и UI выполнены (24.02.2026). **Группа Radar выполнена (24.02.2026):** переведены на ES modules: positioning.js, quadrant-cache.js, quadrants.js, radar-renderer.js, radar-wrappers.js, radar-update.js, spatial-index.js, radar-events.js. В main.js добавлены статические импорты этих модулей, из loadAllModules удалены соответствующие пути. Экспорт в window.* оставлен для обратной совместимости. **Группа Business выполнена (24.02.2026):** переведены на ES modules: export-fields-config.js, export-filters.js, export-pdf.js, export.js, auth.js, priorities.js. В main.js добавлены статические импорты этих модулей, из loadAllModules удалены соответствующие пути. **Группа Analytics выполнена (24.02.2026):** переведены на ES modules: model-analytics.js, weight-optimizer.js, missing-data-predictor.js, temporal-dynamics.js, adaptive-calibration.js. В main.js добавлены статические импорты этих модулей, из loadAllModules удалены соответствующие пути. **Группа Integration выполнена (24.02.2026):** переведён на ES module: integration/events.js (`import { DOMCache }` из dom-utils, убран IIFE и автозапуск по DOMContentLoaded; инициализация вызывается из app-init.initApp()). В main.js добавлен статический импорт, путь удалён из loadAllModules. **Шаг 7.4 завершён:** все группы переведены на ES modules.

---

#### Шаг 7.5 — Удаление loadModule и старых скриптов

**Действия:**
- Удалить функцию `loadModule` и `loadAllModules` из `RMK-director.js`
- Удалить все `<script src="...">` из `radar.html` (кроме внешних библиотек: jspdf, html2canvas — подключить через npm или оставить как внешние)
- Удалить или закомментировать `RMK-director.js` (или оставить как legacy для справки)
- Проверить, что все модули загружаются через ES imports

**Критерий приёмки:** Нет динамической загрузки через `loadModule`, все модули подключены статически.

**Статус:** ✅ Выполнено (24.02.2026). Функции `loadModule` и `loadAllModules` удалены из `main.js`. Оставшиеся скрипты (audit-logger, script, radar-utils, core-utils, api-config, api-client, data-indexing, func-cover-utils, form-field-options, app-init) переведены на ES modules и подключены статическими импортами. В `radar.html` только один `<script type="module" src="/src/main.js">` и CDN для jspdf/html2canvas. `RMK-director.js` помечен как deprecated.

---

#### Шаг 7.6 — Настройка конфига для статики и JSON

**Файл:** `vite.config.js`

**Действия:**
- Настроить `resolve.alias` для удобных путей (например, `@` → `src`)
- Настроить `assetsInclude` для JSON файлов из `/src/data/ru/*.json`
- Проверить загрузку данных из JSON через `import` или `fetch`
- При необходимости настроить `server.proxy` для будущего API

**Критерий приёмки:** JSON файлы загружаются корректно, пути разрешаются правильно.

**Статус:** Выполнено (24.02.2026). В `vite.config.js`: добавлен алиас `@data` → `src/data`; `assetsInclude` расширен явным паттерном `src/data/ru/**/*.json`; добавлен плагин `copy-data`, копирующий `src/data` в `dist/src/data` при сборке (загрузка через fetch в production работает); в `server` добавлен закомментированный пример `server.proxy` для будущего API (`/api` → backend).

---

#### Шаг 7.7 — Production build и проверка

**Действия:**
- Выполнить `npm run build`
- Проверить содержимое `dist/`
- Запустить `npm run preview` или развернуть `dist` на статическом хостинге
- Проверить работу в production режиме:
  - Загрузка данных
  - Работа радара
  - Формы и модалки
  - Экспорт PDF
  - Админ-панель

**Критерий приёмки:** Production build работает без ошибок, все функции доступны.

**Статус:** ✅ Выполнено (25.02.2026). Production build выполнен успешно, проверка приложения после сборки завершена без выявленных ошибок.

---

#### Шаг 7.8 — Обновление скриптов и документации

**Действия:**
- Обновить `package.json`:
  - `"dev": "vite"`
  - `"build": "vite build"`
  - `"preview": "vite preview"`
- Обновить `README.md` с инструкциями по запуску через Vite
- Обновить документацию модулей (если изменились пути импорта)

**Критерий приёмки:** Документация актуальна, команды работают.

**Статус:** ✅ Выполнено (25.02.2026). package.json: обновлены name (rmk-radar), description, удалён устаревший _comment; скрипты dev/build/preview уже были актуальны. README.md: добавлена секция «Vite (рекомендуется)» с npm install, npm run dev, npm run build, npm run preview; обновлены требования (Node.js для разработки). MODULES_DOCUMENTATION.md: обновлены разделы «Архитектурные принципы» и «Порядок загрузки модулей» с учётом main.js и ES modules.

---

### Этап 8. Заглушки экранов 2FA

**Приоритет:** Средний  
**Оценка:** 1–2 дня  
**Источник:** PLAN_TASKS_2026.md, задача 4

**Цель:** Создать UI для двухфакторной аутентификации перед подключением backend API.

#### Шаг 8.1 — Создать страницу проверки кода 2FA

**Файл:** `src/pages/auth-2fa-verify.html` (новый)

**Действия:**
- Создать страницу по образцу `auth.html`:
  - Форма с полем ввода 6-значного кода (input type="text" maxlength="6")
  - Кнопка «Подтвердить»
  - Кнопка «Отмена» (возврат на `auth.html`)
  - Подключить `auth.css` и необходимые скрипты
  - Добавить валидацию: только цифры, ровно 6 символов

**Критерий приёмки:** Страница отображается корректно, форма валидируется.

**Статус:** ✅ Выполнено (25.02.2026). Создан `auth-2fa-verify.html` по образцу auth.html: форма с полем кода (input type="text" maxlength="6", pattern="[0-9]{6}", inputmode="numeric"), кнопки «Подтвердить» и «Отмена» (ссылка на auth.html). Подключён auth.css. Создан `auth-2fa-verify.js`: инициализация темы, валидация (только цифры, ровно 6 символов), ограничение ввода/вставки. В auth.css добавлены стили: .btn-row, .btn--secondary, .error-msg, .sr-only.

---

#### Шаг 8.2 — Создать страницу настройки 2FA

**Файл:** `src/pages/auth-2fa-setup.html` (новый)

**Действия:**
- Создать страницу:
  - Заглушка для QR-кода (placeholder div с рамкой или изображение-заглушка)
  - Поле для manual secret (опционально, readonly или disabled до подключения API)
  - Краткая инструкция по настройке (текст)
  - Кнопка «Завершить настройку»
  - Подключить `auth.css`

**Критерий приёмки:** Страница отображается, элементы на месте.

**Статус:** ✅ Выполнено (25.02.2026). Создан `auth-2fa-setup.html`: заглушка QR-кода (div с пунктирной рамкой и иконкой), поле manual secret (readonly, placeholder «Секрет будет получен от сервера»), инструкция из 4 шагов, кнопки «Завершить настройку» и «Отмена». Подключён auth.css. Создан `auth-2fa-setup.js` (инициализация темы, заглушка кнопки). В auth.css добавлены стили: .card--wide, .setup-2fa, .qr-placeholder, .setup-2fa__instructions.

---

#### Шаг 8.3 — Интеграция в auth.js

**Файл:** `src/js/auth.js`

**Действия:**
- После успешного логина проверить ответ сервера (заглушка: `response.requires_2fa === true`)
- Если требуется 2FA — перенаправить на `auth-2fa-verify.html`
- Передать token/session в URL hash или sessionStorage для последующей проверки кода

**Критерий приёмки:** После логина с флагом 2FA происходит редирект на страницу проверки.

**Статус:** ✅ Выполнено (25.02.2026). В auth.js после успешной проверки логина: заглушка `mockResponse.requires_2fa` (true для пользователя admin). При requires_2fa — сохранение в sessionStorage `auth2faPending` (username, role, token), редирект на auth-2fa-verify.html. isLoggedIn не устанавливается до прохождения 2FA.

---

#### Шаг 8.4 — Заглушки вызовов API 2FA

**Файл:** `src/js/auth-2fa.js` (новый) или добавить в `auth.js`

**Действия:**
- Добавить функцию `verify2FACode(code)` — заглушка вызова `POST /api/v1/auth/2fa/verify/`
  - Пока возвращает mock-ответ (успех/ошибка)
  - При успехе — редирект на `index.html`
- Добавить функцию `setup2FA()` — заглушка вызова `POST /api/v1/auth/2fa/setup/`
  - Пока возвращает mock QR-код и secret
- На `auth-2fa-verify.html` при submit вызывать `verify2FACode`
- На `auth-2fa-setup.html` при загрузке вызывать `setup2FA` и отобразить QR/secret

**Критерий приёмки:** Заглушки работают, переходы между страницами корректны.

**Статус:** ✅ Выполнено (25.02.2026). Создан `auth-2fa.js`: verify2FACode (mock: успех для кода 123456, при успехе — localStorage + редирект на index), setup2FA (mock QR SVG + secret), getAuth2faPending, confirm2FASetup. auth-2fa-verify.js: вызов verify2FACode при submit, проверка auth2faPending при загрузке (редирект на auth при отсутствии). auth-2fa-setup.html: добавлено поле кода подтверждения. auth-2fa-setup.js: при загрузке вызов setup2FA, отображение QR и secret, confirm2FASetup при «Завершить настройку» (код 123456).

---

#### Шаг 8.5 — Генерация сканируемого QR-кода

**Файлы:** `package.json`, `src/js/auth-2fa.js`

**Действия:**
- Установить библиотеку генерации QR (например `qrcode`)
- В `setup2FA()` генерировать реальный QR из otpauth:// URI (secret, issuer, account)
- QR должен быть сканируем приложением-аутентификатором (Google Authenticator, Authy и т.п.)

**Критерий приёмки:** QR на странице настройки 2FA сканируется приложением, можно получить код и проверить ввод.

**Статус:** ✅ Выполнено (25.02.2026). Установлены пакеты `qrcode` и `otplib`. В setup2FA: генерация QR через QRCode.toDataURL(otpauth) с secret base32 (JBSWY3DPEHPK3PXP). В confirm2FASetup: при передаче secret — проверка кода через otplib.verify (TOTP). QR сканируется, код из приложения проходит проверку.

---

### Этап 9. Рефакторинг для замены mock-данных на API

**Приоритет:** Высокий  
**Оценка:** 3–4 дня  
**Источник:** PLAN_TASKS_2026.md, задача 5

**Цель:** Подготовить слой абстракции для переключения между mock-данными и реальным API.

#### Шаг 9.1 — Ввести флаг источника данных

**Файл:** `src/js/config/api-config.js`

**Действия:**
- Добавить `USE_API: boolean` — при `true` использовать API, при `false` — mock (JSON + VFS)
- Значение задавать через проверку `API_BASE_URL` (если не пустой — `USE_API = true`) или отдельным параметром
- Добавить `API_BASE_URL: string` (может быть пустым для mock-режима)

**Критерий приёмки:** Флаг определяется корректно, можно переключать режимы.

**Статус:** ✅ Выполнено (25.02.2026). Добавлены: `USE_API` (вычисляется по непустому `API_BASE_URL` или переопределяется через `window.USE_API`), `API_BASE_URL` (поддержка `window.API_BASE_URL` с trim), метод `ApiConfig.getUseApi()`.

---

#### Шаг 9.2 — Создать слой data-service

**Файл:** `src/js/modules/core/data-service.js` (новый)

**Действия:**
- Создать объект `DataService` с методами:
  - `loadTechnologies(enterpriseId?)` → Promise<Array>
  - `loadReference(name)` → Promise (blocks, functions, vendors, integrators, enterprises, directions и т.д.)
  - `createTech(tech)` → Promise<Technology>
  - `updateTech(id, tech)` → Promise<Technology>
  - `deleteTech(id)` → Promise<void>
  - `loadEnterprises()` → Promise<Array>
  - Другие методы по необходимости
- Экспортировать через ES module (или `window.DataService` для обратной совместимости)

**Критерий приёмки:** Структура DataService определена, методы имеют правильные сигнатуры.

**Статус:** ✅ Выполнено (25.02.2026). Создан `data-service.js` с методами: loadTechnologies, loadReference, createTech, updateTech, deleteTech, loadEnterprises, loadEnterpriseData. Константа REFERENCE_NAMES. Подключён в main.js. Реализация — в шаге 9.3.

---

#### Шаг 9.3 — Реализовать переключение mock / API в DataService

**Файл:** `src/js/modules/core/data-service.js`

**Действия:**
- При `USE_API === true`: вызывать `ApiClient.get/post/put/patch/delete` с нужными путями
- При `USE_API === false`: вызывать `loadJsonPreferVfs`, `vfsRead`, `vfsWrite` и т.д.
- Маппинг ответов API в формат, ожидаемый приложением (использовать `normalizeTechnologyFromNewFormat` и аналоги)
- Обработка ошибок в едином формате

**Критерий приёмки:** DataService переключается между mock и API режимами, данные нормализуются одинаково.

**Статус:** ✅ Выполнено (25.02.2026). Реализовано: mock-режим (loadJsonPreferVfs, vfsRead, vfsWrite), API-режим (ApiClient.get/post/put/patch/delete), маппинг через normalizeTechnologyFromNewFormat, wrapApiError для единого формата ошибок. Пути API: /api/v1/technologies, /api/v1/references/{name}.

---

#### Шаг 9.4 — Заменить прямые вызовы в data-loader

**Файл:** `src/js/modules/core/data-loader.js`

**Действия:**
- В `loadData()` заменить вызовы `loadJsonPreferVfs` и `vfsRead` на `DataService.loadTechnologies()` и `DataService.loadReference(...)`
- Оставить оркестрацию (установка state, инициализация фильтров и т.д.)
- Обновить обработку ошибок через единый слой

**Критерий приёмки:** data-loader использует DataService, функциональность не нарушена.

**Статус:** ✅ Выполнено (25.02.2026). loadData переведён на DataService.loadReference (blocks + refs) и DataService.loadTechnologies; getIntegratorsList — на loadReference; ensureAndPersistNewTech — на DataService.createTech/updateTech.

---

#### Шаг 9.5 — Заменить мутации в form-management и app-init

**Файлы:** `src/js/modules/ui/form-management.js`, `src/js/modules/core/app-init.js`

**Действия:**
- Вместо прямого `setState` + `vfsWrite` вызывать `DataService.createTech`, `DataService.updateTech`, `DataService.deleteTech`
- Обновлять state и UI на основе ответов DataService
- Обработать ошибки через единый слой

**Критерий приёмки:** Формы используют DataService, CRUD операции работают через абстракцию.

**Статус:** ✅ Выполнено (25.02.2026). form-management: удаление через DataService.deleteTech; добавление/редактирование — через ensureAndPersistNewTech (DataService.createTech/updateTech); blocks/functions — DataService.loadReference и saveReference. app-init: удаление через DataService.deleteTech. Добавлен DataService.saveReference для blocks, functions, functionToBlock.

---

#### Шаг 9.6 — Сохранить маппинг форматов

**Файлы:** `src/js/modules/core/data-normalize.js`, `data-service.js`

**Действия:**
- Убедиться, что ответы API приводятся к формату, используемому в `technologies`, `enterpriseData` и т.д.
- Использовать `normalizeTechnologyFromNewFormat` для нормализации данных из API
- Документировать маппинг полей API → клиентский формат

**Критерий приёмки:** Данные из API нормализуются корректно, формат совместим с текущим кодом.

**Статус:** ✅ Выполнено (25.02.2026). DataService использует normalizeTechnologyFromNewFormat в apiLoadTechnologies, apiCreateTech, apiUpdateTech. Создан docs/API_FORMAT_MAPPING.md. JSDoc в data-normalize.js. Добавлен saveTechnologies, все vfsWrite(technologies) в data-loader и state-utils заменены на DataService.saveTechnologies.

---

### Этап 9.5. Привязка предприятий к функциональным блокам

**Приоритет:** Высокий  
**Оценка:** 2–3 дня  
**Источник:** Требование продукта (после согласования размещения в плане)

**Цель:** Реализовать справочную привязку предприятий к функциональным блокам (какие предприятия отнесены к каким блокам) и использовать её в фильтрах и формах. Этап выполняется после этапа 9, чтобы данные загружались через DataService и один контракт работал для mock и API.

#### Шаг 9.5.1 — Модель данных привязки

**Файлы:** `src/data/ru/enterprises.json` (или отдельный `enterprise-blocks.json`), описание в `docs/API_INTEGRATION.md`

**Действия:**
- Определить формат привязки: в каждом предприятии поле `blockIds: number[]` (или в каждом блоке `enterpriseIds: number[]`), либо отдельный справочник пар (enterpriseId, blockId)
- Для mock: добавить в `enterprises.json` поле `blockIds` к каждой записи предприятия (или создать `enterprise-blocks.json`)
- Задокументировать формат для будущего API (endpoint или часть `GET /references/enterprises`)

**Критерий приёмки:** Формат зафиксирован, mock-данные содержат привязку.

**Статус:** ✅ Выполнено (25.02.2026). Создан `src/data/ru/enterprises-blocks-mapping.json` с форматом `enterprises_blocks_mapping: [{enterprise_id, enterprise_name, functional_blocks[]}]`. DataService.loadReference('enterprisesBlocksMapping').

---

#### Шаг 9.5.2 — Загрузка привязки через DataService

**Файл:** `src/js/modules/core/data-service.js`

**Действия:**
- В `loadReference('enterprises')` (или отдельный `loadReference('enterpriseBlocks')`) возвращать данные с привязкой к блокам
- При `USE_API === false`: читать из JSON (enterprises с `blockIds` или отдельный файл)
- При `USE_API === true`: использовать ответ API (тот же формат после нормализации)
- Сохранять в state структуру для быстрого доступа: `enterpriseIdToBlockIds`, `blockIdToEnterpriseIds` (или эквивалент)

**Критерий приёмки:** DataService возвращает привязку, state обновляется при загрузке.

**Статус:** ✅ Выполнено (25.02.2026). DataService.loadReference('enterprisesBlocksMapping'), data-loader строит enterpriseIdToBlockIds и blockIdToEnterpriseIds, сохраняет в state. ensureEnterpriseBlockMapping обновляет привязку при добавлении технологии.

---

#### Шаг 9.5.3 — Нормализация и доступ из state

**Файлы:** `src/js/modules/core/data-normalize.js`, `src/js/modules/core/state-utils.js`, `src/js/modules/core/data-loader.js`

**Действия:**
- По данным enterprises (с `blockIds`) построить мапы `enterpriseIdToBlockIds` и при необходимости `blockIdToEnterpriseIds`
- Положить в state ключи, например: `enterpriseIdToBlockIds`, `blockIdToEnterpriseIds`
- Добавить в state-utils геттеры для этих структур (или использовать существующие getState)

**Критерий приёмки:** По enterpriseId можно получить список допустимых blockId и наоборот.

**Статус:** ✅ Выполнено (25.02.2026). state-utils: accessors enterpriseIdToBlockIds, blockIdToEnterpriseIds; геттеры getEnterpriseIdToBlockIds, getBlockIdToEnterpriseIds.

---

#### Шаг 9.5.4 — Учёт привязки в фильтрах

**Файлы:** `src/js/modules/ui/filters.js`, `src/js/modules/ui/filter-init.js`

**Действия:**
- При выборе предприятия в фильтре: ограничивать список блоков только теми, что привязаны к выбранному предприятию (если привязка задана); при отсутствии привязки — показывать все блоки
- При выборе блока: опционально ограничивать список предприятий теми, что привязаны к выбранному блоку
- Учитывать привязку при применении фильтров к данным радара

**Критерий приёмки:** Фильтры согласованы с привязкой предприятий и блоков.

**Статус:** ✅ Выполнено (25.02.2026). filters.js: getBlocksForEnterprisesFromMapping, populateSelect для block использует привязку при выборе предприятий; updateFiltersForEnterprises обновляет блоки по привязке.

---

#### Шаг 9.5.5 — Учёт привязки в формах добавления/редактирования

**Файлы:** `src/js/modules/ui/form-management.js`, разметка модалок (блок, предприятие)

**Действия:**
- В форме добавления технологии: при выборе предприятия подставлять или ограничивать список блоков по привязке; при выборе блока — ограничивать список предприятий по привязке (по возможности)
- Аналогично в форме редактирования технологии
- Валидация: не допускать недопустимые пары предприятие–блок при сохранении (если привязка строгая)

**Критерий приёмки:** В формах отображаются только допустимые комбинации предприятие–блок.

**Статус:** ✅ Выполнено (25.02.2026). filters.js updateModalBlocksForEnterprises: при выборе предприятий (techCompany/editCompany) ограничивает список блоков по getBlocksForEnterprisesFromMapping; при отсутствии привязки — все блоки. ensureEnterpriseBlockMapping в data-loader добавляет новые связи при сохранении.

---

#### Шаг 9.5.6 — Админка привязки (опционально)

**Файл:** `src/pages/admin.html`, раздел админ-панели

**Действия:**
- При необходимости: экран или подраздел для просмотра/редактирования привязки предприятий к блокам (список предприятий с мультивыбором блоков или наоборот)
- Сохранение через DataService (mock: запись в JSON; API: вызов соответствующего endpoint)

**Критерий приёмки:** При наличии требований к админке — привязку можно редактировать через UI.

**Статус:** Опционально, не реализовано. При необходимости — отдельная задача.

---

### Этап 10. Проверка приложения и настройка инструментов для работы с API

**Приоритет:** Высокий  
**Оценка:** 2–3 дня  
**Источник:** PLAN_TASKS_2026.md, задача 6

**Цель:** Настроить инструменты для работы с API и проверить готовность к интеграции.

#### Шаг 10.1 — Создать локальную конфигурацию API

**Файл:** `src/js/config/api-config.local.example.js` (пример)

**Действия:**
- Создать пример конфига с `API_BASE_URL`, комментариями
- Добавить `api-config.local.js` в `.gitignore`
- В `api-config.js` или в точке входа подключать `api-config.local.js` при наличии (через try/catch или проверку существования)

**Критерий приёмки:** Локальный конфиг не попадает в git, пример понятен.

**Статус:** ✅ Выполнено (25.02.2026). Создан api-config.local.example.js, api-config.local.js добавлен в .gitignore. api-config-loader.js опционально загружает локальный конфиг. Prebuild-скрипт ensure-api-config-local.js создаёт файл из примера при сборке, если отсутствует.

---

#### Шаг 10.2 — Реализовать api-client

**Файл:** `src/js/modules/core/api-client.js`

**Действия:**
- Реализовать `request(method, path, data?, options?)`:
  - Сборка URL из `API_BASE_URL` + path
  - Добавление `Authorization: Bearer <token>` из localStorage/sessionStorage
  - Использование AbortController + timeout
  - Обработка различных типов данных (JSON, FormData и т.д.)
- Обработка 401: попытка refresh token, при неудаче — редирект на `auth.html`
- Нормализация ошибок (общий формат для UI)
- Методы-хелперы: `get()`, `post()`, `put()`, `patch()`, `delete()`

**Критерий приёмки:** ApiClient работает, обрабатывает ошибки, поддерживает refresh token.

**Статус:** ✅ Выполнено (25.02.2026). Реализованы request (URL, Authorization: Bearer, AbortController+timeout, JSON/FormData), обработка 401 с попыткой refresh token и редиректом на auth.html, нормализация ошибок, хелперы get/post/put/patch/delete.

---

#### Шаг 10.3 — Настроить mock API для тестов (опционально)

**Действия:**
- Установить MSW (Mock Service Worker) или настроить отдельный mock-server
- Описать mock-ответы для основных endpoints:
  - `GET /api/v1/technologies`
  - `POST /api/v1/technologies`
  - `GET /api/v1/references/blocks`
  - И другие по необходимости
- Настроить перехват запросов в тестах

**Критерий приёмки:** Mock API работает в тестах, можно тестировать без реального backend.

**Статус:** ✅ Выполнено (25.02.2026). Установлен MSW. Созданы handlers (GET/POST/PATCH/PUT/DELETE technologies, GET/PUT references/*), server, интеграция в vitest.setup. Тест data-service-api.test.js проверяет DataService в API-режиме с mock.

---

#### Шаг 10.4 — Ручная проверка сценариев

**Действия:**
- Проверить загрузку данных при `USE_API = false` (mock):
  - Загрузка радара
  - Фильтры
  - Добавление/редактирование/удаление технологий
  - Экспорт PDF
  - Админ-панель
- Проверить переключение на `USE_API = true` (если есть тестовый API):
  - Те же сценарии с реальным API

**Критерий приёмки:** Все сценарии работают в обоих режимах.

**Статус:** ✅ Выполнено (25.02.2026). Ручная проверка mock-режима пройдена: загрузка радара, фильтры, CRUD технологий, экспорт PDF, админ-панель. Тестовый API отсутствует — проверка USE_API = true не проводилась.

---

#### Шаг 10.5 — Smoke / E2E тесты (опционально)

**Действия:**
- Добавить Playwright или Cypress
- Написать 2–3 базовых сценария:
  - Логин (mock)
  - Загрузка радара
  - Добавление технологии (mock API)
- Настроить CI для запуска тестов

**Критерий приёмки:** E2E тесты проходят, можно автоматизировать проверку регрессий.

**Статус:** ✅ Выполнено (26.02.2026). Добавлен Playwright: playwright.config.js (webServer, baseURL 5173), e2e/auth.spec.js (логин architect, ошибка пароля), e2e/radar.spec.js (загрузка SVG, видимость addTechBtn), e2e/add-technology.spec.js (форма добавления, заполнение и сохранение). .github/workflows/e2e.yml для CI. Скрипты test:e2e, test:e2e:ui в package.json.

---

#### Шаг 10.6 — Документация

**Файл:** `docs/API_INTEGRATION.md` (новый)

**Действия:**
- Описать порядок включения API:
  - Создание `api-config.local.js`
  - Установка `API_BASE_URL`
  - Переключение `USE_API`
- Описать структуру ответов API и маппинг в клиентские структуры
- Описать обработку ошибок и refresh-токена
- Описать формат запросов и ответов для основных endpoints

**Критерий приёмки:** Документация полная, понятная для разработчиков backend.

**Статус:** ✅ Выполнено (26.02.2026). Создан docs/API_INTEGRATION.md: порядок включения API (api-config.local.js, API_BASE_URL, USE_API), авторизация и токены, refresh endpoint, обработка ошибок, форматы запросов/ответов для technologies и references, маппинг (ссылка на API_FORMAT_MAPPING.md), CORS и proxy.

---

### Этап 11. Учёт отрицательных факторов (опционально, требует согласования)

**Приоритет:** Низкий (требует согласования)  
**Оценка:** 2–3 дня  
**Источник:** PLAN_TASKS_2026.md, задача 3

**Важно:** Перед реализацией необходимо согласовать с архитекторами и руководством набор полей и правила учёта.

#### Шаг 11.1 — Согласование (вне разработки)

**Действия:**
- Провести встречу / обмен документами с архитекторами и руководством
- Зафиксировать: какие поля учитывать (стоимость, риски, сложность, срок окупаемости и т.п.)
- Определить: как эти факторы влияют на радар (приоритет, цвет, фильтрация)

**Критерий приёмки:** ТЗ согласовано и зафиксировано.

---

#### Шаг 11.2 — Расширить модель технологии

**Файлы:** `src/data/ru/technologies.json`, `data-normalize.js`

**Действия:**
- Добавить в схему технологии поля (по результатам согласования):
  - `cost` (стоимость)
  - `risks` (риски)
  - `complexity` (сложность)
  - `paybackPeriod` (срок окупаемости)
  - И другие по ТЗ
- Обновить `normalizeTechnologyFromNewFormat` для поддержки новых полей

**Критерий приёмки:** Модель расширена, нормализация работает.

---

#### Шаг 11.3 — Добавить поля в формы

**Файл:** `src/js/modules/ui/form-management.js`, HTML модалок

**Действия:**
- Добавить поля в форму добавления технологии
- Добавить поля в форму редактирования
- Подключить к `FormData` / обработчикам сохранения
- Добавить валидацию (если требуется)

**Критерий приёмки:** Поля отображаются в формах, данные сохраняются.

---

#### Шаг 11.4 — Учёт в расчёте приоритета / визуализации

**Файлы:** `src/js/modules/business/priorities.js`, `radar-renderer.js`

**Действия:**
- Учитывать отрицательные факторы в расчёте приоритета (по согласованной формуле)
- При необходимости — менять цвет/размер blip на радаре
- Добавить фильтрацию по отрицательным факторам

**Критерий приёмки:** Отрицательные факторы влияют на приоритет и визуализацию.

---

#### Шаг 11.5 — Отображение в карточке и панели деталей

**Файл:** `detail-panel.js`, `edit-tech-tabs-manager.js`

**Действия:**
- Вывести новые поля в панели деталей технологии
- Вывести новые поля во вкладках редактирования

**Критерий приёмки:** Поля отображаются в UI, пользователь видит значения.

---

### Этап 12. Финализация и подготовка к backend

**Приоритет:** Высокий  
**Оценка:** 1–2 дня  
**Источник:** FRONTEND_FIXES.md, этап 8

**Цель:** Завершить все задачи frontend и подготовить код к интеграции с backend.

#### Шаг 12.1 — Полная регрессионная проверка

**Действия:**
- Пройти по чек-листу из `docs/REGRESSION_CHECKLIST.md`:
  - Загрузка радара
  - Фильтры (блоки, функции, предприятия, вендоры, интеграторы)
  - CRUD технологии (добавление, редактирование, удаление)
  - Валидация дубликатов (технологии, вендоры, интеграторы)
  - Экспорт PDF
  - Вход и авторизация
  - Админ-панель (все разделы)
  - 2FA страницы (если реализованы)
- Исправить найденные баги
- Зафиксировать результаты проверки

**Критерий приёмки:** Все сценарии работают без ошибок.

**Статус:** ✅ Выполнено (26.02.2026). Регрессионная проверка пройдена. Исправление: 2FA включена для всех ролей (architect, director, rp, admin) — в auth.js `requires_2fa: true` для любого успешного входа.

---

#### Шаг 12.2 — Обновить документацию

**Действия:**
- Обновить `README.md` с инструкциями по запуску через Vite
- Обновить `docs/FRONTEND_FIXES.md` — отметить выполненные этапы
- Обновить `docs/FRONTEND_CODE_STATE_AND_REFACTORING_PLAN.md` — отметить завершение
- Обновить `docs/PLAN_TASKS_2026.md` — отметить выполненные задачи
- Создать `docs/FRONTEND_COMPLETION_SUMMARY.md` с итогами доработки

**Критерий приёмки:** Вся документация актуальна и отражает текущее состояние.

**Статус:** ✅ Выполнено (26.02.2026). README.md — Vite, E2E, API config, 2FA, версия РТП-3. PLAN_TASKS_2026.md — таблица статусов. Создан FRONTEND_COMPLETION_SUMMARY.md. FRONTEND_FIXES.md и FRONTEND_CODE_STATE_AND_REFACTORING_PLAN.md не найдены.

---

#### Шаг 12.3 — Code review и финальные правки

**Действия:**
- Провести code review всех изменений
- Исправить замечания
- Проверить соответствие стандартам кодирования
- Убедиться, что нет закомментированного кода и TODO без контекста

**Критерий приёмки:** Код готов к merge, замечания исправлены.

**Статус:** ✅ Выполнено (26.02.2026). Review: TODO в select-events.js — с контекстом. Закомментированного кода нет. ensure-api-config-local.js переименован в .mjs (устранено предупреждение Node). Build успешен.

---

#### Шаг 12.4 — Подготовка к интеграции с backend

**Действия:**
- Убедиться, что `api-client.js` готов к использованию
- Убедиться, что `data-service.js` поддерживает переключение mock/API
- Проверить, что все endpoints задокументированы в `API_INTEGRATION.md`
- Создать список требований к backend API (если ещё не создан)

**Критерий приёмки:** Frontend готов к подключению реального API.

**Статус:** ✅ Выполнено (26.02.2026). api-client и data-service проверены. API_INTEGRATION.md дополнен секцией auth/2FA. Создан BACKEND_API_REQUIREMENTS.md. Этап 12 завершён полностью.

---

## Сводка по этапам

| Этап | Содержание | Оценка | Приоритет | Статус |
|------|------------|--------|-----------|--------|
| 7 | Переход на ES modules и Vite | 5–7 дней | Высокий | 🔄 В работе (7.1–7.6 ✅) |
| 8 | Заглушки экранов 2FA | 1–2 дня | Средний | ✅ Завершён |
| 9 | Рефакторинг для замены mock на API | 3–4 дня | Высокий | ✅ Завершён |
| 9.5 | Привязка предприятий к функциональным блокам | 2–3 дня | Высокий | ✅ Завершён |
| 10 | Проверка и настройка инструментов API | 2–3 дня | Высокий | 🔄 В работе (10.1–10.5 ✅) |
| 11 | Учёт отрицательных факторов | 2–3 дня | Низкий* | ⏸ Требует согласования |
| 12 | Финализация и подготовка к backend | 1–2 дня | Высокий | ✅ Завершён |

**Итого (без этапа 11):** ~14–21 рабочий день

*Этап 11 требует предварительного согласования с архитекторами и может быть выполнен параллельно или после подключения backend.

---

## Рекомендуемый порядок выполнения

1. **Этап 7** (ES modules + Vite) — основа для дальнейшей работы
2. **Этап 9** (Рефакторинг для API) — подготовка слоя абстракции
3. **Этап 9.5** (Привязка предприятий к функциональным блокам) — после DataService, один контракт для mock и API
4. **Этап 10** (Проверка и настройка API) — настройка инструментов
5. **Этап 8** (2FA заглушки) — можно выполнять параллельно с этапами 9–10
6. **Этап 12** (Финализация) — завершающий этап
7. **Этап 11** (Отрицательные факторы) — после согласования, можно параллельно с backend

---

## Зависимости между этапами

- **Этап 7** → **Этап 9**: После перехода на ES modules проще рефакторить код для API
- **Этап 9** → **Этап 9.5**: DataService должен быть готов, чтобы привязка предприятий к блокам загружалась через один контракт (mock/API)
- **Этап 9.5** → **Этап 10**: После привязки — проверка сценариев и настройка API
- **Этап 8** может выполняться независимо
- **Этап 11** требует согласования и может быть выполнен в любое время после него
- **Этап 12** выполняется последним, после всех остальных

---

## Критерии готовности к переходу на backend

Frontend считается готовым к интеграции с backend, когда:

- ✅ Все модули переведены на ES modules
- ✅ Проект собирается через Vite
- ✅ DataService реализован и поддерживает переключение mock/API
- ✅ Привязка предприятий к функциональным блокам реализована и используется в фильтрах и формах
- ✅ ApiClient реализован и готов к использованию
- ✅ Все сценарии работают в mock-режиме
- ✅ Документация API интеграции готова
- ✅ Регрессионная проверка пройдена
- ✅ Код отрефакторен и готов к code review

---

## Фиксация изменений (этап 7)

**24.02.2026 — шаги 7.1 и 7.2**

| Файл | Изменение |
|------|-----------|
| `vite.config.js` | Создан: root, publicDir, build.outDir, server.port 5173, resolve.alias `@`→src, assetsInclude для JSON |
| `package.json` | Добавлены скрипты `dev`, `build`, `preview`; в devDependencies — Vite |
| `index.html` (корень) | Добавлен `<script type="module" src="/src/main.js">`, viewport |
| `src/main.js` | Создан: loadModule, loadAllModules (порядок как в RMK-director + common-ui, tech-tabs-manager и др.), константы радара в window, bootstrap по DOMContentLoaded |
| `src/pages/radar.html` | Удалены все отдельные `<script src="...">` (RMK-director.js и 7 скриптов); оставлен один `<script type="module" src="/src/main.js">` |

**24.02.2026 — шаг 7.3**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/core/logger.js` | Переведён на ES module: `export function` (log, error, warn, debug, info, group, groupEnd, groupCollapsed, isDevMode), `export default Logger`. Экспорт в `window.Logger` оставлен для обратной совместимости. |
| `src/main.js` | Добавлен `import Logger from './js/modules/core/logger.js'`, присвоение `window.Logger = Logger`; строка загрузки `logger.js` через `loadModule` удалена из списка модулей. |

Файл `src/js/RMK-director.js` пока не удалён (используется как справка до шага 7.5).

**24.02.2026 — шаг 7.4 (группа Core)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/core/escape-utils.js` | Переведён на ES module: `export function escapeHtml`, экспорт в `window.escapeHtml`. |
| `src/js/modules/core/state-manager.js` | Переведён на ES module: `import Logger`, `export default StateManager`, экспорт в `window.StateManager`. |
| `src/js/modules/core/dom-utils.js` | Переведён на ES module: экспорт DOMCache, DOMProxy, createDOMGetter, createDOMProxy, createElementProxy, escapeHtmlDom; экспорт в window (кроме escapeHtml — задаётся из escape-utils). |
| `src/js/modules/core/validators.js` | Переведён на ES module: `import StateManager`, `export function normalizeForComparison`, `validateDuplicateTechnology`; экспорт в window. |
| `src/js/modules/core/error-handler.js` | Переведён на ES module: `import Logger`, `export function reportError`, `reportValidationErrors`; экспорт в window. |
| `src/js/modules/core/data-source.js` | Переведён на ES module: `import Logger`, экспорт DataSource и функций (vfsRead, vfsWrite, loadJsonPreferVfs и др.); экспорт в window. |
| `src/js/modules/core/data-normalize.js` | Переведён на ES module: `export function` buildBlockMaps, normalizeReadiness, normalizeTechnologyFromNewFormat, buildEnterpriseDataFromTechnologies; экспорт в window.DataNormalize. |
| `src/js/modules/core/data-loader.js` | Переведён на ES module: импорты StateManager, data-source, data-normalize, error-handler, escape-utils, validators, Logger; `const DataLoader = { ... }`, экспорт в window; `export default DataLoader`, named exports. |
| `src/main.js` | Добавлены импорты: escape-utils, dom-utils, state-manager, validators, error-handler, data-source, data-normalize, data-loader; из списка loadAllModules удалены эти Core-модули (оставлены core-utils, api-client, state-utils, data-indexing). |

**24.02.2026 — шаг 7.4 (группа UI)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/ui/toast.js` | ES module: `import { escapeHtml }`, экспорт Toast (show, success, error, warning, info, hideAll, ToastType), `window.Toast`. |
| `src/js/modules/ui/loading.js` | ES module: экспорт show, hide, showProgress, updateMessage; LoadingManager в `window.LoadingManager`. |
| `src/js/modules/ui/error-display.js` | ES module: `import { escapeHtml }`, `import Logger`; экспорт show, showRetryable, hide, hideAll, ErrorTypes; `window.ErrorDisplay`. |
| `src/js/modules/ui/detail-panel.js` | ES module: `import { DOMCache, escapeHtml }`; getDOMElement через DOMCache; экспорт DetailPanel (showDetail, getFieldValue, getFieldLabel); `window.DetailPanel`. |
| `src/js/modules/ui/filters.js` | ES module: `import { escapeHtml }`, `import StateManager`; _esc через escapeHtml; get*FromState через StateManager; экспорт Filters; `window.Filters`, window.renderMultiSelectTags и др. |
| `src/js/modules/ui/filter-init.js` | ES module: `import StateManager`; getState через StateManager; экспорт FilterInit; `window.FilterInit`, window.initFiltersWithRetry, initFilters. |
| `src/js/modules/ui/modals.js` | ES module: экспорт showModal, hideModal, showInternalConfirm; Modals в `window.Modals`, window.showModal, hideModal. |
| `src/js/modules/ui/form-management.js` | ES module: `import { DOMCache }`; getDOMCache возвращает DOMCache; экспорт FormManagement; `window.FormManagement` и др. |
| `src/main.js` | Добавлены импорты: toast, loading, error-display, detail-panel, filters, filter-init, modals, form-management; из loadAllModules удалены эти UI-модули. |

**24.02.2026 — шаг 7.4 (продолжение, UI: focus-trap, skeleton, tooltips, notifications)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/ui/focus-trap.js` | ES module: экспорт FocusTrap (trap, release); `window.FocusTrap`. |
| `src/js/modules/ui/skeleton.js` | ES module: `import Logger`; экспорт Skeleton (createTechListSkeleton, createDetailPanelSkeleton, createChartSkeleton, createTableSkeleton, show, hide, replace); `window.Skeleton`. |
| `src/js/modules/ui/tooltips.js` | ES module: `import { DOMCache }`; getDOMCache убран, createDebouncedHover использует DOMCache; экспорт initTooltips, getHoverText, createDebouncedHover; `window.TooltipModule`, `window.Hover`, `window.debouncedHover`. |
| `src/js/modules/ui/notifications.js` | ES module: `import { escapeHtml }`, `import Logger`; escapeHtml через escape-utils, window.Logger заменён на Logger; экспорт default Notifications; `window.Notifications`. |
| `src/main.js` | Добавлены импорты: focus-trap, skeleton, tooltips, notifications; из loadAllModules удалены эти четыре UI-модуля и skeleton. |

**24.02.2026 — шаг 7.4 (продолжение, UI: report-status, modal-forms, sidebar, forms, common-ui)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/ui/report-status.js` | ES module: `import Modals`; использование Modals.showModal/hideModal; экспорт ReportStatus и функций; `window.ReportStatus`. |
| `src/js/modules/ui/modal-forms.js` | ES module: импорты DOMCache, StateManager, Logger из core; getDOMCache убран; экспорт ModalForms; `window.ModalForms`. |
| `src/js/modules/ui/sidebar.js` | ES module: импорты StateManager, DOMCache из core; экспорт Sidebar; `window.Sidebar`. |
| `src/js/modules/ui/forms.js` | ES module: убран IIFE; экспорт FormsModule (isFormDirty, snapshotFormInitial, createCompanyRatingsFields, updateTechRatingsVisibility, updateEditTechRatingsVisibility); `window.FormsModule`, window.isFormDirty и др. |
| `src/js/modules/ui/common-ui.js` | ES module: `import Logger`; window.Logger заменён на Logger; экспорт CommonUI (renderAuth, checkArchitectRole, safeLogout, initTheme, showHelpMenu, initHelpButton, initCommonUI); `window.CommonUI`, window.renderAuth и др. |
| `src/main.js` | Добавлены импорты: report-status, modal-forms, sidebar, forms, common-ui; из loadAllModules удалены эти пять UI-модулей. |

**24.02.2026 — шаг 7.4 (продолжение, UI: вкладки, покрытие функций, мобильная навигация, клавиатура, ARIA, offline)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/ui/tech-tabs-manager.js` | ES module: убран IIFE; экспорт TechTabsManager; `window.TechTabsManager`. |
| `src/js/modules/ui/edit-tech-tabs-manager.js` | ES module: `import { escapeHtml }` из core; убран IIFE; экспорт EditTechTabsManager; `window.EditTechTabsManager`. |
| `src/js/modules/ui/func-cover-calculator.js` | ES module: убран IIFE; экспорт FuncCoverCalculator; автоинициализация при загрузке; `window.FuncCoverCalculator`. |
| `src/js/modules/ui/auto-func-cover.js` | ES module: убран IIFE; экспорт AutoFuncCover; автоинициализация; `window.AutoFuncCover`. |
| `src/js/modules/ui/mobile-nav.js` | ES module: `import Logger`; экспорт MobileNav; `window.MobileNav`. |
| `src/js/modules/ui/touch-handlers.js` | ES module: экспорт TouchHandlers; `window.TouchHandlers`. |
| `src/js/modules/ui/keyboard-nav.js` | ES module: убран IIFE; экспорт KeyboardNav; `window.KeyboardNav`. |
| `src/js/modules/ui/aria-manager.js` | ES module: убран IIFE; экспорт AriaManager (init, updateAria*, announceToScreenReader, setExportModalLoading); `window.AriaManager`. |
| `src/js/modules/ui/offline-handler.js` | ES module: убран IIFE; экспорт OfflineHandler; `window.OfflineHandler`. |
| `src/main.js` | Добавлены импорты: tech-tabs-manager, edit-tech-tabs-manager, func-cover-calculator, auto-func-cover, mobile-nav, touch-handlers, keyboard-nav, aria-manager, offline-handler; из loadAllModules удалены эти девять UI-модулей. |

**24.02.2026 — исправление StateAccessors и перевод state-utils, onboarding, select-events, vendors-files**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/core/state-utils.js` | Переведён на ES module: `import StateManager`, `import { DOMCache }`; убран IIFE; getStateManager/getDOMCacheRef используют импорты; экспорт StateAccessors, StateSubscriptions; `window.StateAccessors`, `window.StateSubscriptions`. |
| `src/main.js` | Добавлен импорт `state-utils.js` после data-loader (до UI); state-utils удалён из loadAllModules. |
| `src/js/modules/ui/form-management.js` | getStateAccessors() возвращает null вместо throw при отсутствии StateAccessors; в initAddBlockFormHandler при null — повтор через setTimeout (до MAX_INIT_ATTEMPTS). |
| `src/js/modules/ui/onboarding.js` | ES module: `import Logger`; убран IIFE; window.Logger заменён на Logger; экспорт OnboardingTour; `window.OnboardingTour`. |
| `src/js/modules/ui/select-events.js` | ES module: `import { DOMCache }`; убран getDependency и IIFE; экспорт initSelectEvents, positionOptions; `window.initSelectEvents`, `window.SelectPositioning`, `window.positionOptions`. |
| `src/js/modules/ui/vendors-files.js` | ES module: `import Logger`; убран IIFE; window.Logger заменён на Logger; экспорт VendorsFiles; `window.VendorsFiles`. |
| `src/main.js` | Добавлены импорты: onboarding, select-events, vendors-files; из loadAllModules удалены эти три UI-модуля. |

**24.02.2026 — шаг 7.4 (группа Radar, третья группа)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/radar/spatial-index.js` | ES module: `import Logger`; экспорт Quadtree, findCollisionsWithQuadtree, optimizeLayoutWithSpatialIndex; `window.SpatialIndex`. |
| `src/js/modules/radar/quadrant-cache.js` | ES module: `import { DOMCache }` из dom-utils; экспорт getQuadrantGroup, clearQuadrantGroupsCache; `window.QuadrantCache`. |
| `src/js/modules/radar/positioning.js` | ES module: `import Logger`; убран IIFE; экспорт Positioning (все функции позиционирования и кеша); `window.Positioning`. |
| `src/js/modules/radar/quadrants.js` | ES module: убран IIFE; экспорт Quadrants (getTechStatus, getQuadrantName, getTechnologiesForQuadrant, zoomQuadrant, unzoom); `window.Quadrants`. |
| `src/js/modules/radar/radar-renderer.js` | ES module: `import Logger`; убран IIFE; экспорт RadarRenderer; `window.RadarRenderer`. |
| `src/js/modules/radar/radar-wrappers.js` | ES module: `import RadarRenderer`, `import QuadrantCache`, `import { DOMProxy }`; убран IIFE; экспорт RadarWrappers; `window.RadarWrappers`, window.renderRadar и др. |
| `src/js/modules/radar/radar-update.js` | ES module: `import { DOMCache }`; убран IIFE; экспорт RadarUpdate (updateRadar, updateRadarInternal); `window.RadarUpdate`, window.updateRadar. |
| `src/js/modules/radar/radar-events.js` | ES module: `import { DOMCache }`, `import Logger`; убран IIFE и getDependency; экспорт initRadarEvents, attachBlipHoverHandlers; `window.initRadarEvents`, `window.attachBlipHoverHandlers`. |
| `src/main.js` | Добавлены импорты: positioning, quadrant-cache, quadrants, radar-renderer, radar-wrappers, radar-update, spatial-index, radar-events; из loadAllModules удалены эти восемь радарных модулей. |

**24.02.2026 — шаг 7.4 (группа Business, четвёртая группа)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/business/export-fields-config.js` | ES module: убран IIFE; экспорт констант и ExportFieldsConfig; `window.ExportFieldsConfig`. |
| `src/js/modules/business/export-filters.js` | ES module: убран IIFE; экспорт applyFiltersToTechnologies и ExportFilters; `window.ExportFilters`, `window.applyFiltersToTechnologies`. |
| `src/js/modules/business/export-pdf.js` | ES module: `import { EXPORT_COLUMN_ORDER }` из export-fields-config; убран IIFE; экспорт generatePdf (ExportPdf); `window.ExportPdf`. |
| `src/js/modules/business/export.js` | ES module: `import Logger`, ExportFieldsConfig, applyFiltersToTechnologies, generatePdf; убран IIFE; экспорт ExportModule; `window.ExportModule`. |
| `src/js/modules/business/auth.js` | ES module: убран IIFE; экспорт AuthModule и именованные экспорты; `window.AuthModule`, `window.checkArchitectRole`, `window.checkDirectorRole`, `window.renderAuth`, `window.safeLogout`, `window.clearAuthFromStorage`. |
| `src/js/modules/business/priorities.js` | ES module: `import Logger`; убран IIFE; экспорт Priorities и именованные экспорты; `window.Priorities`, window.computePriority и др. |
| `src/main.js` | Добавлены импорты: export-fields-config, export-filters, export-pdf, export, auth, priorities; из loadAllModules удалены эти шесть business-модулей. |

**24.02.2026 — шаг 7.4 (группа Analytics, пятая группа)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/analytics/model-analytics.js` | ES module: убран IIFE; экспорт ModelAnalytics и именованные экспорты; `window.ModelAnalytics`. Использует window.Positioning, window.polarToCartesian, window.RadarModelConfig. |
| `src/js/modules/analytics/weight-optimizer.js` | ES module: убран IIFE; экспорт WeightOptimizer и именованные экспорты; `window.WeightOptimizer`. |
| `src/js/modules/analytics/missing-data-predictor.js` | ES module: `import Logger`; убран IIFE; window.Logger заменён на Logger; экспорт MissingDataPredictor; `window.MissingDataPredictor`. |
| `src/js/modules/analytics/temporal-dynamics.js` | ES module: убран IIFE; экспорт TemporalDynamics и именованные экспорты; `window.TemporalDynamics`. |
| `src/js/modules/analytics/adaptive-calibration.js` | ES module: убран IIFE; экспорт AdaptiveCalibration и именованные экспорты; `window.AdaptiveCalibration`. Использует window.RadarModelConfig. |
| `src/main.js` | Добавлены импорты: model-analytics, weight-optimizer, missing-data-predictor, temporal-dynamics, adaptive-calibration; из loadAllModules удалены эти пять analytics-модулей. |

**24.02.2026 — шаг 7.4 (группа Integration, шестая группа)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/integration/events.js` | ES module: `import { DOMCache }` из dom-utils.js; убран IIFE; getDependency возвращает DOMCache по имени и window для EventManager; убрана автозапуск по DOMContentLoaded; экспорт initEventHandlers, initSearchHandler, Utils; `window.initEventHandlers`, `window.initSearchHandler`, `window.Utils`, window.isRatingFilled и др. |
| `src/js/modules/core/app-init.js` | В начале initApp() добавлен вызов window.initEventHandlers() и отложенная инициализация initSearchHandler (повтор через 500 мс при необходимости). |
| `src/main.js` | Добавлен импорт: integration/events.js; из loadAllModules удалён путь к events.js. |

**24.02.2026 — шаг 7.5 (удаление loadModule и старых скриптов)**

| Файл | Изменение |
|------|-----------|
| `src/main.js` | Удалены функции `loadModule` и `loadAllModules`. Добавлены статические импорты: audit-logger, script, radar-utils, core-utils, api-config, api-client, data-indexing, func-cover-utils, form-field-options, app-init (default import AppInit). В `bootstrap()` вызывается `AppInit.initApp().catch(...)`. |
| `src/js/audit-logger.js` | ES module: убран IIFE; экспорт в window (AuditLogger, getAuditTimestamp, appendAdminAudit); в конце вызов migrateLogsIfNeeded(); `export {}`. |
| `src/js/script.js` | ES module: убран IIFE; оставлен side-effect код (Tooltip, инициализация); в конце `export {}`. |
| `src/js/radar-utils.js` | ES module: добавлен `export {}` в конец; экспорт в window без изменений. |
| `src/js/modules/core/core-utils.js` | ES module: убран IIFE; экспорт в window (ErrorHandler, EventManager, Memoization, ModuleLoader, RenderQueue); `export {}`. |
| `src/js/config/api-config.js` | ES module: убран IIFE; экспорт в window.ApiConfig; `export {}`. |
| `src/js/modules/core/api-client.js` | ES module: убран IIFE; экспорт в window.ApiClient; `export {}`. |
| `src/js/modules/core/data-indexing.js` | ES module: убран IIFE; экспорт в window (DataIndex, TechIndex, rebuildTechnologiesIndex, getTechById); `export {}`. |
| `src/js/modules/utils/func-cover-utils.js` | ES module: убран IIFE (function(window)); экспорт в window.FuncCoverUtils; `export {}`. |
| `src/js/config/form-field-options.js` | ES module: убран IIFE; экспорт в window.FormFieldOptions; `export {}`. |
| `src/js/modules/core/app-init.js` | ES module: убран IIFE; убрана автозапуск по DOMContentLoaded; экспорт `initApp` и `default AppInit`; присвоение `window.AppInit`; инициализация вызывается из main.js в bootstrap(). |
| `src/js/RMK-director.js` | В начало добавлен комментарий: DEPRECATED (шаг 7.5); точка входа перенесена в src/main.js; файл оставлен для справки. |
| `src/pages/radar.html` | Без изменений: один `<script type="module" src="/src/main.js">` и внешние библиотеки (jspdf, jspdf-autotable, html2canvas) — как и до шага 7.5. |

**24.02.2026 — шаг 7.6 (настройка конфига для статики и JSON)**

| Файл | Изменение |
|------|-----------|
| `vite.config.js` | Добавлены импорты `path` и `fs` из `node:path` и `node:fs`. В `resolve.alias` добавлен алиас `@data` → `./src/data`. В `assetsInclude` добавлен явный паттерн `src/data/ru/**/*.json`. В `server` добавлен закомментированный пример `server.proxy` для будущего API (`/api` → `http://localhost:8000`). Добавлен плагин `copy-data`: в хуке `closeBundle` рекурсивно копируется `src/data` в `dist/src/data` для корректной загрузки JSON через fetch в production. |

**25.02.2026 — этап 8, шаг 8.1 (страница проверки кода 2FA)**

| Файл | Изменение |
|------|-----------|
| `src/pages/auth-2fa-verify.html` | Создан: страница по образцу auth.html с формой 6-значного кода (input maxlength="6", pattern="[0-9]{6}", inputmode="numeric"), кнопками «Подтвердить» и «Отмена» (→ auth.html), переключателем темы. Подключены auth.css и auth-2fa-verify.js. |
| `src/js/auth-2fa-verify.js` | Создан: ES module для auth-2fa-verify.html — инициализация темы (как в auth.js), валидация кода (только цифры, ровно 6), ограничение ввода/вставки, показ ошибок. Заглушка submit до этапа 8.4. |
| `src/css/auth.css` | Добавлены стили: .btn-row (flex для кнопок), .btn--secondary, .error-msg, .sr-only. |

**25.02.2026 — этап 8, шаг 8.2 (страница настройки 2FA)**

| Файл | Изменение |
|------|-----------|
| `src/pages/auth-2fa-setup.html` | Создан: страница с заглушкой QR-кода (div 160×160 с пунктирной рамкой, иконкой, текстом), полем manual secret (readonly), инструкцией из 4 шагов, кнопками «Завершить настройку» и «Отмена». Подключены auth.css и auth-2fa-setup.js. |
| `src/js/auth-2fa-setup.js` | Создан: ES module — инициализация темы, заглушка кнопки (до этапа 8.4). |
| `src/css/auth.css` | Добавлены стили: .card--wide, .setup-2fa, .qr-placeholder, .setup-2fa__instructions и связанные. |

**25.02.2026 — этап 8, шаг 8.3 (интеграция 2FA в auth.js)**

| Файл | Изменение |
|------|-----------|
| `src/js/auth.js` | После успешного логина добавлена проверка заглушки `mockResponse.requires_2fa` (true для admin). При 2FA: сохранение в sessionStorage `auth2faPending` (username, role, token), редирект на auth-2fa-verify.html. isLoggedIn не ставится до прохождения 2FA. |

**25.02.2026 — этап 8, шаг 8.4 (заглушки API 2FA)**

| Файл | Изменение |
|------|-----------|
| `src/js/auth-2fa.js` | Создан: ES module с verify2FACode (mock: 123456 → успех, localStorage + редирект), setup2FA (mock QR SVG + secret), getAuth2faPending, confirm2FASetup. |
| `src/js/auth-2fa-verify.js` | Импорт verify2FACode, getAuth2faPending. При загрузке без auth2faPending — редирект на auth.html. Submit вызывает verify2FACode, при успехе — index.html. |
| `src/pages/auth-2fa-setup.html` | Добавлено поле кода подтверждения (codeConfirmGroup, setupCode). |
| `src/js/auth-2fa-setup.js` | Импорт setup2FA, confirm2FASetup. При загрузке — setup2FA(), отображение QR (img) и secret. Кнопка вызывает confirm2FASetup(code), при успехе — index.html. |

**25.02.2026 — этап 8, шаг 8.5 (генерация сканируемого QR-кода)**

| Файл | Изменение |
|------|-----------|
| `package.json` | Добавлены зависимости: qrcode ^1.5.4, otplib ^13.3.0. |
| `src/js/auth-2fa.js` | Импорт QRCode, verify из otplib. setup2FA: генерация QR через QRCode.toDataURL(otpauth) с base32 secret JBSWY3DPEHPK3PXP. confirm2FASetup: при secret — проверка кода через otplib.verify (TOTP). |
| `src/js/auth-2fa-setup.js` | Сохранение currentSecret при загрузке, передача в confirm2FASetup. Размер img QR — 200×200. |
| `src/css/auth.css` | .qr-placeholder: 200×200. |

**25.02.2026 — этап 9 завершён, state-utils через DataService**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/core/state-utils.js` | Подписка на `technologies`: вместо vfsWrite/DataLoader.vfsWrite используется DataService.saveTechnologies (поддержка mock и API режимов). |
| `docs/FRONTEND_FINAL_PLAN.md` | Этап 9 отмечен как завершён; добавлен блок «Выполнено (этап 9)»; обновлена сводка по этапам; версия 1.3. |

**25.02.2026 — этап 9.5 завершён, ограничение блоков в формах по привязке**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/ui/filters.js` | updateModalBlocksForEnterprises: при выборе предприятий (techCompany/editCompany) ограничивает список блоков по getBlocksForEnterprisesFromMapping; при отсутствии привязки — все блоки. |
| `docs/FRONTEND_FINAL_PLAN.md` | Этап 9.5 отмечен как завершён; добавлены статусы шагов 9.5.1–9.5.6; добавлен блок «Выполнено (этап 9.5)»; версия 1.4. |

**25.02.2026 — этап 10, шаг 10.1 (локальная конфигурация API)**

| Файл | Изменение |
|------|-----------|
| `src/js/config/api-config.local.example.js` | Создан: пример локального конфига с API_BASE_URL, USE_API, комментариями и инструкцией. |
| `.gitignore` | Добавлен `src/js/config/api-config.local.js` — локальный конфиг не попадает в git. |
| `src/js/config/api-config-loader.js` | Создан: опционально загружает api-config.local.js (try/catch), затем api-config.js. |
| `src/main.js` | Импорт api-config заменён на api-config-loader. |
| `scripts/ensure-api-config-local.js` | Создан: перед build копирует example в api-config.local.js при отсутствии файла. |
| `package.json` | Скрипт build: добавлен prebuild `node scripts/ensure-api-config-local.js &&`. |
| `docs/FRONTEND_FINAL_PLAN.md` | Добавлен блок «Выполнено (этап 10, шаг 10.1)», статус шага 10.1; версия 1.5. |

**25.02.2026 — этап 10, шаг 10.2 (реализация api-client)**

| Файл | Изменение |
|------|-----------|
| `src/js/modules/core/api-client.js` | Полная реализация: request (buildUrl, Authorization: Bearer из localStorage/sessionStorage, AbortController+timeout, JSON/FormData), tryRefreshToken (POST /api/v1/auth/refresh), redirectToAuth при 401, normalizeResponse для ошибок, хелперы get/post/put/patch/delete. |
| `docs/FRONTEND_FINAL_PLAN.md` | Добавлен статус шага 10.2, блок «Выполнено (этап 10, шаги 10.1–10.2)». |

**25.02.2026 — этап 10, шаг 10.3 (mock API для тестов)**

| Файл | Изменение |
|------|-----------|
| `package.json` | Добавлена зависимость msw (dev). |
| `src/test/mocks/handlers.js` | Создан: handlers для GET/POST/PATCH/PUT/DELETE /api/v1/technologies, GET/PUT /api/v1/references/:name, данные из src/data/ru/*.json. |
| `src/test/mocks/server.js` | Создан: setupServer из msw/node. |
| `vitest.setup.js` | Добавлены beforeAll/afterEach/afterAll для server.listen/resetHandlers/close; удалён глобальный mock fetch. |
| `src/js/modules/core/__tests__/data-service-api.test.js` | Создан: 7 тестов DataService в API-режиме (loadReference, loadTechnologies, createTech, updateTech, deleteTech). |
| `src/js/modules/core/__tests__/setup-api-mode.js` | Создан: установка API_BASE_URL и USE_API до загрузки api-config. |
| `docs/FRONTEND_FINAL_PLAN.md` | Добавлен статус шага 10.3, блок «Выполнено (этап 10, шаги 10.1–10.3)». |

**26.02.2026 — этап 10, шаг 10.5 (Smoke/E2E тесты)**

| Файл | Изменение |
|------|-----------|
| `package.json` | Добавлены @playwright/test, скрипты test:e2e, test:e2e:ui. |
| `playwright.config.js` | Создан: baseURL 5173, webServer (npm run dev), chromium. |
| `e2e/auth.spec.js` | Создан: логин architect→index, ошибка пароля. |
| `e2e/radar.spec.js` | Создан: загрузка techRadar, видимость addTechBtn. |
| `e2e/add-technology.spec.js` | Создан: открытие addTechPanel, заполнение формы, сохранение. |
| `.github/workflows/e2e.yml` | Создан: CI на push/PR (main, master, develop). |
| `docs/FRONTEND_FINAL_PLAN.md` | Статус шага 10.5, версия 1.6. |

**26.02.2026 — этап 10, шаг 10.6 (Документация)**

| Файл | Изменение |
|------|-----------|
| `docs/API_INTEGRATION.md` | Создан: порядок включения API (api-config.local.js, API_BASE_URL, USE_API), авторизация и токены, refresh endpoint, обработка ошибок, форматы запросов/ответов для technologies и references, маппинг (ссылка на API_FORMAT_MAPPING.md), CORS и proxy. |
| `docs/FRONTEND_FINAL_PLAN.md` | Этап 10 полностью завершён; статус шага 10.6; версия 1.7. |

**26.02.2026 — этап 12, шаг 12.1 (Регрессионная проверка, 2FA для всех ролей)**

| Файл | Изменение |
|------|-----------|
| `src/js/auth.js` | `requires_2fa: true` для всех ролей (ранее — только для admin). Любой успешный вход направляет на 2FA (настройка или проверка кода). |
| `docs/FRONTEND_FINAL_PLAN.md` | Шаг 12.1 отмечен как выполненный; добавлен блок «Выполнено (этап 12, шаг 12.1)»; статус этапа 12 обновлён; версия 1.8. |

**26.02.2026 — этап 12, шаг 12.2 (Обновление документации)**

| Файл | Изменение |
|------|-----------|
| `README.md` | Добавлены: 2FA в описание авторизации; команды test/test:e2e; ссылка на API_INTEGRATION.md; инструкция по api-config.local.js; страницы auth-2fa-*.html в структуру; версия РТП-3, дата 26.02.2026. |
| `docs/PLAN_TASKS_2026.md` | Добавлена таблица статусов выполнения задач 1–6; версия 1.2; ссылки на FRONTEND_FINAL_PLAN и FRONTEND_COMPLETION_SUMMARY. |
| `docs/FRONTEND_COMPLETION_SUMMARY.md` | Создан: сводка выполненных этапов (7, 8, 9, 9.5, 10, 12.1), ключевые файлы, команды, готовность к backend. |
| `docs/FRONTEND_FINAL_PLAN.md` | Шаг 12.2 отмечен как выполненный; версия 1.9. |

**26.02.2026 — этап 12, шаг 12.3 (Code review и финальные правки)**

| Файл | Изменение |
|------|-----------|
| `scripts/ensure-api-config-local.js` | Удалён; создан ensure-api-config-local.mjs для устранения предупреждения Node MODULE_TYPELESS_PACKAGE_JSON. |
| `package.json` | build: вызов ensure-api-config-local.mjs вместо .js. |
| `docs/FRONTEND_FINAL_PLAN.md` | Шаг 12.3 отмечен как выполненный; версия 2.0. |

**26.02.2026 — этап 12, шаг 12.4 (Подготовка к интеграции с backend)**

| Файл | Изменение |
|------|-----------|
| `docs/API_INTEGRATION.md` | Добавлена секция 5.1 «Аутентификация»: endpoints login, refresh, logout, 2fa/setup, 2fa/verify с форматами запросов/ответов. |
| `docs/BACKEND_API_REQUIREMENTS.md` | Создан: чек-лист обязательных endpoints, форматы, CORS, ссылки на API_INTEGRATION и API_FORMAT_MAPPING. |
| `docs/FRONTEND_FINAL_PLAN.md` | Шаг 12.4 отмечен как выполненный; этап 12 полностью завершён; версия 2.1. |

---

## Примечания

- Этап 9.5 (привязка предприятий к функциональным блокам) выполняется после этапа 9, чтобы использовать DataService и единый контракт данных для mock и API.
- Этап 11 (отрицательные факторы) может быть выполнен после подключения backend, если требуется согласование с архитекторами
- После завершения этапов 7–12 можно переходить к разработке backend API
- Все изменения должны проходить регрессионную проверку перед merge в main
- Рекомендуется создавать отдельные ветки для каждого этапа
