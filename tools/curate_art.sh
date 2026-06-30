#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "DiAndré Art Curator"
echo
echo "This replaces the normal localhost server while you curate."
echo "Use only:"
echo "  http://localhost:8000/art/curate/"
echo
echo "Preview after saving:"
echo "  http://localhost:8000/art/"
echo
echo "If port 8000 is already in use, stop your other local server first with Ctrl+C."
echo "Press Ctrl+C here when finished."
echo

ART_CURATOR_PORT=8000 python3 tools/art_curator_server.py
