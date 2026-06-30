#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ART_CURATOR_PORT=8000 python3 tools/art_curator_server.py
