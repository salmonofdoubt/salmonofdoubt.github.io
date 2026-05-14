from __future__ import annotations

import json
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
OUT = APP / "data" / "source" / "demand_pressure_forecast.json"

YEARS = list(range(2024, 2031))
TARGET_SHARE = 0.80
TWH_PER_YEAR_TO_MW_AVG = 114.08

# Transparent denominator estimate for translating extra renewable TWh into
# an equivalent percentage-point burden on the 2030 RES-E catch-up task.
# 2024 total demand is inferred from data-centre demand and its approximate
# share of metered electricity.
DC_SHARE_2024_OF_TOTAL_DEMAND = 0.22
DC_2024_TWH = 6.97
EV_2024_TWH = 0.45
TOTAL_ELECTRICITY_DEMAND_2024_TWH = DC_2024_TWH / DC_SHARE_2024_OF_TOTAL_DEMAND
NON_DC_EV_BASELINE_DEMAND_TWH = TOTAL_ELECTRICITY_DEMAND_2024_TWH - DC_2024_TWH - EV_2024_TWH

# Scenario philosophy:
# - 2024 is the baseline year.
# - 2025 data-centre value is treated as near-term forecast / known shock.
# - 2026-2030 are transparent scenario assumptions, not official forecasts.
# - EV values are scenario assumptions based on modelled fleet electricity growth.
ASSUMPTIONS = {
    "data_centres": {
        "unit": "TWh/year",
        "basis": "Irish data-centre electricity demand. 2024 measured/known anchor and 2025 near-term forecast are followed by scenario paths.",
        "confidence": {
            "2024": "high",
            "2025": "medium",
            "2026_2030": "scenario"
        },
        "values": {
            "low": {
                "label": "Constrained / plateau",
                "description": "Data-centre demand reaches the known 2025 forecast and then plateaus.",
                "anchors": {2024: 6.97, 2025: 9.40, 2030: 9.40}
            },
            "central": {
                "label": "Managed growth",
                "description": "Moderate continued growth after the 2025 forecast.",
                "anchors": {2024: 6.97, 2025: 9.40, 2030: 11.50}
            },
            "high": {
                "label": "AI / high-growth pressure",
                "description": "Rapid AI-related expansion after the 2025 forecast, constrained but still high.",
                "anchors": {2024: 6.97, 2025: 9.40, 2030: 14.00}
            }
        }
    },
    "evs": {
        "unit": "TWh/year",
        "basis": "Modelled EV fleet electricity demand. Paths are scenario assumptions, not official forecasts.",
        "confidence": {
            "2024": "medium",
            "2025_2030": "scenario"
        },
        "values": {
            "low": {
                "label": "Slow uptake",
                "description": "Slow EV electricity-demand growth toward 2030.",
                "anchors": {2024: 0.45, 2030: 1.20}
            },
            "central": {
                "label": "Policy-aligned uptake",
                "description": "Steady EV electricity-demand growth toward 2030.",
                "anchors": {2024: 0.45, 2030: 2.00}
            },
            "high": {
                "label": "Accelerated electrification",
                "description": "Rapid EV electricity-demand growth toward 2030.",
                "anchors": {2024: 0.45, 2030: 3.00}
            }
        }
    }
}


def interpolate(anchors: dict[int, float], years: list[int]) -> dict[str, float]:
    known_years = sorted(anchors)
    out: dict[str, float] = {}

    for year in years:
        if year in anchors:
            out[str(year)] = round(float(anchors[year]), 3)
            continue

        lower = max(y for y in known_years if y < year)
        upper = min(y for y in known_years if y > year)

        frac = (year - lower) / (upper - lower)
        value = anchors[lower] + frac * (anchors[upper] - anchors[lower])
        out[str(year)] = round(value, 3)

    return out


def renewable_burden_mw(extra_demand_twh: float) -> float:
    return extra_demand_twh * TARGET_SHARE * TWH_PER_YEAR_TO_MW_AVG


drivers: dict[str, dict] = {}

for driver, driver_data in ASSUMPTIONS.items():
    scenarios = {}

    for scenario, scenario_data in driver_data["values"].items():
        series = interpolate(scenario_data["anchors"], YEARS)
        scenarios[scenario] = {
            "label": scenario_data["label"],
            "description": scenario_data["description"],
            "values_twh_per_year": series
        }

    drivers[driver] = {
        "unit": driver_data["unit"],
        "basis": driver_data["basis"],
        "confidence": driver_data["confidence"],
        "scenarios": scenarios
    }

baseline = {
    scenario: (
        drivers["data_centres"]["scenarios"][scenario]["values_twh_per_year"]["2024"]
        + drivers["evs"]["scenarios"][scenario]["values_twh_per_year"]["2024"]
    )
    for scenario in ["low", "central", "high"]
}

derived_by_year = {}

for year in YEARS:
    y = str(year)
    derived_by_year[y] = {}

    for scenario in ["low", "central", "high"]:
        dc_twh = drivers["data_centres"]["scenarios"][scenario]["values_twh_per_year"][y]
        ev_twh = drivers["evs"]["scenarios"][scenario]["values_twh_per_year"][y]
        combined_twh = dc_twh + ev_twh
        extra_demand_twh = max(0.0, combined_twh - baseline[scenario])
        extra_renewable_twh = extra_demand_twh * TARGET_SHARE
        extra_renewable_mw = renewable_burden_mw(extra_demand_twh)
        total_system_demand_twh = NON_DC_EV_BASELINE_DEMAND_TWH + dc_twh + ev_twh
        burden_pp = (extra_renewable_twh / total_system_demand_twh) * 100 if total_system_demand_twh else 0.0

        derived_by_year[y][scenario] = {
            "data_centres_twh_per_year": round(dc_twh, 3),
            "evs_twh_per_year": round(ev_twh, 3),
            "combined_demand_twh_per_year": round(combined_twh, 3),
            "total_system_demand_twh_per_year": round(total_system_demand_twh, 3),
            "extra_demand_since_2024_twh_per_year": round(extra_demand_twh, 3),
            "extra_renewable_required_twh_per_year": round(extra_renewable_twh, 3),
            "extra_renewable_required_mw_average": round(extra_renewable_mw),
            "demand_adjusted_burden_pp": round(burden_pp, 1)
        }

forecast = {
    "meta": {
        "title": "Demand pressure forecast scenarios for RES-E catch-up burden",
        "status": "scenario_model",
        "generated_by": "ops/build_demand_pressure_forecast.py",
        "baseline_year": 2024,
        "target_year": 2030,
        "target_share": TARGET_SHARE,
        "conversion": {
            "twh_per_year_to_mw_average": TWH_PER_YEAR_TO_MW_AVG,
            "formula": "extra_renewable_required_mw_average = extra_demand_since_2024_twh_per_year * target_share * 114.08"
        },
        "demand_denominator": {
            "method": "2024 total demand inferred from data-centre demand divided by approximate data-centre share of metered electricity.",
            "data_centres_2024_twh": DC_2024_TWH,
            "data_centres_2024_share_of_total": DC_SHARE_2024_OF_TOTAL_DEMAND,
            "estimated_total_electricity_demand_2024_twh": round(TOTAL_ELECTRICITY_DEMAND_2024_TWH, 3),
            "non_dc_ev_baseline_demand_twh": round(NON_DC_EV_BASELINE_DEMAND_TWH, 3),
            "burden_pp_formula": "demand_adjusted_burden_pp = extra_renewable_required_twh_per_year / total_system_demand_twh_per_year * 100"
        },
        "confidence_method": "Scenario envelope. These are not statistical confidence intervals and not official forecasts.",
        "important_note": "Demand growth does not change the official 80% RES-E target. It increases the renewable electricity required to reach that target.",
        "source_notes": [
            {
                "topic": "Irish data-centre demand pressure",
                "note": "Public reporting and official statistics indicate very high Irish data-centre electricity demand, with further growth pressure.",
                "sources": [
                    "CSO-reported data-centre share as summarised in public reporting",
                    "Ireland National Energy and Climate Plan / public reporting on data-centre share trajectories"
                ]
            },
            {
                "topic": "AI/data-centre uncertainty",
                "note": "AI-related data-centre growth is treated as scenario uncertainty, not as a deterministic forecast."
            },
            {
                "topic": "EV electricity demand",
                "note": "EV values are transparent scenario assumptions from modelled fleet electricity demand, not metered national EV electricity."
            }
        ]
    },
    "years": YEARS,
    "drivers": drivers,
    "derived": {
        "baseline_combined_demand_twh_per_year": {
            scenario: round(value, 3) for scenario, value in baseline.items()
        },
        "by_year": derived_by_year,
        "summary_2030": derived_by_year["2030"]
    }
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(forecast, indent=2) + "\n")

print(f"Wrote {OUT}")
print()
print("2030 scenario envelope:")
for scenario, values in forecast["derived"]["summary_2030"].items():
    print(
        f"  {scenario:7s} | "
        f"extra demand {values['extra_demand_since_2024_twh_per_year']:.2f} TWh/yr | "
        f"extra renewables {values['extra_renewable_required_twh_per_year']:.2f} TWh/yr | "
        f"{values['extra_renewable_required_mw_average']} MW avg"
    )
