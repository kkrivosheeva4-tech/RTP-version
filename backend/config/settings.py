"""Django settings for RTP-3 backend."""

import os
import sys
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key
from dotenv import load_dotenv

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


def _all_origins_use_https(origins: list[str]) -> bool:
    if not origins:
        return False
    return all(origin.lower().startswith("https://") for origin in origins)


DEBUG = env_bool("DEBUG", True)
RUNNING_TESTS = "test" in sys.argv
ENFORCE_ENV_SECURITY = env_bool("ENFORCE_ENV_SECURITY", (not DEBUG) and (not RUNNING_TESTS))
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG=False")

if ENFORCE_ENV_SECURITY and SECRET_KEY in {
    "django-insecure-change-me",
    "replace-with-secure-value",
}:
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
CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", False)
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
USE_X_FORWARDED_HOST = env_bool("USE_X_FORWARDED_HOST", ENFORCE_ENV_SECURITY)
USE_X_FORWARDED_PORT = env_bool("USE_X_FORWARDED_PORT", ENFORCE_ENV_SECURITY)
SECURE_PROXY_SSL_HEADER_ENABLED = env_bool("SECURE_PROXY_SSL_HEADER_ENABLED", ENFORCE_ENV_SECURITY)
if SECURE_PROXY_SSL_HEADER_ENABLED:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", ENFORCE_ENV_SECURITY)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", ENFORCE_ENV_SECURITY)
CSP_ENABLED = env_bool("CSP_ENABLED", True)
CSP_REPORT_ONLY = env_bool("CSP_REPORT_ONLY", False)
CSP_DEFAULT_POLICY = os.getenv(
    "CSP_DEFAULT_POLICY",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; "
    "connect-src 'self'; worker-src 'self' blob:",
).strip()

AUTH_LOGIN_RATE = env_rate("AUTH_LOGIN_RATE", "20/min")
AUTH_2FA_RATE = env_rate("AUTH_2FA_RATE", "30/min")
AUTH_REFRESH_RATE = env_rate("AUTH_REFRESH_RATE", "30/min")
AUTH_LOGOUT_RATE = env_rate("AUTH_LOGOUT_RATE", "60/min")
AUTH_REFRESH_COOKIE_ENABLED = env_bool("AUTH_REFRESH_COOKIE_ENABLED", False)
AUTH_RETURN_REFRESH_TOKEN_IN_BODY = env_bool(
    "AUTH_RETURN_REFRESH_TOKEN_IN_BODY", not AUTH_REFRESH_COOKIE_ENABLED
)
AUTH_REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "rtp3_refresh_token").strip()
if not AUTH_REFRESH_COOKIE_NAME:
    AUTH_REFRESH_COOKIE_NAME = "rtp3_refresh_token"
AUTH_REFRESH_COOKIE_SECURE = env_bool("AUTH_REFRESH_COOKIE_SECURE", ENFORCE_ENV_SECURITY)
AUTH_REFRESH_COOKIE_HTTPONLY = env_bool("AUTH_REFRESH_COOKIE_HTTPONLY", True)
AUTH_REFRESH_COOKIE_SAMESITE = os.getenv("AUTH_REFRESH_COOKIE_SAMESITE", "Lax").strip().capitalize()
if AUTH_REFRESH_COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
    raise ImproperlyConfigured("AUTH_REFRESH_COOKIE_SAMESITE must be one of: Lax, Strict, None")
if AUTH_REFRESH_COOKIE_SAMESITE == "None" and not AUTH_REFRESH_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "AUTH_REFRESH_COOKIE_SECURE must be enabled when AUTH_REFRESH_COOKIE_SAMESITE=None"
    )
AUTH_REFRESH_COOKIE_PATH = os.getenv("AUTH_REFRESH_COOKIE_PATH", "/api/v1/auth/").strip()
if not AUTH_REFRESH_COOKIE_PATH:
    AUTH_REFRESH_COOKIE_PATH = "/api/v1/auth/"
AUTH_REFRESH_COOKIE_DOMAIN = os.getenv("AUTH_REFRESH_COOKIE_DOMAIN", "").strip() or None
AUTH_REFRESH_COOKIE_MAX_AGE = int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", "7")) * 24 * 60 * 60
AUTH_REFRESH_REQUIRE_CSRF = env_bool("AUTH_REFRESH_REQUIRE_CSRF", AUTH_REFRESH_COOKIE_ENABLED)
if ENFORCE_ENV_SECURITY and AUTH_REFRESH_COOKIE_ENABLED and not CORS_ALLOW_CREDENTIALS:
    raise ImproperlyConfigured(
        "CORS_ALLOW_CREDENTIALS must be enabled when AUTH_REFRESH_COOKIE_ENABLED=True"
    )
if ENFORCE_ENV_SECURITY and not SECURE_SSL_REDIRECT:
    raise ImproperlyConfigured("SECURE_SSL_REDIRECT must be enabled when DEBUG=False")
if ENFORCE_ENV_SECURITY and not SESSION_COOKIE_SECURE:
    raise ImproperlyConfigured("SESSION_COOKIE_SECURE must be enabled when DEBUG=False")
if ENFORCE_ENV_SECURITY and not CSRF_COOKIE_SECURE:
    raise ImproperlyConfigured("CSRF_COOKIE_SECURE must be enabled when DEBUG=False")
if ENFORCE_ENV_SECURITY and SECURE_HSTS_SECONDS <= 0:
    raise ImproperlyConfigured("SECURE_HSTS_SECONDS must be greater than 0 when DEBUG=False")
if ENFORCE_ENV_SECURITY and not _all_origins_use_https(CORS_ALLOWED_ORIGINS):
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must use https:// when DEBUG=False")
if ENFORCE_ENV_SECURITY and not _all_origins_use_https(CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured("CSRF_TRUSTED_ORIGINS must use https:// when DEBUG=False")
if ENFORCE_ENV_SECURITY and AUTH_REFRESH_COOKIE_ENABLED and not AUTH_REFRESH_COOKIE_SECURE:
    raise ImproperlyConfigured("AUTH_REFRESH_COOKIE_SECURE must be enabled when DEBUG=False")
PROJECT_ROOT = BASE_DIR.parent
_frontend_dist_raw = os.getenv("FRONTEND_DIST_DIR", str(PROJECT_ROOT / "dist")).strip()
_frontend_dist_candidate = Path(_frontend_dist_raw)
if _frontend_dist_candidate.is_absolute():
    FRONTEND_DIST_DIR = _frontend_dist_candidate.resolve()
else:
    # Resolve relative paths against backend directory, where .env is loaded from.
    FRONTEND_DIST_DIR = (BASE_DIR / _frontend_dist_candidate).resolve()
SERVE_FRONTEND_FROM_DJANGO = env_bool("SERVE_FRONTEND_FROM_DJANGO", True)


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "technologies",
    "references",
    "auth_custom",
    "admin_panel",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.ObservabilityMiddleware",
    "config.middleware.ContentSecurityPolicyMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


DB_ENGINE = os.getenv("DB_ENGINE", "postgresql").strip().lower()
if DB_ENGINE not in {"postgres", "postgresql"}:
    raise ImproperlyConfigured("DB_ENGINE must be postgresql. SQLite fallback is no longer supported.")

db_conn_max_age = int(os.getenv("DB_CONN_MAX_AGE", "0"))
db_connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "10"))
db_sslmode = os.getenv("DB_SSLMODE", "prefer").strip()
db_sslrootcert = os.getenv("DB_SSLROOTCERT", "").strip()
db_sslcert = os.getenv("DB_SSLCERT", "").strip()
db_sslkey = os.getenv("DB_SSLKEY", "").strip()

postgres_options: dict[str, str | int] = {"connect_timeout": db_connect_timeout}
if db_sslmode:
    postgres_options["sslmode"] = db_sslmode
if db_sslrootcert:
    postgres_options["sslrootcert"] = db_sslrootcert
if db_sslcert:
    postgres_options["sslcert"] = db_sslcert
if db_sslkey:
    postgres_options["sslkey"] = db_sslkey

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "rtp3"),
        "USER": os.getenv("DB_USER", "rtp3"),
        "PASSWORD": os.getenv("DB_PASSWORD", "rtp3"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "CONN_MAX_AGE": db_conn_max_age,
        "OPTIONS": postgres_options,
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = "ru-ru"

TIME_ZONE = "Asia/Yekaterinburg"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = "static/"

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
