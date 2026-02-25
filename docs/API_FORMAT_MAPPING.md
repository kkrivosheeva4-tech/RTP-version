# Маппинг форматов API ↔ клиентский формат

Документация для интеграции backend API. DataService использует `normalizeTechnologyFromNewFormat` для преобразования ответов API в формат приложения.

## Технология (Technology)

### API / JSON → Клиент

| API / JSON поле | Клиентское поле | Примечание |
|-----------------|-----------------|------------|
| `id` | `id` | без изменений |
| `name` | `name` | без изменений |
| `description` | `description` | без изменений |
| `marketExamples` | `exampleDesc` | массив → строка (join `\n`) |
| `block` (number \| string) | `block` | number → имя по blockIdToName; string → как есть |
| `blocks` (number[]) | `blocks` | массив id → массив имён блоков |
| `function` | `func` | без изменений |
| `functionCoverage` | `functions` | массив функций |
| `directions` | `directions`, `direction` | direction = directions[0] |
| `enterprises` | `company`, `companyRatings` | enterpriseId → имя предприятия; status "Внедрена" → isImplemented |
| `technologicalReadiness`, `organizationalReadiness` | `techRead`, `organRead` | 1–9 → 0–3 (normalizeReadiness) |
| `trlStage` | `trlStage`, `level` | 1–3→1, 4–6→2, 7–9→3; level: "Внедрена"→"Используемые", и т.д. |
| `status` | `status`, `level` | level = кольцо радара |
| `vendors` | `vendors` | без изменений |
| `integrators` | `integrators` | без изменений |
| `documentationFiles` | `files` | путь → `{ path, name }` |
| `funcCover` | `funcCover` | 1–3 по количеству функций |

### Клиент → API (при создании/обновлении)

API ожидает структуру, совместимую с JSON. Основные поля:
- `id`, `name`, `description`, `block`, `blocks`, `function`, `functionCoverage`, `directions`, `enterprises`, `trlStage`, `status`, `vendors`, `documentationFiles`, `marketExamples`

## Endpoints DataService

| Метод DataService | API endpoint | Mock |
|-------------------|--------------|------|
| `loadTechnologies(enterpriseId?)` | `GET /api/v1/technologies?enterpriseId=` | loadJsonPreferVfs + vfsRead |
| `loadReference(name)` | `GET /api/v1/references/{name}` | loadJsonPreferVfs + vfsRead |
| `createTech(tech)` | `POST /api/v1/technologies` | vfsWrite |
| `updateTech(id, tech)` | `PATCH /api/v1/technologies/{id}` | vfsWrite |
| `deleteTech(id)` | `DELETE /api/v1/technologies/{id}` | vfsWrite |
| `saveTechnologies(technologies)` | `PUT /api/v1/technologies/bulk` | vfsWrite |
| `saveReference(name, data)` | `PUT /api/v1/references/{name}` | vfsWrite |

## Справочники

- `blocks`, `functions`, `functionToBlock`, `digitalDirections`, `directionToQuadrant`, `vendors`, `integrators`, `enterprises`

Формат справочников — как в `src/data/ru/*.json`.
