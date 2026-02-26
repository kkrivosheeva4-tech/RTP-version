# Требования к Backend API

**Дата:** 26.02.2026  
**Назначение:** Краткий чек-лист для разработчиков backend. Детали — в [API_INTEGRATION.md](API_INTEGRATION.md).

---

## 1. Обязательные endpoints

### Аутентификация

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/auth/login/` | POST | Логин: `{ username, password }` → `{ access_token, refresh_token }` или `{ requires_2fa: true, session_id }` |
| `/api/v1/auth/refresh` | POST | Обновление токена: Bearer refresh_token, body `{ refresh_token }` → `{ access_token, refresh_token }` |
| `/api/v1/auth/2fa/setup/` | POST | Настройка 2FA → `{ secret, qr_url }` |
| `/api/v1/auth/2fa/verify/` | POST | Проверка кода: `{ session_id, code }` → токены |
| `/api/v1/auth/logout/` | POST | (опционально) Выход |

### Технологии

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/technologies` | GET | Список (опционально `?enterpriseId=<id>`) |
| `/api/v1/technologies` | POST | Создание |
| `/api/v1/technologies/:id` | PATCH, PUT | Обновление |
| `/api/v1/technologies/:id` | DELETE | Удаление |
| `/api/v1/technologies/bulk` | PUT | Массовое сохранение |

### Справочники

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/v1/references/:name` | GET | Получить справочник |
| `/api/v1/references/:name` | PUT | Сохранить справочник |

**Имена:** `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`, `enterprisesBlocksMapping`.

---

## 2. Форматы и протокол

- **Авторизация:** заголовок `Authorization: Bearer <access_token>`
- **Content-Type:** `application/json` для JSON
- **Ошибки:** поле `message`, `error` или `detail` в JSON; массив `detail` с `msg`/`message`
- **401:** ApiClient вызывает refresh; при неудаче — редирект на auth

---

## 3. CORS

- Разрешить origin: `http://localhost:5173` (dev)
- Заголовки: `Authorization`, `Content-Type`

---

## 4. Маппинг данных

Формат технологий и справочников — см. [API_FORMAT_MAPPING.md](API_FORMAT_MAPPING.md) и раздел 6 [API_INTEGRATION.md](API_INTEGRATION.md).

---

## 5. Текущее состояние frontend

- ✅ ApiClient готов: Bearer token, 401 + refresh, нормализация ошибок
- ✅ DataService переключается mock/API по `USE_API` и `API_BASE_URL`
- ✅ auth.js, auth-2fa.js — mock; при подключении API заменить на вызовы backend
