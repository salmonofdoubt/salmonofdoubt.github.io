#!/usr/bin/env python3
"""
Ireland Energy Monitor full pipeline runner.

Runs all harvest/build/validation steps in the correct order.
Use this locally and in GitHub Actions so both environments behave the same way.

Required steps fail the pipeline.
Optional enrichment/cross-check steps may fail without blocking publication,
provided the later validation gates still pass.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


@dataclass(frozen=True)
class Step:
    label: str
    cmd: list[str]
    required: bool = True


STEPS = [
    Step("Harvest EirGrid electricity", [PYTHON, "ops/harvest_eirgrid.py"]),
    Step("Harvest Smart Grid live electricity", [PYTHON, "ops/harvest_smartgrid_live.py"]),
    Step("Harvest EirGrid CO2", [PYTHON, "ops/harvest_eirgrid_co2.py"]),
    Step("Harvest Smart Grid API live electricity", [PYTHON, "ops/harvest_smartgrid_api_live.py"]),
    Step("Harvest renewable capacity evidence", [PYTHON, "ops/harvest_renewable_capacity.py"]),
    Step("Update renewable capacity history", [PYTHON, "ops/update_renewable_capacity_history.py"]),
    Step("Harvest SEAI prices", [PYTHON, "ops/harvest_seai_prices.py"]),
    Step("Harvest daily market prices", [PYTHON, "ops/harvest_daily_market_prices.py"]),
    Step("Build source model and freshness gates", [PYTHON, "ops/write_source_model.py"]),
    Step("Build target tracker", [PYTHON, "ops/build_target_tracker.py"]),
    Step("Build/import county hosting", [PYTHON, "ops/harvest_seai_county_dashboard.py"]),
    Step("Build monitor JSON", [PYTHON, "ops/build_monitor.py"]),
    Step("Update daily history", [PYTHON, "ops/update_daily_history.py"]),
    Step("Seed 30-day daily history warm start", [PYTHON, "ops/seed_daily_history.py"]),
    Step("Rebuild monitor JSON with history", [PYTHON, "ops/build_monitor.py"]),

    # The visible HTML page is not a stable machine interface. It is useful as
    # a public-page cross-check, but must never veto valid structured API data.
    Step(
        "Update visible SmartGrid overview",
        [PYTHON, "ops/update_smartgrid_visible_overview.py"],
        required=False,
    ),

    Step("Normalize current electricity", [PYTHON, "ops/normalize_current_electricity.py"]),
    Step("Build transition pathway v2", [PYTHON, "ops/build_transition_pathway.py"]),
    Step("Apply dashboard version", [PYTHON, "ops/apply_dashboard_version.py"]),
    Step("Validate current electricity", [PYTHON, "ops/validate_current_electricity.py"]),
    Step("Validate monitor JSON", [PYTHON, "ops/validate_monitor.py"]),
]


def main() -> int:
    optional_failures: list[tuple[str, int]] = []

    for step in STEPS:
        requirement = "required" if step.required else "optional"
        print(f"\n=== {step.label} [{requirement}] ===", flush=True)

        result = subprocess.run(step.cmd, cwd=ROOT)

        if result.returncode == 0:
            continue

        if step.required:
            print(
                f"FAILED: required step '{step.label}' "
                f"(exit {result.returncode})",
                file=sys.stderr,
            )
            return result.returncode

        optional_failures.append((step.label, result.returncode))
        print(
            f"WARNING: optional step '{step.label}' failed "
            f"(exit {result.returncode}); continuing to validation.",
            file=sys.stderr,
        )

    if optional_failures:
        print("\nPipeline completed with optional-source warnings:")
        for label, code in optional_failures:
            print(f" - {label}: exit {code}")
        print("Required validation gates passed.")
    else:
        print("\nPipeline completed successfully.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
