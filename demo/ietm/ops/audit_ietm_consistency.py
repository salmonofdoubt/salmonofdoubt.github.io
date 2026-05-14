#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]

MONITOR = ROOT / "data" / "monitor.json"
APP = ROOT / "app.js"
CSS = ROOT / "styles.css"
PIPELINE = ROOT / "ops" / "run_pipeline.py"
VISIBLE = ROOT / "ops" / "update_smartgrid_visible_overview.py"
VALIDATE = ROOT / "ops" / "validate_monitor.py"


def read(path: Path) -> str:
    return path.read_text(errors="replace") if path.exists() else ""


def load_json(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def number(value):
    try:
        return float(value)
    except Exception:
        return None


def section(title: str):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def pct(value):
    if value is None:
        return "missing"
    return f"{value:.2f}%"


def main() -> int:
    data = load_json(MONITOR)
    e = data.get("electricity_now", {})

    section("1. CURRENT DATA CONTRACT")

    keys = [
        "electricity_datetime",
        "generation_mw",
        "demand_mw",
        "renewables_percent",
        "wind_percent",
        "solar_percent",
        "thermal_generation_percent",
        "residual_percent",
        "gas_percent",
        "net_import_percent",
        "interconnection_percent",
        "interconnection_mw",
        "imports_mw",
        "exports_mw",
        "interconnection_direction",
        "interconnection_basis",
        "smartgrid_visible_overview_harvested_at",
    ]

    for key in keys:
        print(f"{key:42} {e.get(key)}")

    section("2. GENERATION MIX MATH")

    renewables = number(e.get("renewables_percent"))
    wind = number(e.get("wind_percent"))
    solar = number(e.get("solar_percent"))

    if renewables is not None and wind is not None and solar is not None:
        other_renewables = max(0.0, renewables - wind - solar)
        thermal_other = max(0.0, 100.0 - renewables)
        sum_mix = wind + solar + other_renewables + thermal_other

        print(f"renewables_percent                 {pct(renewables)}")
        print(f"wind_percent                       {pct(wind)}")
        print(f"solar_percent                      {pct(solar)}")
        print(f"computed_other_renewables          {pct(other_renewables)}")
        print(f"computed_thermal_other             {pct(thermal_other)}")
        print(f"computed_mix_sum                   {pct(sum_mix)}")

        if abs(sum_mix - 100.0) > 1.0:
            print("FAIL: generation mix does not sum to 100%.")
        else:
            print("OK: computed generation mix sums to 100%.")

        if other_renewables > 0.5:
            print("NOTE: UI must show an 'Other renewables' row, otherwise renewables will not reconcile.")
    else:
        print("FAIL: missing renewables, wind or solar percentage.")

    section("3. INTERCONNECTION MATH")

    generation_mw = number(e.get("generation_mw"))
    net_import_percent = number(e.get("net_import_percent") if e.get("net_import_percent") is not None else e.get("interconnection_percent"))
    interconnection_mw = number(e.get("interconnection_mw"))

    if generation_mw is not None and net_import_percent is not None:
        expected_interconnection = generation_mw * net_import_percent / 100.0
        print(f"generation_mw                      {generation_mw:.0f} MW")
        print(f"net_import_percent                 {net_import_percent:.2f}%")
        print(f"expected_interconnection_mw        {expected_interconnection:.1f} MW")
        print(f"stored_interconnection_mw          {interconnection_mw}")

        if interconnection_mw is not None:
            gap = interconnection_mw - expected_interconnection
            print(f"interconnection_gap_mw             {gap:.1f} MW")
            if abs(gap) > 20:
                print("FAIL: stored interconnection_mw does not match visible net import % × generation.")
            else:
                print("OK: interconnection_mw matches visible net import calculation.")
    else:
        print("FAIL: cannot compute interconnection from generation and net import percent.")

    section("4. DEMAND BALANCE CHECK")

    demand_mw = number(e.get("demand_mw"))
    if demand_mw is not None and generation_mw is not None and interconnection_mw is not None:
        expected_demand = generation_mw + interconnection_mw
        demand_gap = demand_mw - expected_demand
        print(f"demand_mw                          {demand_mw:.0f} MW")
        print(f"generation_mw + interconnection    {expected_demand:.0f} MW")
        print(f"demand_gap                         {demand_gap:.0f} MW")
        if abs(demand_gap) > 300:
            print("WARN: demand is not coherent with generation + net flow. Do not show as a top accounting card.")
        else:
            print("OK: demand roughly balances with generation + net flow.")
    else:
        print("INFO: demand balance cannot be checked.")

    section("5. FRONT-END PATCH ARCHAEOLOGY")

    app = read(APP)
    css = read(CSS)

    checks = {
        "IETM BEGIN blocks in app.js": len(re.findall(r"IETM .*BEGIN", app)),
        "renderMetrics wrappers": len(re.findall(r"previousRenderMetrics|renderMetrics\\s*=\\s*function", app)),
        "renderMix overrides": len(re.findall(r"renderMix\\s*=\\s*function", app)),
        "renderDailyPulse wrappers": len(re.findall(r"previousRenderDailyPulse|renderDailyPulse\\s*=\\s*function", app)),
        "post-render timeouts": app.count("setTimeout("),
        "nth-child order hacks": css.count("nth-child"),
        "inline cache-bust references": read(ROOT / "index.html").count("app.js?v=") + read(ROOT / "index.html").count("styles.css?v="),
    }

    for label, value in checks.items():
        print(f"{label:42} {value}")

    if checks["renderMetrics wrappers"] > 0 or checks["renderDailyPulse wrappers"] > 0:
        print("FAIL: render wrappers remain. Cleanup should replace them with canonical render functions.")

    if checks["nth-child order hacks"] > 0:
        print("WARN: CSS card order depends on DOM position. Prefer semantic data-kpi attributes after cleanup.")

    section("6. PIPELINE ORDER")

    pipeline = read(PIPELINE)
    steps = re.findall(r'\("([^"]+)",\s*\["python3",\s*"([^"]+)"\]\)', pipeline)

    for i, (label, cmd) in enumerate(steps, 1):
        print(f"{i:02d}. {label:45} {cmd}")

    labels = [label for label, _ in steps]
    try:
        rebuild_i = labels.index("Rebuild monitor JSON with history")
        overview_i = labels.index("Update visible SmartGrid overview")
        validate_i = labels.index("Validate monitor JSON")
        if rebuild_i < overview_i < validate_i:
            print("OK: visible SmartGrid overview runs after final build and before validation.")
        else:
            print("FAIL: visible SmartGrid overview is in the wrong sequence.")
    except ValueError:
        print("FAIL: required pipeline step missing.")

    section("7. CLEANUP TARGET")

    print("""Required cleanup:
1. One canonical electricity_now normalisation step.
2. One renderMetrics function.
3. One renderMix function.
4. One renderDailyPulse function.
5. No post-render patching except temporary diagnostics.
6. validate_monitor.py must enforce generation mix and interconnection invariants.
""")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
