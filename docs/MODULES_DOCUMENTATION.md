# Документация модулей проекта РТП-2.3

Актуально для текущей структуры `src/js/modules/` (обновлено: **2026‑01‑13**).

## Обзор архитектуры

Проект — статическое веб‑приложение (HTML/CSS/JS), без сборки и без обязательного Node.js.

- Модули написаны в стиле **IIFE** и для совместимости **экспортируют API в `window`** (например, `window.DOMCache`, `window.DataLoader`, `window.updateRadar`).
- Основная страница радара (`src/pages/RMK.html`) загружает модули **в строгом порядке** через `src/js/RMK2.js` (динамическая загрузка `<script>` с `async=false`).
- Другие страницы используют свои скрипты:
  - `src/pages/index.html` → `src/js/script.js` (+ `src/js/audit-logger.js`, части UI для моб.навигации/жестов)
  - `src/pages/auth.html` → `src/js/auth.js`
  - `src/pages/admin.html` → `src/js/admin.js` (+ Chart.js через CDN)
  - `src/pages/help.html` → `src/js/help.js`

## Порядок загрузки модулей (RMK.html)

Источник истины: `src/js/RMK2.js` (массив `modules` внутри `loadAllModules()`).

Коротко по слоям:

- **Base**: `audit-logger.js`, `script.js`, `radar-utils.js`
- **Core**: `dom-utils.js` → `core-utils.js` → `state-manager.js` → `data-loader.js` → `state-utils.js` → `data-indexing.js`
- **UI (раньше)**: `ui/detail-panel.js` (нужен до `radar-wrappers.js`)
- **Radar**: `positioning.js` → `radar-renderer.js` → `quadrant-cache.js` → `quadrants.js` → `prospects-chart.js` → `radar-wrappers.js` → `radar-update.js`
- **UI (остальные)**: `filters.js`, `modals.js`, `forms.js`, `sidebar.js`, `modal-forms.js`, `report-status.js`, `tooltips.js`, `form-management.js`, `loading.js`, `error-display.js`, `toast.js`, `skeleton.js`, `mobile-nav.js`, `touch-handlers.js`, `keyboard-nav.js`, `aria-manager.js`, `onboarding.js`, `contextual-hints.js`
- **Business**: `export.js`, `auth.js`, `priorities.js`
- **Handlers split**: `ui/select-events.js`, `radar/radar-events.js`
- **Integration**: `integration/events.js` (после всех зависимостей)
- **Init**: `core/app-init.js` (последним)

## Каталог модулей

Ниже — список модулей, которые реально присутствуют в `src/js/modules/` в текущей версии проекта.

### Core (`src/js/modules/core/`)

#### `dom-utils.js`
**Назначение:** объединённые утилиты DOM.

- `window.DOMCache`: кэширование DOM‑узлов (`get/query/find/...`)
- `window.DOMProxy`: безопасные Proxy‑объекты (`createDOMProxy/createElementProxy/...`)

#### `core-utils.js`
**Назначение:** «ядро» общих инфраструктурных утилит.

- `window.ErrorHandler`: централизованная обработка ошибок (+ интеграция с `ErrorDisplay`, если он доступен)
- `window.EventManager`: делегирование событий (`on/off/clear`)
- `window.Memoization`: `memoize`, `memoizeWithTTL`, `FilterCache`
- `window.ModuleLoader`: `requireGlobalModule`
- `window.RenderQueue`: батчинг UI‑обновлений через `requestAnimationFrame`

#### `state-manager.js`
**Назначение:** централизованное состояние приложения (pub/sub).

- `window.StateManager`: `get/set/subscribe/subscribeToKey/clear`

#### `data-loader.js`
**Назначение:** загрузка JSON‑данных и их нормализация, переключение предприятия.

Ключевые особенности:
- чтение `src/data/ru/*.json` с сетевым кешом/дедупликацией fetch
- работа с «виртуальной ФС» (VFS) в `localStorage` (`vfs:*`)
- запись данных в `StateManager` и синхронизация ряда ключей в `window` (для обратной совместимости)

Экспорт: `window.DataLoader` (включая `loadData()`, `switchEnterprise()`, VFS‑хелперы и т.п.).

#### `state-utils.js`
**Назначение:** удобные геттеры/сеттеры и подписки на изменения состояния.

- `window.StateAccessors`: типизированные accessors (например `getTechnologies`, `setCurrentEnterprise`, …)
- `window.StateSubscriptions`: `initStateSubscriptions()` (авто‑подписки, автоперерисовка и синхронизация)

#### `data-indexing.js`
**Назначение:** индексы для быстрого доступа к технологиям.

- `window.DataIndex`: индексация и фильтрация (быстрый `filter/getById/byBlock/byStatus/byCompany`)
- `window.TechIndex`: `rebuildTechnologiesIndex()`, `getTechById()` (+ алиасы `window.getTechById`)

#### `app-init.js`
**Назначение:** оркестратор инициализации RMK‑страницы.

Содержит `initApp()`:
- тема (базовая инициализация)
- `DataLoader.loadData()` + `switchEnterprise()`
- первый `renderRadar()`
- инициализация обработчиков форм/удалений/помощи, мобильной навигации, ARIA, onboarding и т.д.

---

### Radar (`src/js/modules/radar/`)

#### `positioning.js`
**Назначение:** вычисление координат/раскладка blip’ов, сопоставление блок → квадрант.

Экспорт: `window.Positioning` + алиасы (например `window.getQuadrantIdForBlock`, `window.getAllQuadrantsForTech`).

#### `radar-renderer.js`
**Назначение:** отрисовка SVG радара (фон, легенда, blip’ы) и связанная визуальная логика.

Экспорт: `window.RadarRenderer`.

#### `quadrant-cache.js`
**Назначение:** кеширование SVG‑групп квадрантов для ускорения доступа.

Экспорт: `window.QuadrantCache` (например `getQuadrantGroup`, `clearQuadrantGroupsCache`).

#### `quadrants.js`
**Назначение:** логика квадрантов (получение технологий сектора, zoom/unzoom, имена/статусы).

Экспорт: `window.Quadrants` + алиасы (`window.zoomQuadrant`, `window.unzoom`, и т.п.).

#### `radar-wrappers.js`
**Назначение:** обёртки ради обратной совместимости: прокидывают «старые» глобальные функции на реализацию в `RadarRenderer`.

Экспорт/алиасы: `window.renderRadar`, `window.createBlip`, `window.renderLegend`, …

#### `radar-update.js`
**Назначение:** обновление радара по фильтрам/поиску (использует `Filters`, `DataIndex`, `RenderQueue`).

Экспорт/алиас: `window.updateRadar`.

#### `radar-events.js`
**Назначение:** обработчики событий, специфичные для SVG‑радара (hover/click по blip’ам, зум по секторам и т.п.).

Экспорт: `window.initRadarEvents()` и/или функции, используемые `integration/events.js`.

#### `prospects-chart.js`
**Назначение:** модуль «Перспективные» (график + таблица + экспорт).

Примечание: экспорт PDF в этом модуле реализован через canvas/`jsPDF` (в комментариях отмечено «без html2canvas»), но на странице `RMK.html` библиотека `html2canvas` подключена для общего PDF‑экспорта.

Экспорт: `window.ProspectsChart.init()` (и сопутствующие функции).

---

### UI (`src/js/modules/ui/`)

#### `filters.js`
**Назначение:** логика фильтров (custom select), чтение выбранных значений и наполнение опций.

Экспорт/алиасы: `window.Filters`, `window.getFilterValues`, `window.populateSelect`, `window.updateFunctionFilterForBlock`, …

#### `select-events.js`
**Назначение:** вынесенные из `events.js` обработчики кликов/изменений для custom‑select (sidebar и модалки).

Экспорт/алиас: `window.initSelectEvents()`.

#### `modals.js`
**Назначение:** базовые операции с модальными окнами (show/hide/confirm), защита от «мгновенного закрытия», сброс форм.

Экспорт/алиасы: `window.showModal`, `window.hideModal`, `window.showInternalConfirm`.

#### `forms.js`
**Назначение:** утилиты форм (dirty‑check, snapshot, динамические поля оценок предприятий и т.д.).

Экспорт: функции через `window` (используются модалками и форм‑менеджментом).

#### `form-management.js`
**Назначение:** обработчики сабмитов/кнопок для добавления/редактирования/удаления сущностей (технологии/блоки/функции) и связанная логика.

#### `modal-forms.js`
**Назначение:** синхронизация опций в модальных custom‑select (блоки по секторам, функции по блокам).

#### `detail-panel.js`
**Назначение:** панель детальной информации о технологии, выделение blip’ов, логика открытия из разных источников.

Экспорт/алиас: `window.showDetail` (+ функции для экспорта полей/лейблов, если присутствуют).

#### `sidebar.js`
**Назначение:** списки технологий по секторам в боковой панели, синхронизация с радаром.

Экспорт/алиас: `window.updateSidebarLists` (+ функции создания/обновления списков).

#### `report-status.js`
**Назначение:** индикаторы статуса подготовки отчёта/экспорта (loading/success/error).

#### `tooltips.js`
**Назначение:** тултипы и hover‑подсказки (единая реализация для UI).

#### `loading.js`
**Назначение:** менеджер загрузки/оверлеи (используется при загрузке данных и тяжёлых операциях).

#### `error-display.js`
**Назначение:** UI‑отображение ошибок (используется `ErrorHandler`, если модуль доступен).

#### `toast.js`
**Назначение:** всплывающие уведомления (используется как современный канал уведомлений вместо legacy‑панели).

#### `skeleton.js`
**Назначение:** skeleton‑заглушки для списков/панелей/графиков на время загрузки.

#### `mobile-nav.js`, `touch-handlers.js`
**Назначение:** адаптивная навигация и поддержка touch‑жестов.

#### `keyboard-nav.js`, `aria-manager.js`
**Назначение:** улучшения доступности и управление фокусом/клавиатурой.

#### `onboarding.js`
**Назначение:** интерактивный тур/обучение по интерфейсу (запускается из меню помощи).

#### `contextual-hints.js`
**Назначение:** контекстные подсказки (в `app-init.js` отмечены как отключенные).

---

### Business (`src/js/modules/business/`)

#### `auth.js`
**Назначение:** «права» и рендер UI‑авторизации на страницах радара.

Экспорт/алиасы: `window.checkArchitectRole()`, `window.renderAuth()`.

#### `priorities.js`
**Назначение:** расчет приоритета технологии (модели `avg/min/mult`), «слабое звено», панель приоритетов сектора.

Экспорт/алиасы: `window.computePriority`, `window.getPriorityCategory`, `window.openQuadrantPriorityPanel`, …

#### `export.js`
**Назначение:** экспорт PDF отчета (полевая выборка, фильтры экспорта, генерация PDF через `jsPDF` + `autoTable`).

Экспорт/алиасы: `window.performPdfExport`, `window.showExportPdfModal`, …

---

### Integration (`src/js/modules/integration/`)

#### `events.js`
**Назначение:** центральные обработчики событий интерфейса (тема, фильтры, поиск, предприятия, модалки, и т.д.).

Важно:
- модуль ожидает, что зависимости (например `DOMCache`, `EventManager`) уже загружены;
- часть логики вынесена в специализированные модули (`ui/select-events.js`, `radar/radar-events.js`).

## Примечания по внешним библиотекам

- На `RMK.html` подключены через CDN:
  - `jsPDF` + `jsPDF AutoTable` (экспорт PDF)
  - `html2canvas` (снимки HTML для PDF в части сценариев экспорта)
- На `admin.html` подключён `Chart.js` (графики админ‑панели).

