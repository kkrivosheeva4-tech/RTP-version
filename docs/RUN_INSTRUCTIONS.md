# Инструкция по локальному запуску

Документ описывает запуск проекта на локальном компьютере с нуля. Основной локальный режим проекта:

- backend и страницы приложения отдаются Django;
- база данных работает в PostgreSQL;
- приложение открывается по HTTPS: `https://127.0.0.1:8443/`;
- отдельная установка Node.js для обычного локального запуска не нужна.

Инструкция ниже рассчитана на Windows и PowerShell. Команды выполняются из корня проекта, то есть из папки, где находятся `backend`, `scripts`, `docs`, `README.md`.

## 1. Что нужно установить

Перед запуском на компьютере должны быть установлены:

- Python `3.14+`;
- PostgreSQL `14+`;
- Git, если проект еще не скачан;
- PowerShell. На Windows он обычно уже установлен.

Проверить, что уже установлено:

```powershell
python --version
py --version
psql --version
git --version
```

Если команда выводит версию, программа установлена. Если PowerShell пишет, что команда не найдена, установите соответствующую программу по шагам ниже.

## 2. Установка Python

1. Откройте страницу загрузки Python: `https://www.python.org/downloads/windows/`.
2. Скачайте установщик Python версии `3.14` или новее.
3. Запустите установщик.
4. На первом экране обязательно включите галочку `Add python.exe to PATH`.
5. Нажмите `Install Now`.
6. После установки закройте и заново откройте PowerShell.
7. Проверьте установку:

```powershell
python --version
py --version
```

Если установлено несколько версий Python, дальше можно использовать `py -3.14` вместо `python`.

## 3. Установка PostgreSQL

1. Откройте страницу загрузки PostgreSQL: `https://www.postgresql.org/download/windows/`.
2. Скачайте установщик PostgreSQL для Windows.
3. Запустите установщик.
4. На этапе выбора компонентов оставьте минимум:
   - `PostgreSQL Server`;
   - `Command Line Tools`;
   - `pgAdmin 4` можно оставить, но для запуска проекта он не обязателен.
5. Укажите пароль для пользователя `postgres` и запомните его.
6. Порт оставьте стандартный: `5432`.
7. Завершите установку.
8. Закройте и заново откройте PowerShell.
9. Проверьте установку:

```powershell
psql --version
```

Если `psql` не найден, добавьте папку PostgreSQL `bin` в `PATH`. Обычно это:

```text
C:\Program Files\PostgreSQL\16\bin
```

Номер `16` может отличаться в зависимости от установленной версии.

## 4. Получение проекта

Если проект уже открыт в IDE, этот шаг можно пропустить.

Если проект нужно скачать из Git-репозитория:

```powershell
git clone <URL_РЕПОЗИТОРИЯ>
cd <ПАПКА_ПРОЕКТА>
```

Далее все команды выполняйте из корня проекта. Для текущей папки это:

```powershell
cd "C:\Users\kkriv\OneDrive\Desktop\РМК\РАДАР\РТП-версии\3 версия\РТП-3"
```

## 5. Создание базы данных PostgreSQL

Проект по умолчанию ожидает базу:

- имя базы: `rtp3`;
- пользователь: `rtp3`;
- пароль: `rtp3`;
- host: `localhost`;
- port: `5432`.

Откройте PowerShell и подключитесь к PostgreSQL под администратором:

```powershell
psql -U postgres
```

Введите пароль, который задавали при установке PostgreSQL.

Внутри консоли `psql` выполните:

```sql
CREATE USER rtp3 WITH PASSWORD 'rtp3';
CREATE DATABASE rtp3 OWNER rtp3;
GRANT ALL PRIVILEGES ON DATABASE rtp3 TO rtp3;
```

Выйдите из `psql`:

```sql
\q
```

Проверьте подключение к новой базе:

```powershell
psql -h localhost -p 5432 -U rtp3 -d rtp3
```

Пароль: `rtp3`. Если подключение прошло успешно, выйдите командой:

```sql
\q
```

Если база или пользователь уже существуют, PostgreSQL может вывести ошибку `already exists`. В этом случае можно продолжать, если подключение пользователем `rtp3` работает.

## 6. Создание виртуального окружения Python

Из корня проекта выполните:

```powershell
py -3.14 -m venv backend/.venv
```

Если команда не сработала, попробуйте:

```powershell
python -m venv backend/.venv
```

Обновите `pip`:

```powershell
backend/.venv/Scripts/python -m pip install --upgrade pip
```

Установите зависимости проекта:

```powershell
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
```

Если установка завершилась без ошибок, виртуальное окружение готово.

## 7. Создание локального env-файла

Для обычного локального запуска создайте файл `backend/.env` из примера:

```powershell
Copy-Item backend/.env.example backend/.env
```

Откройте `backend/.env` в редакторе и проверьте значения:

```env
SECRET_KEY=replace-with-secure-value
DEBUG=True
DB_ENGINE=postgresql
DB_NAME=rtp3
DB_USER=rtp3
DB_PASSWORD=rtp3
DB_HOST=localhost
DB_PORT=5432
```

Для локального запуска с `DEBUG=True` значение `SECRET_KEY=replace-with-secure-value` допустимо, но лучше заменить его на случайную строку. Например:

```powershell
backend/.venv/Scripts/python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Скопируйте выведенную строку и вставьте ее в `SECRET_KEY`.

## 8. Подготовка базы и тестовых данных

Выполните миграции Django:

```powershell
backend/.venv/Scripts/python backend/manage.py migrate
```

Загрузите справочники:

```powershell
backend/.venv/Scripts/python backend/manage.py seed_references
```

Загрузите технологии:

```powershell
backend/.venv/Scripts/python backend/manage.py seed_technologies
```

Создайте тестовых пользователей:

```powershell
backend/.venv/Scripts/python backend/manage.py seed_users
```

Соберите статические файлы:

```powershell
backend/.venv/Scripts/python backend/manage.py collectstatic --noinput
```

После `seed_users` доступны тестовые учетные записи:

| Email | Пароль | Роль |
| --- | --- | --- |
| `admin@example.com` | `Admin123!` | администратор |
| `owner@example.com` | `Owner123!` | владелец/согласующий |
| `editor@example.com` | `Editor123!` | редактор |
| `guest@example.com` | `Guest123!` | гость |

## 9. Запуск программы

Запустите локальный HTTPS-сервер:

```powershell
backend/.venv/Scripts/python scripts/dev_https_server.py --bind 127.0.0.1:8443
```

Оставьте это окно PowerShell открытым. Пока команда работает, сервер запущен.

Откройте в браузере:

```text
https://127.0.0.1:8443/
```

При первом запуске скрипт автоматически создаст локальный self-signed сертификат:

```text
backend/.certs/localhost-cert.pem
backend/.certs/localhost-key.pem
```

Браузер может показать предупреждение о небезопасном сертификате. Для локального запуска это ожидаемо: сертификат создан на вашем компьютере и не подписан внешним центром сертификации. Перейдите на сайт через пункт вроде `Дополнительно` -> `Перейти на 127.0.0.1`.

Остановить сервер можно сочетанием клавиш:

```text
Ctrl+C
```

## 10. Быстрый повторный запуск

После первой настройки каждый следующий запуск обычно состоит из двух действий.

1. Убедиться, что PostgreSQL запущен.
2. Из корня проекта выполнить:

```powershell
backend/.venv/Scripts/python scripts/dev_https_server.py --bind 127.0.0.1:8443
```

Если были изменения в моделях или обновился код, перед запуском выполните:

```powershell
backend/.venv/Scripts/python backend/manage.py migrate
```

## 11. Production-like запуск через готовые скрипты

В проекте также есть набор PowerShell-скриптов для локального production-like контура. Он использует отдельный env-файл `backend/.env.prodlike.local`, тот же PostgreSQL и HTTPS.

Перед использованием убедитесь, что зависимости Python уже установлены в `backend/.venv`, а база `rtp3` создана.

Создать или пересоздать production-like env:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-setup.ps1 -Force
```

Инициализировать базу:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-init.ps1
```

Запустить:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1
```

Проверить работающий контур:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1
```

Остановить:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-stop.ps1
```

Рабочий адрес тот же:

```text
https://127.0.0.1:8443/
```

## 12. Проверка после запуска

Минимальная проверка backend-тестами:

```powershell
backend/.venv/Scripts/python backend/manage.py test config.tests auth_custom.tests --noinput
```

Production-like smoke-проверка:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-smoke.ps1
```

## 13. Частые проблемы

### Python не найден

Симптом:

```text
python не является внутренней или внешней командой
```

Что сделать:

- переустановить Python;
- включить `Add python.exe to PATH`;
- закрыть и заново открыть PowerShell;
- проверить `py --version`.

### Нужная версия Python не найдена

Если команда `py -3.14` не работает, проверьте доступные версии:

```powershell
py -0p
```

Если Python `3.14+` не установлен, установите его. Если установлен только один подходящий Python, используйте:

```powershell
python -m venv backend/.venv
```

### psql не найден

Добавьте папку PostgreSQL `bin` в переменную окружения `PATH`, затем перезапустите PowerShell.

Пример папки:

```text
C:\Program Files\PostgreSQL\16\bin
```

### Ошибка подключения к PostgreSQL

Симптомы могут быть такими:

```text
connection refused
password authentication failed
database "rtp3" does not exist
role "rtp3" does not exist
```

Проверьте:

- запущена ли служба PostgreSQL;
- создана ли база `rtp3`;
- создан ли пользователь `rtp3`;
- совпадают ли `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` в `backend/.env`;
- подключается ли команда:

```powershell
psql -h localhost -p 5432 -U rtp3 -d rtp3
```

### PowerShell запрещает запуск скриптов

Для скриптов проекта используйте запуск с обходом политики только для текущей команды:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1
```

### Порт 8443 занят

Запустите сервер на другом порту:

```powershell
backend/.venv/Scripts/python scripts/dev_https_server.py --bind 127.0.0.1:8444
```

Откройте:

```text
https://127.0.0.1:8444/
```

### Браузер ругается на сертификат

Для локального запуска это нормально. Сертификат создается автоматически и является self-signed. Можно открыть сайт через пункт `Дополнительно` в браузере.

### Страница открылась, но вход не работает

Проверьте, что выполнена команда:

```powershell
backend/.venv/Scripts/python backend/manage.py seed_users
```

Если пользователи уже были созданы раньше и нужно сбросить тестовые пароли:

```powershell
backend/.venv/Scripts/python backend/manage.py seed_users --reset-passwords
```

## 14. Production / Linux

Для production-развертывания на Linux используйте отдельный runbook:

[docs/DEBIAN12_DEPLOY_RUNBOOK.md](DEBIAN12_DEPLOY_RUNBOOK.md)

Основной production entrypoint:

```bash
gunicorn --config gunicorn.conf.py config.wsgi:application
```

В production HTTPS обычно завершается на `nginx`, а `nginx` проксирует запросы в `gunicorn` на `127.0.0.1:8000`.
