#!/bin/sh
set -eu

cd /app/backend

exec celery -A connectnepal worker \
  --concurrency "${CELERY_CONCURRENCY:-2}" \
  --loglevel "${CELERY_LOG_LEVEL:-INFO}"
