from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OBS_PATH = DATA / "recent-observations.json"
VALIDATION_PATH = DATA / "recent-observations-validation.json"

ALLOWED_STATUSES = {"pass", "warning", "missing_api_key"}

REQUIRED_ITEM_FIELDS = [
    "species_code",
    "common_name",
    "scientific_name",
    "country",
    "region",
    "observation_date",
    "lat",
    "lng",
    "source",
    "freshness",
]


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def main() -> None:
    if not OBS_PATH.exists():
        raise SystemExit(f"Missing {OBS_PATH}")

    payload = load_json(OBS_PATH)
    warnings: list[str] = []

    status = payload.get("status")
    if status not in ALLOWED_STATUSES:
        warnings.append(f"Unexpected status: {status}")

    items = payload.get("items")
    if not isinstance(items, list):
        raise SystemExit("recent-observations.json items must be a list.")

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            warnings.append(f"Item {index} is not an object.")
            continue

        missing = [field for field in REQUIRED_ITEM_FIELDS if field not in item]
        if missing:
            warnings.append(f"Item {index} missing fields: {missing}")

        if item.get("source") != "eBird":
            warnings.append(f"Item {index} has unexpected source: {item.get('source')}")

    validation = {
        "status": "pass" if not warnings else "warning",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "scope": "recent_observations",
        "provider": payload.get("provider"),
        "source_status": status,
        "item_count": len(items),
        "warnings": warnings,
    }

    VALIDATION_PATH.write_text(
        json.dumps(validation, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Recent-observations validation: {validation['status']}")
    for warning in warnings:
        print(f"Warning: {warning}")


if __name__ == "__main__":
    main()
