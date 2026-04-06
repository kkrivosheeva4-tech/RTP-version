# Team Responsibilities

**Статус:** draft baseline  
**Владелец:** tech lead  
**Триггер обновления:** изменения в ownership по backend, frontend, CI/CD, docs, release или support-процессам

## Цель

Зафиксировать зоны ответственности так, чтобы изменения в `RTP-3` имели понятного владельца на этапе разработки, проверки, выката и сопровождения.

## Роли и зоны ответственности

## Backend owner

Отвечает за:

- Django/DRF код, migrations, seeders и admin API;
- auth, permissions, 2FA, security headers, CORS/CSRF;
- OpenAPI и фактический API contract;
- backend tests и качество Python-кода.

## Frontend owner

Отвечает за:

- Django-served frontend, модульный frontend и non-module legacy слой;
- role-gating в UI, auth screens, onboarding и moderation/admin flow;
- frontend unit/e2e coverage;
- совместимость UI с backend API contract.

## DevOps / Release owner

Отвечает за:

- GitHub Actions workflows, quality gates и release pipeline;
- deployment profile, env baseline и runtime mode;
- PostgreSQL smoke, dry-run и release readiness;
- versioning, go/no-go решение и release artifacts.

## Documentation owner

Отвечает за:

- актуальность обязательного doc-set;
- синхронизацию docs с кодом, CI и OpenAPI;
- фиксацию runbook, responsibilities и release rules;
- исключение дублирующих и устаревших документов.

## Общие правила ownership

1. Изменение контракта без обновления docs считается незавершенным.
2. Изменение CI/gates без обновления `docs/RELEASE_PROCESS.md` считается незавершенным.
3. Изменение ролей, moderation или auth-flow без синхронизации backend/frontend/docs считается незавершенным.
4. Если изменение затрагивает несколько областей, назначается один primary owner и минимум один reviewer из соседней зоны.

## Review Matrix

- Backend API или security: backend owner + frontend owner.
- Frontend role/auth flow: frontend owner + backend owner.
- CI/CD, env, smoke, release: DevOps / release owner + tech lead.
- Документация, меняющая правила выката или эксплуатации: documentation owner + primary technical owner.

## Артефакты по умолчанию

Для закрытия задачи владелец изменения должен оставить:

- код;
- проверку или тест;
- обновление документации, если изменился процесс, контракт или эксплуатационный сценарий.
