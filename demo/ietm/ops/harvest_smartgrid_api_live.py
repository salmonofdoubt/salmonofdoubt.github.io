#!/usr/bin/env python3
"""
Direct Smart Grid Dashboard API live harvester for IETM.

Uses discovered endpoint pattern:
https://www.smartgriddashboard.com/api/chart/?region=ALL&chartType=generation&dateRange=day&dateFrom=13-May-2026&dateTo=13-May-2026&areas=generationactual

No cookies. No browser headers. No stale workbook pretending to be live.
"""

from __future__ import annotations

import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEBUG = ROOT / "ops" / "debug"
OUT = SOURCE / "electricity.json"
DEBUG_OUT = DEBUG / "smartgrid_api_live_debug.json"

API = "https://www.smartgriddashboard.com/api/chart/"
REGION = "ALL"


CANDIDATES = {
    "demand_mw": [
        ("generation", "demandactual"),
        ("generation", "systemdemand"),
        ("generation", "systemdemandactual"),
        ("demand", "demandactual"),
    ],
    "generation_mw": [
        ("generation", "generationactual"),
        ("generation", "systemgeneration"),
        ("generation", "systemgenerationactual"),
    ],
    "wind_mw": [
        ("generation", "windactual"),
        ("generation", "windgenerationactual"),
        ("wind", "windactual"),
        ("wind", "generationactual"),
    ],
    "solar_mw": [
        ("generation", "solaractual"),
        ("generation", "solargenerationactual"),
        ("solar", "solaractual"),
        ("solar", "generationactual"),
    ],
    "interconnection_mw": [
        ("interconnection", "interconnectionactual"),
        ("interconnection", "netinterconnection"),
        ("interconnection", "netinterconnectionactual"),
    ],
}


RANGES = {
    "demand_mw": (1000, 12000),
    "generation_mw": (500, 14000),
    "wind_mw": (0, 7000),
    "solar_mw": (0, 2500),
    "interconnection_mw": (-2500, 2500),
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def now_iso() -> str:
    return now_utc().isoformat()


def day_label() -> str:
    return now_utc().strftime("%d-%b-%Y")


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


def fetch_json(url: str) -> Any:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.68 (+https://salmonofdoubt.github.io/demo/ietm/)",
            "Accept": "application/json,text/plain,*/*",
            "Accept-Language": "en-IE,en;q=0.9",
            "eirgrid-content-request": "Nextjs",
            "Referer": "https://www.smartgriddashboard.com/all/generation/",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read().decode("utf-8", errors="replace")
        return json.loads(raw)


def flatten_rows(obj: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    def walk(value: Any, context: dict[str, Any] | None = None) -> None:
        context = dict(context or {})

        if isinstance(value, list):
            if (
                len(value) >= 2
                and not isinstance(value[0], (dict, list))
                and not isinstance(value[1], (dict, list))
            ):
                y = parse_number(value[1])
                if y is not None:
                    rows.append({**context, "x": value[0], "y": y})
                    return

            for item in value:
                walk(item, context)
            return

        if isinstance(value, dict):
            label = (
                value.get("name")
                or value.get("label")
                or value.get("FieldName")
                or value.get("fieldName")
                or value.get("title")
                or value.get("area")
                or value.get("Area")
            )

            next_context = dict(context)
            if label:
                next_context["series"] = str(label)

            scalar_values = {
                k: v for k, v in value.items()
                if not isinstance(v, (dict, list))
            }

            if len(scalar_values) >= 2:
                rows.append({**context, **scalar_values})

            for child in value.values():
                if isinstance(child, (dict, list)):
                    walk(child, next_context)

    walk(obj)
    return rows


def row_value(row: dict[str, Any]) -> float | None:
    for key in ("Value", "value", "Y", "y", "actual", "Actual", "MW", "mw", "data"):
        if key in row:
            n = parse_number(row[key])
            if n is not None:
                return n

    nums = []
    for key, value in row.items():
        if key.lower() in {"x", "time", "datetime", "date", "timestamp"}:
            continue
        n = parse_number(value)
        if n is not None:
            nums.append(n)

    return nums[-1] if nums else None


def row_time(row: dict[str, Any]) -> str:
    for key in ("DateTime", "datetime", "dateTime", "EffectiveTime", "effectiveTime", "time", "Time", "x", "timestamp"):
        if row.get(key):
            return str(row[key])
    return ""


def plausible(metric: str, value: float | None) -> bool:
    if value is None:
        return False
    low, high = RANGES[metric]
    return low <= float(value) <= high


def latest_value_from_rows(metric: str, rows: list[dict[str, Any]]) -> dict | None:
    values = []
    for row in rows:
        n = row_value(row)
        if n is None:
            continue
        if not plausible(metric, n):
            continue
        values.append({
            "value": float(n),
            "time": row_time(row),
            "row": row,
        })

    if not values:
        return None

    return values[-1]


def fetch_metric(metric: str) -> dict:
    attempts = []

    for chart_type, area in CANDIDATES[metric]:
        url = api_url(chart_type, area)
        try:
            payload = fetch_json(url)
            rows = flatten_rows(payload)
            latest = latest_value_from_rows(metric, rows)

            attempts.append({
                "chart_type": chart_type,
                "area": area,
                "url": url,
                "row_count": len(rows),
                "sample_rows": rows[:4],
                "latest": latest,
            })

            if latest:
                return {
                    "ok": True,
                    "metric": metric,
                    "chart_type": chart_type,
                    "area": area,
                    "url": url,
                    "value": latest["value"],
                    "time": latest.get("time") or "",
                    "row": latest.get("row"),
                    "attempts": attempts,
                }
        except Exception as exc:
            attempts.append({
                "chart_type": chart_type,
                "area": area,
                "url": url,
                "error": str(exc),
            })

    return {
        "ok": False,
        "metric": metric,
        "attempts": attempts,
    }


def normalise_renewable_cover(wind_pct_raw: float, solar_pct_raw: float) -> dict[str, float | bool]:
    total = max(0.0, wind_pct_raw) + max(0.0, solar_pct_raw)

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


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)

    existing = read_json(OUT, {})
    debug = {
        "generated_at": now_iso(),
        "region": REGION,
        "day": day_label(),
        "metrics": {},
        "errors": [],
    }

    results = {}
    for metric in CANDIDATES:
        result = fetch_metric(metric)
        debug["metrics"][metric] = result
        if result.get("ok"):
            results[metric] = float(result["value"])

    if "demand_mw" not in results or "wind_mw" not in results:
        debug["errors"].append("Live API did not prove demand_mw and wind_mw. Electricity data unchanged.")
        write_json(DEBUG_OUT, debug)
        print("Smart Grid API live values not proven. Electricity data unchanged.")
        print(f"Debug written: {DEBUG_OUT.relative_to(ROOT)}")
        return 0

    demand = results["demand_mw"]
    wind = results.get("wind_mw", 0.0)
    solar = results.get("solar_mw", 0.0)
    generation = results.get("generation_mw")
    interconnection = results.get("interconnection_mw", 0.0)

    wind_pct_raw = pct(wind, demand)
    solar_pct_raw = pct(solar, demand)
    cover = normalise_renewable_cover(wind_pct_raw, solar_pct_raw)

    imports_mw = max(interconnection, 0.0)
    exports_mw = max(-interconnection, 0.0)
    imports_pct = pct(imports_mw, demand)
    exports_pct = pct(exports_mw, demand)

    residual = max(0.0, 100.0 - min(100.0, float(cover["renewables"]) + imports_pct))

    if abs(interconnection) < 1:
        direction = "near balanced"
    elif interconnection > 0:
        direction = "importing"
    else:
        direction = "exporting"

    times = [
        debug["metrics"][m].get("time")
        for m in ("demand_mw", "generation_mw", "wind_mw", "solar_mw", "interconnection_mw")
        if debug["metrics"].get(m, {}).get("ok")
    ]
    latest_time = next((t for t in reversed(times) if t), now_iso())

    electricity_now = existing.get("electricity_now", {}) or {}
    electricity_now.update({
        "demand_mw": round(demand),
        "generation_mw": round(generation) if generation is not None else electricity_now.get("generation_mw"),
        "wind_mw": round(wind),
        "solar_mw": round(solar),
        "interconnection_mw": round(interconnection),
        "interconnection_direction": direction,
        "imports_mw": round(imports_mw),
        "exports_mw": round(exports_mw),
        "imports_percent": round(imports_pct, 1),
        "exports_percent": round(exports_pct, 1),
        "wind_percent": round(float(cover["wind"]), 1),
        "solar_percent": round(float(cover["solar"]), 1),
        "renewables_percent": round(float(cover["renewables"]), 1),
        "renewables_output_percent": round(float(cover["output"]), 1),
        "renewable_surplus_percent": round(float(cover["surplus"]), 1),
        "renewables_coverage_percent": round(float(cover["renewables"]), 1),
        "renewables_normalised": bool(cover["normalised"]),
        "renewables_model": "smartgrid_api_live_chart",
        "renewables_definition": "Wind plus solar cover of current demand from Smart Grid Dashboard API.",
        "residual_percent": round(residual, 1),
        "gas_percent": round(residual, 1),
        "gas_is_residual_proxy": True,
        "electricity_datetime": latest_time,
        "source_label": "Smart Grid Dashboard API",
        "source_url": debug["metrics"]["demand_mw"].get("url") or debug["metrics"]["generation_mw"].get("url"),
        "source_freshness": "live chart API",
        "data_age_hours": 0,
        "smartgrid_live_available": True,
        "smartgrid_api_live": True,
        "consistency_warnings": [],
    })

    existing["electricity_now"] = electricity_now
    existing.setdefault("source_status", {})
    existing["source_status"]["smartgrid_api_live"] = {
        "source": "Smart Grid Dashboard API",
        "source_url": "https://www.smartgriddashboard.com/",
        "harvested_at": now_iso(),
        "mode": "direct-api-live-chart",
        "region": REGION,
        "caveat": "Direct API calls derived from Smart Grid Dashboard chart requests.",
    }

    write_json(OUT, existing)
    write_json(DEBUG_OUT, debug)

    print("Wrote Smart Grid API live electricity values.")
    print(json.dumps({
        "demand_mw": electricity_now.get("demand_mw"),
        "generation_mw": electricity_now.get("generation_mw"),
        "wind_mw": electricity_now.get("wind_mw"),
        "solar_mw": electricity_now.get("solar_mw"),
        "interconnection_mw": electricity_now.get("interconnection_mw"),
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
