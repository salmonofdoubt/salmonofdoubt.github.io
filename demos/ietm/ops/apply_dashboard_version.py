#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
VERSION_FILE = APP / "VERSION"
MONITOR = APP / "data" / "monitor.json"

def main() -> int:
    version = VERSION_FILE.read_text().strip().lstrip("v")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    data = json.loads(MONITOR.read_text())
    data["dashboard_version"] = version

    meta = data.setdefault("meta", {})
    if isinstance(meta, dict):
        meta["dashboard_version"] = version
        meta["dashboard_version_updated_at"] = now

    MONITOR.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied IETM dashboard version v{version} to data/monitor.json")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
