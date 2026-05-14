#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "data" / "monitor.json"

MIX_TOLERANCE_PP = 1.0
INTERCONNECTION_TOLERANCE_MW = 20.0
DEMAND_BALANCE_TOLERANCE_MW = 300.0


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


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    data = json.loads(MONITOR.read_text())
    e = data.get("electricity_now", {})
    errors: list[str] = []
    warnings: list[str] = []

    generation = num(e.get("generation_mw"))
    renewables = num(e.get("renewables_percent"))
    wind = num(e.get("wind_percent"))
    solar = num(e.get("solar_percent"))
    other = num(e.get("other_renewables_percent"))
    thermal = num(e.get("thermal_other_percent"))
    net_pct = num(e.get("net_import_percent"))
    inter_mw = num(e.get("interconnection_mw"))
    demand = num(e.get("demand_mw"))

    required = {
        "generation_mw": generation,
        "renewables_percent": renewables,
        "wind_percent": wind,
        "solar_percent": solar,
        "other_renewables_percent": other,
        "thermal_other_percent": thermal,
        "net_import_percent": net_pct,
        "interconnection_mw": inter_mw,
    }

    for key, value in required.items():
        if value is None:
            fail(errors, f"Missing or invalid electricity_now.{key}")

    if not errors:
        mix_sum = wind + solar + other + thermal
        renewables_sum = wind + solar + other
        expected_thermal = 100.0 - renewables
        expected_inter_mw = generation * net_pct / 100.0

        if abs(mix_sum - 100.0) > MIX_TOLERANCE_PP:
            fail(errors, f"Generation mix does not sum to 100: {mix_sum:.2f}%")

        if abs(renewables_sum - renewables) > MIX_TOLERANCE_PP:
            fail(
                errors,
                f"Renewables do not reconcile: renewables={renewables:.2f}, "
                f"wind+solar+other={renewables_sum:.2f}",
            )

        if abs(thermal - expected_thermal) > MIX_TOLERANCE_PP:
            fail(
                errors,
                f"Thermal/other is not 100-renewables: thermal={thermal:.2f}, "
                f"expected={expected_thermal:.2f}",
            )

        if abs(inter_mw - expected_inter_mw) > INTERCONNECTION_TOLERANCE_MW:
            fail(
                errors,
                f"Interconnection MW mismatch: stored={inter_mw:.1f}, "
                f"expected={expected_inter_mw:.1f}",
            )

        if demand is not None:
            expected_demand = generation + inter_mw
            demand_gap = demand - expected_demand
            show_demand = bool(e.get("show_demand_card"))
            status = str(e.get("demand_balance_status") or "")

            if abs(demand_gap) > DEMAND_BALANCE_TOLERANCE_MW:
                if show_demand:
                    fail(errors, "Demand card is shown despite failed balance check.")
                if not status.startswith("withheld"):
                    fail(errors, f"Demand balance status should be withheld, got {status!r}")


    # Plausibility guard: in the current public model, "other renewables" is a
    # calculated remainder, not a trusted measured technology class. Very high
    # values usually mean the source has mixed a renewable total with stale or
    # incomplete wind/solar child values. Warn, but do not fail the refresh.
    if other is not None and other > 20.0:
        warnings.append(
            f"Other renewables remainder is implausibly high: {other:.2f}%. "
            "This usually indicates stale/incomplete wind or solar component data."
        )

    # Solar can legitimately be zero at night while wind keeps renewables high.
    # Do not fail the refresh pipeline on solar=0 alone.
    if errors:
        print("Current electricity validation FAILED:")
        for err in errors:
            print(" -", err)
        return 1

    print("Current electricity validation passed.")
    if warnings:
        print("Current electricity validation warnings:")
        for warning in warnings:
            print(" -", warning)
    print(f"Generation mix: wind {wind:.2f} + solar {solar:.2f} + other renewables {other:.2f} + thermal/other {thermal:.2f} = {wind + solar + other + thermal:.2f}%")
    print(f"Interconnection: {inter_mw:.0f} MW from {net_pct:.2f}% of {generation:.0f} MW")
    print(f"Demand status: {e.get('demand_balance_status')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
