# Документация HTML файлов проекта РТП

Актуально для состояния репозитория на **2026‑02‑16**.

## Содержание

- [Общий принцип работы страниц](#общий-принцип-работы-страниц)
- [Корневой редирект](#корневой-редирект)
  - [`index.html`](#indexhtml)
- [Страницы приложения (`src/pages/`)](#страницы-приложения-srcpages)
  - [`src/pages/index.html`](#srcpagesindexhtml)
  - [`src/pages/radar.html`](#srcpagesradarhtml)
  - [`src/pages/auth.html`](#srcpagesauthhtml)
  - [`src/pages/admin.html`](#srcpagesadminhtml)
  - [`src/pages/help.html`](#srcpageshelphtml)

## Общий принцип работы страниц

Проект — статическое веб‑приложение без сборки. HTML‑страницы:

- подключают CSS из `src/css/`;
- подключают JS из `src/js/` и/или модульные файлы из `src/js/modules/`;
- используют `localStorage` для состояния (например, выбранное предприятие, тема, авторизация);
- требуют запуска через локальный сервер (иначе браузер блокирует `fetch` JSON по CORS).

Общая шапка (в разных страницах может отличаться):

- `.logo` (ссылка на `index.html`);
- `.enterprise-nav` (кнопки предприятий);
- `.controls` (кнопка помощи `#helpBtn`, переключатель темы `#themeToggle`, блоки авторизации `#authInfo` и `#logoutContainer`).

## Корневой редирект

### `index.html`

**Назначение:** точка входа в корне репозитория. Делает мгновенное перенаправление на страницу приложения `src/pages/index.html`.

**Что содержит:**

- `<meta http-equiv="refresh" content="0; url=/src/pages/index.html">`
- fallback‑скрипт `window.location.href = '/src/pages/index.html'`
- текст + ссылка на случай, если редирект не сработал

**Как работает:** при открытии `/<root>/index.html` пользователь сразу попадает на главную страницу приложения в `src/pages/index.html`.

## Страницы приложения (`src/pages/`)

### `src/pages/index.html`

**Назначение:** главная страница‑«лендинг» с подсказкой выбора предприятия и интерактивным фоном (SVG‑радар). После выбора предприятия логика перехода/открытия радара реализована в JS.

**CSS:**

- `/src/css/styles.css` — стили главной
- `/src/css/common.css` — общие стили/тема/компоненты
- `/src/css/about.css` — общий декоративный слой/карточки/секционные стили (используется в нескольких страницах)

**JS:**

- `/src/js/modules/utils/func-cover-utils.js` — утилиты покрытия функций
- `/src/js/modules/ui/common-ui.js` — общий UI (тема и др.)
- `/src/js/modules/ui/notifications.js`, `/src/js/modules/ui/offline-handler.js`
- `/src/js/modules/ui/mobile-nav.js`, `/src/js/modules/ui/touch-handlers.js`
- `/src/js/audit-logger.js` — аудит действий (localStorage)
- `/src/js/script.js` — основная логика главной страницы (выбор предприятия, состояние UI)

**Ключевые DOM‑узлы:**

- `nav.enterprise-nav` — кнопки предприятий
- `#radarContainer` — контейнер визуализации
- `svg#techRadar` — SVG для «фонового» радара
- `#quadrantLabels` — подписи квадрантов (контейнер)
- `#hoverLabel` — tooltip‑подсказка при наведении (aria‑live)

**Поведение (высокоуровнево):**

- страница показывает подсказку «выберите предприятие»;
- кнопки предприятий активируют логику выбора предприятия (см. `script.js`);
- тема и подсказки управляются общими механизмами (shared UI).

### `src/pages/radar.html`

**Назначение:** основная страница радара технологий для всех ролей (архитекторы, директоры, РП, администраторы). Имеет модифицированный радар с позиционированием по готовности к реализации и внедрению, расширенные формы управления вендорами и интеграторами, а также прикрепление файлов к технологиям.

**Доступ:** Для всех авторизованных пользователей (архитекторы, директоры, РП, администраторы).

**CSS:**

- `/src/css/common.css` — общие стили/темы/компоненты
- `/src/css/RMK.css` — основная верстка/сайдбар/радар/панели (с модификациями для директорской страницы)
- `/src/css/about.css` — общие секционные стили
- `/src/css/rmk-inline-styles.css` — дополнительные стили и «точечные» правки интерфейса RMK

**Внешние библиотеки (CDN):**

- `jsPDF` (`jspdf.umd.min.js`)
- `jsPDF AutoTable` (`jspdf.plugin.autotable.min.js`)
- `html2canvas`

**JS:**

- единственный прямой `<script src="/src/js/RMK-director.js"></script>` в конце страницы (остальные модули подгружает сам `RMK-director.js`).

**Особенности:**

- **Модифицированный радар**:
  - Позиционирование технологий по готовности к реализации и внедрению
  - Размер кругов зависит от количества вендоров (0-1: 8px, 2-3: 14px, 4+: 20px)
  - Отсутствуют подписи колец
  - Все технологии отображаются только в виде кругов
- **Расширенные формы**:
  - Управление вендорами и интеграторами
  - Прикрепление файлов к технологиям
  - Подсказки для всех полей
  - Переименованные TRL оценки (1-Исследовательская, 2-Прототип, 3-Технология готова к внедрению)
- **Данные**: загружаются через `data-loader.js` из `blocks.json`, `technologies.json`, `enterprises.json`, `vendors.json`, `integrators.json` и др.; итоговые данные предприятий и технологий хранятся в StateManager и при сохранении — в VFS (`enterpriseData.json`). Поля вендоров и файлов поддерживаются в технологиях.

**Ключевые DOM‑узлы:**

- Радар (SVG + логика зума/выделения)
- Боковая панель (поиск/фильтры/списки по секторам)
- Панель деталей технологии
- Модальные окна (добавление/редактирование/экспорт)
- Панель приоритетов сектора
- `body#rmk-director` — идентификатор страницы для условной логики

**Как работает (общее описание потока):**

1. Страница загружает CDN‑библиотеки (PDF/скриншоты) и в конце — `RMK-director.js`.
2. `RMK-director.js` динамически подключает модули `src/js/modules/**` в нужном порядке (см. порядок загрузки в `MODULES_DOCUMENTATION.md`).
3. `core/data-loader.js` загружает данные из JSON (`blocks.json`, `technologies.json`, `enterpriseData` из VFS и т.д.); страница радара определяется по `body#rmk-director` для применения логики отображения (круги по вендорам, без подписей колец).
4. `radar/*` вычисляет координаты blip‑ов и рисует SVG с применением специальной логики для директорской страницы:
   - Размеры blip зависят от количества вендоров (0-1: 8px, 2-3: 14px, 4+: 20px)
   - Все технологии отображаются только в виде кругов
   - Отсутствуют подписи колец
5. `ui/*` управляет фильтрами, формами, модалками, подсказками, onboarding‑туром, вендорами и файлами.
6. `integration/events.js` связывает UI события (клики, ввод, зум, смена предприятия) с обновлением состояния и перерисовкой.
7. Все роли (архитекторы, директоры, РП, администраторы) имеют доступ к этой странице.

### `src/pages/auth.html`

**Назначение:** страница входа в систему.

**CSS:**

- `/src/css/auth.css`

**JS:**

- `/src/js/audit-logger.js`
- `/src/js/auth.js`

**Ключевые DOM‑узлы:**

- `#loginForm` — форма логина
- `#username`, `#password`, `#remember`
- `#passwordToggle` + `#eyeOn/#eyeOff` — показать/скрыть пароль
- `#submitBtn` — кнопка входа (есть состояние «loading»)
- `#themeToggle`, `#iconSun`, `#iconMoon` — переключение темы на странице логина

**Как работает:**

- данные пользователя и роль сохраняются в `localStorage`;
- при активной сессии выполняется автопереход на `index.html`;
- аудит входа/выхода и действий пишется в localStorage (подробно в `audit-logger.js` / `auth.js`).

### `src/pages/admin.html`

**Назначение:** админ‑панель (пользователи, аудит, экспорт, бэкапы, обзорные графики).

**CSS:**

- `/src/css/admin.css` — разметка/компоненты админки
- `/src/css/common.css` — общие стили
- `/src/css/about.css` — общие секционные стили

**Внешние библиотеки (CDN):**

- `Chart.js` — для графиков админ‑панели

**JS:**

- `/src/js/modules/utils/func-cover-utils.js` — утилиты расчёта покрытия функций
- `/src/js/modules/ui/common-ui.js` — общий UI (тема, уведомления)
- `/src/js/modules/ui/notifications.js`, `/src/js/modules/ui/offline-handler.js`
- `/src/js/modules/ui/mobile-nav.js`, `/src/js/modules/ui/touch-handlers.js`
- `/src/js/audit-logger.js`, `/src/js/modules/core/logger.js`, `/src/js/modules/core/error-handler.js`, `/src/js/modules/ui/toast.js`
- `/src/js/config/roles-config.js` — роли и системные учётки
- `/src/js/admin/admin-common.js` — общее состояние и хранилище админки
- `/src/js/admin/admin-dashboard.js`, `/src/js/admin/admin-users.js`, `/src/js/admin/admin-audit.js`, `/src/js/admin/admin-export.js`, `/src/js/admin/admin-backups.js`, `/src/js/admin/admin-enterprises.js` — разделы админ‑панели
- `/src/js/admin.js` — точка входа админки (проверка доступа, навигация, координация разделов)

**Ключевые DOM‑узлы (примеры):**

- `aside.admin-sidebar` + кнопки `.menu-item[data-section="..."]` — переключение разделов (dashboard, users, audit, export, backup, enterprises)
- `#adminSidebarToggle`, `#adminMobileMenu` — управление отображением меню
- `section.content-section` — секции контента (dashboard, users, audit, export, backup, enterprises)
- `canvas#usersChart`, `canvas#auditChart`, `canvas#rolesChart` — графики Chart.js

**Как работает (высокоуровнево):**

- проверка доступа по роли (localStorage, только `admin`);
- `admin.js` координирует разделы; данные читаются/пишутся через `AdminCommon` в localStorage (`adminUsers`, `adminAuditLogs`, `adminBackups` и т.д.);
- разделы «Пользователи», «Аудит», «Экспорт», «Бэкапы», «Предприятия» реализованы в `admin/*.js`; графики — Chart.js с синхронизацией темы.

### `src/pages/help.html`

**Назначение:** встроенная справка по продукту (описание функций, FAQ, рекомендации).

**CSS:**

- `/src/css/common.css`
- `/src/css/about.css`
- `/src/css/help.css`

**JS:**

- `/src/js/help.js`

**Ключевые DOM‑узлы:**

- `#helpSearch` — поиск по справке
- `.help-nav-menu` + ссылки `.help-nav-item[data-section="..."]` — навигация по разделам
- `.help-content` — основной контент
- набор секций `section.help-section` с якорями `#overview`, `#filters`, `#export`, `#faq`, …

**Как работает:**

- навигация по разделам построена на якорях и/или обработчиках в `help.js`;
- поиск фильтрует/подсвечивает совпадения по содержимому справки.
