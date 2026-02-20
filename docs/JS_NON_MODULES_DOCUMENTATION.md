# Документация JS файлов (кроме `src/js/modules/`) проекта РТП

Актуально для состояния репозитория на **2026‑02‑16**.

## Содержание

- [Общий обзор](#общий-обзор)
- [Файлы](#файлы)
  - [`src/js/audit-logger.js`](#srcjsaudit-loggerjs)
  - [`src/js/radar-utils.js`](#srcjsradar-utilsjs)
  - [`src/js/script.js`](#srcjsscriptjs)
  - [`src/js/RMK-director.js`](#srcjsrmk-directorjs)
  - [`src/js/auth.js`](#srcjsauthjs)
  - [`src/js/help.js`](#srcjshelpjs)
  - [`src/js/config/roles-config.js`](#srcjsconfigroles-configjs)
  - [Скрипты админ‑панели (`src/js/admin/`)](#скрипты-админ-панели-srcjsadmin)
  - [`src/js/admin.js`](#srcjsadminjs)

## Общий обзор

Вне `src/js/modules/` находятся «страничные» и «базовые» скрипты:

- **`RMK-director.js`** — загрузчик модулей для основной страницы радара `radar.html`. Загружает все модули в правильном порядке и экспортирует константы в `window`.
- **`script.js`** — общий «скрипт шапки/темы/tooltip'ов» и логика некоторых страниц (главная, админка; также загружается в RMK-director через `RMK-director.js`).
- **`audit-logger.js`** — единый журнал аудита в `localStorage` + алиасы для всего проекта.
- **`auth.js`** — авторизация на отдельной странице `auth.html` (в этой странице не используется модуль `modules/business/auth.js`).
- **`help.js`** — поведение страницы справки `help.html`.
- **`config/roles-config.js`** — конфигурация ролей и системных учёток (используется страницей входа и админкой).
- **`admin.js`** — точка входа админ‑панели; координация разделов и навигации. Логика разделов вынесена в `src/js/admin/*.js`.
- **`radar-utils.js`** — чистые утилиты геометрии/дебаунса, экспортируемые в `window`.

---

## Файлы

### `src/js/audit-logger.js`

**Назначение:** централизованный аудит важных действий (логин/логаут/создание/удаление/экспорт/бэкап и т.д.) в `localStorage`.

**Где используется:** подключается на нескольких страницах (`auth.html`, `index.html`, `admin.html`, также грузится на RMK-director через `RMK-director.js`).

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

**Где используется:** на странице `radar.html` (через `RMK-director.js`, который загружает `radar-utils.js` одним из первых) и в модулях позиционирования/рендеринга.

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
- на `src/pages/radar.html` этот файл загружается динамически из `RMK-director.js` (как «base utility»)

**Ключи localStorage (по факту использования в файле):**

- `theme` — `light|dark`
- `role` — `admin|architect|director|project_manager|analyst`
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

- На RMK-director странице есть также модуль `src/js/modules/business/auth.js`, который тоже экспортирует `window.renderAuth`.
  Из-за порядка загрузки (см. `RMK-director.js`) **модульная версия `renderAuth` может переопределить функцию из `script.js`**.

---

### `src/js/RMK-director.js`

**Назначение:** основной «загрузчик и интегратор» для `src/pages/radar.html`.

Файл выполняет две роли:

1. **Загружает все модульные скрипты** из `src/js/modules/**` в строгом порядке (динамические `<script>` с `async=false`).
2. Экспортирует в `window` константы радара и глобальные переменные для использования модулями.

**Главные части:**

- `loadModule(src)` — загрузка одного скрипта
- `loadAllModules()` — последовательная загрузка списка модулей (включая `audit-logger.js`, `script.js`, `radar-utils.js` и все модули из `src/js/modules/`)
- Константы радара: `CENTER_X`, `CENTER_Y`, `RADIUS_STEP`, `POSITION_PAD`, `POSITION_ANGLE_PAD`, `MIN_BLIP_DISTANCE`, `RING_LABEL_WIDTH/HEIGHT` (экспортируются в `window.*`)
- `TECHTYPE_TO_SHAPE` — для директорской страницы все технологии отображаются как круги

**Экспорт в `window`:**

- геометрия/конфиг: `CENTER_X`, `CENTER_Y`, `RADIUS_STEP`, `POSITION_PAD`, `POSITION_ANGLE_PAD`, `MIN_BLIP_DISTANCE`, `RING_LABEL_WIDTH`, `RING_LABEL_HEIGHT`, `TECHTYPE_TO_SHAPE`
- синхронизированные данные: `RINGS`, `QUADRANTS`, `levelToRing` (инициализируются после загрузки данных в `app-init.js`)

**Особенности:**

- **Не загружает** `prospects-chart.js` для директорской страницы
- Инициализация приложения происходит автоматически в `core/app-init.js` после загрузки всех модулей
- Все роли (архитекторы, директоры, РП, администраторы) используют эту страницу

**Зависимости:**

- практически вся функциональность делегирована модулям `src/js/modules/**`.

---

### `src/js/auth.js`

**Назначение:** логика страницы `src/pages/auth.html` (логин/тема/показ пароля/уведомления).

**Особенность:** этот файл — отдельный путь авторизации, не использующий модуль `modules/business/auth.js`.

**Пользователи (вшиты в код):**

- `admin/admin123` → `role=admin`
- `architect/architect123` → `role=architect`

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
- навигация по предприятиям: по клику сохраняет `selectedEnterprise` и делает переход на `radar.html`;
- поиск по справке (скрытие/показ секций + подсветка `<mark.help-search-highlight>`);
- «липкая» навигация по разделам и подсветка активного раздела при скролле внутри `.help-content`;
- инициализация авторизации в шапке: вызывает `window.renderAuth()`, а если её нет — подгружает `/src/js/modules/business/auth.js`.

**Ключи storage:**

- `localStorage.theme`
- `localStorage.selectedEnterprise`
- `sessionStorage.silentEnterpriseNav` — флаг для «тихого» перехода (без лишних эффектов/действий)

---

### `src/js/config/roles-config.js`

**Назначение:** конфигурация ролей приложения и системных учёток для mock-авторизации и шаблона пользователей в админке.

**Где используется:** подключается на `auth.html` (опционально) и на `admin.html`; потребляется модулем `modules/business/auth.js` и админ‑разделами.

**Экспорт в `window`:**
- `window.RolesConfig` — константы ролей, отображаемые названия, `getUsersForMockAuth()`, `getSystemAccountsForAdmin()`.

---

### Скрипты админ‑панели (`src/js/admin/`)

Подключаются только на `src/pages/admin.html` в порядке зависимостей. Общее состояние и хранилище — в `AdminCommon`.

| Файл | Назначение |
|------|------------|
| `admin-common.js` | Общее состояние (AdminState), ключи localStorage, утилиты чтения/записи, уведомления. Экспорт: `window.AdminCommon`. |
| `admin-dashboard.js` | Раздел «Дашборд»: статистика, графики Chart.js (usersChart, auditChart, rolesChart). Экспорт: `window.AdminDashboard`. |
| `admin-users.js` | Раздел «Пользователи»: CRUD пользователей. Экспорт: `window.AdminUsers`. |
| `admin-audit.js` | Раздел «Аудит»: журнал аудита, фильтрация, пагинация. Экспорт: `window.AdminAudit`. |
| `admin-export.js` | Раздел «Экспорт»: экспорт данных (JSON/Excel). Экспорт: `window.AdminExport`. |
| `admin-backups.js` | Раздел «Бэкапы»: создание/восстановление/удаление снапшотов. Экспорт: `window.AdminBackups`. |
| `admin-enterprises.js` | Раздел «Предприятия»: обзор/управление предприятиями. Экспорт: `window.AdminEnterprises`. |

**Ключи localStorage (через AdminCommon):** `adminUsers`, `adminAuditLogs`, `adminBackups`, `appInstallDate`, `adminSidebarCollapsed` и др.

---

### `src/js/admin.js`

**Назначение:** точка входа админ‑панели `src/pages/admin.html` — проверка доступа, тема, навигация по разделам, координация подмодулей `admin/*.js`.

**Главные функции:**

- проверка доступа (роль `admin`), при отсутствии — редирект;
- инициализация темы через `CommonUI.initTheme()` и синхронизация с графиками (`AdminDashboard.applyChartsTheme`);
- навигация по разделам (`dashboard`, `users`, `audit`, `export`, `backup`, `enterprises`) и вызов соответствующих подмодулей (`AdminDashboard`, `AdminUsers`, `AdminAudit`, `AdminExport`, `AdminBackups`, `AdminEnterprises`);
- загрузка данных и обновление текущего раздела при переключении.

**Зависимости:** `AdminCommon`, `AdminDashboard`, `AdminUsers`, `AdminAudit`, `AdminExport`, `AdminBackups`, `AdminEnterprises`, `CommonUI`, `renderAuth` (если есть). Ключи localStorage и работа с аудитом/графиками реализованы в подмодулях `admin/*.js`.
