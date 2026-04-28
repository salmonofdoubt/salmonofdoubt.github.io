#!/usr/bin/env python3
"""Real admin actions for Grant Radar.

Allowed actions:
- promote: publish a genuinely new candidate into the trusted catalogue
- reject: discard a candidate from the active review queue

Important:
- There is no "approve" state.
- If a candidate is already covered by an existing trusted source, promote does
  not silently mark it as published. It is resolved to suppressed_existing.
"""

from __future__ import annotations

import argparse
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

sys.path.insert(0, str(OPS_DIR))

from promote_candidate import (  # type: ignore
    apply_entry,
    build_registry_entry,
    load_json,
    registry_duplicate_info,
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


def normalize_pending_status(candidate: dict[str, Any]) -> str:
    status = str(candidate.get("status") or "").strip()
    if status in {"pending_review", "approved", "cl_drafted"}:
        return "pending_review"
    return status


def reject_candidate(payload: dict[str, Any], candidate: dict[str, Any], note: str | None) -> None:
    current = normalize_pending_status(candidate)

    if current == "promoted":
        raise SystemExit("This candidate is already promoted. Reject cannot remove published items.")
    if current == "rejected":
        raise SystemExit("This candidate is already rejected.")
    if current not in {"pending_review", "suppressed_existing", "suppressed_non_actionable"}:
        raise SystemExit(f"Reject is only valid for review/discovery candidates, not status={current!r}")

    candidate["status"] = "rejected"
    candidate["public_visible_state"] = "discovery_only"
    candidate["public_visibility"] = "discovery_only"
    candidate["promotion_signal"] = "red"
    clear_request_flags(candidate)
    clear_draft_flags(candidate)
    stamp_admin_action(candidate, "reject", note)
    save_candidates(payload)


def promote_candidate(payload: dict[str, Any], candidate: dict[str, Any], note: str | None) -> None:
    current = normalize_pending_status(candidate)

    if current == "promoted":
        raise SystemExit("This candidate is already promoted.")
    if current == "rejected":
        raise SystemExit("This candidate was rejected and should not be promoted without re-discovery.")
    if current != "pending_review":
        raise SystemExit(
            f"Only pending_review candidates can be promoted. Current status is {current!r}."
        )

    registry = load_json(REGISTRY_PATH, default=[])

    duplicate = registry_duplicate_info(candidate, registry)
    if duplicate:
        candidate["status"] = "suppressed_existing"
        candidate["public_visible_state"] = "discovery_only"
        candidate["public_visibility"] = "discovery_only"
        candidate["promotion_signal"] = "red"
        candidate["already_trusted"] = True
        candidate["trusted_registry_id"] = duplicate["id"]
        clear_request_flags(candidate)
        clear_draft_flags(candidate)
        stamp_admin_action(candidate, "promote_resolved_existing", note)
        save_candidates(payload)
        print(
            f"Candidate is already covered by trusted source {duplicate['id']}. "
            "Moved to suppressed_existing instead of publishing."
        )
        return

    entry = build_registry_entry(candidate, registry)
    apply_entry(candidate, entry, registry, payload)

    candidate["status"] = "promoted"
    candidate["public_visible_state"] = "public_visible"
    candidate["public_visibility"] = "public_visible"
    candidate["promotion_signal"] = "green"
    candidate["already_trusted"] = False
    candidate["trusted_registry_id"] = entry["id"]
    clear_request_flags(candidate)
    clear_draft_flags(candidate)
    stamp_admin_action(candidate, "promote", note)
    save_candidates(payload)

    run_harvest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply real admin actions to Grant Radar candidates.")
    parser.add_argument(
        "--candidate-id",
        required=True,
        help="Exact candidate id from demos/grant-radar/data/discovery-candidates.json",
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=["promote", "reject"],
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

    if args.action == "reject":
        reject_candidate(payload, candidate, args.note)
        print(f"Rejected candidate: {args.candidate_id}")
        return

    if args.action == "promote":
        promote_candidate(payload, candidate, args.note)
        print(f"Promotion handling completed for: {args.candidate_id}")
        return

    raise SystemExit(f"Unsupported action: {args.action}")


if __name__ == "__main__":
    main()