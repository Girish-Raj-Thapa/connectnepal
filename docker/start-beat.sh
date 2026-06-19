#!/bin/sh
set -eu

cd /app/backend

exec celery -A connectnepal beat \
  --pidfile /tmp/celerybeat.pid \
  --scheduler django_celery_beat.schedulers:DatabaseScheduler \
  --loglevel "${CELERY_LOG_LEVEL:-INFO}"
