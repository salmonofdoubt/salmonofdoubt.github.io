#!/usr/bin/env python3
"""Tighten Grant Radar discovery review queue.

This post-processes discovery-candidates.json after discover_grants.py.

Goal:
- keep true funding/application opportunities in pending_review
- demote admin guidance, generic hub pages, archive/results pages, and broad index pages
- preserve promoted/rejected manual states
- add explicit triage_class and triage_reason fields
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"

REAL_OPPORTUNITY_TERMS = [
    "apply",
    "how to apply",
    "application",
    "applications",
    "application form",
    "call for proposals",
    "call for applications",
    "joint transnational call",
    "deadline",
    "closing date",
    "submit proposal",
    "submit a proposal",
    "eligibility",
    "eligible",
    "grant",
    "grants",
    "award",
    "awards",
    "funding call",
    "research call",
    "programme call",
    "scheme",
    "fellowship",
    "networking awards",
    "supplemental grant",
]

PROGRAMME_WATCH_TERMS = [
    "programme",
    "program",
    "scheme",
    "fund",
    "funding",
    "grant",
    "grants",
    "fellowship",
    "research grants",
    "scientific networks",
    "heisenberg",
    "koselleck",
    "marie skłodowska",
    "marie sklodowska",
    "erc advanced grant",
    "life calls",
    "cluster 6",
]

ADMIN_GUIDANCE_PATTERNS = [
    r"terms? and conditions?",
    r"standard terms",
    r"acknowledg(e|ing) our funding",
    r"appeals? process",
    r"funded projects",
    r"featured projects",
    r"successful projects",
    r"awardees",
    r"case stud(y|ies)",
    r"privacy",
    r"cookie",
    r"contact",
    r"about us",
    r"publications?",
    r"related news",
    r"related publications",
    r"resources?",
    r"guidance",
    r"faq",
    r"faqs",
]

GENERIC_TITLE_PATTERNS = [
    r"^funding$",
    r"^funding and grants$",
    r"^grants$",
    r"^grant funding$",
    r"^horizon europe$",
    r"^projects$",
    r"^funding opportunities$",
    r"^research$",
]

OFF_SCOPE_PATTERNS = [
    r"civil security",
    r"culture, creativity and inclusive society",
    r"promotion of agricultural products",
    r"coal and steel",
    r"reforming and enhancing the european r&i system",
    r"widening participation and spreading excellence",
]

NB_WATER_CLIMATE_GEO_TERMS = [
    "water",
    "water quality",
    "catchment",
    "river",
    "wetland",
    "riparian",
    "biodiversity",
    "habitat",
    "ecosystem",
    "ecology",
    "nature",
    "nature-based",
    "nature based",
    "climate",
    "sustainability",
    "environment",
    "environmental",
    "conservation",
    "peatland",
    "soil",
    "geoscience",
    "geochemistry",
    "geothermal",
    "subsurface",
    "hydrogen",
    "earth system",
    "earth systems",
    "gfz",
    "dfg",
    "erc",
    "horizon",
    "life",
    "research ireland",
    "epa",
    "lawpro",
    "heritage council",
]

DIRECT_APPLY_URL_PATTERNS = [
    r"/funding/[^/]+",
    r"/grants?/[^/]+",
    r"/call",
    r"/calls",
    r"/programme",
    r"/programmes",
    r"/scheme",
    r"/fellowship",
    r"/research-grants",
    r"/scientific-networks",
    r"/advanced-grants",
    r"/life-calls",
]

GENERIC_URL_PATTERNS = [
    r"/funding/?$",
    r"/funding-and-grants_en$",
    r"/grants/?$",
    r"/projects/?$",
    r"/publications/?$",
    r"/news/?$",
    r"/events/?$",
]


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def text_blob(item: dict[str, Any]) -> str:
    values = [
        item.get("id"),
        item.get("title"),
        item.get("url"),
        item.get("domain"),
        item.get("source_hint"),
        item.get("source_id_hint"),
        item.get("detected_from"),
        item.get("snippet"),
        item.get("candidate_type"),
        item.get("deadline_hint"),
        *(item.get("suggested_purposes") or []),
        *(item.get("suggested_applicant_types") or []),
        *(item.get("reason_flags") or []),
        *(item.get("promotion_reasons") or []),
    ]
    return " ".join(str(v or "") for v in values).lower()


def title_text(item: dict[str, Any]) -> str:
    return re.sub(r"\s+", " ", str(item.get("title") or "")).strip().lower()


def url_text(item: dict[str, Any]) -> str:
    return str(item.get("url") or "").lower()


def has_any(text: str, terms: list[str]) -> bool:
    return any(term.lower() in text for term in terms)


def matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, flags=re.I) for pattern in patterns)


def has_positive_mode_fit(item: dict[str, Any]) -> bool:
    relevance = item.get("mode_relevance") or {}
    return any(str(v).lower() in {"include", "maybe"} for v in relevance.values())


def classify(item: dict[str, Any]) -> tuple[str, str, str]:
    """Return (status, triage_class, triage_reason)."""

    current_status = str(item.get("status") or "")

    if current_status in {"promoted", "rejected"}:
        return current_status, "manual_decision", f"Manual decision preserved: {current_status}."

    text = text_blob(item)
    title = title_text(item)
    url = url_text(item)
    candidate_type = str(item.get("candidate_type") or "").lower()
    confidence = float(item.get("confidence") or 0)

    if item.get("already_trusted") or item.get("trusted_registry_id"):
        return (
            "suppressed_existing",
            "already_covered",
            "Already covered by trusted catalogue or registry source.",
        )

    if matches_any(title, ADMIN_GUIDANCE_PATTERNS) or matches_any(url, ADMIN_GUIDANCE_PATTERNS):
        return (
            "suppressed_non_actionable",
            "admin_guidance",
            "Admin, terms, acknowledgement, appeals, archive, guidance, or resource page, not an apply-for opportunity.",
        )

    if matches_any(title, GENERIC_TITLE_PATTERNS) or matches_any(url, GENERIC_URL_PATTERNS):
        return (
            "suppressed_generic_page",
            "generic_index",
            "Generic hub/index page rather than a distinct opportunity.",
        )

    if matches_any(text, OFF_SCOPE_PATTERNS):
        return (
            "suppressed_non_actionable",
            "off_scope",
            "Funding route is outside the current Grant Radar scope.",
        )

    if candidate_type in {"press_release", "award_result", "tender", "document_file"}:
        return (
            "suppressed_non_actionable",
            "non_apply_page",
            f"Candidate type is {candidate_type}, not a direct funding/application route.",
        )

    if not has_any(text, NB_WATER_CLIMATE_GEO_TERMS):
        return (
            "suppressed_non_actionable",
            "weak_theme_fit",
            "No strong water, NbS, climate, environmental research, Geo, or sustainability relevance detected.",
        )

    direct_signal = (
        has_any(text, REAL_OPPORTUNITY_TERMS)
        or matches_any(url, DIRECT_APPLY_URL_PATTERNS)
        or bool(item.get("deadline_hint"))
    )

    programme_signal = (
        candidate_type in {"recurring_programme", "rolling_support", "funding_call", "scholarship"}
        and has_any(text, PROGRAMME_WATCH_TERMS)
    )

    if direct_signal and confidence >= 0.55 and has_positive_mode_fit(item):
        return (
            "pending_review",
            "direct_apply",
            "Specific funding/application signal detected with thematic and mode relevance.",
        )

    if programme_signal and confidence >= 0.70 and has_positive_mode_fit(item):
        return (
            "pending_review",
            "programme_watch",
            "Credible recurring programme/watch page with thematic and mode relevance.",
        )

    return (
        "suppressed_non_actionable",
        "weak_apply_signal",
        "Insufficient evidence that this is a specific apply-for opportunity.",
    )


def main() -> None:
    candidates = load_json(CANDIDATES_PATH, [])

    before_pending = sum(1 for item in candidates if item.get("status") == "pending_review")
    changed = 0
    counts: dict[str, int] = {}

    for item in candidates:
        old_status = item.get("status")
        old_class = item.get("triage_class")

        status, triage_class, triage_reason = classify(item)

        item["status"] = status
        item["triage_class"] = triage_class
        item["triage_reason"] = triage_reason

        if status.startswith("suppressed"):
            item["public_visible_state"] = "discovery_only"
            item["promotion_signal"] = "red"
        elif status == "pending_review":
            item["public_visible_state"] = "review_only"
            item["promotion_signal"] = "green" if float(item.get("confidence") or 0) >= 0.70 else "amber"

        reasons = item.get("promotion_reasons")
        if not isinstance(reasons, list):
            reasons = []
        if triage_reason not in reasons:
            item["promotion_reasons"] = [triage_reason] + reasons[:4]

        if old_status != item.get("status") or old_class != item.get("triage_class"):
            changed += 1

        counts[item["triage_class"]] = counts.get(item["triage_class"], 0) + 1

    candidates.sort(
        key=lambda item: (
            0 if item.get("status") == "pending_review" else 1,
            item.get("triage_class") != "direct_apply",
            -float(item.get("confidence") or 0),
            str(item.get("title") or "").lower(),
        )
    )

    save_json(CANDIDATES_PATH, candidates)

    after_pending = sum(1 for item in candidates if item.get("status") == "pending_review")

    print(f"Review queue focus pass complete.")
    print(f"Pending review before: {before_pending}")
    print(f"Pending review after:  {after_pending}")
    print(f"Candidates changed:    {changed}")
    print("Triage classes:")
    for key, value in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"- {key}: {value}")


if __name__ == "__main__":
    main()
