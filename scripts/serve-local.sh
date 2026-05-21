#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-8000}"
BRANCH="${2:-master}"

cd "$(git rev-parse --show-toplevel)"

echo "Checking repository state..."
git status --short

echo "Fetching latest origin/$BRANCH..."
git fetch origin "$BRANCH"

echo "Syncing local $BRANCH with origin/$BRANCH..."
git pull --rebase --autostash origin "$BRANCH"

echo
echo "Starting no-cache local server on:"
echo "http://127.0.0.1:${PORT}/"
echo
echo "UrbanForest radar:"
echo "http://127.0.0.1:${PORT}/demos/urbanforest/news/"
echo
echo "Stop with Ctrl+C."
echo

python - "$PORT" <<'PY'
import http.server
import socketserver
import sys

port = int(sys.argv[1])

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

with socketserver.TCPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
    httpd.serve_forever()
PY
