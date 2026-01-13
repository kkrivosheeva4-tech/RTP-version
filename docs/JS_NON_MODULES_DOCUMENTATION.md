# Документация JS файлов (кроме `src/js/modules/`) проекта РТП-2.3

Актуально для состояния репозитория на **2026‑01‑13**.

## Содержание

- [Общий обзор](#общий-обзор)
- [Файлы](#файлы)
  - [`src/js/audit-logger.js`](#srcjsaudit-loggerjs)
  - [`src/js/radar-utils.js`](#srcjsradar-utilsjs)
  - [`src/js/script.js`](#srcjsscriptjs)
  - [`src/js/RMK2.js`](#srcjsrmk2js)
  - [`src/js/auth.js`](#srcjsauthjs)
  - [`src/js/help.js`](#srcjshelpjs)
  - [`src/js/admin.js`](#srcjsadminjs)

## Общий обзор

Вне `src/js/modules/` находятся «страничные» и «базовые» скрипты:

- **`RMK2.js`** — загрузчик модулей и слой обратной совместимости для основного радара.
- **`script.js`** — общий «скрипт шапки/темы/tooltip’ов» и логика некоторых страниц (главная, админка; также загружается в RMK через `RMK2.js`).
- **`audit-logger.js`** — единый журнал аудита в `localStorage` + алиасы для всего проекта.
- **`auth.js`** — авторизация на отдельной странице `auth.html` (в этой странице не используется модуль `modules/business/auth.js`).
- **`help.js`** — поведение страницы справки `help.html`.
- **`admin.js`** — админ‑панель (пользователи/аудит/бэкапы/экспорт/графики).
- **`radar-utils.js`** — чистые утилиты геометрии/дебаунса, экспортируемые в `window`.

---

## Файлы

### `src/js/audit-logger.js`

**Назначение:** централизованный аудит важных действий (логин/логаут/создание/удаление/экспорт/бэкап и т.д.) в `localStorage`.

**Где используется:** подключается на нескольких страницах (`auth.html`, `index.html`, `admin.html`, также грузится на RMK через `RMK2.js`).

**Ключи хранения:**

- `adminAuditLogs` — массив записей аудита

**Формат записи (суть):**

- `id` — числовой идентификатор
- `date` — строка локального времени `YYYY-MM-DD HH:mm:ss` (важно для фильтрации в админке)
- `user`, `action`, `details`, `tz: 'local'`, `ip: 'local'`, опционально `role`

**Миграция:**

- если в старых записях отсутствует `tz`, скрипт считает дату «legacy» и пытается привести её из UTC‑строки к локальному времени.

**Экспорт в `window`:**

- `window.AuditLogger` — объект с методами (`readLogs`, `append`, `migrateLogsIfNeeded`, …)
- `window.getAuditTimestamp` — алиас на генерацию локального времени
- `window.appendAdminAudit(action, details)` — алиас, который используется по всему проекту

---

### `src/js/radar-utils.js`

**Назначение:** набор «чистых» функций для радара (геометрия + debounce). Сделано как глобальные объявления для совместимости.

**Функции:**

- `debounce(func, wait)`
- `polarToCartesian(cx, cy, r, deg)`
- `cartesianToPolar(cx, cy, x, y)`
- `describeArc(x, y, r, sa, ea)`
- `describeWedge(x, y, r, sa, ea)`
- `starPath(cx, cy, outerR, innerR, points=5)`

**Экспорт в `window`:**

- `window.debounce`, `window.polarToCartesian`, `window.cartesianToPolar`, `window.describeArc`, `window.describeWedge`, `window.starPath`

**Где используется:** на странице `RMK.html` (через `RMK2.js`, который загружает `radar-utils.js` одним из первых) и в модулях позиционирования/рендеринга.

---

### `src/js/script.js`

**Назначение:** общий UI‑скрипт, который обслуживает:

- tooltip’ы (`data-tooltip`, `title`) через делегирование событий;
- переключение темы (через `localStorage.theme` и `body.className = light|dark`);
- рендер блока авторизации в шапке (отображение роли + кнопки входа/выхода);
- навигацию по предприятиям (выбор `selectedEnterprise`);
- набор вспомогательных функций для UI (включая меню помощи).

**Где подключается:**

- `src/pages/index.html`
- `src/pages/admin.html`
- на `src/pages/RMK.html` этот файл загружается динамически из `RMK2.js` (как «base utility»)

**Ключи localStorage (по факту использования в файле):**

- `theme` — `light|dark`
- `role` — `admin|architect|guest|...`
- `selectedEnterprise` — имя предприятия (например `РМК`)
- в `safeLogout()` чистятся: `isLoggedIn`, `username`, `userName`, `role`

**Ключевые функции/узлы (высокоуровнево):**

- `class Tooltip` + `initTooltip()`:
  - создаёт один `.custom-tooltip` в `body`
  - показывает tooltip по `pointerover/focusin` на элементах с `data-tooltip` или `title`
  - позиционирование выбирает top/bottom/left/right по доступному месту
- тема:
  - читает `localStorage.theme`, выставляет `document.body.className`
  - подписывается на `#themeToggle` (если есть)
- авторизация в шапке:
  - `renderAuth()` использует `localStorage.role` и включает/скрывает кнопки (`#exportPdfBtn`, `#addTechBtn`, `#reportIconBtn`, `#addIconBtn`)
  - `safeLogout()` дополнительно пишет событие в аудит через `window.appendAdminAudit`, если доступно
- `initHelpButton()` / `showHelpMenu(button)`:
  - строит всплывающее меню помощи
  - экспортирует `window.showHelpMenu = showHelpMenu` (используется из других частей)

**Важно про пересечения с модульным кодом:**

- На RMK‑странице есть также модуль `src/js/modules/business/auth.js`, который тоже экспортирует `window.renderAuth`.  
  Из-за порядка загрузки (см. `RMK2.js`) **модульная версия `renderAuth` может переопределить функцию из `script.js`**.

---

### `src/js/RMK2.js`

**Назначение:** основной «загрузчик и интегратор» для `src/pages/RMK.html`.

Файл выполняет две роли:

1) **Загружает все модульные скрипты** из `src/js/modules/**` в строгом порядке (динамические `<script>` с `async=false`).
2) Оставляет/поддерживает **слой обратной совместимости**: экспортирует в `window` ряд констант, геттеров/сеттеров и функций, которые ожидает «старый» код.

**Главные части:**

- `loadModule(src)` — загрузка одного скрипта
- `loadAllModules()` — последовательная загрузка списка модулей (включая `audit-logger.js`, `script.js`, `radar-utils.js`)
- Константы радара: `CENTER_X`, `CENTER_Y`, `RADIUS_STEP`, и т.п. (экспортируются в `window.*`)
- `initRMK2()` — основная инициализация после загрузки модулей (подключение `requireGlobalModule`, получение зависимостей, инициализация `StateManager`, прокидывание функций)

**Экспорт в `window` (примерно что прокидывается):**

- геометрия/конфиг: `CENTER_X`, `CENTER_Y`, `RADIUS_STEP`, `POSITION_PAD`, `MIN_BLIP_DISTANCE`, `RING_LABEL_WIDTH/HEIGHT`, `TECHTYPE_TO_SHAPE`
- синхронизированные данные: `RINGS`, `QUADRANTS`, `levelToRing`, `technologies`, `enterpriseData`, `currentEnterprise`, и др.
- алиасы/совместимость: `window.getFilterValues`, `window.getTechnologies`, `window.updateRadar`, `window.renderRadar`, `window.createBlip`, `window.getTechById`, …

**Глобальное состояние:**

- использует `StateManager` как источник правды,
- но после загрузки данных дублирует часть ключей в `window.*` (для старых вызовов).

**Зависимости:**

- практически вся функциональность делегирована модулям `src/js/modules/**`.

---

### `src/js/auth.js`

**Назначение:** логика страницы `src/pages/auth.html` (логин/гость/тема/показ пароля/уведомления).

**Особенность:** этот файл — отдельный путь авторизации, не использующий модуль `modules/business/auth.js`.

**Пользователи (вшиты в код):**

- `admin/admin123` → `role=admin`
- `architect/architect123` → `role=architect`
- `guest/guest123` → `role=guest`

**Ключи localStorage:**

- `isLoggedIn` (`'true'|'false'`)
- `username`
- `role`
- `theme` (используется для выбора `data-theme` и иконок)
- `adminAuditLogs` (аудит входа/автовхода/гостя — через `appendAdminAudit` или fallback‑логирование)

**UI‑механики:**

- автопереход на `index.html`, если сессия активна;
- переключение темы через атрибут `document.documentElement[data-theme]`;
- кнопка показать/скрыть пароль (`#passwordToggle`);
- уведомления на странице (fallback‑панель, если `Toast` не используется).

---

### `src/js/help.js`

**Назначение:** логика страницы `src/pages/help.html`:

- тема (переключение `body.light/body.dark`);
- навигация по предприятиям: по клику сохраняет `selectedEnterprise` и делает переход на `RMK.html`;
- поиск по справке (скрытие/показ секций + подсветка `<mark.help-search-highlight>`);
- «липкая» навигация по разделам и подсветка активного раздела при скролле внутри `.help-content`;
- инициализация авторизации в шапке: вызывает `window.renderAuth()`, а если её нет — подгружает `/src/js/modules/business/auth.js`.

**Ключи storage:**

- `localStorage.theme`
- `localStorage.selectedEnterprise`
- `sessionStorage.silentEnterpriseNav` — флаг для «тихого» перехода (без лишних эффектов/действий)

---

### `src/js/admin.js`

**Назначение:** вся логика админ‑панели `src/pages/admin.html`.

**Главные функции/подсистемы:**

- загрузка/нормализация данных из localStorage;
- проверка доступа (роль `admin`);
- тема + синхронизация темы с графиками;
- навигация по разделам (`dashboard/users/audit/export/backup`);
- пользователи (CRUD), аудит (фильтр/пагинация/очистка), бэкапы (создание/восстановление/удаление);
- экспорт данных (JSON/Excel);
- модальные окна и уведомления;
- графики Chart.js (users/audit/roles).

**Ключи localStorage (ADMIN_STORAGE):**

- `adminUsers` — пользователи админ‑панели
- `adminAuditLogs` — журнал аудита (общий с остальным приложением)
- `adminBackups` — бэкапы (снапшоты данных)
- `appInstallDate` — дата «установки» (используется для дефолтов)
- `adminSidebarCollapsed` — состояние свернутого меню

**Работа с аудитом:**

- в `admin.js` есть собственная нормализация/миграция дат (в т.ч. `tz`), чтобы корректно фильтровать по диапазонам.

**Chart.js:**

- создаёт графики `new Chart(...)` на `canvas#usersChart`, `#auditChart`, `#rolesChart`;
- при смене темы обновляет цвета сетки/подписей/заливок.

