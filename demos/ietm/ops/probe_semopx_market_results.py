#!/usr/bin/env python3
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEBUG = ROOT / "ops" / "debug"
DEBUG.mkdir(parents=True, exist_ok=True)

URLS = [
    "https://www.semopx.com/market-data/market-results",
    "https://www.semopx.com/market-data",
    "https://www.semopx.com/",
]

def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyMonitorProbe/0.1",
            "Accept": "text/html,application/json,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")

def main() -> int:
    out = []

    for url in URLS:
        out.append(f"\n\n=== PAGE {url} ===\n")
        try:
            html = fetch(url)
            out.append(html[:50000])

            candidates = sorted(set(re.findall(
                r'''["']([^"']*(?:api|json|csv|xlsx|market|results|auction|download)[^"']*)["']''',
                html,
                flags=re.I
            )))

            out.append("\n\n--- CANDIDATES ---\n")
            for c in candidates[:300]:
                out.append(c + "\n")

        except Exception as exc:
            out.append(f"ERROR {exc}\n")

    path = DEBUG / "semopx_market_results_probe.txt"
    path.write_text("".join(out))
    print(f"Wrote {path.relative_to(ROOT)}")
    print("Next:")
    print("grep -niE 'api|json|csv|xlsx|auction|market|results|download' demos/ietm/ops/debug/semopx_market_results_probe.txt | head -200")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
