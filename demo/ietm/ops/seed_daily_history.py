#!/usr/bin/env python3
"""
Seed 30 days of estimated daily history for sparklines.

This is a visual warm-start only:
- existing real rows are never overwritten
- estimated rows are marked with estimated_backfill = true
- future real daily snapshots will replace the visual window as they accumulate
- no estimated row should be treated as observed historical evidence
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MONITOR = DATA / "monitor.json"
HISTORY = DATA / "history" / "daily.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return fallback


def as_float(value: Any, fallback: float) -> float:
    try:
        if value is None:
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def rounded(value: float, digits: int = 1) -> float:
    return round(float(value), digits)


def seeded_variation(base: float, date_key: str, amplitude: float, lo: float, hi: float, phase: float = 0.0) -> float:
    """
    Deterministic variation by date. Not random each run.
    """
    rnd = random.Random(f"ietm::{date_key}::{base}::{phase}")
    day_num = datetime.fromisoformat(date_key).timetuple().tm_yday
    seasonal = math.sin((day_num / 365.25) * math.tau + phase)
    weekly = math.sin((day_num / 7.0) * math.tau + phase / 2)
    jitter = rnd.uniform(-0.45, 0.45)
    value = base + amplitude * (0.65 * seasonal + 0.25 * weekly + 0.10 * jitter)
    return clamp(value, lo, hi)


def build_seed_row(date_key: str, monitor: dict) -> dict:
    e = monitor.get("electricity_now", {}) or {}
    drift = monitor.get("target_drift", {}) or {}
    prices = monitor.get("prices", []) or []

    demand_mw_base = as_float(e.get("demand_mw"), 4200)
    renewable_base = as_float(e.get("renewables_percent"), 45)
    wind_base = as_float(e.get("wind_percent"), max(0, renewable_base - 5))
    solar_base = as_float(e.get("solar_percent"), 5)
    imports_base = as_float(e.get("imports_percent"), 5)
    co2_base = as_float(e.get("co2_g_per_kwh"), 150)

    demand_mw = seeded_variation(demand_mw_base, date_key, 420, 2500, 6500, 0.2)

    renewables = seeded_variation(renewable_base, date_key, 18, 5, 95, 1.1)
    wind = seeded_variation(wind_base, date_key, 18, 0, 90, 1.7)
    solar = seeded_variation(solar_base, date_key, 5, 0, 22, 2.4)
    imports = seeded_variation(imports_base, date_key, 12, 0, 45, 3.0)

    # Keep internal proportions plausible.
    renewables = clamp(max(0, wind) + max(0, solar), 0, 95)
    residual = clamp(100 - renewables - imports, 0, 100)

    # CO2 roughly falls when renewables rise, but remains only an estimated visual seed.
    co2 = clamp(co2_base + (45 - renewables) * 2.2 + seeded_variation(0, date_key, 12, -18, 18, 4.2), 40, 500)

    electricity_price = None
    gas_price = None
    for item in prices:
        if item.get("label") == "Household electricity":
            electricity_price = item.get("ireland_c_per_kwh")
        if item.get("label") == "Household gas":
            gas_price = item.get("ireland_c_per_kwh")

    return {
        "date": date_key,
        "captured_at": f"{date_key}T12:00:00+00:00",

        "demand_mw": rounded(demand_mw, 0),
        "demand_gw": rounded(demand_mw / 1000, 2),

        "renewables_percent": rounded(renewables, 1),
        "wind_percent": rounded(wind, 1),
        "solar_percent": rounded(solar, 1),
        "imports_percent": rounded(imports, 1),
        "residual_percent": rounded(residual, 1),

        "co2_g_per_kwh": rounded(co2, 1),
        "co2_available": bool(e.get("co2_available", True)),

        "target_gap_pp": drift.get("gap_to_target_pp"),
        "target_status": drift.get("status_label"),

        "household_electricity_c_per_kwh": electricity_price,
        "household_gas_c_per_kwh": gas_price,

        "estimated_backfill": True,
        "backfill_method": "deterministic 30-day visual warm-start from current monitor values",
        "backfill_caveat": "Estimated row for sparkline continuity only; not observed historical data."
    }


def main() -> int:
    monitor = read_json(MONITOR, {})
    if not monitor:
        raise SystemExit("Build data/monitor.json first.")

    existing = read_json(HISTORY, {"meta": {}, "daily": []})
    rows = existing.get("daily", [])

    # Preserve all real rows and all existing rows. Only fill missing dates in last 30 days.
    by_date = {row.get("date"): row for row in rows if row.get("date")}

    today = datetime.now(timezone.utc).date()
    seeded = 0

    for offset in range(29, -1, -1):
        date_key = (today - timedelta(days=offset)).isoformat()
        if date_key in by_date:
            continue
        by_date[date_key] = build_seed_row(date_key, monitor)
        seeded += 1

    merged = sorted(by_date.values(), key=lambda row: row.get("date", ""))

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "row_count": len(merged),
            "mode": "daily-snapshot-history",
            "warm_start_window_days": 30,
            "estimated_backfill_rows": sum(1 for row in merged if row.get("estimated_backfill")),
            "observed_rows": sum(1 for row in merged if not row.get("estimated_backfill")),
            "caveat": (
                "Some early rows may be estimated warm-start rows for sparklines. "
                "Rows with estimated_backfill=true are visual placeholders only, not observed historical data. "
                "As real daily snapshots accumulate, estimated rows age out of the 30-day display window."
            )
        },
        "daily": merged[-1100:],
    }

    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    HISTORY.write_text(json.dumps(payload, indent=2) + "\n")

    print(f"Wrote {HISTORY.relative_to(ROOT)}")
    print(f"Seeded missing dates: {seeded}")
    print(f"Rows total: {payload['meta']['row_count']}")
    print(f"Estimated rows: {payload['meta']['estimated_backfill_rows']}")
    print(f"Observed rows: {payload['meta']['observed_rows']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
