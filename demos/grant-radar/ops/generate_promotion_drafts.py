#!/usr/bin/env python3
"""Auto-generate promotion CL drafts for approved Grant Radar candidates."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
PROMOTE_SCRIPT = SITE_DIR / "ops" / "promote_candidate.py"


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def draft_exists(candidate: dict) -> bool:
    html_rel = candidate.get("cl_draft_html")
    json_rel = candidate.get("cl_draft_json")
    if not html_rel or not json_rel:
        return False
    return (SITE_DIR / html_rel).exists() and (SITE_DIR / json_rel).exists()


def main() -> None:
    payload = load_json(CANDIDATES_PATH, default={})
    drafted = 0
    for candidate in payload.get("candidates", []):
        if candidate.get("status") != "approved":
            continue
        if draft_exists(candidate):
            continue
        candidate_id = candidate.get("id")
        if not candidate_id:
            continue
        print(f"Generating CL draft for approved candidate: {candidate_id}")
        subprocess.run([sys.executable, str(PROMOTE_SCRIPT), "--id", candidate_id], check=True)
        drafted += 1
    print(f"Generated {drafted} new CL draft(s).")


if __name__ == "__main__":
    main()
