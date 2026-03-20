# Interactive Tour Role Scenarios

## Назначение

Документ фиксирует ролевые сценарии интерактивного тура и acceptance-ожидания для `master-flow` в production-like режиме.

Цели:

- подтвердить, что один `master-flow` корректно фильтруется по роли;
- подтвердить, что нерелевантные шаги не только не показываются пользователю, но и не участвуют в visible-flow при отсутствии нужных DOM-элементов;
- дать QA и релизному smoke единый чек-лист поведения тура.

## Источник истины

- `src/js/modules/ui/onboarding.js`
- `src/js/modules/ui/onboarding.test.js`

## Master Flow

Базовый порядок шагов:

1. `welcome`
2. `sidebar`
3. `report-button`
4. `add-technology`
5. `add-block`
6. `search`
7. `filters`
8. `radar`
9. `quadrant-zoom`
10. `priority-panel`
11. `detail-panel`
12. `proposal-workflow`
13. `admin-panel-entry`
14. `complete`

## Role Profiles

### `guest`

Видит:

- `welcome`
- `sidebar`
- `report-button`
- `search`
- `filters`
- `radar`
- `quadrant-zoom`
- `priority-panel`
- `detail-panel`
- `complete`

Не видит:

- `add-technology`
- `add-block`
- `proposal-workflow`
- `admin-panel-entry`

### `editor`

Видит:

- `welcome`
- `sidebar`
- `report-button`
- `add-technology`
- `search`
- `filters`
- `radar`
- `quadrant-zoom`
- `priority-panel`
- `detail-panel`
- `proposal-workflow`
- `complete`

Не видит:

- `add-block`
- `admin-panel-entry`

### `owner`

Видит:

- `welcome`
- `sidebar`
- `report-button`
- `add-technology`
- `add-block`
- `search`
- `filters`
- `radar`
- `quadrant-zoom`
- `priority-panel`
- `detail-panel`
- `proposal-workflow`
- `complete`

Не видит:

- `admin-panel-entry`

### `admin`

Видит полный flow:

- `welcome`
- `sidebar`
- `report-button`
- `add-technology`
- `add-block`
- `search`
- `filters`
- `radar`
- `quadrant-zoom`
- `priority-panel`
- `detail-panel`
- `proposal-workflow`
- `admin-panel-entry`
- `complete`

## DOM Preconditions

Часть шагов зависит не только от роли, но и от наличия целевых элементов в DOM:

- `report-button` требует `#exportPdfModal`
- `add-technology` требует `#addTechPanel`
- `add-block` требует `#addBlockPanel`
- `priority-panel` требует `#quadrantPriorityPanel`
- `detail-panel` требует `#quadrantPriorityPanel`

Это важно для production-like режима:

- если шаг разрешен по роли, но соответствующий DOM-элемент не существует, шаг не должен попадать в visible-flow;
- тур не должен “обещать” пользователю функциональность, которой нет в текущем контексте страницы или сборки;
- скрытие происходит до рендера tooltip и до перехода на шаг.

## Acceptance Scenarios

### Scenario 1. Guest baseline

Предусловия:

- пользователь авторизован как `guest`;
- в DOM присутствуют стандартные tour-targets.

Ожидания:

- шаги CRUD, moderation и admin не входят в visible-flow;
- пользователь проходит только обзорный сценарий чтения/поиска/фильтров.

### Scenario 2. Editor proposal flow

Предусловия:

- пользователь авторизован как `editor`;
- в DOM присутствует `#addTechPanel`.

Ожидания:

- шаг `add-technology` входит в visible-flow;
- шаг `proposal-workflow` входит в visible-flow;
- шаг `add-block` отсутствует;
- шаг `admin-panel-entry` отсутствует.

### Scenario 3. Owner extended CRUD flow

Предусловия:

- пользователь авторизован как `owner`;
- в DOM присутствуют `#addTechPanel` и `#addBlockPanel`.

Ожидания:

- owner видит шаги CRUD и moderation;
- admin-only шаг не показывается.

### Scenario 4. Admin full flow

Предусловия:

- пользователь авторизован как `admin`;
- все tour-targets страницы присутствуют.

Ожидания:

- администратор видит полный профиль шагов;
- `admin-panel-entry` включен в visible-flow.

### Scenario 5. Missing DOM target

Предусловия:

- роль допускает шаг;
- соответствующий DOM target отсутствует.

Примеры:

- `editor`, но нет `#addTechPanel`;
- `owner`, но нет `#addBlockPanel`;
- любая роль, но нет `#quadrantPriorityPanel`.

Ожидания:

- такие шаги исключаются из visible-flow;
- пользователь не получает tooltip для несуществующего UI;
- hidden steps не должны влиять на счетчик шагов тура.

## Smoke Checklist

Для ручного smoke перед релизом:

1. Запустить тур под `guest`, `editor`, `owner`, `admin`.
2. Проверить, что счетчик шагов меняется по роли.
3. Проверить, что `editor` видит proposal-flow, но не видит owner/admin-only шаги.
4. Проверить, что `admin` видит `admin-panel-entry`.
5. Проверить, что при отсутствии нужного modal/panel шаг не появляется в flow.
6. Проверить, что при завершении или skip тур убирает overlay, tooltip и временные highlight-классы.

## Test Coverage

Минимальное автоматическое покрытие должно подтверждать:

- `master-flow` зафиксирован и стабилен;
- role-profile filtering работает для `guest/editor/owner/admin`;
- steps с conditional DOM-target не попадают в visible-flow при отсутствии соответствующих элементов;
- скрытые шаги действительно исключаются из подсчета и не становятся доступными через `getVisibleStepIdsForRole()`.
