#!/bin/sh
set -eu

cd /app/backend

WAIT_FOR_DB_TIMEOUT="${WAIT_FOR_DB_TIMEOUT:-60}"
WAIT_FOR_DB_INTERVAL="${WAIT_FOR_DB_INTERVAL:-2}"
AUTO_APPLY_MIGRATIONS="${AUTO_APPLY_MIGRATIONS:-true}"
AUTO_COLLECTSTATIC="${AUTO_COLLECTSTATIC:-true}"

echo "Waiting for database connectivity..."
elapsed=0
until python manage.py shell -c "from django.db import connection; connection.ensure_connection(); print('database ok')" >/dev/null 2>&1
do
  if [ "$elapsed" -ge "$WAIT_FOR_DB_TIMEOUT" ]; then
    echo "Database did not become ready within ${WAIT_FOR_DB_TIMEOUT}s"
    exit 1
  fi

  sleep "$WAIT_FOR_DB_INTERVAL"
  elapsed=$((elapsed + WAIT_FOR_DB_INTERVAL))
done

if [ "$AUTO_APPLY_MIGRATIONS" = "true" ]; then
  echo "Applying Django migrations..."
  python manage.py migrate --noinput
fi

if [ "$AUTO_COLLECTSTATIC" = "true" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput
fi

exec gunicorn connectnepal.asgi:application \
  --bind 0.0.0.0:8000 \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --access-logfile - \
  --error-logfile -
