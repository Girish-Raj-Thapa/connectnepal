"""
DJANGO Development settings — local machine only.

Usage: DJANGO_SETTINGS_MODULE=connectnepal.settings.dev
    (this is the default set in manage.py)
"""

from .base import *  # noqa: F403, F401

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

# Static files in local ASGI/Uvicorn development.
# WhiteNoise must sit directly after SecurityMiddleware.
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

# CORS and CSRF — localhost only
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
]

# Cookie settings — relaxed for local HTTP
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = False
COOKIE_SECURE = False
COOKIE_SAMESITE = 'Lax'
COOKIE_DOMAIN = None
