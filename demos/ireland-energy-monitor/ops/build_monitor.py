#!/usr/bin/env python3
"""
Builds data/monitor.json from modular source JSON files.

This is the first proper data-product layer:
- source JSON files are kept separate
- the public app reads one stable monitor.json
- later harvesters can replace any source file without changing the front end
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "data" / "source"
HISTORY_DIR = ROOT / "data" / "history"
OUT = ROOT / "data" / "monitor.json"


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        print(f"WARNING: missing {path.relative_to(ROOT)}; using default")
        return default
    return json.loads(path.read_text())


def main() -> None:
    electricity = read_json(SOURCE_DIR / "electricity.json", {})
    truth = read_json(SOURCE_DIR / "truth_meter.json", {})
    prices = read_json(SOURCE_DIR / "prices.json", {})
    counties = read_json(SOURCE_DIR / "counties.json", {})
    target_tracker = read_json(SOURCE_DIR / "target_tracker.json", {})
    county_hosting = read_json(SOURCE_DIR / "county_hosting.json", {})
    metadata = read_json(SOURCE_DIR / "metadata.json", {})
    daily_history = read_json(HISTORY_DIR / "daily.json", {})

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    source_registry = [
        {
            "name": "EirGrid electricity",
            "status": electricity.get("source_status", {}),
        },
        {
            "name": "SEAI prices",
            "status": prices.get("source_status", {}),
        },
        {
            "name": "Target drift",
            "status": target_tracker.get("source_status", {}),
        },
        {
            "name": "County hosting",
            "status": county_hosting.get("source_status", {}),
        },
    ]

    monitor = {
        "source_registry": source_registry,
        "daily_history": daily_history.get("daily", []),
        "daily_history_meta": daily_history.get("meta", {}),
        "meta": {
            "project": metadata.get("project", "Ireland Energy Monitor"),
            "generated_at": generated_at,
            "timezone": metadata.get("timezone", "Europe/Dublin"),
            "mode": metadata.get("mode", "Generated static dataset"),
            "confidence": metadata.get("confidence", "Medium"),
            "status": metadata.get(
                "status",
                "Generated dataset; live harvesters pending"
            ),
            "sources": metadata.get("sources", []),
            "build": {
                "builder": "ops/build_monitor.py",
                "schema_version": "0.2.0"
            }
        },
        "electricity_now": electricity.get("electricity_now", {}),
        "fuel_mix_24h": electricity.get("fuel_mix_24h", []),
        "daily_story": electricity.get("daily_story", {}),
        "truth_meter": truth.get("truth_meter", []),
        "target_drift": target_tracker.get("target_drift", {}),
        "target_trajectory": target_tracker.get("target_trajectory", truth.get("target_trajectory", [])),
        "prices": prices.get("prices", []),
        "gas": electricity.get("gas", {}),
        "source_status": electricity.get("source_status", {}),
        "county_hosting": county_hosting.get("county_hosting", {}),
        "counties": county_hosting.get("counties", counties.get("counties", []))
    }

    OUT.write_text(json.dumps(monitor, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
