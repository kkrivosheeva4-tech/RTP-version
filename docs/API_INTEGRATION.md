# Интеграция с Backend API

**Назначение:** Документация для разработчиков backend и интеграторов. Описывает порядок подключения API, структуру запросов/ответов, обработку ошибок и refresh токена.

---

## 1. Порядок включения API

### 1.1 Создание локального конфига

1. Скопируйте файл-пример:
   ```bash
   cp src/js/config/api-config.local.example.js src/js/config/api-config.local.js
   ```
   Или создайте `src/js/config/api-config.local.js` вручную.

2. Файл `api-config.local.js` добавлен в `.gitignore` — локальные настройки не попадают в репозиторий.

3. Конфиг загружается **до** основного `api-config.js` через `api-config-loader.js` (подключён в `main.js`).

### 1.2 Установка `API_BASE_URL`

В `api-config.local.js` задайте базовый URL backend:

```javascript
window.API_BASE_URL = 'http://localhost:8000';  // без слэша в конце
```

- Пустое значение → mock-режим (JSON + VFS).
- Непустое значение → по умолчанию используется API (`USE_API = true`).

### 1.3 Переключение `USE_API`

Флаг явно переопределяет источник данных:

```javascript
// Принудительно использовать API (даже если API_BASE_URL не задан)
window.USE_API = true;

// Принудительно использовать mock
window.USE_API = false;
```

Если `USE_API` не задан, он определяется автоматически: `USE_API = (API_BASE_URL !== '')`.

### 1.4 Дополнительные параметры

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `API_BASE_URL` | Базовый URL API (без слэша) | `''` |
| `USE_API` | `true` — API, `false` — mock | по `API_BASE_URL` |
| `DEFAULT_TIMEOUT_MS` | Таймаут обычных запросов (мс) | `8000` |
| `HEAVY_REQUEST_TIMEOUT_MS` | Таймаут тяжёлых запросов (мс) | `30000` |
| `API_REFRESH_PATH` | Путь refresh токена | `/api/v1/auth/refresh` |

---

## 2. Авторизация и токены

### 2.1 Хранение токенов

- **Access token:** `localStorage['rmk_access_token']` (ключ задаётся в `ApiConfig.getTokenStorageKey()`).
- **Refresh token:** `localStorage['rmk_refresh_token']` (ключ в `ApiConfig.getRefreshTokenStorageKey()`).

ApiClient берёт access token из `localStorage` или `sessionStorage` и добавляет заголовок:

```
Authorization: Bearer <access_token>
```

### 2.2 Ожидаемый формат ответа при логине

Endpoint логина (реализуется backend) должен возвращать JSON:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Альтернативные имена полей (snake_case): `access_token`, `refresh_token`. Клиент поддерживает и camelCase: `accessToken`, `refreshToken`.

**Важно:** Frontend должен после успешного логина сохранять токены:

```javascript
localStorage.setItem('rmk_access_token', data.access_token);
localStorage.setItem('rmk_refresh_token', data.refresh_token);
```

Текущая mock-авторизация (`auth.html`) использует `isLoggedIn` и `username`. При переходе на API необходимо доработать страницу логина для вызова backend и сохранения токенов.

---

## 3. Refresh токен и обработка 401

### 3.1 Логика ApiClient

1. При ответе **401 Unauthorized** клиент вызывает `POST /api/v1/auth/refresh` с телом `{ "refresh_token": "<refresh_token>" }` и заголовком `Authorization: Bearer <refresh_token>`.
2. При успехе (2xx) backend возвращает новые токены; клиент сохраняет их и повторяет исходный запрос.
3. При неудаче refresh клиент удаляет токены, редиректит на `/src/pages/auth.html?return=<текущий URL>` и возвращает ошибку.

### 3.2 Ожидаемый ответ refresh endpoint

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

Путь можно переопределить: `window.API_REFRESH_PATH = '/api/v2/auth/refresh'`.

---

## 4. Обработка ошибок

### 4.1 Формат ответа ApiClient

Все методы (`get`, `post`, `put`, `patch`, `delete`) возвращают объект:

```typescript
{ ok: boolean; data?: any; error?: string; status?: number }
```

- `ok: true` — запрос успешен, данные в `data`.
- `ok: false` — ошибка, текст в `error`, код в `status`.

### 4.2 Извлечение текста ошибки из ответа backend

Клиент ищет сообщение в полях (в порядке приоритета):

- `message`
- `error`
- `detail` (строка)
- `detail` (массив) → элементы `msg` или `message` склеиваются через `"; "`

Примеры ожидаемого формата ошибок backend:

```json
{ "error": "Технология не найдена" }
{ "message": "Недостаточно прав" }
{ "detail": "Invalid enterprise id" }
{ "detail": [ { "msg": "Поле name обязательно" }, { "msg": "Поле block обязательно" } ] }
```

### 4.3 Сетевые ошибки

- Таймаут → `{ ok: false, error: "Таймаут запроса", status: 0 }`
- Ошибка сети → `{ ok: false, error: "<message>", status: 0 }`
- `API_BASE_URL` не задан при `USE_API = true` → `{ ok: false, error: "API_BASE_URL не задан", status: 0 }`

---

## 5. Endpoints и форматы запросов/ответов

### 5.1 Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/v1/auth/login/` | Логин (username, password) → access_token, refresh_token; при 2FA — requires_2fa, session_id |
| POST | `/api/v1/auth/refresh` | Обновление access-токена (см. раздел 3) |
| POST | `/api/v1/auth/logout/` | Выход (опционально) |
| POST | `/api/v1/auth/2fa/setup/` | Настройка 2FA — получение secret и QR (после логина при requires_2fa) |
| POST | `/api/v1/auth/2fa/verify/` | Проверка 6-значного кода 2FA (session_id, code) |

**Логин при 2FA:** Ответ может содержать `requires_2fa: true` вместо токенов — клиент переходит на страницу 2FA. После успешной проверки кода backend возвращает токены.

**2FA setup:** Тело `{ "session_id": "..." }` (если нужен). Ответ: `{ "secret": "BASE32", "qr_url": "otpauth://..." }` или аналогично.

**2FA verify:** Тело `{ "session_id": "..., "code": "123456" }`. Ответ: токены при успехе.

> Текущая реализация frontend использует mock-заглушки для 2FA. При подключении backend необходимо заменить вызовы в `auth-2fa.js` на реальные запросы к API.

---

### 5.2 Технологии

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/technologies` | Список технологий |
| GET | `/api/v1/technologies?enterpriseId=<id>` | Фильтр по предприятию |
| POST | `/api/v1/technologies` | Создание технологии |
| PATCH | `/api/v1/technologies/:id` | Обновление (частичное) |
| PUT | `/api/v1/technologies/:id` | Обновление (полное, альтернатива PATCH) |
| DELETE | `/api/v1/technologies/:id` | Удаление |
| PUT | `/api/v1/technologies/bulk` | Массовое сохранение |

#### GET /api/v1/technologies

**Ответ:** массив технологий в формате API (см. раздел 6 и `docs/API_FORMAT_MAPPING.md`).

```json
[
  {
    "id": 1,
    "name": "Технология 1",
    "block": 1,
    "blocks": [1],
    "functionCoverage": ["Функция 1", "Функция 2"],
    "enterprises": [
      {
        "enterpriseId": 1,
        "technologicalReadiness": 3,
        "organizationalReadiness": 3,
        "status": "Внедрена"
      }
    ],
    "directions": [1],
    "trlStage": 3,
    "vendors": [{"name": "Вендор", "integrators": ["Интегратор"]}],
    "marketExamples": ["Пример"],
    "documentationFiles": ["path/to/file.pdf"]
  }
]
```

#### POST /api/v1/technologies

**Тело:** объект технологии (без `id`, он назначается backend).

**Ответ:** созданная технология с `id`, статус `201`.

#### PATCH /api/v1/technologies/:id

**Тело:** объект с полями для обновления (частичный merge).

**Ответ:** обновлённая технология.

#### DELETE /api/v1/technologies/:id

**Ответ:** `204 No Content` или пустое тело.

#### PUT /api/v1/technologies/bulk

**Тело:** массив технологий целиком.

**Ответ:** `204 No Content` или пустое тело.

---

### 5.3 Справочники (references)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/v1/references/:name` | Получить справочник |
| PUT | `/api/v1/references/:name` | Сохранить справочник |

**Имена справочников:** `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprisesBlocksMapping`.

#### GET /api/v1/references/:name

**Ответ:** массив или объект в формате `src/data/ru/*.json`:

- `blocks` → `[{ id, name }, ...]`
- `enterprises` → `[{ id, name, code?, description? }, ...]`
- `functionToBlock`, `directionToQuadrant` → объект `{ key: value }`
- остальные → массив.

#### PUT /api/v1/references/:name

**Тело:** данные для сохранения (массив или объект).

**Ответ:** `204 No Content` или пустое тело.

---

## 6. Структура ответов и маппинг

Клиент преобразует ответы API в внутренний формат через `normalizeTechnologyFromNewFormat` (см. `src/js/modules/core/data-normalize.js`).

**Подробный маппинг полей:** `docs/API_FORMAT_MAPPING.md`.

### Краткая сводка маппинга технологии (API → клиент)

| API / JSON | Клиент |
|------------|--------|
| `id`, `name`, `description` | без изменений |
| `marketExamples` (массив) | `exampleDesc` (строка, `\n`) |
| `block` (number/string), `blocks` (number[]) | `block`, `blocks` (имена блоков) |
| `function`, `functionCoverage` | `func`, `functions` |
| `enterprises` | `company`, `companyRatings` |
| `technologicalReadiness`, `organizationalReadiness` (1–9) | `techRead`, `organRead` (0–3) |
| `trlStage`, `status` | `trlStage`, `level` (кольцо радара) |
| `documentationFiles` | `files` (`{ path, name }`) |
| `vendors`, `integrators` | без изменений |

DataService автоматически подгружает `blocks` и `enterprises` для корректного маппинга.

---

## 7. CORS и заголовки

Backend должен:

- Разрешить запросы с origin приложения (dev: `http://localhost:5173`).
- Поддерживать `Authorization: Bearer <token>`.
- Возвращать `Content-Type: application/json` для JSON.

При необходимости настройте proxy в `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

---

## 8. Связанные файлы

| Файл | Назначение |
|------|------------|
| `src/js/config/api-config.local.example.js` | Пример локального конфига |
| `src/js/config/api-config-loader.js` | Загрузка api-config.local.js → api-config.js |
| `src/js/config/api-config.js` | Основная конфигурация (URL, USE_API, таймауты, ключи токенов) |
| `src/js/modules/core/api-client.js` | HTTP-клиент (request, 401/refresh, normalizeResponse) |
| `src/js/modules/core/data-service.js` | Слой переключения mock/API, вызов ApiClient |
| `src/js/modules/core/data-normalize.js` | Преобразование API → клиентский формат |
| `docs/API_FORMAT_MAPPING.md` | Детальный маппинг полей технологий и справочников |
