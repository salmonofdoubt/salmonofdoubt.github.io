#!/usr/bin/env python3
"""
Maintain project-level renewable capacity status history.

This records when a project/register row is first seen and when it is first seen
as connected/energised. It is intentionally conservative: "first_seen_connected"
means first seen in our official-register harvest as connected, not necessarily
commissioning date.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "source"
CAPACITY = SOURCE_DIR / "renewable_capacity.json"
HISTORY = SOURCE_DIR / "renewable_capacity_history.json"

CONNECTED_STATUSES = {"connected", "energised", "commissioned"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def project_key(project: dict[str, Any]) -> str | None:
    return project.get("id") or project.get("project_id")


def compact_project(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "project_id": project_key(project),
        "name": project.get("name"),
        "technology": project.get("technology"),
        "capacity_mw": project.get("capacity_mw"),
        "capacity_basis": project.get("capacity_basis"),
        "network": project.get("network"),
        "status": project.get("status"),
        "source_key": project.get("source_key"),
        "reference": project.get("reference"),
    }


def main() -> None:
    capacity = read_json(CAPACITY, {})
    existing = read_json(HISTORY, {"projects": {}})
    generated_at = now_iso()
    harvest_at = capacity.get("meta", {}).get("generated_at") or generated_at

    projects = existing.get("projects", {}) or {}

    for project in capacity.get("projects", []) or []:
        key = project_key(project)
        if not key:
            continue

        status = str(project.get("status") or "unknown")
        status_date = project.get("source_correct_as_of") or harvest_at

        record = projects.setdefault(key, {
            "project_id": key,
            "name": project.get("name"),
            "technology": project.get("technology"),
            "first_seen_at": harvest_at,
            "first_seen_status": status,
            "first_seen_connected_at": None,
            "latest": {},
            "status_history": [],
        })

        record["name"] = project.get("name") or record.get("name")
        record["technology"] = project.get("technology") or record.get("technology")
        record["latest"] = compact_project(project)
        record["last_seen_at"] = harvest_at

        if status in CONNECTED_STATUSES and not record.get("first_seen_connected_at"):
            record["first_seen_connected_at"] = status_date

        previous = record.get("status_history", [])[-1] if record.get("status_history") else None
        event = {
            "observed_at": harvest_at,
            "source_correct_as_of": project.get("source_correct_as_of"),
            "status": status,
            "capacity_mw": project.get("capacity_mw"),
            "technology": project.get("technology"),
            "source_key": project.get("source_key"),
        }

        if not previous or any(previous.get(k) != event.get(k) for k in ("status", "capacity_mw", "technology", "source_key")):
            record.setdefault("status_history", []).append(event)

    output = {
        "meta": {
            "generated_at": generated_at,
            "builder": "ops/update_renewable_capacity_history.py",
            "source_capacity_generated_at": capacity.get("meta", {}).get("generated_at"),
            "project_count": len(projects),
            "caveat": "first_seen_connected_at is the first harvest date/status-date where this monitor saw the project as connected or energised, not necessarily the physical commissioning date."
        },
        "projects": dict(sorted(projects.items(), key=lambda item: item[1].get("name") or item[0]))
    }

    HISTORY.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {HISTORY.relative_to(ROOT)} with {len(projects)} project histories")


if __name__ == "__main__":
    main()
