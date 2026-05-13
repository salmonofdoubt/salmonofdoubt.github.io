#!/usr/bin/env python3
"""
Ireland Energy Monitor: Smart Grid Dashboard live electricity harvester.

Purpose:
- Use EirGrid Smart Grid Dashboard chart API as the preferred current operational source.
- Keep the older EirGrid quarterly spreadsheet as fallback.
- Never fabricate values. If no live row is parsed, leave existing electricity.json intact.

This script is deliberately exploratory but safe. It writes a debug probe so we can see
which chartType/areas combinations returned data.
"""

from __future__ import annotations

import json
import math
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEBUG = ROOT / "ops" / "debug"
ELECTRICITY_OUT = SOURCE / "electricity.json"
PROBE_OUT = DEBUG / "smartgrid_live_probe.json"

API = "https://www.smartgriddashboard.com/api/chart/"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def is_number(value: Any) -> bool:
    try:
        return value is not None and math.isfinite(float(value))
    except Exception:
        return False


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def read_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text())
    except Exception:
        return fallback


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")


def fetch_json(url: str, timeout: int = 30) -> Any:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyMonitor/0.34 (+https://salmonofdoubt.github.io/demos/ireland-energy-monitor/)",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))


def chart_url(day: datetime, chart_type: str, areas: str) -> str:
    date = day.strftime("%d-%b-%Y")
    params = {
        "region": "ROI",
        "chartType": chart_type,
        "dateRange": "day",
        "dateFrom": f"{date} 00:00",
        "dateTo": f"{date} 23:59",
        "areas": areas,
    }
    return f"{API}?{urllib.parse.urlencode(params)}"


def extract_rows(payload: Any) -> list[dict]:
    if isinstance(payload, dict):
        rows = payload.get("Rows") or payload.get("rows") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []

    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        field = str(
            row.get("FieldName")
            or row.get("fieldName")
            or row.get("field")
            or row.get("name")
            or ""
        ).upper()

        value = (
            row.get("Value")
            if "Value" in row
            else row.get("value")
            if "value" in row
            else row.get("Y")
            if "Y" in row
            else None
        )

        n = to_float(value)
        if n is None:
            continue

        time = (
            row.get("EffectiveTime")
            or row.get("effectiveTime")
            or row.get("time")
            or row.get("DateTime")
            or row.get("dateTime")
            or ""
        )

        out.append({
            "field": field,
            "value": n,
            "time": str(time),
        })

    return out


def latest_by_field(rows: list[dict]) -> dict[str, dict]:
    latest: dict[str, dict] = {}
    for row in rows:
        field = row.get("field") or ""
        if not field:
            continue
        latest[field] = row
    return latest


def find_value(latest: dict[str, dict], required_terms: list[str], avoid_terms: list[str] | None = None) -> dict | None:
    avoid_terms = avoid_terms or []

    candidates = []
    for field, row in latest.items():
        f = field.upper()
        if all(term.upper() in f for term in required_terms) and not any(term.upper() in f for term in avoid_terms):
            candidates.append(row)

    if not candidates:
        return None

    return candidates[-1]


def pct(part: float | None, whole: float | None) -> float:
    if part is None or whole is None or whole <= 0:
        return 0.0
    return max(0.0, min(100.0, part / whole * 100.0))


def try_chart(day: datetime, chart_type: str, areas: str) -> dict:
    url = chart_url(day, chart_type, areas)
    try:
        payload = fetch_json(url)
        rows = extract_rows(payload)
        fields = sorted({r["field"] for r in rows if r.get("field")})
        return {
            "ok": True,
            "url": url,
            "chart_type": chart_type,
            "areas": areas,
            "row_count": len(rows),
            "fields": fields,
            "rows": rows[-20:],
        }
    except Exception as exc:
        return {
            "ok": False,
            "url": url,
            "chart_type": chart_type,
            "areas": areas,
            "error": str(exc),
            "row_count": 0,
            "fields": [],
            "rows": [],
        }


def collect_live_rows() -> tuple[list[dict], list[dict]]:
    today = datetime.now(timezone.utc)
    days = [today, today - timedelta(days=1)]

    candidates = [
        # Demand
        ("demand", "systemdemandactual,systemdemandforecast"),
        ("demand", "systemdemand,systemdemandforecast"),
        ("demand", "demand,demandforecast"),
        ("demand", "system-demand-actual,system-demand-forecast"),
        ("demand", "demand"),

        # Generation
        ("generation", "systemgenerationactual,systemgenerationforecast"),
        ("generation", "systemgeneration,systemgenerationforecast"),
        ("generation", "generation,generationforecast"),
        ("generation", "generation"),

        # Wind
        ("wind", "windactual,windforecast"),
        ("wind", "windgenerationactual,windgenerationforecast"),
        ("wind", "wind"),

        # Solar
        ("solar", "solaractual,solarforecast"),
        ("solar", "solargenerationactual,solargenerationforecast"),
        ("solar", "solar"),

        # Interconnection
        ("interconnection", "netinterconnection,ewicinterconnection,greenlinkinterconnection,moyleinterconnection"),
        ("interconnection", "interconnection"),
        ("interconnection", "netinterconnection"),
    ]

    probe = []
    rows_all = []

    for day in days:
        for chart_type, areas in candidates:
            result = try_chart(day, chart_type, areas)
            probe.append({k: v for k, v in result.items() if k != "rows"})
            if result["row_count"]:
                rows_all.extend(result["rows"])

    DEBUG.mkdir(parents=True, exist_ok=True)
    write_json(PROBE_OUT, {
        "generated_at": now_iso(),
        "note": "Last 20 rows per successful query only. Used to discover Smart Grid Dashboard API fields.",
        "queries": probe,
    })

    return rows_all, probe


def main() -> int:
    existing = read_json(ELECTRICITY_OUT, {})
    electricity_now = existing.get("electricity_now", {})

    rows, probe = collect_live_rows()
    latest = latest_by_field(rows)

    demand_row = (
        find_value(latest, ["SYSTEM", "DEMAND"], ["FORECAST"])
        or find_value(latest, ["DEMAND"], ["FORECAST"])
    )

    generation_row = (
        find_value(latest, ["ACTUAL", "SYSTEM", "GENERATION"], ["FORECAST"])
        or find_value(latest, ["SYSTEM", "GENERATION"], ["FORECAST"])
        or find_value(latest, ["GENERATION"], ["FORECAST"])
    )

    wind_row = (
        find_value(latest, ["WIND", "ACTUAL"], ["FORECAST"])
        or find_value(latest, ["WIND"], ["FORECAST"])
    )

    solar_row = (
        find_value(latest, ["SOLAR", "ACTUAL"], ["FORECAST"])
        or find_value(latest, ["SOLAR"], ["FORECAST"])
    )

    inter_net_row = (
        find_value(latest, ["INTER", "NET", "ROI"])
        or find_value(latest, ["INTER", "NET"])
        or find_value(latest, ["NET", "INTER"])
    )

    inter_component_rows = [
        row for field, row in latest.items()
        if any(term in field.upper() for term in ["INTER_EWIC", "INTER_GRNLK", "INTER_GREENLINK", "INTER_MOYLE", "EWIC", "GREENLINK", "MOYLE"])
    ]

    demand = demand_row["value"] if demand_row else None
    generation = generation_row["value"] if generation_row else None
    wind = wind_row["value"] if wind_row else None
    solar = solar_row["value"] if solar_row else None

    imports = None
    if inter_net_row:
        imports = max(float(inter_net_row["value"]), 0.0)
    elif inter_component_rows:
        positives = [float(r["value"]) for r in inter_component_rows if is_number(r.get("value")) and float(r["value"]) > 0]
        imports = sum(positives) if positives else None

    # Only overwrite when we have a proven live demand row.
    if not is_number(demand):
        existing.setdefault("source_status", {})
        existing["source_status"]["smartgrid_live"] = {
            "source": "EirGrid Smart Grid Dashboard chart API",
            "harvested_at": now_iso(),
            "mode": "not-parsed",
            "caveat": "No live demand row was parsed. Spreadsheet fallback remains in use.",
            "probe_file": str(PROBE_OUT.relative_to(ROOT)),
            "successful_query_count": sum(1 for q in probe if q.get("row_count", 0) > 0),
        }
        write_json(ELECTRICITY_OUT, existing)
        print("SmartGrid live demand not parsed. Kept spreadsheet fallback.")
        print(f"Wrote {PROBE_OUT.relative_to(ROOT)}")
        return 0

    demand = float(demand)
    wind = float(wind) if is_number(wind) else float(electricity_now.get("wind_mw") or 0)
    solar = float(solar) if is_number(solar) else float(electricity_now.get("solar_mw") or 0)
    imports = float(imports) if is_number(imports) else float(electricity_now.get("imports_mw") or 0)

    wind_pct = pct(wind, demand)
    solar_pct = pct(solar, demand)
    imports_pct = pct(imports, demand)
    residual_pct = max(0.0, min(100.0, 100.0 - wind_pct - solar_pct - imports_pct))
    renewables_pct = max(0.0, min(100.0, wind_pct + solar_pct))

    source_time = demand_row.get("time") or now_iso()

    electricity_now.update({
        "demand_mw": round(demand),
        "generation_mw": round(generation) if is_number(generation) else electricity_now.get("generation_mw"),
        "wind_mw": round(wind),
        "solar_mw": round(solar),
        "imports_mw": round(imports),
        "renewables_percent": round(renewables_pct, 1),
        "wind_percent": round(wind_pct, 1),
        "solar_percent": round(solar_pct, 1),
        "imports_percent": round(imports_pct, 1),
        "residual_percent": round(residual_pct, 1),
        "gas_percent": round(residual_pct, 1),
        "electricity_datetime": source_time,
        "data_age_hours": 0,
        "source_freshness": "current",
        "source_label": "EirGrid Smart Grid Dashboard chart API",
        "smartgrid_live_available": True,
        "smartgrid_live_harvested_at": now_iso(),
    })

    existing["electricity_now"] = electricity_now
    existing.setdefault("source_status", {})
    existing["source_status"]["smartgrid_live"] = {
        "source": "EirGrid Smart Grid Dashboard chart API",
        "source_url": API,
        "harvested_at": now_iso(),
        "mode": "api-chart",
        "caveat": "Live chart API used for current demand/generation values where rows are parsed. Spreadsheet remains fallback.",
        "probe_file": str(PROBE_OUT.relative_to(ROOT)),
        "parsed_fields": sorted(latest.keys()),
        "demand_field": demand_row.get("field") if demand_row else None,
        "wind_field": wind_row.get("field") if wind_row else None,
        "solar_field": solar_row.get("field") if solar_row else None,
        "interconnection_field": inter_net_row.get("field") if inter_net_row else "components" if inter_component_rows else None,
    }

    write_json(ELECTRICITY_OUT, existing)

    print("Wrote SmartGrid live electricity values")
    print(json.dumps({
        "demand_mw": electricity_now.get("demand_mw"),
        "wind_percent": electricity_now.get("wind_percent"),
        "solar_percent": electricity_now.get("solar_percent"),
        "imports_percent": electricity_now.get("imports_percent"),
        "residual_percent": electricity_now.get("residual_percent"),
        "source_time": source_time,
        "parsed_fields": sorted(latest.keys())[:40],
    }, indent=2))
    print(f"Probe: {PROBE_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
