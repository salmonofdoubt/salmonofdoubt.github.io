#!/usr/bin/env python3
"""Cleaner for Grant Radar discovery-candidates.json.

Purpose
-------
1. Deduplicate Horizon biodiversity language variants, keeping only the
   canonical English promoted entry.
2. Map LAWPRO entries into a clean public-visible vs discovery-only split.
3. Drop obvious LAWPRO navigational clutter from discovery results.
4. Recompute meta counts.

Usage
-----
python demos/grant-radar/ops/clean_discovery_candidates.py
python demos/grant-radar/ops/clean_discovery_candidates.py demos/grant-radar/data/discovery-candidates.json
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

KEEP_HORIZON_ID = (
    "cand_horizon_biodiv_https_rea_ec_europa_eu_funding_and_grants_"
    "horizon_europe_cluster_6_food_bioeconomy_natural_resources_"
    "agriculture_and_environment_biodiversity_and_ecosystem_services_en"
)

DEFAULT_DISCOVERY_PATH = Path("demos/grant-radar/data/discovery-candidates.json")
DEFAULT_LAWPRO_VISIBILITY_PATH = Path("demos/grant-radar/data/lawpro-visibility.json")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def is_lawpro_candidate(candidate: dict[str, Any]) -> bool:
    domain = (candidate.get("domain") or "").lower()
    source_id_hint = (candidate.get("source_id_hint") or "").lower()
    url = (candidate.get("url") or "").lower()
    return (
        domain == "lawaters.ie"
        or source_id_hint.startswith("lawpro_")
        or "lawaters.ie" in url
    )


def recalc_meta(data: dict[str, Any]) -> None:
    candidates = data.get("candidates", [])

    domains = Counter(c.get("domain") for c in candidates if c.get("domain"))

    meta = data.setdefault("meta", {})
    meta["candidate_count"] = len(candidates)
    meta["high_confidence_count"] = sum(float(c.get("confidence", 0)) >= 0.8 for c in candidates)
    meta["pending_review_count"] = sum(c.get("status") == "pending_review" for c in candidates)
    meta["approved_count"] = sum(c.get("status") == "approved" for c in candidates)
    meta["cl_drafted_count"] = sum(c.get("status") == "cl_drafted" for c in candidates)
    meta["promoted_count"] = sum(c.get("status") == "promoted" for c in candidates)
    meta["promotion_requested_count"] = sum(bool(c.get("promotion_requested")) for c in candidates)
    meta["domains_seen"] = dict(sorted(domains.items()))


def main() -> None:
    discovery_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DISCOVERY_PATH
    visibility_path = DEFAULT_LAWPRO_VISIBILITY_PATH

    data = load_json(discovery_path)
    visibility = load_json(visibility_path)

    public_visible_registry_ids = set(visibility.get("public_visible_registry_ids", []))
    drop_discovery_urls = set(visibility.get("drop_discovery_urls", []))
    keep_discovery_urls = set(visibility.get("keep_discovery_urls", []))

    candidates = data.get("candidates", [])
    cleaned: list[dict[str, Any]] = []

    dropped_horizon = 0
    dropped_lawpro_clutter = 0
    lawpro_public_visible = 0
    lawpro_discovery_only = 0

    for candidate in candidates:
        candidate_id = candidate.get("id")
        source_id_hint = candidate.get("source_id_hint")
        url = candidate.get("url")

        # 1) Deduplicate Horizon biodiversity language variants
        if source_id_hint == "horizon_biodiv" and candidate_id != KEEP_HORIZON_ID:
            dropped_horizon += 1
            continue

        # 2) LAWPRO mapping
        if is_lawpro_candidate(candidate):
            trusted_registry_id = candidate.get("trusted_registry_id")
            already_trusted = bool(candidate.get("already_trusted"))
            is_public_visible = (
                already_trusted and trusted_registry_id in public_visible_registry_ids
            )

            # Drop obvious LAWPRO navigation clutter from discovery
            if url in drop_discovery_urls and not is_public_visible:
                dropped_lawpro_clutter += 1
                continue

            candidate.pop("public_visibility", None)
            candidate.pop("discovery_bucket", None)

            if is_public_visible:
                candidate["public_visibility"] = "public_visible"
                candidate["discovery_bucket"] = "lawpro_public_visible"

                # Keep promoted/cl_drafted if already at that level, otherwise elevate.
                if candidate.get("status") not in {"promoted", "cl_drafted"}:
                    candidate["status"] = "promoted"

                notes = (candidate.get("notes") or "").strip()
                marker = "public-visible LAWPRO route"
                if marker not in notes:
                    candidate["notes"] = f"{notes}; {marker}".strip("; ").strip()

                lawpro_public_visible += 1
            else:
                candidate["public_visibility"] = "discovery_only"
                candidate["discovery_bucket"] = "lawpro_discovery_only"

                notes = (candidate.get("notes") or "").strip()
                marker = "discovery-only LAWPRO route"
                if marker not in notes:
                    candidate["notes"] = f"{notes}; {marker}".strip("; ").strip()

                # If this is one of the explicitly retained thematic discovery pages,
                # keep it; otherwise still keep it, just discovery-only.
                if url in keep_discovery_urls:
                    pass

                lawpro_discovery_only += 1

        cleaned.append(candidate)

    data["candidates"] = cleaned
    recalc_meta(data)

    discovery_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    summary = {
        "cleaned_file": str(discovery_path),
        "horizon_duplicates_removed": dropped_horizon,
        "lawpro_clutter_removed": dropped_lawpro_clutter,
        "lawpro_public_visible_count": lawpro_public_visible,
        "lawpro_discovery_only_count": lawpro_discovery_only,
        "meta": data.get("meta", {}),
    }

    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()