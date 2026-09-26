#!/usr/bin/env bash

cd "$(dirname "$0")" || exit 1

PORT="${ART_CURATOR_PORT:-8000}"

echo "Checking for previous DiAndré art-manager server..."

# Kill only previous instances of this specific Python server.
OLD_PIDS="$(pgrep -f 'tools/art_curator_server\.py' 2>/dev/null || true)"

if [ -n "$OLD_PIDS" ]; then
    echo "Stopping previous art-manager process: $OLD_PIDS"
    kill $OLD_PIDS 2>/dev/null || true

    # Wait briefly for port 8000 to be released.
    i=0
    while lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
        i=$((i + 1))

        if [ "$i" -ge 30 ]; then
            echo "Port $PORT is still occupied."
            echo "Processes using it:"
            lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
            exit 1
        fi

        sleep 0.1
    done
fi

echo "Starting DiAndré art manager..."
echo "http://localhost:$PORT/art/manage/"

ART_CURATOR_PORT="$PORT" exec python3 tools/art_curator_server.py
