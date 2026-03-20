# Ревизия рабочего дерева (16.03.2026)

Цель: изолировать смешанные изменения на независимые пакеты, чтобы безопасно продолжать реализацию по плану.

## Статусы пакетов

- `done` — пакет очищен/зафиксирован и не мешает дальнейшей работе.
- `in-progress` — пакет частично структурирован, нужны следующие шаги.
- `todo` — пакет определен, но не подготовлен к интеграции.
- `blocked` — пакет требует внешнего решения.

## Пакет N0: Noise cleanup (`done`)

Что сделано:

- Добавлены ignore-правила для служебных артефактов:
  - `venv/`, `.venv/`
  - `playwright-report/`
  - `test-results/`
- Из git index удалены сгенерированные файлы:
  - `playwright-report/index.html`
  - `test-results/.last-run.json`

Файлы:

- `.gitignore`
- `playwright-report/index.html` (de-index)
- `test-results/.last-run.json` (de-index)

## Пакет D1: Docs/policy (`done`)

Что сделано:

- Обновлен основной roadmap:
  - `docs/NEXT_DEVELOPMENT_PLAN.md`
- Зафиксирован минимальный doc-set и политика архивирования:
  - `docs/DOCUMENTATION_BASELINE.md`

Кандидаты файлов пакета:

- `docs/NEXT_DEVELOPMENT_PLAN.md`
- `docs/DOCUMENTATION_BASELINE.md`
- удаленные docs в статусе `D` (при финальной фиксации истории).

## Пакет F1: Feature B (role model v2 на frontend) (`done`)

Что сделано:

- Приведен role config к v2 + mapping legacy->v2:
  - `src/js/config/roles-config.js`
- UI-гейтинг переведен на capability API:
  - `src/js/modules/business/auth.js`
  - `src/js/modules/ui/common-ui.js`

Что осталось:

- Сверка связанных мест legacy-гейтинга в остальных модулях (при следующих изменениях UI).

Что подтверждено автопроверками:

- `npm.cmd run test:run -- src/js/config/roles-config.test.js src/js/modules/ui/onboarding.test.js`
- Результат: `2 files passed`, `8 tests passed`.
- `npm.cmd run test:e2e -- e2e/auth.spec.js e2e/radar.spec.js`
- Результат: `4 passed`.

Файлы ядра пакета:

- `src/js/config/roles-config.js`
- `src/js/modules/business/auth.js`
- `src/js/modules/ui/common-ui.js`
- `src/js/config/roles-config.test.js`
- `src/js/modules/ui/onboarding.js` (связанный сценарий тура)
- `src/pages/admin.html` (согласование ролей в UI)
- `e2e/*` (роль-ориентированные тесты)

## Пакет I1: Infra C (PostgreSQL + cookie auth) (`in-progress`)

Текущий признак:

- В рабочем дереве уже есть большой пул backend/auth/config изменений, относящихся к этому направлению.

Что нужно сделать для изоляции:

- Выделить финальный набор файлов для C1-C5 (runbook + auth flow + security policy).
- Не смешивать в одном заходе:
  - миграции/модели,
  - auth API,
  - frontend token storage refactor,
  - deployment scripts.

Кандидаты файлов:

- `backend/config/settings.py`
- `backend/auth_custom/*`
- `backend/config/api_urls.py`
- `src/js/config/api-config.js`
- `src/js/auth.js`, `src/js/auth-2fa.js`
- `scripts/postgres-dry-run.ps1`, `scripts/postgres-smoke-check.py`

## Техническая изоляция пакетов (готово)

Для воспроизводимого staging добавлены pathspec-файлы:

- `.revision/package-noise.pathspec`
- `.revision/package-docs.pathspec`
- `.revision/package-feature-b.pathspec`
- `.revision/package-infra-c.pathspec`

Пример применения:

- `git add --pathspec-from-file=.revision/package-docs.pathspec`
- `git add --pathspec-from-file=.revision/package-feature-b.pathspec`

Это позволяет собирать изменения пакетами и не смешивать независимые контуры.

## Рекомендуемый порядок интеграции

1. Закрыть `D1` (документационная фиксация политики).
2. Закрыть `F1` (unit/e2e подтверждение B3/B4).
3. Только после этого поднимать `I1` и проходить C1-C5 отдельной волной.

## Контрольный чек перед продолжением разработки

- [x] Noise отделен.
- [x] Минимальный doc-set зафиксирован.
- [x] Role model v2 подтвержден unit-автопроверками.
- [x] E2E smoke по role flow стабилизирован (B4).
- [x] Пакеты изолированы технически через pathspec; Infra C отделен как отдельный контур.
