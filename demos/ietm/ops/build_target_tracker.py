#!/usr/bin/env python3
"""
Builds the Ireland Energy Monitor target-drift layer.

This turns official annual RES-E values into an accountability signal:
- latest official renewable electricity share
- 2030 benchmark
- gap to target
- required annual gain
- observed recent annual gain
- status: on / risk / off

Source values are currently embedded from SEAI renewables statistics.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUT = SOURCE / "target_tracker.json"

SOURCE_URL = "https://www.seai.ie/data-and-insights/seai-statistics/renewables"
SOURCE_NAME = "SEAI Renewables statistics"

ACTUAL_RES_E = [
    {"year": 2020, "actual": 39.1},
    {"year": 2021, "actual": 37.7},
    {"year": 2022, "actual": 37.4},
    {"year": 2023, "actual": 40.4},
    {"year": 2024, "actual": 41.3},
]

TARGET_YEAR = 2030
TARGET_VALUE = 80.0
BASELINE_YEAR = 2020
BASELINE_VALUE = 39.1


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def linear_target(year: int) -> float:
    if year <= BASELINE_YEAR:
        return BASELINE_VALUE
    if year >= TARGET_YEAR:
        return TARGET_VALUE

    span = TARGET_YEAR - BASELINE_YEAR
    progress = year - BASELINE_YEAR
    return BASELINE_VALUE + ((TARGET_VALUE - BASELINE_VALUE) * progress / span)


def status_from_rates(required_rate: float, recent_rate: float) -> tuple[str, str]:
    if recent_rate >= required_rate:
        return "on", "On track"
    if recent_rate >= required_rate * 0.5:
        return "risk", "At risk"
    return "off", "Off track"


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)

    actual = sorted(ACTUAL_RES_E, key=lambda row: row["year"])
    latest = actual[-1]
    previous = actual[-2]

    latest_year = latest["year"]
    latest_value = latest["actual"]

    gap_to_2030 = TARGET_VALUE - latest_value
    years_remaining = TARGET_YEAR - latest_year
    required_annual_gain = gap_to_2030 / years_remaining if years_remaining > 0 else 0

    recent_annual_gain = latest_value - previous["actual"]

    # Also calculate a two-year recovery rate to avoid overreacting to one year.
    two_year_base = next((row for row in actual if row["year"] == latest_year - 2), None)
    if two_year_base:
        recent_two_year_gain = (latest_value - two_year_base["actual"]) / 2
    else:
        recent_two_year_gain = recent_annual_gain

    status, status_label = status_from_rates(required_annual_gain, recent_two_year_gain)

    target_trajectory = []
    for year in range(BASELINE_YEAR, TARGET_YEAR + 1):
        actual_row = next((row for row in actual if row["year"] == year), None)
        target_trajectory.append({
            "year": year,
            "actual": actual_row["actual"] if actual_row else None,
            "target": round(linear_target(year), 1),
        })

    target_drift = {
        "metric": "Renewable electricity share",
        "latest_year": latest_year,
        "latest_value": latest_value,
        "target_year": TARGET_YEAR,
        "target_value": TARGET_VALUE,
        "gap_to_target_pp": round(gap_to_2030, 1),
        "years_remaining": years_remaining,
        "required_annual_gain_pp": round(required_annual_gain, 2),
        "recent_annual_gain_pp": round(recent_annual_gain, 2),
        "recent_two_year_gain_pp_per_year": round(recent_two_year_gain, 2),
        "status": status,
        "status_label": status_label,
        "interpretation": (
            f"Ireland reached {latest_value:.1f}% renewable electricity in {latest_year}. "
            f"To reach {TARGET_VALUE:.0f}% by {TARGET_YEAR}, the remaining gap is "
            f"{gap_to_2030:.1f} percentage points, requiring about "
            f"{required_annual_gain:.2f} percentage points per year from {latest_year}."
        ),
        "source": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "caveat": (
            "This is an annual official RES-E indicator. It is not the same as the live "
            "quarter-hourly electricity mix shown in the Energy Now section."
        ),
    }

    payload = {
        "target_drift": target_drift,
        "target_trajectory": target_trajectory,
        "source_status": {
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "harvested_at": now_iso(),
            "mode": "official-static-snapshot",
            "caveat": "Embedded official annual values; automate extraction later if source format remains stable.",
        },
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
