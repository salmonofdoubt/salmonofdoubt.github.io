#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "DiAndré Art Manager"
echo
echo "Use:"
echo "  http://localhost:8000/art/manage/"
echo
echo "Preview:"
echo "  http://localhost:8000/art/"
echo
echo "If port 8000 is already in use, stop the other local server first."
echo "Press Ctrl+C here when finished."
echo

ART_CURATOR_PORT=8000 python3 tools/art_curator_server.py
