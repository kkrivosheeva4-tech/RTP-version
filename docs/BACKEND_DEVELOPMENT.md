# Документация по разработке бекенда для приложения "Радар технологий"

## Содержание

1. [Обзор архитектуры приложения](#1-обзор-архитектуры-приложения)
2. [Технологический стек](#2-технологический-стек)
3. [Архитектура системы](#3-архитектура-системы)
4. [Установка и настройка окружения](#4-установка-и-настройка-окружения)
5. [Структура проекта Django](#5-структура-проекта-django)
6. [Модели данных](#6-модели-данных)
7. [API Endpoints](#7-api-endpoints)
8. [Аутентификация и авторизация (2FA + OTP)](#8-аутентификация-и-авторизация)
9. [Развертывание на Debian 12](#9-развертывание-на-debian-12)
10. [Миграция данных из JSON](#10-миграция-данных-из-json)
11. [Интеграция фронтенда с бекендом](#11-интеграция-фронтенда-с-бекендом)
12. [Безопасность](#12-безопасность)
13. [Производительность и оптимизация](#13-производительность-и-оптимизация)
14. [Резервное копирование](#14-резервное-копирование)
15. [Мониторинг и логирование](#15-мониторинг-и-логирование)

---

## 1. Обзор архитектуры приложения

### 1.1. Общая архитектура

Приложение "Радар технологий" построено по архитектуре **клиент-сервер** с разделением на фронтенд и бекенд:

```
┌─────────────────┐
│   Frontend       │
│  (HTML/CSS/JS)   │
│                  │
│  - Радар         │
│  - Админ-панель  │
│  - Авторизация   │
└────────┬─────────┘
         │ HTTP/HTTPS
         │ REST API
         │
┌────────▼─────────┐
│   Backend        │
│   (Django)       │
│                  │
│  - REST API      │
│  - Бизнес-логика │
│  - Аутентификация│
└────────┬─────────┘
         │
┌────────▼─────────┐
│   Database       │
│  (PostgreSQL 14+)│
│                  │
│  - Технологии    │
│  - Пользователи  │
│  - Аудит         │
└──────────────────┘
```

### 1.2. Компоненты системы

#### Frontend (Клиентская часть)
- **Технологии**: HTML5, CSS3, JavaScript (ES6+)
- **Архитектура**: Модульная структура с разделением на core, ui, radar, business модули
- **Хранение**: Переход с localStorage на API-запросы к бекенду
- **Визуализация**: SVG-радар с интерактивными элементами

#### Backend (Серверная часть)
- **Фреймворк**: Django 4.2+ (Python 3.10+)
- **API**: Django REST Framework (DRF)
- **База данных**: PostgreSQL 14+
- **Аутентификация**: JWT токены (djangorestframework-simplejwt)
- **Файлы**: Django FileField для хранения документов

#### Database (База данных)
- **СУБД**: PostgreSQL 14+
- **Хранение**: Реляционная модель с нормализацией
- **Индексы**: Оптимизация для быстрых запросов
- **Резервное копирование**: pg_dump, автоматические бэкапы

---

## 2. Технологический стек

### 2.1. Backend Stack

```
Python 3.10+
├── Django 4.2+
│   ├── Django REST Framework 3.14+
│   ├── djangorestframework-simplejwt 5.2+
│   ├── django-cors-headers 4.0+
│   ├── django-filter 23.0+
│   └── Pillow 10.0+ (для работы с файлами)
├── PostgreSQL 14+ (psycopg2-binary 2.9+)
├── Gunicorn 21.0+ (WSGI сервер)
├── Nginx 1.24+ (обратный прокси)
├── pyotp 2.9.0+ (TOTP для 2FA)
├── qrcode[pil] 7.4.2+ (QR-коды для 2FA)
└── django-otp 1.2.3+ (Django OTP поддержка)
```

### 2.2. Инструменты разработки

- **Управление зависимостями**: pip, requirements.txt
- **Миграции БД**: Django migrations
- **Тестирование**: pytest, pytest-django
- **Линтинг**: flake8, black, pylint
- **Документация API**: drf-spectacular (OpenAPI/Swagger)

### 2.3. Инфраструктура

- **ОС**: Linux Debian 12 (Bookworm)
- **Веб-сервер**: Nginx
- **WSGI сервер**: Gunicorn
- **База данных**: PostgreSQL 14+
- **Процесс-менеджер**: systemd
- **Мониторинг**: (опционально) Prometheus, Grafana

---

## 3. Архитектура системы

### 3.1. Архитектурные слои

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Frontend: HTML/CSS/JavaScript)       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         API Layer                       │
│  (Django REST Framework)                │
│  - Serializers                          │
│  - ViewSets                             │
│  - Permissions                          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Business Logic Layer               │
│  (Django Views, Services)              │
│  - Расчет позиций радара                │
│  - Расчет покрытия функций              │
│  - Валидация данных                     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Data Access Layer               │
│  (Django ORM)                           │
│  - Models                               │
│  - Querysets                            │
│  - Transactions                         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         Database Layer                  │
│  (PostgreSQL 14+)                      │
└────────────────────────────────────────┘
```

### 3.2. Модульная структура Django проекта

```
rmk_backend/
├── manage.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
│
├── rmk_backend/              # Главный проект
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py          # Базовые настройки
│   │   ├── development.py   # Настройки разработки
│   │   ├── production.py    # Настройки продакшена
│   │   └── testing.py       # Настройки тестирования
│   ├── urls.py              # Главный URL router
│   ├── wsgi.py
│   └── asgi.py
│
├── apps/
│   ├── __init__.py
│   │
│   ├── users/               # Приложение пользователей
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── permissions.py
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   ├── enterprises/        # Приложение предприятий
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   ├── technologies/        # Приложение технологий
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── services.py      # Бизнес-логика (расчеты)
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   ├── blocks/              # Функциональные блоки
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   ├── directions/          # Направления цифрового развития
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   ├── vendors/             # Вендоры и интеграторы
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── migrations/
│   │
│   └── audit/               # Журнал аудита
│       ├── __init__.py
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── signals.py       # Сигналы для автоматического логирования
│       ├── admin.py
│       └── migrations/
│
├── utils/                   # Общие утилиты
│   ├── __init__.py
│   ├── permissions.py      # Общие permissions
│   ├── pagination.py       # Кастомная пагинация
│   ├── filters.py          # Общие фильтры
│   └── exceptions.py       # Кастомные исключения
│
├── scripts/                 # Скрипты для миграции данных
│   ├── migrate_json_data.py
│   └── create_superuser.py
│
└── tests/                   # Тесты
    ├── __init__.py
    ├── test_users.py
    ├── test_technologies.py
    └── ...
```

### 3.3. Принципы проектирования

1. **Separation of Concerns**: Разделение на приложения по доменам
2. **DRY (Don't Repeat Yourself)**: Переиспользование кода через утилиты
3. **Single Responsibility**: Каждое приложение отвечает за свою область
4. **RESTful API**: Следование принципам REST
5. **API Versioning**: Версионирование API для обратной совместимости

---

## 4. Установка и настройка окружения

### 4.1. Требования к системе

- **ОС**: Debian 12 (Bookworm) или выше
- **Python**: 3.10 или выше
- **PostgreSQL**: 14 или выше
- **RAM**: Минимум 2GB (рекомендуется 4GB+)
- **Диск**: Минимум 10GB свободного места

### 4.2. Установка системных зависимостей

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Python и необходимых пакетов
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установка Nginx
sudo apt install -y nginx

# Установка дополнительных инструментов
sudo apt install -y git curl build-essential libpq-dev
```

### 4.3. Настройка PostgreSQL

```bash
# Переключение на пользователя postgres
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE rmk_db;
CREATE USER rmk_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE rmk_user SET client_encoding TO 'utf8';
ALTER ROLE rmk_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE rmk_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE rmk_db TO rmk_user;
\q
```

### 4.4. Создание виртуального окружения Python

```bash
# Создание директории проекта
mkdir -p /opt/rmk_backend
cd /opt/rmk_backend

# Создание виртуального окружения
python3 -m venv venv

# Активация виртуального окружения
source venv/bin/activate

# Обновление pip
pip install --upgrade pip
```

### 4.5. Установка зависимостей проекта

Создайте файл `requirements.txt`:

```txt
# Django
Django==4.2.7
djangorestframework==3.14.0
djangorestframework-simplejwt==5.3.0
django-cors-headers==4.3.1
django-filter==23.5
django-environ==0.11.2

# Database
psycopg2-binary==2.9.9

# File handling
Pillow==10.1.0

# 2FA and OTP
pyotp==2.9.0
qrcode[pil]==7.4.2
django-otp==1.2.3

# SMS Provider (опционально, выберите один)
# twilio==8.10.0  # Для Twilio
# smsru==0.1.0    # Для SMS.ru

# API Documentation
drf-spectacular==0.26.5

# Production server
gunicorn==21.2.0

# Utilities
python-dateutil==2.8.2
```

Установка:

```bash
pip install -r requirements.txt
```

---

## 5. Структура проекта Django

### 5.1. Создание проекта

```bash
# Создание Django проекта
django-admin startproject rmk_backend .

# Создание структуры приложений
mkdir -p apps utils scripts tests
cd apps

# Создание приложений
python ../manage.py startapp users
python ../manage.py startapp enterprises
python ../manage.py startapp technologies
python ../manage.py startapp blocks
python ../manage.py startapp directions
python ../manage.py startapp vendors
python ../manage.py startapp audit
```

### 5.2. Настройка settings

#### settings/base.py

```python
"""
Базовые настройки Django проекта
"""
import os
from pathlib import Path
from datetime import timedelta
import environ

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Environment variables
env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, ''),
    ALLOWED_HOSTS=(list, []),
)

# Reading .env file
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Local apps
    'apps.users',
    'apps.enterprises',
    'apps.technologies',
    'apps.blocks',
    'apps.directions',
    'apps.vendors',
    'apps.audit',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'rmk_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'rmk_backend.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='rmk_db'),
        'USER': env('DB_USER', default='rmk_user'),
        'PASSWORD': env('DB_PASSWORD', default=''),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'utils.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Settings
CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=['http://localhost:8000', 'http://127.0.0.1:8000']
)

CORS_ALLOW_CREDENTIALS = True

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'Радар технологий API',
    'DESCRIPTION': 'API для системы управления технологическим ландшафтом',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
```

#### settings/production.py

```python
"""
Настройки для продакшена
"""
from .base import *

DEBUG = False

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Static files
STATIC_ROOT = '/var/www/rmk_backend/staticfiles'
MEDIA_ROOT = '/var/www/rmk_backend/media'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/rmk_backend/django.log',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'INFO',
    },
}
```

### 5.3. Настройка URLs

#### rmk_backend/urls.py

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API endpoints
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/enterprises/', include('apps.enterprises.urls')),
    path('api/v1/technologies/', include('apps.technologies.urls')),
    path('api/v1/blocks/', include('apps.blocks.urls')),
    path('api/v1/directions/', include('apps.directions.urls')),
    path('api/v1/vendors/', include('apps.vendors.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
]

# Media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

---

## 6. Модели данных

### 6.1. Модель пользователя (apps/users/models.py)

```python
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    """
    Расширенная модель пользователя
    """
    ROLE_CHOICES = [
        ('guest', 'Гость'),
        ('architect', 'Архитектор'),
        ('director', 'Директор'),
        ('project_manager', 'Руководитель проекта'),
        ('admin', 'Администратор'),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='guest',
        verbose_name='Роль'
    )
    email = models.EmailField(unique=True, verbose_name='Email')
    phone_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Номер телефона',
        help_text='Для SMS OTP (формат: +79991234567)'
    )
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    is_2fa_required = models.BooleanField(
        default=True,
        verbose_name='2FA обязательна',
        help_text='Обязательная настройка 2FA при первом входе'
    )
    failed_login_attempts = models.IntegerField(
        default=0,
        verbose_name='Неудачные попытки входа'
    )
    account_locked_until = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Аккаунт заблокирован до'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    last_login = models.DateTimeField(null=True, blank=True, verbose_name='Последний вход')

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
```

### 6.2. Модель предприятия (apps/enterprises/models.py)

```python
from django.db import models

class Enterprise(models.Model):
    """
    Модель предприятия холдинга
    """
    name = models.CharField(max_length=255, verbose_name='Название')
    code = models.CharField(max_length=50, unique=True, verbose_name='Код')
    description = models.TextField(blank=True, null=True, verbose_name='Описание')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Предприятие'
        verbose_name_plural = 'Предприятия'
        ordering = ['name']

    def __str__(self):
        return self.name
```

### 6.3. Модель направления (apps/directions/models.py)

```python
from django.db import models

class DigitalDirection(models.Model):
    """
    Направление цифрового развития
    """
    name = models.CharField(max_length=255, verbose_name='Название')
    description = models.TextField(blank=True, null=True, verbose_name='Описание')
    quadrant_id = models.IntegerField(verbose_name='ID квадранта')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Направление цифрового развития'
        verbose_name_plural = 'Направления цифрового развития'
        ordering = ['quadrant_id']

    def __str__(self):
        return self.name
```

### 6.4. Модель функционального блока (apps/blocks/models.py)

```python
from django.db import models
from apps.directions.models import DigitalDirection

class FunctionalBlock(models.Model):
    """
    Функциональный блок
    """
    name = models.CharField(max_length=255, verbose_name='Название')
    direction = models.ForeignKey(
        DigitalDirection,
        on_delete=models.CASCADE,
        related_name='blocks',
        verbose_name='Направление'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Функциональный блок'
        verbose_name_plural = 'Функциональные блоки'
        ordering = ['name']

    def __str__(self):
        return self.name

class Function(models.Model):
    """
    Функция (конкретная задача)
    """
    name = models.CharField(max_length=255, unique=True, verbose_name='Название')
    block = models.ForeignKey(
        FunctionalBlock,
        on_delete=models.CASCADE,
        related_name='functions',
        verbose_name='Функциональный блок'
    )
    weight = models.FloatField(default=1.0, verbose_name='Вес функции')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Функция'
        verbose_name_plural = 'Функции'
        ordering = ['name']

    def __str__(self):
        return self.name
```

### 6.5. Модель вендора (apps/vendors/models.py)

```python
from django.db import models

class Vendor(models.Model):
    """
    Вендор (поставщик технологии)
    """
    name = models.CharField(max_length=255, unique=True, verbose_name='Название')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Вендор'
        verbose_name_plural = 'Вендоры'
        ordering = ['name']

    def __str__(self):
        return self.name

class Integrator(models.Model):
    """
    Интегратор
    """
    name = models.CharField(max_length=255, unique=True, verbose_name='Название')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Интегратор'
        verbose_name_plural = 'Интеграторы'
        ordering = ['name']

    def __str__(self):
        return self.name
```

### 6.6. Модель технологии (apps/technologies/models.py)

```python
from django.db import models
from apps.enterprises.models import Enterprise
from apps.blocks.models import FunctionalBlock, Function
from apps.directions.models import DigitalDirection
from apps.vendors.models import Vendor, Integrator

class Technology(models.Model):
    """
    Технология
    """
    TRL_STAGE_CHOICES = [
        (1, 'Исследовательская'),
        (2, 'Прототип'),
        (3, 'Готова к внедрению'),
    ]

    STATUS_CHOICES = [
        ('Внедрена', 'Внедрена'),
        ('Невнедренна', 'Невнедренна'),
    ]

    name = models.CharField(max_length=255, verbose_name='Название')
    description = models.TextField(blank=True, null=True, verbose_name='Описание')
    directions = models.ManyToManyField(
        DigitalDirection,
        related_name='technologies',
        verbose_name='Направления цифрового развития'
    )
    blocks = models.ManyToManyField(
        FunctionalBlock,
        related_name='technologies',
        verbose_name='Функциональные блоки'
    )
    functions = models.ManyToManyField(
        Function,
        related_name='technologies',
        verbose_name='Функции'
    )
    trl_stage = models.IntegerField(
        choices=TRL_STAGE_CHOICES,
        verbose_name='TRL стадия'
    )
    func_cover = models.FloatField(
        default=0.0,
        verbose_name='Покрытие функций (0-3)'
    )
    market_examples = models.TextField(
        blank=True,
        null=True,
        verbose_name='Примеры внедрений'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Технология'
        verbose_name_plural = 'Технологии'
        ordering = ['name']

    def __str__(self):
        return self.name

class TechnologyEnterprise(models.Model):
    """
    Связь технологии с предприятием (оценки готовности)
    """
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name='enterprise_assessments',
        verbose_name='Технология'
    )
    enterprise = models.ForeignKey(
        Enterprise,
        on_delete=models.CASCADE,
        related_name='technology_assessments',
        verbose_name='Предприятие'
    )
    technological_readiness = models.FloatField(
        default=0.0,
        verbose_name='Технологическая готовность (0-3)'
    )
    organizational_readiness = models.FloatField(
        default=0.0,
        verbose_name='Организационная готовность (0-3)'
    )
    status = models.CharField(
        max_length=20,
        choices=Technology.STATUS_CHOICES,
        default='Невнедренна',
        verbose_name='Статус внедрения'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        verbose_name = 'Оценка технологии по предприятию'
        verbose_name_plural = 'Оценки технологий по предприятиям'
        unique_together = ['technology', 'enterprise']

    def __str__(self):
        return f"{self.technology.name} - {self.enterprise.name}"

class TechnologyVendor(models.Model):
    """
    Связь технологии с вендором и интеграторами
    """
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name='vendor_relations',
        verbose_name='Технология'
    )
    vendor = models.ForeignKey(
        Vendor,
        on_delete=models.CASCADE,
        related_name='technology_relations',
        verbose_name='Вендор'
    )
    integrators = models.ManyToManyField(
        Integrator,
        blank=True,
        related_name='vendor_relations',
        verbose_name='Интеграторы'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Связь технологии с вендором'
        verbose_name_plural = 'Связи технологий с вендорами'
        unique_together = ['technology', 'vendor']

    def __str__(self):
        return f"{self.technology.name} - {self.vendor.name}"

class TechnologyFile(models.Model):
    """
    Прикрепленный файл к технологии
    """
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name='files',
        verbose_name='Технология'
    )
    file = models.FileField(upload_to='technology_files/%Y/%m/%d/', verbose_name='Файл')
    name = models.CharField(max_length=255, verbose_name='Название файла')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата загрузки')

    class Meta:
        verbose_name = 'Файл технологии'
        verbose_name_plural = 'Файлы технологий'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.technology.name} - {self.name}"
```

### 6.7. Модель аудита (apps/audit/models.py)

```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class AuditLog(models.Model):
    """
    Журнал аудита действий пользователей
    """
    ACTION_CHOICES = [
        ('login', 'Вход в систему'),
        ('logout', 'Выход из системы'),
        ('create', 'Создание'),
        ('update', 'Обновление'),
        ('delete', 'Удаление'),
        ('export', 'Экспорт'),
        ('import', 'Импорт'),
        ('backup', 'Резервное копирование'),
        ('restore', 'Восстановление'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name='Пользователь'
    )
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        verbose_name='Действие'
    )
    model_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Модель'
    )
    object_id = models.IntegerField(
        blank=True,
        null=True,
        verbose_name='ID объекта'
    )
    details = models.TextField(
        blank=True,
        null=True,
        verbose_name='Детали'
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name='IP адрес'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата и время')

    class Meta:
        verbose_name = 'Запись аудита'
        verbose_name_plural = 'Журнал аудита'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        return f"{self.get_action_display()} - {self.created_at}"
```

### 6.8. Модели для двухфакторной аутентификации (apps/users/models.py)

```python
from django.db import models
from django.contrib.auth import get_user_model
import pyotp
import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
import secrets

User = get_user_model()

class TwoFactorAuth(models.Model):
    """
    Настройки двухфакторной аутентификации для пользователя
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='two_factor_auth',
        verbose_name='Пользователь'
    )
    is_enabled = models.BooleanField(
        default=False,
        verbose_name='2FA включена'
    )
    secret_key = models.CharField(
        max_length=32,
        unique=True,
        verbose_name='Секретный ключ'
    )
    backup_codes = models.JSONField(
        default=list,
        verbose_name='Резервные коды'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата создания'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Дата обновления'
    )

    class Meta:
        verbose_name = 'Двухфакторная аутентификация'
        verbose_name_plural = 'Настройки двухфакторной аутентификации'

    def __str__(self):
        return f"2FA для {self.user.username}"

    def generate_secret_key(self):
        """Генерация секретного ключа для TOTP"""
        if not self.secret_key:
            self.secret_key = pyotp.random_base32()
        return self.secret_key

    def generate_backup_codes(self, count=10):
        """Генерация резервных кодов"""
        codes = [secrets.token_hex(4).upper() for _ in range(count)]
        self.backup_codes = codes
        return codes

    def get_totp_uri(self):
        """Получение URI для QR-кода"""
        totp = pyotp.TOTP(self.secret_key)
        return totp.provisioning_uri(
            name=self.user.email or self.user.username,
            issuer_name='Радар технологий'
        )

    def verify_token(self, token):
        """Проверка OTP токена"""
        totp = pyotp.TOTP(self.secret_key)
        return totp.verify(token, valid_window=1)

    def verify_backup_code(self, code):
        """Проверка резервного кода"""
        if code in self.backup_codes:
            self.backup_codes.remove(code)
            self.save()
            return True
        return False


class OTPToken(models.Model):
    """
    Временные OTP токены для входа (SMS/Email)
    """
    TOKEN_TYPE_CHOICES = [
        ('sms', 'SMS'),
        ('email', 'Email'),
        ('totp', 'TOTP'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='otp_tokens',
        verbose_name='Пользователь'
    )
    token = models.CharField(
        max_length=10,
        verbose_name='OTP токен'
    )
    token_type = models.CharField(
        max_length=10,
        choices=TOKEN_TYPE_CHOICES,
        verbose_name='Тип токена'
    )
    is_used = models.BooleanField(
        default=False,
        verbose_name='Использован'
    )
    expires_at = models.DateTimeField(
        verbose_name='Истекает'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Дата создания'
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name='IP адрес'
    )

    class Meta:
        verbose_name = 'OTP токен'
        verbose_name_plural = 'OTP токены'
        indexes = [
            models.Index(fields=['user', 'token', 'is_used']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"OTP для {self.user.username} - {self.token_type}"

    def is_valid(self):
        """Проверка валидности токена"""
        from django.utils import timezone
        return not self.is_used and timezone.now() < self.expires_at
```

---

## 6.9. Схема базы данных PostgreSQL

### 6.9.1. Обзор таблиц

База данных состоит из следующих основных таблиц:

1. **Пользователи и аутентификация**
   - `users_user` - Пользователи системы
   - `users_twofactorauth` - Настройки 2FA
   - `users_otptoken` - OTP токены для входа

2. **Справочники**
   - `enterprises_enterprise` - Предприятия
   - `directions_digitaldirection` - Направления цифрового развития
   - `blocks_functionalblock` - Функциональные блоки
   - `blocks_function` - Функции
   - `vendors_vendor` - Вендоры
   - `vendors_integrator` - Интеграторы

3. **Основные данные**
   - `technologies_technology` - Технологии
   - `technologies_technologyenterprise` - Оценки технологий по предприятиям
   - `technologies_technologyvendor` - Связи технологий с вендорами
   - `technologies_technologyfile` - Файлы технологий

4. **Связующие таблицы (Many-to-Many)**
   - `technologies_technology_directions` - Связь технологий с направлениями
   - `technologies_technology_blocks` - Связь технологий с блоками
   - `technologies_technology_functions` - Связь технологий с функциями
   - `technologies_technologyvendor_integrators` - Связь вендоров с интеграторами

5. **Аудит**
   - `audit_auditlog` - Журнал аудита

### 6.9.2. Детальное описание таблиц

#### Таблица: `users_user`

Основная таблица пользователей системы.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `username` | VARCHAR(150) | UNIQUE, NOT NULL | Имя пользователя |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email адрес |
| `password` | VARCHAR(128) | NOT NULL | Хеш пароля (bcrypt) |
| `role` | VARCHAR(20) | NOT NULL, DEFAULT 'guest' | Роль пользователя |
| `is_active` | BOOLEAN | DEFAULT TRUE | Активен ли пользователь |
| `is_staff` | BOOLEAN | DEFAULT FALSE | Доступ к админ-панели |
| `is_superuser` | BOOLEAN | DEFAULT FALSE | Суперпользователь |
| `first_name` | VARCHAR(150) | NULL | Имя |
| `last_name` | VARCHAR(150) | NULL | Фамилия |
| `date_joined` | TIMESTAMP | NOT NULL | Дата регистрации |
| `last_login` | TIMESTAMP | NULL | Последний вход |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания записи |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_users_user_username` на `username`
- `idx_users_user_email` на `email`
- `idx_users_user_role` на `role`

**Возможные значения `role`:**
- `guest` - Гость
- `architect` - Архитектор
- `director` - Директор
- `project_manager` - Руководитель проекта
- `admin` - Администратор

---

#### Таблица: `users_twofactorauth`

Настройки двухфакторной аутентификации.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `user_id` | BIGINT | FOREIGN KEY → users_user.id, UNIQUE | Ссылка на пользователя |
| `is_enabled` | BOOLEAN | DEFAULT FALSE | Включена ли 2FA |
| `secret_key` | VARCHAR(32) | UNIQUE, NOT NULL | Секретный ключ для TOTP |
| `backup_codes` | JSONB | DEFAULT '[]' | Резервные коды доступа |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_users_twofactorauth_user_id` на `user_id`
- `idx_users_twofactorauth_secret_key` на `secret_key`

---

#### Таблица: `users_otptoken`

Временные OTP токены для входа.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `user_id` | BIGINT | FOREIGN KEY → users_user.id | Ссылка на пользователя |
| `token` | VARCHAR(10) | NOT NULL | OTP токен |
| `token_type` | VARCHAR(10) | NOT NULL | Тип токена (sms/email/totp) |
| `is_used` | BOOLEAN | DEFAULT FALSE | Использован ли токен |
| `expires_at` | TIMESTAMP | NOT NULL | Время истечения |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `ip_address` | INET | NULL | IP адрес запроса |

**Индексы:**
- `idx_users_otptoken_user_token` на `(user_id, token, is_used)`
- `idx_users_otptoken_expires_at` на `expires_at`

**Возможные значения `token_type`:**
- `sms` - SMS токен
- `email` - Email токен
- `totp` - TOTP токен (из приложения)

---

#### Таблица: `enterprises_enterprise`

Предприятия холдинга.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | NOT NULL | Название предприятия |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Код предприятия |
| `description` | TEXT | NULL | Описание |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_enterprises_enterprise_code` на `code`
- `idx_enterprises_enterprise_name` на `name`

---

#### Таблица: `directions_digitaldirection`

Направления цифрового развития.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | NOT NULL | Название направления |
| `description` | TEXT | NULL | Описание |
| `quadrant_id` | INTEGER | NOT NULL | ID квадранта радара |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_directions_digitaldirection_quadrant_id` на `quadrant_id`

---

#### Таблица: `blocks_functionalblock`

Функциональные блоки.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | NOT NULL | Название блока |
| `direction_id` | BIGINT | FOREIGN KEY → directions_digitaldirection.id | Направление |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_blocks_functionalblock_direction_id` на `direction_id`

---

#### Таблица: `blocks_function`

Функции (конкретные задачи).

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL | Название функции |
| `block_id` | BIGINT | FOREIGN KEY → blocks_functionalblock.id | Функциональный блок |
| `weight` | DOUBLE PRECISION | DEFAULT 1.0 | Вес функции |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |

**Индексы:**
- `idx_blocks_function_block_id` на `block_id`
- `idx_blocks_function_name` на `name`

---

#### Таблица: `vendors_vendor`

Вендоры (поставщики технологий).

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL | Название вендора |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |

**Индексы:**
- `idx_vendors_vendor_name` на `name`

---

#### Таблица: `vendors_integrator`

Интеграторы.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | UNIQUE, NOT NULL | Название интегратора |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |

**Индексы:**
- `idx_vendors_integrator_name` на `name`

---

#### Таблица: `technologies_technology`

Основная таблица технологий.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `name` | VARCHAR(255) | NOT NULL | Название технологии |
| `description` | TEXT | NULL | Описание |
| `trl_stage` | INTEGER | NOT NULL | TRL стадия (1-3) |
| `func_cover` | DOUBLE PRECISION | DEFAULT 0.0 | Покрытие функций (0-3) |
| `market_examples` | TEXT | NULL | Примеры внедрений |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_technologies_technology_name` на `name`
- `idx_technologies_technology_trl_stage` на `trl_stage`

**Возможные значения `trl_stage`:**
- `1` - Исследовательская
- `2` - Прототип
- `3` - Готова к внедрению

---

#### Таблица: `technologies_technologyenterprise`

Оценки технологий по предприятиям.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `enterprise_id` | BIGINT | FOREIGN KEY → enterprises_enterprise.id | Предприятие |
| `technological_readiness` | DOUBLE PRECISION | DEFAULT 0.0 | Технологическая готовность (0-3) |
| `organizational_readiness` | DOUBLE PRECISION | DEFAULT 0.0 | Организационная готовность (0-3) |
| `status` | VARCHAR(20) | DEFAULT 'Невнедренна' | Статус внедрения |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |
| `updated_at` | TIMESTAMP | NOT NULL | Дата обновления |

**Индексы:**
- `idx_technologies_technologyenterprise_tech_ent` на `(technology_id, enterprise_id)` UNIQUE
- `idx_technologies_technologyenterprise_technology_id` на `technology_id`
- `idx_technologies_technologyenterprise_enterprise_id` на `enterprise_id`

**Возможные значения `status`:**
- `Внедрена` - Технология внедрена
- `Невнедренна` - Технология не внедрена

---

#### Таблица: `technologies_technologyvendor`

Связь технологий с вендорами.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `vendor_id` | BIGINT | FOREIGN KEY → vendors_vendor.id | Вендор |
| `created_at` | TIMESTAMP | NOT NULL | Дата создания |

**Индексы:**
- `idx_technologies_technologyvendor_tech_vendor` на `(technology_id, vendor_id)` UNIQUE

---

#### Таблица: `technologies_technologyfile`

Файлы, прикрепленные к технологиям.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `file` | VARCHAR(100) | NOT NULL | Путь к файлу |
| `name` | VARCHAR(255) | NOT NULL | Название файла |
| `uploaded_at` | TIMESTAMP | NOT NULL | Дата загрузки |

**Индексы:**
- `idx_technologies_technologyfile_technology_id` на `technology_id`

---

#### Таблица: `technologies_technology_directions`

Связующая таблица Many-to-Many: Технологии ↔ Направления.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `digitaldirection_id` | BIGINT | FOREIGN KEY → directions_digitaldirection.id | Направление |

**Индексы:**
- `idx_tech_directions_tech_dir` на `(technology_id, digitaldirection_id)` UNIQUE

---

#### Таблица: `technologies_technology_blocks`

Связующая таблица Many-to-Many: Технологии ↔ Функциональные блоки.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `functionalblock_id` | BIGINT | FOREIGN KEY → blocks_functionalblock.id | Функциональный блок |

**Индексы:**
- `idx_tech_blocks_tech_block` на `(technology_id, functionalblock_id)` UNIQUE

---

#### Таблица: `technologies_technology_functions`

Связующая таблица Many-to-Many: Технологии ↔ Функции.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technology_id` | BIGINT | FOREIGN KEY → technologies_technology.id | Технология |
| `function_id` | BIGINT | FOREIGN KEY → blocks_function.id | Функция |

**Индексы:**
- `idx_tech_functions_tech_func` на `(technology_id, function_id)` UNIQUE

---

#### Таблица: `technologies_technologyvendor_integrators`

Связующая таблица Many-to-Many: Технологии-Вендоры ↔ Интеграторы.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `technologyvendor_id` | BIGINT | FOREIGN KEY → technologies_technologyvendor.id | Связь технология-вендор |
| `integrator_id` | BIGINT | FOREIGN KEY → vendors_integrator.id | Интегратор |

**Индексы:**
- `idx_tech_vendor_integrators_vendor_int` на `(technologyvendor_id, integrator_id)` UNIQUE

---

#### Таблица: `audit_auditlog`

Журнал аудита действий пользователей.

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | BIGSERIAL | PRIMARY KEY | Уникальный идентификатор |
| `user_id` | BIGINT | FOREIGN KEY → users_user.id, NULL | Пользователь |
| `action` | VARCHAR(20) | NOT NULL | Тип действия |
| `model_name` | VARCHAR(100) | NULL | Название модели |
| `object_id` | INTEGER | NULL | ID объекта |
| `details` | TEXT | NULL | Детали действия |
| `ip_address` | INET | NULL | IP адрес |
| `created_at` | TIMESTAMP | NOT NULL | Дата и время |

**Индексы:**
- `idx_audit_auditlog_created_at` на `created_at DESC`
- `idx_audit_auditlog_user_created` на `(user_id, created_at DESC)`
- `idx_audit_auditlog_action_created` на `(action, created_at DESC)`

**Возможные значения `action`:**
- `login` - Вход в систему
- `logout` - Выход из системы
- `create` - Создание
- `update` - Обновление
- `delete` - Удаление
- `export` - Экспорт
- `import` - Импорт
- `backup` - Резервное копирование
- `restore` - Восстановление

---

### 6.9.3. Диаграмма связей таблиц

```
users_user
    ├── users_twofactorauth (1:1)
    ├── users_otptoken (1:N)
    └── audit_auditlog (1:N)

enterprises_enterprise
    └── technologies_technologyenterprise (1:N)

directions_digitaldirection
    ├── blocks_functionalblock (1:N)
    └── technologies_technology_directions (M:N через связующую таблицу)

blocks_functionalblock
    └── blocks_function (1:N)

vendors_vendor
    └── technologies_technologyvendor (1:N)

vendors_integrator
    └── technologies_technologyvendor_integrators (M:N через связующую таблицу)

technologies_technology
    ├── technologies_technologyenterprise (1:N)
    ├── technologies_technologyvendor (1:N)
    ├── technologies_technologyfile (1:N)
    ├── technologies_technology_directions (M:N)
    ├── technologies_technology_blocks (M:N)
    └── technologies_technology_functions (M:N)
```

---

## 7. API Endpoints

### 7.1. Аутентификация (apps/users/urls.py)

```python
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserRegistrationView,
    UserProfileView,
    UserListView,
    UserDetailView,
)

urlpatterns = [
    # JWT Authentication
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # User management
    path('register/', UserRegistrationView.as_view(), name='user_register'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
]
```

### 7.2. Технологии (apps/technologies/urls.py)

```python
from django.urls import path
from .views import (
    TechnologyListView,
    TechnologyDetailView,
    TechnologyCreateView,
    TechnologyUpdateView,
    TechnologyDeleteView,
    TechnologyRadarDataView,
    TechnologyCalculatePositionView,
)

urlpatterns = [
    path('', TechnologyListView.as_view(), name='technology_list'),
    path('<int:pk>/', TechnologyDetailView.as_view(), name='technology_detail'),
    path('create/', TechnologyCreateView.as_view(), name='technology_create'),
    path('<int:pk>/update/', TechnologyUpdateView.as_view(), name='technology_update'),
    path('<int:pk>/delete/', TechnologyDeleteView.as_view(), name='technology_delete'),
    path('radar-data/', TechnologyRadarDataView.as_view(), name='technology_radar_data'),
    path('<int:pk>/calculate-position/', TechnologyCalculatePositionView.as_view(), name='technology_calculate_position'),
]
```

### 7.3. Полный список API Endpoints

#### Аутентификация
- `POST /api/v1/auth/token/` - Получение JWT токена
- `POST /api/v1/auth/token/refresh/` - Обновление токена
- `POST /api/v1/auth/register/` - Регистрация пользователя
- `GET /api/v1/auth/profile/` - Профиль текущего пользователя
- `GET /api/v1/auth/users/` - Список пользователей (admin)
- `GET /api/v1/auth/users/<id>/` - Детали пользователя (admin)

#### Предприятия
- `GET /api/v1/enterprises/` - Список предприятий
- `GET /api/v1/enterprises/<id>/` - Детали предприятия
- `POST /api/v1/enterprises/` - Создание предприятия (admin)
- `PUT /api/v1/enterprises/<id>/` - Обновление предприятия (admin)
- `DELETE /api/v1/enterprises/<id>/` - Удаление предприятия (admin)

#### Технологии
- `GET /api/v1/technologies/` - Список технологий (с фильтрацией)
- `GET /api/v1/technologies/<id>/` - Детали технологии
- `POST /api/v1/technologies/create/` - Создание технологии (architect+)
- `PUT /api/v1/technologies/<id>/update/` - Обновление технологии (architect+)
- `DELETE /api/v1/technologies/<id>/delete/` - Удаление технологии (architect+)
- `GET /api/v1/technologies/radar-data/` - Данные для радара
- `POST /api/v1/technologies/<id>/calculate-position/` - Расчет позиции на радаре

#### Функциональные блоки
- `GET /api/v1/blocks/` - Список блоков
- `GET /api/v1/blocks/<id>/` - Детали блока
- `POST /api/v1/blocks/` - Создание блока (architect+)
- `PUT /api/v1/blocks/<id>/` - Обновление блока (architect+)
- `DELETE /api/v1/blocks/<id>/` - Удаление блока (architect+)

#### Направления
- `GET /api/v1/directions/` - Список направлений
- `GET /api/v1/directions/<id>/` - Детали направления

#### Вендоры и интеграторы
- `GET /api/v1/vendors/` - Список вендоров
- `POST /api/v1/vendors/` - Создание вендора (director+)
- `GET /api/v1/integrators/` - Список интеграторов
- `POST /api/v1/integrators/` - Создание интегратора (director+)

#### Аудит
- `GET /api/v1/audit/` - Журнал аудита (с фильтрацией)
- `GET /api/v1/audit/<id>/` - Детали записи аудита
- `DELETE /api/v1/audit/clear/` - Очистка журнала (admin)

---

## 8. Аутентификация и авторизация

### 8.1. Обзор системы безопасности

Система аутентификации построена на принципах максимальной безопасности с использованием:

1. **JWT токены** - для сессионной аутентификации
2. **Двухфакторная аутентификация (2FA)** - обязательна для всех пользователей
3. **Одноразовые пароли (OTP)** - через TOTP приложения, SMS или Email
4. **Резервные коды** - для восстановления доступа
5. **Rate limiting** - защита от брутфорса
6. **Логирование всех попыток входа** - для аудита безопасности

### 8.2. JWT Authentication

Используется `djangorestframework-simplejwt` для JWT токенов:

```python
# Получение токена (только после успешной 2FA)
POST /api/v1/auth/token/
{
    "username": "architect",
    "password": "architect123",
    "otp_code": "123456"  # OTP код из 2FA
}

# Ответ
{
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

# Использование токена
Authorization: Bearer <access_token>
```

### 8.3. Двухфакторная аутентификация (2FA)

#### 8.3.1. Обзор 2FA

Двухфакторная аутентификация является **обязательной** для всех пользователей системы. Это обеспечивает максимальную безопасность доступа к критически важным данным о технологиях холдинга.

**Принцип работы:**
1. Пользователь вводит логин и пароль
2. Система проверяет учетные данные
3. Если 2FA включена, требуется ввод OTP кода
4. После успешной проверки OTP выдается JWT токен

#### 8.3.2. Методы 2FA

Система поддерживает три метода двухфакторной аутентификации:

1. **TOTP (Time-based One-Time Password)** - через мобильные приложения
   - Google Authenticator
   - Microsoft Authenticator
   - Authy
   - Любые приложения, поддерживающие TOTP стандарт

2. **SMS OTP** - отправка кода на мобильный телефон
   - Код действителен 5 минут
   - Максимум 3 попытки ввода

3. **Email OTP** - отправка кода на email адрес
   - Код действителен 10 минут
   - Максимум 3 попытки ввода

#### 8.3.3. Установка зависимостей для 2FA

Добавьте в `requirements.txt`:

```txt
# 2FA и OTP
pyotp==2.9.0
qrcode[pil]==7.4.2
django-otp==1.2.3
```

Установка:

```bash
pip install pyotp qrcode[pil] django-otp
```

#### 8.3.4. Настройка 2FA в settings.py

Добавьте в `settings/base.py`:

```python
# 2FA Settings
TWO_FACTOR_ENABLED = True  # Обязательная 2FA для всех пользователей
TOTP_ISSUER_NAME = 'Радар технологий'
OTP_TOKEN_LENGTH = 6
OTP_TOKEN_VALID_WINDOW = 1  # Допустимое отклонение времени (±30 сек)

# SMS Settings (если используется SMS провайдер)
SMS_PROVIDER = env('SMS_PROVIDER', default='')  # 'twilio', 'smsru', etc.
SMS_API_KEY = env('SMS_API_KEY', default='')
SMS_FROM_NUMBER = env('SMS_FROM_NUMBER', default='')

# Email Settings для OTP
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env('EMAIL_PORT', default=587)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@rmk.ru')
```

#### 8.3.5. API Endpoints для 2FA

##### Включение 2FA

```python
# POST /api/v1/auth/2fa/setup/
# Инициализация 2FA для пользователя
# Ответ: QR-код и секретный ключ
{
    "qr_code_url": "data:image/png;base64,...",
    "secret_key": "JBSWY3DPEHPK3PXP",
    "backup_codes": ["A1B2C3D4", "E5F6G7H8", ...]
}
```

##### Подтверждение 2FA

```python
# POST /api/v1/auth/2fa/verify/
# Проверка OTP кода при включении 2FA
{
    "otp_code": "123456"
}
# Ответ: { "success": true }
```

##### Вход с 2FA

```python
# POST /api/v1/auth/login/
# Стандартный вход с обязательной 2FA
{
    "username": "architect",
    "password": "architect123",
    "otp_code": "123456"  # Обязательно, если 2FA включена
}
# Ответ: JWT токены
{
    "access": "...",
    "refresh": "..."
}
```

##### Отключение 2FA (только для администраторов)

```python
# POST /api/v1/auth/2fa/disable/
# Требуется подтверждение паролем
{
    "password": "current_password",
    "otp_code": "123456"  # Текущий OTP код
}
```

##### Генерация новых резервных кодов

```python
# POST /api/v1/auth/2fa/regenerate-backup-codes/
# Генерация новых резервных кодов (старые аннулируются)
# Требуется OTP код
{
    "otp_code": "123456"
}
# Ответ: Новые резервные коды
{
    "backup_codes": ["A1B2C3D4", "E5F6G7H8", ...]
}
```

#### 8.3.6. Реализация ViewSet для 2FA (apps/users/views.py)

```python
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
import pyotp
import qrcode
from io import BytesIO
import base64

from .models import User, TwoFactorAuth, OTPToken
from .serializers import TwoFactorAuthSetupSerializer, OTPVerificationSerializer

class TwoFactorAuthViewSet(viewsets.ViewSet):
    """
    ViewSet для управления двухфакторной аутентификацией
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def setup(self, request):
        """
        Инициализация 2FA для пользователя
        """
        user = request.user

        # Проверка, не включена ли уже 2FA
        if hasattr(user, 'two_factor_auth') and user.two_factor_auth.is_enabled:
            return Response(
                {'error': '2FA уже включена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Создание или получение записи 2FA
        two_fa, created = TwoFactorAuth.objects.get_or_create(user=user)
        two_fa.generate_secret_key()
        two_fa.generate_backup_codes()
        two_fa.save()

        # Генерация QR-кода
        totp_uri = two_fa.get_totp_uri()
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        # Конвертация в base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        qr_code_url = f"data:image/png;base64,{img_str}"

        return Response({
            'qr_code_url': qr_code_url,
            'secret_key': two_fa.secret_key,
            'backup_codes': two_fa.backup_codes,
            'message': 'Отсканируйте QR-код в приложении аутентификатора'
        })

    @action(detail=False, methods=['post'])
    def verify(self, request):
        """
        Подтверждение 2FA при настройке
        """
        serializer = OTPVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        otp_code = serializer.validated_data['otp_code']

        if not hasattr(user, 'two_factor_auth'):
            return Response(
                {'error': '2FA не настроена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        two_fa = user.two_factor_auth

        # Проверка OTP кода
        if two_fa.verify_token(otp_code):
            two_fa.is_enabled = True
            two_fa.save()
            return Response({'success': True, 'message': '2FA успешно включена'})
        else:
            return Response(
                {'error': 'Неверный OTP код'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def regenerate_backup_codes(self, request):
        """
        Генерация новых резервных кодов
        """
        serializer = OTPVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        otp_code = serializer.validated_data['otp_code']

        if not hasattr(user, 'two_factor_auth') or not user.two_factor_auth.is_enabled:
            return Response(
                {'error': '2FA не включена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        two_fa = user.two_factor_auth

        # Проверка OTP кода
        if not two_fa.verify_token(otp_code):
            return Response(
                {'error': 'Неверный OTP код'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Генерация новых резервных кодов
        new_codes = two_fa.generate_backup_codes()
        two_fa.save()

        return Response({
            'backup_codes': new_codes,
            'message': 'Новые резервные коды сгенерированы. Сохраните их в безопасном месте.'
        })


class LoginView(viewsets.ViewSet):
    """
    ViewSet для входа с поддержкой 2FA
    """
    permission_classes = []  # Публичный endpoint

    @action(detail=False, methods=['post'])
    def login(self, request):
        """
        Вход в систему с обязательной 2FA
        """
        username = request.data.get('username')
        password = request.data.get('password')
        otp_code = request.data.get('otp_code')
        backup_code = request.data.get('backup_code')

        if not username or not password:
            return Response(
                {'error': 'Необходимо указать username и password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Аутентификация пользователя
        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {'error': 'Неверные учетные данные'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'Учетная запись деактивирована'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Проверка 2FA
        if hasattr(user, 'two_factor_auth') and user.two_factor_auth.is_enabled:
            if not otp_code and not backup_code:
                return Response(
                    {'error': 'Требуется OTP код или резервный код'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            two_fa = user.two_factor_auth
            otp_valid = False

            # Проверка резервного кода
            if backup_code:
                otp_valid = two_fa.verify_backup_code(backup_code)
            # Проверка TOTP кода
            elif otp_code:
                otp_valid = two_fa.verify_token(otp_code)

            if not otp_valid:
                # Логирование неудачной попытки
                AuditLog.objects.create(
                    user=user,
                    action='login',
                    details='Неудачная попытка входа: неверный OTP код',
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                return Response(
                    {'error': 'Неверный OTP код или резервный код'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        # Генерация JWT токенов
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        # Обновление времени последнего входа
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Логирование успешного входа
        AuditLog.objects.create(
            user=user,
            action='login',
            details='Успешный вход в систему',
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role,
            }
        })
```

#### 8.3.7. Serializers для 2FA (apps/users/serializers.py)

```python
from rest_framework import serializers
from .models import User, TwoFactorAuth

class OTPVerificationSerializer(serializers.Serializer):
    """Сериализатор для проверки OTP кода"""
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text='6-значный OTP код из приложения аутентификатора'
    )

class TwoFactorAuthSetupSerializer(serializers.ModelSerializer):
    """Сериализатор для настройки 2FA"""
    qr_code_url = serializers.SerializerMethodField()
    backup_codes = serializers.SerializerMethodField()

    class Meta:
        model = TwoFactorAuth
        fields = ['is_enabled', 'secret_key', 'qr_code_url', 'backup_codes']
        read_only_fields = ['is_enabled', 'secret_key']

    def get_qr_code_url(self, obj):
        # Генерация QR-кода
        import qrcode
        import base64
        from io import BytesIO

        totp_uri = obj.get_totp_uri()
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"

    def get_backup_codes(self, obj):
        return obj.backup_codes
```

#### 8.3.8. Обновление URLs (apps/users/urls.py)

```python
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserRegistrationView,
    UserProfileView,
    UserListView,
    UserDetailView,
    TwoFactorAuthViewSet,
    LoginView,
)

urlpatterns = [
    # JWT Authentication (deprecated, используйте login)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Login with 2FA
    path('login/', LoginView.as_view({'post': 'login'}), name='login'),

    # 2FA endpoints
    path('2fa/setup/', TwoFactorAuthViewSet.as_view({'post': 'setup'}), name='2fa_setup'),
    path('2fa/verify/', TwoFactorAuthViewSet.as_view({'post': 'verify'}), name='2fa_verify'),
    path('2fa/regenerate-backup-codes/', TwoFactorAuthViewSet.as_view({'post': 'regenerate_backup_codes'}), name='2fa_regenerate_backup_codes'),

    # User management
    path('register/', UserRegistrationView.as_view(), name='user_register'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
]
```

#### 8.3.9. Безопасность 2FA

**Меры безопасности:**

1. **Секретные ключи** - хранятся в зашифрованном виде в БД
2. **Rate limiting** - ограничение попыток ввода OTP (максимум 5 попыток в 15 минут)
3. **Время жизни OTP** - TOTP коды действительны 30 секунд
4. **Резервные коды** - одноразовые, удаляются после использования
5. **Логирование** - все попытки входа с 2FA логируются
6. **Блокировка аккаунта** - после 10 неудачных попыток аккаунт блокируется на 1 час

**Рекомендации для пользователей:**

1. Сохраняйте резервные коды в безопасном месте
2. Не передавайте секретный ключ третьим лицам
3. Используйте надежные приложения-аутентификаторы
4. Регулярно обновляйте резервные коды
5. При потере доступа обращайтесь к администратору

### 8.4. OTP через SMS и Email

#### 8.4.1. Генерация и отправка OTP

```python
# apps/users/services.py
from django.utils import timezone
from datetime import timedelta
import secrets
from .models import OTPToken, User

def generate_otp_token(user, token_type='sms', ip_address=None):
    """
    Генерация OTP токена
    """
    # Генерация 6-значного кода
    token = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Определение времени жизни токена
    if token_type == 'sms':
        expires_at = timezone.now() + timedelta(minutes=5)
    elif token_type == 'email':
        expires_at = timezone.now() + timedelta(minutes=10)
    else:
        expires_at = timezone.now() + timedelta(minutes=5)

    # Создание записи в БД
    otp_token = OTPToken.objects.create(
        user=user,
        token=token,
        token_type=token_type,
        expires_at=expires_at,
        ip_address=ip_address
    )

    return otp_token

def send_sms_otp(user, token):
    """
    Отправка OTP через SMS
    Требуется интеграция с SMS провайдером (Twilio, SMS.ru и т.д.)
    """
    # Пример с использованием Twilio
    from twilio.rest import Client

    account_sid = settings.SMS_ACCOUNT_SID
    auth_token = settings.SMS_AUTH_TOKEN
    from_number = settings.SMS_FROM_NUMBER

    client = Client(account_sid, auth_token)

    message = client.messages.create(
        body=f'Ваш код для входа в Радар технологий: {token}. Код действителен 5 минут.',
        from_=from_number,
        to=user.phone_number  # Требуется добавить поле phone_number в модель User
    )

    return message.sid

def send_email_otp(user, token):
    """
    Отправка OTP через Email
    """
    from django.core.mail import send_mail

    subject = 'Код для входа в Радар технологий'
    message = f'''
    Здравствуйте, {user.username}!

    Ваш код для входа в систему: {token}

    Код действителен 10 минут.

    Если вы не запрашивали этот код, проигнорируйте это письмо.
    '''

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )
```

#### 8.4.2. API для запроса OTP

```python
# apps/users/views.py

class OTPRequestView(viewsets.ViewSet):
    """
    Запрос OTP кода через SMS или Email
    """
    permission_classes = []  # Публичный endpoint

    @action(detail=False, methods=['post'])
    def request_otp(self, request):
        """
        Запрос OTP кода
        """
        username = request.data.get('username')
        token_type = request.data.get('token_type', 'email')  # 'sms' или 'email'

        if not username:
            return Response(
                {'error': 'Необходимо указать username'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Не раскрываем информацию о существовании пользователя
            return Response(
                {'message': 'Если пользователь существует, код отправлен'},
                status=status.HTTP_200_OK
            )

        # Генерация OTP токена
        ip_address = request.META.get('REMOTE_ADDR')
        otp_token = generate_otp_token(user, token_type, ip_address)

        # Отправка кода
        if token_type == 'sms':
            send_sms_otp(user, otp_token.token)
        elif token_type == 'email':
            send_email_otp(user, otp_token.token)

        return Response({
            'message': f'Код отправлен на {token_type}',
            'expires_in': 300 if token_type == 'sms' else 600  # секунды
        })
```

### 8.5. Обязательная настройка 2FA при первом входе

Для обеспечения максимальной безопасности, все пользователи должны настроить 2FA при первом входе в систему:

```python
# apps/users/middleware.py
from django.utils.deprecation import MiddlewareMixin
from django.shortcuts import redirect
from django.urls import reverse

class TwoFactorAuthRequiredMiddleware(MiddlewareMixin):
    """
    Middleware для проверки настройки 2FA
    """
    def process_request(self, request):
        # Исключаем публичные endpoints
        public_paths = ['/api/v1/auth/login/', '/api/v1/auth/register/',
                       '/api/v1/auth/2fa/setup/', '/api/v1/auth/2fa/verify/']

        if any(request.path.startswith(path) for path in public_paths):
            return None

        # Проверка для аутентифицированных пользователей
        if request.user.is_authenticated:
            if not hasattr(request.user, 'two_factor_auth') or \
               not request.user.two_factor_auth.is_enabled:
                # Перенаправление на настройку 2FA
                if request.path != '/api/v1/auth/2fa/setup/':
                    return redirect('/api/v1/auth/2fa/setup/')

        return None
```

Добавьте middleware в `settings.py`:

```python
MIDDLEWARE = [
    # ...
    'apps.users.middleware.TwoFactorAuthRequiredMiddleware',
    # ...
]
```

### 8.6. Permissions (apps/users/permissions.py)

```python
from rest_framework import permissions

class IsGuestOrReadOnly(permissions.BasePermission):
    """
    Разрешение для гостей: только чтение
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role != 'guest'

class IsArchitectOrAbove(permissions.BasePermission):
    """
    Разрешение для архитекторов и выше
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ['architect', 'director', 'project_manager', 'admin']

class IsDirectorOrAbove(permissions.BasePermission):
    """
    Разрешение для директоров и выше
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ['director', 'project_manager', 'admin']

class IsAdmin(permissions.BasePermission):
    """
    Разрешение только для администраторов
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'
```

### 8.7. Использование permissions в ViewSets

```python
from rest_framework import viewsets
from apps.users.permissions import IsArchitectOrAbove, IsAdmin

class TechnologyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsArchitectOrAbove]
    # ...
```

---

## 9. Развертывание на Debian 12

### 9.1. Подготовка системы

```bash
# Создание пользователя для приложения
sudo adduser --system --group --home /opt/rmk_backend rmk

# Создание директорий
sudo mkdir -p /opt/rmk_backend
sudo mkdir -p /var/www/rmk_backend/staticfiles
sudo mkdir -p /var/www/rmk_backend/media
sudo mkdir -p /var/log/rmk_backend

# Установка прав
sudo chown -R rmk:rmk /opt/rmk_backend
sudo chown -R rmk:rmk /var/www/rmk_backend
sudo chown -R rmk:rmk /var/log/rmk_backend
```

### 9.2. Настройка Gunicorn

Создайте файл `/opt/rmk_backend/gunicorn_config.py`:

```python
bind = "127.0.0.1:8000"
workers = 4
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 50
preload_app = True
```

### 9.3. Создание systemd service

Создайте файл `/etc/systemd/system/rmk_backend.service`:

```ini
[Unit]
Description=RMK Backend Gunicorn daemon
After=network.target

[Service]
User=rmk
Group=rmk
WorkingDirectory=/opt/rmk_backend
Environment="PATH=/opt/rmk_backend/venv/bin"
ExecStart=/opt/rmk_backend/venv/bin/gunicorn \
    --config /opt/rmk_backend/gunicorn_config.py \
    rmk_backend.wsgi:application

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Активация сервиса:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rmk_backend
sudo systemctl start rmk_backend
sudo systemctl status rmk_backend
```

### 9.4. Настройка Nginx

Создайте файл `/etc/nginx/sites-available/rmk_backend`:

```nginx
upstream rmk_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Logging
    access_log /var/log/nginx/rmk_backend_access.log;
    error_log /var/log/nginx/rmk_backend_error.log;

    # Client max body size (for file uploads)
    client_max_body_size 100M;

    # Static files
    location /static/ {
        alias /var/www/rmk_backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files
    location /media/ {
        alias /var/www/rmk_backend/media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # API
    location /api/ {
        proxy_pass http://rmk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Frontend (if served from Django)
    location / {
        proxy_pass http://rmk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }
}
```

Активация конфигурации:

```bash
sudo ln -s /etc/nginx/sites-available/rmk_backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9.5. Настройка переменных окружения

Создайте файл `/opt/rmk_backend/.env`:

```bash
DEBUG=False
SECRET_KEY=your-secret-key-here-generate-with-openssl
ALLOWED_HOSTS=your-domain.com,www.your-domain.com

DB_NAME=rmk_db
DB_USER=rmk_user
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### 9.6. Сборка статических файлов

```bash
cd /opt/rmk_backend
source venv/bin/activate
python manage.py collectstatic --noinput
```

### 9.7. Применение миграций

```bash
python manage.py migrate
```

---

## 10. Миграция данных из JSON

### 10.1. Скрипт миграции (scripts/migrate_json_data.py)

```python
import os
import sys
import django
import json

# Настройка Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rmk_backend.settings.development')
django.setup()

from apps.enterprises.models import Enterprise
from apps.directions.models import DigitalDirection
from apps.blocks.models import FunctionalBlock, Function
from apps.vendors.models import Vendor, Integrator
from apps.technologies.models import (
    Technology,
    TechnologyEnterprise,
    TechnologyVendor,
    TechnologyFile
)

def migrate_enterprises():
    """Миграция предприятий"""
    with open('src/data/ru/enterprises.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for item in data:
        Enterprise.objects.get_or_create(
            id=item['id'],
            defaults={
                'name': item['name'],
                'code': item['code'],
                'description': item.get('description', '')
            }
        )
    print(f"Мигрировано предприятий: {len(data)}")

def migrate_directions():
    """Миграция направлений"""
    with open('src/data/ru/digitalDirections.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for item in data:
        DigitalDirection.objects.get_or_create(
            id=item['id'],
            defaults={
                'name': item['name'],
                'description': item.get('description', ''),
                'quadrant_id': item['id']
            }
        )
    print(f"Мигрировано направлений: {len(data)}")

def migrate_blocks_and_functions():
    """Миграция блоков и функций"""
    # Блоки
    with open('src/data/ru/bloks.json', 'r', encoding='utf-8') as f:
        blocks_data = json.load(f)

    with open('src/data/ru/functions.json', 'r', encoding='utf-8') as f:
        functions_data = json.load(f)

    with open('src/data/ru/functionToBlock.json', 'r', encoding='utf-8') as f:
        function_to_block = json.load(f)

    # Создание блоков
    for block_item in blocks_data:
        # Предполагаем, что блок относится к первому направлению
        direction = DigitalDirection.objects.first()
        block, _ = FunctionalBlock.objects.get_or_create(
            id=block_item['id'],
            defaults={
                'name': block_item['name'],
                'direction': direction
            }
        )

    # Создание функций
    for func_name in functions_data:
        # Находим блок для функции
        block_id = function_to_block.get(func_name)
        if block_id:
            block = FunctionalBlock.objects.get(id=block_id)
            Function.objects.get_or_create(
                name=func_name,
                defaults={'block': block}
            )

    print(f"Мигрировано блоков: {len(blocks_data)}")
    print(f"Мигрировано функций: {len(functions_data)}")

def migrate_vendors():
    """Миграция вендоров"""
    with open('src/data/ru/vendors.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for vendor_name in data:
        Vendor.objects.get_or_create(name=vendor_name)
    print(f"Мигрировано вендоров: {len(data)}")

def migrate_technologies():
    """Миграция технологий"""
    with open('src/data/ru/technologies.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for tech_data in data:
        # Создание технологии
        technology, created = Technology.objects.get_or_create(
            id=tech_data['id'],
            defaults={
                'name': tech_data['name'],
                'description': tech_data.get('description', ''),
                'trl_stage': tech_data.get('trlStage', 1),
                'func_cover': tech_data.get('funcCover', 0.0),
                'market_examples': '\n'.join(tech_data.get('marketExamples', []))
            }
        )

        # Направления
        if 'directions' in tech_data:
            directions = DigitalDirection.objects.filter(id__in=tech_data['directions'])
            technology.directions.set(directions)

        # Блоки
        if 'block' in tech_data:
            block = FunctionalBlock.objects.get(id=tech_data['block'])
            technology.blocks.add(block)
        elif 'blocks' in tech_data:
            blocks = FunctionalBlock.objects.filter(id__in=tech_data['blocks'])
            technology.blocks.set(blocks)

        # Функции
        if 'functionCoverage' in tech_data:
            functions = Function.objects.filter(name__in=tech_data['functionCoverage'])
            technology.functions.set(functions)

        # Предприятия и оценки
        if 'enterprises' in tech_data:
            for ent_data in tech_data['enterprises']:
                enterprise = Enterprise.objects.get(id=ent_data['enterpriseId'])
                TechnologyEnterprise.objects.get_or_create(
                    technology=technology,
                    enterprise=enterprise,
                    defaults={
                        'technological_readiness': ent_data.get('technologicalReadiness', 0.0),
                        'organizational_readiness': ent_data.get('organizationalReadiness', 0.0),
                        'status': ent_data.get('status', 'Невнедренна')
                    }
                )

        # Вендоры
        if 'vendors' in tech_data:
            for vendor_data in tech_data['vendors']:
                vendor, _ = Vendor.objects.get_or_create(name=vendor_data['name'])
                tech_vendor, _ = TechnologyVendor.objects.get_or_create(
                    technology=technology,
                    vendor=vendor
                )
                # Интеграторы
                if 'integrators' in vendor_data:
                    integrators = []
                    for integrator_name in vendor_data['integrators']:
                        integrator, _ = Integrator.objects.get_or_create(name=integrator_name)
                        integrators.append(integrator)
                    tech_vendor.integrators.set(integrators)

    print(f"Мигрировано технологий: {len(data)}")

if __name__ == '__main__':
    print("Начало миграции данных...")
    migrate_enterprises()
    migrate_directions()
    migrate_blocks_and_functions()
    migrate_vendors()
    migrate_technologies()
    print("Миграция завершена!")
```

Запуск:

```bash
cd /opt/rmk_backend
source venv/bin/activate
python scripts/migrate_json_data.py
```

---

## 11. Интеграция фронтенда с бекендом

### 11.1. Создание API клиента (src/js/api/client.js)

```javascript
/**
 * API клиент для взаимодействия с бекендом
 */
class APIClient {
    constructor(baseURL = 'http://localhost:8000/api/v1') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('access_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('access_token', token);
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
                ...options.headers,
            },
            ...options,
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                // Токен истек, попытка обновить
                await this.refreshToken();
                config.headers['Authorization'] = `Bearer ${this.token}`;
                const retryResponse = await fetch(url, config);
                return this.handleResponse(retryResponse);
            }

            return this.handleResponse(response);
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async handleResponse(response) {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка запроса');
            }
            return data;
        }

        return response;
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const response = await fetch(`${this.baseURL}/auth/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        const data = await response.json();
        if (response.ok) {
            this.setToken(data.access);
            localStorage.setItem('refresh_token', data.refresh);
        } else {
            // Токен не обновлен, требуется повторная авторизация
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/src/pages/auth.html';
        }
    }

    // Auth methods
    async login(username, password) {
        const response = await this.request('/auth/token/', {
            method: 'POST',
            body: { username, password },
        });
        this.setToken(response.access);
        localStorage.setItem('refresh_token', response.refresh);
        return response;
    }

    async logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        this.token = null;
    }

    // Technology methods
    async getTechnologies(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/technologies/?${queryString}`);
    }

    async getTechnology(id) {
        return this.request(`/technologies/${id}/`);
    }

    async createTechnology(data) {
        return this.request('/technologies/create/', {
            method: 'POST',
            body: data,
        });
    }

    async updateTechnology(id, data) {
        return this.request(`/technologies/${id}/update/`, {
            method: 'PUT',
            body: data,
        });
    }

    async deleteTechnology(id) {
        return this.request(`/technologies/${id}/delete/`, {
            method: 'DELETE',
        });
    }

    async getRadarData() {
        return this.request('/technologies/radar-data/');
    }

    // Enterprise methods
    async getEnterprises() {
        return this.request('/enterprises/');
    }

    // Block methods
    async getBlocks() {
        return this.request('/blocks/');
    }

    // Direction methods
    async getDirections() {
        return this.request('/directions/');
    }
}

// Экспорт для использования в модулях
window.APIClient = APIClient;
```

### 11.2. Обновление модуля авторизации

Замените использование localStorage на API вызовы:

```javascript
// Вместо
localStorage.setItem('isLoggedIn', true);

// Используйте
const api = new APIClient();
await api.login(username, password);
```

### 11.3. Обновление загрузки данных

```javascript
// Вместо загрузки из JSON
const data = await fetch('/src/data/ru/technologies.json').then(r => r.json());

// Используйте API
const api = new APIClient();
const technologies = await api.getTechnologies();
```

---

## 12. Безопасность

### 12.1. Рекомендации по безопасности

1. **SECRET_KEY**: Генерируйте уникальный ключ для каждого окружения
2. **HTTPS**: Используйте SSL/TLS в продакшене (обязательно)
3. **CORS**: Настройте разрешенные источники
4. **SQL Injection**: Django ORM защищает от SQL инъекций
5. **XSS**: Используйте экранирование в шаблонах
6. **CSRF**: Включена защита от CSRF
7. **Пароли**: Хранятся в хешированном виде (bcrypt/PBKDF2)
8. **2FA**: Обязательная двухфакторная аутентификация для всех пользователей
9. **OTP**: Одноразовые пароли с ограниченным временем жизни
10. **Rate Limiting**: Ограничение частоты запросов (особенно для входа)
11. **Логирование**: Все попытки входа и критичные действия логируются
12. **Блокировка аккаунтов**: Автоматическая блокировка после множественных неудачных попыток
13. **Резервные коды**: Безопасное хранение и одноразовое использование
14. **Секретные ключи 2FA**: Хранятся в зашифрованном виде, никогда не передаются в открытом виде

### 12.2. Настройка rate limiting

Установите `django-ratelimit`:

```bash
pip install django-ratelimit
```

Добавьте в `requirements.txt`:

```txt
django-ratelimit==4.1.0
```

#### Rate limiting для входа и 2FA

```python
from django_ratelimit.decorators import ratelimit
from django_ratelimit.exceptions import Ratelimited
from rest_framework.views import exception_handler

# В apps/users/views.py
class LoginView(viewsets.ViewSet):
    @ratelimit(key='ip', rate='5/15m', method='POST')
    @ratelimit(key='user', rate='10/1h', method='POST')
    @action(detail=False, methods=['post'])
    def login(self, request):
        # ... код входа
        pass

# Rate limiting для OTP запросов
class OTPRequestView(viewsets.ViewSet):
    @ratelimit(key='ip', rate='3/15m', method='POST')
    @ratelimit(key='user', rate='5/1h', method='POST')
    @action(detail=False, methods=['post'])
    def request_otp(self, request):
        # ... код запроса OTP
        pass

# Rate limiting для проверки OTP
class TwoFactorAuthViewSet(viewsets.ViewSet):
    @ratelimit(key='ip', rate='10/15m', method='POST')
    @ratelimit(key='user', rate='20/1h', method='POST')
    @action(detail=False, methods=['post'])
    def verify(self, request):
        # ... код проверки OTP
        pass
```

#### Обработка ошибок rate limiting

```python
# В settings.py
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = 'default'

# В utils/exceptions.py
from django_ratelimit.exceptions import Ratelimited
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if isinstance(exc, Ratelimited):
        return Response(
            {
                'error': 'Превышен лимит запросов',
                'message': 'Слишком много попыток. Попробуйте позже.',
                'retry_after': 900  # секунды
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    return response

# В settings.py
REST_FRAMEWORK = {
    # ...
    'EXCEPTION_HANDLER': 'utils.exceptions.custom_exception_handler',
}
```

### 12.3. Блокировка аккаунтов после неудачных попыток

Реализация автоматической блокировки:

```python
# apps/users/services.py
from django.utils import timezone
from datetime import timedelta

MAX_FAILED_ATTEMPTS = 10
LOCKOUT_DURATION = timedelta(hours=1)

def handle_failed_login(user):
    """
    Обработка неудачной попытки входа
    """
    user.failed_login_attempts += 1

    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.account_locked_until = timezone.now() + LOCKOUT_DURATION
        # Логирование блокировки
        AuditLog.objects.create(
            user=user,
            action='login',
            details=f'Аккаунт заблокирован после {user.failed_login_attempts} неудачных попыток',
            ip_address=None  # Можно добавить из request
        )

    user.save(update_fields=['failed_login_attempts', 'account_locked_until'])

def reset_failed_attempts(user):
    """
    Сброс счетчика неудачных попыток после успешного входа
    """
    user.failed_login_attempts = 0
    user.account_locked_until = None
    user.save(update_fields=['failed_login_attempts', 'account_locked_until'])

def is_account_locked(user):
    """
    Проверка, заблокирован ли аккаунт
    """
    if user.account_locked_until:
        if timezone.now() < user.account_locked_until:
            return True
        else:
            # Разблокировка после истечения времени
            user.account_locked_until = None
            user.failed_login_attempts = 0
            user.save(update_fields=['account_locked_until', 'failed_login_attempts'])
            return False
    return False

# Обновление LoginView
class LoginView(viewsets.ViewSet):
    @action(detail=False, methods=['post'])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': 'Неверные учетные данные'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Проверка блокировки аккаунта
        if is_account_locked(user):
            return Response(
                {
                    'error': 'Аккаунт временно заблокирован',
                    'message': f'Аккаунт заблокирован до {user.account_locked_until}',
                    'retry_after': int((user.account_locked_until - timezone.now()).total_seconds())
                },
                status=status.HTTP_423_LOCKED
            )

        # Аутентификация
        user_obj = authenticate(username=username, password=password)
        if not user_obj:
            handle_failed_login(user)
            return Response(
                {'error': 'Неверные учетные данные'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Проверка 2FA
        # ... код проверки 2FA ...

        # Успешный вход
        reset_failed_attempts(user)
        # ... генерация токенов ...
```

### 12.4. Шифрование секретных ключей 2FA

Для дополнительной безопасности секретные ключи 2FA можно хранить в зашифрованном виде:

```python
# apps/users/utils.py
from cryptography.fernet import Fernet
from django.conf import settings
import base64

def get_encryption_key():
    """
    Получение ключа шифрования из настроек
    """
    key = settings.SECRET_KEY[:32].encode()
    return base64.urlsafe_b64encode(key)

def encrypt_secret(secret):
    """
    Шифрование секретного ключа
    """
    f = Fernet(get_encryption_key())
    return f.encrypt(secret.encode()).decode()

def decrypt_secret(encrypted_secret):
    """
    Расшифровка секретного ключа
    """
    f = Fernet(get_encryption_key())
    return f.decrypt(encrypted_secret.encode()).decode()

# Обновление модели TwoFactorAuth
class TwoFactorAuth(models.Model):
    # ...
    _secret_key = models.CharField(
        max_length=255,
        db_column='secret_key',
        verbose_name='Зашифрованный секретный ключ'
    )

    @property
    def secret_key(self):
        """Расшифровка секретного ключа при чтении"""
        return decrypt_secret(self._secret_key)

    @secret_key.setter
    def secret_key(self, value):
        """Шифрование секретного ключа при записи"""
        if value:
            self._secret_key = encrypt_secret(value)
```

**Важно:** Для использования шифрования установите:

```bash
pip install cryptography
```

Добавьте в `requirements.txt`:

```txt
cryptography==41.0.7
```

---

## 13. Производительность и оптимизация

### 13.1. Оптимизация запросов к БД

Используйте `select_related` и `prefetch_related`:

```python
technologies = Technology.objects.select_related().prefetch_related(
    'directions',
    'blocks',
    'functions',
    'enterprise_assessments__enterprise',
    'vendor_relations__vendor',
    'vendor_relations__integrators'
)
```

### 13.2. Кэширование

Настройте кэширование в `settings.py`:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

### 13.3. Индексы БД

Добавьте индексы для часто используемых полей:

```python
class Technology(models.Model):
    # ...
    class Meta:
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['trl_stage']),
        ]
```

---

## 14. Резервное копирование

### 14.1. Скрипт резервного копирования

Создайте `/opt/rmk_backend/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/rmk_backend"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Бэкап БД
pg_dump -U rmk_user rmk_db > $BACKUP_DIR/db_$DATE.sql

# Бэкап медиа файлов
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/rmk_backend/media/

# Удаление старых бэкапов (старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

Настройка cron:

```bash
# Добавить в crontab
0 2 * * * /opt/rmk_backend/scripts/backup.sh
```

---

## 15. Мониторинг и логирование

### 15.1. Настройка логирования

См. раздел 5.2 (settings/production.py) для примера конфигурации логирования.

### 15.2. Мониторинг здоровья системы

Создайте endpoint для проверки здоровья:

```python
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    try:
        connection.ensure_connection()
        return JsonResponse({'status': 'healthy'})
    except Exception as e:
        return JsonResponse({'status': 'unhealthy', 'error': str(e)}, status=503)
```

---

## Заключение

Данная документация описывает полный процесс разработки и развертывания бекенда для приложения "Радар технологий" на Django с PostgreSQL.

### Следующие шаги:

1. Создание проекта по описанной структуре
2. Реализация моделей и миграций
3. Разработка API endpoints
4. Настройка аутентификации
5. Миграция данных из JSON
6. Интеграция фронтенда
7. Тестирование
8. Развертывание на сервере

### Полезные ресурсы:

- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)

---

**Дата создания**: 2026-01-29
**Версия**: 1.0
**Автор**: AI Assistant
