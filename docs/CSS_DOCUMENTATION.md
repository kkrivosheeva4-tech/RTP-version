# Документация CSS файлов проекта РТП-3

**Актуально на:** 04.03.2026

---

## 1. Схема стилей

Проект использует страничное подключение CSS:

- общая тема и shared-компоненты;
- отдельные стили страниц;
- для радара - фасадный `RMK.css`, который собирается через `@import` из нескольких файлов.

---

## 2. Какие стили подключаются по страницам

### `src/pages/index.html`

- `/src/css/styles.css`
- `/src/css/common.css`
- `/src/css/about.css`

### `src/pages/radar.html`

- `/src/css/common.css`
- `/src/css/RMK.css`
- `/src/css/about.css`
- `/src/css/rmk-inline-styles.css`

### `src/pages/auth.html`

- `/src/css/auth.css`

### `src/pages/auth-2fa-setup.html`

- `/src/css/auth.css`

### `src/pages/auth-2fa-verify.html`

- `/src/css/auth.css`

### `src/pages/admin.html`

- `/src/css/admin.css`
- `/src/css/common.css`
- `/src/css/about.css`

### `src/pages/help.html`

- `/src/css/common.css`
- `/src/css/about.css`
- `/src/css/help.css`

---

## 3. Каталог CSS файлов

### Базовые/общие

- `src/css/common.css` - переменные темы, shared-компоненты, доступность.
- `src/css/about.css` - стили блоков "О проекте"/"Помощь", декоративные элементы.

### Страничные

- `src/css/styles.css` - главная страница (`index.html`).
- `src/css/auth.css` - auth + 2FA страницы.
- `src/css/admin.css` - админ-панель.
- `src/css/help.css` - страница справки.

### Радар

- `src/css/RMK.css` - фасадный файл радара.
- `src/css/rmk-base.css` - базовые переменные/тема радара.
- `src/css/rmk-layout.css` - layout радара/панелей.
- `src/css/rmk-radar.css` - стили SVG-радара и blip.
- `src/css/rmk-modals.css` - модалки и формы.
- `src/css/rmk-components.css` - компоненты радара (селекты, панели, таблицы, кнопки).
- `src/css/rmk-inline-styles.css` - вынесенные точечные стили из `radar.html`.

### Архив

- `src/css/RMK.css.bak` - резервная копия, в runtime не подключается.

---

## 4. Важно

`src/css/RMK.css` не содержит весь UI радара в одном файле: он импортирует `rmk-base/layout/radar/modals/components`. При изменениях для страницы радара правки нужно вносить в соответствующий `rmk-*` файл.
