#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "data" / "monitor.json"
SOURCE_ELECTRICITY = ROOT / "data" / "source" / "electricity.json"

DEMAND_BALANCE_TOLERANCE_MW = 300.0
INTERCONNECTION_TOLERANCE_MW = 20.0


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def num(value):
    try:
        if value is None:
            return None
        value = float(value)
        if math.isfinite(value):
            return value
    except Exception:
        pass
    return None


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def round2(value):
    value = num(value)
    return round(value, 2) if value is not None else None


def normalise_electricity(e: dict) -> dict:
    e = dict(e)

    generation_mw = num(e.get("generation_mw"))
    demand_mw = num(e.get("demand_mw"))

    raw_wind = clamp(num(e.get("wind_percent")) or 0.0)
    raw_solar = clamp(num(e.get("solar_percent")) or 0.0)

    raw_renewables = num(e.get("renewables_percent"))
    if raw_renewables is None:
        renewables = round(clamp(raw_wind + raw_solar), 2)
    else:
        renewables = round(clamp(raw_renewables), 2)

    # Keep wind and solar as children of renewable generation.
    # Some live source intervals can report wind + solar above the renewable
    # total, usually because public feed values are not perfectly synchronous
    # or not using the same denominator. For the public generation-mix model,
    # preserve the renewable total and scale the child components into it.
    component_sum = raw_wind + raw_solar
    mix_reconciled = False

    if component_sum > renewables and component_sum > 0:
        scale = renewables / component_sum
        wind = round(clamp(raw_wind * scale), 2)
        solar = round(max(0.0, renewables - wind), 2)
        other_renewables = 0.0
        mix_reconciled = True
    else:
        wind = round(raw_wind, 2)
        solar = round(raw_solar, 2)
        other_renewables = round(max(0.0, renewables - wind - solar), 2)

    # Rebuild the parent total from its children after rounding. This keeps the
    # downstream contract exact: wind + solar + other renewables = renewables.
    renewables = round(wind + solar + other_renewables, 2)
    thermal_other = round(max(0.0, 100.0 - renewables), 2)

    e["wind_percent"] = wind
    e["solar_percent"] = solar
    e["renewables_percent"] = renewables
    e["other_renewables_percent"] = other_renewables
    e["thermal_other_percent"] = thermal_other

    # Legacy aliases: older frontend sections and history code may still read
    # residual_percent / gas_percent. Keep them aligned with the canonical
    # generation-accounting value so visible tiles cannot diverge.
    e["residual_percent"] = thermal_other
    e["gas_percent"] = thermal_other
    e["gas_is_residual_proxy"] = True

    if mix_reconciled:
        e["generation_mix_reconciliation"] = {
            "mode": "scaled_children_to_renewable_total",
            "reason": "Source wind plus solar exceeded renewable total for this interval.",
            "raw_wind_percent": round2(raw_wind),
            "raw_solar_percent": round2(raw_solar),
            "raw_renewables_percent": round2(raw_renewables),
        }
    else:
        e.pop("generation_mix_reconciliation", None)

    e["generation_mix_percent"] = {
        "wind": wind,
        "solar": solar,
        "other_renewables": other_renewables,
        "thermal_other": thermal_other,
        "sum": round2(wind + solar + other_renewables + thermal_other),
    }

    net_import_percent = num(e.get("net_import_percent"))
    if net_import_percent is None:
        net_import_percent = num(e.get("interconnection_percent"))

    if generation_mw is not None and net_import_percent is not None:
        interconnection_mw = generation_mw * net_import_percent / 100.0

        e["net_import_percent"] = round2(net_import_percent)
        e["interconnection_percent"] = round2(net_import_percent)
        e["interconnection_mw"] = round(interconnection_mw)
        e["imports_mw"] = round(max(interconnection_mw, 0.0))
        e["exports_mw"] = round(max(-interconnection_mw, 0.0))
        e["imports_percent"] = round2(max(net_import_percent, 0.0))
        e["exports_percent"] = round2(max(-net_import_percent, 0.0))
        e["interconnection_direction"] = (
            "exporting" if interconnection_mw < -0.5
            else "importing" if interconnection_mw > 0.5
            else "near balanced"
        )
        e["interconnection_basis"] = "smartgrid_visible_generation_overview_net_import_percent"

    interconnection_mw = num(e.get("interconnection_mw"))

    if demand_mw is not None and generation_mw is not None and interconnection_mw is not None:
        expected_demand_mw = generation_mw + interconnection_mw
        gap_mw = demand_mw - expected_demand_mw
        coherent = abs(gap_mw) <= DEMAND_BALANCE_TOLERANCE_MW

        e["demand_balance_expected_mw"] = round(expected_demand_mw)
        e["demand_balance_gap_mw"] = round(gap_mw)
        e["demand_balance_tolerance_mw"] = round(DEMAND_BALANCE_TOLERANCE_MW)
        e["demand_balance_status"] = "coherent" if coherent else "withheld_balance_mismatch"
        e["show_demand_card"] = bool(coherent)
    else:
        e["demand_balance_expected_mw"] = None
        e["demand_balance_gap_mw"] = None
        e["demand_balance_tolerance_mw"] = round(DEMAND_BALANCE_TOLERANCE_MW)
        e["demand_balance_status"] = "missing_required_fields"
        e["show_demand_card"] = False

    e["normalised_at"] = now_iso()
    e["normalisation_version"] = "current-electricity-v1"

    return e


def patch_file(path: Path) -> None:
    data = read_json(path)
    e = data.setdefault("electricity_now", {})
    data["electricity_now"] = normalise_electricity(e)

    data.setdefault("source_status", {})
    data["source_status"]["current_electricity_normalisation"] = {
        "source": "Derived from final electricity_now fields",
        "mode": "post-build-normalisation",
        "generated_at": now_iso(),
        "caveat": (
            "Generation mix is normalised so wind + solar + other renewables + thermal/other = 100. "
            "Interconnection MW is derived from visible SmartGrid net-import percentage and generation. "
            "Demand is withheld from top accounting cards when it fails the generation + net-flow balance check."
        ),
    }

    write_json(path, data)


def main() -> int:
    for path in [SOURCE_ELECTRICITY, MONITOR]:
        if path.exists():
            patch_file(path)
            print(f"Normalised {path}")
        else:
            print(f"Skipped missing file: {path}")

    e = read_json(MONITOR).get("electricity_now", {})
    print("\nNormalised current electricity:")
    for key in [
        "generation_mw",
        "demand_mw",
        "renewables_percent",
        "wind_percent",
        "solar_percent",
        "other_renewables_percent",
        "thermal_other_percent",
        "net_import_percent",
        "interconnection_mw",
        "demand_balance_gap_mw",
        "demand_balance_status",
        "show_demand_card",
    ]:
        print(f"{key}: {e.get(key)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
