#!/bin/sh
set -eu

cd /app/backend

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-connectnepal.settings.prod}"
export PYTHONPATH="/app/backend${PYTHONPATH:+:${PYTHONPATH}}"

mkdir -p /app/backend/logs /app/backend/media /app/backend/staticfiles

exec "$@"
