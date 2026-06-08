#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

DEFAULT_RULES = {
    "hourly": {"fresh_hours": 2, "stale_hours": 6},
    "daily": {"fresh_hours": 36, "stale_hours": 72},
    "weekly": {"fresh_hours": 216, "stale_hours": 336},
    "manual": {"fresh_hours": 2160, "stale_hours": 4320},
}

def now() -> datetime:
    return datetime.now(timezone.utc)

def now_iso() -> str:
    return now().replace(microsecond=0).isoformat()

def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {"_parse_error": str(exc)}

def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None

def best_timestamp(data: Any) -> str:
    if isinstance(data, dict):
        for key in ("generated_at", "updated_at", "last_success_at", "published_at"):
            if data.get(key):
                return str(data[key])
        items = data.get("items")
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    for key in ("updated_at", "published_at", "date"):
                        if item.get(key):
                            return str(item[key])
    return ""

def file_status(path_text: str) -> dict[str, Any]:
    path = ROOT / path_text
    if not path.exists():
        return {
            "path": path_text,
            "exists": False,
            "parse_ok": False,
            "timestamp": "",
            "message": "missing"
        }

    data = load_json(path)
    if isinstance(data, dict) and data.get("_parse_error"):
        return {
            "path": path_text,
            "exists": True,
            "parse_ok": False,
            "timestamp": "",
            "message": f"parse error: {data['_parse_error']}"
        }

    return {
        "path": path_text,
        "exists": True,
        "parse_ok": True,
        "timestamp": best_timestamp(data),
        "message": "ok"
    }

def classify(frequency: str, newest: datetime | None, parse_ok: bool, any_exists: bool, rules: dict[str, Any]) -> tuple[str, str, float | None]:
    if not any_exists:
        return "missing", "No configured output file exists yet.", None
    if not parse_ok:
        return "warning", "At least one configured output file could not be parsed.", None
    if newest is None:
        return "warning", "No usable generated_at or updated_at timestamp found.", None

    age_hours = (now() - newest).total_seconds() / 3600
    rule = rules.get(frequency, rules.get("manual", DEFAULT_RULES["manual"]))

    if age_hours <= rule["fresh_hours"]:
        return "fresh", "Data is within the expected freshness window.", round(age_hours, 2)
    if age_hours <= rule["stale_hours"]:
        return "stale", "Data missed the fresh window but is not yet offline.", round(age_hours, 2)
    return "offline", "Data is older than the accepted stale window.", round(age_hours, 2)

def main() -> None:
    registry = load_json(DATA / "monitor-registry.json", {"monitors": [], "freshness_rules": DEFAULT_RULES})
    rules = registry.get("freshness_rules", DEFAULT_RULES) if isinstance(registry, dict) else DEFAULT_RULES

    jobs = []
    for monitor in registry.get("monitors", []):
        if not isinstance(monitor, dict):
            continue

        files = [file_status(path) for path in monitor.get("data_files", [])]
        timestamps = [parse_iso(f["timestamp"]) for f in files if f.get("timestamp")]
        timestamps = [t for t in timestamps if t is not None]
        newest = max(timestamps) if timestamps else None
        parse_ok = all(f["parse_ok"] for f in files if f["exists"])
        any_exists = any(f["exists"] for f in files)

        status, message, age_hours = classify(
            monitor.get("frequency", "manual"),
            newest,
            parse_ok,
            any_exists,
            rules
        )

        jobs.append({
            "job_id": monitor.get("id", "unknown"),
            "name": monitor.get("name", "Unknown monitor"),
            "category": monitor.get("category", ""),
            "frequency": monitor.get("frequency", "manual"),
            "public": bool(monitor.get("public", False)),
            "maturity": monitor.get("maturity", ""),
            "status": status,
            "message": message,
            "last_success_at": newest.replace(microsecond=0).isoformat() if newest else "",
            "data_age_hours": age_hours,
            "landing_page": monitor.get("landing_page", ""),
            "files": files,
            "caveat": monitor.get("caveat", "")
        })

    payload = {
        "generated_at": now_iso(),
        "schema_version": "1.0.0",
        "job_count": len(jobs),
        "jobs": jobs
    }
    DATA.mkdir(exist_ok=True)
    (DATA / "job-status.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"built status for {len(jobs)} jobs")

if __name__ == "__main__":
    main()
