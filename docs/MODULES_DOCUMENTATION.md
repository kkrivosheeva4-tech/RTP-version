# Документация модулей проекта РТП-3 (`src/js/modules/`)

**Актуально на:** 04.03.2026  
**Точка входа:** `src/main.js`

---

## 1. Архитектурные принципы

- Приложение использует ES modules и Vite.
- Основные страницы (`index.html`, `radar.html`) подключают один модуль: `src/main.js`.
- `main.js` выполняет статические импорты модулей в фиксированном порядке.
- Для обратной совместимости часть API экспортируется в `window.*`.
- `src/js/RMK-director.js` сохранен как legacy-файл, но в актуальном рантайме не используется.

---

## 2. Фактический порядок загрузки в `main.js`

### 2.1 Core (ранний этап)

- `core/logger.js`
- `core/escape-utils.js`
- `core/dom-utils.js`
- `core/state-manager.js`
- `core/validators.js`
- `core/error-handler.js`
- `core/data-source.js`
- `core/data-normalize.js`
- `core/data-service.js`
- `core/data-loader.js`
- `core/state-utils.js`

### 2.2 UI

- `ui/toast.js`
- `ui/loading.js`
- `ui/error-display.js`
- `ui/detail-panel.js`
- `ui/filters.js`
- `ui/filter-init.js`
- `ui/modals.js`
- `ui/form-management.js`
- `ui/focus-trap.js`
- `ui/skeleton.js`
- `ui/tooltips.js`
- `ui/notifications.js`
- `ui/report-status.js`
- `ui/modal-forms.js`
- `ui/sidebar.js`
- `ui/forms.js`
- `ui/common-ui.js`
- `ui/tech-tabs-manager.js`
- `ui/edit-tech-tabs-manager.js`
- `ui/func-cover-calculator.js`
- `ui/auto-func-cover.js`
- `ui/mobile-nav.js`
- `ui/touch-handlers.js`
- `ui/keyboard-nav.js`
- `ui/aria-manager.js`
- `ui/offline-handler.js`
- `ui/onboarding.js`
- `ui/select-events.js`
- `ui/vendors-files.js`

### 2.3 Radar

- `radar/positioning.js`
- `radar/quadrant-cache.js`
- `radar/quadrants.js`
- `radar/radar-renderer.js`
- `radar/radar-wrappers.js`
- `radar/radar-update.js`
- `radar/spatial-index.js`
- `radar/radar-events.js`

### 2.4 Business

- `business/export-fields-config.js`
- `business/export-filters.js`
- `business/export-pdf.js`
- `business/export.js`
- `business/auth.js`
- `business/priorities.js`

### 2.5 Analytics

- `analytics/model-analytics.js`
- `analytics/weight-optimizer.js`
- `analytics/missing-data-predictor.js`
- `analytics/temporal-dynamics.js`
- `analytics/adaptive-calibration.js`

### 2.6 Integration + bootstrap

- `core/core-utils.js`
- `integration/events.js`
- далее подключаются служебные модули вне `src/js/modules`: `audit-logger.js`, `script.js`, `radar-utils.js`, `api-config-loader.js`, `api-client.js`, `data-indexing.js`, `func-cover-utils.js`, `form-field-options.js`, `app-init.js`.

---

## 3. Каталог модулей (актуальный)

## Core

- `src/js/modules/core/app-init.js` - инициализация приложения.
- `src/js/modules/core/api-client.js` - HTTP-клиент, bearer-токен, refresh-flow при 401.
- `src/js/modules/core/core-utils.js` - EventManager, ErrorHandler, RenderQueue и утилиты.
- `src/js/modules/core/data-indexing.js` - индексация данных для быстрого доступа.
- `src/js/modules/core/data-loader.js` - загрузка и первичная подготовка данных.
- `src/js/modules/core/data-normalize.js` - нормализация схемы технологий.
- `src/js/modules/core/data-service.js` - единый слой данных (mock/API/VFS).
- `src/js/modules/core/data-source.js` - низкоуровневые источники JSON/VFS.
- `src/js/modules/core/dom-utils.js` - DOMCache/DOMProxy.
- `src/js/modules/core/error-handler.js` - централизованная обработка ошибок.
- `src/js/modules/core/escape-utils.js` - escape/безопасная работа со строками.
- `src/js/modules/core/logger.js` - окружение-зависимое логирование.
- `src/js/modules/core/state-manager.js` - хранилище состояния и подписки.
- `src/js/modules/core/state-utils.js` - StateAccessors и адаптеры состояния.
- `src/js/modules/core/validators.js` - валидация полей/форм.

## UI

- `src/js/modules/ui/aria-manager.js`
- `src/js/modules/ui/auto-func-cover.js`
- `src/js/modules/ui/common-ui.js`
- `src/js/modules/ui/detail-panel.js`
- `src/js/modules/ui/edit-tech-tabs-manager.js`
- `src/js/modules/ui/error-display.js`
- `src/js/modules/ui/filter-init.js`
- `src/js/modules/ui/filters.js`
- `src/js/modules/ui/focus-trap.js`
- `src/js/modules/ui/form-management.js`
- `src/js/modules/ui/forms.js`
- `src/js/modules/ui/func-cover-calculator.js`
- `src/js/modules/ui/keyboard-nav.js`
- `src/js/modules/ui/loading.js`
- `src/js/modules/ui/mobile-nav.js`
- `src/js/modules/ui/modal-forms.js`
- `src/js/modules/ui/modals.js`
- `src/js/modules/ui/notifications.js`
- `src/js/modules/ui/offline-handler.js`
- `src/js/modules/ui/onboarding.js`
- `src/js/modules/ui/report-status.js`
- `src/js/modules/ui/select-events.js`
- `src/js/modules/ui/sidebar.js`
- `src/js/modules/ui/skeleton.js`
- `src/js/modules/ui/tech-tabs-manager.js`
- `src/js/modules/ui/toast.js`
- `src/js/modules/ui/tooltips.js`
- `src/js/modules/ui/touch-handlers.js`
- `src/js/modules/ui/vendors-files.js`

## Radar

- `src/js/modules/radar/positioning.js` - расчет `theta/radius`, кеш позиций.
- `src/js/modules/radar/quadrant-cache.js` - кеш DOM-структуры квадрантов.
- `src/js/modules/radar/quadrants.js` - логика зума/работы с квадрантами.
- `src/js/modules/radar/radar-events.js` - обработчики событий SVG-радара.
- `src/js/modules/radar/radar-renderer.js` - отрисовка blip и окружения.
- `src/js/modules/radar/radar-update.js` - обновление визуализации при state-change.
- `src/js/modules/radar/radar-wrappers.js` - фасады/обертки для интеграции.
- `src/js/modules/radar/spatial-index.js` - пространственный индекс для ускорения.

## Business

- `src/js/modules/business/auth.js` - рендер auth-блока и роль-зависимый UI.
- `src/js/modules/business/export.js` - экспортный flow.
- `src/js/modules/business/export-fields-config.js` - конфиг полей экспорта.
- `src/js/modules/business/export-filters.js` - фильтры экспорта.
- `src/js/modules/business/export-pdf.js` - формирование PDF.
- `src/js/modules/business/priorities.js` - панель и логика приоритетов.

## Analytics

- `src/js/modules/analytics/adaptive-calibration.js`
- `src/js/modules/analytics/missing-data-predictor.js`
- `src/js/modules/analytics/model-analytics.js`
- `src/js/modules/analytics/temporal-dynamics.js`
- `src/js/modules/analytics/weight-optimizer.js`

## Integration

- `src/js/modules/integration/events.js` - связывает UI-события, state и перерисовку.

## Utils

- `src/js/modules/utils/func-cover-utils.js` - расчет `funcCover`, веса функций.

---

## 4. Что удалено из актуальной схемы

- В каталоге `src/js/modules` отсутствуют и не используются:
  - `radar/prospects-chart.js`
  - `ui/contextual-hints.js`
- Упоминания этих файлов в старых версиях документации считаются устаревшими.

---

## 5. Связанные документы

- `docs/HTML_DOCUMENTATION.md`
- `docs/CSS_DOCUMENTATION.md`
- `docs/JS_NON_MODULES_DOCUMENTATION.md`
- `docs/MATHEMATICAL_MODEL_DOCUMENTATION.md`
- `docs/BACKEND_API_SPEC.md`
