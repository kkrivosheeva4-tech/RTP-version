# Документация JS файлов вне `src/js/modules/`

**Актуально на:** 04.03.2026

---

## 1. Общая картина

В `src/js/` есть два типа файлов:

- page-level и legacy скрипты (`auth.js`, `help.js`, `admin.js`, `RMK-director.js`);
- базовые утилиты/интеграционные скрипты, которые импортируются в `main.js` (`audit-logger.js`, `script.js`, `radar-utils.js`, `config/*`).

---

## 2. Файлы и назначение

### `src/js/audit-logger.js`

- Централизованный аудит действий в localStorage.
- Используется на auth/admin и через `main.js`.
- Экспортирует API в `window.AuditLogger` и алиасы для legacy-кода.

### `src/js/radar-utils.js`

- Геометрические и вспомогательные функции радара (`polarToCartesian`, `describeArc`, `debounce` и т.д.).
- Загружается через `main.js`.

### `src/js/script.js`

- Общий UI-layer: тема, tooltip, help-menu, auth-блок в шапке, общие обработчики.
- Загружается через `main.js`.

### `src/js/RMK-director.js`

- Legacy-загрузчик модулей предыдущей архитектуры.
- В актуальном flow (`index.html`, `radar.html`) не используется.
- Оставлен как справочный/совместимый файл.

### `src/js/auth.js`

- Логика страницы входа `auth.html`.
- Работает вместе с `roles-config.js` и `audit-logger.js`.

### `src/js/auth-2fa-setup.js`

- Логика страницы настройки 2FA (`auth-2fa-setup.html`).

### `src/js/auth-2fa-verify.js`

- Логика страницы подтверждения 2FA (`auth-2fa-verify.html`).

### `src/js/help.js`

- Навигация и поиск на странице `help.html`.

### `src/js/admin.js`

- Точка входа админ-панели.
- Координирует разделы `src/js/admin/*.js`.

### `src/js/admin/*.js`

- `admin-common.js`: состояние, storage, общие утилиты.
- `admin-dashboard.js`: дашборд и графики.
- `admin-users.js`: пользователи.
- `admin-audit.js`: журнал аудита.
- `admin-export.js`: экспорты.
- `admin-backups.js`: бэкапы.
- `admin-enterprises.js`: предприятия.

### `src/js/config/roles-config.js`

- Конфигурация ролей и role-based ограничений UI.

### `src/js/config/api-config-loader.js`

- Загрузчик локального API-конфига (`api-config.local.js`) перед базовым `api-config.js`.

### `src/js/config/api-config.js`

- Базовые настройки API (URL, таймауты, ключи токенов).

### `src/js/config/form-field-options.js`

- Конфигурация опций полей форм.

### `src/js/config/radar-model-config.example.js`

- Пример файла кастомизации параметров модели радара.

---

## 3. Актуальные точки подключения по страницам

- `index.html` -> `src/main.js`
- `radar.html` -> `src/main.js`
- `auth.html` -> `auth.js` + supporting scripts
- `auth-2fa-setup.html` -> `auth-2fa-setup.js`
- `auth-2fa-verify.html` -> `auth-2fa-verify.js`
- `help.html` -> `help.js` + supporting modules
- `admin.html` -> `admin.js` + `admin/*.js`

---

## 4. Примечание по миграции

Любые новые изменения для бизнес-логики радара должны вноситься через `src/main.js` и `src/js/modules/**`. Legacy-подход с динамической загрузкой из `RMK-director.js` считается архивным.
