#!/usr/bin/env python3
"""
IETM source model and freshness gate.

Purpose:
- separate source identity from UI wording
- prevent stale workbook values being labelled as "now" or "live"
- make fallback states explicit in monitor.json
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SOURCE = DATA / "source"
ELECTRICITY = SOURCE / "electricity.json"
MARKET = SOURCE / "market_prices.json"
OUT = SOURCE / "source_model.json"


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def now_iso() -> str:
    return now_utc().isoformat()


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None

    text = str(value).strip()
    if not text:
        return None

    text = text.replace("Z", "+00:00")

    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None

    if dt.tzinfo is None:
        # EirGrid workbook timestamps are local/naive in practice.
        # Treat as UTC only for conservative freshness gating.
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def age_hours(dt: datetime | None) -> float | None:
    if dt is None:
        return None
    return round((now_utc() - dt).total_seconds() / 3600, 2)


def electricity_source_model(electricity: dict) -> dict:
    e = electricity.get("electricity_now", {}) or {}

    label = e.get("source_label") or electricity.get("source_status", {}).get("source") or "Unknown electricity source"
    source_url = e.get("source_url") or electricity.get("source_status", {}).get("source_url") or ""
    dt = parse_datetime(e.get("electricity_datetime") or e.get("smartgrid_live_harvested_at"))
    age = age_hours(dt)

    label_lower = str(label).lower()
    is_smartgrid = "smart grid" in label_lower or "smartgrid" in label_lower
    is_workbook = "workbook" in label_lower or "spreadsheet" in label_lower or "qtr" in label_lower

    if age is None:
        status = "unknown_age"
        values_are_live = False
        public_badge = "Source age unknown"
        public_title = "Mapped electricity signal"
        caveat = "The source timestamp could not be parsed, so the values are not labelled as live."
    elif is_smartgrid and age <= 2:
        status = "live"
        values_are_live = True
        public_badge = "Live grid source"
        public_title = "Current grid pulse"
        caveat = "Core grid values are treated as live because the mapped source interval is within two hours."
    elif age <= 2:
        status = "current_snapshot"
        values_are_live = False
        public_badge = "Current mapped snapshot"
        public_title = "Current mapped electricity snapshot"
        caveat = "Values are current enough for operational context, but the selected source is not labelled as a live dashboard feed."
    elif age <= 24:
        status = "recent_snapshot"
        values_are_live = False
        public_badge = "Recent mapped snapshot"
        public_title = "Recent electricity snapshot"
        caveat = "Values are recent, but not current enough to describe as live."
    elif is_workbook:
        status = "stale_workbook_fallback"
        values_are_live = False
        public_badge = "Workbook fallback"
        public_title = "Latest mapped workbook snapshot"
        caveat = "Core grid values come from a structured EirGrid workbook interval that is older than 24 hours. Do not read this as now."
    else:
        status = "stale_fallback"
        values_are_live = False
        public_badge = "Fallback electricity source"
        public_title = "Latest mapped electricity snapshot"
        caveat = "Core grid values are older than 24 hours and are shown only as a fallback snapshot."

    return {
        "role": "core_grid_values",
        "selected_source": label,
        "source_url": source_url,
        "status": status,
        "values_are_live": values_are_live,
        "values_are_current": bool(age is not None and age <= 2),
        "latest_interval": dt.isoformat() if dt else None,
        "age_hours": age,
        "public_badge": public_badge,
        "public_title": public_title,
        "public_caveat": caveat,
        "display_rules": {
            "may_use_now_wording": values_are_live,
            "may_use_live_badge": values_are_live,
            "must_show_fallback_caveat": not values_are_live,
            "stale_after_hours": 2,
            "fallback_after_hours": 24
        },
        "recommended_next_source": {
            "name": "Smart Grid Dashboard chart/API endpoint",
            "reason": "Needed for reliable live demand, wind, solar, generation, interconnection and fuel-mix values without visible-page scraping."
        },
        "robust_api_fallback": {
            "name": "ENTSO-E Transparency Platform",
            "items": [
                "Actual total load",
                "Actual generation per production type",
                "Cross-border physical flows"
            ],
            "note": "Requires API token and correct Irish bidding-zone/control-area mapping."
        }
    }


def market_source_model(market: dict) -> dict:
    rows = market.get("market_prices", []) or []

    out = []
    for item in rows:
        out.append({
            "label": item.get("label"),
            "status": item.get("status"),
            "source": item.get("source"),
            "source_url": item.get("source_url"),
            "period": item.get("period"),
            "freshness": item.get("freshness"),
            "is_household_tariff": False,
            "public_caveat": "System/market signal, not a household tariff."
        })

    return {
        "role": "system_market_prices",
        "items": out,
        "household_prices_are_separate": True
    }


def main() -> int:
    electricity = read_json(ELECTRICITY, {})
    market = read_json(MARKET, {})

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "mode": "source-model-and-freshness-gate",
            "project": "Ireland Energy Transition Monitor"
        },
        "electricity": electricity_source_model(electricity),
        "market": market_source_model(market),
        "source_policy": {
            "live_grid_target": "Smart Grid Dashboard chart/API endpoint",
            "structured_fallback": "EirGrid quarter-hourly workbook",
            "machine_readable_fallback": "ENTSO-E Transparency Platform",
            "do_not_do": [
                "Do not call stale workbook values live.",
                "Do not mix dashboard percentages with workbook MW values without explicit denominator notes.",
                "Do not treat thermal/other as measured gas.",
                "Do not substitute household tariffs for market/system prices."
            ]
        }
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(json.dumps(payload["electricity"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
