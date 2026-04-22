#!/usr/bin/env python3
"""Discovery layer for Geo Radar.

This script does NOT publish directly to the live catalogue.
Instead, it scans trusted domains derived from source-registry.json,
finds candidate funding, fellowship, programme and research-opportunity pages,
assigns lightweight classifications, and writes them to
data/discovery-candidates.json for review.

It also keeps simple page memory in data/source-memory.json so Geo Radar
can become more receptive to new geoscience-relevant opportunity pages.
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

USER_AGENT = "GeoRadarDiscoverBot/0.2 (+https://salmonofdoubt.github.io/demos/geo-radar/)"
TIMEOUT = (10, 30)

MAX_WATCH_URLS_PER_SOURCE = 8
MAX_CHILD_LINKS_PER_SOURCE = 16
MAX_CANDIDATES_PER_SOURCE = 12

COMMON_WATCH_TERMS = [
    "grant", "grants", "fund", "funding", "call", "calls", "programme", "programmes",
    "fellowship", "fellowships", "research", "career", "careers", "vacancy", "vacancies",
    "hydrogen", "geoscience", "geochemistry", "geothermal", "subsurface", "storage",
    "monitoring", "science", "proposal", "applications", "apply",
]

FUNDING_PHRASES = [
    "applications open", "call for proposals", "call for applications", "funding now available",
    "grant scheme", "grant programme", "funding programme", "funding opportunity", "open call",
    "research call", "expression of interest", "apply now", "scheme launched", "call opens",
    "deadline for applications", "deadline for applicants", "submit a proposal",
    "fellowship", "fellowships", "vacancy", "vacancies", "job opening", "scientific jobs board",
]

LINK_HINT_TERMS = [
    "grant", "fund", "funding", "call", "scheme", "proposal", "application", "award",
    "research", "fellowship", "career", "jobs", "vacancy", "hydrogen", "geothermal",
    "subsurface", "geochemistry", "geoscience",
]

DEADLINE_PATTERNS = [
    r"(deadline(?: for (?:applications|applicants|submissions))?[:\s]+[^\n\r]{0,120})",
    r"(closing date[:\s]+[^\n\r]{0,120})",
    r"(applications? close[^\n\r]{0,120})",
    r"(submit(?:ted)? by[^\n\r]{0,120})",
]


@dataclass
class Candidate:
    id: str
    url: str
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
    url = urlunparse(normalized)
    if url.endswith("/") and parsed.path not in ("", "/"):
        url = url[:-1]
    return url


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


def ensure_registry_defaults(registry: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    for source in registry:
        trusted_domain = source.get("trusted_domain") or canonical_domain(source["url"])
        if source.get("trusted_domain") != trusted_domain:
            source["trusted_domain"] = trusted_domain
            changed = True

        defaults = {
            "source_class": "programme_page",
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
            list(source.get("watch_terms", []))
            + list(source.get("purposes", []))
            + [source.get("name", "")]
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


def looks_like_grant_link(url: str, label: str, watch_terms: list[str]) -> bool:
    haystack = f"{url} {label}".lower()
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
        reason_flags.append("opportunity_phrase")

    if deadline_hint:
        confidence += 0.15
        reason_flags.append("deadline_detected")

    if watch_hits:
        confidence += min(0.15, 0.03 * watch_hits)
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
    if "job" in lowered_title or "vacanc" in lowered_title or "career" in lowered_title:
        candidate_type = "job_page"
    if "fellowship" in lowered_title:
        candidate_type = "fellowship_page"

    candidate_id = slugify(f"cand_{source['id']}_{page['url']}")

    return Candidate(
        id=candidate_id,
        url=page["url"],
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
        suggested_applicant_types=source.get("extract", {}).get("applicant_types", [])[:8],
        suggested_access_route=source.get("extract", {}).get("access_route"),
        suggested_scale=source.get("extract", {}).get("scale"),
        reason_flags=dedupe_keep_order(reason_flags),
        deadline_hint=deadline_hint,
        page_hash=page["page_hash"],
        notes="",
        seen_in_latest_run=True,
    )


def merge_candidates(previous_payload: dict[str, Any], newly_found: list[Candidate], seen_at: str) -> dict[str, Any]:
    previous_candidates = {item["url"]: item for item in previous_payload.get("candidates", [])}
    merged: dict[str, dict[str, Any]] = {}

    for candidate in newly_found:
        item = candidate.as_dict()
        old = previous_candidates.get(item["url"])
        if old:
            item["first_seen"] = old.get("first_seen", item["first_seen"])
            item["status"] = old.get("status", item["status"])
            item["notes"] = old.get("notes", item["notes"])
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
    by_domain = defaultdict(int)
    for item in candidates:
        by_domain[item.get("domain", "unknown")] += 1

    return {
        "meta": {
            "generated_at": seen_at,
            "generator": "geo-radar-discovery 0.2",
            "candidate_count": len(candidates),
            "high_confidence_count": high_conf,
            "pending_review_count": pending,
            "domains_seen": dict(sorted(by_domain.items())),
        },
        "candidates": candidates,
    }


def update_memory(memory: dict[str, Any], page: dict[str, Any], fetch_status: str, seen_at: str) -> None:
    pages = memory.setdefault("pages", {})
    entry = pages.get(page["url"], {})
    entry["url"] = page["url"]
    entry["domain"] = canonical_domain(page["url"])
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
    memory = load_json(
        MEMORY_PATH,
        default={
            "meta": {"generated_at": seen_at, "generator": "geo-radar-discovery 0.2"},
            "pages": {},
        },
    )

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

            for child_url in dedupe_keep_order(same_domain_links)[:MAX_CHILD_LINKS_PER_SOURCE]:
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

    best_by_url: dict[str, Candidate] = {}
    for candidate in newly_found:
        existing = best_by_url.get(candidate.url)
        if existing is None or candidate.confidence > existing.confidence:
            best_by_url[candidate.url] = candidate

    merged_payload = merge_candidates(previous_discovery, list(best_by_url.values()), seen_at)

    memory.setdefault("meta", {})
    memory["meta"]["generated_at"] = seen_at
    memory["meta"]["generator"] = "geo-radar-discovery 0.2"

    if registry_changed:
        save_json(REGISTRY_PATH, registry)
    save_json(DISCOVERY_PATH, merged_payload)
    save_json(MEMORY_PATH, memory)

    print(f"Wrote {DISCOVERY_PATH}")
    print(f"Wrote {MEMORY_PATH}")
    if registry_changed:
        print(f"Updated {REGISTRY_PATH} with Geo discovery defaults")


if __name__ == "__main__":
    discover()
