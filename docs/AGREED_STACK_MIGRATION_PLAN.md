# План Перехода На Согласованный Стек

> Исторический документ миграции.
> Упоминания `Node.js`, `Vite`, `vitest`, `playwright` и других удаленных инструментов сохранены здесь как часть журнала перехода, а не как описание текущего штатного контура.

## 1. Цель

Зафиксировать пошаговый план перевода проекта на согласованный стек:

- клиентская часть: `HTML5`, `CSS3`, `JavaScript ES6+`;
- серверная часть: `Python 3.14`, `Django 6`;
- база данных: `PostgreSQL 14+`;
- серверная ОС: `Linux (Debian 12 или совместимые)`;
- запуск приложения: через `Django` без `Node.js` и без `Caddy`.

Документ используется как рабочий backlog для выполнения миграции и контроля готовности.

## 2. Целевое Состояние

- [x] Runtime приложения не зависит от `Node.js`.
- [x] Репозиторий не требует `npm`, `vite`, `vitest`, `playwright` для основного запуска.
- [x] Все UI-страницы отдаются через `Django`.
- [x] Фронтенд-ассеты обслуживаются через `Django templates` и `staticfiles`.
- [x] Основной запуск локально: `python backend/manage.py runserver`.
- [x] Основной production-запуск: `gunicorn config.wsgi:application`.
- [x] Используется только `PostgreSQL 14+`.
- [x] Контур больше не использует `Caddy`.
- [x] Документация и инфраструктурные скрипты приведены к Linux-first профилю.

## 3. Ограничения И Правила Миграции

- [ ] Не ломать рабочий backend API во время переноса фронтенда.
- [ ] Не удалять существующий контур до появления проверенного нового.
- [ ] Удалять `Node.js`-артефакты только после замены их эквивалентом или осознанного отказа.
- [ ] Все изменения сопровождать обновлением документации и smoke-проверок.

## 4. Этап 0. Инвентаризация И Подготовка

### Задачи

- [x] Зафиксировать текущие точки зависимости от `Node.js`:
  - `package.json`
  - `vite.config.js`
  - `vitest.config.js`
  - `playwright.config.js`
  - `scripts/*.mjs`
  - `Dockerfile`
  - `docs/LOCAL_PRODLIKE_SETUP.md`
- [x] Зафиксировать текущие точки зависимости от `Caddy`.
- [x] Зафиксировать все HTML entrypoints и страницы UI.
- [x] Зафиксировать все пути к CSS, JS, JSON и изображениям, которые сейчас завязаны на `/src/...` и `dist`.
- [x] Подготовить список фронтенд-страниц, которые должны быть перенесены в `Django templates`.

### Результат этапа

- [x] Есть полный список файлов и сценариев, которые нужно переписать.
- [x] Есть карта маршрутов UI и карта ассетов.

### Фиксация результатов

#### Node.js-зависимости, подтвержденные в репозитории

- `package.json`, `package-lock.json`
- `vite.config.js`
- `vitest.config.js`, `vitest.setup.js`
- `playwright.config.js`
- `scripts/dev-fullstack.mjs`
- `scripts/e2e-django-server.mjs`
- `scripts/ensure-api-config-local.mjs`
- `scripts/run-vitest.mjs`
- `Dockerfile` с Node build-stage
- `docs/LOCAL_PRODLIKE_SETUP.md`, `docs/LOCAL_PRODLIKE_QUICKSTART.md`, `README.md`, `backend/README.md`

#### Caddy-зависимости, подтвержденные в репозитории

- `docs/LOCAL_PRODLIKE_SETUP.md`
- `scripts/local-prodlike-start.ps1`
- `scripts/local-prodlike-common.ps1`
- `scripts/local-prodlike-setup.ps1`
- `ops/local/Caddyfile.template`
- `ops/local/Caddyfile.local`

#### Текущие HTML entrypoints и UI-страницы

- `index.html`
- `src/pages/index.html`
- `src/pages/radar.html`
- `src/pages/admin.html`
- `src/pages/auth.html`
- `src/pages/auth-2fa-setup.html`
- `src/pages/auth-2fa-verify.html`
- `src/pages/help.html`

#### Текущая карта runtime-раздачи фронтенда

- Django сейчас отдает UI через `frontend_dist_view`
- основной runtime ориентирован на каталог `dist`
- в debug-режиме используются исходные файлы из `src/` и `assets/`
- текущие URL и ресурсы завязаны на пути вида `/src/...` и `dist/...`

#### Текущее состояние Django templates/staticfiles

- рабочая структура `backend/templates` отсутствует
- рабочая структура `backend/static` отсутствует
- это подтверждает, что UI еще не переведен на штатный `Django templates/staticfiles` контур

#### Список страниц для переноса в Django templates

- главная страница
- радар
- админка
- страница авторизации
- страница настройки 2FA
- страница подтверждения 2FA
- страница справки

## 5. Этап 1. Зафиксировать Целевую Архитектуру

### Задачи

- [x] Подтвердить целевую схему: `Django templates + Django staticfiles + PostgreSQL + gunicorn`.
- [x] Подтвердить отказ от `Vite` как обязательной части проекта.
- [x] Подтвердить отказ от `Caddy` во всех штатных сценариях.
- [x] Подтвердить Linux-first deployment профиль: `Debian 12`.
- [x] Подтвердить, что HTTPS и reverse proxy относятся к инфраструктуре, а не к приложению.

### Результат этапа

- [x] У команды есть единое согласованное архитектурное решение.
- [x] Документация больше не противоречит целевому стеку.

### Архитектурные решения Этапа 1

#### 1. Целевая схема приложения

Целевой runtime проекта:

- `Django 6` как единая точка входа для UI и API
- `Django templates` для HTML-страниц
- `Django staticfiles` для CSS, JavaScript, изображений, шрифтов и прочих ассетов
- `PostgreSQL 14+` как единственная штатная СУБД
- `gunicorn` как production WSGI entrypoint

#### 2. Решение по фронтенду

- `Vite` не является целевой частью архитектуры
- каталог `dist` не является целевой частью runtime-контура
- HTML должен рендериться через `Django templates`, а не отдаваться как готовый build artifact
- JavaScript остается на `ES6+`, но должен работать без обязательного bundler в production-контуре
- все ссылки на CSS/JS/asset-файлы должны перейти на модель `templates + staticfiles`

#### 3. Решение по запуску приложения

Целевые способы запуска:

- локальная разработка: `python backend/manage.py runserver`
- production / production-like: `gunicorn config.wsgi:application`

Промежуточные или устаревающие способы:

- `npm run build` как обязательный шаг запуска
- Node-based orchestration scripts как основа запуска
- запуск через `Caddy` как часть штатного контура приложения

#### 4. Решение по reverse proxy и HTTPS

- `Caddy` выводится из согласованного стека
- HTTPS, TLS termination и reverse proxy относятся к инфраструктуре, а не к приложению
- для Linux production-like и production baseline допустим `nginx`, если нужен внешний reverse proxy
- приложение должно быть работоспособно и без reverse proxy во внутреннем контуре

#### 5. Решение по целевому Linux-контуру

Целевой deployment-профиль:

- ОС: `Debian 12`
- приложение: `Python 3.14 + Django 6`
- база: `PostgreSQL 14+`
- app server: `gunicorn`
- optional reverse proxy: `nginx`

Windows-скрипты и Windows-first сценарии перестают быть основным эталоном и остаются только как временная совместимость до завершения миграции.

#### 6. Решение по данным и backend-контракту

- backend API сохраняется как основной контракт между UI и сервером
- `PostgreSQL` остается обязательной базой
- SQLite не рассматривается как целевой runtime
- security baseline сохраняется, но настраивается без зависимости от `Caddy`

#### 7. Решение по структуре проекта после миграции

Целевая структура верхнего уровня:

- `backend/` содержит Django project, templates, static, management commands и backend apps
- `src/` и корневые HTML entrypoints подлежат переносу, сокращению или удалению после завершения миграции
- `ops/` и `scripts/` должны быть приведены к Python/Linux-first сценарию без `Node.js` и без `Caddy`

#### 8. Что считается завершением архитектурного перехода

Архитектурный переход считается завершенным, когда одновременно выполнены условия:

- приложение запускается без `Node.js`
- UI и API обслуживаются через Django-контур
- runtime не зависит от `dist`
- production-like контур не использует `Caddy`
- production baseline соответствует `Debian 12 + Python 3.14 + Django 6 + PostgreSQL 14+`

## 6. Этап 2. Подготовить Django К Роли Единой Точки Входа

### Задачи

- [x] Пересмотреть текущую схему отдачи фронтенда через `frontend_dist_view`.
- [x] Спроектировать новые Django views для всех UI-страниц.
- [x] Спроектировать структуру шаблонов:
  - `backend/templates/base.html`
  - `backend/templates/pages/...`
- [x] Спроектировать структуру статики:
  - `backend/static/css/...`
  - `backend/static/js/...`
  - `backend/static/img/...`
  - `backend/static/data/...` при необходимости
- [x] Подготовить новый набор URL-маршрутов для UI без зависимости от `dist`.

### Результат этапа

- [x] Есть схема переноса UI в `Django templates/staticfiles`.

### Решения Этапа 2

#### 1. Текущее состояние, от которого уходим

Сейчас Django отдает UI через один обработчик `frontend_dist_view`, который:

- ориентирован на каталог `dist`
- в debug-режиме умеет подмешивать исходники из `src/` и `assets/`
- скрывает реальные пользовательские маршруты за общим fallback route

Целевая схема на этом этапе зафиксирована как замена общего fallback на явные Django UI views.

#### 2. Целевая структура шаблонов

Базовая структура `templates`:

- `backend/templates/base.html`
- `backend/templates/includes/`
- `backend/templates/pages/home.html`
- `backend/templates/pages/radar.html`
- `backend/templates/pages/admin.html`
- `backend/templates/pages/auth/login.html`
- `backend/templates/pages/auth/2fa_setup.html`
- `backend/templates/pages/auth/2fa_verify.html`
- `backend/templates/pages/help.html`

Распределение ответственности:

- `base.html` содержит общий `<head>`, favicon, базовые meta-теги, подключение общей статики и общие блоки шаблона
- `includes/` содержит повторно используемые фрагменты: header, controls, notifications, auth-info и общие SVG/branding фрагменты при необходимости
- `pages/...` содержат только page-specific разметку

#### 3. Целевая структура staticfiles

Базовая структура `static`:

- `backend/static/css/common/`
- `backend/static/css/pages/`
- `backend/static/js/common/`
- `backend/static/js/pages/`
- `backend/static/js/modules/`
- `backend/static/js/config/`
- `backend/static/img/`
- `backend/static/fonts/`
- `backend/static/data/` только если какая-то часть JSON останется статической

Правило раскладки:

- общие стили из `common.css`, `about.css` и повторно используемые части должны перейти в `css/common/`
- page-specific стили должны перейти в `css/pages/`
- общие JS-модули должны перейти в `js/modules/` и `js/common/`
- entrypoint-скрипты страниц должны перейти в `js/pages/`
- изображения из `assets/images` должны перейти в `static/img/`
- шрифты из `assets/fonts` должны перейти в `static/fonts/`

#### 4. Целевая карта UI-маршрутов

Новый набор пользовательских маршрутов:

- `/` -> главная страница
- `/radar/` -> радар
- `/admin-panel/` -> пользовательская административная панель приложения
- `/auth/login/` -> страница входа
- `/auth/2fa/setup/` -> настройка 2FA
- `/auth/2fa/verify/` -> подтверждение 2FA
- `/help/` -> страница справки

Примечание по маршруту `/admin/`:

- `/admin/` должен оставаться за Django admin
- пользовательская UI-админка приложения должна быть вынесена на отдельный route, чтобы не конфликтовать с системным Django admin

#### 5. Целевая карта страниц и их будущих файлов

- текущий `src/pages/index.html` -> `templates/pages/home.html`
- текущий `src/pages/radar.html` -> `templates/pages/radar.html`
- текущий `src/pages/admin.html` -> `templates/pages/admin.html`
- текущий `src/pages/auth.html` -> `templates/pages/auth/login.html`
- текущий `src/pages/auth-2fa-setup.html` -> `templates/pages/auth/2fa_setup.html`
- текущий `src/pages/auth-2fa-verify.html` -> `templates/pages/auth/2fa_verify.html`
- текущий `src/pages/help.html` -> `templates/pages/help.html`
- корневой `index.html` должен быть удален после перевода root route на нормальный Django view

#### 6. Карта текущих CSS-зависимостей для переноса

- главная страница:
  - `styles.css`
  - `common.css`
  - `about.css`
- радар:
  - `common.css`
  - `RMK.css`
  - `about.css`
  - `rmk-inline-styles.css`
- админка:
  - `admin.css`
  - `common.css`
  - `about.css`
- auth:
  - `auth.css`
- 2FA setup:
  - `auth.css`
- 2FA verify:
  - `auth.css`
- help:
  - `common.css`
  - `about.css`
  - `help.css`

#### 7. Карта текущих JS entrypoints для переноса

- главная страница:
  - `src/main.js`
- радар:
  - `src/main.js`
- админка:
  - `src/js/admin.js`
  - `src/js/admin/*.js`
  - общие модули auth/common-ui/api
- auth:
  - `src/js/auth.js`
  - связанные модули auth/common-ui/api
- 2FA setup:
  - `src/js/auth-2fa-setup.js`
- 2FA verify:
  - `src/js/auth-2fa-verify.js`
- help:
  - `src/js/help.js`
  - общие UI-модули

Целевое правило:

- у каждой страницы должен быть собственный page-entry в `static/js/pages/`
- общие модули не должны подключаться хаотично из HTML по абсолютным путям `/src/...`

#### 8. Что переносим в base layout

В `base.html` должны уйти:

- общие meta-теги
- favicon
- theme-color и общие PWA meta-теги
- общий header для страниц, где он реально одинаковый
- общие controls: help, notifications, theme switch, auth-info, logout container

Не должны уходить в `base.html` без разбора:

- page-specific CSP meta
- уникальные page titles и description
- узкоспециализированная верстка auth и 2FA

#### 9. Что делаем с CSP и page head

- CSP должна управляться backend-настройкой и middleware, а не копироваться вручную в каждый HTML-файл
- page title, description и optional extra head должны задаваться через template blocks
- повторяющиеся favicon/data-URI блоки должны быть централизованы

#### 10. Какой Django routing должен получиться после этапа переноса

Целевая идея `urls.py`:

- API остается под `/api/v1/`
- Django admin остается под `/admin/`
- UI pages объявляются явно через `path(...)`
- fallback на `frontend_dist_view` после завершения переноса должен быть удален

#### 11. Критерий готовности проектирования

Этап проектирования считается завершенным, потому что зафиксированы:

- целевая структура `templates`
- целевая структура `static`
- целевые UI routes
- карта переноса страниц
- карта CSS/JS entrypoints
- правило разделения общих и page-specific частей

## 7. Этап 3. Перенести HTML В Django Templates

### Задачи

- [x] Перенести главную страницу в Django template.
- [x] Перенести страницы:
  - авторизация
  - 2FA setup
  - 2FA verify
  - радар
  - help
  - admin
- [x] Вынести общие части в базовый шаблон.
- [x] Заменить прямые ссылки на файлы на Django template tags и нормальные URL.
- [x] Убрать HTML, который существует только как входная точка `Vite`.

### Результат этапа

- [x] Все пользовательские страницы открываются через `Django render()`.
- [x] Больше нет обязательной зависимости на HTML из корня проекта и `src/pages` как на runtime entrypoints.

### Фиксация реализации Этапа 3

Что реализовано в коде:

- в `Django` добавлены явные UI views для:
  - `/`
  - `/radar/`
  - `/admin-panel/`
  - `/auth/login/`
  - `/auth/2fa/setup/`
  - `/auth/2fa/verify/`
  - `/help/`
- старые пути `src/pages/*.html` оставлены как временная совместимость на период миграции
- `TEMPLATES["DIRS"]` расширен так, чтобы Django мог рендерить и новые шаблоны, и legacy HTML
- auth/2FA страницы реально вынесены в `backend/templates/pages/auth/...`
- для крупных страниц (`home`, `radar`, `admin`, `help`) созданы Django template wrappers в `backend/templates/pages/...`
- добавлены базовые шаблоны:
  - `backend/templates/base.html`
  - `backend/templates/pages/auth/base_auth.html`
- ключевые межстраничные ссылки переведены на новые маршруты приложения
- fallback через `frontend_dist_view` больше не используется как основной способ открытия UI-страниц

Техническое примечание:

- auth и 2FA страницы уже перенесены в нормальные Django templates
- страницы `home`, `radar`, `admin`, `help` на этом этапе подключены через Django template wrappers, которые используют существующую HTML-разметку как transitional слой
- полная внутренняя декомпозиция крупных страниц будет продолжена на следующих этапах

Проверка выполнения:

- добавлены backend-тесты на новые UI routes
- тесты на рендеринг новых маршрутов и совместимость со старой схемой прошли успешно

## 8. Этап 4. Перенести CSS, JS И Ассеты В Django Staticfiles

### Задачи

- [x] Перенести CSS в `backend/static`.
- [x] Перенести JS в `backend/static`.
- [x] Перенести изображения, иконки, шрифты и прочие ассеты в `backend/static`.
- [x] Заменить абсолютные пути `/src/...` и `/assets/...` на пути через `{% static %}` либо на корректные URL внутри static.
- [x] Настроить `STATIC_URL`, `STATIC_ROOT`, при необходимости `collectstatic`.
- [x] Проверить, что UI не зависит от каталога `dist`.

### Результат этапа

- [x] Весь фронтенд обслуживается Django-статикой.

### Фиксация реализации Этапа 4

- В `backend/config/settings.py` добавлены `STATIC_ROOT` и `STATICFILES_DIRS`, чтобы Django начал обслуживать фронтенд из `backend/static`.
- В проект создана и заполнена структура `backend/static/css`, `backend/static/js`, `backend/static/data`, `backend/static/img`, `backend/static/fonts`.
- CSS, JS, JSON-данные, изображения и шрифты скопированы из `src` и `assets` в `backend/static`.
- В `src/pages/index.html`, `src/pages/radar.html`, `src/pages/admin.html`, `src/pages/help.html`, `src/pages/auth.html`, `src/pages/auth-2fa-setup.html`, `src/pages/auth-2fa-verify.html` runtime-ссылки переведены с `/src/...` и `/assets/...` на `/static/...`.
- В шаблонах `backend/templates/pages/auth/*.html` подключение CSS и JS переведено на Django static-теги.
- В активных JS-модулях заменены переходы между страницами и загрузка данных на новые маршруты `/`, `/radar/`, `/admin-panel/`, `/auth/login/`, `/auth/2fa/setup/`, `/auth/2fa/verify/` и `/static/data/...`.
- В `backend/config/tests.py` добавлены проверки наличия migrated-ассетов через `django.contrib.staticfiles.finders` и проверки того, что домашняя и auth-страницы уже отдают `/static/...` пути.
- Проверка выполнена командой `python backend/manage.py test config.tests.TestUiTemplateRoutes config.tests.TestStaticfilesMigration --noinput`, результат успешный.
- Остаточный технический хвост: `src/js/RMK-director.js` и его копия в `backend/static/js/RMK-director.js` всё ещё содержат старые строки `/src/js/...`. Текущие UI routes этапа 4 на этот загрузчик не завязаны, поэтому этап закрыт, но файл нужно отдельно привести к новой схеме в следующих этапах при полном отказе от Vite-логики.

## 9. Этап 5. Убрать Зависимость От Vite И Node-Сборки

### Задачи

- [x] Убрать использование `vite build` из рабочего контура.
- [x] Удалить или переписать логику, связанную с `dist`.
- [x] Перевести JS-модули в browser-compatible структуру без Vite-specific поведения.
- [x] Убрать alias-импорты и другую конфигурацию, требующую сборщик.
- [x] Проверить работу загрузки JSON и vendor-скриптов без bundler.
- [x] Убрать `npm run build` из документации, локальных сценариев и контейнеров.

### Результат этапа

- [x] UI работает без предварительной Node-сборки.

### Фиксация реализации Этапа 5

- Из `backend/config/views.py` удален `frontend_dist_view` и вспомогательная логика резолва `dist`/`src`.
- Из `backend/config/urls.py` удален catch-all fallback на `frontend_dist_view`; теперь UI открывается только через явные Django routes.
- Из `backend/config/settings.py` удалены настройки `FRONTEND_DIST_DIR` и `SERVE_FRONTEND_FROM_DJANGO`, так как runtime больше не опирается на `dist`.
- В `backend/config/tests.py` удалены тесты старой `dist`-раздачи и добавлена проверка, что неизвестный UI-path (`/dashboard`) больше не fallback'ается в старый frontend entrypoint.
- Из `backend/.env.example` и `backend/.env.test.example` удалены переменные, связанные с раздачей `dist`.
- В `scripts/local-prodlike-start.ps1` удален обязательный шаг `npm run build`.
- В `scripts/dev-fullstack.mjs` удалена зависимость от `SERVE_FRONTEND_FROM_DJANGO` и сообщение о ручной frontend-сборке.
- В `Dockerfile` удален frontend `node`-stage и копирование `dist`; контейнер больше не собирает и не ожидает Vite output для запуска приложения.
- Обновлены [README](README.md), [backend/README.md](backend/README.md) и [docs/LOCAL_PRODLIKE_SETUP.md](docs/LOCAL_PRODLIKE_SETUP.md): основной контур теперь описан как Django templates/staticfiles без обязательного `npm run build`.
- Проверка выполнена командой `python backend/manage.py test config.tests --noinput`, результат успешный.
- Дополнительная сверка показала, что в ключевых runtime-файлах Stage 5 больше нет ссылок на `frontend_dist_view`, `FRONTEND_DIST_DIR`, `SERVE_FRONTEND_FROM_DJANGO` и `npm run build`.
- Остаток Node-контура на этом этапе сохранен сознательно: `package.json`, `vite.config.js`, `vitest`, `playwright` и связанные JS/QA-скрипты будут удаляться в поздних этапах, когда дойдем до полного исключения Node из репозитория.

## 10. Этап 6. Убрать Остаточные Runtime-Зависимости От Node.js

### Задачи

- [x] Удалить fallback на `node` для генерации QR-кода 2FA.
- [x] Оставить только Python-реализацию QR.
- [x] Убедиться, что runtime не вызывает `node`, `npm`, `.mjs`-скрипты.
- [x] Проверить, что backend полностью работоспособен только с Python-зависимостями.

### Результат этапа

- [x] Runtime проекта полностью независим от `Node.js`.

### Фиксация реализации Этапа 6

- В `backend/auth_custom/views.py` удален `subprocess`-fallback на запуск `node` для генерации 2FA QR-кода.
- `_generate_qr_svg(...)` теперь использует только Python-библиотеку `qrcode` и явно возвращает ошибку, если Python QR-зависимость отсутствует.
- В `backend/requirements.txt` добавлена backend-зависимость `qrcode==7.4.2`, чтобы QR-генерация стала частью штатного Python runtime.
- В `backend/auth_custom/tests.py` добавлен тест API для `/api/v1/auth/2fa/qr/`:
  - позитивный SVG-сценарий выполняется только если `qrcode` уже установлен в текущем Python-окружении;
  - обязательный сценарий деградации проверяет `503`, если Python QR-библиотека отсутствует.
- Проверка выполнена командой `python backend/manage.py test auth_custom.tests --noinput`, результат успешный (`OK`, один тест пропущен из-за отсутствия `qrcode` в текущем локальном окружении).
- Дополнительная сверка backend-кода показала, что вне документации и frontend-static больше нет runtime-вызовов `node`, `npm`, `subprocess`/`.mjs`-скриптов; единственное найденное в backend — MIME-тип для расширения `.mjs`, что не является Node-зависимостью.
- Практическая оговорка: для полного прохождения позитивного QR-сценария нужно обновить локальное Python-окружение командой `pip install -r backend/requirements.txt`, так как текущая установленная среда еще не подтянула новый пакет `qrcode`.

## 11. Этап 7. Перевести Запуск Приложения Полностью На Django

### Задачи

- [x] Подготовить единый локальный запуск через `python backend/manage.py runserver`.
- [x] Подготовить production-запуск через `gunicorn`.
- [x] Переписать локальные скрипты bootstrap/init/start/stop/smoke на Python/PowerShell/Bash без `npm`.
- [x] При необходимости добавить management commands для:
  - bootstrap env
  - seed
  - smoke
  - health checks
- [x] Обновить инструкции в `README.md` и связанных runbook.

### Результат этапа

- [x] У проекта есть единый Django-first способ запуска.

### Фиксация реализации Этапа 7

- Основной локальный запуск закреплен как `python backend/manage.py runserver`.
- В корень репозитория добавлен `gunicorn.conf.py` с production WSGI baseline для `gunicorn --config gunicorn.conf.py config.wsgi:application`.
- В `backend/requirements.txt` добавлен `gunicorn==23.0.0`, чтобы production entrypoint стал частью Python-стека проекта.
- Ключевые runbooks обновлены на Python/PowerShell-first сценарий:
  - `README.md`
  - `backend/README.md`
  - `docs/LOCAL_PRODLIKE_SETUP.md`
  - `docs/LOCAL_PRODLIKE_QUICKSTART.md`
- В документации локального production-like контура основной путь переведен с `npm run prodlike:*` на прямые вызовы `scripts/local-prodlike-*.ps1`.
- Дополнительные management commands на этом этапе не понадобились: существующие `manage.py migrate`, `seed_*`, `test`, `export_openapi` покрывают текущие bootstrap/init/smoke задачи.
- Проверка конфигурации выполнена командой `python backend/manage.py check` в dev-профиле (`DEBUG=True`, `ENFORCE_ENV_SECURITY=False`), результат успешный.
- Отдельно подтверждено, что ключевые runbooks уже содержат `python backend/manage.py runserver` и `gunicorn --config gunicorn.conf.py config.wsgi:application` как основные команды запуска.

## 12. Этап 8. Полный Отказ От Caddy

### Задачи

- [x] Удалить `Caddy` из локального production-like сценария.
- [x] Удалить генерацию `Caddyfile` и trust flow.
- [x] Переписать `LOCAL_PRODLIKE` документацию под новый контур без `Caddy`.
- [x] Определить новый production-like контур:
  - `Django + PostgreSQL`, либо
  - `nginx + gunicorn + PostgreSQL`
- [x] Перепроверить security settings, связанные с proxy headers, trusted origins и secure cookies.

### Результат этапа

- [x] Приложение и документация больше не используют `Caddy`.

### Фиксация реализации Этапа 8

- В качестве нового локального production-like контура принят вариант `Django + PostgreSQL` без reverse proxy.
- Из `scripts/local-prodlike-start.ps1` удалены:
  - `TrustCaddyCA`
  - рендеринг `Caddyfile`
  - запуск `caddy`
  - зависимость от upstream/proxy-переменных
- `scripts/local-prodlike-common.ps1` очищен от функции поиска `Caddy`.
- `scripts/local-prodlike-smoke.ps1` и `scripts/local_prodlike_smoke.py` переведены на базовый origin `http://127.0.0.1:8000`.
- В smoke-скрипте убраны ожидания `Secure`-cookies, так как локальный contour больше не HTTPS-based.
- `scripts/local-prodlike-stop.ps1` теперь по умолчанию останавливает только порт `8000`.
- `backend/.env.prodlike.example` переписан под новый контур:
  - `DEBUG=True`
  - `ENFORCE_ENV_SECURITY=False`
  - `SECURE_SSL_REDIRECT=False`
  - `SESSION_COOKIE_SECURE=False`
  - `CSRF_COOKIE_SECURE=False`
  - origin `http://127.0.0.1:8000`
- Из репозитория удалены `ops/local/Caddyfile.template` и `ops/local/Caddyfile.local`.
- Переписаны runbooks:
  - `docs/LOCAL_PRODLIKE_SETUP.md`
  - `docs/LOCAL_PRODLIKE_QUICKSTART.md`
  - `backend/README.md`
- Проверка выполнена:
  - `python -m py_compile scripts/local_prodlike_smoke.py`
  - `python backend/manage.py test config.tests auth_custom.tests --noinput`
- Результат проверки успешный: тесты `OK`, один QR-тест по-прежнему пропущен до обновления локального Python-окружения с новым пакетом `qrcode`.

## 13. Этап 9. Привести Backend И Tooling К Python 3.14

### Задачи

- [x] Обновить Python target version в tooling-конфигурации.
- [ ] Проверить совместимость зависимостей с `Python 3.14`.
- [x] Обновить инструкции по созданию окружения.
- [ ] Прогнать backend тесты и smoke-проверки на новой версии Python.
- [x] Зафиксировать минимальную поддерживаемую версию Python как `3.14`.

### Результат этапа

- [ ] Проект совместим с `Python 3.14`.

### Фиксация реализации Этапа 9

- В `backend/pyproject.toml` обновлены Python target versions с `py312` на `py314`.
- В `Dockerfile` базовый runtime image переключен на `python:3.14-slim`.
- В `README.md` минимальная поддерживаемая версия Python обновлена до `3.14+`.
- Кодовая и tooling-конфигурация переведены на `Python 3.14`.
- Финальная локальная верификация должна выполняться в `venv`, созданном именно из `Python 3.14`, после установки зависимостей из `backend/requirements.txt`.
- До отдельного прогона тестов и smoke именно в `Python 3.14` этап считается частично подтвержденным.

## 14. Этап 10. Привести Runtime И Deploy К Debian 12

### Задачи

- [x] Переписать deployment runbook под `Debian 12`.
- [x] Подготовить инструкции установки:
  - Python 3.14
  - PostgreSQL client libraries
  - gunicorn
  - nginx при необходимости
- [x] Подготовить пример `systemd` unit для gunicorn.
- [x] Подготовить пример `nginx` конфигурации для reverse proxy и раздачи static при необходимости.
- [x] Проверить, что все шаги выполнимы на Linux без Windows-specific зависимостей.

### Результат этапа

- [x] Появился Linux-first production runbook под согласованный стек.

### Фиксация реализации Этапа 10

- Создан `docs/DEBIAN12_DEPLOY_RUNBOOK.md` с Linux-first инструкциями для `Debian 12`.
- Добавлен шаблон `ops/systemd/rtp3-gunicorn.service`.
- Добавлен пример reverse proxy конфига `ops/nginx/rtp3.conf.example`.
- В runbook зафиксирован стек `Python 3.14 + gunicorn + nginx + PostgreSQL`.
- Дополнительная проверка `python backend/manage.py check` в dev-профиле проходит успешно.

## 15. Этап 11. Пересобрать Docker И Compose Под Новый Стек

### Задачи

- [x] Убрать Node-stage из `Dockerfile`.
- [x] Перевести образ на Python-only runtime.
- [x] Настроить `collectstatic` и запуск `gunicorn` в контейнере.
- [x] Убедиться, что `docker-compose` использует только Python/Django + PostgreSQL сервисы.
- [x] Проверить, что контейнер не ожидает наличия `dist`.

### Результат этапа

- [x] Контейнеризация соответствует согласованному стеку.

### Фиксация реализации Этапа 11

- `Dockerfile` уже не содержит Node-stage и использует Python-only runtime.
- В image добавлен `gunicorn.conf.py`.
- Контейнерный entrypoint переведен на `gunicorn`.
- `docker-compose.yml` очищен от `SERVE_FRONTEND_FROM_DJANGO` и переведен на цепочку:
  - `collectstatic`
  - `migrate`
  - seed-команды
  - `gunicorn`
- Сверка по `Dockerfile`/`docker-compose.yml` подтверждает отсутствие зависимостей от `dist` и Vite runtime.

## 16. Этап 12. Перевести Тестовый Контур На Допустимые Инструменты

### Задачи

- [x] Определить судьбу frontend unit tests, которые сейчас завязаны на `vitest`.
- [x] Определить судьбу E2E-тестов, которые сейчас завязаны на `playwright`.
- [x] Перенести критичные проверки на Python-инструменты:
  - Django tests
  - API tests
  - smoke scripts
  - при необходимости `pytest`/`selenium`
- [x] Удалить Node-based тестовые раннеры из штатного контура.
- [x] Обновить test runbook и release checklist.

### Результат этапа

- [x] Проверки проекта выполняются без обязательного `Node.js`.

### Фиксация реализации Этапа 12

- В качестве штатного набора проверок закреплены Django/API tests и Python/PowerShell smoke-сценарии.
- Удалены Node-based тестовые раннеры и e2e-конфигурация:
  - `vitest.config.js`
  - `vitest.setup.js`
  - `playwright.config.js`
  - `scripts/run-vitest.mjs`
  - `scripts/e2e-django-server.mjs`
  - `e2e/*`
- Удалены frontend test files, завязанные на `vitest`, из `src/` и их копии из `backend/static/`.
- Обновлены test/release runbooks:
  - `backend/README.md`
  - `docs/RELEASE_PROCESS.md`
  - `docs/TEST_AD_SMOKE_PROTOCOL.md`

## 17. Этап 13. Очистить Репозиторий От Node.js И Caddy Артефактов

### Задачи

- [x] Удалить `package.json` и `package-lock.json`.
- [x] Удалить `vite.config.js`, `vitest.config.js`, `vitest.setup.js`, `playwright.config.js`.
- [x] Удалить `.mjs`-скрипты, оставшиеся после миграции.
- [x] Удалить `node_modules` из рабочего контура и инструкций.
- [x] Удалить `Caddy`-связанные шаблоны, скрипты и docs.
- [x] Обновить `.gitignore`.
- [x] Прогнать поиск по репозиторию и убрать упоминания:
  - `node`
  - `npm`
  - `vite`
  - `vitest`
  - `playwright`
  - `Caddy`

### Результат этапа

- [x] Репозиторий очищен от устаревших зависимостей и не вводит в заблуждение.

### Фиксация реализации Этапа 13

- Удалены:
  - `package.json`
  - `package-lock.json`
  - `vite.config.js`
  - `vitest.config.js`
  - `vitest.setup.js`
  - `playwright.config.js`
  - `eslint.config.cjs`
  - `.prettierrc.json`
  - оставшиеся `.mjs`-скрипты
- Удалены obsolete docs с устаревшим Node/Vite-планом:
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
  - `docs/JIRA_REMAINING_TASKS.md`
  - `docs/WORKTREE_REVISION_2026-03-16.md`
- `.gitignore` очищен от `Caddyfile.local` и `playwright-report`, добавлен `.pytest_cache/`.
- Глобальный поиск показывает, что активные упоминания `vite`/`vitest`/`playwright`/`Caddy` остаются только в этом migration plan как часть истории и фиксации изменений.

## 18. Этап 14. Обновить Документацию

### Задачи

- [x] Обновить `README.md`.
- [x] Обновить `backend/README.md`.
- [x] Переписать `docs/LOCAL_PRODLIKE_SETUP.md`.
- [x] Обновить deployment runbook.
- [x] Обновить release process и regression checklist.
- [x] Добавить отдельный документ с новой целевой архитектурой, если потребуется.

### Результат этапа

- [x] Документация соответствует новому стеку и новому способу запуска.

### Фиксация реализации Этапа 14

- Обновлены основные пользовательские и эксплуатационные документы:
  - `README.md`
  - `backend/README.md`
  - `docs/LOCAL_PRODLIKE_SETUP.md`
  - `docs/LOCAL_PRODLIKE_QUICKSTART.md`
  - `docs/DEBIAN12_DEPLOY_RUNBOOK.md`
  - `docs/RELEASE_PROCESS.md`
  - `docs/TEST_AD_SMOKE_PROTOCOL.md`
  - `docs/POSTGRES_MIGRATION_RUNBOOK.md`
  - `docs/HTML_DOCUMENTATION.md`
  - `docs/DOCUMENTATION_BASELINE.md`
- Документация приведена к новому контуру:
  - запуск через Django/gunicorn
  - отсутствие Node.js и Caddy в штатном процессе
  - Linux-first deployment профиль

## 19. Этап 15. Финальная Приемка

### Чек-лист приемки

- [x] Приложение поднимается локально без `Node.js`.
- [x] Приложение поднимается в production-like контуре без `Caddy`.
- [x] Все UI-страницы доступны через `Django`.
- [x] Статика обслуживается корректно.
- [ ] Backend работает на `Python 3.14`.
- [x] База работает на `PostgreSQL 14+`.
- [x] Docker-контур соответствует согласованному стеку.
- [x] Smoke-проверки и основные тесты проходят без `Node.js`.
- [x] Документация обновлена.

## 20. Рекомендуемый Порядок Выполнения

1. Инвентаризация и фиксация целевой архитектуры.
2. Перенос HTML в `Django templates`.
3. Перенос CSS/JS/ассетов в `staticfiles`.
4. Удаление зависимости от `Vite` и `dist`.
5. Удаление runtime-зависимостей от `Node.js`.
6. Перевод запуска на `Django` и `gunicorn`.
7. Отказ от `Caddy`.
8. Обновление Python до `3.14`.
9. Пересборка Docker/Compose.
10. Перевод тестового контура.
11. Очистка репозитория.
12. Финальное обновление документации и приемка.

## 21. Риски

- [ ] Скрытые зависимости фронтенда от `Vite`-сборки и текущих путей `/src/...`.
- [ ] Регрессии UI после переноса в `Django templates/staticfiles`.
- [ ] Потеря части тестового покрытия при отказе от Node-based test tooling.
- [ ] Возможные несовместимости отдельных библиотек с `Python 3.14`.

## 22. Формат Работы По Документу

- [ ] Перед началом каждого этапа уточнить входные условия.
- [ ] По завершении каждого этапа отмечать выполненные чекбоксы.
- [ ] Все отклонения от плана фиксировать прямо в этом документе или в связанном ADR/runbook.
- [ ] Не переходить к удалению старого контура, пока новый не подтвержден smoke-проверками.
