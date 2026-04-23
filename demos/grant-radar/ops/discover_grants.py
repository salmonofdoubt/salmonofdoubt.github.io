#!/usr/bin/env python3
"""Discovery layer for Grant Radar with persistent CL draft metadata.

This version reduces duplicate review candidates by:
- blocking obvious non-funding child pages
- collapsing multilingual URL variants into one candidate family
- preferring English variants when several language pages exist
- preserving review / CL metadata across refreshes
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from dataclasses import dataclass
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

USER_AGENT = "GrantRadarDiscoverBot/0.5 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
TIMEOUT = (10, 30)

MAX_WATCH_URLS_PER_SOURCE = 8
MAX_CHILD_LINKS_PER_SOURCE = 18
MAX_CANDIDATES_PER_SOURCE = 14

APPLICANT_PRIORITY = [
    "local groups",
    "farmers",
    "public bodies",
    "researchers",
    "businesses",
    "NGOs",
    "schools",
    "households",
]

COMMON_WATCH_TERMS = [
    "grant", "grants", "fund", "funding", "call", "calls", "scheme", "schemes",
    "proposals", "application", "applications", "research", "community", "biodiversity",
    "environment", "energy", "climate", "water", "catchment", "river", "farmers",
    "farm", "advisory", "restoration", "habitat", "riparian", "wetlands", "peatlands",
    "tidy towns", "local groups",
]

FUNDING_PHRASES = [
    "applications open", "call for proposals", "call for applications", "funding now available",
    "grant scheme", "grant programme", "funding programme", "funding opportunity", "open call",
    "research call", "expression of interest", "apply now", "scheme launched", "call opens",
    "deadline for applications", "deadline for applicants", "submit a proposal",
    "advisory service", "support programme", "improve water quality", "priority areas",
    "catchment action plan", "farmers will be invited", "free programme available to all farmers",
]

LINK_HINT_TERMS = [
    "grant", "fund", "funding", "call", "scheme", "proposal", "application", "award",
    "research", "biodiversity", "climate", "energy", "community", "water", "catchment",
    "farm", "farmer", "assap", "acres", "advisory", "tidy towns", "restoration",
]

DEADLINE_PATTERNS = [
    r"(deadline(?: for (?:applications|applicants|submissions))?[:\s]+[^\n\r]{0,120})",
    r"(closing date[:\s]+[^\n\r]{0,120})",
    r"(applications? close[^\n\r]{0,120})",
    r"(submit(?:ted)? by[^\n\r]{0,120})",
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
    r"/strategy/?$",
    r"/policies/?$",
    r"/policy/?$",
    r"/privacy/?$",
    r"/cookie(?:-policy)?/?$",
    r"/funded-research/?$",
]

LANGUAGE_SUFFIX_RE = re.compile(
    r"_(bg|cs|da|de|el|en|es|et|fi|fr|ga|hr|hu|it|lt|lv|mt|nl|pl|pt|ro|sk|sl|sv)$",
    flags=re.IGNORECASE,
)

@dataclass
class Candidate:
    id: str
    url: str
    canonical_family_key: str
    domain: str
    title: str
    snippet: str
    first_seen: str
    last_seen: str
    discovered_via: str
    source_hint: str
    source_id_hint: str
    candidate_type: str
    confidence: float
    status: str
    suggested_purposes: list[str]
    suggested_applicant_types: list[str]
    suggested_access_route: str | None
    suggested_scale: str | None
    reason_flags: list[str]
    deadline_hint: str | None
    page_hash: str
    notes: str
    seen_in_latest_run: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "url": self.url,
            "canonical_family_key": self.canonical_family_key,
            "domain": self.domain,
            "title": self.title,
            "snippet": self.snippet,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "discovered_via": self.discovered_via,
            "source_hint": self.source_hint,
            "source_id_hint": self.source_id_hint,
            "candidate_type": self.candidate_type,
            "confidence": round(self.confidence, 3),
            "status": self.status,
            "suggested_purposes": self.suggested_purposes,
            "suggested_applicant_types": self.suggested_applicant_types,
            "suggested_access_route": self.suggested_access_route,
            "suggested_scale": self.suggested_scale,
            "reason_flags": self.reason_flags,
            "deadline_hint": self.deadline_hint,
            "page_hash": self.page_hash,
            "notes": self.notes,
            "seen_in_latest_run": self.seen_in_latest_run,
        }


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def canonical_domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


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


def is_same_or_child_domain(url: str, trusted_domain: str) -> bool:
    domain = canonical_domain(url)
    return domain == trusted_domain or domain.endswith(f".{trusted_domain}")


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


def ordered(values: list[str], priority: list[str]) -> list[str]:
    unique = dedupe_keep_order(values)
    order_map = {value: index for index, value in enumerate(priority)}
    return sorted(unique, key=lambda value: (order_map.get(value, 999), value.lower()))


def normalise_applicant_types(raw_types: list[str]) -> list[str]:
    lowered = [value.lower() for value in raw_types]
    simplified: list[str] = []

    def has(*needles: str) -> bool:
        return any(any(needle in value for needle in needles) for value in lowered)

    if has("community", "voluntary", "tidy", "angling", "association", "local development", "catchment partnership", "rural network", "social enterprise", "community partners"):
        simplified.append("local groups")
    if has("farmer", "farmers", "farm family"):
        simplified.append("farmers")
    if has("local authorit", "public bod", "project coordinator", "state agenc"):
        simplified.append("public bodies")
    if has("research", "universit", "institute", "phd", "postgraduate", "scholar"):
        simplified.append("researchers")
    if has("business", "enterprise", "founder", "micro-enterprise"):
        simplified.append("businesses")
    if has("ngo", "non-governmental", "conservation group", "heritage ngo", "environmental ngo"):
        simplified.append("NGOs")
    if has("school"):
        simplified.append("schools")
    if has("homeowner", "household"):
        simplified.append("households")
    if not simplified:
        simplified = raw_types[:]
    return ordered(simplified, APPLICANT_PRIORITY)


def normalise_scale(raw_scale: str | None) -> str | None:
    if not raw_scale:
        return None
    lowered = raw_scale.lower().strip()
    if lowered in {"micro", "small", "local"}:
        return "local"
    if lowered in {"support", "advisory support", "implementation support"}:
        return "support"
    if lowered == "medium":
        return "medium"
    if lowered == "major":
        return "major"
    return raw_scale


def normalise_access_route(raw_route: str | None) -> str | None:
    if not raw_route:
        return None
    lowered = raw_route.lower().strip()
    if lowered in {"advisory support", "implementation support"}:
        return "advisory support"
    if lowered in {"via advisor", "via adviser", "via project advisor"}:
        return "via advisor"
    if lowered in {"via local authority", "via local authorities"}:
        return "via local authority"
    if lowered in {"via local action group", "via lag"}:
        return "via local action group"
    if lowered in {"via project coordinator"}:
        return "via project coordinator"
    if lowered in {"consortium", "via consortium"}:
        return "consortium"
    return "direct" if lowered == "direct" else raw_route


def ensure_registry_defaults(registry: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    for source in registry:
        trusted_domain = source.get("trusted_domain") or canonical_domain(source["url"])
        if source.get("trusted_domain") != trusted_domain:
            source["trusted_domain"] = trusted_domain
            changed = True

        defaults = {
            "source_class": "programme_page",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "unknown",
            "usual_open_months": [],
            "watch_paths": [],
            "watch_terms": [],
        }
        for key, value in defaults.items():
            if key not in source:
                source[key] = value
                changed = True

        source["watch_terms"] = dedupe_keep_order(
            list(source.get("watch_terms", [])) + list(source.get("purposes", [])) + [source.get("name", "")]
        )
        source["watch_terms"] = dedupe_keep_order(source["watch_terms"] + COMMON_WATCH_TERMS)

        extract = source.setdefault("extract", {})
        if "mode" not in extract:
            extract["mode"] = "single_item"
            changed = True

    return registry, changed


def fetch_page(url: str) -> tuple[dict[str, Any] | None, str | None]:
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        return None, str(exc)

    soup = BeautifulSoup(response.text, "html.parser")
    title = ""
    if soup.title and soup.title.string:
        title = re.sub(r"\s+", " ", soup.title.string).strip()

    text = soup.get_text("\n", strip=True)
    snippet = re.sub(r"\s+", " ", text[:700]).strip()
    page_hash = "sha256:" + hashlib.sha256(response.text.encode("utf-8", errors="ignore")).hexdigest()

    links: list[dict[str, str]] = []
    for anchor in soup.find_all("a", href=True):
        href = canonical_url(urljoin(url, anchor["href"]))
        label = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).strip()
        if href.startswith("http"):
            links.append({"url": href, "label": label})

    return {
        "url": canonical_url(url),
        "title": title,
        "text": text,
        "snippet": snippet,
        "links": links,
        "page_hash": page_hash,
    }, None


def detect_deadline_hint(text: str) -> str | None:
    for pattern in DEADLINE_PATTERNS:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def count_phrase_hits(text: str, phrases: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for phrase in phrases if phrase in lowered)


def is_denied_child_url(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower().rstrip("/")
    if not path:
        return False
    return any(re.search(pattern, path) for pattern in DENYLIST_PATTERNS)


def looks_like_grant_link(url: str, label: str, watch_terms: list[str]) -> bool:
    haystack = f"{url} {label}".lower()
    if is_denied_child_url(url):
        return False
    return any(term.lower() in haystack for term in dedupe_keep_order(LINK_HINT_TERMS + watch_terms))


def build_watch_urls(source: dict[str, Any]) -> list[str]:
    urls = [canonical_url(source["url"])]
    root = f"{urlparse(source['url']).scheme}://{urlparse(source['url']).netloc}"
    for path in source.get("watch_paths", []):
        urls.append(canonical_url(urljoin(root.rstrip("/") + "/", path.lstrip("/"))))
    return dedupe_keep_order(urls)[:MAX_WATCH_URLS_PER_SOURCE]


def classify_candidate(page: dict[str, Any], source: dict[str, Any], discovered_via: str, seen_at: str) -> Candidate | None:
    title = page.get("title", "") or source.get("name", "Untitled candidate")
    text = page.get("text", "")
    snippet = page.get("snippet", "")
    trusted_domain = source["trusted_domain"]

    combined = f"{title}\n{snippet}\n{text[:4000]}".lower()
    phrase_hits = count_phrase_hits(combined, FUNDING_PHRASES)
    watch_hits = count_phrase_hits(combined, source.get("watch_terms", []))
    deadline_hint = detect_deadline_hint(text)

    confidence = 0.0
    reason_flags: list[str] = []

    if is_same_or_child_domain(page["url"], trusted_domain):
        confidence += 0.25
        reason_flags.append("trusted_domain")
    if phrase_hits:
        confidence += min(0.25, 0.08 * phrase_hits)
        reason_flags.append("funding_or_support_phrase")
    if deadline_hint:
        confidence += 0.15
        reason_flags.append("deadline_detected")
    if watch_hits:
        confidence += min(0.18, 0.03 * watch_hits)
        reason_flags.append("watch_term_overlap")
    if source.get("usual_open_months"):
        month = datetime.now(UTC).month
        if month in source.get("usual_open_months", []):
            confidence += 0.10
            reason_flags.append("cycle_window_match")
    if discovered_via == "child_link":
        confidence += 0.10
        reason_flags.append("child_page")

    confidence = min(confidence, 0.99)
    if confidence < 0.45:
        return None

    candidate_type = "call_page"
    lowered_title = title.lower()
    if "news" in lowered_title or "press release" in lowered_title:
        candidate_type = "news_page"
    if "award" in lowered_title or "results" in lowered_title:
        candidate_type = "award_page"
    if any(token in lowered_title for token in ["advisory", "campaign", "support", "programme"]):
        candidate_type = "support_page"

    raw_applicant_types = source.get("extract", {}).get("applicant_types", [])
    applicant_types = normalise_applicant_types(raw_applicant_types)
    access_route = normalise_access_route(source.get("extract", {}).get("access_route"))
    scale = normalise_scale(source.get("extract", {}).get("scale"))
    family_key = canonical_candidate_family_key(page["url"])

    candidate_id = slugify(f"cand_{source['id']}_{page['url']}")

    return Candidate(
        id=candidate_id,
        url=page["url"],
        canonical_family_key=family_key,
        domain=canonical_domain(page["url"]),
        title=title,
        snippet=snippet[:420],
        first_seen=seen_at,
        last_seen=seen_at,
        discovered_via=discovered_via,
        source_hint=source["name"],
        source_id_hint=source["id"],
        candidate_type=candidate_type,
        confidence=confidence,
        status="pending_review",
        suggested_purposes=source.get("purposes", [])[:8],
        suggested_applicant_types=applicant_types[:8],
        suggested_access_route=access_route,
        suggested_scale=scale,
        reason_flags=dedupe_keep_order(reason_flags),
        deadline_hint=deadline_hint,
        page_hash=page["page_hash"],
        notes="",
        seen_in_latest_run=True,
    )


PERSISTENT_FIELDS = [
    "status",
    "notes",
    "promotion_requested",
    "promotion_request_issue_number",
    "promotion_request_issue_url",
    "request_origin_status",
    "cl_draft_ready",
    "cl_draft_generated_at",
    "cl_draft_json",
    "cl_draft_html",
]


def choose_better_candidate(existing: Candidate, candidate: Candidate) -> Candidate:
    existing_is_en = existing.url.lower().endswith("_en")
    candidate_is_en = candidate.url.lower().endswith("_en")

    if candidate_is_en and not existing_is_en:
        return candidate
    if existing_is_en and not candidate_is_en:
        return existing
    if candidate.discovered_via == "source_page" and existing.discovered_via != "source_page":
        return candidate
    if existing.discovered_via == "source_page" and candidate.discovered_via != "source_page":
        return existing
    if candidate.confidence > existing.confidence:
        return candidate
    if candidate.confidence == existing.confidence and len(candidate.url) < len(existing.url):
        return candidate
    return existing


def merge_candidates(previous_payload: dict[str, Any], newly_found: list[Candidate], seen_at: str) -> dict[str, Any]:
    previous_candidates = {item["url"]: item for item in previous_payload.get("candidates", [])}
    merged: dict[str, dict[str, Any]] = {}

    for candidate in newly_found:
        item = candidate.as_dict()
        old = previous_candidates.get(item["url"])
        if old:
            item["first_seen"] = old.get("first_seen", item["first_seen"])
            item["last_seen"] = seen_at
            for field in PERSISTENT_FIELDS:
                if field in old:
                    item[field] = old[field]
        merged[item["url"]] = item

    for url, old in previous_candidates.items():
        if url in merged:
            continue
        old_copy = dict(old)
        old_copy["seen_in_latest_run"] = False
        old_copy["last_seen"] = old.get("last_seen", seen_at)
        merged[url] = old_copy

    candidates = list(merged.values())
    candidates.sort(key=lambda item: (-float(item.get("confidence", 0)), item.get("title", "")))

    high_conf = sum(1 for item in candidates if float(item.get("confidence", 0)) >= 0.8)
    pending = sum(1 for item in candidates if item.get("status") == "pending_review")
    approved = sum(1 for item in candidates if item.get("status") == "approved")
    drafted = sum(1 for item in candidates if item.get("status") == "cl_drafted")
    promoted = sum(1 for item in candidates if item.get("status") == "promoted")
    requested = sum(1 for item in candidates if item.get("promotion_requested"))
    by_domain = defaultdict(int)
    for item in candidates:
        by_domain[item.get("domain", "unknown")] += 1

    return {
        "meta": {
            "generated_at": seen_at,
            "generator": "grant-radar-discovery 0.5",
            "candidate_count": len(candidates),
            "high_confidence_count": high_conf,
            "pending_review_count": pending,
            "approved_count": approved,
            "cl_drafted_count": drafted,
            "promoted_count": promoted,
            "promotion_requested_count": requested,
            "domains_seen": dict(sorted(by_domain.items())),
        },
        "candidates": candidates,
    }


def update_memory(memory: dict[str, Any], page: dict[str, Any], fetch_status: str, seen_at: str) -> None:
    pages = memory.setdefault("pages", {})
    entry = pages.get(page["url"], {})
    entry["url"] = page["url"]
    entry["domain"] = canonical_domain(page["url"])
    entry["canonical_family_key"] = canonical_candidate_family_key(page["url"])
    entry["first_seen"] = entry.get("first_seen", seen_at)
    entry["last_seen"] = seen_at
    entry["last_title"] = page.get("title", "")
    entry["page_hash"] = page.get("page_hash", "")
    entry["fetch_status"] = fetch_status
    entry["times_seen"] = int(entry.get("times_seen", 0)) + 1
    pages[page["url"]] = entry


def discover() -> None:
    seen_at = now_iso()
    registry = load_json(REGISTRY_PATH, default=[])
    registry, registry_changed = ensure_registry_defaults(registry)
    previous_discovery = load_json(DISCOVERY_PATH, default={})
    memory = load_json(MEMORY_PATH, default={"meta": {"generated_at": seen_at, "generator": "grant-radar-discovery 0.5"}, "pages": {}})
    newly_found: list[Candidate] = []

    for source in registry:
        if not source.get("discovery_enabled", True):
            continue

        trusted_domain = source["trusted_domain"]
        candidate_count_for_source = 0

        for watch_url in build_watch_urls(source):
            page, error = fetch_page(watch_url)
            if error or not page:
                error_page = {"url": canonical_url(watch_url), "title": "", "page_hash": ""}
                update_memory(memory, error_page, f"error: {error}", seen_at)
                continue

            update_memory(memory, page, "ok", seen_at)
            direct_candidate = classify_candidate(page, source, "source_page", seen_at)
            if direct_candidate:
                newly_found.append(direct_candidate)
                candidate_count_for_source += 1

            if candidate_count_for_source >= MAX_CANDIDATES_PER_SOURCE:
                continue

            same_domain_links = []
            for link in page.get("links", []):
                href = link["url"]
                if not is_same_or_child_domain(href, trusted_domain):
                    continue
                if href == page["url"]:
                    continue
                if looks_like_grant_link(href, link.get("label", ""), source.get("watch_terms", [])):
                    same_domain_links.append(href)

            family_seen: set[str] = set()
            filtered_child_urls: list[str] = []
            for child_url in dedupe_keep_order(same_domain_links):
                family_key = canonical_candidate_family_key(child_url)
                if family_key in family_seen:
                    continue
                family_seen.add(family_key)
                filtered_child_urls.append(child_url)

            for child_url in filtered_child_urls[:MAX_CHILD_LINKS_PER_SOURCE]:
                if candidate_count_for_source >= MAX_CANDIDATES_PER_SOURCE:
                    break
                child_page, child_error = fetch_page(child_url)
                if child_error or not child_page:
                    error_page = {"url": canonical_url(child_url), "title": "", "page_hash": ""}
                    update_memory(memory, error_page, f"error: {child_error}", seen_at)
                    continue
                update_memory(memory, child_page, "ok", seen_at)
                child_candidate = classify_candidate(child_page, source, "child_link", seen_at)
                if child_candidate:
                    newly_found.append(child_candidate)
                    candidate_count_for_source += 1

    best_by_family: dict[str, Candidate] = {}
    for candidate in newly_found:
        existing = best_by_family.get(candidate.canonical_family_key)
        if existing is None:
            best_by_family[candidate.canonical_family_key] = candidate
        else:
            best_by_family[candidate.canonical_family_key] = choose_better_candidate(existing, candidate)

    merged_payload = merge_candidates(previous_discovery, list(best_by_family.values()), seen_at)

    memory.setdefault("meta", {})
    memory["meta"]["generated_at"] = seen_at
    memory["meta"]["generator"] = "grant-radar-discovery 0.5"

    if registry_changed:
        save_json(REGISTRY_PATH, registry)
    save_json(DISCOVERY_PATH, merged_payload)
    save_json(MEMORY_PATH, memory)
    print(f"Wrote {DISCOVERY_PATH}")
    print(f"Wrote {MEMORY_PATH}")
    if registry_changed:
        print(f"Updated {REGISTRY_PATH} with discovery defaults")


if __name__ == "__main__":
    discover()
