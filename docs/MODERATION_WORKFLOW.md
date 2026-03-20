# Moderation Workflow

**Статус:** baseline  
**Владелец:** backend + frontend owners  
**Триггер обновления:** изменение proposal endpoints, proposal statuses, review UX или publish rules

## Цель

Описать фактический moderation contract между frontend и backend для изменений технологий.

## Фактическая модель

### Роли

- `editor` создает proposal и видит свои статусы
- `owner` и `admin` просматривают pending proposals и принимают решение

### Proposal Actions

- `create`
- `update`
- `delete`

### Proposal Statuses

- `draft`
- `approved`
- `rejected`

## Backend Endpoints

- `POST /api/v1/technology-proposals`
- `GET /api/v1/technology-proposals/mine`
- `GET /api/v1/technology-proposals/pending`
- `POST /api/v1/technology-proposals/{id}/approve`
- `POST /api/v1/technology-proposals/{id}/reject`

## Publish Rules

- `create` proposal при approve создает новую `Technology`
- `update` proposal при approve применяет `payload` к целевой `Technology`
- `delete` proposal при approve удаляет целевую `Technology`
- reject не меняет технологию, а только переводит proposal в `rejected`

## Status Contract

В текущем коде есть два разных status-слоя:

- `TechnologyProposal.status`: строгий moderation status `draft/approved/rejected`
- `Technology.status` и `TechnologyEnterpriseReadiness.status`: прикладной status технологии, фактически свободное поле с текущим baseline `research/planned` и историческими значениями из миграции данных

Это значит, что moderation status и business status технологии не являются одним и тем же полем.

## Ограничения текущего baseline

- backend moderation API реализован полностью;
- frontend role/onboarding уже знает про proposal capabilities;
- полноценный proposal review UI во frontend еще требует отдельного завершения и acceptance-покрытия.
