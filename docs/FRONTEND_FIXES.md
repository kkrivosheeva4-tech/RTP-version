# Основные проблемы frontend, решаемые без бэкенда

**Дата:** 18.02.2026  
**Описание:** Список задач по улучшению frontend, которые можно выполнить в текущей архитектуре (mock-данные, localStorage, VFS) без перехода на backend API.

---

## Критичные

### 1. Дублирующиеся блоки `#addChoicePopover` в radar.html

**Файл:** `src/pages/radar.html`  

**Проблема:** Блок с `id="addChoicePopover"` продублирован 3 раза (строки ~745, ~767, ~786). При этом `document.getElementById('addChoicePopover')` возвращает только первый элемент, возможны конфликты в разметке и лишний HTML.

**Решение:** Удалить 2 дубликата, оставить один блок `#addChoicePopover`.

---

### 2. Прямые вызовы `console` вместо централизованного Logger

**Файлы:**
- `src/js/modules/ui/modals.js` — `console.error(e)`
- `src/js/modules/ui/mobile-nav.js` — `console.error('Ошибка инициализации MobileNav:', error)`
- `src/js/modules/core/core-utils.js` — `console.error(...)`
- `src/js/modules/ui/error-display.js` — `console.error(...)`
- `src/js/modules/core/state-manager.js` — `console.error(...)`

**Проблема:** В продакшене `console` может быть отключён или переопределён; нет единообразного логирования.

**Решение:** Заменить на `window.Logger?.warn(...)` или `window.reportError(...)` (если это ошибка для пользователя).

---

### 3. Пустые catch-блоки без логирования

**Файлы и места:**
- `src/js/modules/ui/form-management.js` — строки ~1599–1600
- `src/js/modules/ui/select-events.js` — строки ~1511, ~1775, ~1870
- `src/js/help.js` — строка ~34
- `src/js/modules/common-ui.js` — строки ~159, ~165

**Проблема:** Ошибки теряются, отладка усложняется.

**Решение:** Добавить минимальное логирование: `catch (e) { window.Logger?.warn('контекст', e); }`

---

## Важные

### 4. OfflineHandler: утечка обработчиков при destroy()

**Файл:** `src/js/modules/ui/offline-handler.js`

**Проблема:** `init()` вешает `addEventListener('offline', ...)` и `addEventListener('online', ...)`, но `destroy()` не вызывает `removeEventListener`. При SPA-навигации или повторной инициализации возможны двойные обработчики.

**Решение:** Сохранять ссылки на колбэки и в `destroy()` вызывать `window.removeEventListener('offline', ...)` и `window.removeEventListener('online', ...)`.

---

### 5. XSS-риск при использовании innerHTML с пользовательским вводом

**Файлы:** Модули, где в `innerHTML` попадают данные из форм/JSON (уведомления, карточки, панели).

**Проблема:** Несанкционированный HTML/JS во вводе может выполниться.

**Решение:**
- Использовать `textContent` или `createElement` там, где нужен только текст.
- Если HTML нужен — экранировать через общую утилиту `escapeHtml` (она уже есть) перед вставкой.
- Для rich-контента рассмотреть DOMPurify (подключить библиотеку).

---

### 6. Синхронизация state с window (legacy)

**Файл:** `src/js/modules/core/data-loader.js`

**Проблема:** Данные дублируются: `StateManager.set('technologies', ...)` и `window.technologies = value`. Это legacy, усложняет поддержку.

**Решение:** Постепенно убрать присвоения в `window.*`, оставить только StateManager; обновить модули, которые читают из `window.technologies`, `window.enterpriseData` и т.п., чтобы они брали данные через StateManager/StateAccessors. Можно делать по одному ключу за раз.

---

### 7. Последовательная загрузка JSON в loadData()

**Файл:** `src/js/modules/core/data-loader.js`

**Проблема:** Файлы `blocks.json`, `functions.json`, `technologies.json` и др. загружаются в цикле `for` по одному. Время загрузки = сумма всех запросов.

**Решение:** Загружать независимые файлы параллельно через `Promise.all()`:
```javascript
const [b1, f1, f2, ...] = await Promise.all([
  loadJsonPreferVfs('blocks.json', true),
  loadJsonPreferVfs('functions.json', true),
  loadJsonPreferVfs('functionToBlock.json', true),
  // ... с учётом порядка, где есть зависимости
]);
```

---

### 8. Поле поиска `#qpSearchInput` без доступной метки

**Файл:** `src/pages/radar.html`

**Проблема:** У `#qpSearchInput` есть `placeholder`, но нет `aria-label` или связанного `<label>`. Скринридеры могут не озвучивать назначение поля.

**Решение:** Добавить `aria-label="Поиск по технологиям в списке"` для `#qpSearchInput`.

---

## Средний приоритет

### 9. Контекстные подсказки отключены в app-init

**Файл:** `src/js/modules/core/app-init.js`

**Проблема:** Вызов `ContextualHints.init()` закомментирован. Мёртвый код или недоделанная функция.

**Решение:** Либо включить и проверить работу, либо удалить закомментированный блок и неиспользуемый код модуля ContextualHints, если функция не нужна.

---

### 10. Вынесение общей логики escapeHtml

**Проблема:** Экранирование HTML делается в нескольких местах по-разному (в Toast, data-loader, и т.д.).

**Решение:** Создать `src/js/modules/core/escape-utils.js` с единой функцией `escapeHtml(str)` и подключать её везде, где вставляется пользовательский текст в HTML.

---

### 11. Улучшение отображения ошибок загрузки данных

**Файл:** `src/js/modules/core/data-loader.js` / `app-init.js`

**Проблема:** При падении `loadData()` LoadingManager скрывается в `finally`, но пользователь может не понять, что произошла ошибка, и нет явной кнопки «Повторить».

**Решение:** В `catch` блока `loadData` вызывать `window.ErrorDisplay?.show(error, 'Загрузка данных', retryCallback)` с callback = `() => DataLoader.loadData()`.

---

### 12. Организация RMK.css

**Файл:** `src/css/RMK.css`

**Проблема:** Файл очень большой (~8200+ строк), сложно ориентироваться и поддерживать.

**Решение:** Разбить на части, например:
- `rmk-base.css` — :root, темы, сброс
- `rmk-layout.css` — header, sidebar, main
- `rmk-radar.css` — стили радара
- `rmk-modals.css` — модальные окна и формы
- `rmk-components.css` — кнопки, селекты, уведомления

Подключать все через `@import` в основной `RMK.css` или по отдельности в HTML. Можно делать поэтапно.

---

## Низкий приоритет

### 13. Добавление unit-тестов (mock-режим)

**Проблема:** В `package.json` только заглушка `"test": "echo \"Error: no test specified\""`.

**Решение:** Добавить Jest или Vitest, написать тесты для:
- `validators.js` (normalizeForComparison, validateDuplicateTechnology)
- `func-cover-utils.js`
- `data-normalize.js`

Данные брать из mock-объектов, без бэкенда.

---

### 14. Дублирование кода выхода в auth

**Файлы:** `src/js/auth.js`, `src/js/modules/business/auth.js`, `src/js/modules/ui/common-ui.js`

**Проблема:** Логика `localStorage.removeItem('isLoggedIn')` и т.д. повторяется в нескольких местах.

**Решение:** Вынести в общую функцию, например `AuthModule.safeLogout()` или `clearAuthFromStorage()`, и вызывать её везде, где нужен выход.

---

## Инфраструктура

### 15. Переход на ES modules и Vite

**Проблема:** 60+ скриптов загружаются динамически через `loadModule()` в RMK-director.js. Порядок загрузки задаётся вручную, зависимости через глобальный `window.*`, нет tree-shaking и статического анализа.

**Решение:** Внедрить Vite и ES modules.
- Установить Vite, настроить `vite.config.js`
- Постепенно переводить модули на `import/export`
- Заменить динамическую загрузку скриптов статическими импортами
- Убрать экспорты в `window.*` в пользу named exports

**Примечание:** Интеграция с backend в будущем будет минимальной — добавление proxy и env-переменных в конфиг. Рефакторинг можно выполнять до появления API.

---

## Исключено (требует бэкенда)

- Реальная авторизация (JWT, сессии) — без backend не решить.
- Хранение паролей — mock-режим оставляем как есть до появления API.
- Реализация ApiClient.request() — заглушка остаётся до появления backend API.
- CSP без unsafe-inline — требует сборки и nonce, лучше делать вместе с переходом на bundler.

---

## Рекомендуемый порядок

1. **Сразу:** П.1 (дубликаты addChoicePopover)  
2. **Быстро:** П.2 (console → Logger), П.3 (пустые catch)  
3. **Короткий спринт:** П.4 (OfflineHandler), П.7 (Promise.all), П.8 (aria-label)  
4. **Средний срок:** П.5 (XSS), П.6 (state), П.11 (ErrorDisplay при loadData)  
5. **По возможности:** П.9, П.10, П.12, П.13, П.14  
6. **Инфраструктура (отдельная фаза):** П.15 (ES modules + Vite)

---

## Сводка

| №  | Задача                    | Сложность | Файлы                          |
|----|---------------------------|-----------|--------------------------------|
| 1  | Удалить дубликаты HTML    | Низкая    | radar.html                     |
| 2  | console → Logger          | Низкая    | modals, mobile-nav, core-utils, error-display, state-manager |
| 3  | Логирование в catch       | Низкая    | form-management, select-events, help, common-ui |
| 4  | OfflineHandler removeEventListener | Средняя | offline-handler.js             |
| 5  | XSS / escapeHtml          | Средняя   | несколько модулей              |
| 6  | Убрать window.* sync      | Средняя   | data-loader, потребители       |
| 7  | Параллельная загрузка JSON| Низкая    | data-loader.js                 |
| 8  | aria-label для qpSearchInput | Низкая | radar.html                     |
| 9  | ContextualHints           | Низкая    | app-init.js                    |
| 10 | Единый escapeHtml         | Низкая    | новый модуль + потребители     |
| 11 | ErrorDisplay при loadData | Низкая    | data-loader, app-init          |
| 12 | Разбить RMK.css           | Средняя   | RMK.css                        |
| 13 | Unit-тесты                | Средняя   | package.json, validators, utils|
| 14 | Вынести safeLogout        | Низкая    | auth.js, auth (business), common-ui |
| 15 | ES modules + Vite         | Высокая   | весь проект                    |

---

## Пошаговый план реализации

### Этап 0. Подготовка (1 день)

| Шаг | Действие | Файлы |
|-----|----------|-------|
| 0.1 | Создать отдельную ветку для рефакторинга | git |
| 0.2 | Убедиться, что текущее приложение работает в браузере | — |
| 0.3 | Составить чек-лист ручной проверки (радар, фильтры, формы, экспорт) | docs/CHECKLIST.md (опционально) |

---

### Этап 1. Быстрые исправления (1–2 дня)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 1.1 | **П.1** Дубликаты addChoicePopover | Открыть `radar.html`, найти блоки `id="addChoicePopover"` (строки ~745, ~767, ~786), удалить 2 и 3-й блоки целиком. Оставить один. Проверить, что popover открывается при клике на «Добавить». |
| 1.2 | **П.8** aria-label для qpSearchInput | В `radar.html` найти `<input id="qpSearchInput"` и добавить атрибут `aria-label="Поиск по технологиям в списке"`. |
| 1.3 | **П.2** console → Logger | В каждом файле заменить `console.error(...)` на `window.Logger?.warn(...)` или `reportError(...)`: modals.js, mobile-nav.js, core-utils.js, error-display.js, state-manager.js. |
| 1.4 | **П.3** Логирование в catch | В form-management.js, select-events.js, help.js, common-ui.js добавить в пустые catch: `window.Logger?.warn('описание контекста', e);` |
| 1.5 | Проверка | Пройти чек-лист, убедиться, что функциональность не нарушена. |

---

### Этап 2. Производительность и доступность (1 день)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 2.1 | **П.7** Параллельная загрузка JSON | В `data-loader.js` в `loadData()`: собрать `fileNames` в группы по зависимостям. `blocks.json` — отдельно (нужен первым). Остальные 8 файлов — загрузить через `const results = await Promise.all(fileNames.map(fn => loadJsonPreferVfs(fn, true)))`. Распарсить `results` и присвоить в `fetched`. |
| 2.2 | **П.4** OfflineHandler removeEventListener | В `offline-handler.js`: сохранить ссылки `_onOffline` и `_onOnline` при добавлении обработчиков. В `destroy()` вызвать `window.removeEventListener('offline', _onOffline)` и `window.removeEventListener('online', _onOnline)`. Обнулить ссылки. |
| 2.3 | Проверка | Перезагрузить страницу, проверить скорость загрузки и работу офлайн-режима. |

---

### Этап 3. Безопасность и единообразие (2–3 дня)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 3.1 | **П.10** Единый escapeHtml | Создать `src/js/modules/core/escape-utils.js` с функцией `escapeHtml(str)`. В ней: `String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))`. Добавить в RMK-director.js загрузку этого модуля (перед toast, data-loader). Экспортировать в `window.escapeHtml`. |
| 3.2 | **П.5** XSS | Пройти по модулям с innerHTML (toast, data-loader, notifications, offline-handler, modals, detail-panel и др.): везде, где вставляется пользовательский текст, обернуть в `escapeHtml()`. Для статичного HTML оставить как есть. |
| 3.3 | **П.11** ErrorDisplay при loadData | В `data-loader.js` в `catch` блока `loadData`: вызвать `window.ErrorDisplay?.show(error, 'Загрузка данных', () => DataLoader.loadData())` перед `throw`. Убедиться, что LoadingManager скрывается в `finally`. |
| 3.4 | Проверка | Проверить отображение уведомлений, ошибок и экранирование спецсимволов в полях ввода. |

---

### Этап 4. Рефакторинг state и auth (2 дня)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 4.1 | **П.14** Вынести safeLogout | В `auth.js` (business) функция `safeLogout` уже есть. Экспортировать её в `window.AuthModule.safeLogout` и в `window.clearAuthFromStorage` (алиас). В auth.js (страница входа) и common-ui.js заменить дублирующую логику на вызов `window.AuthModule?.safeLogout()` или `window.clearAuthFromStorage?.()`. |
| 4.2 | **П.6** Убрать window.* sync | Выбрать один ключ, например `technologies`. В data-loader убрать `window.technologies = value`. Найти все `window.technologies` в проекте (grep), заменить на `StateManager.get('technologies')` или `StateAccessors.getTechnologies()`. Повторить для `enterpriseData`, `currentEnterprise`, `blocksList`, `functions`, `nameToBlockId`, `functionToBlockMap` по одному. |
| 4.3 | Проверка | Проверить загрузку данных, фильтры, отображение радара. |

---

### Этап 5. Чистка и организация (1–2 дня)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 5.1 | **П.9** ContextualHints | Решить: включить или удалить. Если включить — раскомментировать вызов в app-init.js, проверить работу. Если удалить — удалить вызов и при необходимости сам модуль contextual-hints.js. |
| 5.2 | **П.12** Разбить RMK.css | Скопировать RMK.css в RMK.css.bak. Создать файлы: rmk-base.css (~200 строк :root, темы), rmk-layout.css (header, sidebar, main), rmk-radar.css (радар), rmk-modals.css (модалки), rmk-components.css (кнопки, селекты). Вырезать соответствующие блоки из RMK.css в новые файлы. В RMK.css оставить только `@import` этих файлов. Проверить отображение. |
| 5.3 | Проверка | Полная ручная проверка UI. |

---

### Этап 6. Тесты (1–2 дня)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 6.1 | **П.13** Unit-тесты | Установить Vitest: `npm i -D vitest`. Добавить в package.json: `"test": "vitest"`, `"test:run": "vitest run"`. Создать `src/js/modules/core/__tests__/validators.test.js` с тестами для `normalizeForComparison` и `validateDuplicateTechnology`. Запустить `npm run test`. |
| 6.2 | Расширить тесты | Добавить тесты для func-cover-utils.js, data-normalize.js (опционально). |
| 6.3 | Проверка | `npm run test:run` — все тесты зелёные. |

---

### Этап 7. Переход на ES modules и Vite (5–7 дней)

| Шаг | Задача | Действия |
|-----|--------|----------|
| 7.1 | Инициализация Vite | `npm create vite@latest . -- --template vanilla` (в папке проекта или клон). Либо вручную: `npm i -D vite`, создать `vite.config.js` с `root`, `publicDir`, `build.outDir`, `server.port`. Создать `index.html` в корне с `<script type="module" src="/src/main.js">`. |
| 7.2 | Точка входа | Создать `src/main.js` — аналог RMK-director.js. Импортировать модули в нужном порядке: logger, dom-utils, state-manager, data-source, data-normalize, data-loader и т.д. Вызывать `AppInit.initApp()` в DOMContentLoaded. |
| 7.3 | Перевод первого модуля | Выбрать простой модуль (logger, escape-utils). Переписать на `export function ...` и `export default`. В main.js: `import { ... } from './modules/core/logger.js'`. Удалить загрузку через loadModule. Проверить работу. |
| 7.4 | Перевод по группам | Переводить модули группами: core (logger, error-handler, state-manager, dom-utils, data-source, data-normalize, data-loader, validators, escape-utils), затем ui, radar, business, analytics, integration. Каждая группа — коммит + проверка. |
| 7.5 | Убрать loadModule | Удалить функцию `loadModule` и `loadAllModules` из RMK-director.js. Удалить все `<script src="...">` из radar.html (кроме jspdf, html2canvas — оставить как внешние или подключить через npm). |
| 7.6 | Конфиг для статики | Настроить в vite.config.js `resolve.alias` при необходимости, `assetsInclude` для JSON. Проверить загрузку данных из `/src/data/ru/*.json`. |
| 7.7 | Production build | `npm run build`, развернуть `dist` на статическом хостинге или через `vite preview`. Проверить работу в production. |
| 7.8 | Обновить скрипты | В package.json: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`. Добавить в README инструкции по запуску. |

---

### Этап 8. Финализация

| Шаг | Действие |
|-----|----------|
| 8.1 | Полная регрессионная проверка |
| 8.2 | Обновить документацию (README, FRONTEND_FIXES.md — отметить выполненные пункты) |
| 8.3 | Code review, merge в main |

---

### Сводка по этапам

| Этап | Содержание | Оценка |
|------|------------|--------|
| 0 | Подготовка | 1 день |
| 1 | Быстрые исправления (П.1, П.2, П.3, П.8) | 1–2 дня |
| 2 | Производительность и доступность (П.4, П.7) | 1 день |
| 3 | Безопасность и единообразие (П.5, П.10, П.11) | 2–3 дня |
| 4 | Рефакторинг state и auth (П.6, П.14) | 2 дня |
| 5 | Чистка и организация (П.9, П.12) | 1–2 дня |
| 6 | Unit-тесты (П.13) | 1–2 дня |
| 7 | ES modules + Vite (П.15) | 5–7 дней |
| 8 | Финализация | 0.5–1 день |

**Итого:** ~14–20 рабочих дней (при полном выполнении всех этапов). Этапы 1–5 можно выполнять независимо; этапы 6–7 — по мере готовности.
