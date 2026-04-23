#!/usr/bin/env python3
"""Create reviewable promotion CL drafts for Grant Radar candidates.

Safe by design:
- creates HTML + JSON CL drafts under demos/grant-radar/promotion-drafts/
- updates discovery-candidates.json so the review page can show draft status
- mutates source-registry.json only when --apply is explicitly used
- treats duplicate URL or family matches as already-trusted success
"""

from __future__ import annotations

import argparse
import html
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
DRAFT_DIR = SITE_DIR / "promotion-drafts"

CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
REGISTRY_PATH = DATA_DIR / "source-registry.json"

LANGUAGE_SUFFIX_RE = re.compile(
    r"_(bg|cs|da|de|el|en|es|et|fi|fr|ga|hr|hu|it|lt|lv|mt|nl|pl|pt|ro|sk|sl|sv)$",
    flags=re.IGNORECASE,
)

def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def canonical_url(url: str) -> str:
    parsed = urlparse(url)
    cleaned_query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
    normalized = parsed._replace(
        scheme=(parsed.scheme or "https").lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
        query=urlencode(cleaned_query, doseq=True),
    )
    out = urlunparse(normalized)
    if out.endswith("/") and parsed.path not in ("", "/"):
        out = out[:-1]
    return out


def canonical_candidate_family_key(url: str) -> str:
    parsed = urlparse(canonical_url(url))
    path = LANGUAGE_SUFFIX_RE.sub("", parsed.path)
    normalized = parsed._replace(path=path, query="", fragment="")
    return urlunparse(normalized)


def canonical_domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def timestamp_slug() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        clean = str(value).strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def title_case_words(value: str) -> str:
    if not value:
        return value
    if value.upper() == value:
        return value
    return " ".join(part[:1].upper() + part[1:] if part else part for part in value.split())


def classify_source_class(candidate_type: str, candidate: dict[str, Any]) -> str:
    if candidate_type in {"support_page"}:
        return "implementation_programme"
    if candidate.get("suggested_access_route") in {"advisory support", "via advisor"}:
        return "implementation_programme"
    return "programme_page"


def infer_opportunity_type(candidate_type: str, candidate: dict[str, Any]) -> str:
    applicant_types = set(candidate.get("suggested_applicant_types", []))
    if "farmers" in applicant_types:
        if candidate.get("suggested_access_route") in {"advisory support", "via advisor"}:
            return "implementation support"
        return "farm payment"
    if "local groups" in applicant_types:
        return "community grant"
    if "researchers" in applicant_types:
        return "research funding"
    if candidate_type == "support_page":
        return "implementation support"
    return "grant"


def infer_scale(candidate: dict[str, Any]) -> str:
    value = candidate.get("suggested_scale")
    if value:
        return value
    applicant_types = set(candidate.get("suggested_applicant_types", []))
    if "local groups" in applicant_types:
        return "local"
    if "farmers" in applicant_types:
        return "support"
    return "medium"


def infer_access(candidate: dict[str, Any]) -> str:
    return candidate.get("suggested_access_route") or "direct"


def infer_applicant_types(candidate: dict[str, Any]) -> list[str]:
    values = candidate.get("suggested_applicant_types", []) or []
    return dedupe_keep_order(values) or ["local groups"]


def infer_name(candidate: dict[str, Any]) -> str:
    title = candidate.get("title", "").strip()
    source_hint = candidate.get("source_hint", "").strip()
    if title and len(title) <= 90:
        return title_case_words(title)
    if source_hint:
        return title_case_words(source_hint)
    return title_case_words(candidate.get("domain", "New opportunity"))


def infer_title(candidate: dict[str, Any]) -> str:
    title = candidate.get("title", "").strip()
    return title if title else infer_name(candidate)


def infer_programme(candidate: dict[str, Any]) -> str:
    return candidate.get("source_hint") or infer_name(candidate)


def infer_summary(candidate: dict[str, Any]) -> str:
    snippet = re.sub(r"\s+", " ", candidate.get("snippet", "")).strip()
    if not snippet:
        return "Candidate discovered through Grant Radar review queue."
    if len(snippet) > 240:
        snippet = snippet[:237].rstrip() + "..."
    return snippet


def infer_note(candidate: dict[str, Any]) -> str:
    return (
        "Promoted from Grant Radar review queue. "
        "Generated as a starter registry entry and should be checked before long-term retention."
    )


def infer_watch_terms(candidate: dict[str, Any]) -> list[str]:
    values = []
    values.extend(candidate.get("suggested_purposes", []))
    values.extend(candidate.get("suggested_applicant_types", []))
    values.extend(candidate.get("reason_flags", []))
    if candidate.get("source_hint"):
        values.append(candidate["source_hint"])
    if candidate.get("title"):
        values.append(candidate["title"])
    values.extend(["funding", "grant", "call", "applications"])
    return dedupe_keep_order(values)


def propose_registry_id(candidate: dict[str, Any], registry: list[dict[str, Any]]) -> str:
    base = candidate.get("source_id_hint") or slugify(candidate.get("source_hint", "") or candidate.get("title", "") or candidate.get("domain", "candidate"))
    base = slugify(base)
    if not base:
        base = "promoted_candidate"

    existing_ids = {item.get("id") for item in registry}
    if base not in existing_ids:
        return base

    domain_slug = slugify(candidate.get("domain", ""))
    proposal = f"{base}_{domain_slug}" if domain_slug else f"{base}_candidate"
    if proposal not in existing_ids:
        return proposal

    return f"{proposal}_{slugify(candidate.get('title', '')[:40])}"


def build_registry_entry(candidate: dict[str, Any], registry: list[dict[str, Any]]) -> dict[str, Any]:
    candidate_type = candidate.get("candidate_type", "call_page")
    return {
        "id": propose_registry_id(candidate, registry),
        "name": infer_name(candidate),
        "url": candidate["url"],
        "scope": "Ireland",
        "purposes": dedupe_keep_order(candidate.get("suggested_purposes", [])),
        "discovery_method": "promoted from review queue",
        "note": infer_note(candidate),
        "trusted_domain": canonical_domain(candidate["url"]),
        "source_class": classify_source_class(candidate_type, candidate),
        "harvest_enabled": True,
        "discovery_enabled": True,
        "cadence": "unknown",
        "usual_open_months": [],
        "watch_paths": [],
        "watch_terms": infer_watch_terms(candidate),
        "extract": {
            "title": infer_title(candidate),
            "programme": infer_programme(candidate),
            "summary_hint": infer_summary(candidate),
            "status_hint": "open",
            "scale": infer_scale(candidate),
            "access_route": infer_access(candidate),
            "applicant_types": infer_applicant_types(candidate),
            "mode": "single_item",
            "opportunity_type": infer_opportunity_type(candidate_type, candidate),
        },
    }


def find_candidate(payload: dict[str, Any], *, candidate_id: str | None, url: str | None) -> dict[str, Any]:
    candidates = payload.get("candidates", [])
    if candidate_id:
        for item in candidates:
            if item.get("id") == candidate_id:
                return item
        raise SystemExit(f"Candidate id not found: {candidate_id}")
    if url:
        for item in candidates:
            if item.get("url") == url:
                return item
        raise SystemExit(f"Candidate url not found: {url}")
    raise SystemExit("Provide --id or --url")


def registry_duplicate_info(candidate: dict[str, Any], registry: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidate_url = canonical_url(candidate["url"])
    candidate_family = canonical_candidate_family_key(candidate["url"])

    for item in registry:
        if canonical_url(item.get("url", "")) == candidate_url:
            return {"kind": "url", "id": item.get("id"), "name": item.get("name")}

    for item in registry:
        if canonical_candidate_family_key(item.get("url", "")) == candidate_family:
            return {"kind": "family", "id": item.get("id"), "name": item.get("name")}

    source_id_hint = candidate.get("source_id_hint")
    if source_id_hint:
        for item in registry:
            if item.get("id") == source_id_hint:
                return {"kind": "source_id_hint", "id": item.get("id"), "name": item.get("name")}
    return None


def build_html(candidate: dict[str, Any], entry: dict[str, Any], duplicate: dict[str, Any] | None) -> str:
    duplicate_html = ""
    if duplicate:
        duplicate_html = f"""
        <section class="panel">
          <h2>Duplicate check</h2>
          <p><strong>Existing registry match kind:</strong> {html.escape(duplicate['kind'])}</p>
          <p><strong>Existing registry id:</strong> {html.escape(duplicate['id'])}</p>
          <p><strong>Existing registry name:</strong> {html.escape(duplicate['name'])}</p>
        </section>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Grant Radar Promotion CL Draft</title>
  <style>
    :root {{
      --line: rgba(110, 214, 196, 0.18);
      --text: #ecf8f5;
      --muted: #b8d9d1;
      --radius: 18px;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(135deg, #06111d 0%, #0a1e2c 35%, #0b2d31 62%, #0f362e 100%);
      color: var(--text);
    }}
    .shell {{
      width: min(1100px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 1rem 0 3rem;
    }}
    .panel {{
      margin-top: 1rem;
      padding: 1.1rem;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(7, 29, 38, 0.96), rgba(12, 39, 42, 0.96));
    }}
    h1, h2, p, pre {{ margin-top: 0; }}
    .eyebrow {{ color: #d7ff8a; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem; }}
    .muted {{ color: var(--muted); }}
    pre {{
      overflow: auto;
      padding: 1rem;
      border-radius: 14px;
      background: rgba(5, 16, 25, 0.78);
      border: 1px solid rgba(255,255,255,0.08);
      color: #eff8ff;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .actions {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }}
    a.button {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 1rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: var(--text);
      text-decoration: none;
      font-weight: 700;
    }}
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel">
      <p class="eyebrow">Grant Radar promotion CL draft</p>
      <h1>{html.escape(candidate.get("title", "Untitled candidate"))}</h1>
      <p class="muted">Candidate id: {html.escape(candidate.get("id", ""))}</p>
      <div class="actions">
        <a class="button" href="{html.escape(candidate.get("url", ""))}" target="_blank" rel="noopener noreferrer">Open candidate page</a>
      </div>
    </section>

    <section class="panel">
      <h2>Candidate summary</h2>
      <p><strong>Status:</strong> {html.escape(candidate.get("status", "pending_review"))}</p>
      <p><strong>Confidence:</strong> {html.escape(str(candidate.get("confidence", "")))}</p>
      <p><strong>Source hint:</strong> {html.escape(candidate.get("source_hint", ""))}</p>
      <p><strong>Suggested purposes:</strong> {html.escape(", ".join(candidate.get("suggested_purposes", [])) or "—")}</p>
      <p><strong>Suggested applicant types:</strong> {html.escape(", ".join(candidate.get("suggested_applicant_types", [])) or "—")}</p>
      <p><strong>Deadline hint:</strong> {html.escape(candidate.get("deadline_hint", "") or "—")}</p>
    </section>

    {duplicate_html}

    <section class="panel">
      <h2>Proposed registry entry</h2>
      <pre>{html.escape(json.dumps(entry, indent=2, ensure_ascii=False))}</pre>
    </section>

    <section class="panel">
      <h2>Suggested next step</h2>
      <p class="muted">Inspect this draft first. Only after review should it be applied to source-registry.json and harvested into the live catalogue.</p>
    </section>
  </div>
</body>
</html>
"""


def write_draft(candidate: dict[str, Any], entry: dict[str, Any], duplicate: dict[str, Any] | None) -> tuple[Path, Path, str]:
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    existing_html = candidate.get("cl_draft_html")
    existing_json = candidate.get("cl_draft_json")
    if existing_html and existing_json:
        html_path = SITE_DIR / existing_html
        json_path = SITE_DIR / existing_json
        if html_path.exists() and json_path.exists():
            return json_path, html_path, now_iso()

    stem = f"{timestamp_slug()}_{slugify(candidate['id'])}"
    json_rel = f"promotion-drafts/{stem}.json"
    html_rel = f"promotion-drafts/{stem}.html"
    json_path = SITE_DIR / json_rel
    html_path = SITE_DIR / html_rel

    save_json(json_path, entry)
    html_path.write_text(build_html(candidate, entry, duplicate) + "\n", encoding="utf-8")
    return json_path, html_path, now_iso()


def update_meta_counts(payload: dict[str, Any]) -> None:
    candidates = payload.get("candidates", [])
    meta = payload.setdefault("meta", {})
    meta["candidate_count"] = len(candidates)
    meta["high_confidence_count"] = sum(1 for item in candidates if float(item.get("confidence", 0)) >= 0.8)
    meta["pending_review_count"] = sum(1 for item in candidates if item.get("status") == "pending_review")
    meta["approved_count"] = sum(1 for item in candidates if item.get("status") == "approved")
    meta["cl_drafted_count"] = sum(1 for item in candidates if item.get("status") == "cl_drafted")
    meta["promoted_count"] = sum(1 for item in candidates if item.get("status") == "promoted")
    meta["promotion_requested_count"] = sum(1 for item in candidates if item.get("promotion_requested"))


def apply_entry(candidate: dict[str, Any], entry: dict[str, Any], registry: list[dict[str, Any]], payload: dict[str, Any]) -> None:
    duplicate = registry_duplicate_info(candidate, registry)

    if duplicate:
        candidate["status"] = "promoted"
        candidate["already_trusted"] = True
        candidate["trusted_registry_id"] = duplicate["id"]
        candidate["promotion_requested"] = False
        candidate["promotion_request_issue_number"] = None
        candidate["promotion_request_issue_url"] = None
        candidate["request_origin_status"] = None
        candidate["cl_draft_ready"] = True
        update_meta_counts(payload)
        save_json(CANDIDATES_PATH, payload)
        print(f"Already trusted under registry id {duplicate['id']}; marked candidate as promoted instead of re-adding.")
        return

    registry.append(entry)
    registry.sort(key=lambda x: x.get("id", ""))
    save_json(REGISTRY_PATH, registry)

    candidate["status"] = "promoted"
    candidate["already_trusted"] = False
    candidate["trusted_registry_id"] = entry["id"]
    candidate["promotion_requested"] = False
    candidate["promotion_request_issue_number"] = None
    candidate["promotion_request_issue_url"] = None
    candidate["request_origin_status"] = None
    update_meta_counts(payload)
    save_json(CANDIDATES_PATH, payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or apply a reviewable promotion CL draft for a Grant Radar candidate.")
    parser.add_argument("--id", dest="candidate_id", help="Candidate id from discovery-candidates.json")
    parser.add_argument("--url", dest="candidate_url", help="Candidate url from discovery-candidates.json")
    parser.add_argument("--apply", action="store_true", help="Apply the generated entry to source-registry.json after review")
    args = parser.parse_args()

    payload = load_json(CANDIDATES_PATH, default={})
    registry = load_json(REGISTRY_PATH, default=[])

    candidate = find_candidate(payload, candidate_id=args.candidate_id, url=args.candidate_url)
    duplicate = registry_duplicate_info(candidate, registry)
    entry = build_registry_entry(candidate, registry)

    json_path, html_path, generated_at = write_draft(candidate, entry, duplicate)
    if candidate.get("status") != "promoted":
        candidate["status"] = "cl_drafted"
    candidate["cl_draft_ready"] = True
    candidate["cl_draft_generated_at"] = generated_at
    candidate["cl_draft_json"] = str(json_path.relative_to(SITE_DIR)).replace("\\", "/")
    candidate["cl_draft_html"] = str(html_path.relative_to(SITE_DIR)).replace("\\", "/")
    update_meta_counts(payload)
    save_json(CANDIDATES_PATH, payload)

    print(f"Wrote draft JSON: {json_path}")
    print(f"Wrote draft HTML: {html_path}")
    print(f"Updated candidate queue metadata: {CANDIDATES_PATH}")

    if args.apply:
        apply_entry(candidate, entry, registry, payload)
        print(f"Apply phase completed for {candidate['id']}")
    else:
        print("Draft created. Registry unchanged.")


if __name__ == "__main__":
    main()
