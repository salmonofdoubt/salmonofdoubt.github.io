#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PORT="${DARK_RIVERS_SMOKE_PORT:-8765}"
DOM="/tmp/dark-rivers-smoke-dom.html"
LOG="/tmp/dark-rivers-smoke-http.log"

cd "$ROOT"
python3 -m http.server "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo "No Chrome/Chromium executable found" >&2
  exit 1
fi

"$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --virtual-time-budget=4000 \
  --dump-dom \
  "http://127.0.0.1:${PORT}/demos/dark-rivers/?smoke=1" >"$DOM"

grep -q 'data-dark-rivers-version="20260918-8"' "$DOM"
grep -q 'data-dark-rivers-render="pass"' "$DOM"
grep -q 'data-dark-rivers-visible="15"' "$DOM"
grep -q 'data-dark-rivers-expected="15"' "$DOM"

echo "Dark Rivers browser smoke test passed"
