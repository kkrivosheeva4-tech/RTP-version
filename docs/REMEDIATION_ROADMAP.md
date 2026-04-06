# Roadmap Исправления Критичных И Архитектурных Недостатков RTP-3

**Дата фиксации:** 26.03.2026  
**Статус:** первая волна remediation выполнена, документ переведен в implementation tracker  
**Основание:** результаты технической проверки текущего состояния приложения  
**Ключевые утвержденные решения:**

- backup должен покрывать всю предметную модель, а не только `users/audit/enterprises`;
- `totp_secret` переводится на `encrypted-at-rest`;
- `localStorage` больше не участвует в production auth-state, кроме строго разрешенных UI-ключей.

## Статус Реализации На 26.03.2026

### Уже выполнено

- Этап 1: `backup/restore` расширен до покрытия предметной модели, добавлен `schema_version=2`, обновлены restore counts и тесты.
- Этап 2: `totp_secret` переведен на `encrypted-at-rest`, добавлен `TOTP_SECRET_ENCRYPTION_KEY`, подготовлена миграция и тесты.
- Этап 3: production auth-state на фронтенде больше не читается из `localStorage/sessionStorage`; legacy auth keys только очищаются.
- Этап 4: `adminAuditLogs` перестал быть источником истины; админский аудит читается только из backend API.
- Этап 5: добавлен безопасный baseline для `CSP` и production `HTTPS`, обновлены env examples, `nginx` example и runbooks.
- Этап 6: из runtime/API-path убран `legacy_role`; фронтенд и внешние API-контракты опираются на каноническую v2 role model.

### Что осталось отдельным follow-up

- локализовать внешние vendor-ассеты и убрать оставшиеся inline/CSP legacy-следы, чтобы перейти к более жесткой `CSP` без CDN-исключений;
- при необходимости удалить внутреннее поле `legacy_role` на отдельной совместимой миграционной итерации;
- синхронизировать исторические `src/pages/*.html` и generated static artifacts с текущим Django runtime baseline, если они еще используются во вспомогательных сценариях;
- довести ручные проверки production-like контура и зафиксировать evidence в release/checklist документах.

## 1. Цель Roadmap

Документ определяет порядок исправления текущих недостатков системы, чтобы:

- сделать восстановление системы реально рабочим;
- снизить security-риск хранения MFA-секретов;
- убрать остаточные legacy-path для авторизации на фронтенде;
- упростить сопровождение системы;
- зафиксировать безопасный baseline для дальнейшей разработки.

## 2. Что исправляем в первую очередь

### Поток A. Backup / Restore

Проблема:

- текущий backup неполный;
- restore не восстанавливает всю предметную модель;
- это не соответствует реальному DR-сценарию.

Цель:

- backup/restore должен восстанавливать рабочее состояние системы целиком на логическом уровне приложения.

### Поток B. 2FA Secret Storage

Проблема:

- `totp_secret` хранится в БД в открытом виде.

Цель:

- `totp_secret` должен храниться в зашифрованном виде;
- в runtime secret расшифровывается только на момент проверки.

### Поток C. Frontend Auth State Cleanup

Проблема:

- frontend еще читает legacy auth-ключи из `localStorage`;
- это расходится с новой auth-моделью.

Цель:

- source of truth для auth-state только backend + runtime state;
- legacy auth keys больше не участвуют в production path.

## 3. Общая стратегия внедрения

Рекомендуемый порядок:

1. Сначала зафиксировать целевую модель данных и контрактов.
2. Потом внедрить server-side исправления.
3. После этого зачистить frontend legacy-пути.
4. Затем расширить тесты.
5. И только после этого обновить эксплуатационные документы и release checklist.

Почему так:

- backup и encrypted secrets меняют модель хранения;
- frontend cleanup должен опираться на уже утвержденный backend baseline;
- тесты нужно строить уже на новой целевой архитектуре.

## 4. Этапы Реализации

## Этап 0. Подготовка И Дизайн

### Цель

Подготовить точную проектную рамку, чтобы реализация не пошла в разные стороны.

### Задачи

1. Зафиксировать полный состав сущностей для backup payload.
2. Зафиксировать формат `schema_version` для backup.
3. Определить формат шифрования `totp_secret`.
4. Определить источник ключа шифрования:
   - `TOTP_SECRET_ENCRYPTION_KEY`
5. Составить whitelist допустимых frontend storage keys.
6. Составить список всех мест, где frontend еще читает legacy auth storage.

### Результат этапа

Должны быть утверждены:

- backup schema;
- encryption design;
- storage policy implementation checklist.

### Артефакты

- этот roadmap;
- обновленный audit doc;
- при необходимости отдельный design note по encryption.

## Этап 1. Расширение Backup / Restore До Полного Предметного Слоя

### Цель

Сделать backup/restore способным восстановить реальное состояние системы.

### Что должно входить в backup

#### Пользователи и auth

- `User`
- `UserProfile`
- опционально `RefreshToken`:
  - рекомендовано не восстанавливать активные refresh-токены как рабочие сессии;
  - допустимо либо исключить, либо сохранять только как служебный слой без реанимации сессий.

#### Справочники

- `FunctionalBlock`
- `FunctionReference`
- `DigitalDirection`
- `Vendor`
- `Integrator`
- `Enterprise`
- `EnterpriseBlockMapping`

#### Технологии

- `Technology`
- `TechnologyBlock`
- `TechnologyFunctionCoverage`
- `TechnologyDirection`
- `TechnologyVendor`
- `TechnologyVendorIntegrator`
- `TechnologyEnterpriseReadiness`

#### Процессы изменений

- `TechnologyProposal`

#### Административные сущности

- `AuditLog`
- `BackupSnapshot` metadata при необходимости

### Порядок восстановления

Восстановление должно идти в порядке зависимостей:

1. `User`
2. `UserProfile`
3. базовые справочники
4. `Enterprise`
5. `EnterpriseBlockMapping`
6. `Technology`
7. связи технологий
8. `TechnologyProposal`
9. `AuditLog`

### Технические задачи

1. Обновить `_build_backup_payload()` в [views.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/admin_panel/views.py).
2. Добавить `schema_version` в backup payload.
3. Обновить `_restore_backup_payload()` под новую схему.
4. Сделать restore устойчивым к частично существующим данным.
5. Добавить `dry_run` validate path для restore.
6. Добавить checksum и метаданные по counts для всех новых сущностей.

### Дополнительные решения

- Активные логины после restore не должны автоматически реанимироваться.
- После restore лучше принудительно считать все старые refresh-сессии недействительными.

### Критерии готовности

- можно развернуть чистую БД;
- загрузить backup;
- получить обратно:
  - пользователей;
  - роли;
  - справочники;
  - технологии;
  - связи;
  - proposals;
  - аудит;
- UI и API работают без ручного довосстановления.

## Этап 2. Перевод `totp_secret` На Encrypted-At-Rest

### Цель

Убрать хранение 2FA secret в открытом виде из БД.

### Целевая модель

- в БД хранится только зашифрованный secret;
- backend умеет:
  - зашифровать secret перед сохранением;
  - расшифровать secret при verify;
- ключ шифрования не хранится в БД.

### Рекомендуемая схема

1. Ввести env variable:
   - `TOTP_SECRET_ENCRYPTION_KEY`
2. Добавить encryption helper module.
3. Перевести доступ к secret через сервисный слой, а не прямое чтение/запись строки.

### Возможный минимальный вариант

- оставить поле `totp_secret`;
- записывать туда уже зашифрованный payload;
- добавить версионность формата шифрования.

### Более чистый вариант

- добавить новое поле:
  - `totp_secret_encrypted`
- мигрировать данные из старого `totp_secret`
- затем удалить plaintext field на отдельном шаге.

### Рекомендуемый путь

Для безопасной миграции лучше делать в два шага:

1. добавить новое encrypted field;
2. мигрировать данные;
3. перевести код на новое поле;
4. удалить старое plaintext field после стабилизации.

### Технические задачи

1. Добавить helper для encrypt/decrypt.
2. Добавить env validation:
   - без encryption key production не стартует.
3. Обновить setup/verify flow в `auth_custom`.
4. Создать data migration для существующих secrets.
5. Обновить backup behavior:
   - сохранять только encrypted secret, если он входит в backup.

### Важные правила

- plaintext secret никогда не логировать;
- plaintext secret никогда не писать в backup;
- plaintext secret никогда не отдавать повторно без необходимости.

### Критерии готовности

- в БД нет открытых TOTP secrets;
- login/setup/verify продолжают работать;
- миграция старых пользователей проходит автоматически;
- тесты на 2FA не ломаются.

## Этап 3. Полная Зачистка Frontend От Legacy Auth-State

### Цель

Сделать backend и runtime state единственным production источником auth-состояния.

### Что запрещаем в production path

Нельзя использовать для определения логина/роли:

- `isLoggedIn`
- `username`
- `userName`
- `role`
- `rmk_access_token` из `localStorage/sessionStorage`
- `rmk_refresh_token` из `localStorage/sessionStorage`

### Что остается допустимым

Допустимые frontend storage keys:

- `theme`
- `selectedEnterprise`
- `rmk_onboarding_completed`
- `rmk_onboarding_progress`
- `rmk_onboarding_version`
- `adminSidebarCollapsed`
- `rmk_position_cache`
- `rmk_position_cache_version`
- `rtp_functionWeights`
- `techFormState`
- `tech_notifications`
- `rmk_vendors_list`
- `rmk_integrators_list`
- `rtp_tech_history`
- `auth2faPending` в `sessionStorage` как временное pre-auth state

### Технические задачи

1. Удалить production-чтение legacy auth keys из:
   - [common-ui.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/modules/ui/common-ui.js)
   - [auth.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/auth.js)
   - [auth-2fa.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/auth-2fa.js)
   - [business/auth.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/modules/business/auth.js)
2. Оставить только:
   - runtime access token;
   - `/api/v1/users/me/`;
   - refresh-cookie;
   - `auth2faPending`.
3. Добавить единый helper-комментарий и enforcement по storage policy.
4. Очистить legacy auth artifacts при старте и logout.

### Что отдельно проверить

- UI не показывает роль без валидного backend state;
- после удаления всех auth keys пользователь не должен “оставаться логином” только из-за localStorage;
- refresh через cookie-mode работает без зависимости от storage.

### Критерии готовности

- UI gating не зависит от legacy auth keys;
- ручное подсовывание `localStorage.role='admin'` ничего не дает;
- после reload сессия поднимается только через backend.

## Этап 4. Удаление Frontend Local Audit Как Канонического Источника

### Цель

Оставить backend audit единственным надежным журналом.

### Проблема

Сейчас существует `adminAuditLogs` в `localStorage`, что:

- не является настоящим аудитом;
- может расходиться с серверным журналом;
- может вводить в заблуждение.

### Технические задачи

1. Перестать писать бизнес-аудит в `adminAuditLogs`.
2. Убрать зависимость UI от локального audit log.
3. Админ-панель должна читать только backend audit API.
4. Если нужен локальный UX-log:
   - переименовать;
   - отделить от server audit.
5. Добавить миграционную очистку `adminAuditLogs`.

### Критерии готовности

- весь audit в UI приходит только с backend;
- локальный storage не влияет на журнал аудита.

## Этап 5. Security Hardening После Основных Исправлений

### 5.1 CSP Hardening

Цель:

- ослабить зависимость от `unsafe-inline` и внешних CDN.

Задачи:

1. провести инвентаризацию inline script/style;
2. вынести inline JS в файлы;
3. локализовать внешние зависимости, где возможно;
4. перейти на более строгий CSP;
5. при необходимости включить `Report-Only` перед enforcement.

### 5.2 Production HTTPS Baseline

Цель:

- зафиксировать полноценный production reverse-proxy baseline.

Задачи:

1. расширить `nginx` пример до полноценного TLS-конфига;
2. зафиксировать redirect 80 -> 443;
3. задокументировать secure cookie / proxy headers / trusted origins;
4. обновить deployment runbook.

## Этап 6. Тесты И Контроль Качества

### Обязательные тесты

#### Backup / Restore

- backup полной модели;
- restore на пустую БД;
- restore поверх непустой БД;
- проверка целостности связей.

#### 2FA Encryption

- setup сохраняет encrypted secret;
- verify использует decrypt path;
- migration шифрует старые plaintext secrets;
- backup не утекает plaintext secret.

#### Frontend Auth Policy

- UI не читает legacy auth-state в production path;
- refresh-cookie recovery работает без `localStorage`;
- logout чистит legacy artifacts;
- 2FA pending state корректно удаляется после завершения flow.

### Дополнительные проверки

- regression smoke после restore;
- security checks под `DEBUG=False`;
- проверка конфигурации cookie auth.

## 5. Разбиение По Рабочим Пакетам

## Work Package 1. Backup Schema

### Ответственность

- backend / data model

### Основные файлы

- [views.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/admin_panel/views.py)
- [models.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/technologies/models.py)
- [models.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/references/models.py)
- [models.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/auth_custom/models.py)

### Результат

- полная backup schema;
- восстановление связанной доменной модели.

## Work Package 2. MFA Secret Encryption

### Ответственность

- backend / auth / security

### Основные файлы

- [models.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/auth_custom/models.py)
- [views.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/auth_custom/views.py)
- [totp_utils.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/auth_custom/totp_utils.py)
- [settings.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/config/settings.py)

### Результат

- encrypted-at-rest для TOTP secret;
- безопасная миграция существующих данных.

## Work Package 3. Frontend Auth Cleanup

### Ответственность

- frontend / auth / UI shell

### Основные файлы

- [common-ui.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/modules/ui/common-ui.js)
- [auth.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/auth.js)
- [auth-2fa.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/auth-2fa.js)
- [auth.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/modules/business/auth.js)
- [api-client.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/modules/core/api-client.js)

### Результат

- production auth-state не зависит от localStorage;
- frontend policy соответствует реальному коду.

## Work Package 4. Audit Cleanup

### Ответственность

- frontend + admin API

### Основные файлы

- [audit-logger.js](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/src/js/audit-logger.js)
- admin frontend modules
- [views.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/admin_panel/views.py)

### Результат

- единый канонический server-side audit.

## Work Package 5. Hardening And Docs

### Ответственность

- backend + ops + docs

### Основные файлы

- [settings.py](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/backend/config/settings.py)
- [rtp3.conf.example](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/ops/nginx/rtp3.conf.example)
- [RUN_INSTRUCTIONS.md](/c:/Users/Ксения/OneDrive/Desktop/РМК/РАДАР/РТП-версии/3%20версия/РТП-3/docs/RUN_INSTRUCTIONS.md)
- deployment runbooks

## 6. Рекомендуемый Порядок Начала Реализации

### Шаг 1

Подготовить технический дизайн для:

- полной backup schema;
- encryption model для `totp_secret`;
- whitelist storage keys.

### Шаг 2

Реализовать backend backup/restore расширение.

### Шаг 3

Реализовать encrypted-at-rest для TOTP secret.

### Шаг 4

Вычистить frontend auth-state от legacy storage path.

### Шаг 5

Убрать локальный audit как канонический.

### Шаг 6

Добавить тесты и обновить документацию.

## 7. Definition Of Done

Roadmap считается реализованным, когда одновременно выполняются условия:

- backup/restore покрывает всю предметную модель;
- `totp_secret` не хранится в plaintext;
- frontend auth-state не зависит от legacy localStorage auth keys;
- audit опирается на backend;
- regression tests закрывают новые критичные сценарии;
- docs отражают новый baseline.

## 8. Практический Следующий Шаг

Следующий рабочий документ после этого roadmap:

- детальный implementation plan по шагам кода.

Рекомендуемое начало:

1. сначала взять `backup/restore`;
2. затем `totp_secret encryption`;
3. потом `frontend auth cleanup`.

Именно такой порядок даст меньше регрессионных конфликтов и быстрее приведет систему к целевому безопасному baseline.
