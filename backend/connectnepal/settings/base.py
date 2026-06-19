"""
DJANGO BASE SETTINGS for connectnepal project.

Do NOT import this file directly — use dev.py or prod.py.
"""

from pathlib import Path
from decouple import config
from datetime import timedelta
import os
from celery.schedules import crontab
from corsheaders.defaults import default_headers

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent


# SECURITY 
# SECRET_KEY must be set in the environment. Never use the default in production.
SECRET_KEY = config('SECRET_KEY')


# DEBUG and ALLOWED_HOSTS are NOT defined here.
# They are defined per environment in dev.py / prod.py.


# INSTALLED APPS 
INSTALLED_APPS = [
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_spectacular',
    'corsheaders',
    'django_filters',
    'django_celery_beat',

    # Local apps
    'utils.apps.UtilsConfig',
    'accounts.apps.AccountsConfig',
    'listings.apps.ListingsConfig',
    'trip_planner.apps.TripPlannerConfig',
    'bookings.apps.BookingsConfig',
    'payments.apps.PaymentsConfig',
    'packages.apps.PackagesConfig',
    'reviews.apps.ReviewsConfig',
    'analytics.apps.AnalyticsConfig',
    'complaints.apps.ComplaintsConfig',
    'recommendations.apps.RecommendationsConfig',
    'notifications.apps.NotificationsConfig',
    'pages.apps.PagesConfig',
    'chatbot.apps.ChatbotConfig',
]


# MIDDLEWARE 
# NOTE: prod.py adds WhiteNoiseMiddleware after SecurityMiddleware.

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'connectnepal.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
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

WSGI_APPLICATION = 'connectnepal.wsgi.application'



# DATABASE
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASES = {
    'default': {
        "ENGINE": config("DB_ENGINE"),
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT"),
    }
}


# PASSWORD VALIDATION
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

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


# INTERNATIONALISATION
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# STATIC and MEDIA FILES
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# PRIMARY KEY AND USER MODEL
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.Account'


# DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'EXCEPTION_HANDLER': 'utils.exceptions.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'auth': '20/min',
        'password_reset': '5/min',
        'listing_creation': '10/day',
        'event_ingestion': '60/min',
        'interaction_ingestion': '120/min',
        'chatbot': '30/min',
    },
}


# API DOCS
SPECTACULAR_SETTINGS = {
    'TITLE': 'ConnectNepal API',
    'DESCRIPTION': 'API documentation for ConnectNepal - Travel Marketplace Platform',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': '/api/',
    'SECURITY': [{'bearerAuth': []}],
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'bearerAuth': {
                'type': 'http',
                'scheme': 'bearer',
                'bearerFormat': 'JWT',
            }
        }
    },
    'POSTPROCESSING_HOOKS': ['utils.schema.custom_postprocessing_hook'],
    'TAGS': [
        {'name': 'Authentication', 'description': 'Login, logout, and token management'},
        {'name': 'Registration', 'description': 'User registration and account activation'},
        {'name': 'Password Reset', 'description': 'Password reset flow'},
        {'name': 'User Profile', 'description': 'Current user information'},
        {'name': 'Onboarding - Traveller', 'description': 'Traveller onboarding steps'},
        {'name': 'Onboarding - Host', 'description': 'Host onboarding steps'},
        {'name': 'Onboarding Status', 'description': 'Check onboarding progress'},
        {'name': 'Trip Planner'},
        {'name': 'Trip Planner Items'},
        {'name': 'Analytics', 'description': 'Read-only traveller, host, and admin dashboard overviews'},
    ],
}


# EMAIL 
EMAIL_BACKEND = config('EMAIL_BACKEND')
EMAIL_HOST = config('EMAIL_HOST')
EMAIL_PORT = config('EMAIL_PORT', cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', cast=bool)

# FRONTEND DOMAIN URL 
FRONTEND_URL = config('FRONTEND_URL')

ENABLE_CHATBOT = config('ENABLE_CHATBOT', default=True, cast=bool)
ENABLE_RECOMMENDATIONS = config('ENABLE_RECOMMENDATIONS', default=True, cast=bool)


# JWT 
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=14),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}


# CORS (shared base — origins defined per environment)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + ['idempotency-key']


# File uploads
FILE_MAX_SIZE_MB = 2
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf']


# CELERY 

# Celery Broker settings
CELERY_BROKER_URL = config('CELERY_BROKER_URL', default='redis://localhost:6379/0')

# Celery Result Backend (stores task results)
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')

# Accept content type (security)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone
CELERY_TIMEZONE = TIME_ZONE

# Task result expiration (1 day)
CELERY_RESULT_EXPIRES = 60 * 60 * 24

# Enable task tracking
CELERY_TASK_TRACK_STARTED = True

# Task time limit (10 minutes max)
CELERY_TASK_TIME_LIMIT = 10 * 60

# Email task retry settings
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# For development: Set to True to run tasks synchronously (useful for debugging)
CELERY_TASK_ALWAYS_EAGER = config('CELERY_TASK_ALWAYS_EAGER', default=False, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = True


CELERY_BEAT_SCHEDULE = {
    'expire-stale-bookings': {
        'task': 'bookings.tasks.expire_stale_bookings_task',
        'schedule': 60.0,
    },
    'generate-listing-slots': {
        'task': 'listings.tasks.generate_slots_task',
        'schedule': crontab(hour=1, minute=0),
    },
    'generate-package-slots': {
        'task': 'packages.tasks.generate_slots_task',
        'schedule': crontab(hour=1, minute=10),
    },
    'expire-stale-payment-attempts': {
        'task': 'payments.tasks.expire_stale_payment_attempts',
        'schedule': 300.0,
    },
}


# CACHES
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    },
    'recommendations': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_RECOMMENDATIONS_URL', default='redis://localhost:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'TIMEOUT': 60 * 30,  # 30 minutes default TTL
        'KEY_PREFIX': 'reco',
    },
    'dashboards': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_DASHBOARDS_URL', default='redis://localhost:6379/2'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'TIMEOUT': 60,
        'KEY_PREFIX': 'dash',
    },
}


# ANALYTICS 
ANALYTICS_CACHE_TTL_TRAVELLER_OVERVIEW = 60
ANALYTICS_CACHE_TTL_HOST_OVERVIEW = 60
ANALYTICS_CACHE_TTL_ADMIN_OVERVIEW = 120


# RECOMMENDATION SYSTEM 
RECOMMENDATION_ARTIFACT_DIR = BASE_DIR / 'recommendations' / 'artifacts'
RECOMMENDATION_VECTOR_DIMENSION = config('RECOMMENDATION_VECTOR_DIMENSION', default=128, cast=int)
RECOMMENDATION_SIMILAR_LIMIT = 10          # max similar listings returned
RECOMMENDATION_FOR_YOU_LIMIT = 20          # max for-you listings returned
RECOMMENDATION_SIMILAR_CANDIDATES = 50     # pgvector retrieval pool before filtering
RECOMMENDATION_FOR_YOU_CANDIDATES = 80     # pgvector retrieval pool before filtering
RECOMMENDATION_CACHE_TTL_SIMILAR = 60 * 15   # 15 minutes
RECOMMENDATION_CACHE_TTL_FOR_YOU = 60 * 10   # 10 minutes
RECOMMENDATION_CACHE_TTL_POPULAR = 60 * 60   # 1 hour (fallback popular items)

# Behavior profile settings ---
RECOMMENDATION_BEHAVIOR_CLICK_WEIGHT = 1.0 # score weight for click events
RECOMMENDATION_BEHAVIOR_DETAIL_OPEN_WEIGHT = 1.5 # score weight for detail_open events
RECOMMENDATION_BEHAVIOR_RECENT_DAYS = 7 # recent window in days
RECOMMENDATION_BEHAVIOR_MAX_DAYS = 90 # maximum event age in days
RECOMMENDATION_BEHAVIOR_RECENT_MULTIPLIER = 2.0 # multiplier for events in recent window
RECOMMENDATION_BEHAVIOR_TOP_K = 20 # max listings used in behavior vector
RECOMMENDATION_BEHAVIOR_MIN_LISTINGS = 3 # minimum distinct listings to avoid sparse
RECOMMENDATION_BEHAVIOR_ALPHA = 0.35 # blending weight for behavior vector in /for-you/
RECOMMENDATION_BEHAVIOR_REBUILD_DEBOUNCE_SECONDS = config(
    'RECOMMENDATION_BEHAVIOR_REBUILD_DEBOUNCE_SECONDS',
    default=30,
    cast=int,
)

# Source-surface multipliers for behavior profiling.
# Applied on top of event-type weights and recency multipliers.
# Recommendation-origin surfaces (strongest signal):
RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_SIMILAR = 1.0
RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_FOR_YOU = 1.0
RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_SEARCH = 0.8 # Search-origin (high intent, user had query context)
RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_LISTING_DETAIL = 0.7 # Direct listing-detail navigation
RECOMMENDATION_BEHAVIOR_SOURCE_MULTIPLIER_CATALOG = 0.6 # Catalog browse (weakest — no query context)

# set to False to disable behavior blending globally.
# When False, all /for-you/ requests use preference-only vectors.
RECOMMENDATION_BEHAVIOR_ENABLED = config(
    'RECOMMENDATION_BEHAVIOR_ENABLED',
    default=True,
    cast=bool,
)


# eSewa
ESEWA_SECRET_KEY = config('ESEWA_SECRET_KEY')
ESEWA_PRODUCT_CODE = config('ESEWA_PRODUCT_CODE', default='EPAYTEST')
ESEWA_PAYMENT_URL = config('ESEWA_PAYMENT_URL', default='https://rc-epay.esewa.com.np/api/epay/main/v2/form')
ESEWA_STATUS_CHECK_URL = config('ESEWA_STATUS_CHECK_URL', default='https://rc.esewa.com.np/api/epay/transaction/status/')
BACKEND_BASE_URL = config('BACKEND_BASE_URL', default='http://localhost:8000')


# Use Redis as the channel layer backend (same Redis instance, different DB)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(config("REDIS_HOST", default="localhost"), 6379)],
            "prefix": "connectnepal:ws",
        },
    },
}


# CHATBOT / OLLAMA
OLLAMA_BASE_URL = config('OLLAMA_BASE_URL', default='http://localhost:11434')
OLLAMA_CHAT_MODEL = config('OLLAMA_CHAT_MODEL', default='mistral')
OLLAMA_EMBEDDING_MODEL = config('OLLAMA_EMBEDDING_MODEL', default='nomic-embed-text')
OLLAMA_CHAT_TIMEOUT = config('OLLAMA_CHAT_TIMEOUT', default=120, cast=int)
OLLAMA_EMBEDDING_TIMEOUT = config('OLLAMA_EMBEDDING_TIMEOUT', default=30, cast=int)

# FAQ RAG settings
CHATBOT_FAQ_EMBEDDING_DIMENSION = 768
CHATBOT_FAQ_TOP_K = 3
CHATBOT_FAQ_SIMILARITY_THRESHOLD = 0.45
CHATBOT_FAQ_STRONG_MATCH_THRESHOLD = 0.35
CHATBOT_MAX_CONTEXT_MESSAGES = 6
