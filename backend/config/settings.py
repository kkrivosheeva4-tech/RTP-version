"""Django settings for RTP-3 backend."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def env_rate(name: str, default: str) -> str:
    raw_value = os.getenv(name, "").strip()
    if raw_value:
        return raw_value
    if RUNNING_TESTS:
        return "10000/min"
    return default


DEBUG = env_bool("DEBUG", True)
RUNNING_TESTS = "test" in sys.argv
ENFORCE_ENV_SECURITY = env_bool("ENFORCE_ENV_SECURITY", (not DEBUG) and (not RUNNING_TESTS))
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG=False")

if ENFORCE_ENV_SECURITY and SECRET_KEY in {"django-insecure-change-me", "replace-with-secure-value"}:
    raise ImproperlyConfigured("SECRET_KEY must be replaced with a secure value when DEBUG=False")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
if ENFORCE_ENV_SECURITY and not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must not be empty when DEBUG=False")
if ENFORCE_ENV_SECURITY and "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Wildcard ALLOWED_HOSTS is not allowed when DEBUG=False")

CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
if ENFORCE_ENV_SECURITY and CORS_ALLOW_ALL_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOW_ALL_ORIGINS must be disabled when DEBUG=False")
if ENFORCE_ENV_SECURITY and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must be set when DEBUG=False")

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", ",".join(CORS_ALLOWED_ORIGINS))
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = env_bool("CSRF_COOKIE_HTTPONLY", False)
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", ENFORCE_ENV_SECURITY)
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", ENFORCE_ENV_SECURITY)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", ENFORCE_ENV_SECURITY)
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", ENFORCE_ENV_SECURITY)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", ENFORCE_ENV_SECURITY)

AUTH_LOGIN_RATE = env_rate("AUTH_LOGIN_RATE", "20/min")
AUTH_2FA_RATE = env_rate("AUTH_2FA_RATE", "30/min")
AUTH_REFRESH_RATE = env_rate("AUTH_REFRESH_RATE", "30/min")
AUTH_LOGOUT_RATE = env_rate("AUTH_LOGOUT_RATE", "60/min")
PROJECT_ROOT = BASE_DIR.parent
FRONTEND_DIST_DIR = Path(
    os.getenv("FRONTEND_DIST_DIR", str(PROJECT_ROOT / "dist"))
).resolve()
SERVE_FRONTEND_FROM_DJANGO = env_bool("SERVE_FRONTEND_FROM_DJANGO", False)


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    "rest_framework",
    "corsheaders",
    "technologies",
    "references",
    "auth_custom",
    "admin_panel",
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    "config.middleware.ObservabilityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


DB_ENGINE = os.getenv("DB_ENGINE", "sqlite3").strip().lower()
if DB_ENGINE in {"postgres", "postgresql"}:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "rtp3"),
            "USER": os.getenv("DB_USER", "rtp3"),
            "PASSWORD": os.getenv("DB_PASSWORD", "rtp3"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / os.getenv("DB_NAME", "db.sqlite3"),
            "OPTIONS": {
                "timeout": int(os.getenv("SQLITE_TIMEOUT", "20")),
            },
        }
    }


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

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
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'ru-ru'

TIME_ZONE = 'Asia/Yekaterinburg'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "config.schema.RTPAutoSchema",
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "auth_custom.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
}

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "rtp3": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
