# Единая спецификация Backend API (Frontend ↔ Backend)

**Дата обновления:** 06.03.2026  
**Проверка соответствия фронтенду:** 06.03.2026  
**Назначение:** единый источник требований для backend-разработчиков и интеграции frontend с API.

---

## 1. Быстрый чек-лист backend (MVP)

### 1.1 Обязательные endpoints

#### Аутентификация

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/auth/login/` | POST | Логин: `{ username, password }` -> `{ access_token, refresh_token }` или `{ requires_2fa: true, session_id }` |
| `/api/v1/auth/refresh` | POST | Обновление токена: Bearer `refresh_token`, body `{ refresh_token }` -> `{ access_token, refresh_token }` |
| `/api/v1/auth/2fa/setup/` | POST | Настройка 2FA -> `{ secret, qr_url }` |
| `/api/v1/auth/2fa/verify/` | POST | Проверка кода: `{ session_id, code }` -> токены |
| `/api/v1/auth/logout/` | POST | (опционально) Выход |
| `/api/v1/users/me/` | GET | Текущий пользователь и роль |

#### Технологии

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/technologies` | GET | Список (опционально `?enterpriseId=<id>`) |
| `/api/v1/technologies` | POST | Создание |
| `/api/v1/technologies/:id` | GET | Детали |
| `/api/v1/technologies/:id` | PATCH, PUT | Обновление |
| `/api/v1/technologies/:id` | DELETE | Удаление |
| `/api/v1/technologies/bulk` | PUT | Массовое сохранение |

#### Справочники

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/references/:name` | GET | Получить справочник |
| `/api/v1/references/:name` | PUT | Сохранить справочник |

Поддерживаемые имена: `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprisesBlocksMapping`.

### 1.2 Протокол и инфраструктура

- Авторизация: `Authorization: Bearer <access_token>`.
- Контент: `Content-Type: application/json`.
- CORS (dev): разрешить origin `http://localhost:5173`.
- Разрешенные заголовки минимум: `Authorization`, `Content-Type`.
- OpenAPI schema: `GET /api/v1/openapi.json`.
- Swagger UI: `GET /api/v1/docs`.
- При `401` frontend автоматически вызывает refresh; при провале refresh выполняет редирект на страницу auth.

---

## 2. Включение API на frontend

### 2.1 Локальный конфиг

Создать `src/js/config/api-config.local.js` (файл в `.gitignore`).

Пример:

```javascript
window.API_BASE_URL = 'http://localhost:8000';
window.USE_API = true;
```

Поведение:
- `API_BASE_URL === ''` -> mock-режим (JSON + VFS).
- `USE_API` не задан -> вычисляется как `API_BASE_URL !== ''`.

### 2.2 Параметры конфигурации

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `API_BASE_URL` | Базовый URL API (без слэша) | `''` |
| `USE_API` | `true` -> API, `false` -> mock | по `API_BASE_URL` |
| `DEFAULT_TIMEOUT_MS` | Таймаут обычных запросов (мс) | `8000` |
| `HEAVY_REQUEST_TIMEOUT_MS` | Таймаут тяжёлых запросов (мс) | `30000` |
| `API_REFRESH_PATH` | Endpoint refresh токена | `/api/v1/auth/refresh` |

---

## 3. Авторизация, токены, refresh

### 3.1 Хранение токенов

- Access token: `localStorage['rmk_access_token']`.
- Refresh token: `localStorage['rmk_refresh_token']`.

`ApiClient` добавляет заголовок:

```
Authorization: Bearer <access_token>
```

### 3.2 Формат ответов auth

Успешный login:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Успешный refresh:

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

Логин с 2FA:

```json
{
  "requires_2fa": true,
  "session_id": "..."
}
```

Проверка 2FA:

```json
{
  "session_id": "...",
  "code": "123456"
}
```

### 3.3 Логика 401/refresh в ApiClient

1. При `401` вызывается `POST /api/v1/auth/refresh` с body `{ "refresh_token": "..." }` и Bearer refresh-token.
2. При успехе токены обновляются и исходный запрос повторяется.
3. При неуспехе токены очищаются, пользователь перенаправляется на `/src/pages/auth.html?return=<url>`.

---

## 4. Ошибки и формат ответа клиента

### 4.1 Нормализованный ответ ApiClient

```ts
{ ok: boolean; data?: any; error?: string; status?: number }
```

### 4.2 Извлечение текста ошибки

Приоритет полей: `message` -> `error` -> `detail` (строка) -> `detail[]` (`msg`/`message`).

Примеры совместимых ошибок backend:

```json
{ "error": "Технология не найдена" }
{ "message": "Недостаточно прав" }
{ "detail": "Invalid enterprise id" }
{ "detail": [ { "msg": "Поле name обязательно" } ] }
```

### 4.3 Сетевые ошибки

- Таймаут: `{ ok: false, error: "Таймаут запроса", status: 0 }`.
- Ошибка сети: `{ ok: false, error: "<message>", status: 0 }`.
- `USE_API = true` без `API_BASE_URL`: `{ ok: false, error: "API_BASE_URL не задан", status: 0 }`.

---

## 5. Контракт endpoint-ов (форматы)

### 5.1 Technologies

#### GET `/api/v1/technologies`

Ответ: массив технологий в API-формате.

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
    "vendors": [{ "name": "Вендор", "integrators": ["Интегратор"] }],
    "marketExamples": ["Пример"],
    "documentationFiles": ["path/to/file.pdf"]
  }
]
```

#### POST `/api/v1/technologies`

- Тело: объект технологии (без `id`).
- Ответ: созданный объект + `201`.

#### PATCH/PUT `/api/v1/technologies/:id`

- Тело: объект полей для изменения.
- Ответ: обновленный объект.

#### DELETE `/api/v1/technologies/:id`

- Ответ: `204 No Content`.

#### PUT `/api/v1/technologies/bulk`

- Тело: массив технологий.
- Ответ: `204 No Content`.

### 5.2 References

#### GET `/api/v1/references/:name`

Ответ в формате `src/data/ru/*.json`:
- `blocks`: массив `{ id, name }`.
- `enterprises`: массив `{ id, name, code?, description? }`.
- `functionToBlock`, `directionToQuadrant`: объект `{ key: value }`.
- остальные справочники: массив.

#### PUT `/api/v1/references/:name`

- Тело: массив или объект для выбранного справочника.
- Ответ: `204 No Content`.

---

## 6. Маппинг форматов API <-> клиент

### 6.1 Technology: API -> клиент

| API / JSON поле | Клиентское поле | Примечание |
|-----------------|-----------------|------------|
| `id` | `id` | без изменений |
| `name` | `name` | без изменений |
| `description` | `description` | без изменений |
| `marketExamples` | `exampleDesc` | массив -> строка через `\n` |
| `block` (number \| string) | `block` | number -> имя по blockIdToName |
| `blocks` (number[]) | `blocks` | id -> массив имен блоков |
| `function` | `func` | без изменений |
| `functionCoverage` | `functions` | массив функций |
| `directions` | `directions`, `direction` | `direction = directions[0]` |
| `enterprises` | `company`, `companyRatings` | `enterpriseId` -> имя; `status="Внедрена"` -> `isImplemented` |
| `technologicalReadiness`, `organizationalReadiness` | `techRead`, `organRead` | `1..9 -> 0..3` |
| `trlStage` | `trlStage`, `level` | `1..3->1`, `4..6->2`, `7..9->3` |
| `status` | `status`, `level` | `level` = кольцо радара |
| `vendors` | `vendors` | без изменений |
| `integrators` | `integrators` | без изменений |
| `documentationFiles` | `files` | путь -> `{ path, name }` |
| `funcCover` | `funcCover` | 1..3 по количеству функций |

### 6.2 Technology: клиент -> API

Используется структура JSON-совместимого объекта с полями:
`id`, `name`, `description`, `block`, `blocks`, `function`, `functionCoverage`, `directions`, `enterprises`, `trlStage`, `status`, `vendors`, `documentationFiles`, `marketExamples`.

### 6.3 Endpoints DataService

| Метод DataService | API endpoint | Mock |
|-------------------|--------------|------|
| `loadTechnologies(enterpriseId?)` | `GET /api/v1/technologies?enterpriseId=` | `loadJsonPreferVfs + vfsRead` |
| `loadReference(name)` | `GET /api/v1/references/{name}` | `loadJsonPreferVfs + vfsRead` |
| `createTech(tech)` | `POST /api/v1/technologies` | `vfsWrite` |
| `updateTech(id, tech)` | `PATCH /api/v1/technologies/{id}` | `vfsWrite` |
| `deleteTech(id)` | `DELETE /api/v1/technologies/{id}` | `vfsWrite` |
| `saveTechnologies(technologies)` | `PUT /api/v1/technologies/bulk` | `vfsWrite` |
| `saveReference(name, data)` | `PUT /api/v1/references/{name}` | `vfsWrite` |

---

## 7. Текущее состояние frontend

- ApiClient готов: Bearer token, 401 + refresh, нормализация ошибок.
- DataService переключает mock/API через `USE_API` и `API_BASE_URL`.
- `auth.js` и `auth-2fa.js` поддерживают backend 2FA flow (`login -> 2fa/setup|verify -> tokens`) и mock-flow.

---

## 8. Связанные файлы

| Файл | Назначение |
|------|------------|
| `src/js/config/api-config.local.example.js` | Пример локального конфига |
| `src/js/config/api-config-loader.js` | Загрузка `api-config.local.js` до основного конфига |
| `src/js/config/api-config.js` | Конфигурация URL/таймаутов/ключей токенов |
| `src/js/modules/core/api-client.js` | HTTP-клиент и логика refresh |
| `src/js/modules/core/data-service.js` | Слой API/mock |
| `src/js/modules/core/data-normalize.js` | Преобразование API -> формат приложения |

