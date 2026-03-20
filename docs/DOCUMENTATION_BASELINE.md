# Documentation Baseline (минимально достаточный набор)

**Дата фиксации:** 17.03.2026  
**Цель:** держать документацию компактной и полезной, без возврата удаленных «для полноты» файлов.

## 1) Обязательный doc-set (must-have)

- `docs/NEXT_DEVELOPMENT_PLAN.md`  
  Единый план реализации, этапы, статусы и roadmap.
- `docs/BACKEND_API_SPEC.md`  
  Контракт backend API и auth-flow.
- `docs/openapi.json`  
  Машиночитаемая спецификация API.
- `docs/REGRESSION_CHECKLIST.md`  
  Регрессионный чеклист перед релизом/выкатом.
- `docs/MATHEMATICAL_MODEL_DOCUMENTATION.md`  
  Формальная документация матмодели и факторного движка.
- `docs/MODULES_DOCUMENTATION.md`  
  Карта модульной архитектуры frontend.
- `docs/RELEASE_PROCESS.md`  
  Release flow, quality gates, versioning и критерии go/no-go.
- `docs/TEAM_RESPONSIBILITIES.md`  
  Матрица ответственности по backend/frontend/devops/docs/release.

## 2) Поддерживающие документы (keep-lean)

- `docs/HTML_DOCUMENTATION.md`
- `docs/CSS_DOCUMENTATION.md`
- `docs/JS_NON_MODULES_DOCUMENTATION.md`
- `docs/QUADRANT_POSITIONING_ANALYSIS.md`
- `docs/ROLE_MODEL_V2.md`
- `docs/ROLE_MIGRATION_PLAN.md`
- `docs/MODERATION_WORKFLOW.md`
- `docs/MATH_MODEL_FACTOR_ENGINE.md`
- `docs/INTERACTIVE_TOUR_ROLE_SCENARIOS.md`
- `docs/TEST_AD_DEPLOYMENT_RUNBOOK.md`

Принцип: обновляются только при изменениях, влияющих на разработку/поддержку.

## 3) Архивировано осознанно (не восстанавливать автоматически)

Ниже файлы, ранее упоминавшиеся в старых версиях плана, были удалены как избыточные:

- `docs/TASK_TEMPLATE.md`
- `docs/API_VERSIONING_POLICY.md`
- `docs/ARCHITECTURE_BRIEF.md`
- и другие вторичные артефакты, дублировавшие рабочие решения.

## 4) Источники правды вместо архивированных файлов

- Роли и права: `backend/auth_custom/*`, `backend/technologies/*`, `src/js/config/*`, `src/js/modules/ui/*`.
- CI/quality gates: `.github/workflows/*`, `.pre-commit-config.yaml`, `backend/pyproject.toml`, `package.json`.
- Auth и security-настройки: `backend/config/settings.py`, `backend/auth_custom/*`, `src/js/modules/core/api-client.js`, `src/js/auth*.js`.
- PostgreSQL / deployment / runtime mode: `backend/config/settings.py`, `backend/config/urls.py`, `backend/config/views.py`, `backend/.env*.example`, `docs/POSTGRES_MIGRATION_RUNBOOK.md`.
- План релиза и следующая разработка: `docs/NEXT_DEVELOPMENT_PLAN.md`.

## 5) Политика минимализма docs

- Новый документ добавляется только если без него нельзя:
  - безопасно выкатывать изменения,
  - поддерживать систему командой,
  - передавать знание без устных договоренностей.
- Если документ устарел или дублирует код/другой doc, он архивируется или удаляется.
- Для каждого добавленного doc обязательно указывается владелец и триггер обновления.
