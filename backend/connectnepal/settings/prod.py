"""
Production settings — AWS EC2 only.
Usage: DJANGO_SETTINGS_MODULE=connectnepal.settings.prod
    (set this in the server's .env or systemd environment)
"""
from .base import *  # noqa: F403, F401
from decouple import Csv
from decouple import config

DEBUG = False

# Hosts
# .env value example: ALLOWED_HOSTS=api.yourdomain.com
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=Csv())  # noqa: F405

# CORS and CSRF — production domains only 
# .env value example: CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', cast=Csv())  # noqa: F405

# .env value example: CSRF_TRUSTED_ORIGINS=https://api.yourdomain.com,https://app.yourdomain.com
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', cast=Csv())  # noqa: F405


# HTTPS / proxy behavior
# These default to strict production-safe values, but can be disabled for local
# Docker runs that are intentionally plain HTTP behind an internal reverse proxy.
TRUST_X_FORWARDED_PROTO = config('TRUST_X_FORWARDED_PROTO', default=True, cast=bool)
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=True, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=True, cast=bool)
ENABLE_HSTS = config('ENABLE_HSTS', default=True, cast=bool)

# Cookie settings — strict in real HTTPS production, configurable for local HTTP.
CSRF_COOKIE_SAMESITE = 'None' if CSRF_COOKIE_SECURE else 'Lax'
COOKIE_SECURE = SESSION_COOKIE_SECURE
COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'
COOKIE_DOMAIN = None


# HTTPS security 
# SECURE_PROXY_SSL_HEADER is required because Nginx terminates SSL
# and forwards traffic to Gunicorn as plain HTTP internally.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if TRUST_X_FORWARDED_PROTO else None

# HSTS — start with 1 hour (3600).
# After confirming HTTPS works correctly for 1+ weeks, increase to 31536000 (1 year).
# Do NOT set SECURE_HSTS_PRELOAD = True until you are certain you will keep HTTPS forever
# (preload is very hard to undo — it requires HSTS preload list removal which takes months).
SECURE_HSTS_SECONDS = 3600 if ENABLE_HSTS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = ENABLE_HSTS
SECURE_HSTS_PRELOAD = False

# Silence the HSTS preload warning — we intentionally keep preload off until
# HSTS is confirmed stable. Do not enable preload prematurely.
SILENCED_SYSTEM_CHECKS = ['security.W021']


# Additional browser security headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# API docs — restrict to admin users only in production.
# To open it up temporarily (e.g. for a demo), comment this line out.
SPECTACULAR_SETTINGS['SERVE_PERMISSIONS'] = ['rest_framework.permissions.IsAdminUser']


# ── Middleware — add WhiteNoise for static files ───────────────────────────────
# WhiteNoise MUST go directly after SecurityMiddleware (before session/common).
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# Static files — WhiteNoise
# Compresses files and adds content-hash cache-busting suffixes.
# Run `python manage.py collectstatic` before starting the server.
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'


# Database — persistent connections
# Keeps connections alive for 60 seconds, reducing per-request TCP overhead.
DATABASES['default']['CONN_MAX_AGE'] = 60  # noqa: F405


# Logging
# logs/ directory is created automatically on startup if it does not exist.
LOGS_DIR = BASE_DIR / 'logs'  # noqa: F405
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name} {module} — {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file_django': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'django.log',
            'maxBytes': 10 * 1024 * 1024,  # 10 MB per file
            'backupCount': 5,              # keep 5 rotated files
            'formatter': 'verbose',
        },
        'file_app': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'app.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file_django'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file_django'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console', 'file_django'],
            'level': 'WARNING',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console', 'file_app'],
            'level': 'INFO',
            'propagate': False,
        },
        'bookings': {
            'handlers': ['console', 'file_app'],
            'level': 'INFO',
            'propagate': False,
        },
        'payments': {
            'handlers': ['console', 'file_app'],
            'level': 'INFO',
            'propagate': False,
        },
        'listings': {
            'handlers': ['console', 'file_app'],
            'level': 'WARNING',
            'propagate': False,
        },
        'recommendations': {
            'handlers': ['file_app', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
