#!/usr/bin/env python3
"""
Ireland Energy Monitor full pipeline runner.

Runs all harvest/build/validation steps in the correct order.
Use this locally and in GitHub Actions so both environments behave the same way.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

STEPS = [
    ("Harvest EirGrid electricity", ["python3", "ops/harvest_eirgrid.py"]),
    ("Harvest Smart Grid live electricity", ["python3", "ops/harvest_smartgrid_live.py"]),
    ("Harvest EirGrid CO2", ["python3", "ops/harvest_eirgrid_co2.py"]),
    ("Harvest Smart Grid API live electricity", ["python3", "ops/harvest_smartgrid_api_live.py"]),
    ("Harvest SEAI prices", ["python3", "ops/harvest_seai_prices.py"]),
    ("Harvest daily market prices", ["python3", "ops/harvest_daily_market_prices.py"]),
    ("Build source model and freshness gates", ["python3", "ops/write_source_model.py"]),
    ("Build target tracker", ["python3", "ops/build_target_tracker.py"]),
    ("Build/import county hosting", ["python3", "ops/harvest_seai_county_dashboard.py"]),
    ("Build monitor JSON", ["python3", "ops/build_monitor.py"]),
    ("Update daily history", ["python3", "ops/update_daily_history.py"]),
    ("Seed 30-day daily history warm start", ["python3", "ops/seed_daily_history.py"]),
    ("Rebuild monitor JSON with history", ["python3", "ops/build_monitor.py"]),
    ("Update visible SmartGrid overview", ["python3", "ops/update_smartgrid_visible_overview.py"]),
    ("Normalize current electricity", ["python3", "ops/normalize_current_electricity.py"]),
    ("Validate current electricity", ["python3", "ops/validate_current_electricity.py"]),
    ("Validate monitor JSON", ["python3", "ops/validate_monitor.py"]),
]


def main() -> int:
    for label, cmd in STEPS:
        print(f"\n=== {label} ===")
        result = subprocess.run(cmd, cwd=ROOT)
        if result.returncode != 0:
            print(f"FAILED: {label}", file=sys.stderr)
            return result.returncode

    print("\nPipeline completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
