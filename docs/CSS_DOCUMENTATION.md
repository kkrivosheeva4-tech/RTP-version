# Документация CSS файлов проекта РТП-2.3

Актуально для состояния репозитория на **2026‑01‑13**.

## Содержание

- [Общие принципы и тема](#общие-принципы-и-тема)
- [Каталог CSS файлов](#каталог-css-файлов)
  - [`src/css/common.css`](#srccsscommoncss)
  - [`src/css/about.css`](#srccssaboutcss)
  - [`src/css/styles.css`](#srccssstylescss)
  - [`src/css/RMK.css`](#srccssrmkcss)
  - [`src/css/rmk-inline-styles.css`](#srccssrmk-inline-stylescss)
  - [`src/css/help.css`](#srccsshelpcss)
  - [`src/css/admin.css`](#srccssadmincss)
  - [`src/css/auth.css`](#srccssauthcss)

## Общие принципы и тема

В проекте используются 2 независимых механизма темы (это важно при поддержке):

1) **Основное приложение (`index.html`, `RMK.html`, `help.html`, `admin.html`)**  
   Обычно использует классы **`body.light` / `body.dark`** и CSS‑переменные из `src/css/common.css` (например `--bg`, `--text`, `--accent`, `--modal-bg`, `--input-border`, `--header-height`).

2) **Страница авторизации (`auth.html`)**  
   Использует **атрибут `data-theme="light|dark"` на `<html>`** и свой набор переменных в `src/css/auth.css` (они не завязаны на `body.light/body.dark`).

## Каталог CSS файлов

### `src/css/common.css`

**Роль:** базовый «фреймворк» проекта: глобальные переменные, общие компоненты, доступность, адаптивность, утилиты для модулей.

**Кто подключает:**

- `src/pages/index.html`
- `src/pages/RMK.html`
- `src/pages/help.html`
- `src/pages/admin.html`

**Что внутри (крупными блоками):**

- **Onboarding Tour**: `.onboarding-overlay`, `.onboarding-tooltip`, подсветка элементов (`.onboarding-highlight*`), управление `z-index` поверх модалок/панелей.
- **Contextual Hints**: стили для контекстных подсказок (в коде модуль может быть отключен, но CSS готов).
- **Tooltips (кастомные)**: базовый tooltip‑компонент с вариантами стрелок (top/bottom/left/right), плавные анимации позиционирования.
- **Тема / переменные**: блок `:root` + переопределения для `body.light` и `body.dark` (задают `--bg`, `--text`, `--input-bg`, `--modal-bg`, и т.д.).
- **Header + enterprise nav + controls**: оформление шапки, кнопок предприятий, переключателя темы, блока авторизации.
- **Loading / Error / Toast / Skeleton**: стили для `LoadingManager`, `ErrorDisplay`, `Toast`, skeleton‑заглушек.
- **Адаптивность и touch**: breakpoints (mobile/tablet/desktop), увеличение кликабельных зон.
- **A11y**: `.sr-only`, фокус‑стили `:focus-visible`, подсветка `aria-invalid`, `aria-expanded`, `aria-disabled`, поддержка увеличенного шрифта.

**Ключевые переменные, на которые опираются другие стили:**

- `--accent` — основной акцент (медный)
- `--bg`, `--text` — фон/текст текущей темы
- `--modal-bg`, `--input-bg`, `--input-border` — интерфейсные поверхности
- `--header-height` — высота фиксированного header (важно для `admin.css` и `help.css`)

---

### `src/css/about.css`

**Роль:** общий слой UI «О проекте» + «Помощь» + общий декоративный/карточный стиль, который используется в нескольких страницах.

**Кто подключает:**

- `src/pages/index.html`
- `src/pages/RMK.html`
- `src/pages/help.html`
- `src/pages/admin.html`

**Что внутри:**

- **About modal**: `.about-modal`, `.about-panel`, `.about-backdrop`, `.about-close` (стеклянный эффект + blur).
- **Кнопка “О проекте”**: `.about-btn` + подчёркивание текста (через `::after`).
- **Кнопка “Помощь”**: `.help-btn` + подчёркивание только текста (иконка отдельно анимируется).
- **Меню помощи**: `.help-menu` (выпадающее меню, позиционируется фиксировано).
- **Карточки/структура**: стили секций «Основные возможности», «Структура радара», «Легенда», цветовая кодировка квадрантов.
- **Доступность по ролям**: стили для состояний UI, завязанных на роль пользователя.
- **Адаптивность**: скрытие текстов кнопок на узких экранах и перестройка блоков.

---

### `src/css/styles.css`

**Роль:** стили главной страницы `src/pages/index.html` (лендинг + «фон» радара).

**Кто подключает:** `src/pages/index.html`

**Что внутри:**

- базовая типографика и фон страницы;
- стили **SVG‑радара** на главной: `.quadrant-group`, `.radar-line`, `.radar-arc`, `.blip`;
- анимации радара/«сканера»: `#scannerGroup`, `.scanner-line`, `.scanner-highlight`;
- подсказка выбора предприятия: `.selection-hint`, `.arrow-up`, анимация `bounce-up`.

---

### `src/css/RMK.css`

**Роль:** основной CSS для `src/pages/RMK.html` (вся рабочая UI‑плоскость: сайдбар, радар, панели, модалки, селекты, подсказки).

**Кто подключает:** `src/pages/RMK.html`

**Что внутри (по смысловым зонам):**

- **Переменные темы и базовая раскладка** (`:root`, `body.light`, `body.dark`, z-index‑правила панелей).
- **Sidebar**:
  - `.sidebar-wrapper` (collapsed/expanded),
  - `.sidebar-buttons` (вертикальная панель иконок),
  - `.sidebar` (основная панель), `.search-container`, `.filter-panel-sidebar`.
- **Фильтры / custom select**:
  - `.custom-select`, `.select-trigger`, `.select-options`,
  - стили чекбоксов и тегов мультивыбора,
  - отдельные правила для модальных селектов (`.custom-select-modal`).
- **Кнопка “Сбросить выбор”**: отдельная логика «перемещения» (иконка в панели → текстовая кнопка внутри фильтров).
- **Радар**:
  - hover/selected/highlighted состояния blip’ов,
  - подсветка секторов при наведении на элементы списка,
  - подписи колец и их позиционирование при zoom.
- **Legend**: контейнер и элементы легенды фигур.
- **Detail panel**: оформление правой панели деталей и её десктопное/мобильное поведение.
- **HoverLabel**: подсказка над blip (включая “хвостик”‑треугольник и отличия тем).
- **Modals**:
  - фиксированный header модалки и прокрутка body внутри,
  - встроенное подтверждение,
  - scrollbars и тонкие настройки прокрутки.

**Важно по `z-index`:**

- `.modal-panel`, `.detail-panel`, `#editTechPanel`, `#deleteConfirmModal` имеют явно заданные уровни, чтобы панели не «прятались» друг под друга.

---

### `src/css/rmk-inline-styles.css`

**Роль:** набор «точечных» правил, вынесенных из `RMK.html` (оптимизация и удобство поддержки).

**Кто подключает:** `src/pages/RMK.html`

**Что внутри:**

- **Скрытие элементов по умолчанию**: `.hidden`, `.hidden-by-default`, и id‑специфичные скрытия.
- **Prospects modal**: размеры `#prospectsModal`, контейнеры `#prospectsChartContainer`, `#prospectsTableContainer`, адаптивность.
- **Поиск по таблице графика**: `.table-search-container`, `#prospectsTableSearch`.
- **Утилитарные классы для JS** (пометки вида “js‑*” для flex/checkbox/выравниваний).

---

### `src/css/help.css`

**Роль:** «страничный» layout справки (фиксированный header, скролл внутри контента, sidebar навигации).

**Кто подключает:** `src/pages/help.html`

**Что внутри:**

- фиксация поведения `html, body` (без скролла у `body`, скролл внутри `.help-content`);
- `.help-main`, `.help-container`, `.help-sidebar`, `.help-content`;
- `.help-search-input` + подсветка результатов `.help-search-highlight`;
- стили карточек/FAQ, правила для dark/light, адаптивность.

---

### `src/css/admin.css`

**Роль:** полноценная UI‑сетка админ‑панели (layout v2).

**Кто подключает:** `src/pages/admin.html`

**Зависимость:** использует тему/переменные из `src/css/common.css` (`--bg`, `--text`, `--modal-bg`, `--accent`, `--input-border`, `--header-height`).

**Что внутри:**

- grid‑layout `.admin-shell` (sidebar + content);
- стили sidebar, menu items (active/hover), topbar, секций;
- таблицы, фильтры, кастомные селекты админки;
- модальные окна и уведомления (используются `admin.js`);
- отдельные правила для canvas графиков (чтобы не размывался текст), responsive и «light theme fixes».

---

### `src/css/auth.css`

**Роль:** полностью самостоятельный дизайн страницы авторизации (`auth.html`) — «glass card», фон с анимацией, формы, кнопки.

**Кто подключает:** `src/pages/auth.html`

**Модель темы:**

- переменные определены в `:root`,
- тёмная тема включается через селектор **`[data-theme="dark"]`**.

**Что внутри:**

- фон «радар» + геометрические фигуры (`.decor`, `.radar`, `.shape*`);
- стеклянная карточка `.card`, блок бренда `.brand*`;
- поля формы `.group`, `.input`, кнопки `.btn`, переключатель темы `.theme-toggle`;
- анимации (keyframes) и адаптивность.

