# Role Model V2

**Статус:** baseline  
**Владелец:** backend + frontend owners  
**Триггер обновления:** изменение ролей, capability-layer, auth-flow, admin/moderation прав или API-контракта

## Цель

Зафиксировать единую ролевую модель `guest/editor/owner/admin`, которая используется в backend, frontend и документации как основной runtime-контракт.

## Канонические роли

- `guest`
- `editor`
- `owner`
- `admin`

Источник правды для frontend runtime-gating: `src/js/config/roles-config.js`.  
Источник правды для backend permissions: `backend/auth_custom/*`.

## Capability Matrix

- `guest`: `read_radar`, `use_filters`, `export_reports`
- `editor`: права `guest` + `create_proposals`, `view_proposal_statuses`
- `owner`: права `editor` + `manage_technologies`, `publish_technologies`, `review_proposals`
- `admin`: права `owner` + `manage_admin_panel`, `manage_users`

## Legacy Mapping

Legacy-роли нормализуются во frontend и backend до v2:

- `architect` -> `owner`
- `director` -> `owner`
- `project_manager` -> `owner`
- `analyst` -> `guest`
- `viewer` -> `guest`

Legacy-значения допускаются только как переходный слой совместимости. Runtime UI не должен строить поведение на прямых проверках legacy-ролей.

## Runtime Rules

- UI-gating должен опираться на capabilities, а не на строки legacy-ролей.
- Доступ в админ-панель разрешен только роли `admin`.
- Прямое управление технологиями разрешено ролям `owner` и `admin`.
- Роль `editor` работает через moderation flow, а не через прямой publish path.

## Связанные контракты

- role normalization: `src/js/config/roles-config.js`
- auth UI / shell gating: `src/js/modules/ui/common-ui.js`, `src/js/modules/business/auth.js`, `src/js/script.js`
- backend permission enforcement: `backend/auth_custom/permissions.py`
- admin API: `backend/admin_panel/*`
- moderation API: `backend/technologies/views.py`
