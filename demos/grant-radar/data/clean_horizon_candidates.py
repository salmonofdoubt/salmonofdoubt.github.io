#!/usr/bin/env python3
"""One-shot cleaner for Grant Radar discovery-candidates.json.

Usage:
  python clean_horizon_candidates.py
  python clean_horizon_candidates.py /path/to/discovery-candidates.json

It removes all candidates with source_id_hint == "horizon_biodiv"
except the canonical English promoted entry, then recomputes meta counts.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

KEEP_ID = (
    "cand_horizon_biodiv_https_rea_ec_europa_eu_funding_and_grants_"
    "horizon_europe_cluster_6_food_bioeconomy_natural_resources_"
    "agriculture_and_environment_biodiversity_and_ecosystem_services_en"
)

DEFAULT_PATH = Path("demos/grant-radar/data/discovery-candidates.json")


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    data = json.loads(path.read_text(encoding="utf-8"))

    candidates = data.get("candidates", [])
    cleaned = [
        c for c in candidates
        if c.get("source_id_hint") != "horizon_biodiv" or c.get("id") == KEEP_ID
    ]
    data["candidates"] = cleaned

    domains = Counter(
        c.get("domain") for c in cleaned if c.get("domain")
    )

    meta = data.setdefault("meta", {})
    meta["candidate_count"] = len(cleaned)
    meta["high_confidence_count"] = sum(float(c.get("confidence", 0)) >= 0.8 for c in cleaned)
    meta["pending_review_count"] = sum(c.get("status") == "pending_review" for c in cleaned)
    meta["approved_count"] = sum(c.get("status") == "approved" for c in cleaned)
    meta["cl_drafted_count"] = sum(c.get("status") == "cl_drafted" for c in cleaned)
    meta["promoted_count"] = sum(c.get("status") == "promoted" for c in cleaned)
    meta["promotion_requested_count"] = sum(bool(c.get("promotion_requested")) for c in cleaned)
    meta["domains_seen"] = dict(sorted(domains.items()))

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Cleaned: {path}")
    print(json.dumps(meta, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
