#!/usr/bin/env python3
"""Minimal same-repo admin actions for Grant Radar.

Usage examples:
  python demos/grant-radar/admin/admin_set_candidate_state.py --candidate-id CAND_ID --action approve
  python demos/grant-radar/admin/admin_set_candidate_state.py --candidate-id CAND_ID --action reject
  python demos/grant-radar/admin/admin_set_candidate_state.py --candidate-id CAND_ID --action promote
  python demos/grant-radar/admin/admin_set_candidate_state.py --candidate-id CAND_ID --action approve --note "looks real"

Behavior:
- approve: marks a discovery candidate as approved for later promotion
- reject: marks a discovery candidate as rejected
- promote: adds to source-registry.json using existing Grant Radar helper logic,
           then reruns harvest_grants.py so catalog.json updates too

Deliberate limits:
- no hidden webpage
- no extra repo
- no PAT
- no auto-accept on public review page
- no "unpublish" / "demote" logic for already-promoted catalogue entries
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
OPS_DIR = SITE_DIR / "ops"

CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
REGISTRY_PATH = DATA_DIR / "source-registry.json"

# Reuse your existing promotion helper so this stays aligned with your current schema.
sys.path.insert(0, str(OPS_DIR))

from promote_candidate import (  # type: ignore
    apply_entry,
    build_registry_entry,
    load_json,
    save_json,
    update_meta_counts,
)


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def find_candidate(payload: dict[str, Any], candidate_id: str) -> dict[str, Any]:
    for item in payload.get("candidates", []):
        if item.get("id") == candidate_id:
            return item
    raise SystemExit(f"Candidate id not found: {candidate_id}")


def clear_request_flags(candidate: dict[str, Any]) -> None:
    candidate["promotion_requested"] = False
    candidate["promotion_request_issue_number"] = None
    candidate["promotion_request_issue_url"] = None
    candidate["request_origin_status"] = None


def clear_draft_flags(candidate: dict[str, Any]) -> None:
    candidate["cl_draft_ready"] = False
    candidate["cl_draft_generated_at"] = None
    candidate["cl_draft_json"] = None
    candidate["cl_draft_html"] = None


def stamp_admin_action(candidate: dict[str, Any], action: str, note: str | None) -> None:
    candidate["admin_last_action"] = action
    candidate["admin_last_action_at"] = now_iso()
    if note:
        candidate["admin_note"] = note


def save_candidates(payload: dict[str, Any]) -> None:
    update_meta_counts(payload)
    save_json(CANDIDATES_PATH, payload)


def run_harvest() -> None:
    harvest_script = OPS_DIR / "harvest_grants.py"
    subprocess.run([sys.executable, str(harvest_script)], check=True)


def approve_candidate(payload: dict[str, Any], candidate: dict[str, Any], note: str | None) -> None:
    if candidate.get("status") == "promoted":
        raise SystemExit(
            "This candidate is already promoted. "
            "This admin script does not demote or unpublish promoted catalogue items."
        )

    candidate["status"] = "approved"
    candidate["public_visible_state"] = "discovery_only"
    candidate["public_visibility"] = "discovery_only"
    clear_request_flags(candidate)
    clear_draft_flags(candidate)
    stamp_admin_action(candidate, "approve", note)
    save_candidates(payload)


def reject_candidate(payload: dict[str, Any], candidate: dict[str, Any], note: str | None) -> None:
    if candidate.get("status") == "promoted":
        raise SystemExit(
            "This candidate is already promoted. "
            "This admin script does not remove promoted catalogue items."
        )

    candidate["status"] = "rejected"
    candidate["public_visible_state"] = "discovery_only"
    candidate["public_visibility"] = "discovery_only"
    clear_request_flags(candidate)
    clear_draft_flags(candidate)
    stamp_admin_action(candidate, "reject", note)
    save_candidates(payload)


def promote_candidate(payload: dict[str, Any], candidate: dict[str, Any], note: str | None) -> None:
    registry = load_json(REGISTRY_PATH, default=[])

    # Build and apply using your existing promotion helper.
    entry = build_registry_entry(candidate, registry)
    apply_entry(candidate, entry, registry, payload)

    # Normalise post-promotion state for the same-repo admin model.
    candidate["status"] = "promoted"
    candidate["public_visible_state"] = "public_visible"
    candidate["public_visibility"] = "public_visible"
    clear_request_flags(candidate)
    clear_draft_flags(candidate)
    stamp_admin_action(candidate, "promote", note)

    # apply_entry already writes candidates/registry, but we write once more so the
    # normalised flags above are definitely persisted.
    save_candidates(payload)

    # Rebuild public catalogue immediately.
    run_harvest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply same-repo admin state changes to Grant Radar candidates.")
    parser.add_argument(
        "--candidate-id",
        required=True,
        help="Exact candidate id from demos/grant-radar/data/discovery-candidates.json",
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=["approve", "reject", "promote"],
        help="Admin action to apply",
    )
    parser.add_argument(
        "--note",
        default=None,
        help="Optional short note. Stored in discovery-candidates.json, so treat it as public.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    payload = load_json(CANDIDATES_PATH, default={})
    if not isinstance(payload, dict):
        raise SystemExit(f"Unexpected JSON structure in {CANDIDATES_PATH}")

    candidate = find_candidate(payload, args.candidate_id)

    if args.action == "approve":
        approve_candidate(payload, candidate, args.note)
        print(f"Approved candidate: {args.candidate_id}")
        return

    if args.action == "reject":
        reject_candidate(payload, candidate, args.note)
        print(f"Rejected candidate: {args.candidate_id}")
        return

    if args.action == "promote":
        promote_candidate(payload, candidate, args.note)
        print(f"Promoted candidate and refreshed catalogue: {args.candidate_id}")
        return

    raise SystemExit(f"Unsupported action: {args.action}")


if __name__ == "__main__":
    main()