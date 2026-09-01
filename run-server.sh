#!/usr/bin/env bash

# Start the Operations Hub services for local development.
# This script starts existing services; it does not install or configure them.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

PARTNER_PYTHON="$REPO_ROOT/evolvee-partners/venv/bin/python"
PARTNER_PID=""

printf 'Repository root: %s\n' "$REPO_ROOT"

printf 'Starting backend...\n'

(
  cd "$REPO_ROOT/backend" || exit 1
  exec npm start
) &
BACKEND_PID=$!

printf 'Backend process ID: %s\n' "$BACKEND_PID"

printf 'Starting frontend...\n'

(
  cd "$REPO_ROOT/frontend" || exit 1
  exec npm run dev
) &
FRONTEND_PID=$!

printf 'Frontend process ID: %s\n' "$FRONTEND_PID"

if [[ -x "$PARTNER_PYTHON" ]]; then
  printf 'Starting QR Partner Program...\n'
  (
    cd "$REPO_ROOT/evolvee-partners" || exit 1
    exec "$PARTNER_PYTHON" manage.py runserver --skip-startup-prompt
  ) &
  PARTNER_PID=$!
  printf 'QR Partner Program process ID: %s\n' "$PARTNER_PID"
else
  printf 'QR Partner Program not set up; skipping.\n'
fi

stop_process() {
  local service_name="$1"
  local process_id="$2"

  if kill "$process_id" 2>/dev/null; then
    printf 'Stopping %s...\n' "$service_name"
  else
    printf '%s was already stopped.\n' "$service_name"
  fi
}

cleanup() {
  printf '\nStopping services...\n'

  stop_process 'Backend' "$BACKEND_PID"
  stop_process 'Frontend' "$FRONTEND_PID"

  if [[ -n "$PARTNER_PID" ]]; then
    stop_process 'QR Partner Program' "$PARTNER_PID"
  fi

  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null

  if [[ -n "$PARTNER_PID" ]]; then
    wait "$PARTNER_PID" 2>/dev/null
  fi

  printf 'Launcher services stopped.\n'
}

trap cleanup INT TERM

if [[ -n "$PARTNER_PID" ]]; then
  wait "$BACKEND_PID" "$FRONTEND_PID" "$PARTNER_PID"
else
  wait "$BACKEND_PID" "$FRONTEND_PID"
fi