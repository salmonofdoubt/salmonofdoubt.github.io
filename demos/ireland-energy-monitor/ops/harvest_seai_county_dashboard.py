#!/usr/bin/env python3
"""
SEAI county dashboard ingestion layer.

This imports a local SEAI dashboard export CSV if present:

  data/source/seai_county_dashboard_values.csv

Expected flexible columns:
  county
  total_mwh
  mwh_per_km2
  population_density_normalised
  wind_mwh
  solar_mwh
  biomass_mwh
  hydro_mwh
  period

If the CSV is absent, it falls back to the existing schematic builder.
This prevents fake official-looking values while making real-data mode ready.
"""

from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
IN_CSV = SOURCE / "seai_county_dashboard_values.csv"
OUT = SOURCE / "county_hosting.json"
FALLBACK_BUILDER = ROOT / "ops" / "build_county_hosting.py"

SOURCE_NAME = "SEAI Renewable Electricity County Dashboard"
SOURCE_URL = "https://www.seai.ie/renewable-energy/renewable-electricity/about-dashboard"


ALIASES = {
    "county": ["county", "county_name", "name", "local_authority"],
    "period": ["period", "month", "date", "year_month"],
    "total_mwh": ["total_mwh", "renewable_mwh", "mwh", "total_renewable_electricity_mwh", "total"],
    "mwh_per_km2": ["mwh_per_km2", "mwh_km2", "mwh_per_sq_km", "mwh/km2", "mwh_per_square_km"],
    "population_density_normalised": [
        "population_density_normalised",
        "pop_density_normalised",
        "mwh_x_pop_density",
        "mwh_population_density",
        "population_normalised"
    ],
    "wind_mwh": ["wind_mwh", "wind", "wind_generation_mwh"],
    "solar_mwh": ["solar_mwh", "solar", "solar_generation_mwh"],
    "biomass_mwh": ["biomass_mwh", "biomass", "biomass_generation_mwh"],
    "hydro_mwh": ["hydro_mwh", "hydro", "hydro_generation_mwh"],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def norm(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value or "")).strip("_")


def to_float(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    try:
        out = float(text)
        return out if math.isfinite(out) else None
    except ValueError:
        return None


def get_value(row: dict[str, Any], field: str) -> Any:
    wanted = {norm(x) for x in ALIASES[field]}
    for key, value in row.items():
        if norm(key) in wanted:
            return value
    return None


def minmax(value: float | None, values: list[float]) -> float:
    if value is None or not values:
        return 0.0
    lo = min(values)
    hi = max(values)
    if hi == lo:
        return 50.0
    return (value - lo) / (hi - lo) * 100.0


def bucket(score: float) -> str:
    if score >= 80:
        return "very-high"
    if score >= 65:
        return "high"
    if score >= 50:
        return "medium"
    if score >= 35:
        return "low"
    return "very-low"


def status(score: float) -> str:
    if score >= 75:
        return "High host"
    if score >= 50:
        return "Moderate host"
    return "Low host / demand-adjacent"


def dominant_tech(row: dict[str, Any]) -> str:
    techs = {
        "Wind": row.get("wind_mwh"),
        "Solar": row.get("solar_mwh"),
        "Biomass": row.get("biomass_mwh"),
        "Hydro": row.get("hydro_mwh"),
    }
    usable = {k: v for k, v in techs.items() if isinstance(v, (int, float)) and v > 0}
    if not usable:
        return "Mixed / not specified"
    return max(usable.items(), key=lambda kv: kv[1])[0]


def load_existing_tile_positions() -> dict[str, dict[str, Any]]:
    existing = {}
    if OUT.exists():
        try:
            data = json.loads(OUT.read_text())
            for county in data.get("counties", []):
                existing[county["name"].lower()] = {
                    "code": county.get("code"),
                    "row": county.get("row"),
                    "col": county.get("col"),
                }
        except Exception:
            pass
    return existing


def read_csv() -> list[dict[str, Any]]:
    with IN_CSV.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = []

        for raw in reader:
            county = str(get_value(raw, "county") or "").strip()
            if not county:
                continue

            rows.append({
                "name": county,
                "period": str(get_value(raw, "period") or "").strip() or None,
                "total_mwh": to_float(get_value(raw, "total_mwh")),
                "mwh_per_km2": to_float(get_value(raw, "mwh_per_km2")),
                "population_density_normalised": to_float(get_value(raw, "population_density_normalised")),
                "wind_mwh": to_float(get_value(raw, "wind_mwh")),
                "solar_mwh": to_float(get_value(raw, "solar_mwh")),
                "biomass_mwh": to_float(get_value(raw, "biomass_mwh")),
                "hydro_mwh": to_float(get_value(raw, "hydro_mwh")),
            })

    return rows


def build_from_csv(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tile_positions = load_existing_tile_positions()

    totals = [r["total_mwh"] for r in rows if r.get("total_mwh") is not None]
    per_area = [r["mwh_per_km2"] for r in rows if r.get("mwh_per_km2") is not None]
    pop_norm = [
        r["population_density_normalised"]
        for r in rows
        if r.get("population_density_normalised") is not None
    ]

    counties = []
    for r in rows:
        total_score = minmax(r.get("total_mwh"), totals)
        area_score = minmax(r.get("mwh_per_km2"), per_area)
        pop_score = minmax(r.get("population_density_normalised"), pop_norm)

        # If only total_mwh exists, total carries the score.
        if not per_area and not pop_norm:
            hosting_score = total_score
        else:
            hosting_score = (0.45 * total_score) + (0.35 * area_score) + (0.20 * pop_score)

        hosting_score = round(hosting_score)

        pos = tile_positions.get(r["name"].lower(), {})
        counties.append({
            "name": r["name"],
            "code": pos.get("code") or r["name"][:2].upper(),
            "row": pos.get("row") or 1,
            "col": pos.get("col") or 1,
            "hosting_score": hosting_score,
            "score": hosting_score,
            "heat_bucket": bucket(hosting_score),
            "hosting_status": status(hosting_score),
            "dominant_technology": dominant_tech(r),
            "period": r.get("period"),
            "total_mwh": r.get("total_mwh"),
            "mwh_per_km2": r.get("mwh_per_km2"),
            "population_density_normalised": r.get("population_density_normalised"),
            "wind_mwh": r.get("wind_mwh"),
            "solar_mwh": r.get("solar_mwh"),
            "biomass_mwh": r.get("biomass_mwh"),
            "hydro_mwh": r.get("hydro_mwh"),
            "note": "Imported from local SEAI dashboard export CSV.",
            "interpretation": "Hosting score calculated from available SEAI county metrics.",
        })

    top = sorted(counties, key=lambda x: x["hosting_score"], reverse=True)[:5]
    low = sorted(counties, key=lambda x: x["hosting_score"])[:5]
    periods = sorted({c.get("period") for c in counties if c.get("period")})

    return {
        "county_hosting": {
            "title": "County Hosting Index",
            "mode": "official-seai-export",
            "generated_at": now_iso(),
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "period": ", ".join(periods) if periods else "not specified",
            "caveat": (
                "Imported from local SEAI dashboard export CSV. SEAI describes the dashboard as beta; "
                "some generation values may be estimated and should not be used for official reporting."
            ),
            "method": {
                "index": "0 to 100 score from total MWh, MWh/km² and population-density-normalised metrics where present",
                "display": "Schematic tile heatmap, not boundary-accurate geography",
                "weights": {
                    "total_mwh": 0.45,
                    "mwh_per_km2": 0.35,
                    "population_density_normalised": 0.20
                }
            },
            "summary": {
                "highest_hosts": [c["name"] for c in top],
                "lowest_hosts": [c["name"] for c in low],
                "spatial_question": "Who hosts renewable infrastructure, who consumes electricity, and where is the transition uneven?"
            }
        },
        "counties": counties,
        "source_status": {
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "harvested_at": now_iso(),
            "mode": "local-official-export-csv",
            "input_file": str(IN_CSV.relative_to(ROOT)),
            "row_count": len(counties),
            "caveat": "SEAI beta dashboard values imported from local CSV export."
        }
    }


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)

    if not IN_CSV.exists():
        print(f"{IN_CSV.relative_to(ROOT)} not found; using schematic fallback.")
        subprocess.run([sys.executable, str(FALLBACK_BUILDER)], check=True)
        return 0

    rows = read_csv()
    if not rows:
        raise SystemExit(f"{IN_CSV.relative_to(ROOT)} exists but contains no county rows.")

    payload = build_from_csv(rows)
    OUT.write_text(json.dumps(payload, indent=2) + "\n")

    print(f"Wrote {OUT.relative_to(ROOT)} from {IN_CSV.relative_to(ROOT)}")
    print(f"Rows imported: {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
