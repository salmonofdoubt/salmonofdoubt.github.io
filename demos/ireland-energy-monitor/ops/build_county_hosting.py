#!/usr/bin/env python3
"""
Builds a County Hosting Index scaffold for Ireland Energy Monitor.

This first version is a clearly labelled schematic index, not official county MWh.
It creates a tile heatmap and summary cards. Later, replace the scaffold scores
with harvested SEAI Renewable Electricity County Dashboard values:
- total renewable electricity generation
- MWh/km²
- production normalised by population density
- technology split: wind / solar / biomass / hydro
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUT = SOURCE / "county_hosting.json"

SOURCE_NAME = "SEAI Renewable Electricity County Dashboard"
SOURCE_URL = "https://www.seai.ie/renewable-energy/renewable-electricity/about-dashboard"


COUNTIES = [
    # name, code, score, dominant, row, col, note
    ("Donegal", "DL", 82, "Wind", 1, 3, "Strong northern/western hosting signal."),
    ("Sligo", "SO", 66, "Wind", 2, 3, "Western renewable hosting signal."),
    ("Leitrim", "LM", 64, "Wind", 2, 4, "Small county, visible hosting role."),
    ("Cavan", "CN", 48, "Mixed", 2, 5, "Moderate inland hosting signal."),
    ("Monaghan", "MN", 38, "Mixed", 2, 6, "Lower scaffold hosting score."),
    ("Louth", "LH", 32, "Mixed", 3, 7, "Demand-adjacent eastern county."),
    ("Mayo", "MO", 73, "Wind", 3, 2, "High western hosting potential."),
    ("Roscommon", "RN", 70, "Wind", 3, 4, "Inland renewable hosting signal."),
    ("Longford", "LD", 44, "Mixed", 3, 5, "Moderate scaffold hosting score."),
    ("Meath", "MH", 58, "Mixed", 4, 6, "Infrastructure and demand tension."),
    ("Westmeath", "WH", 46, "Mixed", 4, 5, "Central county, moderate signal."),
    ("Galway", "GY", 78, "Wind", 4, 2, "Strong western wind contribution."),
    ("Dublin", "D", 22, "Demand", 5, 7, "High demand, low local generation hosting."),
    ("Kildare", "KE", 36, "Mixed", 5, 6, "Demand-adjacent, lower hosting signal."),
    ("Offaly", "OY", 55, "Mixed", 5, 5, "Transition county with infrastructure relevance."),
    ("Clare", "CE", 69, "Wind", 6, 2, "Western renewable hosting signal."),
    ("Laois", "LS", 41, "Mixed", 6, 5, "Moderate scaffold hosting score."),
    ("Wicklow", "WW", 35, "Mixed", 6, 7, "Eastern demand-adjacent county."),
    ("Limerick", "LK", 58, "Mixed", 7, 3, "Mid-west hosting and demand interface."),
    ("Tipperary", "TY", 72, "Wind/Solar", 7, 4, "Large inland county with strong hosting signal."),
    ("Kilkenny", "KK", 43, "Mixed", 7, 5, "Moderate scaffold hosting score."),
    ("Carlow", "CW", 33, "Mixed", 7, 6, "Smaller eastern/inland county."),
    ("Kerry", "KY", 92, "Wind", 8, 2, "Very strong western hosting signal."),
    ("Cork", "CK", 86, "Wind/Solar", 8, 3, "Large county with major system role."),
    ("Waterford", "WD", 47, "Mixed", 8, 5, "South-east mixed hosting signal."),
    ("Wexford", "WX", 40, "Wind/Solar", 8, 6, "South-east coastal hosting signal."),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def bucket(score: int) -> str:
    if score >= 80:
        return "very-high"
    if score >= 65:
        return "high"
    if score >= 50:
        return "medium"
    if score >= 35:
        return "low"
    return "very-low"


def status(score: int) -> str:
    if score >= 75:
        return "High host"
    if score >= 50:
        return "Moderate host"
    return "Low host / demand-adjacent"


def main() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)

    counties = []
    for name, code, score, dominant, row, col, note in COUNTIES:
        counties.append({
            "name": name,
            "code": code,
            "hosting_score": score,
            "score": score,
            "heat_bucket": bucket(score),
            "hosting_status": status(score),
            "dominant_technology": dominant,
            "row": row,
            "col": col,
            "note": note,
            "interpretation": (
                "Scaffold index for display only. Replace with SEAI county production metrics."
            ),
        })

    top = sorted(counties, key=lambda x: x["hosting_score"], reverse=True)[:5]
    low = sorted(counties, key=lambda x: x["hosting_score"])[:5]

    payload = {
        "county_hosting": {
            "title": "County Hosting Index",
            "mode": "schematic-scaffold",
            "generated_at": now_iso(),
            "source": SOURCE_NAME,
            "source_url": SOURCE_URL,
            "caveat": (
                "Schematic heatmap scaffold, not official county MWh. Intended to be replaced with "
                "SEAI county dashboard values for total MWh, MWh/km² and population-density normalisation."
            ),
            "method": {
                "index": "0 to 100 illustrative hosting score",
                "display": "Schematic tile heatmap, not boundary-accurate geography",
                "next_step": "Harvest or manually curate SEAI county MWh and normalised county metrics."
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
            "mode": "scaffold",
            "caveat": "SEAI beta dashboard integration pending."
        }
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
