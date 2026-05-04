#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-9999}"
SITE_DIR="$ROOT_DIR/site"
PID_FILE="${TMPDIR:-/tmp}/sdesign-course-server-${PORT}.pid"
SERVER_URL="http://localhost:${PORT}/"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
SCREEN_NAME="sdesign-course-server-${PORT}"
APP_ENTRY="$ROOT_DIR/server/course_server.mjs"

is_server_healthy() {
  curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1
}

listening_pid() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

command_for_pid() {
  ps -p "$1" -o command= 2>/dev/null
}

is_managed_server_pid() {
  local pid="$1"
  local command
  local command_lower
  local host_lower
  local site_dir_lower
  local app_entry_lower

  command="$(command_for_pid "$pid")"
  [[ -n "$command" ]] || return 1
  command_lower="$(printf '%s' "$command" | tr '[:upper:]' '[:lower:]')"
  host_lower="$(printf '%s' "$HOST" | tr '[:upper:]' '[:lower:]')"
  site_dir_lower="$(printf '%s' "$SITE_DIR" | tr '[:upper:]' '[:lower:]')"
  app_entry_lower="$(printf '%s' "$APP_ENTRY" | tr '[:upper:]' '[:lower:]')"

  if [[ "$command_lower" == *"node"* ]] && [[ "$command_lower" == *"${app_entry_lower}"* ]]; then
    return 0
  fi

  [[ "$command_lower" == *"python"* ]] &&
    [[ "$command_lower" == *"-m http.server"* ]] &&
    [[ "$command_lower" == *" $PORT "* || "$command_lower" == *" $PORT" ]] &&
    [[ "$command_lower" == *"--bind ${host_lower}"* ]] &&
    [[ "$command_lower" == *"--directory ${site_dir_lower}"* ]]
}

wait_for_stop() {
  for _ in $(seq 1 20); do
    if ! is_server_healthy && [[ -z "$(listening_pid || true)" ]]; then
      rm -f "$PID_FILE"
      return 0
    fi
    sleep 0.25
  done

  return 1
}

stopped=false

if command -v screen >/dev/null 2>&1 && screen -ls | grep -q "${SCREEN_NAME}"; then
  screen -S "$SCREEN_NAME" -X quit
  stopped=true
fi

PORT_PID="$(listening_pid || true)"
if [[ -n "$PORT_PID" ]] && is_managed_server_pid "$PORT_PID"; then
  kill "$PORT_PID"
  stopped=true
fi

if [[ "$stopped" == false ]]; then
  if [[ -f "$PID_FILE" ]]; then
    STALE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$STALE_PID" ]] && kill -0 "$STALE_PID" 2>/dev/null && is_managed_server_pid "$STALE_PID"; then
      kill "$STALE_PID"
      stopped=true
    else
      rm -f "$PID_FILE"
    fi
  fi
fi

if [[ "$stopped" == false ]]; then
  if [[ -n "$(listening_pid || true)" ]]; then
    echo "Port $PORT is in use, but not by the managed course server. Refusing to stop it." >&2
    exit 1
  fi

  echo "Course server is not running at $SERVER_URL"
  exit 0
fi

if wait_for_stop; then
  echo "Course server stopped for $SERVER_URL"
  exit 0
fi

echo "Timed out waiting for course server on $SERVER_URL to stop" >&2
exit 1
