#!/usr/bin/env python3
"""
IETM Smart Grid Dashboard API live harvester.

Strict rule:
- use Smart Grid API Rows only
- use explicit Value only
- reject future/null rows
- select latest non-null actual value at or before local Ireland time
"""

from __future__ import annotations

import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEBUG = ROOT / "ops" / "debug"
OUT = SOURCE / "electricity.json"
DEBUG_OUT = DEBUG / "smartgrid_api_live_debug.json"

API = "https://www.smartgriddashboard.com/api/chart/"
REGION = "ALL"
DUBLIN = ZoneInfo("Europe/Dublin")

SERIES = {
    "demand_mw": {
        "chartType": "generation",
        "area": "demandactual",
        "field": "SYSTEM_DEMAND",
        "range": (1000, 12000),
    },
    "generation_mw": {
        "chartType": "generation",
        "area": "generationactual",
        "field": "GEN_EXP",
        "range": (500, 14000),
    },
    "wind_mw": {
        "chartType": "generation",
        "area": "windactual",
        "field": "WIND_ACTUAL",
        "range": (0, 7000),
    },
    "solar_mw": {
        "chartType": "generation",
        "area": "solaractual",
        "field": "SOLAR_ACTUAL",
        "range": (-100, 2500),
    },
}


def now_local() -> datetime:
    return datetime.now(DUBLIN).replace(microsecond=0)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def day_label() -> str:
    return now_local().strftime("%d-%b-%Y")


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def parse_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    text = str(value).replace(",", "").strip()
    if not text:
        return None
    m = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not m:
        return None
    try:
        return float(m.group(0))
    except Exception:
        return None


def parse_smartgrid_time(value: Any) -> datetime | None:
    if not value:
        return None

    text = str(value).strip()
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.replace(tzinfo=DUBLIN)
        except ValueError:
            pass

    return None


def pct(part: float | None, whole: float | None) -> float:
    if part is None or whole is None or whole <= 0:
        return 0.0
    return max(0.0, float(part) / float(whole) * 100.0)


def api_url(chart_type: str, area: str) -> str:
    d = day_label()
    params = {
        "region": REGION,
        "chartType": chart_type,
        "dateRange": "day",
        "dateFrom": d,
        "dateTo": d,
        "areas": area,
    }
    return f"{API}?{urllib.parse.urlencode(params)}"


def fetch_rows(chart_type: str, area: str) -> tuple[str, list[dict[str, Any]], str]:
    url = api_url(chart_type, area)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.70 (+https://salmonofdoubt.github.io/demo/ietm/)",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-IE,en;q=0.9",
            "eirgrid-content-request": "Nextjs",
            "Referer": "https://www.smartgriddashboard.com/all/generation/",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read().decode("utf-8", errors="replace")

    payload = json.loads(raw)
    rows = payload.get("Rows", []) if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        rows = []

    return url, rows, raw[:1000]


def latest_valid_row(metric: str, rows: list[dict[str, Any]], spec: dict[str, Any]) -> dict | None:
    low, high = spec["range"]
    expected_field = spec["field"]
    cutoff = now_local() + timedelta(minutes=20)

    valid = []
    rejected = {
        "null_value": 0,
        "future": 0,
        "wrong_field": 0,
        "implausible": 0,
        "bad_time": 0,
    }

    for row in rows:
        if str(row.get("FieldName", "")).upper() != expected_field:
            rejected["wrong_field"] += 1
            continue

        value = parse_number(row.get("Value"))
        if value is None:
            rejected["null_value"] += 1
            continue

        dt = parse_smartgrid_time(row.get("EffectiveTime"))
        if dt is None:
            rejected["bad_time"] += 1
            continue

        if dt > cutoff:
            rejected["future"] += 1
            continue

        if not (low <= value <= high):
            rejected["implausible"] += 1
            continue

        valid.append({
            "value": value,
            "time_local": dt.isoformat(),
            "effective_time": row.get("EffectiveTime"),
            "row": row,
        })

    if not valid:
        return {
            "ok": False,
            "metric": metric,
            "valid_count": 0,
            "rejected": rejected,
            "latest": None,
        }

    latest = max(valid, key=lambda item: item["time_local"])

    return {
        "ok": True,
        "metric": metric,
        "valid_count": len(valid),
        "rejected": rejected,
        "latest": latest,
    }


def normalise_cover(wind_pct_raw: float, solar_pct_raw: float) -> dict[str, Any]:
    solar_pct_raw = max(0.0, solar_pct_raw)
    wind_pct_raw = max(0.0, wind_pct_raw)
    total = wind_pct_raw + solar_pct_raw

    if total <= 100:
        return {
            "wind": wind_pct_raw,
            "solar": solar_pct_raw,
            "renewables": total,
            "output": total,
            "surplus": 0.0,
            "normalised": False,
        }

    scale = 100.0 / total
    return {
        "wind": wind_pct_raw * scale,
        "solar": solar_pct_raw * scale,
        "renewables": 100.0,
        "output": total,
        "surplus": total - 100.0,
        "normalised": True,
    }



def average_valid_values(metric: str, debug: dict) -> float | None:
    block = debug.get("series", {}).get(metric, {})
    selected = block.get("selected", {})
    latest = selected.get("latest")
    if not latest:
        return None

    # Reconstruct from valid rows by using the raw API rows kept in debug last_6 only is not enough,
    # so this function is intentionally conservative for now.
    return float(latest["value"])


def build_live_fuel_mix(demand: float, wind: float, solar: float, residual: float) -> list[dict[str, object]]:
    wind_pct = pct(wind, demand)
    solar_pct = pct(max(0.0, solar), demand)

    # Until the interconnection endpoint is mapped, do not pretend imports are known.
    imports_pct = 0.0

    return [
        {"label": "Wind", "class": "wind", "percent": round(wind_pct, 1), "available": True},
        {"label": "Solar", "class": "solar", "percent": round(solar_pct, 1), "available": True},
        {"label": "Imports", "class": "imports", "percent": 0.0, "available": False},
        {"label": "Uncovered", "class": "other", "percent": round(residual, 1), "available": True},
    ]

def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)

    existing = read_json(OUT, {})
    debug = {
        "generated_at": now_iso(),
        "local_now": now_local().isoformat(),
        "region": REGION,
        "day": day_label(),
        "series": {},
        "errors": [],
    }

    values = {}
    times = []

    for metric, spec in SERIES.items():
        url, rows, preview = fetch_rows(spec["chartType"], spec["area"])
        selected = latest_valid_row(metric, rows, spec)

        debug["series"][metric] = {
            "url": url,
            "chartType": spec["chartType"],
            "area": spec["area"],
            "expected_field": spec["field"],
            "row_count": len(rows),
            "response_preview": preview,
            "selected": selected,
            "last_6_rows": rows[-6:],
        }

        if selected.get("ok"):
            latest = selected["latest"]
            values[metric] = float(latest["value"])
            times.append(latest["time_local"])
        else:
            debug["errors"].append(f"{metric}: no valid non-null row at or before now")

    if "demand_mw" not in values or "wind_mw" not in values:
        write_json(DEBUG_OUT, debug)
        print("Smart Grid API live values not proven. Electricity data unchanged.")
        print(json.dumps(debug["errors"], indent=2))
        print(f"Debug written: {DEBUG_OUT.relative_to(ROOT)}")
        return 0

    demand = values["demand_mw"]
    generation = values.get("generation_mw")
    wind = values["wind_mw"]
    solar = max(0.0, values.get("solar_mw", 0.0))

    wind_pct_raw = pct(wind, demand)
    solar_pct_raw = pct(solar, demand)
    cover = normalise_cover(wind_pct_raw, solar_pct_raw)

    # Interconnection API endpoint still needs separate mapping. Do not fake live imports.
    interconnection = None
    imports_mw = 0.0
    exports_mw = 0.0
    imports_pct = 0.0
    exports_pct = 0.0
    direction = "not mapped"

    residual = max(0.0, 100.0 - min(100.0, float(cover["renewables"]) + imports_pct))
    latest_time = max(times) if times else now_iso()

    electricity_now = existing.get("electricity_now", {}) or {}
    electricity_now.update({
        "demand_mw": round(demand),
        "generation_mw": round(generation) if generation is not None else electricity_now.get("generation_mw"),
        "wind_mw": round(wind),
        "solar_mw": round(solar),
        "interconnection_mw": interconnection,
        "interconnection_direction": direction,
        "imports_mw": imports_mw,
        "exports_mw": exports_mw,
        "imports_percent": round(imports_pct, 1),
        "exports_percent": round(exports_pct, 1),
        "wind_percent": round(float(cover["wind"]), 1),
        "solar_percent": round(float(cover["solar"]), 1),
        "renewables_percent": round(float(cover["renewables"]), 1),
        "renewables_output_percent": round(float(cover["output"]), 1),
        "renewable_surplus_percent": round(float(cover["surplus"]), 1),
        "renewables_coverage_percent": round(float(cover["renewables"]), 1),
        "renewables_normalised": bool(cover["normalised"]),
        "renewables_model": "smartgrid_api_latest_non_null_actual",
        "renewables_definition": "Latest non-null Smart Grid Dashboard API wind plus solar cover of current demand.",
        "residual_percent": round(residual, 1),
        "gas_percent": round(residual, 1),
        "gas_is_residual_proxy": True,
        "electricity_datetime": latest_time,
        "source_label": "Smart Grid Dashboard API",
        "source_url": debug["series"]["demand_mw"]["url"],
        "source_freshness": "live chart API latest non-null actual",
        "data_age_hours": 0,
        "smartgrid_live_available": True,
        "smartgrid_api_live": True,
        "interconnection_available": False,
        "consistency_warnings": [
            "Interconnection not yet mapped from Smart Grid API; imports shown as 0 until endpoint is wired."
        ],
    })

    existing["electricity_now"] = electricity_now

    existing["fuel_mix_24h"] = build_live_fuel_mix(demand, wind, solar, residual)

    existing["daily_story"] = {
        "headline": (
            "Ireland is renewable-led in the latest live grid pulse."
            if float(cover["renewables"]) >= residual
            else "Ireland remains residual-backed in the latest live grid pulse."
        ),
        "interpretation": (
            "This panel now uses Smart Grid Dashboard API live values for demand, wind and solar. "
            "The uncovered share is a computed remainder. It is not measured gas and does not yet split "
            "hydro, storage, fossil generation or imports because interconnection and full fuel mix are not yet mapped."
        ),
        "source_mode": "Smart Grid Dashboard API",
        "period": "latest non-null actual interval",
    }

    existing["gas"] = {
        "share_percent": round(residual, 1),
        "signal": "Uncovered demand estimate",
        "narrative": (
            "Uncovered demand is calculated from live demand minus mapped wind and solar cover. "
            "It is not measured gas. A later fuel-mix endpoint should split this into gas, hydro, storage, imports and other sources."
        ),
    }

    existing.setdefault("source_status", {})
    existing["source_status"]["smartgrid_api_live"] = {
        "source": "Smart Grid Dashboard API",
        "source_url": "https://www.smartgriddashboard.com/",
        "harvested_at": now_iso(),
        "mode": "direct-api-latest-non-null-actual",
        "region": REGION,
        "caveat": "Uses latest non-null actual rows at or before Ireland local time. Future null rows are rejected.",
    }

    write_json(OUT, existing)
    write_json(DEBUG_OUT, debug)

    print("Wrote Smart Grid API live electricity values.")
    print(json.dumps({
        "local_now": debug["local_now"],
        "demand_mw": electricity_now.get("demand_mw"),
        "generation_mw": electricity_now.get("generation_mw"),
        "wind_mw": electricity_now.get("wind_mw"),
        "solar_mw": electricity_now.get("solar_mw"),
        "wind_percent": electricity_now.get("wind_percent"),
        "solar_percent": electricity_now.get("solar_percent"),
        "renewables_percent": electricity_now.get("renewables_percent"),
        "residual_percent": electricity_now.get("residual_percent"),
        "source_label": electricity_now.get("source_label"),
        "electricity_datetime": electricity_now.get("electricity_datetime"),
    }, indent=2))
    print(f"Debug written: {DEBUG_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
