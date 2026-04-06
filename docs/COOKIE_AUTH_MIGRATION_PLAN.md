# Cookie Auth Migration Plan (Stage C3-C5)

Дата: 16.03.2026

## 1. Цель

Перейти с хранения refresh-token в storage на cookie-модель:

- refresh-token в `HttpOnly` cookie;
- access-token живет в runtime state и восстанавливается через refresh/me flow;
- refresh/logout работают через `credentials: include`.

## 2. Целевая конфигурация backend

- `AUTH_REFRESH_COOKIE_ENABLED=True`
- `AUTH_RETURN_REFRESH_TOKEN_IN_BODY=False`
- `AUTH_REFRESH_REQUIRE_CSRF=True`
- `CORS_ALLOW_CREDENTIALS=True`
- `AUTH_REFRESH_COOKIE_HTTPONLY=True`
- `AUTH_REFRESH_COOKIE_SAMESITE=Lax` (или `None` + `Secure=True` для HTTPS cross-site)

Референс: `backend/.env.test.example`.

## 3. Изменения frontend

1. Логин/2FA flow принимает успех без `refresh_token` в body (в cookie-mode).
2. `ApiClient`:
   - отправляет `credentials: include` в cookie-mode;
   - делает refresh без refresh-token из storage;
   - добавляет `X-CSRFToken` из cookie `csrftoken` (если доступен).
3. Хранение refresh-token в storage отключено в cookie-mode.
4. `localStorage/sessionStorage` не используются как source of truth для финального auth-state.

## 4. CSRF стратегия

Так как DRF `APIView` обычно `csrf_exempt`, для cookie refresh/logout введена ручная проверка:

- если включен cookie-mode и в запросе есть refresh-cookie,
- требуется совпадение `csrftoken` cookie и заголовка `X-CSRFToken`.

При нарушении возвращается `403`.

## 5. Текущее состояние и rollout

Переход завершен. Текущий baseline проекта:

- refresh хранится только в `HttpOnly` cookie;
- frontend не хранит refresh-token в `localStorage/sessionStorage`;
- `refresh` и `logout` работают только через cookie + `X-CSRFToken`.

Рекомендуемый rollout:

1. Staging/test AD: подтвердить cookie-based flow.
2. Проверить login/2fa/refresh/logout и 401-retry.
3. Зафиксировать cookie-based flow как единственный допустимый production baseline.

## 6. Smoke checklist cookie-mode

- Login + 2FA verify -> backend выставляет refresh-cookie.
- `POST /api/v1/auth/refresh` в cookie-mode возвращает новый access-token.
- `POST /api/v1/auth/logout` очищает refresh-cookie.
- В local/session storage отсутствует refresh-token и legacy auth-flags не используются как источник истины.
- При невалидном/просроченном refresh пользователь получает 401 и редирект на auth.

## 7. Изменение baseline

Возврат к хранению refresh-token в body/storage не рассматривается как штатный вариант эксплуатации.
При инцидентах подлежат исправлению причины отказа cookie-based auth, а не возврат к устаревшей схеме хранения.
