#!/usr/bin/env python3
"""
Ireland Energy Monitor: Smart Grid Dashboard live-ish HTML harvester.

Why this exists:
- The Smart Grid chart API is currently not returning usable demand rows in the
  scripted probe.
- The public dashboard pages themselves expose the latest server-rendered values.
- This script parses those visible values and overwrites the stale spreadsheet
  fallback only when it can prove a real value.

It remains conservative: no parsed value, no overwrite.
"""

from __future__ import annotations

import html
import json
import math
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEBUG = ROOT / "ops" / "debug"
ELECTRICITY_OUT = SOURCE / "electricity.json"
PROBE_OUT = DEBUG / "smartgrid_live_probe.json"

BASE = "https://www.smartgriddashboard.com"
SMARTGRID_LIVE_GRID_OVERWRITE = False

PAGES = {
    "demand": f"{BASE}/roi/demand/",
    "generation": f"{BASE}/roi/generation/",
    "wind": f"{BASE}/roi/wind/",
    "solar": f"{BASE}/roi/solar/",
    "interconnection": f"{BASE}/roi/interconnection/",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def is_number(value: Any) -> bool:
    try:
        return value is not None and math.isfinite(float(value))
    except Exception:
        return False


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


def fetch_html(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.37 (+https://salmonofdoubt.github.io/demos/ietm/)",
            "Accept": "text/html,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace")


def visible_lines(raw_html: str) -> list[str]:
    # Remove noisy script/style content, then turn tags into line breaks.
    s = re.sub(r"<script\b[^>]*>.*?</script>", "\n", raw_html, flags=re.I | re.S)
    s = re.sub(r"<style\b[^>]*>.*?</style>", "\n", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", "\n", s)
    s = html.unescape(s)

    lines = []
    for line in s.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)

    return lines


def parse_number(text: str) -> float | None:
    m = re.search(r"[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?", text)
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except Exception:
        return None


def norm(text: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", text.upper())


def find_value_after(
    lines: list[str],
    required_tokens: list[str],
    unit_hint: str | None = None,
    max_ahead: int = 12,
    reject_years: bool = True,
) -> dict | None:
    """
    Find first numeric value after a label window.
    Handles labels split across lines, e.g.:
      LATEST SYSTEM
      GENERATION
      2,820 MW
    """
    required = [norm(t) for t in required_tokens]

    for i in range(len(lines)):
        label_window = " ".join(lines[i:i + 4])
        label_norm = norm(label_window)

        if not all(t in label_norm for t in required):
            continue

        for j in range(i + 1, min(len(lines), i + max_ahead)):
            line = lines[j]
            neighbour = " ".join(lines[j:j + 2])

            if unit_hint and unit_hint.upper() not in neighbour.upper():
                # Allow split number/unit only if next line contains unit.
                continue

            value = parse_number(line)
            if value is None:
                continue

            if reject_years and 1900 <= value <= 2100 and unit_hint != "%":
                continue

            return {
                "value": value,
                "line": line,
                "line_index": j,
                "label_index": i,
            }

    return None


def page_last_updated(lines: list[str]) -> str | None:
    for line in lines:
        m = re.search(r"Last updated:\s*([0-9]{2}/[0-9]{2}/[0-9]{4})", line, flags=re.I)
        if m:
            return m.group(1)
    return None


def pct(part: float | None, whole: float | None) -> float:
    if part is None or whole is None or whole <= 0:
        return 0.0
    return max(0.0, part / whole * 100.0)


def normalise_renewable_contribution(wind_pct_raw: float | None, solar_pct_raw: float | None) -> dict:
    """
    Convert raw wind/solar output as % of demand into a domestic contribution model.

    Raw output may exceed 100% of demand during export/curtailment conditions.
    Public contribution cards must not exceed 100% because they describe what
    powered Irish demand, not total renewable output produced.
    """
    wind_raw = max(0.0, float(wind_pct_raw or 0.0))
    solar_raw = max(0.0, float(solar_pct_raw or 0.0))
    total_raw = wind_raw + solar_raw

    if total_raw <= 100.0:
        return {
            "wind_contribution": wind_raw,
            "solar_contribution": solar_raw,
            "renewable_contribution": total_raw,
            "renewable_output": total_raw,
            "renewable_surplus": 0.0,
            "normalised": False,
        }

    scale = 100.0 / total_raw

    return {
        "wind_contribution": wind_raw * scale,
        "solar_contribution": solar_raw * scale,
        "renewable_contribution": 100.0,
        "renewable_output": total_raw,
        "renewable_surplus": total_raw - 100.0,
        "normalised": True,
    }


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)

    existing = read_json(ELECTRICITY_OUT, {})
    electricity_now = existing.get("electricity_now", {})

    pages = {}
    probe = {
        "generated_at": now_iso(),
        "mode": "smartgrid-visible-html-parser",
        "pages": {},
        "selected": {},
    }

    for key, url in PAGES.items():
        try:
            raw = fetch_html(url)
            lines = visible_lines(raw)
            pages[key] = lines
            probe["pages"][key] = {
                "url": url,
                "line_count": len(lines),
                "last_updated": page_last_updated(lines),
                "sample": lines[:90],
            }
        except Exception as exc:
            pages[key] = []
            probe["pages"][key] = {
                "url": url,
                "error": str(exc),
            }

    demand = find_value_after(
        pages["demand"],
        ["system", "demand", "latest"],
        unit_hint="MW",
    )

    generation = find_value_after(
        pages["generation"],
        ["latest", "system", "generation"],
        unit_hint="MW",
    )

    thermal_pct = find_value_after(
        pages["generation"],
        ["thermal", "generation"],
        unit_hint="%",
        reject_years=False,
    )

    renewable_pct = find_value_after(
        pages["generation"],
        ["renewable", "generation"],
        unit_hint="%",
        reject_years=False,
    )

    net_import_pct = find_value_after(
        pages["generation"],
        ["net", "import"],
        unit_hint="%",
        reject_years=False,
    )

    wind_mw = find_value_after(
        pages["wind"],
        ["latest", "wind", "generation"],
        unit_hint="MW",
    )

    solar_mw = find_value_after(
        pages["solar"],
        ["latest", "solar", "generation"],
        unit_hint="MW",
    )

    ireland_interconnection_mw = find_value_after(
        pages["interconnection"],
        ["latest", "ireland"],
        unit_hint="MW",
    )

    selected = {
        "demand_mw": demand,
        "generation_mw": generation,
        "thermal_percent": thermal_pct,
        "renewable_percent": renewable_pct,
        "net_import_percent": net_import_pct,
        "wind_mw": wind_mw,
        "solar_mw": solar_mw,
        "ireland_interconnection_mw": ireland_interconnection_mw,
    }

    probe["selected"] = selected
    write_json(PROBE_OUT, probe)

    if not SMARTGRID_LIVE_GRID_OVERWRITE:
        existing.setdefault("source_status", {})
        existing["source_status"]["smartgrid_live"] = {
            "source": "EirGrid Smart Grid Dashboard public pages",
            "source_url": BASE,
            "harvested_at": now_iso(),
            "mode": "diagnostic-only",
            "caveat": (
                "Smart Grid visible-page parser is disabled for demand, wind and solar because "
                "visible-page scraping can confuse actual, forecast and chart values. "
                "Core grid quantities use the official EirGrid quarter-hourly workbook instead."
            ),
            "probe_file": str(PROBE_OUT.relative_to(ROOT)),
        }
        write_json(ELECTRICITY_OUT, existing)
        print("SmartGrid visible-page grid overwrite disabled. Keeping official EirGrid workbook values.")
        print(f"Probe written: {PROBE_OUT.relative_to(ROOT)}")
        return 0

    if not demand or not is_number(demand.get("value")):
        existing.setdefault("source_status", {})
        existing["source_status"]["smartgrid_live"] = {
            "source": "EirGrid Smart Grid Dashboard public pages",
            "source_url": PAGES["demand"],
            "harvested_at": now_iso(),
            "mode": "not-parsed",
            "caveat": "Could not parse visible latest demand value. Spreadsheet fallback remains in use.",
            "probe_file": str(PROBE_OUT.relative_to(ROOT)),
        }
        write_json(ELECTRICITY_OUT, existing)
        print("SmartGrid visible demand not parsed. Spreadsheet fallback remains.")
        print(f"Probe written: {PROBE_OUT.relative_to(ROOT)}")
        return 0

    demand_value = float(demand["value"])
    generation_value = float(generation["value"]) if generation and is_number(generation.get("value")) else None

    wind_value = float(wind_mw["value"]) if wind_mw and is_number(wind_mw.get("value")) else None
    solar_value = float(solar_mw["value"]) if solar_mw and is_number(solar_mw.get("value")) else None

    # Interconnection page convention: positive = importing, negative = exporting.
    interconnection_mw = None
    imports_mw = None
    exports_mw = None

    if ireland_interconnection_mw and is_number(ireland_interconnection_mw.get("value")):
        interconnection_mw = float(ireland_interconnection_mw["value"])
        imports_mw = max(interconnection_mw, 0.0)
        exports_mw = max(-interconnection_mw, 0.0)

    # Public "Electricity now" model:
    # top cards show estimated contribution to Irish demand, never >100%.
    # Raw output-vs-demand is still stored separately because it may exceed 100%
    # during export/curtailment conditions.
    wind_percent_raw = pct(wind_value, demand_value) if wind_value is not None else None
    solar_percent_raw = pct(solar_value, demand_value) if solar_value is not None else None

    if wind_percent_raw is not None or solar_percent_raw is not None:
        renewable_model = normalise_renewable_contribution(wind_percent_raw, solar_percent_raw)

        wind_percent_calc = renewable_model["wind_contribution"]
        solar_percent_calc = renewable_model["solar_contribution"]
        renewables_percent = renewable_model["renewable_contribution"]
        renewables_output_percent = renewable_model["renewable_output"]
        renewable_surplus_percent = renewable_model["renewable_surplus"]
        renewables_normalised = renewable_model["normalised"]
        renewables_model = "normalised_domestic_contribution_from_wind_solar_output"
    else:
        renewables_percent = (
            float(renewable_pct["value"])
            if renewable_pct and is_number(renewable_pct.get("value"))
            else min(100.0, pct((wind_value or 0) + (solar_value or 0), demand_value))
        )
        wind_percent_calc = electricity_now.get("wind_percent")
        solar_percent_calc = electricity_now.get("solar_percent")
        renewables_output_percent = renewables_percent
        renewable_surplus_percent = 0.0
        renewables_normalised = False
        renewables_model = "dashboard_renewable_percent_fallback"

    imports_percent = (
        float(net_import_pct["value"])
        if net_import_pct and is_number(net_import_pct.get("value"))
        else pct(imports_mw, demand_value)
    )

    # Public display should never show negative import shares.
    # Negative interconnection means export, not “minus imports”.
    imports_percent = max(0.0, min(100.0, imports_percent))
    exports_percent = pct(exports_mw, demand_value) if exports_mw is not None else 0.0

    if interconnection_mw is None or abs(interconnection_mw) < 1:
        interconnection_direction = "near balanced"
    elif interconnection_mw > 0:
        interconnection_direction = "importing"
    else:
        interconnection_direction = "exporting"

    # Residual is a computed remainder, not measured gas and not the dashboard
    # thermal percentage.
    domestic_supply_known = min(100.0, renewables_percent + imports_percent)
    residual_percent = max(0.0, 100.0 - domestic_supply_known)

    dashboard_thermal_percent = (
        float(thermal_pct["value"])
        if thermal_pct and is_number(thermal_pct.get("value"))
        else None
    )
    dashboard_renewable_percent = (
        float(renewable_pct["value"])
        if renewable_pct and is_number(renewable_pct.get("value"))
        else None
    )

    wind_percent = wind_percent_calc if wind_percent_calc is not None else electricity_now.get("wind_percent")
    solar_percent = solar_percent_calc if solar_percent_calc is not None else electricity_now.get("solar_percent")

    consistency_warnings = []

    if is_number(wind_percent_raw) and is_number(solar_percent_raw):
        raw_total = float(wind_percent_raw or 0) + float(solar_percent_raw or 0)
        if raw_total > 105 and (exports_mw or 0) <= 0:
            consistency_warnings.append(
                "Wind+solar output exceeds demand but no export was parsed. Check Smart Grid parsing."
            )

    if is_number(renewables_percent) and is_number(residual_percent):
        total_known = float(renewables_percent) + float(imports_percent or 0) + float(residual_percent)
        if abs(total_known - 100.0) > 2.0:
            consistency_warnings.append(
                f"Displayed contribution stack does not sum to 100: {total_known:.1f}%."
            )

    electricity_now.update({
        "demand_mw": round(demand_value),
        "generation_mw": round(generation_value) if generation_value is not None else electricity_now.get("generation_mw"),
        "wind_mw": round(wind_value) if wind_value is not None else electricity_now.get("wind_mw"),
        "solar_mw": round(solar_value) if solar_value is not None else electricity_now.get("solar_mw"),
        "interconnection_mw": round(interconnection_mw) if interconnection_mw is not None else electricity_now.get("interconnection_mw"),
        "interconnection_direction": interconnection_direction,
        "imports_mw": round(imports_mw) if imports_mw is not None else electricity_now.get("imports_mw"),
        "exports_mw": round(exports_mw) if exports_mw is not None else electricity_now.get("exports_mw"),
        "exports_percent": round(exports_percent, 1),
        "renewables_percent": round(renewables_percent, 1),
        "renewables_output_percent": round(renewables_output_percent, 1),
        "renewable_surplus_percent": round(renewable_surplus_percent, 1),
        "renewables_coverage_percent": round(renewables_percent, 1),
        "renewables_normalised": bool(renewables_normalised),
        "renewables_model": renewables_model,
        "dashboard_thermal_percent": round(dashboard_thermal_percent, 1) if dashboard_thermal_percent is not None else None,
        "dashboard_renewable_percent": round(dashboard_renewable_percent, 1) if dashboard_renewable_percent is not None else None,
        "wind_percent": round(float(wind_percent), 1) if is_number(wind_percent) else electricity_now.get("wind_percent"),
        "solar_percent": round(float(solar_percent), 1) if is_number(solar_percent) else electricity_now.get("solar_percent"),
        "imports_percent": round(imports_percent, 1),
        "residual_percent": round(residual_percent, 1),
        "gas_percent": round(residual_percent, 1),
        "electricity_datetime": now_iso(),
        "data_age_hours": 0,
        "source_freshness": "current",
        "source_label": "EirGrid Smart Grid Dashboard public pages",
        "renewables_definition": "Estimated wind plus solar contribution to Irish demand, capped at 100%; raw output is stored separately.",
        "smartgrid_live_available": True,
        "smartgrid_live_harvested_at": now_iso(),
        "smartgrid_html_parser": True,
        "consistency_warnings": consistency_warnings,
    })

    existing["electricity_now"] = electricity_now
    existing.setdefault("source_status", {})
    existing["source_status"]["smartgrid_live"] = {
        "source": "EirGrid Smart Grid Dashboard public pages",
        "source_url": BASE,
        "harvested_at": now_iso(),
        "mode": "visible-html-parser",
        "caveat": (
            "Latest values are parsed from public Smart Grid Dashboard pages. "
            "Demand and generation are current dashboard readouts; renewable/thermal/import percentages use the dashboard generation fuel-mix readout where available."
        ),
        "probe_file": str(PROBE_OUT.relative_to(ROOT)),
        "selected": {
            k: v for k, v in selected.items()
            if isinstance(v, dict)
        },
    }

    write_json(ELECTRICITY_OUT, existing)

    print("Wrote SmartGrid visible-page electricity values")
    print(json.dumps({
        "demand_mw": electricity_now.get("demand_mw"),
        "generation_mw": electricity_now.get("generation_mw"),
        "wind_mw": electricity_now.get("wind_mw"),
        "solar_mw": electricity_now.get("solar_mw"),
        "imports_mw": electricity_now.get("imports_mw"),
        "renewables_percent": electricity_now.get("renewables_percent"),
        "wind_percent": electricity_now.get("wind_percent"),
        "solar_percent": electricity_now.get("solar_percent"),
        "imports_percent": electricity_now.get("imports_percent"),
        "residual_percent": electricity_now.get("residual_percent"),
        "source_label": electricity_now.get("source_label"),
    }, indent=2))
    print(f"Probe written: {PROBE_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
