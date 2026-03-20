# Role Migration Plan

**Статус:** in-progress  
**Владелец:** frontend + backend owners  
**Триггер обновления:** закрытие очередного migration step по role-gating или удаление legacy fallback

## Цель

Перевести проект на role model v2 без legacy runtime-веток и без расхождения между backend permissions, frontend UI и тестовыми сценариями.

## Уже выполнено

- backend использует v2-роли `guest/editor/owner/admin`;
- frontend capability-layer собран в `src/js/config/roles-config.js`;
- legacy-роли нормализуются в `owner` или `guest`;
- runtime gating в `src/js/script.js` и `src/js/admin.js` больше не опирается на прямые legacy role checks.

## Оставшиеся шаги

1. Перевести оставшийся frontend auth-state с прямого чтения `localStorage` на backend/session-driven contract.
2. Довести moderation flow для `editor`/`owner`/`admin` до полного UI-сценария на backend API.
3. Расширить acceptance coverage по скрытию недоступных действий и review-сценариям.

## Правила миграции

- новый код не должен использовать прямые проверки `architect/director/project_manager`;
- новые UI-ограничения описываются через capability;
- backend и frontend меняются синхронно, если меняется permission contract.

## Критерий завершения

- нет runtime UI-веток, основанных на legacy role strings;
- frontend и backend используют одинаковую capability-модель;
- role-specific acceptance tests подтверждают скрытие недоступных действий.
