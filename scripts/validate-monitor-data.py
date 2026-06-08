#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

REQUIRED_ITEM_FIELDS = ["id", "monitor", "lane", "title", "status", "importance", "confidence"]

def load(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"ERROR: could not parse {path}: {exc}")

def valid_url(value: str) -> bool:
    if not value:
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

def main() -> None:
    errors = []

    registry_path = DATA / "monitor-registry.json"
    items_path = DATA / "monitor-items.json"
    status_path = DATA / "job-status.json"

    for path in (registry_path, items_path, status_path):
        if not path.exists():
            errors.append(f"missing {path.relative_to(ROOT)}")

    if errors:
        raise SystemExit("\n".join(errors))

    registry = load(registry_path)
    items = load(items_path)
    status = load(status_path)

    monitor_ids = {m.get("id") for m in registry.get("monitors", []) if isinstance(m, dict)}
    seen_ids = set()

    for item in items.get("items", []):
        if not isinstance(item, dict):
            errors.append("monitor item is not an object")
            continue

        for field in REQUIRED_ITEM_FIELDS:
            if item.get(field) in (None, ""):
                errors.append(f"item missing {field}: {item}")

        if item.get("id") in seen_ids:
            errors.append(f"duplicate item id: {item.get('id')}")
        seen_ids.add(item.get("id"))

        if item.get("monitor") not in monitor_ids:
            errors.append(f"unknown monitor id on item {item.get('id')}: {item.get('monitor')}")

        if not valid_url(item.get("source_url", "")):
            errors.append(f"invalid URL on item {item.get('id')}: {item.get('source_url')}")

    for job in status.get("jobs", []):
        if not isinstance(job, dict):
            errors.append("job status row is not an object")
            continue
        if job.get("status") not in {"fresh", "stale", "warning", "offline", "missing"}:
            errors.append(f"invalid job status for {job.get('job_id')}: {job.get('status')}")

    if errors:
        raise SystemExit("monitor validation failed:\n" + "\n".join(f"- {e}" for e in errors))

    print("monitor validation passed")

if __name__ == "__main__":
    main()
