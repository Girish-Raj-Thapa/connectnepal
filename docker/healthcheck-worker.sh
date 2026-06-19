#!/bin/sh
set -eu

cd /app/backend

celery -A connectnepal inspect ping \
  -d "celery@${HOSTNAME}" \
  --timeout=5 | grep -q "pong"
