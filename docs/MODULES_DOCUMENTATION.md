# Документация модулей проекта РТП-2.3 (`src/js/modules/`)

Обновлено: **2026‑02‑16**
Цель документа: дать максимально подробное описание каждого файла в `src/js/modules/`, его API, зависимостей и роли в приложении.

## Содержание

- [Архитектурные принципы](#архитектурные-принципы)
- [Порядок загрузки модулей (radar.html)](#порядок-загрузки-модулей-radarhtml)
- [Соглашения и общие понятия](#соглашения-и-общие-понятия)
  - [Состояние (StateManager)](#состояние-statemanager)
  - [DOM доступ (DOMCache и DOMProxy)](#dom-доступ-domcache-и-domproxy)
  - [События (EventManager, events.js)](#события-eventmanager-eventsjs)
  - [Роли и системные учётки](#роли-и-системные-учётки)
  - [Нотификации и ошибки](#нотификации-и-ошибки)
- [Core](#core)
  - [`core/logger.js`](#coreloggerjs)
  - [`core/dom-utils.js`](#coredom-utilsjs)
  - [`core/core-utils.js`](#corecore-utilsjs)
  - [`core/error-handler.js`](#coreerror-handlerjs)
  - [`config/api-config.js`](#configapi-configjs)
  - [`core/state-manager.js`](#corestate-managerjs)
  - [`core/api-client.js`](#coreapi-clientjs)
  - [`core/data-source.js`](#coredata-sourcejs)
  - [`core/data-normalize.js`](#coredata-normalizejs)
  - [`core/data-loader.js`](#coredata-loaderjs)
  - [`core/state-utils.js`](#corestate-utilsjs)
  - [`core/data-indexing.js`](#coredata-indexingjs)
  - [`core/app-init.js`](#coreapp-initjs)
  - [`config/roles-config.js`](#configroles-configjs)
- [Utils](#utils)
  - [`utils/func-cover-utils.js`](#utilsfunc-cover-utilsjs)
- [Radar](#radar)
  - [`radar/positioning.js`](#radarpositioningjs)
  - [`radar/spatial-index.js`](#radarspatial-indexjs)
  - [`radar/radar-renderer.js`](#radarradar-rendererjs)
  - [`radar/quadrant-cache.js`](#radarquadrant-cachejs)
  - [`radar/quadrants.js`](#radarquadrantsjs)
  - [`radar/radar-wrappers.js`](#radarradar-wrappersjs)
  - [`radar/radar-update.js`](#radarradar-updatejs)
  - [`radar/radar-events.js`](#radarradar-eventsjs)
  - [`radar/prospects-chart.js`](#radarprospects-chartjs)
- [UI](#ui)
  - [`ui/common-ui.js`](#uicommon-uijs)
  - [`ui/filters.js`](#uifiltersjs)
  - [`ui/filter-init.js`](#uifilter-initjs)
  - [`ui/select-events.js`](#uiselect-eventsjs)
  - [`ui/modals.js`](#uimodalsjs)
  - [`ui/forms.js`](#uiformsjs)
  - [`ui/form-management.js`](#uiform-managementjs)
  - [`ui/modal-forms.js`](#uimodal-formsjs)
  - [`ui/sidebar.js`](#uisidebarjs)
  - [`ui/detail-panel.js`](#uidetail-paneljs)
  - [`ui/report-status.js`](#uireport-statusjs)
  - [`ui/tooltips.js`](#uitooltipsjs)
  - [`ui/toast.js`](#uitoastjs)
  - [`ui/notifications.js`](#uinotificationsjs)
  - [`ui/skeleton.js`](#uiskeletonjs)
  - [`ui/loading.js`](#uiloadingjs)
  - [`ui/error-display.js`](#uierror-displayjs)
  - [`ui/focus-trap.js`](#uifocus-trapjs)
  - [`ui/vendors-files.js`](#uivendors-filesjs)
  - [`ui/mobile-nav.js`](#uimobile-navjs)
  - [`ui/touch-handlers.js`](#uitouch-handlersjs)
  - [`ui/keyboard-nav.js`](#uikeyboard-navjs)
  - [`ui/aria-manager.js`](#uiaria-managerjs)
  - [`ui/onboarding.js`](#uionboardingjs)
  - [`ui/contextual-hints.js`](#uicontextual-hintsjs)
  - [`ui/offline-handler.js`](#uioffline-handlerjs)
- [Business](#business)
  - [`business/auth.js`](#businessauthjs)
  - [`business/priorities.js`](#businessprioritiesjs)
  - [`business/export-fields-config.js`](#businessexport-fields-configjs)
  - [`business/export-filters.js`](#businessexport-filtersjs)
  - [`business/export-pdf.js`](#businessexport-pdfjs)
  - [`business/export.js`](#businessexportjs)
- [Analytics](#analytics)
  - [Модули аналитики модели](#модули-аналитики-модели)
- [Integration](#integration)
  - [`integration/events.js`](#integrationeventsjs)

## Архитектурные принципы

1. **Модули — это IIFE + экспорт в `window`.**
   Практически все файлы оборачиваются в `(function(){ ... })()` и публикуют API через `window.*`. Это даёт обратную совместимость со «старым» кодом (например, `RMK-director.js` или inline‑вызовами).

2. **Никакой сборки/импорта.**
   Нет `import`/`export` (ESM). Зависимости — через проверку наличия `window.X` (ленивые `getDependency()`).

3. **Единый источник правды — `StateManager`.**
   Данные и состояние UI хранятся в `StateManager` (и часто дублируются в `window.*` для совместимости).

4. **UI реагирует на изменения через подписки и события.**
   `state-utils.js` подписывает UI на изменения ключей состояния, `integration/events.js` связывает клики/ввод/зум с изменением состояния и перерисовкой.

## Порядок загрузки модулей (radar.html)

Страница `src/pages/radar.html` подключает **только** `RMK-director.js`.
Дальше `RMK-director.js` загружает все модули последовательно (см. массив `modules` в `loadAllModules()`).

Высокоуровневый порядок загрузки:

- **base**: `audit-logger.js`, `script.js`, `radar-utils.js`
- **core**: `logger.js` → `dom-utils` → `core-utils` → `error-handler.js` → `config/api-config.js` → `state-manager` → `api-client.js` → `data-source` → `data-normalize` → `data-loader` → `state-utils` → `data-indexing`
- **ui (раньше)**: `detail-panel` (нужен до `radar-wrappers`)
- **utils**: `modules/utils/func-cover-utils.js` (учёт важности функций в funcCover)
- **radar**: `positioning` → `radar-renderer` → `quadrant-cache` → `quadrants` → `radar-wrappers` → `radar-update`
  - **Примечание:** `prospects-chart.js` **НЕ загружается** для страницы радара (radar.html)
- **ui (остальные)**: `filters` → `config/form-field-options.js` → `filter-init` → `focus-trap` → `modals` → `forms` → `sidebar` → `modal-forms` → `report-status` → `tooltips` → `notifications` → `form-management` → `vendors-files` → `loading` → `error-display` → `toast` → `skeleton` → `mobile-nav` → `touch-handlers` → `keyboard-nav` → `aria-manager` → `onboarding` → `contextual-hints` → `offline-handler`
- **business**: `export-fields-config` → `export-filters` → `export-pdf` → `export` → `auth` → `priorities`
- **analytics**: `model-analytics` → `weight-optimizer` → `missing-data-predictor` → `temporal-dynamics` → `adaptive-calibration`
- **radar (оптимизация)**: `radar/spatial-index.js`
- **split‑handlers**: `ui/select-events` → `radar/radar-events`
- **integration**: `integration/events`
- **init**: `core/app-init` (загружается последним)

## Соглашения и общие понятия

### Состояние (StateManager)

В разных местах используются типовые ключи `StateManager`:

- `technologies` — массив технологий (основной набор для радара)
- `technologiesById` — `Map<id, tech>` для O(1) доступа
- `enterpriseData` — данные предприятий/технологий из JSON
- `currentEnterprise` — выбранное предприятие (строка)
- `currentZoomedQuadrant` — зуммированный сектор (id или `null`)
- `selectedBlipId` — текущий выбранный blip (id технологии)
- `blocksList`, `functions`, `nameToBlockId`, `functionToBlockMap`, `blockToQuadrant` — справочники
- `quadrantsCache`, `quadrantsCacheVersion` — ускорение доступа к SVG‑структуре

**Доступ к данным:** Данные радара и справочники (technologies, enterpriseData, blocksList, functions, nameToBlockId, functionToBlockMap, currentEnterprise и т.д.) следует **читать только через StateAccessors или StateManager** (`getTechnologies()`, `getEnterpriseData()`, `getBlocksList()`, `getFunctions()` и т.д.). Обращение к `window.technologies`, `window.blocksList`, `window.functions` и т.п. считается **устаревшим** (оставлено только для обратной совместимости при постепенном переходе; после перевода всех потребителей на state дублирование в `window` будет убрано).

### DOM доступ (DOMCache и DOMProxy)

- `DOMCache.get(id)` — быстрый доступ по `id` с кешем и защитой от устаревших нод.
- `DOMCache.query(selector)` / `find(parent, selector)` — кешируемые выборки.
- `DOMProxy.createElementProxy(id)` — «безопасный» proxy для input/кнопок (возвращает заглушки вместо `null`).
- `DOMProxy.createDOMProxy(id)` — «безопасный» proxy для контейнеров/DOM‑узлов (используется для SVG).

### События (EventManager, events.js)

- `EventManager.on(selector, event, handler)` — делегирование событий на `document` + хранение handler‑ов.
- `integration/events.js` — центральная точка регистрации UI‑событий (тема/поиск/предприятия/панели).
- Часть логики вынесена в узкие модули:
  - `ui/select-events.js` — кастомные селекты
  - `radar/radar-events.js` — события на радаре (hover/click/zoom)

### Роли и системные учётки

**Роли и системные учётки задаются в `config/roles-config.js`; страница входа (`auth.js`) и админ-панель (раздел «Пользователи») только потребляют.** Модуль экспортирует `window.RolesConfig`: константы ролей, отображаемые названия, `getUsersForMockAuth()` для mock-входа, `getSystemAccountsForAdmin()` для шаблона таблицы пользователей по умолчанию. При переходе на API учётки будут приходить с бэкенда; конфиг остаётся источником перечисления ролей и меток.

### Нотификации и ошибки

**Показ ошибок пользователю и логирование — через `reportError`.**

- `core/error-handler.js` — единая точка входа:
  - `reportError(error, context, options?)` — логирует через `Logger` (если есть) и показывает пользователю через `ErrorDisplay` или `Toast`; `context` — строка или объект (например `'Загрузка данных'` или `{ action: 'loadData' }`); в `options` можно передать `{ retryCallback: fn }` для кнопки «Повторить» в ErrorDisplay, `showToUser: false` — только логирование.
  - `reportValidationErrors(fieldErrors)` — показ ошибок валидации форм (массив строк или `{ field, message }`).
- Остальные «каналы»:
  - `ui/toast.js` (`window.Toast`) — уведомления (используется из reportError при отсутствии ErrorDisplay).
  - `core/core-utils.js` (`ErrorHandler`) + `ui/error-display.js` (`ErrorDisplay`) — показ ошибок с повтором (вызываются из reportError при необходимости).
  - `ui/loading.js` (`LoadingManager`) — индикатор загрузки/прогресса.
  - `ui/report-status.js` (`ReportStatus`) — индикатор экспорта отчёта.

---

## Core

### `core/logger.js`

**Назначение:** обертка для логирования с проверкой окружения (dev/prod). Предотвращает вывод логов в production для улучшения производительности.

**Определение режима разработки:**
- Проверяет `hostname` (localhost, 127.0.0.1, *.local)
- Проверяет параметр `?dev=true` в URL
- Проверяет meta-тег `<meta name="app-mode" content="development">`
- По умолчанию считается production режим

**Экспорт в `window`:**
- `window.Logger`:
  - `log(...args)` — обертка для `console.log` (только в dev)
  - `error(...args)` — обертка для `console.error` (всегда)
  - `warn(...args)` — обертка для `console.warn` (только в dev)
  - `info(...args)` — обертка для `console.info` (только в dev)
  - `debug(...args)` — обертка для `console.debug` (только в dev)
  - `isDevMode()` — проверка режима разработки

**Ключевая идея:** автоматическое отключение избыточного логирования в production для улучшения производительности.

---

### `core/dom-utils.js`

**Назначение:** объединение `DOMCache` и `DOMProxy` в один файл для стабильного порядка загрузки и минимизации количества `<script>`.

**Экспорт в `window`:**

- `window.DOMCache`:
  - `get(id)` — поиск по `id` с кешем и проверкой `isConnected`
  - `query(selector)` — кешируемый `document.querySelector`
  - `queryAll(selector, context=document)`
  - `find(parent, selector)` / `findAll(parent, selector)`
  - `clear(key)`, `clearAll()`, `refresh(id|selector)`
- `window.DOMProxy`:
  - `createDOMGetter(id)` — геттер через `DOMCache`
  - `createDOMProxy(id)` — proxy для «контейнеров» (svg/detailPanel)
  - `createElementProxy(id)` — proxy для input/button и т.п.
- алиасы совместимости: `window.createDOMGetter`, `window.createDOMProxy`, `window.createElementProxy`

**Ключевая идея:** любые модули могут безопасно обращаться к DOM‑элементам даже если они временно отсутствуют/пересозданы.

---

### `core/core-utils.js`

**Назначение:** объединённый «инфраструктурный» файл: ошибки, события, мемоизация, загрузчик модулей, очередь рендера.

**Экспорт в `window`:**

- `window.ErrorHandler`:
  - `handle(error, context)` — лог + попытка `ErrorDisplay.show`
  - `setReporter(fn)` — «репортинг» ошибок (опционально)
  - `setNotifier(fn)` — UI‑уведомления (опционально)
  - `setRetryCallback(fn)` — callback для кнопки «Повторить» в `ErrorDisplay`
- `window.EventManager`:
  - `on(selector, event, handler)`
  - `off(selector, event, handler?)`
  - `clear()`
- `window.Memoization`:
  - `memoize(fn)`
  - `memoizeWithTTL(fn, ttlMs)`
  - `FilterCache` (`get/set/clear`)
- `window.ModuleLoader` + алиас `window.requireGlobalModule(name)`:
  - проверяет наличие `window[name]` и кидает ошибку с подсказкой пути
- `window.RenderQueue`:
  - `schedule(fn)` — батчинг через `requestAnimationFrame`
  - `flush()`, `clear()`

**Почему это важно:** `RenderQueue` и `EventManager` резко уменьшают «дребезг» DOM‑обновлений и количество обработчиков.

---

### `core/error-handler.js`

**Назначение:** единая точка входа для логирования и показа ошибок пользователю (см. [Нотификации и ошибки](#нотификации-и-ошибки)).

**Экспорт в `window`:**
- `reportError(error, context, options?)` — логирует через `Logger` (если есть) и при необходимости показывает пользователю через `ErrorDisplay` или `Toast`. Аргументы: `error` — объект Error или строка; `context` — строка или объект (например `{ action: 'loadData' }`); `options` — опционально `{ retryCallback: fn }` (для кнопки «Повторить» в ErrorDisplay), `showToUser: false` (только логирование).
- `reportValidationErrors(fieldErrors)` — массив строк или объектов `{ field, message }` для отображения ошибок валидации форм (Toast.warning).

**Зависимости (на момент вызова):** `Logger` (для лога), `ErrorDisplay` или `Toast` (для показа пользователю). Модуль загружается после `core-utils`, вызовы `reportError` происходят позже, когда UI-модули уже загружены.

---

### `core/state-manager.js`

**Назначение:** минималистичное хранилище состояния + подписки.

**Экспорт:** `window.StateManager` со стандартным API:

- `get(key)`
- `set(key, value)` — не уведомляет, если значение строго равно старому (`oldValue === value`)
- `subscribe(fn)` — глобальная подписка `(key, value, oldValue)`
- `subscribeToKey(key, fn)` — подписка на конкретный ключ `(value, oldValue, key)`
- `clear()`

**Особенности:**

- `safeCall` ловит ошибки подписчиков и не ломает приложение.

---

### `config/api-config.js`

**Назначение:** конфигурация API бэкенда (базовый URL, таймауты, ключи хранения токенов). Заглушка для этапа 6 рефакторинга; при подключении бэкенда используется в `api-client.js`. См. `BACKEND_READINESS_CRITICAL_CHANGES.md`.

**Экспорт в `window`:**
- `window.ApiConfig` — объект с методами: `getBaseUrl()`, `getDefaultTimeout()`, `getHeavyTimeout()`, `getTokenStorageKey()`, `getRefreshTokenStorageKey()`.

---

### `core/api-client.js`

**Назначение:** заглушка единой точки запросов к API (метод, путь, body, query, таймауты, подстановка Authorization, обработка 401). Пока не вызывается из data-loader; при подключении бэкенда здесь будет реализован fetch с токеном, refresh при 401 и редирект на auth.html.

**Экспорт в `window`:**
- `window.ApiClient` — объект с методами: `request(method, path, options)`, `get(path, query, options)`, `post(path, body, options)`, `put`, `patch`, `delete`.

---

### `config/form-field-options.js`

**Назначение:** единый конфиг опций для селектов форм (добавление/редактирование технологии, фильтры). Этап 7 рефакторинга: изменение надписей или добавление опции — в одном файле.

**Экспорт в `window`:**
- `window.FormFieldOptions` — объект: `TRL_OPTIONS`, `RATING_OPTIONS`, `STATUS_OPTIONS`, `TRL_TOOLTIPS`, `TECH_READ_TOOLTIPS`, `ORGAN_READ_TOOLTIPS`, `FUNC_COVER_TOOLTIPS`, `MODAL_FIELD_IDS` (id полей модальных форм).

**Используется в:** `ui/filter-init.js` (инициализация sidebar-фильтров и модальных селектов).

---

### `core/data-source.js`

**Назначение:** слой работы с данными — VFS (localStorage) и fetch‑загрузка JSON. Вынесено из data-loader (этап 2 рефакторинга).

**Экспорт в `window`:**
- `vfsRead(filename)`, `vfsWrite(filename, data)` — чтение/запись JSON в localStorage под ключом `vfs:<filename>`.
- `clearVfsCache()` — удаление всех ключей `vfs:*` из localStorage.
- `fetchJsonWithCache(url, {ttl, timeout})` — fetch с кешем в памяти (TTL 5 мин), дедупликация параллельных запросов.
- `clearFetchCache()` — очистка кеша fetch.
- `loadJsonPreferVfs(filename, forceReload?)` — загрузка JSON: сначала с диска (`/src/data/ru/`, `/src/data/`), затем из VFS.

---

### `core/data-normalize.js`

**Назначение:** нормализация технологий и справочников из сырых JSON. Вынесено из data-loader (этап 2 рефакторинга).

**Экспорт в `window`:**
- `buildBlockMaps(blocks)` — строит `blockIdToName`, `nameToBlockId`, `blocksList` из массива блоков.
- `normalizeTechnologyFromNewFormat(tech, blockIdToName, enterprisesData)` — преобразует технологию из формата JSON в формат приложения.
- `buildEnterpriseDataFromTechnologies(allTechnologies)` — строит объект company → technologies[].

---

### `core/data-loader.js`

**Назначение:** оркестрация загрузки данных — вызывает data-source, data-normalize, filter-init, записывает в StateManager. VFS и fetch — в `data-source.js`, нормализация — в `data-normalize.js`.

**Подсистемы (делегирование):**

1. **VFS и fetch** — см. `core/data-source.js`.
2. **Нормализация** — см. `core/data-normalize.js`.
3. **Инициализация фильтров** — см. `ui/filter-init.js`.
4. **Интеграция с UI**
   `showNotification(message, isSuccess)`:
   - предпочтительно использует `window.Toast`,
   - fallback — legacy‑панель уведомлений.

**Типовые зависимости (через `window.*`):**

- `StateManager`, `DOMCache`, `EventManager`, `Filters`, `Positioning`, `DataIndex`, `Toast`, `LoadingManager`

**Экспорт:** `window.DataLoader` (включая, как минимум):

- `loadData()` — основной вход
- `switchEnterprise(enterpriseName)` — переключение предприятия
- `fetchJsonWithCache`, `clearFetchCache`
- `vfsRead`, `vfsWrite`
- `loadJsonPreferVfs`
- вспомогательные функции добавления/сохранения новых технологий (используются формами)

**Побочные эффекты:**

- синхронизирует ряд ключей в `window.*` для обратной совместимости (`technologies`, `enterpriseData`, `blockToQuadrant`, …).

---

### `core/state-utils.js`

**Назначение:** слой удобных геттеров/сеттеров и подписок на изменения состояния.

**Экспорт:**

- `window.StateAccessors`:
  - `getTechnologies/setTechnologies`
  - `getEnterpriseData/setEnterpriseData`
  - `getCurrentEnterprise/setCurrentEnterprise`
  - `getCurrentZoomedQuadrant/setCurrentZoomedQuadrant`
  - `getSelectedBlipId/setSelectedBlipId`
  - `getCurrentTech/setCurrentTech`
  - `getBlocksList/setBlocksList`
  - `getFunctions/setFunctions`
  - `getNameToBlockId/setNameToBlockId`
  - `getFunctionToBlockMap/setFunctionToBlockMap`
  - `getBlockToQuadrant/setBlockToQuadrant`
  - `getTechnologiesById`
  - `getQuadrantsCache/getQuadrantsCacheVersion/setQuadrantsCacheVersion`
- `window.StateSubscriptions`:
  - `initStateSubscriptions()`

**Что делает `initStateSubscriptions()`:**

- синхронизирует ключевые значения в `window.*`;
- при изменении `technologies`:
  - вызывает `rebuildTechnologiesIndex()` (из `data-indexing.js`),
  - безопасно вызывает `updateRadar()` если модалки закрыты;
- при изменении `currentEnterprise` вызывает `updateRadar()`;
- при изменении `selectedBlipId` добавляет/убирает `.selected` на SVG‑blip.

---

### `core/data-indexing.js`

**Назначение:** быстрые индексы данных (по id/блоку/статусу/предприятию) + индекс технологий.

**Экспорт:**

- `window.DataIndex`:
  - `build(list)` — строит индексы
  - `getById(id)`
  - `getBy(predicate)`
  - `filter(fn)`
  - `byBlock(key)`, `byStatus(key)`, `byCompany(key)`
- `window.TechIndex`:
  - `rebuildTechnologiesIndex()` — пересобирает `technologiesById` и вызывает `DataIndex.build`
  - `getTechById(id)` — O(1) чтение из `technologiesById`
- алиасы совместимости:
  - `window.rebuildTechnologiesIndex`
  - `window.getTechById`

**Зависимости:** `StateAccessors`, `StateManager`.

---

### `core/app-init.js`

**Назначение:** «оркестратор» запуска RMK‑страницы (последний модуль в цепочке).

**Основной вход:** `initApp()` (внутренний), запускается после загрузки данных.

**Что делает по шагам:**

- инициализация темы по `localStorage.theme` (основной обработчик смены темы — в `integration/events.js`);
- `DataLoader.loadData()` → подготовка `RINGS/QUADRANTS/levelToRing`;
- чтение `localStorage.selectedEnterprise` и вызов `DataLoader.switchEnterprise`;
- вызывает `window.renderAuth()` если функция существует;
- вызывает первый `window.renderRadar()` (не через RAF);
- назначает `window.positionOptions` из `SelectPositioning.positionOptions`;
- инициализирует формы/кнопки/обработчики (удаление, «назад» в деталях, отчёты, помощь);
- включает `MobileNav`, `TouchHandlers`, `KeyboardNav`, `AriaManager`, `OnboardingTour`.

**Примечание:** `ContextualHints` в этом файле отмечен как отключенный (закомментированная инициализация), хотя модуль и CSS существуют.

---

### `config/roles-config.js`

**Назначение:** конфигурация ролей приложения и системных учёток. Источник перечисления ролей и меток; при переходе на API учётки будут с бэкенда.

**Экспорт в `window`:**
- `window.RolesConfig` — константы ролей, отображаемые названия, `getUsersForMockAuth()`, `getSystemAccountsForAdmin()`.

**Где используется:** страница входа (`auth.js`), админ‑панель (раздел «Пользователи»), модуль `business/auth.js`.

---

## Utils

### `utils/func-cover-utils.js`

**Назначение:** утилиты расчёта покрытия функций (funcCover) с учётом важности функций. Используется при позиционировании и аналитике.

**Где загружается:** `radar.html` (через RMK-director.js до radar-модулей), `admin.html`, `index.html`.

**Экспорт в `window`:** функции/объекты для расчёта покрытия (точный API — в файле).

---

## Radar

### `radar/positioning.js`

**Назначение:** вычисление координат blip’ов (детерминированно по `id`), соответствие блок→квадрант, разведение точек (anti-overlap).

**Входные данные (через `window.*`):**

- геометрия радара: `CENTER_X`, `CENTER_Y`, `RADIUS_STEP`, `POSITION_PAD`, `POSITION_ANGLE_PAD`, `MIN_BLIP_DISTANCE`
- кольца/квадранты: `RINGS`, `QUADRANTS`, `levelToRing`
- отображение блок→квадрант: `blockToQuadrant` (из JSON)
- утилиты: `polarToCartesian`, `cartesianToPolar` (из `radar-utils.js`)

**Ключевые функции:**

- `getQuadrantIdForBlock(blockKey)`
- `getQuadrantsForBlock(blockKey)` — возвращает все квадранты блока (поддержка массива)
- `getAllQuadrantsForTech(tech)` — учитывает `tech.blocks[]`
- `assignFixedPosition(tech)` / `assignFixedPositionForQuadrant(tech, qId)`
- `computeCoordinates(tech)` — пишет `tech.x/tech.y`
- `applyNonOverlappingLayout(renderData)` — разводит точки внутри группы `(quadrant, ring)`
- `avoidRingLabelOverlap(renderData)` — избегает подписи колец (использует `RING_LABEL_WIDTH/HEIGHT`)

**Экспорт:**

- `window.Positioning` + алиасы совместимости (в т.ч. `window.getQuadrantIdForBlock`, `window.getAllQuadrantsForTech` и др., если они экспортируются в конце файла).

---

### `radar/radar-renderer.js`

**Назначение:** отрисовка SVG радара: фон (сектора/кольца/подписи), легенда, создание blip‑ов.

**Особенности:**

- фон рисуется **один раз за сессию** (`radarBackgroundRendered`).
- подписи секторов рендерятся как `sector-label-group` + невидимый `sector-label-click-area` для клика.

**Ключевые функции:**

- `computeShapeByTechType(techType, TECHTYPE_TO_SHAPE)` — возвращает `"triangle"|"circle"|"square"|"star"|null`
- `renderRadarBackground(config)` — рисует кольца/сектора/подписи
- `renderLegend(config)` — легенда фигур
- `createBlip(tech, pos, quadrant, config)` — создаёт SVG‑элемент blip
- `renderRadar(technologies, config)` — основной рендер «точек»
- `resetRadarBackground()` — сбрасывает флаг фона

**DOM‑контракты:**

- основной SVG: `#techRadar`
- использует классы: `.quadrant-group`, `.ring-label`, `.ring-label-bg`, `.blip`, `.sector-label-group`, `.sector-label-click-area`

**Экспорт:** `window.RadarRenderer`.

---

### `radar/quadrant-cache.js`

**Назначение:** кеширование `.quadrant-group.q{N}` внутри `#techRadar`.

**Экспорт:**

- `window.QuadrantCache.getQuadrantGroup(quadrantId)`
- `window.QuadrantCache.clearQuadrantGroupsCache()`
- алиасы: `window.getQuadrantGroup`, `window.clearQuadrantGroupsCache`

---

### `radar/quadrants.js`

**Назначение:** логика квадрантов: получение технологий сектора, zoom/unzoom, синхронизация с фильтрами и панелью приоритетов.

**Ключевые функции:**

- `getTechStatus(tech)` — `status || level`
- `getQuadrantName(qId)`
- `getTechnologiesForQuadrant(qId)` — учитывает технологии с несколькими квадрантами (`getAllQuadrantsForTech`)
- `zoomQuadrant(qId, opts)`:
  - скрывает остальные `.quadrant-group` и включает `.zoomed-in` для нужного,
  - показывает подписи колец `#ringLabelsGroup` (не прячет),
  - на десктопе раскрывает `.sidebar-wrapper` и перемещает кнопку сброса,
  - вызывает `Filters.updateBlockFilterForZoomedQuadrant(qId)`,
  - открывает панель приоритетов (`openQuadrantPriorityPanel`) если не `source: 'blip'`.
- `unzoom()` — сброс (показ всех квадрантов), закрытие панели приоритетов, очистка `currentZoomedQuadrant`.

**DOM‑контракты:**

- `#resetIconBtn`, `#sidebarButtons`, `#resetButtonContainer`
- `#ringLabelsGroup`, `.legend`

**Экспорт:** `window.Quadrants` + алиасы `window.zoomQuadrant`, `window.unzoom`, `window.getTechnologiesForQuadrant`, `window.getQuadrantName`, `window.getTechStatus` (в зависимости от экспорта в конце файла).

---

### `radar/radar-wrappers.js`

**Назначение:** слой совместимости: предоставляет «старые» функции (`renderRadar`, `createBlip`, …), прокидывая реализацию в `RadarRenderer`.

**Причина существования:** в проекте есть код, который обращается к глобальным функциям напрямую (например, `RMK-director.js`, `events.js`, старые обработчики).

**Экспорт:**

- `window.RadarWrappers`
- алиасы:
  - `window.renderRadarBackground`
  - `window.renderLegend`
  - `window.renderRadar`
  - `window.createBlip` / `window.createBlipWrapper`
  - `window.computeShapeByTechType`

**Зависимости:** `RadarRenderer`, `StateAccessors`, `Positioning`, `QuadrantCache`, `Utils`, `DOMProxy`.

---

### `radar/radar-update.js`

**Назначение:** пересчёт отображаемого набора технологий по фильтрам и строке поиска и обновление UI.

**Вход:**

- фильтры: `Filters.getFilterValues('block'|'function'|'techType'|'level')`
- поиск: `#searchInput` через `DOMProxy.createElementProxy`
- данные: `DataIndex.filter(fn)` (фильтрация по массиву технологий)
- батчинг: `RenderQueue.schedule`

**Поведение:**

- сначала фильтрует по выбранным значениям,
- затем применяет текстовый поиск поверх фильтра (кэширует нормализованные строки в `Map` при наличии запроса),
- запускает `renderRadar(filtered)` и:
  - если фильтры активны — `updateSidebarLists(filtered)`,
  - иначе — очищает/закрывает списки в сайдбаре.
- если открыт `#quadrantPriorityPanel` и есть зум — пересчитывает список приоритетов.

**Экспорт:**

- `window.RadarUpdate.updateRadar`
- алиас: `window.updateRadar`

---

### `radar/radar-events.js`

**Назначение:** события, специфичные для SVG‑радара: hover/click по blip, клик по сектору/подписи сектора, синхронизация с панелью приоритетов.

**Основные функции:**

- `attachBlipHoverHandlers()`:
  - клонирует `.blip` (сброс слушателей) и навешивает `mouseenter/mouseleave/click`
  - показывает `#hoverLabel` с текстом `getHoverText(tech)`
  - при открытой панели приоритетов подсвечивает соответствующий элемент списка
- `initRadarEvents()`:
  - подключает обработчики клика по SVG (`#techRadar`)
  - различает клики по blip / подписи сектора / сектору

**DOM‑контракты:**

- `#techRadar`, `.blip`, `#hoverLabel`
- `#quadrantPriorityPanel`, `#qpList`, `.qp-item`
- `.sector-label-group`, `.sector-label-click-area`, `.quadrant-group`

**Экспорт (через `window`):**

- как минимум: `window.attachBlipHoverHandlers` и `window.initRadarEvents` (точный набор зависит от хвоста файла).

---

### `radar/spatial-index.js`

**Назначение:** пространственные индексы для оптимизации разведения blip'ов на радаре (снижение коллизий и перекрытий).

**Где загружается:** `radar.html` (через RMK-director.js после analytics, перед select-events).

**Экспорт в `window`:** API пространственного индекса (используется модулями positioning/radar-renderer при необходимости).

---

### `radar/prospects-chart.js`

**Назначение:** модуль «Перспективные» — модалка с графиком + таблицей + экспортом PDF.

**DOM‑контракты (ключевые):**

- кнопка открытия: `#toggleProspectsChartBtn` (не используется на radar.html, модуль не загружается для директорской страницы)
- модалка: `#prospectsModal`
- закрытие: `#closeProspectsBtn`
- SVG графика: `#prospectsChartSvg`
- экспорт: `#exportProspectsChartBtn`
- селект предприятий: `.prospects-company-select` + `.prospects-select-*`
- hidden input: `#prospectsSelectedCompany`

**Загрузка данных:**

- fetch `/src/data/ru/enterpriseData.json` (для построения набора предприятий и данных графика)

**Особенности:**

- поддержка выбора нескольких предприятий (чекбоксы + «Выбрать все»)
- детерминированные цвета по индексу предприятия (HSL)
- хранит «грязность» выбора, чтобы не перетирать выбор при смене enterprise‑nav

**Экспорт:**

- `window.ProspectsChart = { init: initProspectsChart }` (и/или аналогичный API)

---

## UI

### `ui/common-ui.js`

**Назначение:** общие UI-функции для страниц без RMK-director: инициализация темы (`initTheme`), общие обработчики. Используется на `index.html` и `admin.html`.

**Экспорт в `window`:**
- `window.CommonUI` — объект с методами `initTheme()` и др.

**Где загружается:** подключается напрямую в `index.html`, `admin.html` (не входит в цепочку RMK-director.js).

---

### `ui/filters.js`

**Назначение:** построение и управление sidebar‑фильтрами (custom select), чтение выбранных значений, синхронизация зависимых фильтров.

**Ключевые функции:**

- `getFilterValues(key)` — читает JSON из `#filter_<key>` или из `.selected`
- `populateSelect(filterKey, items, placeholderText)`:
  - создает поиск для `block`/`function`,
  - добавляет «Выбрать все»,
  - умеет фильтровать блоки по зуммированному квадранту,
  - умеет фильтровать функции по выбранным блокам (через `nameToBlockId`/`functionToBlockMap`).

**DOM‑контракты:**

- `.custom-select[data-filter="block|function|techType|level"]`
- `#filter_block`, `#filter_function`, `#filter_techType`, `#filter_level`

**Экспорт:**

- `window.Filters` (набор методов)
- алиасы: `window.getFilterValues` и другие helper‑функции (зависят от хвоста файла)

---

### `ui/filter-init.js`

**Назначение:** инициализация sidebar‑фильтров и модальных селектов. Вынесено из data-loader (этап 2 рефакторинга).

**Экспорт в `window`:**
- `initFiltersWithRetry(attempt?)` — заполняет sidebar‑фильтры и модальные селекты с повтором при неготовности DOM.
- `initModalSelectsWithDirections(directionsList, blocksList, functions, enterpriseListForModal, vendorsList)` — заполняет модальные селекты для форм добавления/редактирования.
- `initFilters()` — ручная инициализация (отладка, повторная инициализация).

**Зависимости:** `StateManager`, `Filters`.

---

### `ui/select-events.js`

**Назначение:** единая обработка событий для кастомных селектов (sidebar + модальные) — вынесена из `integration/events.js`.

**Почему выделено:** логика кликов/чекбоксов/label в мультиселектах сложная; вынесение уменьшает размер `events.js` и снижает риск регрессий.

**Основные обязанности:**

- открыть/закрыть `.custom-select` по клику на trigger;
- обработка выбора опций:
  - поддержка multi‑select с чекбоксами,
  - корректная работа кликов по `label/span/checkbox` (в файле явно отмечены исправления),
  - «Выбрать все» с правильной синхронизацией checked/indeterminate,
  - обновление hidden input и `data-value`,
  - вызов `renderMultiSelectTags`, `positionOptions`, `updateRadar`,
  - синхронизация зависимостей (`block` → обновить `function`).

**Экспорт:**

- `window.initSelectEvents` (функция инициализации обработчиков).

---

### `ui/modals.js`

**Назначение:** единое открытие/закрытие модалок и встроенное подтверждение.

**Ключевые функции:**

- `showModal(panelIdOrEl)`:
  - выставляет `display: block`, затем добавляет класс `.open`,
  - выставляет `ignoreOutsideClickUntil` (защита от мгновенного закрытия),
  - снимает `disabled/readOnly` с инпутов,
  - делает snapshot формы через `snapshotFormInitial` (если доступно),
  - поднимает `z-index` для `#editTechPanel` и `#deleteConfirmModal`,
  - при открытии `#addTechPanel` вызывает `initModalFilters()` (если есть).
- `hideModal(panelIdOrEl)`:
  - снимает `.open`, ждёт transitionend и прячет,
  - делает reset для add/edit форм, сбрасывает кастомные селекты, чистит контейнеры.
- `showInternalConfirm(message, onCloseConfirmed)`:
  - создаёт внутреннюю confirm‑панель `#internalConfirm`.

**Экспорт:**

- `window.Modals` + алиасы `window.showModal`, `window.hideModal`, `window.showInternalConfirm`.

---

### `ui/forms.js`

**Назначение:** утилиты форм и динамические поля оценок по предприятиям.

**Ключевые функции:**

- `isFormDirty(formEl)` — сравнение со snapshot
- `snapshotFormInitial(formEl)`
- `createCompanyRatingsFields(companies, containerId, prefix)` — динамическая генерация групп полей `techRead/organRead` для каждого предприятия при мультивыборе
- функции обновления видимости полей оценок (используются `modals.js` и `form-management.js`)

**Экспорт:**

- `window.FormsModule = { ... }`
- алиасы совместимости: `window.isFormDirty`, `window.snapshotFormInitial`, …

---

### `ui/form-management.js`

**Назначение:** объединённый файл: обработчики событий форм + обработчики сабмитов и CRUD‑операций (технологии/блоки/функции).

**Что внутри (крупно):**

- `initFormEvents()` — live‑логика форм:
  - live‑preview приоритета в форме редактирования (`editPriorityPreview`),
  - парсинг значений, сбор “candidate” технологии, вызов `Priorities.computePriority`.
- `initFormHandlers()` — обработчики submit:
  - добавление/редактирование технологии,
  - валидация обязательных полей,
  - интеграция с `DataLoader.ensureAndPersistNewTech`, `switchEnterprise`, `updateRadar`, `Toast`, `appendAdminAudit`.

**Сильная зависимость от DOM‑ID** (формы в `radar.html`):

- `addTechForm`, `editTechForm` и множество `tech*` / `edit*` полей (включая hidden поля кастомных селектов).

**Экспорт:**

- объект‑модуль (например `window.FormHandlers`) + алиасы:
  - `window.getFormFieldValue`
  - `window.handleAddTechFormSubmit`
  - `window.handleEditTechFormSubmit`
  - и т.п. (точный набор зависит от хвоста файла).

---

### `ui/modal-forms.js`

**Назначение:** динамическая фильтрация блоков и функций в модальных селектах в зависимости от выбранных «секторов/блоков».

**Ключевые функции:**

- `updateModalBlocksForSectors(sectorNames)`:
  - маппинг «имя сектора» → `quadrantId` через `window.QUADRANTS`,
  - фильтрация `blocksList` по `blockToQuadrant`,
  - пересборка `.custom-select-modal[data-field="techBlock"]`,
  - синхронизация выбранных значений,
  - вызывает `updateModalFunctionsForBlocks(...)`.
- `updateModalFunctionsForBlocks(blockNames, fieldId)`:
  - фильтрует функции по выбранным блокам,
  - пересобирает `.custom-select-modal[data-field="<fieldId>"]`.

**Экспорт:**

- `window.ModalForms` и/или алиасы `window.updateModalBlocksForSectors`, `window.updateModalFunctionsForBlocks`.

---

### `ui/sidebar.js`

**Назначение:** списки технологий в сайдбаре по секторам, синхронизация hover/click с SVG‑радаром.

**Ключевые функции:**

- `updateSidebarLists(filteredTechs)` — создать/обновить список для каждого квадранта
- `createTechListForSector(sectorItem, quadrantId, allTechnologies)` — строит `.tech-list` со строками `.tech-list-item[data-tech-id]`
- `updateTechListItems(quadrantId, matchedTechs)` — обновление списка без полного пересоздания

**DOM‑контракты:**

- `.sector-item[data-quadrant="..."]` (элементы сектора в сайдбаре)
- `.tech-list`, `.tech-list-item`
- `#techRadar` (поиск `.blip[data-id="..."]`)

**Экспорт:**

- `window.Sidebar` + алиасы `window.updateSidebarLists`, `window.createTechListForSector`, …

---

### `ui/detail-panel.js`

**Назначение:** панель детальной информации о технологии (справа) и логика выделения/зума/экшнов.

**Главная функция:** `showDetail(t, source='unknown', sourceQuadrant=null)`

**Что делает `showDetail`:**

- заполняет DOM‑поля `#panel*` (название, описание, блок, функция, тип, оценки, приоритет и т.д.);
- выделяет blip‑ы технологии на радаре:
  - `.selected`, `.highlighted`, анимации/пульсации;
- управляет зумом сектора (через `zoomQuadrant`) и панелью приоритетов;
- учитывает источник открытия:
  - из blip — скрывает панель приоритетов, чтобы не перекрывала детали;
  - из панели приоритетов — синхронизирует выделение.

**DOM‑контракты:**

- `#detailPanel`, `#closeDetailPanel`
- множество `#panel...` элементов
- `#techRadar`, `#quadrantPriorityPanel`

**Экспорт:**

- `window.DetailPanel` (если есть) и алиас `window.showDetail`
- часто также экспортируются функции для экспорта полей (`getFieldValue/getFieldLabel`) — используется `business/export.js`.

---

### `ui/report-status.js`

**Назначение:** модальный индикатор статуса генерации отчёта.

**DOM‑контракты (в radar.html):**

- модалка `#reportLoadingModal`
- элементы `#loadingSpinner`, `#loadingSuccess`, `#loadingError`, `#loadingText`, `#loadingErrorMessage`

**Функции:**

- `showReportLoading()`
- `showReportSuccess()` (автозакрытие через ~2с)
- `showReportError(message)` (автозакрытие через ~5с)

**Зависимости:** `showModal/hideModal` из `ui/modals.js`.

**Экспорт:** `window.ReportStatus` + алиасы `window.showReportLoading/showReportSuccess/showReportError`.

---

### `ui/tooltips.js`

**Назначение:** объединение tooltip и hover‑логики (2 подсистемы).

1. **Tooltip для обязательных полей**
   Вешается на `.required-star` и показывает `.tooltip-global`.

2. **Hover‑подсказки по технологии**
   `getHoverText(tech)`:
   - если не заполнены базовые оценки — предупреждает,
   - иначе считает приоритет (`computePriority`, `getPriorityCategory`, `getPriorityWeakLinkComment`) и формирует многострочную подсказку.
     `createDebouncedHover()` — меняет `#hoverLabel`.

**Экспорт:**

- `window.TooltipModule = { init }`
- `window.Hover = { getHoverText, createDebouncedHover }`
- алиасы `window.getHoverText`, `window.debouncedHover` (создаётся сразу)

---

### `ui/toast.js`

**Назначение:** очередь toast‑уведомлений.

**Особенности:**

- максимум 3 видимых уведомления (`maxVisible`)
- остальные — в очереди
- контейнер `#toastContainer` с `aria-live="polite"`

**API:**

- `Toast.show(message, type, duration?)`
- `Toast.success/error/warning/info`
- `Toast.hide(id)` (если экспортируется), внутренние `processQueue`, `showToast`, `hideToast`

**Экспорт:** `window.Toast`.

---

### `ui/skeleton.js`

**Назначение:** генерация skeleton‑заглушек для списков/панелей/графиков/таблиц.

**API:**

- фабрики: `createTechListSkeleton`, `createDetailPanelSkeleton`, `createChartSkeleton`, `createTableSkeleton`
- управление:
  - `show(contentEl, skeletonFactory)`
  - `hide(contentEl, useOriginal=false)`
  - `replace(contentEl, newContent)`

**Экспорт:** `window.Skeleton`.

---

### `ui/loading.js`

**Назначение:** глобальные индикаторы загрузки (spinner и progress).

**DOM‑контракт:**

- `#loadingContainer` — создаётся динамически
- внутри: `.loading-spinner-wrapper`, `.loading-progress-wrapper`

**API:**

- `LoadingManager.show(message, id?)`
- `LoadingManager.hide(id?)` (если id не передан — скрывает все)
- `LoadingManager.showProgress(current, total, message?, id?)`
- `LoadingManager.updateMessage(id, message)`

**Экспорт:** `window.LoadingManager`.

---

### `ui/error-display.js`

**Назначение:** UI‑отображение ошибок + retry.

**Типы ошибок:** `NetworkError`, `ValidationError`, `DataError`, `PermissionError`, `UnknownError` (определяется эвристикой по тексту).

**DOM‑контракт:**

- `#errorContainer` — создаётся динамически
- `.error-display` — карточки ошибок, авто‑скрытие (если без retry)

**API:**

- `ErrorDisplay.show(error, context?, retryCallback?)`
- `ErrorDisplay.showRetryable(error, retryCallback, context?)`
- `ErrorDisplay.hide(errorId)`
- `ErrorDisplay.hideAll()`

**Связь с `core-utils.js`:**

- `ErrorHandler.handle()` пытается вызвать `ErrorDisplay.show(...)` если модуль доступен.

---

### `ui/mobile-nav.js`

**Назначение:** бургер‑меню и мобильная навигация по предприятиям.

**DOM‑контракты:**

- вставляет `#burgerMenuBtn` внутрь `header .controls`
- создаёт `#mobileEnterpriseMenu` (контейнер меню)
- клонирует кнопки из `.enterprise-nav button` и вызывает оригинальный `btn.click()` при выборе
- добавляет actions (переключение темы, авторизация/выход и т.п.)

**API:**

- `MobileNav.init()`
- `MobileNav.handleResize()` (если реализовано)
- `MobileNav.openMenu()/closeMenu()` (если реализовано)

**Экспорт:** обычно `window.MobileNav = MobileNav`.

---

### `ui/touch-handlers.js`

**Назначение:** touch‑жесты (swipe/long press) на touch‑устройствах.

**Поведение:**

- определяет touch‑девайс через `ontouchstart`/`maxTouchPoints`;
- swipe для закрытия `.modal-panel` и `.detail-panel` (left/right);
- swipe для sidebar на мобильных (`.sidebar-wrapper`, `main-content`);
- swipe up для закрытия `#mobileEnterpriseMenu` через `MobileNav.closeMenu()`.

**Экспорт:** обычно `window.TouchHandlers = TouchHandlers`.

---

### `ui/keyboard-nav.js`

**Назначение:** keyboard shortcuts и улучшение доступности клавиатурой.

**Горячие клавиши:**

- `Esc` — закрыть верхнюю модалку/панель/меню
- `Ctrl+F` / `Cmd+F` — фокус на `#searchInput`
- `Ctrl+S` / `Cmd+S` — сабмит активной формы в открытой модалке (если валидна)

**Экспорт:** `window.KeyboardNav = { init, ... }`.

---

### `ui/aria-manager.js`

**Назначение:** проставление ARIA‑атрибутов и ролей для screen readers.

**Что делает:**

- добавляет `role="banner"` для header;
- проставляет `role/aria-label` для навигаций;
- обеспечивает `aria-label` для icon‑кнопок (берёт из `data-tooltip/title/text`);
- настраивает combobox‑подобные элементы (`.custom-select*`);
- улучшает формы (`aria-required`, `aria-invalid`, `aria-labelledby`);
- улучшает модалки (`role=dialog`, `aria-modal`, `aria-labelledby`);
- настраивает `aria-live` регионы и динамический контент (sidebar, и т.д.).

**Экспорт:** `window.AriaManager = { init, ... }`.

---

### `ui/onboarding.js`

**Назначение:** интерактивный тур по приложению.

**Хранилище прогресса:**

- `rmk_onboarding_completed`
- `rmk_onboarding_progress`
- `rmk_onboarding_version` (текущая `CURRENT_VERSION`)

**Структура:**

- `TOUR_STEPS[]` — шаги с `id/title/description/target/position` + `conditional/beforeShow/afterHide`
- шаги умеют:
  - открывать модалки (например `#prospectsModal`, `#exportPdfModal`, `#addTechPanel`),
  - подсвечивать элементы (классы `.onboarding-highlight*` поддержаны CSS в `common.css`).

**Экспорт:** `window.OnboardingTour = { init, startTour, ... }` (точный набор — в хвосте файла).

---

### `ui/contextual-hints.js`

**Назначение:** контекстные подсказки (не путать с onboarding‑туром). Обычно показываются «один раз» возле элементов интерфейса.

**Хранилище:**

- `rmk_contextual_hints` — список увиденных подсказок
- `rmk_contextual_hints_enabled` — включено/выключено

**Что умеет:**

- содержит словарь `HINTS` по id элемента (например `searchIconBtn`, `filter_block`, `techRadar`, `detailPanel`, …)
- умеет условные подсказки (например кнопки, которые скрыты по роли)
- позиционирование подсказки по `getBoundingClientRect`

**Экспорт:** `window.ContextualHints = { init, showHint, ... }` (точный набор — в хвосте файла).

---

### `ui/focus-trap.js`

**Назначение:** управление фокусом в модальных окнах и диалогах. Реализует focus trap и восстановление фокуса для улучшения доступности.

**Основные функции:**
- `trapFocus(container)` — активирует focus trap для модального окна
- `releaseFocus()` — деактивирует focus trap и восстанавливает фокус на сохранённый элемент
- `getFocusableElements(container)` — получает все фокусируемые элементы внутри контейнера

**Особенности:**
- Автоматически перехватывает Tab/Shift+Tab для циклического перемещения фокуса внутри модалки
- Сохраняет элемент, который имел фокус до открытия модалки
- Фильтрует скрытые элементы (display: none, visibility: hidden, opacity: 0)
- Поддерживает все стандартные фокусируемые элементы (a, button, input, textarea, select, [tabindex])

**Экспорт:** `window.FocusTrap = { trapFocus, releaseFocus, getFocusableElements }`.

---

### `ui/notifications.js`

**Назначение:** система уведомлений для отображения различных типов сообщений пользователю.

**Особенности:**
- Интегрируется с `Toast` для отображения уведомлений
- Поддерживает различные типы уведомлений (success, error, warning, info)
- Может использоваться как альтернатива или дополнение к `Toast`

**Экспорт:** `window.Notifications` (точный API зависит от реализации).

---

### `ui/vendors-files.js`

**Назначение:** управление вендорами и файлами для технологий на директорской странице.

**Основные функции:**
- Добавление/удаление вендоров к технологии
- Добавление/удаление интеграторов к технологии
- Прикрепление файлов к технологии
- Валидация и обработка файлов

**Особенности:**
- Работает только на странице `radar.html`
- Интегрируется с формами добавления/редактирования технологий
- Сохраняет данные в `enterpriseData-director.json`

**Экспорт:** `window.VendorsFiles` (точный API зависит от реализации).

---

### `ui/offline-handler.js`

**Назначение:** обработка online/offline событий с уведомлениями пользователю.

**Основные функции:**
- Отслеживание состояния соединения (online/offline)
- Показ уведомления при потере соединения
- Показ уведомления при восстановлении соединения
- Автоматическое скрытие уведомлений

**Особенности:**
- Использует события `online` и `offline` браузера
- Создаёт визуальные уведомления с иконками
- Поддерживает ARIA-атрибуты для доступности (`role="alert"`, `aria-live="assertive"`)
- Анимации появления/исчезновения уведомлений

**DOM-контракты:**
- Создаёт элементы `.offline-notification` и `.online-notification` динамически

**Экспорт:** `window.OfflineHandler = { init, ... }` (точный набор — в хвосте файла).

---

## Business

### `business/auth.js`

**Назначение:** рендер авторизации в шапке на страницах приложения (не на `auth.html`) + проверка прав.

**API:**

- `checkArchitectRole()` — true для `role=architect|admin`
- `renderAuth()` — показывает роль, кнопку входа/выхода, прячет/показывает кнопки редактирования

**Ключевые DOM‑узлы:**

- `#authInfo`, `#logoutContainer`
- `#exportPdfBtn`, `#editTechBtn`, `#deleteTechBtn`, `#addTechBtn`

**Экспорт:**

- `window.AuthModule = { checkArchitectRole, renderAuth }`
- алиасы: `window.checkArchitectRole`, `window.renderAuth`

---

### `business/priorities.js`

**Назначение:** расчёт приоритета технологии + UI панели приоритетов сектора.

**Математика:**

- нормализация готовности: `techRead/3`, `organRead/3`
- TRL: `trlN = (trlStage-1)/2`, `trlStage ∈ {1,2,3}`
- модели:
  - `avg` — среднее
  - `min` — слабое звено
  - `mult` — произведение (по умолчанию)

**API:**

- `computePriority(tech, model='mult', company?)`
- `getPriorityCategory(priority)` → `{key,label,description}`
- `getPriorityWeakLinkComment(tech, company?)`
- `getNormalizedReadinessAndTrl(tech, company?)`
- UI:
  - `recomputeQuadrantPriorityList(qId)`
  - `openQuadrantPriorityPanel(qId)`
  - `closeQuadrantPriorityPanel()`

**Экспорт:**

- `window.Priorities = { ... }`
- алиасы: `window.computePriority`, `window.getPriorityCategory`, `window.openQuadrantPriorityPanel`, …

---

### `business/export-fields-config.js`

**Назначение (этап 3 рефакторинга):** конфигурация полей и опций для экспорта PDF: порядок колонок, поля по умолчанию, метки полей, списки multi-select/text, опции (стоимость, рейтинги, TRL, приоритет, статус).

**Экспорт:** `window.ExportFieldsConfig` — объект с константами `EXPORT_COLUMN_ORDER`, `DEFAULT_EXPORT_FIELDS`, `EXPORT_FIELD_LABELS`, `MULTI_SELECT_FIELDS`, `TEXT_FIELDS`, `COST_PROM_OPTIONS`, `RATING_OPTIONS`, `TRL_OPTIONS`, `PRIORITY_OPTIONS`, `STATUS_OPTIONS`.

**Загружается:** до `export.js`, `export-filters.js`, `export-pdf.js`.

---

### `business/export-filters.js`

**Назначение (этап 3 рефакторинга):** применение фильтров экспорта к списку технологий (предприятие, блоки, функции, статус, стоимость, описание, готовность, TRL, вендоры, интеграторы).

**Экспорт:** `window.ExportFilters = { applyFiltersToTechnologies }`, алиас `window.applyFiltersToTechnologies`.

**Загружается:** до `export.js` и `export-pdf.js`.

---

### `business/export-pdf.js`

**Назначение (этап 3 рефакторинга):** генерация PDF-отчёта: построение таблицы на canvas, вставка страниц в jsPDF, сохранение файла. Использует `ExportFieldsConfig`, `getFieldLabel`/`getFieldValue` (detail-panel), `isNumericField` (events).

**Входные зависимости:** `window.jspdf`, `window.getFieldLabel`, `window.getFieldValue`, `window.isNumericField`, `window.ExportFieldsConfig`.

**Экспорт:** `window.ExportPdf = { generatePdf, prepareSelectedFieldsList }`. Функция `generatePdf(sourceList, enterpriseName, selectedFields, companyFilterForDisplay)` возвращает `Promise<{ enterpriseName, fieldsCount }>`.

**Загружается:** до `export.js`, после `export-fields-config.js` и `export-filters.js`.

---

### `business/export.js`

**Назначение:** оркестрация экспорта PDF: модальное окно выбора полей и фильтров, сбор данных, вызов `prepareSourceList` (state + ExportFilters), вызов `ExportPdf.generatePdf`, Toast/аудит. Конфигурация полей и опции — из `ExportFieldsConfig`; фильтрация списка — через `ExportFilters.applyFiltersToTechnologies`; генерация файла — через `ExportPdf.generatePdf`.

**Входные зависимости:**

- модули: `ExportFieldsConfig`, `ExportFilters`, `ExportPdf` (загружаются до export.js в RMK-director)
- библиотеки: `window.jspdf` (для проверки в performPdfExport)
- данные: StateAccessors (getEnterpriseData, getCurrentEnterprise, getTechnologies)
- поля: `getFieldLabel`/`getFieldValue` (detail-panel)
- UI: `showModal`/`hideModal`, `LoadingManager`, `Toast`

**Ключевые экспортируемые функции (алиасы):**

- `performPdfExport(selectedFields, filters)` — подготовка списка, вызов ExportPdf.generatePdf, уведомления и аудит
- `showExportPdfModal()`
- `populateExportFilters()`, `setupExportFilterToggles()`, `validateExportFields()`
- `applyFiltersToTechnologies` (делегирует в ExportFilters)

**Экспорт:**

- `window.ExportModule = (function(){ ... })()`
- алиасы: `window.performPdfExport`, `window.showExportPdfModal`, …

---

## Analytics

### Модули аналитики модели

Загружаются на `radar.html` через RMK-director.js после business-модулей. Используются для расчёта приоритетов, весов и обработки отсутствующих данных.

| Модуль | Назначение |
|--------|------------|
| `analytics/model-analytics.js` | Базовая аналитика модели. |
| `analytics/weight-optimizer.js` | Автоматическая оптимизация весов. |
| `analytics/missing-data-predictor.js` | Обработка и предсказание при отсутствующих данных. |
| `analytics/temporal-dynamics.js` | Учёт временной динамики. |
| `analytics/adaptive-calibration.js` | Адаптивная калибровка параметров. |

**Экспорт:** каждый модуль при необходимости экспортирует API в `window` для использования в priorities, positioning или других модулях.

---

## Integration

### `integration/events.js`

**Назначение:** центральная регистрация UI‑событий RMK‑страницы.

**Ключевые зоны:**

- **Тема**: слушает `#themeToggle`, пишет `localStorage.theme`, ставит `body.dark`
- **Поиск**: слушает `#searchInput`, делает `debounce` и вызывает `updateRadar()`
- **Фильтры**: открытие/закрытие панели `#filterPanel`, сброс, синхронизация кастомных селектов
- **Селекты**: вызывает `initSelectEvents()` (логика вынесена в `ui/select-events.js`)
- **Панель приоритетов**: обработчики `#quadrantPriorityPanel` (фильтры/поиск)
- **Предприятия**:
  - клики по `.enterprise-nav button`
  - запись `localStorage.selectedEnterprise`
  - dispatch `CustomEvent('enterpriseChanged', {detail:{enterprise}})`
  - обработчик `enterpriseChanged` вызывает `switchEnterprise` и перерисовку
- **Модалки/формы/прочее**: закрытия, клики вне области, защита от мгновенного закрытия, и т.д.

**Гарантия инициализации:**

- модуль проверяет наличие критических зависимостей (`EventManager`, `DOMCache`) и падает с понятной ошибкой, если не загружены.

**Экспорт:**

- как минимум: `window.initEventHandlers()` (и/или авто‑инициализация при DOMContentLoaded — зависит от хвоста файла).
