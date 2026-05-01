#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

DATA_DIR = Path("demos/grant-radar/data")
DISCOVERY_PATH = DATA_DIR / "discovery-candidates.json"
REGISTRY_PATH = DATA_DIR / "source-registry.json"
DECISIONS_PATH = DATA_DIR / "discovery-decisions.json"


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "grant_radar_item"


def clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title or "").strip()
    title = re.split(r"\s+\|\s+", title, maxsplit=1)[0].strip()
    return title or "Promoted Grant Radar candidate"


def canonical_family_key(url: str) -> str:
    parsed = urlparse(url or "")
    scheme = parsed.scheme.lower() or "https"
    host = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    return f"{scheme}://{host}{path}"


def candidate_matches_registry(candidate: dict, registry: list[dict]) -> dict | None:
    cand_url = (candidate.get("url") or "").rstrip("/")
    cand_family = candidate.get("canonical_family_key") or canonical_family_key(cand_url)

    for item in registry:
        item_url = (item.get("url") or "").rstrip("/")
        if item_url == cand_url:
            return item
        if canonical_family_key(item.get("url", "")) == cand_family:
            return item

    return None


def make_unique_source_id(base: str, registry: list[dict], url: str) -> str:
    existing_ids = {item.get("id") for item in registry}
    source_id = slugify(base)[:72]

    if source_id not in existing_ids:
        return source_id

    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    source_id = f"{source_id[:60]}_{digest}"
    counter = 2

    while source_id in existing_ids:
        source_id = f"{source_id[:55]}_{digest}_{counter}"
        counter += 1

    return source_id


def dedupe(values) -> list[str]:
    out = []
    seen = set()

    for value in values or []:
        clean = str(value).strip()
        key = clean.lower()

        if clean and key not in seen:
            out.append(clean)
            seen.add(key)

    return out


def compact_snippet(text: str, limit: int = 360) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def default_status_hint(candidate: dict) -> str:
    haystack = " ".join([
        str(candidate.get("title", "")),
        str(candidate.get("snippet", "")),
        str(candidate.get("deadline_hint", "")),
    ]).lower()

    if any(token in haystack for token in ["deadline", "apply", "applications", "open call", "call for proposals"]):
        return "open"

    return "open"


def load_candidates():
    discovery = load_json(DISCOVERY_PATH, [])
    discovery_is_list = isinstance(discovery, list)

    if discovery_is_list:
        candidates = discovery
    elif isinstance(discovery, dict):
        candidates = discovery.setdefault("candidates", [])
    else:
        raise SystemExit("discovery-candidates.json must be a list or an object with a candidates list")

    return discovery, candidates, discovery_is_list


def save_candidates(discovery, candidates, discovery_is_list: bool) -> None:
    if discovery_is_list:
        save_json(DISCOVERY_PATH, candidates)
    else:
        save_json(DISCOVERY_PATH, discovery)


def main() -> None:
    action = os.environ["GRANT_RADAR_ACTION"].strip().lower()
    candidate_id = os.environ["GRANT_RADAR_CANDIDATE_ID"].strip()
    note = os.environ.get("GRANT_RADAR_NOTE", "").strip()
    now = datetime.now(UTC).replace(microsecond=0).isoformat()

    if action not in {"promote", "reject"}:
        raise SystemExit(f"Unsupported action: {action}")

    discovery, candidates, discovery_is_list = load_candidates()
    registry = load_json(REGISTRY_PATH, [])
    decisions = load_json(DECISIONS_PATH, {})

    candidate = next(
        (
            item for item in candidates
            if isinstance(item, dict) and item.get("id") == candidate_id
        ),
        None,
    )

    if not candidate:
        available = "\n".join(
            f"- {item.get('id')}"
            for item in candidates[:30]
            if isinstance(item, dict)
        )
        raise SystemExit(
            f"Candidate not found: {candidate_id}\n"
            f"First available candidate IDs:\n{available}"
        )

    decision_key = candidate.get("canonical_family_key") or canonical_family_key(candidate.get("url", ""))

    if action == "reject":
        candidate["status"] = "rejected"
        candidate["public_visible_state"] = "discovery_only"
        candidate["promotion_signal"] = "red"
        candidate["admin_last_action"] = "reject"
        candidate["admin_last_action_at"] = now
        candidate["admin_note"] = note
        candidate["promotion_reasons"] = [f"Rejected by admin{': ' + note if note else ''}"]

        decisions[decision_key] = {
            "candidate_id": candidate_id,
            "url": candidate.get("url", ""),
            "status": "rejected",
            "decision": "reject",
            "decided_at": now,
            "note": note,
        }

    elif action == "promote":
        existing = candidate_matches_registry(candidate, registry)

        if existing:
            candidate["status"] = "promoted"
            candidate["public_visible_state"] = "discovery_only"
            candidate["promotion_signal"] = "green"
            candidate["already_trusted"] = True
            candidate["trusted_registry_id"] = existing.get("id")
            candidate["admin_last_action"] = "promote_resolved_existing"
            candidate["admin_last_action_at"] = now
            candidate["admin_note"] = note
            candidate["promotion_reasons"] = [
                f"Already covered by trusted source {existing.get('id')}"
            ]

            decisions[decision_key] = {
                "candidate_id": candidate_id,
                "url": candidate.get("url", ""),
                "status": "promoted",
                "decision": "promote_resolved_existing",
                "trusted_registry_id": existing.get("id"),
                "decided_at": now,
                "note": note,
            }

        else:
            title = clean_title(candidate.get("title", ""))

            generic_titles = {
                "funding",
                "funding programmes",
                "funding opportunities",
                "heritage funding opportunities",
                "online grants system",
                "awards database",
                "success stories",
                "publications",
                "about us",
                "contact",
            }

            if title.lower() in generic_titles:
                candidate["status"] = "suppressed_existing"
                candidate["public_visible_state"] = "discovery_only"
                candidate["promotion_signal"] = "red"
                candidate["admin_last_action"] = "promote_blocked_generic_child_page"
                candidate["admin_last_action_at"] = now
                candidate["admin_note"] = note
                candidate["promotion_reasons"] = [
                    f"Generic child/navigation page blocked from promotion: {title}"
                ]

                decisions[decision_key] = {
                    "candidate_id": candidate_id,
                    "url": candidate.get("url", ""),
                    "status": "rejected",
                    "decision": "promote_blocked_generic_child_page",
                    "decided_at": now,
                    "note": note or f"Blocked generic child/navigation page: {title}",
                }

                save_candidates(discovery, candidates, discovery_is_list)
                save_json(REGISTRY_PATH, registry)
                save_json(DECISIONS_PATH, decisions)
                print(f"Blocked generic child page from promotion: {candidate_id}")
                return

            url = candidate.get("url", "")
            domain = candidate.get("domain") or urlparse(url).netloc.lower().replace("www.", "")
            source_hint = candidate.get("source_hint") or title
            source_id = make_unique_source_id(title or candidate_id.replace("cand_", ""), registry, url)

            purposes = dedupe(candidate.get("suggested_purposes", []))
            applicant_types = dedupe(candidate.get("suggested_applicant_types", []))
            access_route = candidate.get("suggested_access_route") or "direct"
            scale = candidate.get("suggested_scale") or "medium"
            reason_flags = dedupe(candidate.get("reason_flags", []))

            watch_terms = dedupe(
                purposes
                + applicant_types
                + reason_flags
                + [
                    title,
                    source_hint,
                    "grant",
                    "grants",
                    "fund",
                    "funding",
                    "call",
                    "calls",
                    "scheme",
                    "schemes",
                    "application",
                    "applications",
                    "water",
                    "catchment",
                    "biodiversity",
                    "climate",
                    "community",
                    "farmers",
                    "restoration",
                    "wetlands",
                    "peatlands",
                ]
            )

            registry_entry = {
                "id": source_id,
                "name": title,
                "url": url,
                "scope": "Ireland" if domain.endswith(".ie") or domain in {"gov.ie", "lawaters.ie"} else "European Union",
                "purposes": purposes,
                "discovery_method": "promoted from Grant Radar review queue",
                "note": note or "Promoted from Grant Radar review queue. Generated as a starter registry entry and should be checked before long-term retention.",
                "trusted_domain": domain,
                "source_class": "programme_page",
                "harvest_enabled": True,
                "discovery_enabled": True,
                "cadence": "unknown",
                "usual_open_months": [],
                "watch_paths": [],
                "watch_terms": watch_terms,
                "extract": {
                    "title": title,
                    "programme": source_hint,
                    "summary_hint": compact_snippet(candidate.get("snippet", "")),
                    "status_hint": default_status_hint(candidate),
                    "scale": scale,
                    "access_route": access_route,
                    "applicant_types": applicant_types,
                    "mode": "single_item",
                    "opportunity_type": "grant",
                },
                "allow_pdf_candidates": False,
            }

            registry.append(registry_entry)

            candidate["status"] = "promoted"
            candidate["public_visible_state"] = "discovery_only"
            candidate["promotion_signal"] = "green"
            candidate["already_trusted"] = True
            candidate["trusted_registry_id"] = source_id
            candidate["admin_last_action"] = "promote"
            candidate["admin_last_action_at"] = now
            candidate["admin_note"] = note
            candidate["promotion_reasons"] = [
                f"Promoted to trusted source registry as {source_id}"
            ]

            decisions[decision_key] = {
                "candidate_id": candidate_id,
                "url": candidate.get("url", ""),
                "status": "promoted",
                "decision": "promote",
                "trusted_registry_id": source_id,
                "decided_at": now,
                "note": note,
            }

    if not discovery_is_list:
        counts = {
            "candidate_count": len(candidates),
            "pending_review_count": 0,
            "promoted_count": 0,
            "rejected_count": 0,
            "suppressed_existing_count": 0,
            "suppressed_non_actionable_count": 0,
        }

        for item in candidates:
            if not isinstance(item, dict):
                continue

            status = item.get("status")

            if status == "pending_review":
                counts["pending_review_count"] += 1
            elif status == "promoted":
                counts["promoted_count"] += 1
            elif status == "rejected":
                counts["rejected_count"] += 1
            elif status == "suppressed_existing":
                counts["suppressed_existing_count"] += 1
            elif status in {
                "suppressed_non_actionable",
                "suppressed_generic_page",
                "suppressed_stale",
                "suppressed_fetch_error",
            }:
                counts["suppressed_non_actionable_count"] += 1

        discovery.setdefault("meta", {})
        discovery["meta"].update(counts)
        discovery["meta"]["last_admin_action_at"] = now
        discovery["meta"]["last_admin_action"] = action
        discovery["meta"]["last_admin_candidate_id"] = candidate_id

    save_candidates(discovery, candidates, discovery_is_list)
    save_json(REGISTRY_PATH, registry)
    save_json(DECISIONS_PATH, decisions)

    print(f"Applied {action} to {candidate_id}")


if __name__ == "__main__":
    main()
