#!/usr/bin/env python3
"""Grant Radar discovery with actionable review queue only.

Design:
- pending_review: genuinely new and actionable candidate
- suppressed_existing: already covered by an existing trusted source
- suppressed_non_actionable: stale, announcement, tender, PDF, results, or weak noise
- promoted: previously published
- rejected: previously discarded

The active review page should show only pending_review by default.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"

REGISTRY_PATH = DATA_DIR / "source-registry.json"
DISCOVERY_PATH = DATA_DIR / "discovery-candidates.json"
MEMORY_PATH = DATA_DIR / "source-memory.json"

USER_AGENT = "GrantRadarDiscoverBot/1.0 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
TIMEOUT = (10, 30)

MAX_WATCH_URLS_PER_SOURCE = 8
MAX_CHILD_LINKS_PER_SOURCE = 20

LANGUAGE_SUFFIX_RE = re.compile(
    r"_(bg|cs|da|de|el|en|es|et|fi|fr|ga|hr|hu|it|lt|lv|mt|nl|pl|pt|ro|sk|sl|sv)$",
    flags=re.IGNORECASE,
)

ACTIONABLE_PHRASES = [
    "apply now",
    "applications open",
    "application form",
    "application process",
    "how to apply",
    "submit a proposal",
    "submit proposal",
    "open call",
    "call for proposals",
    "call for applications",
    "expression of interest",
    "expressions of interest",
    "eligibility criteria",
    "eligible applicants",
    "online grants system",
    "funding now available",
    "grant scheme",
    "grant programme",
    "grant program",
    "funding programme",
    "funding program",
    "support programme",
    "support program",
    "scheme open",
    "applications close",
    "closing date",
    "deadline",
]

NON_ACTIONABLE_PHRASES = [
    "press release",
    "minister announces",
    "minister announced",
    "announces over €",
    "announces new funding",
    "results announced",
    "projects awarded",
    "awarded funding",
    "successful projects",
    "deadline has passed",
    "calls for tenders",
    "call for tenders",
    "tenders",
    "procurement",
]

ANNOUNCEMENT_TERMS = [
    "announce",
    "announces",
    "announced",
    "press release",
    "awarded",
    "award",
    "results",
]

GENERIC_TITLE_TERMS = {
    "about",
    "about us",
    "our work",
    "our services",
    "who we are",
    "what we do",
    "contact us",
    "contact",
    "news",
    "publications",
    "publication",
    "research",
    "projects",
    "education",
    "funding",
    "funding opportunities",
}

LINK_HINT_TERMS = [
    "grant",
    "fund",
    "funding",
    "call",
    "scheme",
    "proposal",
    "application",
    "award",
    "support",
    "research",
    "biodiversity",
    "climate",
    "energy",
    "community",
    "water",
    "catchment",
    "farm",
    "farmer",
    "river",
    "restoration",
    "wetland",
    "riparian",
    "citizen",
]

DENYLIST_PATTERNS = [
    r"/about/?$",
    r"/about-us/?$",
    r"/contact/?$",
    r"/contact-us/?$",
    r"/careers/?$",
    r"/career/?$",
    r"/our-team/?$",
    r"/team/?$",
    r"/login/?$",
    r"/log-in/?$",
    r"/search/?$",
    r"/board-members/?$",
    r"/governance/?$",
    r"/publications/?$",
    r"/publication/?$",
    r"/news/?$",
    r"/jobs/?$",
    r"/job/?$",
    r"/events/?$",
    r"/event/?$",
    r"/privacy/?$",
]

PRACTICAL_PURPOSES = {
    "water quality",
    "catchment delivery",
    "community nature",
    "restoration",
    "citizen science",
    "habitat restoration",
    "riparian management",
    "wetlands",
    "education",
    "capacity building",
    "sediment control",
    "conservation",
    "peatlands",
}

PRACTICAL_ACCESS_ROUTES = {
    "direct",
    "advisory support",
    "via advisor",
    "via local authority",
    "via local action group",
    "via project coordinator",
}

PRACTICAL_SCALES = {
    "local",
    "support",
    "medium",
}

COMMUNITY_APPLICANT_TYPES = {
    "local groups",
    "ngos",
    "public bodies",
    "schools",
    "farmers",
}

PERSISTENT_FIELDS = [
    "notes",
    "admin_last_action",
    "admin_last_action_at",
    "admin_note",
]


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def canonical_url(url: str) -> str:
    parsed = urlparse(url)
    cleaned_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
    ]
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


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


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


def same_or_child_domain(url: str, trusted_domain: str) -> bool:
    domain = canonical_domain(url)
    return domain == trusted_domain or domain.endswith(f".{trusted_domain}")


def text_has_any(text: str, phrases: list[str]) -> bool:
    lowered = text.lower()
    return any(phrase.lower() in lowered for phrase in phrases)


def phrase_hit_count(text: str, phrases: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for phrase in phrases if phrase.lower() in lowered)


def detect_deadline_hint(text: str) -> str | None:
    patterns = [
        r"(deadline(?: for (?:applications|applicants|submissions))?[:\s]+[^\n\r]{0,120})",
        r"(closing date[:\s]+[^\n\r]{0,120})",
        r"(applications? close[^\n\r]{0,120})",
        r"(submit(?:ted)? by[^\n\r]{0,120})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def page_title_core(title: str) -> str:
    core = re.split(r"\s+[|\-–]\s+", title, maxsplit=1)[0]
    return re.sub(r"\s+", " ", core).strip()


def looks_generic_title(title: str) -> bool:
    return page_title_core(title).lower() in GENERIC_TITLE_TERMS


def extract_years(*parts: str) -> list[int]:
    years: set[int] = set()
    for part in parts:
        if not part:
            continue
        for match in re.findall(r"\b(20\d{2})\b", part):
            year = int(match)
            if 2000 <= year <= 2100:
                years.add(year)
    return sorted(years)


def latest_year_hint(*parts: str) -> int | None:
    years = extract_years(*parts)
    return max(years) if years else None


def is_stale_non_actionable(latest_year: int | None, candidate_type: str) -> bool:
    if latest_year is None:
        return False
    current_year = datetime.now(UTC).year
    if latest_year >= current_year:
        return False
    if candidate_type in {"call_page", "news_page", "award_page", "tender_page"}:
        return True
    return latest_year <= current_year - 2


def build_watch_urls(source: dict[str, Any]) -> list[str]:
    urls = [canonical_url(source["url"])]
    root = f"{urlparse(source['url']).scheme}://{urlparse(source['url']).netloc}"
    for path in source.get("watch_paths", []):
        urls.append(canonical_url(urljoin(root.rstrip("/") + "/", path.lstrip("/"))))
    return dedupe_keep_order(urls)[:MAX_WATCH_URLS_PER_SOURCE]


def source_watch_terms(source: dict[str, Any]) -> list[str]:
    values = []
    values.extend(source.get("watch_terms", []))
    values.extend(source.get("purposes", []))
    values.append(source.get("name", ""))
    values.extend(LINK_HINT_TERMS)
    return dedupe_keep_order(values)


def is_denied_child_url(url: str) -> bool:
    path = urlparse(url).path.lower().rstrip("/")
    if not path:
        return False
    return any(re.search(pattern, path) for pattern in DENYLIST_PATTERNS)


def looks_like_candidate_link(url: str, label: str, watch_terms: list[str], trusted_domain: str) -> bool:
    if not same_or_child_domain(url, trusted_domain):
        return False
    if is_denied_child_url(url):
        return False

    haystack = f"{url} {label}".lower()
    return any(term.lower() in haystack for term in watch_terms)


def fetch_page(url: str) -> tuple[dict[str, Any] | None, str | None]:
    headers = {"User-Agent": USER_AGENT}

    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        return None, str(exc)

    final_url = canonical_url(response.url or url)
    content_type = (response.headers.get("Content-Type") or "").lower()
    raw_bytes = response.content or b""
    page_hash = "sha256:" + hashlib.sha256(raw_bytes).hexdigest()

    is_pdf = (
        "application/pdf" in content_type
        or final_url.lower().endswith(".pdf")
        or raw_bytes.startswith(b"%PDF-")
    )

    if is_pdf:
        filename = Path(urlparse(final_url).path).name or "pdf-document"
        stem = Path(filename).stem or "PDF document"
        title = re.sub(r"[-_]+", " ", stem).strip() or "PDF document"
        return {
            "url": final_url,
            "title": title,
            "text": "",
            "snippet": "PDF document detected. Binary preview suppressed.",
            "links": [],
            "page_hash": page_hash,
            "is_pdf": True,
        }, None

    soup = BeautifulSoup(response.text, "html.parser")

    title = ""
    if soup.title and soup.title.string:
        title = re.sub(r"\s+", " ", soup.title.string).strip()

    text = soup.get_text("\n", strip=True)
    snippet = re.sub(r"\s+", " ", text[:700]).strip()

    links: list[dict[str, str]] = []
    for anchor in soup.find_all("a", href=True):
        href = canonical_url(urljoin(final_url, anchor["href"]))
        label = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).strip()
        if href.startswith("http"):
            links.append({"url": href, "label": label})

    return {
        "url": final_url,
        "title": title,
        "text": text,
        "snippet": snippet,
        "links": links,
        "page_hash": page_hash,
        "is_pdf": False,
    }, None


def candidate_type_from_page(page: dict[str, Any]) -> str:
    if page.get("is_pdf"):
        return "pdf_page"

    title = page_title_core(page.get("title", "")).lower()
    url = page.get("url", "").lower()
    snippet = page.get("snippet", "").lower()
    haystack = f"{title} {url} {snippet}"

    if "tender" in haystack or "procurement" in haystack:
        return "tender_page"
    if any(term in haystack for term in ["awarded", "award", "results"]):
        return "award_page"
    if any(term in haystack for term in ANNOUNCEMENT_TERMS):
        return "news_page"
    if any(term in haystack for term in ["support", "programme", "program", "hub"]) and not text_has_any(haystack, ACTIONABLE_PHRASES):
        return "support_page"
    return "call_page"


def find_existing_registry_match(candidate_url: str, registry: list[dict[str, Any]]) -> dict[str, Any] | None:
    target_url = canonical_url(candidate_url)
    target_family = canonical_candidate_family_key(candidate_url)

    for item in registry:
        if canonical_url(item.get("url", "")) == target_url:
            return {"kind": "url", "id": item.get("id"), "name": item.get("name")}

    for item in registry:
        if canonical_candidate_family_key(item.get("url", "")) == target_family:
            return {"kind": "family", "id": item.get("id"), "name": item.get("name")}

    return None


def candidate_id(source_id: str, url: str) -> str:
    canonical = canonical_url(url)
    parsed = urlparse(canonical)
    compact = f"{parsed.netloc}{parsed.path}"
    if parsed.query:
        compact += f"?{parsed.query}"
    return f"cand_{slugify(source_id)}_{slugify(compact)}"


def source_extract_defaults(source: dict[str, Any]) -> tuple[list[str], str | None, str | None]:
    extract = source.get("extract", {}) or {}
    applicant_types = dedupe_keep_order(extract.get("applicant_types", []) or [])
    access_route = extract.get("access_route")
    scale = extract.get("scale")
    return applicant_types, access_route, scale


def practical_fit(source: dict[str, Any], applicant_types: list[str], access_route: str | None, scale: str | None) -> bool:
    purposes = {str(value).lower() for value in source.get("purposes", [])}
    applicants = {str(value).lower() for value in applicant_types}
    route = str(access_route or "").lower()
    scale_value = str(scale or "").lower()

    return (
        bool(purposes.intersection(PRACTICAL_PURPOSES))
        or bool(applicants.intersection(COMMUNITY_APPLICANT_TYPES))
        or route in PRACTICAL_ACCESS_ROUTES
        or scale_value in PRACTICAL_SCALES
    )


def classify_candidate(
    *,
    page: dict[str, Any],
    source: dict[str, Any],
    registry: list[dict[str, Any]],
    discovered_via: str,
    seen_at: str,
) -> dict[str, Any]:
    title = page.get("title", "") or source.get("name", "Untitled candidate")
    text = page.get("text", "")
    snippet = page.get("snippet", "")
    combined = f"{title}\n{snippet}\n{text[:5000]}".lower()

    candidate_type = candidate_type_from_page(page)
    deadline_hint = detect_deadline_hint(text)
    latest_year = latest_year_hint(title, page["url"], snippet, deadline_hint or "")
    duplicate = find_existing_registry_match(page["url"], registry)

    applicant_types, access_route, scale = source_extract_defaults(source)
    purposes = dedupe_keep_order(source.get("purposes", []) or [])
    fit = practical_fit(source, applicant_types, access_route, scale)

    confidence = 0.0
    reason_flags: list[str] = []
    promotion_reasons: list[str] = []

    confidence += 0.15
    if same_or_child_domain(page["url"], source.get("trusted_domain") or canonical_domain(source["url"])):
        confidence += 0.12
        reason_flags.append("trusted_domain_child")

    actionable_hits = phrase_hit_count(combined, ACTIONABLE_PHRASES)
    if actionable_hits:
        confidence += min(0.28, 0.07 * actionable_hits)
        reason_flags.append("actionable_language")
        promotion_reasons.append("application or call language detected")

    if deadline_hint:
        confidence += 0.08
        reason_flags.append("deadline_detected")
        promotion_reasons.append("deadline language detected")

    if fit:
        confidence += 0.12
        reason_flags.append("practical_fit")
        promotion_reasons.append("good fit for practical/community use")

    if applicant_types:
        confidence += 0.06
        reason_flags.append("applicant_types_present")
    if access_route:
        confidence += 0.04
        reason_flags.append("access_route_present")
    if scale:
        confidence += 0.04
        reason_flags.append("scale_present")

    if looks_generic_title(title) and not actionable_hits:
        confidence -= 0.18
        reason_flags.append("generic_title")

    confidence = max(0.0, min(0.99, confidence))

    already_trusted = False
    trusted_registry_id = None
    status = "suppressed_non_actionable"
    public_visible_state = "discovery_only"
    promotion_signal = "red"

    if duplicate:
        status = "suppressed_existing"
        public_visible_state = "discovery_only"
        promotion_signal = "red"
        already_trusted = True
        trusted_registry_id = duplicate["id"]
        reason_flags.append("already_covered_by_trusted_source")
        promotion_reasons = [f"Already covered by trusted source {duplicate['id']}"]

    elif candidate_type in {"pdf_page", "tender_page", "news_page", "award_page"}:
        status = "suppressed_non_actionable"
        public_visible_state = "discovery_only"
        promotion_signal = "red"
        reason_flags.append(candidate_type)
        if candidate_type == "pdf_page":
            promotion_reasons = ["PDF or binary content is not actionable for review"]
        elif candidate_type == "tender_page":
            promotion_reasons = ["Tender or procurement page, not a grant/support listing"]
        elif candidate_type == "news_page":
            promotion_reasons = ["Announcement or press-style page, not a direct funding route"]
        else:
            promotion_reasons = ["Award/results page, not a live funding route"]

    elif text_has_any(combined, NON_ACTIONABLE_PHRASES):
        status = "suppressed_non_actionable"
        public_visible_state = "discovery_only"
        promotion_signal = "red"
        reason_flags.append("non_actionable_phrase")
        promotion_reasons = ["Contains announcement, results, tender, or passed-deadline language"]

    elif is_stale_non_actionable(latest_year, candidate_type):
        status = "suppressed_non_actionable"
        public_visible_state = "discovery_only"
        promotion_signal = "red"
        reason_flags.append("stale_time_bound_page")
        promotion_reasons = [f"Time-bound page appears stale for {latest_year}"]

    elif actionable_hits or fit:
        status = "pending_review"
        public_visible_state = "review_only"
        promotion_signal = "green" if confidence >= 0.68 else "amber"
        if not promotion_reasons:
            promotion_reasons = ["Looks actionable and not already covered"]

    else:
        status = "suppressed_non_actionable"
        public_visible_state = "discovery_only"
        promotion_signal = "red"
        reason_flags.append("weak_signal")
        promotion_reasons = ["Signal too weak for human review"]

    return {
        "id": candidate_id(source["id"], page["url"]),
        "url": page["url"],
        "canonical_family_key": canonical_candidate_family_key(page["url"]),
        "domain": canonical_domain(page["url"]),
        "title": title,
        "snippet": snippet,
        "first_seen": seen_at,
        "last_seen": seen_at,
        "discovered_via": discovered_via,
        "source_hint": source.get("name", ""),
        "source_id_hint": source.get("id", ""),
        "candidate_type": candidate_type,
        "confidence": round(confidence, 3),
        "promotion_signal": promotion_signal,
        "public_visible_state": public_visible_state,
        "promotion_reasons": promotion_reasons,
        "status": status,
        "suggested_purposes": purposes,
        "suggested_applicant_types": applicant_types,
        "suggested_access_route": access_route,
        "suggested_scale": scale,
        "reason_flags": dedupe_keep_order(reason_flags),
        "deadline_hint": deadline_hint,
        "page_hash": page.get("page_hash"),
        "notes": "",
        "seen_in_latest_run": True,
        "already_trusted": already_trusted,
        "trusted_registry_id": trusted_registry_id,
    }


def choose_better(existing: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    rank = {
        "pending_review": 5,
        "suppressed_existing": 4,
        "suppressed_non_actionable": 3,
        "promoted": 2,
        "rejected": 1,
    }

    existing_rank = rank.get(existing.get("status"), 0)
    candidate_rank = rank.get(candidate.get("status"), 0)

    if candidate_rank > existing_rank:
        return candidate
    if existing_rank > candidate_rank:
        return existing

    if float(candidate.get("confidence", 0)) > float(existing.get("confidence", 0)):
        return candidate
    return existing


def preserve_previous_fields(candidate: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    if not previous:
        return candidate

    for field in PERSISTENT_FIELDS:
        if previous.get(field):
            candidate[field] = previous[field]

    prev_status = str(previous.get("status") or "").strip()
    if prev_status == "promoted":
        candidate["status"] = "promoted"
        candidate["public_visible_state"] = "public_visible"
        candidate["promotion_signal"] = "green"
        candidate["already_trusted"] = previous.get("already_trusted", False)
        candidate["trusted_registry_id"] = previous.get("trusted_registry_id")
    elif prev_status == "rejected":
        candidate["status"] = "rejected"
        candidate["public_visible_state"] = "discovery_only"
        candidate["promotion_signal"] = "red"

    candidate["first_seen"] = previous.get("first_seen", candidate["first_seen"])
    return candidate


def update_meta_counts(payload: dict[str, Any]) -> None:
    candidates = payload.get("candidates", [])
    meta = payload.setdefault("meta", {})

    meta["generated_at"] = now_iso()
    meta["generator"] = "grant-radar-discovery 1.0"
    meta["candidate_count"] = len(candidates)
    meta["high_confidence_count"] = sum(
        1 for item in candidates
        if item.get("status") == "pending_review" and float(item.get("confidence", 0)) >= 0.8
    )
    meta["pending_review_count"] = sum(1 for item in candidates if item.get("status") == "pending_review")
    meta["promoted_count"] = sum(1 for item in candidates if item.get("status") == "promoted")
    meta["rejected_count"] = sum(1 for item in candidates if item.get("status") == "rejected")
    meta["suppressed_existing_count"] = sum(1 for item in candidates if item.get("status") == "suppressed_existing")
    meta["suppressed_non_actionable_count"] = sum(
        1 for item in candidates if item.get("status") == "suppressed_non_actionable"
    )
    meta["approved_count"] = 0
    meta["cl_drafted_count"] = 0
    meta["promotion_requested_count"] = sum(1 for item in candidates if item.get("promotion_requested"))

    domains = Counter(item.get("domain") for item in candidates if item.get("domain"))
    meta["domains_seen"] = dict(sorted(domains.items()))


def main() -> None:
    registry = load_json(REGISTRY_PATH, default=[])
    previous_payload = load_json(DISCOVERY_PATH, default={"meta": {}, "candidates": []})
    previous_candidates = {
        item.get("id"): item
        for item in previous_payload.get("candidates", [])
        if item.get("id")
    }

    discovered_map: dict[str, dict[str, Any]] = {}
    memory_sources: list[dict[str, Any]] = []
    seen_at = now_iso()

    for source in registry:
        if not source.get("discovery_enabled", True):
            continue

        trusted_domain = source.get("trusted_domain") or canonical_domain(source["url"])
        watch_terms = source_watch_terms(source)
        watch_urls = build_watch_urls(source)

        source_memory: dict[str, Any] = {
            "id": source.get("id"),
            "name": source.get("name"),
            "watched_urls": watch_urls,
            "fetched_pages": [],
            "child_urls": [],
            "errors": [],
        }

        child_urls: list[str] = []

        for watch_url in watch_urls:
            page, error = fetch_page(watch_url)
            if error:
                source_memory["errors"].append({"url": watch_url, "error": error})
                continue

            source_memory["fetched_pages"].append({
                "url": page["url"],
                "page_hash": page["page_hash"],
                "is_pdf": page["is_pdf"],
            })

            for link in page.get("links", []):
                if looks_like_candidate_link(link["url"], link["label"], watch_terms, trusted_domain):
                    child_urls.append(link["url"])

        child_urls = dedupe_keep_order(child_urls)[:MAX_CHILD_LINKS_PER_SOURCE]
        source_memory["child_urls"] = child_urls
        memory_sources.append(source_memory)

        for child_url in child_urls:
            child_page, error = fetch_page(child_url)
            if error:
                source_memory["errors"].append({"url": child_url, "error": error})
                continue

            candidate = classify_candidate(
                page=child_page,
                source=source,
                registry=registry,
                discovered_via="child_link",
                seen_at=seen_at,
            )

            previous = previous_candidates.get(candidate["id"])
            candidate = preserve_previous_fields(candidate, previous)

            identity = candidate["canonical_family_key"]
            existing = discovered_map.get(identity)
            discovered_map[identity] = choose_better(existing, candidate) if existing else candidate

    final_candidates = list(discovered_map.values())

    # Keep previously completed items even if not seen this run, so history is not lost.
    for previous in previous_payload.get("candidates", []):
        if previous.get("status") not in {"promoted", "rejected"}:
            continue
        if any(item.get("id") == previous.get("id") for item in final_candidates):
            continue
        carried = dict(previous)
        carried["seen_in_latest_run"] = False
        final_candidates.append(carried)

    final_candidates.sort(
        key=lambda item: (
            {
                "pending_review": 0,
                "suppressed_existing": 1,
                "suppressed_non_actionable": 2,
                "promoted": 3,
                "rejected": 4,
            }.get(item.get("status"), 9),
            -float(item.get("confidence", 0)),
            item.get("title", "").lower(),
        )
    )

    payload = {
        "meta": {},
        "candidates": final_candidates,
    }
    update_meta_counts(payload)
    save_json(DISCOVERY_PATH, payload)

    memory_payload = {
        "generated_at": seen_at,
        "generator": "grant-radar-discovery 1.0",
        "sources": memory_sources,
    }
    save_json(MEMORY_PATH, memory_payload)

    print(f"Wrote discovery queue: {DISCOVERY_PATH}")
    print(f"Wrote discovery memory: {MEMORY_PATH}")
    print(json.dumps(payload["meta"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()