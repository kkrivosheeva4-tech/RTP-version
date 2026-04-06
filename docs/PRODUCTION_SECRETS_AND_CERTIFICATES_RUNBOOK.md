# Production Secrets And Certificates Runbook

Дата: 2026-04-06

## 1) Зачем нужен этот документ

В репозитории есть локальные и тестовые артефакты, которые удобны для разработки, но не должны становиться production-источником истины:

- локальные `.env` файлы;
- dev HTTPS сертификаты в `backend/.certs/`;
- локальные production-like env файлы;
- backup/dump файлы с чувствительными данными.

Для production секреты и сертификаты должны жить вне репозитория и вне директории приложения, в управляемом секрет-хранилище или в системных путях с ограниченным доступом.

## 2) Что в проекте считается секретом или чувствительным материалом

### 2.1 Обязательные production secrets

- `SECRET_KEY`
- `TOTP_SECRET_ENCRYPTION_KEY`
- `DB_PASSWORD`
- возможные `DB_SSLROOTCERT`, `DB_SSLCERT`, `DB_SSLKEY`

### 2.2 TLS и приватные ключи

- приватный ключ TLS для nginx
- production certificate chain для nginx
- client certificate/key для PostgreSQL, если используется mTLS

### 2.3 Чувствительные данные, которые нельзя считать безопасными для коммита и переноса

- `backend/.env`
- `backend/.env.prodlike.local`
- `backend/.certs/localhost-cert.pem`
- `backend/.certs/localhost-key.pem`
- любые новые `.env`, `.pem`, `.key`, `.crt`, `.p12`, `.pfx` файлы с реальными production значениями
- `backend/storage/backups/*.json`
- `backend/data-migration.json`, если файл содержит реальные аккаунты, auth-данные, refresh-session metadata, password hashes или другие данные из рабочей базы

## 3) Какие файлы можно хранить в репозитории

Эти файлы могут оставаться в репозитории, потому что они должны содержать только шаблоны или примеры без реальных production secrets:

- `backend/.env.example`
- `backend/.env.test.example`
- `backend/.env.prodlike.example`
- `ops/nginx/rtp3.conf.example`

Правило простое:

- `*.example` и `*.example`-подобные шаблоны можно хранить;
- реальные значения в них хранить нельзя.

## 4) Что делать с файлами, которые уже есть локально

### 4.1 `backend/.env`

Назначение:

- локальный runtime env для разработки или локального запуска.

Для production:

- не копировать этот файл в репозиторий;
- не использовать его как постоянный production-файл внутри checkout приложения;
- перенести значения в внешний env-файл или secret manager.

Рекомендуемый production вариант:

- `/etc/rtp3/rtp3.env`
- права `600`
- владелец `root` или сервисный пользователь
- подключение через systemd `EnvironmentFile=`

### 4.2 `backend/.env.prodlike.local`

Назначение:

- локальный rehearsal для HTTPS и cookie auth.

Для production:

- не деплоить;
- не использовать как источник production конфигурации;
- можно оставить только как локальный шаблон/черновик на машине разработчика, но не в поставке на сервер.

### 4.3 `backend/.certs/localhost-cert.pem` и `backend/.certs/localhost-key.pem`

Назначение:

- self-signed dev сертификаты для локального `https://127.0.0.1:8443`.

Для production:

- не использовать;
- не копировать на production сервер;
- не подключать в nginx;
- удалить из production checkout, если они туда попали.

В production нужен отдельный TLS комплект:

- публичный сертификат или full chain;
- приватный ключ;
- при необходимости intermediate chain.

### 4.4 `backend/storage/backups/*.json` и dump-подобные файлы

Эти файлы могут содержать:

- пользователей;
- password hashes;
- `is_2fa_enabled`, `must_setup_2fa`, `must_change_password`;
- зашифрованный или экспортированный 2FA related материал;
- refresh-token metadata;
- audit trail.

Для production:

- не хранить такие backup-файлы внутри git checkout приложения;
- хранить отдельно в защищенном backup storage;
- ограничить доступ;
- определить retention policy;
- шифровать at-rest средствами backup storage или файловой системы;
- не использовать тестовые backup-файлы как production seed.

## 5) Где хранить production secrets правильно

Предпочтительный порядок:

1. отдельный secret manager;
2. `EnvironmentFile` вне репозитория;
3. защищенные системные пути с правами доступа.

Практичный минимальный вариант для Debian/systemd:

- файл `/etc/rtp3/rtp3.env`
- права `chmod 600 /etc/rtp3/rtp3.env`
- владелец `root:root`
- сервис читает его через `EnvironmentFile=/etc/rtp3/rtp3.env`

Не рекомендуется:

- хранить production `.env` в `/opt/rtp3/backend/.env`;
- коммитить `.env` в git;
- класть production secrets рядом с шаблонами `.env.example`;
- передавать ключи в документах, чатах или ticket comments.

## 6) Где хранить production сертификаты правильно

Для nginx/TLS:

- `/etc/letsencrypt/live/<domain>/fullchain.pem`
- `/etc/letsencrypt/live/<domain>/privkey.pem`

или

- `/etc/ssl/certs/...`
- `/etc/ssl/private/...`

Не рекомендуется:

- хранить production TLS ключи внутри репозитория;
- хранить их в `backend/.certs/`;
- хранить их рядом с исходным кодом приложения в world-readable директориях.

Если используются PostgreSQL SSL client credentials:

- `DB_SSLROOTCERT`
- `DB_SSLCERT`
- `DB_SSLKEY`

их тоже нужно хранить вне репозитория, в системных путях с отдельными правами.

## 7) Какие переменные production должны задаваться вне репозитория

Минимум:

- `SECRET_KEY`
- `TOTP_SECRET_ENCRYPTION_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DB_ENGINE`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `AUTH_REFRESH_COOKIE_*`
- `SECURE_SSL_REDIRECT=True`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- `USE_X_FORWARDED_HOST=True`
- `USE_X_FORWARDED_PORT=True`
- `SECURE_PROXY_SSL_HEADER_ENABLED=True`

Дополнительно при SSL к БД:

- `DB_SSLMODE`
- `DB_SSLROOTCERT`
- `DB_SSLCERT`
- `DB_SSLKEY`

## 8) Как сгенерировать production secrets

### 8.1 Django `SECRET_KEY`

Пример:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 8.2 `TOTP_SECRET_ENCRYPTION_KEY`

Это должен быть валидный Fernet key.

Пример:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Важно:

- не использовать dev fallback;
- не вычислять production `TOTP_SECRET_ENCRYPTION_KEY` автоматически из `SECRET_KEY`;
- задать отдельное стабильное значение в production env.

## 9) Что проверить перед production deploy

### 9.1 В checkout приложения не должно быть

- `backend/.env` с production значениями
- `backend/.env.prodlike.local`
- файлов из `backend/.certs/`
- backup/dump файлов с реальными данными

### 9.2 На сервере должно быть

- production env вне репозитория
- TLS certificate chain и private key вне репозитория
- корректный nginx config с внешними путями к сертификатам
- ограничение прав на env и key файлы

### 9.3 В конфигурации Django должно быть

- `DEBUG=False`
- валидный `SECRET_KEY`
- валидный `TOTP_SECRET_ENCRYPTION_KEY`
- secure cookie flags включены
- trusted origins настроены на реальные `https://` origin

## 10) Что делать, если секреты уже попали в репозиторий или в артефакты

Считать секрет скомпрометированным и:

1. заменить `SECRET_KEY`;
2. заменить `TOTP_SECRET_ENCRYPTION_KEY`;
3. сменить `DB_PASSWORD`;
4. перевыпустить TLS сертификаты и ключи, если утекли private key файлы;
5. инвалидировать активные refresh sessions;
6. проверить backup storage и CI artifacts;
7. при необходимости очистить git history отдельной процедурой.

## 11) Рекомендуемое целевое разделение

В репозитории:

- код;
- `.example` шаблоны;
- пример nginx-конфига;
- документация и runbooks.

В production окружении вне репозитория:

- реальные env values;
- TLS private keys;
- production certificates;
- DB client cert/key;
- backup archives;
- любые data dumps с реальными пользователями и auth данными.

## 12) Связанные документы

- `docs/RUN_INSTRUCTIONS.md`
- `docs/DEBIAN12_DEPLOY_RUNBOOK.md`
- `docs/LOCAL_PRODLIKE_SETUP.md`
- `docs/TEST_AD_DEPLOYMENT_RUNBOOK.md`
- `docs/RELEASE_PROCESS.md`
