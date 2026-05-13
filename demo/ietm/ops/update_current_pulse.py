#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPS = ROOT / "ops"

def run(name: str) -> None:
    print(f"\n=== Running {name} ===")
    subprocess.run([sys.executable, str(OPS / name)], check=True)

def main() -> int:
    # Base live values first.
    run("harvest_smartgrid_api_live.py")

    # Visible SmartGrid overview last.
    # This makes visible Net Import % authoritative for the top Interconnection card.
    run("update_smartgrid_visible_overview.py")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
