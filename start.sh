#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-9999}"
SITE_DIR="$ROOT_DIR/site"
PID_FILE="${TMPDIR:-/tmp}/sdesign-course-server-${PORT}.pid"
LOG_FILE="${TMPDIR:-/tmp}/sdesign-course-server-${PORT}.log"
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

if [[ ! -d "$SITE_DIR" ]]; then
  echo "Site directory not found: $SITE_DIR" >&2
  echo "Build the site first with: node scripts/build_site.mjs" >&2
  exit 1
fi

if [[ ! -f "$APP_ENTRY" ]]; then
  echo "App server entry not found: $APP_ENTRY" >&2
  exit 1
fi

if is_server_healthy; then
  echo "Course server already running at $SERVER_URL"
  exit 0
fi

PORT_PID="$(listening_pid || true)"
if [[ -n "${PORT_PID}" ]]; then
  echo "Port $PORT is already in use by PID ${PORT_PID}, but ${SERVER_URL} did not respond as the course server." >&2
  echo "Stop the conflicting process or rerun with a different PORT." >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  STALE_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${STALE_PID}" ]] && ! kill -0 "$STALE_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

(cd "$ROOT_DIR" && node scripts/build_site.mjs)

if command -v screen >/dev/null 2>&1; then
  SCREEN_CMD="$(printf 'export HOST=%q PORT=%q; exec node %q >>%q 2>&1' \
    "$HOST" "$PORT" "$APP_ENTRY" "$LOG_FILE")"
  screen -S "$SCREEN_NAME" -X quit >/dev/null 2>&1 || true
  screen -dmS "$SCREEN_NAME" bash -lc "$SCREEN_CMD"
  SERVER_PID=""
elif command -v setsid >/dev/null 2>&1; then
  HOST="$HOST" PORT="$PORT" setsid node "$APP_ENTRY" \
    >"$LOG_FILE" 2>&1 < /dev/null &
  SERVER_PID=$!
else
  HOST="$HOST" PORT="$PORT" nohup node "$APP_ENTRY" \
    >"$LOG_FILE" 2>&1 < /dev/null &
  SERVER_PID=$!
fi

if [[ -n "$SERVER_PID" ]]; then
  echo "$SERVER_PID" >"$PID_FILE"
else
  rm -f "$PID_FILE"
fi

for _ in $(seq 1 20); do
  if is_server_healthy; then
    echo "Course server started at $SERVER_URL"
    echo "PID: $SERVER_PID"
    echo "Log: $LOG_FILE"
    exit 0
  fi

  if [[ -n "$SERVER_PID" ]] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Course server failed to start. Check $LOG_FILE" >&2
    exit 1
  fi

  sleep 0.25
done

echo "Timed out waiting for course server at $SERVER_URL. Check $LOG_FILE" >&2
exit 1
