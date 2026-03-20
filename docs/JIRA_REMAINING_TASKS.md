# Реальный backlog для Jira / Kanban по RTP-3

**Дата сверки:** 19.03.2026
**Основание:** фактическая проверка репозитория, `docs/NEXT_DEVELOPMENT_PLAN.md` v3.0
**Цель документа:** задачи для постановки на kanban-доску

---

## 1. Что уже сделано (не ставить в работу)

- Backend quality stack (`pyproject.toml`), frontend quality (eslint, prettier, scripts в `package.json`)
- `.pre-commit-config.yaml`, `.github/workflows/quality.yml`, `.github/workflows/e2e.yml`
- Role model v2, moderation API, factor-engine, role-based onboarding
- HttpOnly cookie auth flow; auth-state **удалён** из localStorage/sessionStorage
- Admin frontend **переведён на backend API** (users, audit, backups, enterprises)
- PostgreSQL-only, Dockerfile, docker-compose
- `SERVE_FRONTEND_FROM_DJANGO=True`, Swagger UI на локальных ассетах
- CDN-зависимости `Chart.js`, `jspdf`, `jspdf-autotable`, `html2canvas` переведены на локальные npm-пакеты
- `docs/FRONTEND_STORAGE_POLICY.md` уточнён: в API-режиме admin-данные не являются localStorage source of truth
- Документы: RELEASE_PROCESS, TEAM_RESPONSIBILITIES, ROLE_MODEL_V2, ROLE_MIGRATION_PLAN, MODERATION_WORKFLOW, MATH_MODEL_FACTOR_ENGINE, INTERACTIVE_TOUR_ROLE_SCENARIOS, TEST_AD_DEPLOYMENT_RUNBOOK

---

## 2. Задачи для Kanban-доски

### JIRA-01. Перевести CDN-зависимости на локальные пакеты

**Тип:** Технический долг  
**Приоритет:** Высокий

**Описание:**  
Chart.js (admin.html) и jsPDF/html2canvas (radar.html) загружаются с CDN. Для автономного deployment и compliance требуется раздача из локальных npm-пакетов.

**Задачи:**

- [x] Установить `chart.js`, `jspdf`, `jspdf-autotable`, `html2canvas` через npm
- [x] Заменить `<script src="https://cdn...">` на импорт из node_modules / Vite bundle
- [x] Обновить CSP в admin.html и radar.html (убрать cdnjs/cdn.jsdelivr при необходимости)
- [ ] Проверить работу экспорта PDF и графиков в админке

**Acceptance Criteria:**  
Нет внешних CDN-скриптов для Chart.js и jsPDF; приложение работает офлайн по этим функциям.

---

### JIRA-02. Актуализировать FRONTEND_STORAGE_POLICY

**Тип:** Документация  
**Приоритет:** Средний

**Описание:**  
При API-режиме admin-данные (audit, backups, enterprises) загружаются с backend и не дублируются в localStorage. Политика должна это отражать.

**Задачи:**

- [x] Уточнить в документе: при `USE_API=true` adminAuditLogs, adminBackups, adminUsers, adminEnterprises не используются как source of truth
- [x] Описать fallback на localStorage только для mock/offline режима

**Acceptance Criteria:**  
Документ соответствует фактическому поведению кода.

---

### JIRA-03. Зафиксировать решение по JWT в документации

**Тип:** Документация / Архитектура  
**Приоритет:** Средний

**Описание:**  
Используется кастомная JWT-реализация (`auth_custom.jwt_utils`). Решение «simplejwt vs кастомная» не зафиксировано.

**Задачи:**

- [x] Добавить в `BACKEND_API_SPEC.md` или отдельный doc раздел «JWT: кастомная реализация»
- [x] Указать причины выбора и границы поддержки

**Acceptance Criteria:**  
Разработчики понимают, какая JWT-реализация используется и почему.

---

### JIRA-04. Проверить 2FA опциональность по пользователю

**Тип:** Проверка / Доработка  
**Приоритет:** Средний

**Описание:**  
2FA должна быть опциональной: пользователи без включённой 2FA входят без запроса кода.

**Задачи:**

- [x] Проверить flow: login без 2FA → сразу токены
- [x] Проверить flow: login с 2FA → requires_2fa → verify → токены
- [x] При необходимости доработать backend/frontend

**Acceptance Criteria:**  
Пользователь без 2FA входит без лишних шагов; с 2FA — проходит verify.

---

### JIRA-05. Провести финальный production smoke

**Тип:** QA / DevOps  
**Приоритет:** Средний

**Описание:**  
Воспроизводимая проверка полного стека: cookie auth + PostgreSQL + HTTPS.

**Задачи:**

- [x] Зафиксировать local-prodlike / test-AD smoke contract в runbook и smoke protocol
- [x] Пройти автоматизированный сценарий: login → refresh → logout → /users/me
- [ ] Запустить contour-specific manual smoke с PostgreSQL и HTTPS
- [ ] Проверить admin-панель (users, audit, backups, enterprises) в contour

**Acceptance Criteria:**  
Есть воспроизводимый smoke-протокол и успешный прогон.

---

### JIRA-06. Решение по negative weights в factor-engine

**Тип:** Архитектура / Документация  
**Приоритет:** Низкий

**Описание:**  
В `MATH_MODEL_FACTOR_ENGINE.md` должно быть зафиксировано: поддерживаются ли отрицательные веса или только negative impact.

**Задачи:**

- [x] Принять решение: negative weights vs только negative impact
- [x] Обновить `MATH_MODEL_FACTOR_ENGINE.md`
- [x] Синхронизировать код с документом при необходимости

**Acceptance Criteria:**  
Документ и код согласованы; решение явно зафиксировано.

---

### JIRA-07. Закрыть TODO в select-events.js

**Тип:** Технический долг  
**Приоритет:** Низкий

**Описание:**  
В `src/js/modules/ui/select-events.js` есть TODO: «убрать после перевода всех потребителей на state. Синхронизация для обратной совместимости.»

**Задачи:**

- [x] Определить потребителей и возможность перевода на state
- [x] Убрать legacy-синхронизацию или задокументировать отложенное удаление

**Acceptance Criteria:**  
TODO закрыт или осознанно оставлен с комментарием.

---

### JIRA-08. Комплексная проверка приложения (код, производительность, безопасность)

**Тип:** QA / Code Review / Performance  
**Приоритет:** Высокий

**Описание:**  
Провести комплексную проверку приложения перед релизом: качество кода, производительность, безопасность, доступность и соответствие документации.

**Задачи:**

| Область                | Проверки                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Код**                | Code review критических путей; проверка дублирования, dead code; соответствие линтерам (ruff, eslint, prettier); покрытие тестами ключевых сценариев |
| **Производительность** | Нагрузочный smoke (`load-smoke.py`); время отклика API; рендеринг радара при большом числе технологий; размер бандла frontend                        |
| **Безопасность**       | CORS; CSRF; защита от XSS; валидация входных данных; безопасность cookies (HttpOnly, Secure, SameSite); отсутствие секретов в коде                   |
| **Приложение**         | E2E-тесты (Playwright); smoke основных сценариев (auth, радар, admin, модерация); проверка на разных ролях; кросс-браузерность                       |
| **Документация**       | Соответствие docs коду; актуальность OpenAPI; runbook для деплоя и восстановления                                                                    |
| **Инфраструктура**     | CI проходит без ошибок; docker build успешен; migrate + seed работают                                                                                |

**Задачи (чек-лист):**

- [ ] Выполнить code review backend и frontend
- [ ] Запустить `load-smoke.py` и зафиксировать результаты
- [ ] Проверить security headers (CSP, CORS, cookies)
- [ ] Прогнать E2E-тесты (Playwright)
- [ ] Проверить работу приложения для ролей guest, editor, owner, admin
- [ ] Сверить документацию с фактическим кодом
- [ ] Проверить CI pipeline (quality.yml, e2e.yml)
- [ ] Зафиксировать результаты в чеклисте или отчёте

**Acceptance Criteria:**  
Есть чек-лист/отчёт с результатами проверки; выявленные критические проблемы устранены или зафиксированы в backlog.

---

### JIRA-09. Убрать legacy auth fallback из production runtime-path

**Тип:** Технический долг / Архитектура  
**Приоритет:** Средний

**Описание:**  
В `src/js/modules/business/auth.js`, `src/js/modules/ui/common-ui.js` и `src/js/auth.js` сохраняется fallback на `localStorage`-ключи `isLoggedIn`, `username`, `role`. Это противоречит целевой модели, где source of truth для auth — backend session / `/api/v1/users/me/`.

**Задачи:**

- [x] Определить, какие ветки реально нужны только для mock/offline режима
- [x] Убрать чтение legacy auth flags из production/API runtime-path
- [x] Если mock fallback нужен, изолировать его явно и отразить в docs
- [x] Добавить/обновить тесты на bootstrap/logout/renderAuth без зависимости от legacy storage

**Acceptance Criteria:**  
В API-режиме runtime UI не зависит от `isLoggedIn` / `username` / `role` в browser storage; legacy fallback либо удален, либо явно ограничен mock-only сценарием.

---

### JIRA-10. Синхронизировать CSRF contract для cookie refresh/logout

**Тип:** Backend / Frontend / QA  
**Приоритет:** Средний

**Описание:**  
Backend включает CSRF-защиту для cookie-based refresh/logout через `AUTH_REFRESH_REQUIRE_CSRF`, но часть тестовых ожиданий и практических сценариев ещё не зафиксирована как единый контракт. Нужна одна согласованная схема для backend, frontend, тестов и runbook.

**Задачи:**

- [x] Зафиксировать целевой contract: обязателен ли CSRF header для refresh/logout в cookie-режиме
- [x] Привести backend tests к фактическому contract
- [x] Проверить frontend client и production-like smoke на передачу CSRF при cookie refresh/logout
- [x] Обновить runbook / API docs с явным описанием сценария

**Acceptance Criteria:**  
Cookie refresh/logout ведут себя одинаково в backend, frontend, тестах и документации; нет падающих/двусмысленных сценариев вокруг CSRF.

---

### JIRA-11. Сделать локальный test workflow воспроизводимым

**Тип:** DX / QA / CI parity  
**Приоритет:** Средний

**Описание:**  
Локальные проверки сейчас воспроизводятся не полностью: frontend unit tests упираются в `spawn EPERM` при запуске Vitest/esbuild, а backend tests при повторном запуске могут требовать интерактивного удаления `test_rtp3`.

**Задачи:**

- [x] Исправить локальный запуск frontend unit tests без `spawn EPERM`
- [x] Сделать backend test command non-interactive для повторных запусков
- [x] Добавить в docs единые команды локальной проверки, совпадающие по смыслу с CI
- [x] Проверить, что повторный прогон quality/test сценариев не требует ручного вмешательства

**Acceptance Criteria:**  
Разработчик может повторно прогнать frontend/backend тесты локально без интерактивных вопросов и без platform-specific блокеров.

---

## 3. Рекомендуемый порядок на доске

| Wave       | Задачи                                      |
| ---------- | ------------------------------------------- |
| **Wave 1** | JIRA-01, JIRA-02                            |
| **Wave 2** | JIRA-03, JIRA-04, JIRA-05, JIRA-09, JIRA-10 |
| **Wave 3** | JIRA-08, JIRA-11, JIRA-06, JIRA-07          |

---

## 4. Правило интерпретации

- Задача в этом документе = **не закрыта полностью**, подходит для kanban.
- Задачи нет = либо уже сделана, либо входит в другой блок и не требует отдельной карточки.
