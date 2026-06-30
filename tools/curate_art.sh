#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f tools/art_curator_server.py ]; then
  echo "Missing tools/art_curator_server.py"
  echo "Ask ChatGPT to recreate the curator server file."
  exit 1
fi

if [ ! -f art/curate/index.html ]; then
  echo "Missing art/curate/index.html"
  echo "Ask ChatGPT to recreate the curator page."
  exit 1
fi

echo
echo "DiAndré Art Curator"
echo "Use this URL for curation:"
echo "  http://localhost:8010/art/curate/"
echo
echo "Use this URL to preview the art page after saving:"
echo "  http://localhost:8010/art/"
echo
echo "Do not use localhost:8000 while curating."
echo "Press Ctrl+C here when finished."
echo

python3 tools/art_curator_server.py
