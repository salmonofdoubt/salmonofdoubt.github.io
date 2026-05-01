#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"

CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
OUTPUT_PATH = DATA_DIR / "ai-candidate-enrichment.json"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
MAX_CANDIDATES = int(os.environ.get("GRANT_RADAR_AI_MAX_CANDIDATES", "40"))
TIMEOUT = (10, 60)

DECISION_VALUES = ["promote", "reject", "review"]
MODE_VALUES = ["include", "maybe", "exclude"]
CANDIDATE_TYPES = [
    "grant",
    "recurring_programme",
    "rolling_support",
    "research_call",
    "scholarship",
    "advisory_support",
    "generic_page",
    "announcement_or_results",
    "unknown",
]
APPLICANT_TYPES = [
    "local groups",
    "farmers",
    "public bodies",
    "researchers",
    "businesses",
    "NGOs",
    "schools",
    "households",
    "unknown",
]
RISK_FLAGS = [
    "generic_page",
    "parent_index_page",
    "navigation_page",
    "scholarship_not_practical_delivery",
    "research_only",
    "past_deadline",
    "unclear_deadline",
    "duplicate_or_already_covered",
    "cookie_or_boilerplate_noise",
    "low_nbs_or_water_relevance",
    "possible_promote",
]


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def clean_text(value: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()

    boilerplate_patterns = [
        r"\bA notice about cookies\b.*$",
        r"\bThis website uses cookies\b.*$",
        r"\bWe use cookies\b.*$",
        r"\bCookie settings\b.*$",
        r"\bAccept all cookies\b.*$",
        r"\bManage cookie preferences\b.*$",
        r"\bSearch Submit Search\b",
    ]

    for pattern in boilerplate_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    return re.sub(r"\s+", " ", text).strip()


def truncate(value: str, limit: int = 2200) -> str:
    value = clean_text(value)
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def candidate_hash(candidate: dict[str, Any]) -> str:
    material = {
        "id": candidate.get("id"),
        "url": candidate.get("url"),
        "title": candidate.get("title"),
        "snippet": candidate.get("snippet"),
        "page_hash": candidate.get("page_hash"),
        "status": candidate.get("status"),
    }
    return hashlib.sha256(
        json.dumps(material, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def load_candidates() -> list[dict[str, Any]]:
    raw = load_json(CANDIDATES_PATH, [])
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if isinstance(raw, dict):
        return [item for item in raw.get("candidates", []) if isinstance(item, dict)]
    return []


def schema() -> dict[str, Any]:
    relevance_schema = {
        "type": "object",
        "properties": {
            "ndrt": {"type": "string", "enum": MODE_VALUES},
            "research": {"type": "string", "enum": MODE_VALUES},
            "farmer": {"type": "string", "enum": MODE_VALUES},
            "climate": {"type": "string", "enum": MODE_VALUES},
        },
        "required": ["ndrt", "research", "farmer", "climate"],
        "additionalProperties": False,
    }

    return {
        "type": "object",
        "properties": {
            "decision_hint": {"type": "string", "enum": DECISION_VALUES},
            "decision_reason": {"type": "string"},
            "clean_title": {"type": "string"},
            "clean_summary": {"type": "string"},
            "candidate_type": {"type": "string", "enum": CANDIDATE_TYPES},
            "mode_relevance": relevance_schema,
            "applicant_types": {
                "type": "array",
                "items": {"type": "string", "enum": APPLICANT_TYPES},
            },
            "purposes": {
                "type": "array",
                "items": {"type": "string"},
            },
            "risk_flags": {
                "type": "array",
                "items": {"type": "string", "enum": RISK_FLAGS},
            },
            "confidence": {"type": "number"},
        },
        "required": [
            "decision_hint",
            "decision_reason",
            "clean_title",
            "clean_summary",
            "candidate_type",
            "mode_relevance",
            "applicant_types",
            "purposes",
            "risk_flags",
            "confidence",
        ],
        "additionalProperties": False,
    }


def candidate_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": candidate.get("id"),
        "url": candidate.get("url"),
        "domain": candidate.get("domain"),
        "title": candidate.get("title"),
        "snippet": truncate(candidate.get("snippet", ""), 2200),
        "status": candidate.get("status"),
        "candidate_type": candidate.get("candidate_type"),
        "confidence": candidate.get("confidence"),
        "detected_from": candidate.get("detected_from"),
        "source_hint": candidate.get("source_hint"),
        "deadline_hint": candidate.get("deadline_hint"),
        "latest_year_hint": candidate.get("latest_year_hint"),
        "suggested_purposes": candidate.get("suggested_purposes", []),
        "suggested_applicant_types": candidate.get("suggested_applicant_types", []),
        "suggested_access_route": candidate.get("suggested_access_route"),
        "suggested_scale": candidate.get("suggested_scale"),
        "promotion_reasons": candidate.get("promotion_reasons", []),
        "reason_flags": candidate.get("reason_flags", []),
    }


def openai_enrich(candidate: dict[str, Any]) -> dict[str, Any]:
    system_prompt = (
        "You are Grant Radar's funding-review triage assistant. "
        "Use only the supplied candidate data. Do not browse. Do not invent deadlines. "
        "Classify whether the page is a real fundable opportunity or merely a parent page, "
        "navigation page, scholarship, generic research route, or duplicate. "
        "NDRT means river-trust/community catchment delivery. "
        "Farmer means practical farmer-facing water-quality or agri-environment support. "
        "Climate entrepreneur means enterprise, innovation, business, pilot, demonstrator, "
        "commercialisation, green transition, energy, bioeconomy, circular economy, or climate-solution relevance. "
        "Prefer reject for generic/index pages, FAQ pages, related-news pages, audit-report pages, "
        "and pages without a standalone funding route. "
        "Return concise, conservative, structured JSON."
    )

    user_payload = {
        "task": "Review this discovered Grant Radar candidate.",
        "candidate": candidate_payload(candidate),
    }

    body = {
        "model": OPENAI_MODEL,
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "grant_radar_candidate_enrichment",
                "strict": True,
                "schema": schema(),
            }
        },
    }

    response = requests.post(
        "https://api.openai.com/v1/responses",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=TIMEOUT,
    )
    if response.status_code >= 400:
        print("[OPENAI ERROR STATUS]", response.status_code)
        print("[OPENAI ERROR BODY]", response.text[:1200])
    response.raise_for_status()
    data = response.json()

    text = data.get("output_text")
    if not text:
        parts: list[str] = []
        for output in data.get("output", []):
            for content in output.get("content", []):
                if isinstance(content, dict) and content.get("text"):
                    parts.append(content["text"])
        text = "".join(parts).strip()

    if not text:
        raise RuntimeError("OpenAI response did not contain output text.")

    result = json.loads(text)
    result["confidence"] = max(0.0, min(1.0, float(result.get("confidence", 0))))
    return result


def disabled_output(reason: str) -> dict[str, Any]:
    return {
        "meta": {
            "generated_at": now_iso(),
            "enabled": False,
            "reason": reason,
            "model": OPENAI_MODEL,
            "source": "discovery-candidates.json",
            "candidate_count": 0,
            "enriched_count": 0,
            "reused_count": 0,
            "error_count": 0,
        },
        "candidates": {},
    }


def main() -> None:
    candidates = load_candidates()
    existing = load_json(OUTPUT_PATH, {"meta": {}, "candidates": {}})
    existing_candidates = existing.get("candidates", {}) if isinstance(existing, dict) else {}

    if not OPENAI_API_KEY:
        output = disabled_output("OPENAI_API_KEY not set; AI enrichment skipped.")
        save_json(OUTPUT_PATH, output)
        print("AI enrichment skipped: OPENAI_API_KEY not set.")
        return

    generated_at = now_iso()
    enriched: dict[str, Any] = {}
    enriched_count = 0
    reused_count = 0
    error_count = 0

    for candidate in candidates:
        cid = candidate.get("id")
        if not cid:
            continue

        status = str(candidate.get("status") or "pending_review")
        if status not in {"pending_review"}:
            if cid in existing_candidates:
                enriched[cid] = existing_candidates[cid]
            continue

        fingerprint = candidate_hash(candidate)
        old = existing_candidates.get(cid)

        if (
            isinstance(old, dict)
            and old.get("candidate_hash") == fingerprint
            and old.get("model") == OPENAI_MODEL
            and old.get("ai_status") == "ok"
        ):
            enriched[cid] = old
            reused_count += 1
            continue

        if enriched_count >= MAX_CANDIDATES:
            continue

        try:
            result = openai_enrich(candidate)
            result.update(
                {
                    "ai_status": "ok",
                    "candidate_id": cid,
                    "candidate_hash": fingerprint,
                    "model": OPENAI_MODEL,
                    "enriched_at": generated_at,
                }
            )
            enriched[cid] = result
            enriched_count += 1
            print(f"AI enriched: {cid}")
        except Exception as exc:
            error_count += 1
            enriched[cid] = {
                "ai_status": "error",
                "candidate_id": cid,
                "candidate_hash": fingerprint,
                "model": OPENAI_MODEL,
                "enriched_at": generated_at,
                "error": truncate(str(exc), 500),
            }
            print(f"[WARN] AI enrichment failed for {cid}: {exc}")

    output = {
        "meta": {
            "generated_at": generated_at,
            "enabled": True,
            "model": OPENAI_MODEL,
            "source": "discovery-candidates.json",
            "candidate_count": len(candidates),
            "enriched_count": enriched_count,
            "reused_count": reused_count,
            "error_count": error_count,
            "max_candidates": MAX_CANDIDATES,
        },
        "candidates": enriched,
    }

    save_json(OUTPUT_PATH, output)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
