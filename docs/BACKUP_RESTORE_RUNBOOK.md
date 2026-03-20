# Backup Restore Runbook

## Цель

Зафиксировать минимально воспроизводимый backup/restore flow для `RTP-3` admin API.

## Охват

Текущий baseline backup включает:

- пользователей и их роли;
- audit log records;
- предприятия и связи с функциональными блоками.

Restore работает как controlled upsert:

- восстанавливает пользователей, роль и `is_active`;
- восстанавливает enterprises и `block_ids`;
- дозаливает audit log records, которых еще нет в БД;
- не восстанавливает пароли пользователей в исходное состояние.

## Create Backup

```bash
POST /api/v1/admin-panel/backups
```

Пример payload:

```json
{
  "name": "rc-backup",
  "description": "Pre-release snapshot"
}
```

## Dry-Run Restore

```bash
POST /api/v1/admin-panel/backups/{id}/restore
```

Пример payload:

```json
{
  "dry_run": true
}
```

Ожидаемый результат:

- `200 OK`
- объект `counts`
- без изменения данных в БД

## Actual Restore

```bash
POST /api/v1/admin-panel/backups/{id}/restore
```

Пример payload:

```json
{}
```

Ожидаемый результат:

- `200 OK`
- `restored_counts`
- audit event `restore`

## Verification

После restore нужно проверить:

1. измененный enterprise вернулся к значениям из snapshot;
2. `block_ids` синхронизированы со snapshot;
3. backup file доступен для download;
4. в audit присутствует restore event;
5. backup не помечен как `is_restorable=false`.

## Release Evidence

Для release baseline достаточно приложить:

- ID backup snapshot;
- dry-run output;
- actual restore output;
- подтверждение одного восстановленного enterprise/user сценария.
