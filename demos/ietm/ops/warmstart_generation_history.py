#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
MONITOR = APP / "data" / "monitor.json"
HISTORY = APP / "data" / "history" / "daily.json"

DAYS = 30


def number(value):
    try:
        if value is None:
            return None
        value = float(value)
        if math.isfinite(value):
            return value
    except Exception:
        pass
    return None


def get_rows(payload):
    if isinstance(payload, list):
        return payload, None

    if isinstance(payload, dict):
        for key in ("rows", "daily", "history", "entries", "snapshots", "days"):
            if isinstance(payload.get(key), list):
                return payload[key], key

    return [], None


def row_date(row):
    value = (
        row.get("date")
        or row.get("day")
        or row.get("generated_at")
        or row.get("updated_at")
        or row.get("timestamp")
    )
    if not value:
        return None
    return str(value)[:10]


def generation_value(row):
    candidates = [
        row.get("generation_mw"),
        row.get("generation_now_mw"),
        row.get("generation"),
        row.get("generation_now"),
        row.get("electricity_now", {}).get("generation_mw") if isinstance(row.get("electricity_now"), dict) else None,
        row.get("current", {}).get("generation_mw") if isinstance(row.get("current"), dict) else None,
        row.get("metrics", {}).get("generation_mw") if isinstance(row.get("metrics"), dict) else None,
    ]
    for value in candidates:
        n = number(value)
        if n is not None:
            return n
    return None


def deterministic_generation_series(current_mw: float) -> list[float]:
    """
    Warm-start only. This is not historical measurement.

    It creates a plausible non-flat 30-day sparkline around the current
    generation value, so the UI has visual continuity until observed daily
    history accumulates.
    """
    values = []
    for i in range(DAYS):
        # i=0 oldest, i=29 newest
        phase = i / max(1, DAYS - 1)

        # A gentle deterministic curve: weekly wave + slower swing + slight drift.
        weekly = math.sin(2 * math.pi * phase * 4.2)
        slow = math.sin(2 * math.pi * phase * 1.15 + 0.9)
        drift = (phase - 0.5) * 0.10

        factor = 0.94 + (0.075 * weekly) + (0.055 * slow) + drift
        value = current_mw * factor

        # Keep it plausible for Irish system-level generation snapshots.
        value = max(1800, min(6200, value))
        values.append(round(value, 0))

    # Make the last value exactly current.
    values[-1] = round(current_mw, 0)
    return values


def main() -> int:
    monitor = json.loads(MONITOR.read_text())
    current_mw = number(monitor.get("electricity_now", {}).get("generation_mw"))

    if current_mw is None:
        raise SystemExit("No current electricity_now.generation_mw found in monitor.json")

    if HISTORY.exists():
        payload = json.loads(HISTORY.read_text())
    else:
        payload = {"rows": []}

    rows, key = get_rows(payload)

    today = date.today()
    required_dates = [(today - timedelta(days=DAYS - 1 - i)).isoformat() for i in range(DAYS)]
    by_date = {row_date(row): row for row in rows if isinstance(row, dict) and row_date(row)}

    warm_values = deterministic_generation_series(current_mw)
    new_rows = []

    for d, mw in zip(required_dates, warm_values):
        row = by_date.get(d, {"date": d})

        existing = generation_value(row)
        is_latest = d == required_dates[-1]

        # Preserve genuinely varied observed values. Replace missing or flat-prone values.
        if existing is None or row.get("generation_history_basis") == "estimated_warm_start" or is_latest:
            row["generation_mw"] = mw
            row.setdefault("electricity_now", {})
            if isinstance(row["electricity_now"], dict):
                row["electricity_now"]["generation_mw"] = mw

            row["generation_history_basis"] = "observed_current" if is_latest else "estimated_warm_start"
            row["generation_history_note"] = (
                "Latest point uses current monitor generation."
                if is_latest
                else "Estimated warm-start point for sparkline continuity; not observed historical generation."
            )

        new_rows.append(row)

    meta = {
        "warm_started_generation": True,
        "warm_started_generation_days": DAYS,
        "warm_started_generation_created_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "warm_started_generation_note": "Generation sparkline includes estimated warm-start points until observed daily history accumulates."
    }

    if isinstance(payload, list):
        payload = new_rows
    else:
        if key is None:
            key = "rows"
        payload[key] = new_rows
        payload.setdefault("meta", {})
        if isinstance(payload["meta"], dict):
            payload["meta"].update(meta)

    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    HISTORY.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    print(f"Warm-started generation history with {DAYS} points.")
    print(f"Latest generation: {current_mw:.0f} MW")
    print(f"Wrote: {HISTORY}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
