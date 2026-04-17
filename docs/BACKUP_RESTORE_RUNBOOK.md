# Backup Restore Runbook

## MVP status (07.04.2026)

App-level backup/restore in `RTP-3` is removed from MVP scope:

- there are no backup endpoints in admin API;
- there is no `BackupSnapshot` app model/table;
- local app backup storage is not used as part of MVP deployment.

## Operating model for MVP

Backup and restore are performed in an external operational contour according to the corporate `СРК` regulation (Confluence).

Development team scope for MVP:

- use only business/application data model inside the app;
- do not implement app-level backup storage/process;
- document interface requirements to external SRK process (if needed for the next phase).

## Evidence for architecture review

- ссылка на актуальный регламент `СРК` в Confluence;
- подтверждение, что в MVP API отсутствуют backup/restore routes;
- подтверждение, что резервирование выполняется вне прикладного контура.
