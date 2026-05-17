#!/usr/bin/env python3
"""
Builds the Ireland Energy Monitor target-drift layer.

This turns official annual RES-E values into an accountability signal:
- latest official renewable electricity share
- 2030 benchmark
- gap to target
- required annual gain
- observed recent annual gain
- demand-pressure scenarios
- arriving-renewables supply-correction scenarios

Source values are currently embedded from SEAI renewables statistics. Scenario
inputs are kept in JSON files so assumptions are visible and editable.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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
BASELINE_DEMAND_TWH = 31.682
HOURS_PER_YEAR = 8760

SCENARIOS = ("low", "central", "high")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        print(f"WARNING: missing {path.relative_to(ROOT)}; using default")
        return default
    return json.loads(path.read_text())


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


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


def mw_to_twh_per_year(mw: float, capacity_factor: float) -> float:
    return mw * capacity_factor * HOURS_PER_YEAR / 1_000_000


def profile_share(profile: dict[str, Any], year: int) -> float:
    return as_float(profile.get(str(year)), 0.0)


def cumulative_profile_share(profile: dict[str, Any], year: int) -> float:
    return sum(profile_share(profile, y) for y in range(BASELINE_YEAR + 1, year + 1))


def expected_supply_uplift_twh(
    capacity: dict[str, Any],
    assumptions: dict[str, Any],
    scenario: str,
    year: int,
) -> tuple[float, dict[str, float]]:
    """Return cumulative expected annual TWh from contracted/support-awarded pipeline by year."""
    capacity_factors = assumptions.get("capacity_factor", {}) or {}
    delivery_conf = assumptions.get("delivery_confidence", {}) or {}
    profiles = assumptions.get("delivery_profile", {}) or {}
    excluded = set(assumptions.get("generation_exclusions", []) or [])

    by_technology: dict[str, float] = {}
    total_twh = 0.0

    for project in capacity.get("projects", []) or []:
        status = str(project.get("status") or "")
        tech = str(project.get("technology") or "unknown")
        if tech in excluded:
            continue
        if status not in {"contracted", "awarded_support"}:
            continue

        mw = as_float(project.get("capacity_mw"), 0.0)
        cf = as_float(capacity_factors.get(tech), as_float(capacity_factors.get("default"), 0.0))
        if mw <= 0 or cf <= 0:
            continue

        status_conf = delivery_conf.get(status, {})
        confidence = as_float(status_conf.get(scenario), 0.0)
        profile = profiles.get(tech) or profiles.get("default", {})
        delivered_share = min(1.0, cumulative_profile_share(profile, year))

        twh = mw_to_twh_per_year(mw, cf) * confidence * delivered_share
        if twh <= 0:
            continue

        total_twh += twh
        by_technology[tech] = by_technology.get(tech, 0.0) + twh

    return total_twh, by_technology


def connected_supply_uplift_twh(
    capacity: dict[str, Any],
    history: dict[str, Any],
    assumptions: dict[str, Any],
    year: int,
    baseline_year: int,
) -> tuple[float, dict[str, float]]:
    """Return observed annual TWh from projects first seen connected after baseline year."""
    capacity_factors = assumptions.get("capacity_factor", {}) or {}
    excluded = set(assumptions.get("generation_exclusions", []) or [])
    projects = history.get("projects", {}) or {}

    total_twh = 0.0
    by_technology: dict[str, float] = {}

    for record in projects.values():
        latest = record.get("latest", {}) or {}
        tech = str(latest.get("technology") or record.get("technology") or "unknown")
        if tech in excluded:
            continue

        connected_at = str(record.get("first_seen_connected_at") or "")
        connected_year = None
        for token in connected_at.replace("/", "-").split("-"):
            if token.isdigit() and len(token) == 4:
                connected_year = int(token)
                break
        if connected_year is None:
            try:
                connected_year = int(connected_at[:4])
            except Exception:
                connected_year = None

        if connected_year is None or connected_year <= baseline_year or connected_year > year:
            continue

        mw = as_float(latest.get("capacity_mw"), 0.0)
        cf = as_float(capacity_factors.get(tech), as_float(capacity_factors.get("default"), 0.0))
        if mw <= 0 or cf <= 0:
            continue

        twh = mw_to_twh_per_year(mw, cf)
        total_twh += twh
        by_technology[tech] = by_technology.get(tech, 0.0) + twh

    return total_twh, by_technology


def demand_scenario_row(demand_forecast: dict[str, Any], year: int, scenario: str) -> dict[str, Any]:
    return (((demand_forecast.get("derived", {}) or {}).get("by_year", {}) or {}).get(str(year), {}) or {}).get(scenario, {}) or {}


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)

    capacity = read_json(SOURCE / "renewable_capacity.json", {})
    history = read_json(SOURCE / "renewable_capacity_history.json", {})
    assumptions = read_json(SOURCE / "renewable_capacity_assumptions.json", {})
    demand_forecast = read_json(SOURCE / "demand_pressure_forecast.json", {})

    actual = sorted(ACTUAL_RES_E, key=lambda row: row["year"])
    latest = actual[-1]
    previous = actual[-2]

    latest_year = latest["year"]
    latest_value = latest["actual"]

    gap_to_2030 = TARGET_VALUE - latest_value
    years_remaining = TARGET_YEAR - latest_year
    required_annual_gain = gap_to_2030 / years_remaining if years_remaining > 0 else 0

    recent_annual_gain = latest_value - previous["actual"]

    two_year_base = next((row for row in actual if row["year"] == latest_year - 2), None)
    if two_year_base:
        recent_two_year_gain = (latest_value - two_year_base["actual"]) / 2
    else:
        recent_two_year_gain = recent_annual_gain

    status, status_label = status_from_rates(required_annual_gain, recent_two_year_gain)

    baseline_renewable_twh = BASELINE_DEMAND_TWH * latest_value / 100

    target_trajectory = []
    for year in range(BASELINE_YEAR, TARGET_YEAR + 1):
        actual_row = next((row for row in actual if row["year"] == year), None)

        recent_pace_value = latest_value + recent_two_year_gain * max(0, year - latest_year)
        recent_pace_value = min(100.0, max(0.0, recent_pace_value))

        row: dict[str, Any] = {
            "year": year,
            "actual": actual_row["actual"] if actual_row else None,
            "target": round(linear_target(year), 1),
            "recent_pace": round(recent_pace_value, 1) if year >= latest_year else None,
        }

        for scenario in SCENARIOS:
            demand_row = demand_scenario_row(demand_forecast, year, scenario)
            total_demand_twh = as_float(demand_row.get("total_system_demand_twh_per_year"), BASELINE_DEMAND_TWH)
            demand_burden_pp = as_float(demand_row.get("demand_adjusted_burden_pp"), 0.0)

            expected_twh, expected_by_tech = expected_supply_uplift_twh(capacity, assumptions, scenario, year)
            confirmed_twh, confirmed_by_tech = connected_supply_uplift_twh(capacity, history, assumptions, year, latest_year)
            supply_twh = expected_twh + confirmed_twh
            supply_uplift_pp = (supply_twh / total_demand_twh * 100) if total_demand_twh > 0 else 0.0

            demand_adjusted = max(0.0, min(100.0, recent_pace_value - demand_burden_pp))
            supply_corrected = max(0.0, min(100.0, demand_adjusted + supply_uplift_pp))

            row[f"demand_{scenario}"] = round(demand_adjusted, 1)
            row[f"supply_corrected_{scenario}"] = round(supply_corrected, 1)
            row[f"arriving_supply_uplift_pp_{scenario}"] = round(supply_uplift_pp, 1)
            row[f"arriving_supply_twh_{scenario}"] = round(supply_twh, 3)
            row[f"expected_pipeline_twh_{scenario}"] = round(expected_twh, 3)
            row[f"confirmed_connected_twh_{scenario}"] = round(confirmed_twh, 3)
            row[f"expected_pipeline_by_technology_twh_{scenario}"] = {
                k: round(v, 3) for k, v in sorted(expected_by_tech.items())
            }
            row[f"confirmed_connected_by_technology_twh_{scenario}"] = {
                k: round(v, 3) for k, v in sorted(confirmed_by_tech.items())
            }

        target_trajectory.append(row)

    scenario_2030 = next(row for row in target_trajectory if row["year"] == TARGET_YEAR)

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

    arriving_renewables = {
        "title": "Arriving renewables supply correction",
        "baseline_year": latest_year,
        "baseline_res_e_percent": latest_value,
        "baseline_demand_twh": BASELINE_DEMAND_TWH,
        "baseline_renewable_twh": round(baseline_renewable_twh, 3),
        "target_year": TARGET_YEAR,
        "scenarios_2030": {
            scenario: {
                "demand_adjusted_res_e_percent": scenario_2030.get(f"demand_{scenario}"),
                "supply_corrected_res_e_percent": scenario_2030.get(f"supply_corrected_{scenario}"),
                "arriving_supply_uplift_pp": scenario_2030.get(f"arriving_supply_uplift_pp_{scenario}"),
                "arriving_supply_twh": scenario_2030.get(f"arriving_supply_twh_{scenario}"),
                "expected_pipeline_twh": scenario_2030.get(f"expected_pipeline_twh_{scenario}"),
                "confirmed_connected_twh": scenario_2030.get(f"confirmed_connected_twh_{scenario}"),
            }
            for scenario in SCENARIOS
        },
        "assumptions_source": "data/source/renewable_capacity_assumptions.json",
        "capacity_source": "data/source/renewable_capacity.json",
        "history_source": "data/source/renewable_capacity_history.json",
        "caveat": (
            "Supply-corrected trajectories are scenario outputs. Confirmed additions use first-seen connected history; "
            "expected additions use contracted/support-awarded capacity, technology capacity factors, delivery profiles and delivery-confidence assumptions."
        ),
    }

    payload = {
        "target_drift": target_drift,
        "target_trajectory": target_trajectory,
        "arriving_renewables": arriving_renewables,
        "source_status": {
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "harvested_at": now_iso(),
            "mode": "official-static-snapshot-plus-scenarios",
            "caveat": "Embedded official annual values; demand and arriving-renewables layers are transparent scenario models.",
        },
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
