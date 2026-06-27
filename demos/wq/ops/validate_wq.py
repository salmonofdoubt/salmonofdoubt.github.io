#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "latest.json"

REQUIRED_TOP = {"version", "generated_at_utc", "summary", "sources", "records", "analysis"}
REQUIRED_RECORD = {"id", "source", "type", "name", "freshness", "parameters"}


def fail(message: str) -> int:
    print(f"Validation failed: {message}", file=sys.stderr)
    return 1


def main() -> int:
    if not DATA.exists():
        return fail(f"{DATA} does not exist")

    payload = json.loads(DATA.read_text(encoding="utf-8"))

    missing = REQUIRED_TOP - set(payload)
    if missing:
        return fail(f"missing top-level keys: {sorted(missing)}")

    if not isinstance(payload["sources"], list):
        return fail("sources must be a list")

    if not isinstance(payload["records"], list):
        return fail("records must be a list")

    ids = set()
    for idx, record in enumerate(payload["records"]):
        if not isinstance(record, dict):
            return fail(f"record {idx} is not an object")

        missing_record = REQUIRED_RECORD - set(record)
        if missing_record:
            return fail(f"record {idx} missing keys: {sorted(missing_record)}")

        if record["id"] in ids:
            return fail(f"duplicate record id: {record['id']}")

        ids.add(record["id"])

        if not isinstance(record["parameters"], list):
            return fail(f"record {record['id']} parameters is not a list")

    print(f"Validated {len(payload['records'])} records from {len(payload['sources'])} sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
