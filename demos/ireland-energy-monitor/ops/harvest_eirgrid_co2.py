#!/usr/bin/env python3
"""
Free EirGrid / Smart Grid Dashboard CO2 harvester.

Uses the public Smart Grid Dashboard chart API discovered from the deployed Next.js bundle:

  /api/chart/?region=ROI&chartType=co2&dateRange=day&dateFrom=DD-Mon-YYYY 00:00&dateTo=DD-Mon-YYYY 23:59&areas=co2intensity,co2intensityforecast

No paid API. No sandbox data.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ELECTRICITY = ROOT / "data" / "source" / "electricity.json"

API_ENDPOINT = "https://www.smartgriddashboard.com/api/chart/"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


def dashboard_date(dt: datetime) -> str:
    return dt.strftime("%d-%b-%Y")


def build_url(region: str, day: datetime) -> str:
    params = {
        "region": region.upper(),
        "chartType": "co2",
        "dateRange": "day",
        "dateFrom": f"{dashboard_date(day)} 00:00",
        "dateTo": f"{dashboard_date(day)} 23:59",
        "areas": "co2intensity,co2intensityforecast",
    }
    return f"{API_ENDPOINT}?{urllib.parse.urlencode(params)}"


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 IrelandEnergyMonitor/0.7",
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://www.smartgriddashboard.com/roi/co2/",
        },
    )

    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def normalise_field(value) -> str:
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def parse_latest_intensity(payload: dict) -> tuple[float | None, dict]:
    rows = payload.get("Rows") or payload.get("rows") or []
    if not isinstance(rows, list) or not rows:
        return None, {"reason": "No Rows array found", "keys": list(payload.keys())}

    candidates = []

    for row in rows:
        field = normalise_field(row.get("FieldName") or row.get("fieldName") or row.get("field"))
        value = row.get("Value")
        time = row.get("EffectiveTime") or row.get("effectiveTime") or row.get("time")

        if field not in {"co2intensity", "co2_intensity"}:
            continue

        if value is None:
            continue

        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue

        candidates.append({
            "value": numeric,
            "time": time,
            "field": row.get("FieldName") or row.get("fieldName") or row.get("field"),
        })

    if not candidates:
        return None, {
            "reason": "Rows found, but no non-null CO2 intensity values",
            "row_count": len(rows),
            "sample": rows[:3],
        }

    latest = candidates[-1]

    return latest["value"], {
        "row_count": len(rows),
        "candidate_count": len(candidates),
        "latest_time": latest.get("time"),
        "latest_field": latest.get("field"),
    }


def set_unavailable(data: dict, errors: list[str]) -> dict:
    e = data.setdefault("electricity_now", {})
    e["co2_g_per_kwh"] = None
    e["co2_available"] = False
    e["co2_source"] = "EirGrid Smart Grid Dashboard"
    e["co2_unit"] = "gCO2/kWh"

    source_status = data.setdefault("source_status", {})
    source_status["carbon_intensity"] = {
        "source": "Smart Grid Dashboard chart API",
        "source_url": API_ENDPOINT,
        "mode": "api-not-parsed",
        "harvested_at": now_iso(),
        "caveat": "Chart API was tried, but no CO2 intensity value was parsed. CO2 remains n/a.",
        "errors": errors[:10],
    }
    return data


def main() -> int:
    data = load_json(ELECTRICITY)

    days = [
        datetime.now(timezone.utc),
        datetime.now(timezone.utc) - timedelta(days=1),
    ]

    attempts = []

    for day in days:
        for region in ["ROI", "ALL"]:
            url = build_url(region, day)

            try:
                payload = fetch_json(url)
                value, info = parse_latest_intensity(payload)

                attempts.append({
                    "url": url,
                    "value": value,
                    "info": info,
                })

                if value is None:
                    continue

                e = data.setdefault("electricity_now", {})
                e["co2_g_per_kwh"] = round(value, 1)
                e["co2_available"] = True
                e["co2_source"] = f"EirGrid Smart Grid Dashboard, {region}"
                e["co2_unit"] = "gCO2/kWh"
                e["co2_region"] = region
                e["co2_datetime"] = info.get("latest_time")

                source_status = data.setdefault("source_status", {})
                source_status["carbon_intensity"] = {
                    "source": "Smart Grid Dashboard chart API",
                    "source_url": url,
                    "mode": "api-chart",
                    "harvested_at": now_iso(),
                    "region": region,
                    "parser": info,
                    "caveat": (
                        "Parsed from Smart Grid Dashboard chart API. ROI is preferred; "
                        "ALL is used only as fallback and labelled."
                    ),
                }

                save_json(ELECTRICITY, data)
                print(f"Wrote CO2 intensity: {value} gCO2/kWh from {region}")
                return 0

            except Exception as exc:
                attempts.append({
                    "url": url,
                    "error": str(exc),
                })

    errors = [
        f"{a.get('url')}: {a.get('error') or a.get('info')}"
        for a in attempts
    ]

    data = set_unavailable(data, errors)
    save_json(ELECTRICITY, data)
    print("No CO2 intensity parsed from Smart Grid Dashboard chart API; CO2 remains n/a.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
