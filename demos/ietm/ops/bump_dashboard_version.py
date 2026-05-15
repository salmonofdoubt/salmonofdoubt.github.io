#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parents[1]

VERSION_FILE = APP / "VERSION"
MONITOR = APP / "data" / "monitor.json"
INDEX = APP / "index.html"

def read_version() -> tuple[int, int, int]:
    raw = VERSION_FILE.read_text().strip().lstrip("v")
    m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", raw)
    if not m:
        raise SystemExit(f"Invalid VERSION value: {raw!r}")
    return tuple(map(int, m.groups()))

def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

def main() -> int:
    major, minor, patch = read_version()
    patch += 1
    version = f"{major}.{minor}.{patch}"
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    VERSION_FILE.write_text(version + "\n")

    if MONITOR.exists():
        data = json.loads(MONITOR.read_text())
        data["dashboard_version"] = version
        meta = data.setdefault("meta", {})
        if isinstance(meta, dict):
            meta["dashboard_version"] = version
            meta["dashboard_version_updated_at"] = now
        write_json(MONITOR, data)

    if INDEX.exists():
        html = INDEX.read_text()
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        html = re.sub(r'app\.js\?v=[^"]+', f'app.js?v=dashboard-version-{stamp}', html)
        html = re.sub(r'styles\.css\?v=[^"]+', f'styles.css?v=dashboard-version-{stamp}', html)
        INDEX.write_text(html)

    print(f"Bumped IETM live dashboard version to v{version}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
