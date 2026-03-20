# Frontend Storage Policy

## Цель

Документ фиксирует, какие данные фронтенд `RTP-3` может хранить в browser storage после перехода к production baseline.

## 1. Source Of Truth

Для auth-состояния источником истины являются:

- backend session / refresh-cookie;
- runtime-auth state в текущем JS процессе;
- профиль пользователя из `GET /api/v1/users/me/`.

`localStorage` и `sessionStorage` не считаются source of truth для финального auth-state.

## 2. Что запрещено хранить как auth-state

Следующие ключи не должны использоваться как постоянный auth-state в production path:

- `isLoggedIn`
- `username`
- `userName`
- `role`
- `rmk_refresh_token`

`rmk_access_token` допускается только как переходный legacy fallback и не является нормативным storage baseline.

Примечание:

- mock-only сценарии для изолированных UI/tests могут временно использовать legacy storage flags, но это не является production/deployment контрактом.
- в `USE_API=true` runtime UI должен игнорировать legacy auth flags и опираться на backend session, runtime state и `/api/v1/users/me/`; чтение `isLoggedIn` / `username` / `role` допустимо только в mock/offline path.

## 3. Что остается в `sessionStorage`

Разрешен только короткоживущий pre-auth/session UX state:

- `auth2faPending`

Назначение:

- хранение временного `session_id` и служебных данных между страницами `auth -> 2fa setup/verify`;
- удаляется сразу после успешного verify/logout/abandon flow;
- не используется как подтверждение факта авторизации.

## 4. Что остается в `localStorage`

Разрешены только UI/UX и локальные пользовательские настройки:

- `theme`
- `selectedEnterprise`
- `rmk_onboarding_completed`
- `rmk_onboarding_progress`
- `rmk_onboarding_version`
- `adminSidebarCollapsed`

Также допустимы локальные UI-журналы/кэш, не влияющие на auth truth:

- `adminAuditLogs` — может появляться как локальный журнал/fallback для mock/offline сценариев, но при `USE_API=true` админ-панель читает аудит из backend API, а не из localStorage
- `adminBackups` — используется только как mock/offline fallback; при `USE_API=true` список backup-ов и операции restore/delete идут через backend API
- `adminUsers` — используется только как mock/offline fallback; при `USE_API=true` список пользователей и изменение ролей идут через backend API
- `adminEnterprises` — используется только как mock/offline fallback; при `USE_API=true` список предприятий и CRUD идут через backend API
- `rmk_position_cache`, `rmk_position_cache_version` — кэш позиций технологий на радаре
- `rtp_functionToBlock_data`, `rtp_functionToBlock_version` — **не используются** (привязка функций к блокам хранится только в памяти сессии, не в localStorage)
- `rtp_functionWeights` — веса функций (локальные настройки)
- `techFormState` — состояние формы редактирования технологии (сбрасывается при logout)
- `tech_notifications` — уведомления об изменениях технологий
- `rmk_vendors_list`, `rmk_integrators_list` — локальный кэш списков вендоров и интеграторов
- `rtp_tech_history` — история технологий для аналитики (temporal-dynamics)

Практическое правило для admin storage:

- в API-режиме допустимо существование legacy/mock ключей в браузере, но они не считаются production source of truth и не должны дублировать фактические admin-данные, загруженные с backend
- в mock/offline режиме эти ключи остаются разрешённым fallback для локальной разработки и изолированных UI-сценариев

## 5. Что должно мигрировать из storage

В backend / cookie / runtime state:

- финальный auth-session;
- текущая роль пользователя;
- refresh lifecycle;
- данные пользователя для UI gating.

## 6. Что удаляется

Из целевого deployment baseline исключаются:

- auth truth в `localStorage`;
- refresh-token в JS storage;
- зависимость UI-gating от legacy auth flags.

## 7. Практическое правило

Если удаление всех ключей в `localStorage/sessionStorage` не должно разлогинивать пользователя после успешного refresh-cookie recovery, то такой flow соответствует целевой policy.
