#!/usr/bin/env python3
"""
Validates data/monitor.json before GitHub Actions publishes it.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "data" / "monitor.json"


REQUIRED_TOP_LEVEL = [
    "source_registry",
    "meta",
    "electricity_now",
    "fuel_mix_24h",
    "daily_story",
    "truth_meter",
    "target_drift",
    "target_trajectory",
    "prices",
    "gas",
    "counties"
]

REQUIRED_ELECTRICITY = [
    "demand_mw",
    "renewables_percent",
    "wind_percent",
    "solar_percent",
    "gas_percent",
    "imports_percent",
    "co2_g_per_kwh"
]


def fail(message: str) -> None:
    print(f"VALIDATION FAILED: {message}")
    sys.exit(1)


def assert_percent(value, label: str) -> None:
    if not isinstance(value, (int, float)):
        fail(f"{label} must be numeric")
    if value < 0 or value > 100:
        fail(f"{label} must be between 0 and 100")


def main() -> None:
    if not MONITOR.exists():
        fail("data/monitor.json does not exist")

    data = json.loads(MONITOR.read_text())

    for key in REQUIRED_TOP_LEVEL:
        if key not in data:
            fail(f"missing top-level key: {key}")

    if not isinstance(data["source_registry"], list) or not data["source_registry"]:
        fail("source_registry must be a non-empty list")

    meta = data["meta"]
    if not meta.get("generated_at"):
        fail("meta.generated_at is missing")

    electricity = data["electricity_now"]
    for key in REQUIRED_ELECTRICITY:
        if key not in electricity:
            fail(f"electricity_now.{key} missing")

    assert_percent(electricity["renewables_percent"], "renewables_percent")
    assert_percent(electricity["wind_percent"], "wind_percent")
    assert_percent(electricity["solar_percent"], "solar_percent")
    assert_percent(electricity["gas_percent"], "gas_percent")
    assert_percent(electricity["imports_percent"], "imports_percent")

    if not isinstance(data["fuel_mix_24h"], list) or not data["fuel_mix_24h"]:
        fail("fuel_mix_24h must be a non-empty list")

    fuel_sum = sum(float(item.get("percent", 0)) for item in data["fuel_mix_24h"])
    if fuel_sum < 95 or fuel_sum > 105:
        fail(f"fuel_mix_24h percentages should sum close to 100; got {fuel_sum}")

    if not isinstance(data["truth_meter"], list) or len(data["truth_meter"]) < 3:
        fail("truth_meter must contain at least three modules")

    allowed_status = {"on", "risk", "off"}
    for item in data["truth_meter"]:
        if item.get("status") not in allowed_status:
            fail(f"invalid truth_meter status: {item.get('status')}")

    if not isinstance(data["target_drift"], dict) or not data["target_drift"]:
        fail("target_drift must be a non-empty object")

    required_drift = [
        "latest_year",
        "latest_value",
        "target_year",
        "target_value",
        "gap_to_target_pp",
        "required_annual_gain_pp",
        "status",
        "status_label"
    ]
    for key in required_drift:
        if key not in data["target_drift"]:
            fail(f"target_drift.{key} missing")

    if not isinstance(data["target_trajectory"], list) or len(data["target_trajectory"]) < 2:
        fail("target_trajectory must contain at least two points")

    if not isinstance(data["prices"], list):
        fail("prices must be a list")

    if not isinstance(data["counties"], list):
        fail("counties must be a list")

    print("Validation passed")


if __name__ == "__main__":
    main()
