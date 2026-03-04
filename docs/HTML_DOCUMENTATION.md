# Документация HTML файлов проекта РТП-3

**Актуально на:** 04.03.2026

---

## 1. Общий принцип

- Проект запускается через локальный сервер (`vite`, `preview` или любой static server).
- Корневой `index.html` выполняет редирект на `src/pages/index.html`.
- Основные страницы радара (`index.html`, `radar.html`) используют единый entrypoint: `src/main.js`.
- В проекте одновременно используются:
  - модульные скрипты (`type="module"`);
  - обычные скрипты (legacy/admin-flow).

---

## 2. Корневой файл

### `index.html` (в корне репозитория)

Назначение: мгновенный переход на `/src/pages/index.html`.

---

## 3. Страницы приложения (`src/pages/`)

### `src/pages/index.html`

Назначение: главная страница/лендинг с SVG-радаром и переходом в подробный режим.

Подключает CSS:

- `/src/css/styles.css`
- `/src/css/common.css`
- `/src/css/about.css`

Подключает JS:

- `<script type="module" src="/src/main.js"></script>`

### `src/pages/radar.html`

Назначение: основная рабочая страница радара технологий.

Подключает CSS:

- `/src/css/common.css`
- `/src/css/RMK.css`
- `/src/css/about.css`
- `/src/css/rmk-inline-styles.css`

Подключает JS:

- `https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js`
- `https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.28/dist/jspdf.plugin.autotable.min.js`
- `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js`
- `<script type="module" src="/src/main.js"></script>`

### `src/pages/auth.html`

Назначение: вход в систему (mock/API flow).

Подключает CSS:

- `/src/css/auth.css`

Подключает JS:

- `/src/js/modules/ui/common-ui.js` (module)
- `/src/js/modules/ui/offline-handler.js` (module)
- `/src/js/audit-logger.js` (module)
- `/src/js/config/roles-config.js`
- `/src/js/auth.js`

### `src/pages/auth-2fa-setup.html`

Назначение: настройка 2FA.

Подключает:

- CSS: `/src/css/auth.css`
- JS: `/src/js/auth-2fa-setup.js` (module)

### `src/pages/auth-2fa-verify.html`

Назначение: проверка кода 2FA.

Подключает:

- CSS: `/src/css/auth.css`
- JS: `/src/js/auth-2fa-verify.js` (module)

### `src/pages/admin.html`

Назначение: админ-панель (dashboard/users/audit/export/backups/enterprises).

Подключает CSS:

- `/src/css/admin.css`
- `/src/css/common.css`
- `/src/css/about.css`

Подключает JS:

- `Chart.js` (CDN)
- `/src/js/modules/ui/common-ui.js` (module)
- `/src/js/audit-logger.js` (module)
- `/src/js/config/roles-config.js`
- `/src/js/admin/admin-common.js`
- `/src/js/admin/admin-dashboard.js`
- `/src/js/admin/admin-users.js`
- `/src/js/admin/admin-audit.js`
- `/src/js/admin/admin-export.js`
- `/src/js/admin/admin-backups.js`
- `/src/js/admin/admin-enterprises.js`
- `/src/js/admin.js`

### `src/pages/help.html`

Назначение: встроенная справка по продукту.

Подключает CSS:

- `/src/css/common.css`
- `/src/css/about.css`
- `/src/css/help.css`

Подключает JS:

- `/src/js/modules/ui/common-ui.js` (module)
- `/src/js/modules/ui/notifications.js` (module)
- `/src/js/modules/ui/offline-handler.js` (module)
- `/src/js/help.js`

---

## 4. Примечания по актуальности

- Описание загрузки через `RMK-director.js` более не актуально для `index.html` и `radar.html`.
- Единый актуальный загрузчик для этих страниц: `src/main.js`.
