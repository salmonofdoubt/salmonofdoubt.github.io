#!/usr/bin/env python3
"""
Ireland Energy Monitor daily history updater.

Reads data/monitor.json after the monitor build, extracts one compact daily
snapshot, and writes/updates data/history/daily.json.

Rules:
- one row per date
- same-date rows are replaced, not duplicated
- values are compact and trend-ready
- no fake backfill
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MONITOR = DATA / "monitor.json"
HISTORY_DIR = DATA / "history"
OUT = HISTORY_DIR / "daily.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_iso_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return fallback


def first_price_value(prices: list[dict], label: str) -> float | None:
    for item in prices:
        if item.get("label") == label:
            value = item.get("ireland_c_per_kwh")
            try:
                return float(value)
            except (TypeError, ValueError):
                return None
    return None



def first_market_price_value(market_prices: list[dict], label_contains: str, key: str = "numeric_value") -> float | None:
    label_contains = label_contains.lower()
    for item in market_prices:
        if label_contains in str(item.get("label", "")).lower():
            try:
                value = item.get(key)
                if value is None:
                    return None
                return float(value)
            except (TypeError, ValueError):
                return None
    return None

def round_or_none(value: Any, digits: int = 2) -> float | None:
    try:
        if value is None:
            return None
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def build_snapshot(monitor: dict) -> dict:
    e = monitor.get("electricity_now", {}) or {}
    drift = monitor.get("target_drift", {}) or {}
    prices = monitor.get("prices", []) or []
    market_prices = monitor.get("market_prices", []) or []

    demand_mw = round_or_none(e.get("demand_mw"), 0)
    demand_gw = round_or_none((demand_mw or 0) / 1000, 2) if demand_mw is not None else None

    return {
        "date": today_iso_date(),
        "captured_at": now_iso(),

        "demand_mw": demand_mw,
        "demand_gw": demand_gw,

        "renewables_percent": round_or_none(e.get("renewables_percent"), 1),
        "wind_percent": round_or_none(e.get("wind_percent"), 1),
        "solar_percent": round_or_none(e.get("solar_percent"), 1),
        "imports_percent": round_or_none(e.get("imports_percent"), 1),
        "residual_percent": round_or_none(e.get("residual_percent", e.get("gas_percent")), 1),

        "co2_g_per_kwh": round_or_none(e.get("co2_g_per_kwh"), 1),
        "co2_available": bool(e.get("co2_available")),

        "target_gap_pp": round_or_none(drift.get("gap_to_target_pp"), 1),
        "target_status": drift.get("status_label"),

        "household_electricity_c_per_kwh": first_price_value(prices, "Household electricity"),
        "household_gas_c_per_kwh": first_price_value(prices, "Household gas"),

        "electricity_system_price_eur_per_mwh": first_market_price_value(market_prices, "electricity", "numeric_value"),
        "electricity_system_price_c_per_kwh_equiv": first_market_price_value(market_prices, "electricity", "numeric_value_c_per_kwh"),
        "gas_balancing_price_c_per_kwh": first_market_price_value(market_prices, "gas", "numeric_value"),
    }


def main() -> int:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    monitor = read_json(MONITOR, {})
    if not monitor:
        raise SystemExit("data/monitor.json not found or invalid. Build monitor first.")

    snapshot = build_snapshot(monitor)
    existing = read_json(OUT, {"meta": {}, "daily": []})
    rows = existing.get("daily", [])

    rows = [row for row in rows if row.get("date") != snapshot["date"]]
    rows.append(snapshot)
    rows.sort(key=lambda row: row.get("date", ""))

    # Keep roughly three years.
    rows = rows[-1100:]

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "row_count": len(rows),
            "mode": "daily-snapshot-history",
            "caveat": "History begins when this project started recording daily snapshots. No fake backfill is created."
        },
        "daily": rows,
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)} with {len(rows)} daily rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
