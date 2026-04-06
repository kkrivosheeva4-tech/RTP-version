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
- `rmk_access_token`
- `rmk_refresh_token`

Примечание:

- runtime UI должен опираться на backend session, runtime state и `/api/v1/users/me/`; legacy auth flags не считаются допустимым источником истины.
- указанные legacy-ключи допускаются только как объекты принудительной очистки при старых сессиях браузера, но не как рабочее хранилище.

## 3. Что остается в `sessionStorage`

Разрешен только короткоживущий pre-auth/session UX state:

- `auth2faPending`

Назначение:

- хранение временного `session_id` и служебных данных между страницами `auth -> 2fa setup/verify`;
- кратковременное хранение `access_token` в рамках текущей вкладки до его автоматического обновления через cookie-based refresh;
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

- `adminBackups` не должен использоваться как источник истины; список backup-ов и операции restore/delete идут через backend API
- `adminUsers` не должен использоваться как источник истины; список пользователей и изменение ролей идут через backend API
- `adminEnterprises` не должен использоваться как источник истины; список предприятий и CRUD идут через backend API
- `rmk_position_cache`, `rmk_position_cache_version` — кэш позиций технологий на радаре
- `rtp_functionToBlock_data`, `rtp_functionToBlock_version` — **не используются** (привязка функций к блокам хранится только в памяти сессии, не в localStorage)
- `rtp_functionWeights` — веса функций (локальные настройки)
- `techFormState` — состояние формы редактирования технологии (сбрасывается при logout)
- `tech_notifications` — уведомления об изменениях технологий
- `rmk_vendors_list`, `rmk_integrators_list` — локальный кэш списков вендоров и интеграторов
- `rtp_tech_history` — история технологий для аналитики (temporal-dynamics)

Практическое правило для admin storage:

- наличие legacy-ключей в браузере не считается production source of truth и не должно дублировать фактические admin-данные, загруженные с backend
- новые сценарии не должны добавлять `localStorage/sessionStorage` как fallback для бизнес-данных или для refresh-механизма

## 5. Что должно мигрировать из storage

В backend / cookie / runtime state:

- финальный auth-session;
- текущая роль пользователя;
- refresh lifecycle;
- данные пользователя для UI gating.

## 6. Что удаляется

Из целевого deployment baseline исключаются:

- auth truth в `localStorage`;
- access-token в JS storage как постоянный storage baseline;
- refresh-token в JS storage;
- зависимость UI-gating от legacy auth flags.

## 7. Практическое правило

Если удаление всех ключей в `localStorage/sessionStorage` не должно разлогинивать пользователя после успешного refresh-cookie recovery, то такой flow соответствует целевой policy.
