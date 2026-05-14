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


def as_float(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def fmt_num(value: Any, digits: int = 0, suffix: str = "") -> str:
    n = as_float(value)
    if n is None:
        return "n/a"
    return f"{n:.{digits}f}{suffix}"


def truth_status_from_residual(value: float | None) -> str:
    if value is None:
        return "risk"
    if value <= 20:
        return "on"
    if value <= 35:
        return "risk"
    return "off"


def truth_status_from_co2(value: float | None) -> str:
    if value is None:
        return "risk"
    if value <= 100:
        return "on"
    if value <= 250:
        return "risk"
    return "off"


def truth_status_from_affordability(elec_c: float | None, gas_c: float | None) -> str:
    if elec_c is None and gas_c is None:
        return "risk"
    if (elec_c is not None and elec_c > 35) or (gas_c is not None and gas_c > 14):
        return "off"
    if (elec_c is not None and elec_c > 28) or (gas_c is not None and gas_c > 10):
        return "risk"
    return "on"


def status_label(status: str) -> str:
    return {
        "on": "On track",
        "risk": "At risk",
        "off": "Off track",
    }.get(status, "At risk")


def first_price_value(prices: list[dict], label: str) -> float | None:
    for item in prices:
        if item.get("label") == label:
            return as_float(item.get("ireland_c_per_kwh"))
    return None


def build_truth_meter(
    electricity: dict,
    target_tracker: dict,
    prices_source: dict,
    static_truth: dict,
) -> dict:
    e = electricity.get("electricity_now", {}) or {}
    drift = target_tracker.get("target_drift", {}) or {}
    prices = prices_source.get("prices", []) or []
    static_items = static_truth.get("truth_meter", []) or []

    latest_res_e = as_float(drift.get("latest_value"))
    target_res_e = as_float(drift.get("target_value"), 80)
    gap_pp = as_float(drift.get("gap_to_target_pp"))
    required_gain = as_float(drift.get("required_annual_gain_pp"))
    recent_gain = as_float(drift.get("recent_two_year_gain_pp_per_year"))
    drift_status = drift.get("status") or "risk"

    residual = as_float(e.get("residual_percent", e.get("gas_percent")))
    co2 = as_float(e.get("co2_g_per_kwh"))
    co2_available = bool(e.get("co2_available")) and co2 is not None and co2 > 0

    elec_price = first_price_value(prices, "Household electricity")
    gas_price = first_price_value(prices, "Household gas")

    residual_status = truth_status_from_residual(residual)
    co2_status = truth_status_from_co2(co2 if co2_available else None)
    affordability_status = truth_status_from_affordability(elec_price, gas_price)

    static_by_name = {item.get("name"): item for item in static_items}

    items = [
        {
            "name": "Renewable electricity",
            "status": drift_status,
            "status_label": status_label(drift_status),
            "reading": "Official RES-E share",
            "value": fmt_num(latest_res_e, 1, "%"),
            "rule": (
                f"2030 benchmark is {fmt_num(target_res_e, 0, '%')}; "
                f"current gap is {fmt_num(gap_pp, 1, ' pp')}."
            ),
            "why": "This is the core 2030 electricity-transition indicator.",
            "basis": "Official annual",
            "confidence": "High",
            "direction": "too slow" if drift_status == "off" else "watch",
            "logic": (
                f"Recent gain is {fmt_num(recent_gain, 2, ' pp/yr')} versus "
                f"{fmt_num(required_gain, 2, ' pp/yr')} required to 2030."
            ),
        },
        {
            "name": "Thermal/other",
            "status": residual_status,
            "status_label": status_label(residual_status),
            "reading": "Unclassified remainder",
            "value": fmt_num(residual, 0, "%"),
            "rule": "On track ≤20%; at risk 20–35%; off track >35%.",
            "why": "High thermal/other means the system still depends on non-wind, non-solar and unidentified supply.",
            "basis": "Computed live proxy",
            "confidence": "Medium",
            "direction": "needs classification",
            "logic": "Calculated as demand not covered by detected wind, solar and net imports. It is not measured gas.",
        },
        {
            "name": "Grid carbon intensity",
            "status": co2_status,
            "status_label": status_label(co2_status),
            "reading": "Latest carbon signal",
            "value": fmt_num(co2, 0, " g/kWh") if co2_available else "n/a",
            "rule": "On track ≤100 g/kWh; at risk 100–250; off track >250.",
            "why": "Carbon intensity indicates how clean the electricity actually is at the point of use.",
            "basis": "Live public dashboard",
            "confidence": "Medium",
            "direction": "variable",
            "logic": "Lower values usually reflect stronger renewable output and/or lower fossil generation.",
        },
        {
            "name": "Energy affordability",
            "status": affordability_status,
            "status_label": status_label(affordability_status),
            "reading": "Household pressure",
            "value": (
                f"{fmt_num(elec_price, 1, ' c/kWh')} elec"
                if elec_price is not None else "n/a"
            ),
            "rule": "At risk if electricity >28 c/kWh or gas >10 c/kWh; off track if materially higher.",
            "why": "The transition remains politically fragile if households experience it mainly as cost pressure.",
            "basis": "Official semi-annual",
            "confidence": "High",
            "direction": "pressured",
            "logic": (
                f"Current household signals: electricity {fmt_num(elec_price, 2, ' c/kWh')}; "
                f"gas {fmt_num(gas_price, 2, ' c/kWh')}."
            ),
        },
        {
            "name": "EV transition",
            "status": static_by_name.get("EV transition", {}).get("status", "on"),
            "status_label": status_label(static_by_name.get("EV transition", {}).get("status", "on")),
            "reading": static_by_name.get("EV transition", {}).get("value", "Rising"),
            "value": static_by_name.get("EV transition", {}).get("value", "Rising"),
            "rule": "On track only if uptake and fleet turnover continue to accelerate.",
            "why": "Transport electrification determines whether clean electricity can displace oil demand.",
            "basis": "Placeholder proxy",
            "confidence": "Low",
            "direction": "improving",
            "logic": static_by_name.get("EV transition", {}).get(
                "note",
                "EV signal is currently qualitative until a live transport dataset is wired."
            ),
        },
        {
            "name": "Heat transition",
            "status": static_by_name.get("Heat transition", {}).get("status", "risk"),
            "status_label": status_label(static_by_name.get("Heat transition", {}).get("status", "risk")),
            "reading": static_by_name.get("Heat transition", {}).get("value", "Lagging"),
            "value": static_by_name.get("Heat transition", {}).get("value", "Lagging"),
            "rule": "At risk until heat-pump, retrofit and fossil-heating displacement signals are wired.",
            "why": "Heat is harder to decarbonise than electricity and needs its own evidence stream.",
            "basis": "Placeholder proxy",
            "confidence": "Low",
            "direction": "too slow",
            "logic": static_by_name.get("Heat transition", {}).get(
                "note",
                "Heat transition signal is qualitative until a live heat dataset is wired."
            ),
        },
    ]

    counts = {"on": 0, "risk": 0, "off": 0}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1

    if counts["off"] >= 2:
        overall = "off"
    elif counts["off"] >= 1 or counts["risk"] >= 3:
        overall = "risk"
    else:
        overall = "on"

    main_drag = next((item["name"] for item in items if item["status"] == "off"), "None")
    best_signal = next((item["name"] for item in items if item["status"] == "on"), "None")

    return {
        "summary": {
            "overall_status": overall,
            "overall_label": status_label(overall),
            "counts": counts,
            "main_drag": main_drag,
            "best_signal": best_signal,
            "method": "Fixed three-label transition signal: on track, at risk, off track.",
            "caveat": "Signals combine live values, official annual indicators, computed proxies and labelled placeholders. Evidence basis is shown per module."
        },
        "items": items,
    }



def build_method_model(electricity: dict, target_tracker: dict, prices_source: dict, county_hosting: dict) -> dict:
    e = electricity.get("electricity_now", {}) or {}
    drift = target_tracker.get("target_drift", {}) or {}

    interconnection_mw = as_float(e.get("interconnection_mw"))
    if interconnection_mw is None:
        interconnection_mw = as_float(e.get("imports_mw"), 0)

    if interconnection_mw is None or abs(interconnection_mw) < 1:
        direction = "near balanced"
    elif interconnection_mw > 0:
        direction = "importing"
    else:
        direction = "exporting"

    metrics = [
        {
            "key": "demand",
            "label": "Demand",
            "definition": "Current electricity system demand.",
            "value_key": "demand_mw",
            "unit": "MW",
            "denominator": "Not a percentage.",
            "evidence_basis": "Live",
            "confidence": "Medium",
            "caveat": "Parsed from public Smart Grid Dashboard pages where available; spreadsheet fallback otherwise.",
            "accent": "neutral"
        },
        {
            "key": "renewables",
            "label": "Renewables",
            "definition": "Wind plus solar as a share of current demand.",
            "value_key": "renewables_percent",
            "unit": "%",
            "denominator": "Current electricity demand.",
            "evidence_basis": "Computed live proxy",
            "confidence": "Medium",
            "caveat": "This is an operational wind+solar signal, not the official annual RES-E indicator.",
            "accent": "green"
        },
        {
            "key": "wind",
            "label": "Wind",
            "definition": "Wind generation as a share of current demand.",
            "value_key": "wind_percent",
            "unit": "%",
            "denominator": "Current electricity demand.",
            "evidence_basis": "Computed live proxy",
            "confidence": "Medium",
            "caveat": "Weather-driven operational signal; not a policy-progress indicator on its own.",
            "accent": "blue"
        },
        {
            "key": "solar",
            "label": "Solar",
            "definition": "Solar generation as a share of current demand.",
            "value_key": "solar_percent",
            "unit": "%",
            "denominator": "Current electricity demand.",
            "evidence_basis": "Computed live proxy",
            "confidence": "Medium",
            "caveat": "Strongly time-of-day and season dependent.",
            "accent": "yellow"
        },
        {
            "key": "residual",
            "label": "Thermal/other",
            "definition": "Demand not covered by detected wind, solar and net imports.",
            "value_key": "residual_percent",
            "unit": "%",
            "denominator": "Current electricity demand.",
            "evidence_basis": "Computed",
            "confidence": "Medium",
            "caveat": "Thermal/other is computed, not measured gas. It may include gas, hydro, storage, coal/oil or unidentified supply.",
            "accent": "purple"
        },
        {
            "key": "interconnection",
            "label": "Interconnection",
            "definition": "Signed electricity exchange with neighbouring systems.",
            "value_key": "interconnection_mw",
            "unit": "MW",
            "denominator": "Signed MW, not a percentage.",
            "evidence_basis": "Live",
            "confidence": "Medium",
            "caveat": "Positive means importing; negative means exporting. The public card reports direction rather than negative imports.",
            "accent": "orange",
            "direction": direction
        },
        {
            "key": "co2",
            "label": "CO₂ intensity",
            "definition": "Carbon intensity of electricity generation/use signal.",
            "value_key": "co2_g_per_kwh",
            "unit": "g/kWh",
            "denominator": "Electricity consumed/generated per kWh basis.",
            "evidence_basis": "Live",
            "confidence": "Medium",
            "caveat": "Public Smart Grid Dashboard CO₂ signal; method depends on EirGrid published model.",
            "accent": "grey"
        },
        {
            "key": "target_gap",
            "label": "2030 target gap",
            "definition": "Gap between latest official annual RES-E value and the 80% 2030 benchmark.",
            "value_key": "gap_to_target_pp",
            "unit": "pp",
            "denominator": "Percentage-point difference from 80% target.",
            "evidence_basis": "Official annual",
            "confidence": "High",
            "caveat": "Not a live grid value. It changes when official annual RES-E data update.",
            "accent": "red"
        }
    ]

    vocabulary = {
        "reading": "The displayed value or condition.",
        "signal": "A short interpretation of a reading.",
        "verdict": "Formal On track / At risk / Off track judgement. Used only in the Truth Meter.",
        "diagnostic": "Supporting explanation outside the Truth Meter.",
        "evidence_basis": "How current or authoritative the value is: Live, Official annual, Official semi-annual, Computed, Proxy, Placeholder or Unavailable.",
        "gap": "Always qualified: 2030 target gap, path gap, price gap or data gap.",
        "residual_supply": "Unclassified remainder after wind, solar and net imports. Not measured gas.",
        "interconnection": "Positive = importing, negative = exporting, near zero = near balanced."
    }

    sections = [
        {
            "section": "Today at a glance",
            "purpose": "Operational pulse: what the electricity system is doing now.",
            "method_note": "Uses live and computed operational signals. Thirty-day lines are daily snapshots; estimated warm-start rows are visual scaffolding only."
        },
        {
            "section": "Transition Truth Meter",
            "purpose": "Formal interpretation layer.",
            "method_note": "Only this section uses formal verdicts: On track, At risk and Off track."
        },
        {
            "section": "2030 trajectory",
            "purpose": "Official annual policy path.",
            "method_note": "Uses annual RES-E progress against the 80% renewable-electricity benchmark."
        },
        {
            "section": "Market and household prices",
            "purpose": "Distinguishes system market signals from household affordability.",
            "method_note": "SEAI household prices are semi-annual official indicators, not live tariffs."
        },
        {
            "section": "County hosting",
            "purpose": "Spatial hosting and transition-justice scaffold.",
            "method_note": county_hosting.get("county_hosting", {}).get("caveat", "County hosting method still being wired.")
        }
    ]

    return {
        "title": "Method and definitions",
        "vocabulary": vocabulary,
        "metrics": metrics,
        "sections": sections,
        "interconnection_direction": direction,
        "interconnection_mw": interconnection_mw,
        "target_gap_pp": as_float(drift.get("gap_to_target_pp"))
    }



def main() -> None:
    electricity = read_json(SOURCE_DIR / "electricity.json", {})
    source_model = read_json(SOURCE_DIR / "source_model.json", {})
    truth = read_json(SOURCE_DIR / "truth_meter.json", {})
    prices = read_json(SOURCE_DIR / "prices.json", {})
    market_prices = read_json(SOURCE_DIR / "market_prices.json", {})
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
            "name": "Market prices",
            "status": market_prices.get("meta", {}),
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

    truth_model = build_truth_meter(electricity, target_tracker, prices, truth)
    method_model = build_method_model(electricity, target_tracker, prices, county_hosting)

    monitor = {
        "source_registry": source_registry,
        "daily_history": daily_history.get("daily", []),
        "daily_history_meta": daily_history.get("meta", {}),
        "meta": {
            "project": metadata.get("project", "Ireland Energy Transition Monitor"),
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
        "source_model": source_model,
        "electricity_source_model": source_model.get("electricity", {}),
        "electricity_now": electricity.get("electricity_now", {}),
        "fuel_mix_24h": electricity.get("fuel_mix_24h", []),
        "daily_story": electricity.get("daily_story", {}),
        "truth_meter": truth_model.get("items", []),
        "truth_summary": truth_model.get("summary", {}),
        "method": method_model,
        "electricity_metrics": method_model.get("metrics", []),
        "target_drift": target_tracker.get("target_drift", {}),
        "target_trajectory": target_tracker.get("target_trajectory", truth.get("target_trajectory", [])),
        "prices": prices.get("prices", []),
        "market_prices": market_prices.get("market_prices", []),
        "market_price_meta": market_prices.get("meta", {}),
        "gas": electricity.get("gas", {}),
        "source_status": electricity.get("source_status", {}),
        "county_hosting": county_hosting.get("county_hosting", {}),
        "counties": county_hosting.get("counties", counties.get("counties", []))
    }

    OUT.write_text(json.dumps(monitor, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
