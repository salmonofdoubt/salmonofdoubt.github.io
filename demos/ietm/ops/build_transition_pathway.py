#!/usr/bin/env python3
"""
Build a clean v2 transition pathway data layer for the Ireland Energy Transition Monitor.

This file separates:
1. official annual RES-E history
2. provisional grid-observed renewable cover
3. demand-drag counterfactuals
4. renewable-capacity arrival assumptions
5. chart-ready series

It deliberately does not join live grid snapshots onto official annual RES-E.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
HISTORY = ROOT / "data" / "history"
OUT = SOURCE / "transition_pathway.json"

HOURS_PER_YEAR = 8760
TARGET_YEAR = 2030
TARGET_VALUE = 80.0
GENERATION_TECH = {
    "solar",
    "wind_onshore",
    "wind_offshore",
    "hydro",
    "bioenergy",
    "waste_to_energy",
    "wave",
}
EXCLUDED_AS_GENERATION = {
    "battery_storage",
}

DEFAULT_CAPACITY_FACTOR = {
    "solar": 0.11,
    "wind_onshore": 0.35,
    "wind_offshore": 0.45,
    "hydro": 0.35,
    "bioenergy": 0.75,
    "waste_to_energy": 0.75,
    "wave": 0.30,
    "default": 0.30,
}

DEFAULT_DELIVERY_CONFIDENCE = {
    "contracted": {"low": 0.35, "central": 0.55, "high": 0.75},
    "awarded_support": {"low": 0.55, "central": 0.75, "high": 0.90},
}

DEFAULT_DELIVERY_PROFILE = {
    "solar": {"2026": 0.10, "2027": 0.20, "2028": 0.25, "2029": 0.25, "2030": 0.20},
    "wind_onshore": {"2026": 0.05, "2027": 0.15, "2028": 0.25, "2029": 0.30, "2030": 0.25},
    "hydro": {"2026": 0.10, "2027": 0.20, "2028": 0.25, "2029": 0.25, "2030": 0.20},
    "bioenergy": {"2026": 0.10, "2027": 0.20, "2028": 0.25, "2029": 0.25, "2030": 0.20},
    "waste_to_energy": {"2026": 0.10, "2027": 0.20, "2028": 0.25, "2029": 0.25, "2030": 0.20},
    "wave": {"2026": 0.00, "2027": 0.10, "2028": 0.20, "2029": 0.30, "2030": 0.40},
    "default": {"2026": 0.05, "2027": 0.15, "2028": 0.25, "2029": 0.30, "2030": 0.25},
}

SCENARIOS = ("low", "central", "high")


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def as_float(value: Any, default: float | None = 0.0) -> float | None:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def mw_to_twh_per_year(mw: float, capacity_factor: float) -> float:
    return mw * capacity_factor * HOURS_PER_YEAR / 1_000_000


def pct(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 1)


def get_official_res_e(target_tracker: dict[str, Any]) -> list[dict[str, Any]]:
    rows = target_tracker.get("target_trajectory", []) or []
    official = []
    for row in rows:
        year = row.get("year")
        actual = row.get("actual")
        if year is None or actual is None:
            continue
        official.append({
            "year": int(year),
            "value": round(float(actual), 1),
            "basis": "official_annual_res_e",
            "source": "SEAI annual RES-E series embedded in target tracker",
        })
    return sorted(official, key=lambda item: item["year"])


def build_grid_observed_proxy(daily_history: dict[str, Any], electricity: dict[str, Any]) -> dict[str, Any]:
    daily_rows = daily_history.get("daily", []) or []

    observed_rows = []
    for row in daily_rows:
        value = as_float(row.get("renewables_percent"), None)
        if value is None:
            continue

        observed_rows.append({
            "date": row.get("date"),
            "captured_at": row.get("captured_at"),
            "value": round(value, 2),
            "weight_mw": as_float(row.get("demand_mw"), None),
            "estimated_backfill": bool(row.get("estimated_backfill", False)),
        })

    real_rows = [row for row in observed_rows if not row["estimated_backfill"]]
    weighted_rows = [row for row in real_rows if row["weight_mw"] and row["weight_mw"] > 0]

    if weighted_rows:
        weighted_value = sum(row["value"] * row["weight_mw"] for row in weighted_rows) / sum(row["weight_mw"] for row in weighted_rows)
        method = "demand_weighted_observed_daily_history"
        sample_count = len(weighted_rows)
    elif real_rows:
        weighted_value = sum(row["value"] for row in real_rows) / len(real_rows)
        method = "simple_average_observed_daily_history"
        sample_count = len(real_rows)
    else:
        weighted_value = None
        method = "insufficient_observed_daily_history"
        sample_count = 0

    electricity_now = electricity.get("electricity_now", {}) or {}
    snapshot_value = as_float(electricity_now.get("renewables_percent"), None)

    return {
        "status": "available" if weighted_value is not None else "insufficient",
        "observed_window": {
            "start_date": real_rows[0]["date"] if real_rows else None,
            "end_date": real_rows[-1]["date"] if real_rows else None,
            "value": pct(weighted_value),
            "unit": "%",
            "method": method,
            "sample_count": sample_count,
            "caveat": (
                "Observed grid renewable-cover proxy from local daily history. "
                "This is not official annual RES-E and must not be joined silently to the SEAI series."
            ),
        },
        "latest_snapshot": {
            "datetime": electricity_now.get("electricity_datetime"),
            "value": pct(snapshot_value),
            "unit": "%",
            "basis": "latest_grid_snapshot",
            "source_label": electricity_now.get("source_label"),
            "caveat": (
                "Single live/latest grid snapshot. Useful for current status only; "
                "not an annual RES-E observation and not suitable as a trajectory point."
            ),
        },
        "daily_values": real_rows[-90:],
    }


def get_capacity_factor(assumptions: dict[str, Any], tech: str) -> float:
    factors = assumptions.get("capacity_factor", {}) or {}
    return float(factors.get(tech, factors.get("default", DEFAULT_CAPACITY_FACTOR.get(tech, DEFAULT_CAPACITY_FACTOR["default"]))))


def get_delivery_confidence(assumptions: dict[str, Any], status: str, scenario: str) -> float:
    conf = assumptions.get("delivery_confidence", {}) or {}
    by_status = conf.get(status, DEFAULT_DELIVERY_CONFIDENCE.get(status, {})) or {}
    return float(by_status.get(scenario, DEFAULT_DELIVERY_CONFIDENCE.get(status, {}).get(scenario, 0.0)))


def get_delivery_profile(assumptions: dict[str, Any], tech: str) -> dict[str, float]:
    profiles = assumptions.get("delivery_profile", {}) or {}
    profile = profiles.get(tech) or profiles.get("default") or DEFAULT_DELIVERY_PROFILE.get(tech) or DEFAULT_DELIVERY_PROFILE["default"]
    return {str(k): float(v) for k, v in profile.items()}


def timing_basis_for_project(project: dict[str, Any]) -> tuple[int | None, str]:
    raw = str(project.get("raw_line") or "")
    blob = json.dumps(project, ensure_ascii=False)

    capacity_market = re.findall(r"\bT-[0-9]\s+(20[2-3][0-9])/?([0-9]{2})?\b", raw, flags=re.I)
    if capacity_market:
        years = []
        for y1, y2 in capacity_market:
            years.append(int(y1))
            if y2:
                years.append(int("20" + y2))
        return min(years), "capacity_market_delivery_year_candidate"

    month_year = re.findall(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(20[2-3][0-9])\b", raw, flags=re.I)
    if month_year:
        return max(int(y) for y in month_year), "raw_line_month_year_weak_not_online_date"

    years = re.findall(r"\b(20[2-3][0-9])\b", blob)
    if years:
        return max(int(y) for y in years), "generic_year_weak_not_online_date"

    return None, "no_timing_evidence"


def build_capacity_arrivals(
    capacity: dict[str, Any],
    history: dict[str, Any],
    assumptions: dict[str, Any],
    demand_by_year: dict[int, dict[str, float]],
    latest_official_year: int,
    target_year: int,
) -> dict[str, Any]:
    projects = capacity.get("projects", []) or []
    history_projects = history.get("projects", {}) or {}

    timing_audit = defaultdict(lambda: {"count": 0, "mw": 0.0})
    stock_by_status_tech = defaultdict(float)

    expected_cumulative = {
        scenario: {
            year: {
                "expected_twh": 0.0,
                "expected_by_technology_twh": defaultdict(float),
                "uplift_pp": 0.0,
            }
            for year in range(latest_official_year, target_year + 1)
        }
        for scenario in SCENARIOS
    }

    project_count_by_status = defaultdict(int)

    for project in projects:
        status = str(project.get("status") or "unknown")
        tech = str(project.get("technology") or "unknown")
        mw = as_float(project.get("capacity_mw"), 0.0) or 0.0
        project_count_by_status[status] += 1
        stock_by_status_tech[(status, tech)] += mw

        timing_year, timing_basis = timing_basis_for_project(project)
        key = (status, tech, timing_basis, timing_year or "none")
        timing_audit[key]["count"] += 1
        timing_audit[key]["mw"] += mw

        if status not in {"contracted", "awarded_support"}:
            continue
        if tech in EXCLUDED_AS_GENERATION or tech not in GENERATION_TECH:
            continue
        if mw <= 0:
            continue

        cf = get_capacity_factor(assumptions, tech)
        annual_twh = mw_to_twh_per_year(mw, cf)
        profile = get_delivery_profile(assumptions, tech)

        for scenario in SCENARIOS:
            confidence = get_delivery_confidence(assumptions, status, scenario)
            cumulative_share = 0.0

            for year in range(latest_official_year, target_year + 1):
                cumulative_share += float(profile.get(str(year), 0.0))
                cumulative_share = max(0.0, min(1.0, cumulative_share))

                expected_twh = annual_twh * confidence * cumulative_share
                expected_cumulative[scenario][year]["expected_twh"] += expected_twh
                expected_cumulative[scenario][year]["expected_by_technology_twh"][tech] += expected_twh

    for scenario in SCENARIOS:
        for year, row in expected_cumulative[scenario].items():
            demand_twh = demand_by_year.get(year, {}).get(scenario)
            if demand_twh and demand_twh > 0:
                row["uplift_pp"] = row["expected_twh"] / demand_twh * 100

            row["expected_twh"] = round(row["expected_twh"], 3)
            row["uplift_pp"] = round(row["uplift_pp"], 1)
            row["expected_by_technology_twh"] = {
                k: round(v, 3)
                for k, v in sorted(row["expected_by_technology_twh"].items())
            }

    confirmed_transitions = []
    for record in history_projects.values():
        statuses = [str(item.get("status") or "").lower() for item in record.get("status_history", [])]
        if "connected" in statuses and statuses and statuses[0] != "connected":
            confirmed_transitions.append(record)

    return {
        "basis": "capacity_register_plus_explicit_delivery_assumptions",
        "caveat": (
            "Expected arrivals use contracted/support-awarded capacity, capacity factors, delivery-confidence settings "
            "and explicit delivery profiles. Project raw-line dates are audited but not treated as reliable online dates unless classified separately."
        ),
        "project_count_by_status": dict(sorted(project_count_by_status.items())),
        "stock_by_status_technology_mw": [
            {
                "status": status,
                "technology": tech,
                "capacity_mw": round(mw, 3),
            }
            for (status, tech), mw in sorted(stock_by_status_tech.items())
        ],
        "expected_cumulative_by_year": expected_cumulative,
        "confirmed_transitions": {
            "count": len(confirmed_transitions),
            "caveat": "Confirmed additions require observed status movement in renewable_capacity_history.",
        },
        "timing_audit": [
            {
                "status": status,
                "technology": tech,
                "timing_basis": basis,
                "timing_year": year,
                "count": round(values["count"]),
                "capacity_mw": round(values["mw"], 3),
            }
            for (status, tech, basis, year), values in sorted(timing_audit.items(), key=lambda item: str(item[0]))
        ],
    }


def build_pathway() -> dict[str, Any]:
    target_tracker = read_json(SOURCE / "target_tracker.json", {})
    daily_history = read_json(HISTORY / "daily.json", {})
    electricity = read_json(SOURCE / "electricity.json", {})
    capacity = read_json(SOURCE / "renewable_capacity.json", {})
    history = read_json(SOURCE / "renewable_capacity_history.json", {})
    assumptions = read_json(SOURCE / "renewable_capacity_assumptions.json", {})

    official = get_official_res_e(target_tracker)
    if not official:
        raise SystemExit("No official RES-E series found in target_tracker.json")

    latest_official = official[-1]
    latest_year = latest_official["year"]
    latest_value = latest_official["value"]

    rows = target_tracker.get("target_trajectory", []) or []
    demand_by_year: dict[int, dict[str, float]] = {}
    chart_rows = {}

    for row in rows:
        year = int(row.get("year"))
        demand_by_year[year] = {}
        chart_rows[year] = row
        for scenario in SCENARIOS:
            demand_twh = as_float(row.get(f"total_system_demand_twh_{scenario}"), None)
            # Existing target_tracker may not expose demand TWh. Fall back to baseline demand embedded in build_target_tracker.
            if demand_twh is None:
                demand_twh = 31.682
            demand_by_year[year][scenario] = float(demand_twh)

    grid_proxy = build_grid_observed_proxy(daily_history, electricity)
    capacity_arrivals = build_capacity_arrivals(
        capacity=capacity,
        history=history,
        assumptions=assumptions,
        demand_by_year=demand_by_year,
        latest_official_year=latest_year,
        target_year=TARGET_YEAR,
    )

    benchmark = [
        {"year": official[0]["year"], "value": TARGET_VALUE},
        {"year": TARGET_YEAR, "value": TARGET_VALUE},
    ]

    central_drag = []
    supply_corrected_central = []

    for year in range(latest_year, TARGET_YEAR + 1):
        row = chart_rows.get(year, {})
        drag_value = as_float(row.get("demand_central"), None)
        if year == latest_year:
            drag_value = latest_value
        if drag_value is not None:
            central_drag.append({
                "year": year,
                "value": round(float(drag_value), 1),
                "basis": "central_unmet_demand_drag",
            })

        uplift = capacity_arrivals["expected_cumulative_by_year"]["central"][year]["uplift_pp"]
        corrected = None if drag_value is None else float(drag_value) + uplift
        if corrected is not None:
            supply_corrected_central.append({
                "year": year,
                "value": round(min(100.0, max(0.0, corrected)), 1),
                "basis": "central_unmet_demand_plus_expected_arrivals",
                "uplift_pp": uplift,
                "timing_basis": "explicit_assumption_profile_not_project_online_dates",
            })

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "schema_version": "transition_pathway_v2",
            "builder": "build_transition_pathway.py",
            "caveat": (
                "This layer separates official annual RES-E, provisional grid-observed evidence, demand-drag scenarios, "
                "and capacity-arrival assumptions. It is intended to replace browser-side modelling in the RES-E panel."
            ),
        },
        "official_res_e_history": {
            "series": official,
            "latest_year": latest_year,
            "latest_value": latest_value,
            "source": target_tracker.get("target_drift", {}).get("source", "SEAI Renewables statistics"),
            "caveat": "Official annual RES-E history. Do not extend with live grid snapshots.",
        },
        "grid_observed_proxy": grid_proxy,
        "capacity_arrivals_timeline": capacity_arrivals,
        "chart_series": {
            "benchmark_80": benchmark,
            "official_res_e": official,
            "central_unmet_demand_drag": central_drag,
            "central_expected_arrivals": supply_corrected_central,
        },
        "chart_contract": {
            "rendering_rule": (
                "The front end should render this file directly. It should not recalculate RES-E, capacity uplift or timing in app.js."
            ),
            "recommended_series": [
                "benchmark_80",
                "official_res_e",
                "central_unmet_demand_drag",
                "central_expected_arrivals",
            ],
            "grid_proxy_rule": (
                "Show grid_observed_proxy as a separate status note or marker only when the label states it is not official annual RES-E."
            ),
        },
    }

    return payload


def main() -> None:
    payload = build_pathway()
    write_json(OUT, payload)
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print("official latest:", payload["official_res_e_history"]["latest_year"], payload["official_res_e_history"]["latest_value"])
    print("grid proxy:", payload["grid_observed_proxy"]["observed_window"])
    print("central 2030:", payload["chart_series"]["central_expected_arrivals"][-1])


if __name__ == "__main__":
    main()
