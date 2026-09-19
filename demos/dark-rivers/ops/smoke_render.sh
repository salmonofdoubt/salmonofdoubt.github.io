#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PORT="${DARK_RIVERS_SMOKE_PORT:-8765}"
DOM="/tmp/dark-rivers-smoke-dom.html"
LOG="/tmp/dark-rivers-smoke-http.log"
INDEX="$ROOT/demos/dark-rivers/index.html"

BUILD="$(sed -n 's/.*data-dark-rivers-version="\([^"]*\)".*/\1/p' "$INDEX" | head -1)"
if [[ -z "$BUILD" ]]; then
  echo "Dark Rivers build fingerprint missing from index.html" >&2
  exit 1
fi

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
  --virtual-time-budget=8000 \
  --dump-dom \
  "http://127.0.0.1:${PORT}/demos/dark-rivers/?smoke=1" >"$DOM"

grep -q "data-dark-rivers-version=\"$BUILD\"" "$DOM"
if ! grep -q 'data-dark-rivers-coast-fit="pass"' "$DOM"; then
  echo "Dark Rivers coastline clips the overview map" >&2
  grep -o 'data-dark-rivers-coast-fit="[^"]*"' "$DOM" >&2 || true
  exit 1
fi
if ! grep -q 'data-dark-rivers-render="pass"' "$DOM"; then
  echo "Dark Rivers render health did not pass" >&2
  grep -o 'data-dark-rivers-render="[^"]*"\|data-dark-rivers-expected="[^"]*"\|data-dark-rivers-visible="[^"]*"' "$DOM" >&2 || true
  exit 1
fi

EXPECTED="$(sed -n 's/.*data-dark-rivers-expected="\([0-9][0-9]*\)".*/\1/p' "$DOM" | head -1)"
VISIBLE="$(sed -n 's/.*data-dark-rivers-visible="\([0-9][0-9]*\)".*/\1/p' "$DOM" | head -1)"

if [[ -z "$EXPECTED" || -z "$VISIBLE" ]]; then
  echo "Dark Rivers render-health attributes missing" >&2
  exit 1
fi
if [[ "$EXPECTED" -lt 1 ]]; then
  echo "Dark Rivers expected reach count is zero" >&2
  exit 1
fi
if [[ "$VISIBLE" != "$EXPECTED" ]]; then
  echo "Dark Rivers visible/expected mismatch: $VISIBLE / $EXPECTED" >&2
  exit 1
fi

echo "Dark Rivers browser smoke test passed for build $BUILD: $VISIBLE / $EXPECTED visibly coloured reaches"
