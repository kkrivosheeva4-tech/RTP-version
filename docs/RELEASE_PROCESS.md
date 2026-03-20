# Release Process

**Статус:** draft baseline  
**Владелец:** tech lead / release owner  
**Триггер обновления:** изменения в CI, quality gates, release ветвлении, smoke-процедурах или deployment profile

## Цель

Этот документ фиксирует минимальный release flow для `RTP-3`, чтобы локальная проверка, CI и решение о выкате опирались на один и тот же набор обязательных gates.

## Release Gates

До создания release-кандидата должны одновременно выполняться:

1. `pre-commit` проходит локально без пропусков.
2. Backend quality проходит:
   - `ruff`
   - `black --check`
   - `isort --check-only`
3. Frontend quality проходит:
   - `npm run lint:frontend`
   - `npm run format:check:frontend`
4. Тестовый минимум проходит:
   - backend tests
   - `npm run test:run`
5. Сборочный минимум проходит:
   - `npm run build`
6. Документация не противоречит фактическому коду, CI и API контракту.

## Локальная проверка перед PR

Обязательная последовательность перед отправкой изменений:

```bash
pre-commit run --all-files
npm run quality:frontend
npm run test:run
npm run build
python backend/manage.py test auth_custom references technologies admin_panel config
```

Если изменение не затрагивает одну из подсистем, допустимо запускать сокращенный набор проверок, но только если это явно отражено в описании PR.

## CI Baseline

Обязательные проверки в CI:

- `lint`
- `backend-tests`
- `frontend-unit-tests`

Job `lint` обязан проверять и backend quality, и frontend quality, и frontend build. PR не считается готовым к merge, если любой из этих шагов не проходит.

## Release Candidate Flow

1. Убедиться, что ветка содержит только согласованный scope изменений.
2. Проверить зеленый CI по quality, tests и build.
3. Сверить изменения с `docs/NEXT_DEVELOPMENT_PLAN.md` и актуальным backlog.
4. Выполнить smoke-проверки для затронутых сценариев.
5. Зафиксировать решение `go/no-go`.
6. Только после этого маркировать build как release candidate.

## `v1.0.0-rc` Checklist

Перед подготовкой `v1.0.0-rc` должны быть подтверждены:

1. `PostgreSQL-only` baseline без SQLite fallback.
2. `SERVE_FRONTEND_FROM_DJANGO=True` как целевой deployment mode.
3. cookie/session-driven auth baseline и отсутствие auth truth в browser storage.
4. `pyotp` как единственный backend TOTP provider.
5. `docker build` и `docker compose` baseline.
6. migrate/seed smoke на PostgreSQL.
7. backup create + dry-run restore + actual restore evidence.
8. load smoke evidence.
9. local prodlike smoke evidence.

## RC Evidence Package

Для `v1.0.0-rc` release owner собирает:

- commit SHA / RC identifier;
- green `quality.yml`;
- frontend build artifact evidence;
- PostgreSQL smoke output;
- load smoke summary;
- backup/restore evidence;
- local prodlike smoke evidence;
- список ограничений и финальное решение `GO/NO-GO`.

## Go / No-Go

`Go` разрешен, если:

- все обязательные gates зеленые;
- нет незакрытых blocker/critical дефектов по затронутому scope;
- docs и runbook обновлены, если менялся процесс, контракт или эксплуатационный режим.

`No-Go` обязателен, если:

- quality/tests/build не воспроизводятся локально и в CI;
- PR вводит временный workaround без зафиксированного follow-up;
- release зависит от ручного знания, которого нет в документации.

## Test AD Decision Matrix

Для test AD contour решение `go/no-go` считается формализованным только если одновременно заполнены:

1. release evidence из этого документа;
2. deployment evidence из `docs/TEST_AD_DEPLOYMENT_RUNBOOK.md`;
3. smoke evidence по PostgreSQL, cookie auth, API docs, onboarding/roles, moderation/admin path.

### Обязательные условия `GO` для test AD

- backend стартует с целевым env profile;
- PostgreSQL migration/dry-run уже подтвержден или повторно пройден;
- `/api/v1/health`, `/api/v1/openapi.json`, `/api/v1/docs` отвечают корректно;
- Swagger UI использует локальные assets, а не CDN;
- cookie auth smoke проходит;
- role-tour smoke проходит;
- moderation/admin path проходит;
- нет blocker/critical дефектов по security, auth, deployment, data integrity.

### Обязательные условия `NO-GO` для test AD

- отсутствует deployment runbook или smoke evidence;
- release нельзя воспроизвести по документам без устной передачи знаний;
- PostgreSQL smoke не пройден;
- auth / 2FA / refresh / logout нестабильны;
- `/api/v1/docs` зависит от внешнего CDN или не открывается;
- role/onboarding или moderation/admin flow не подтверждены в целевом контуре.

### Minimum Evidence Package

Перед фиксацией `GO` release owner должен иметь:

- commit / RC identifier;
- env baseline;
- ссылки или логи quality/tests/build;
- перечень выполненных smoke-checks;
- список известных ограничений;
- зафиксированное решение `GO` или `NO-GO`.

## Артефакты приемки

Для каждого release-кандидата должны быть доступны:

- ссылка на зеленый CI;
- краткий список включенных изменений;
- перечень выполненных smoke-проверок;
- список известных ограничений, если они приняты осознанно.

Сопутствующие runbooks:

- `docs/BACKUP_RESTORE_RUNBOOK.md`
- `docs/LOAD_SMOKE_RUNBOOK.md`
- `docs/TEST_AD_DEPLOYMENT_RUNBOOK.md`
