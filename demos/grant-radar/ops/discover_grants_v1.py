#!/usr/bin/env python3
"""Discovery layer for Grant Radar with persistent metadata.

This replacement keeps the existing review-oriented workflow and adds
strong stale-page suppression so old call pages do not keep surfacing
as high-confidence candidates.
"""

from __future__ import annotations

import hashlib
import json
import re
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

USER_AGENT = "GrantRadarDiscoverBot/0.8 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
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
    "grant",
    "grants",
    "fund",
    "funding",
    "call",
    "calls",
    "scheme",
    "schemes",
    "proposals",
    "application",
    "applications",
    "research",
    "community",
    "biodiversity",
    "environment",
    "energy",
    "climate",
    "water",
    "catchment",
    "river",
    "farmers",
    "farm",
    "advisory",
    "restoration",
    "habitat",
    "riparian",
    "wetlands",
    "peatlands",
    "tidy towns",
    "local groups",
]

FUNDING_PHRASES = [
    "applications open",
    "call for proposals",
    "call for applications",
    "funding now available",
    "grant scheme",
    "grant programme",
    "funding programme",
    "funding opportunity",
    "open call",
    "research call",
    "expression of interest",
    "apply now",
    "scheme launched",
    "call opens",
    "deadline for applications",
    "deadline for applicants",
    "submit a proposal",
    "advisory service",
    "support programme",
    "improve water quality",
    "priority areas",
    "catchment action plan",
    "farmers will be invited",
    "free programme available to all farmers",
]

LINK_HINT_TERMS = [
    "grant",
    "fund",
    "funding",
    "call",
    "scheme",
    "proposal",
    "application",
    "award",
    "research",
    "biodiversity",
    "climate",
    "energy",
    "community",
    "water",
    "catchment",
    "farm",
    "farmer",
    "assap",
    "acres",
    "advisory",
    "tidy towns",
    "restoration",
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
}

COMMUNITY_APPLICANT_TYPES = {
    "local groups",
    "NGOs",
    "public bodies",
    "schools",
}

PRACTICAL_ACCESS_ROUTES = {
    "direct",
    "advisory support",
    "via advisor",
    "via local authority",
    "via local action group",
}

PRACTICAL_SCALES = {
    "local",
    "support",
    "medium",
}

RIVER_TRUST_TERMS = [
    "river trust",
    "catchment partnership",
    "community water quality improvement",
    "community-led",
    "community grant",
    "citizen science",
    "restoration",
    "habitat restoration",
    "riparian",
    "wetland",
    "pond",
    "river restoration",
    "volunteer",
    "monitoring",
    "survey",
    "walk",
    "talk",
    "event",
    "education",
    "outreach",
]

STRONG_TITLE_HINT_TERMS = [
    "grant",
    "grants",
    "fund",
    "funding",
    "call",
    "calls",
    "scheme",
    "award",
    "awards",
    "applications open",
    "call for proposals",
    "community water quality improvement",
]

GENERIC_TITLE_PATTERNS = {
    "about",
    "about us",
    "our work",
    "our services",
    "what we do",
    "who we are",
    "how we can help",
    "news",
    "news and features",
    "publications",
    "publication",
    "research",
    "projects",
    "education",
    "funding",
    "funding and grants",
    "funding opportunities",
    "our organisation",
    "working with communities",
    "community information",
}

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
    "already_trusted",
    "trusted_registry_id",
]


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
    already_trusted: bool = False
    trusted_registry_id: str | None = None

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
            "already_trusted": self.already_trusted,
            "trusted_registry_id": self.trusted_registry_id,
        }


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


def ordered(values: list[str], priority: list[str]) -> list[str]:
    unique = dedupe_keep_order(values)
    order_map = {value: index for index, value in enumerate(priority)}
    return sorted(unique, key=lambda value: (order_map.get(value, 999), value.lower()))


def is_same_or_child_domain(url: str, trusted_domain: str) -> bool:
    domain = canonical_domain(url)
    return domain == trusted_domain or domain.endswith(f".{trusted_domain}")


def normalise_applicant_types(raw_types: list[str]) -> list[str]:
    lowered = [value.lower() for value in raw_types]
    simplified: list[str] = []

    def has(*needles: str) -> bool:
        return any(any(needle in value for needle in needles) for value in lowered)

    if has(
        "community",
        "voluntary",
        "tidy",
        "angling",
        "association",
        "local development",
        "catchment partnership",
        "rural network",
        "social enterprise",
        "community partners",
    ):
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
    if lowered == "direct":
        return "direct"
    return raw_route


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


def stale_year_penalty(
    latest_year: int | None,
    candidate_type: str,
    discovered_via: str,
    has_deadline_hint: bool,
) -> tuple[float, list[str], bool]:
    """Return penalty_score, flags, hard_reject."""
    if latest_year is None:
        return 0.0, [], False

    current_year = datetime.now(UTC).year
    age = current_year - latest_year
    if age <= 0:
        return 0.0, [], False

    flags: list[str] = []

    if age >= 4:
        flags.append("very_stale_year")
        return 0.0, flags, True

    if age >= 2 and candidate_type in {"call_page", "news_page", "award_page"}:
        flags.append("stale_time_bound_page")
        return 0.0, flags, True

    penalty = 0.0
    if has_deadline_hint and age >= 1:
        penalty += 0.40
        flags.append("stale_deadline_year")
    if candidate_type == "call_page" and age >= 1:
        penalty += 0.22
        flags.append("stale_call_year")
    if discovered_via == "child_link" and age >= 1:
        penalty += 0.10
        flags.append("stale_child_page")

    return penalty, flags, False


def count_phrase_hits(text: str, phrases: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for phrase in phrases if phrase in lowered)


def page_title_core(title: str) -> str:
    core = re.split(r"\s+[|\-–]\s+", title, maxsplit=1)[0]
    return re.sub(r"\s+", " ", core).strip()


def looks_generic_title(title: str) -> bool:
    core = page_title_core(title).lower()
    return core in GENERIC_TITLE_PATTERNS


def text_has_any(text: str, phrases: list[str]) -> bool:
    lowered = text.lower()
    return any(phrase.lower() in lowered for phrase in phrases)


def source_priority_bonus(
    source: dict[str, Any],
    applicant_types: list[str],
    access_route: str | None,
    scale: str | None,
) -> tuple[float, list[str]]:
    score = 0.0
    flags: list[str] = []

    purposes = set(source.get("purposes", []))
    source_class = source.get("source_class", "")

    if purposes.intersection(PRACTICAL_PURPOSES):
        score += 0.08
        flags.append("practical_route")

    if source_class in {"funding_hub", "programme_page", "implementation_programme"} and purposes.intersection(PRACTICAL_PURPOSES):
        score += 0.05
        flags.append("river_trust_source_class")

    if scale in PRACTICAL_SCALES:
        score += 0.06
        flags.append("practical_scale")

    if access_route in PRACTICAL_ACCESS_ROUTES:
        score += 0.06
        flags.append("practical_access")

    if any(value in COMMUNITY_APPLICANT_TYPES for value in applicant_types):
        score += 0.07
        flags.append("community_applicant_fit")

    source_watch_blob = " ".join(source.get("watch_terms", []))
    if text_has_any(source_watch_blob, RIVER_TRUST_TERMS):
        score += 0.05
        flags.append("river_trust_terms")

    return score, flags


def max_child_links_for_source(source: dict[str, Any]) -> int:
    if source.get("source_class") == "funding_hub":
        return 28
    return MAX_CHILD_LINKS_PER_SOURCE


def max_candidates_for_source(source: dict[str, Any]) -> int:
    if source.get("source_class") == "funding_hub":
        return 20
    return MAX_CANDIDATES_PER_SOURCE


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


def find_existing_registry_match(candidate_url: str, registry: list[dict[str, Any]]) -> dict[str, Any] | None:
    target_url = canonical_url(candidate_url)
    target_family = canonical_candidate_family_key(candidate_url)

    for item in registry:
        item_url = item.get("url", "")
        if canonical_url(item_url) == target_url:
            return {"kind": "url", "id": item.get("id")}

    for item in registry:
        item_url = item.get("url", "")
        if canonical_candidate_family_key(item_url) == target_family:
            return {"kind": "family", "id": item.get("id")}

    return None


def classify_candidate(
    page: dict[str, Any],
    source: dict[str, Any],
    registry: list[dict[str, Any]],
    discovered_via: str,
    seen_at: str,
) -> Candidate | None:
    title = page.get("title", "") or source.get("name", "Untitled candidate")
    text = page.get("text", "")
    snippet = page.get("snippet", "")
    trusted_domain = source["trusted_domain"]
    extract = source.get("extract", {})

    combined = f"{title}\n{snippet}\n{text[:4000]}".lower()
    phrase_hits = count_phrase_hits(combined, FUNDING_PHRASES)
    watch_hits = count_phrase_hits(combined, source.get("watch_terms", []))
    title_hits = count_phrase_hits(f"{page_title_core(title).lower()} {page['url'].lower()}", STRONG_TITLE_HINT_TERMS)
    deadline_hint = detect_deadline_hint(text)
    latest_year = latest_year_hint(title, page["url"], deadline_hint or "", snippet, text[:2000])

    raw_applicant_types = extract.get("applicant_types", [])
    normalised_applicant_types = normalise_applicant_types(raw_applicant_types)
    normalised_access_route = normalise_access_route(extract.get("access_route"))
    normalised_scale = normalise_scale(extract.get("scale"))

    lowered_title = page_title_core(title).lower()
    lowered_url = page["url"].lower()

    candidate_type = "call_page"
    if any(token in lowered_title for token in ["award", "awarded", "results"]) or "awarded" in lowered_url:
        candidate_type = "award_page"
    elif "news" in lowered_title or "press release" in lowered_title or "announce" in lowered_title:
        candidate_type = "news_page"
    elif any(token in lowered_title for token in ["support", "programme", "program", "campaign", "hub", "funding"]) and not deadline_hint:
        candidate_type = "support_page"

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

    if title_hits:
        confidence += min(0.12, 0.04 * title_hits)
        reason_flags.append("strong_title_hint")

    if text_has_any(combined, RIVER_TRUST_TERMS):
        confidence += 0.08
        reason_flags.append("river_trust_term_hit")

    source_bonus, source_bonus_flags = source_priority_bonus(
        source,
        normalised_applicant_types,
        normalised_access_route,
        normalised_scale,
    )
    confidence += source_bonus
    reason_flags.extend(source_bonus_flags)

    if source.get("source_class") == "funding_hub" and discovered_via == "child_link":
        confidence += 0.08
        reason_flags.append("funding_hub_child")

    if source.get("usual_open_months"):
        month = datetime.now(UTC).month
        if month in source.get("usual_open_months", []):
            confidence += 0.10
            reason_flags.append("cycle_window_match")

    if discovered_via == "child_link":
        confidence += 0.10
        reason_flags.append("child_page")

    if looks_generic_title(title):
        confidence -= 0.18
        reason_flags.append("generic_title_penalty")

    if candidate_type == "support_page" and not deadline_hint and phrase_hits < 2:
        confidence -= 0.10
        reason_flags.append("generic_support_page_penalty")

    stale_penalty, stale_flags, hard_reject = stale_year_penalty(
        latest_year=latest_year,
        candidate_type=candidate_type,
        discovered_via=discovered_via,
        has_deadline_hint=bool(deadline_hint),
    )
    confidence -= stale_penalty
    reason_flags.extend(stale_flags)

    if hard_reject:
        return None

    confidence = max(0.0, min(confidence, 0.99))
    if confidence < 0.45:
        return None

    registry_match = find_existing_registry_match(page["url"], registry)

    return Candidate(
        id=slugify(f"cand_{source['id']}_{page['url']}"),
        url=page["url"],
        canonical_family_key=canonical_candidate_family_key(page["url"]),
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
        suggested_purposes=list(source.get("purposes", []))[:8],
        suggested_applicant_types=normalised_applicant_types[:8],
        suggested_access_route=normalised_access_route,
        suggested_scale=normalised_scale,
        reason_flags=dedupe_keep_order(reason_flags),
        deadline_hint=deadline_hint,
        page_hash=page["page_hash"],
        notes="",
        seen_in_latest_run=True,
        already_trusted=bool(registry_match),
        trusted_registry_id=registry_match["id"] if registry_match else None,
    )


def choose_better_candidate(existing: Candidate, candidate: Candidate) -> Candidate:
    existing_is_en = existing.url.lower().endswith("_en")
    candidate_is_en = candidate.url.lower().endswith("_en")

    if candidate_is_en and not existing_is_en:
        return candidate
    if existing_is_en and not candidate_is_en:
        return existing
    if candidate.already_trusted and not existing.already_trusted:
        return candidate
    if existing.already_trusted and not candidate.already_trusted:
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

        old_title = old_copy.get("title", "")
        old_snippet = old_copy.get("snippet", "")
        old_deadline = old_copy.get("deadline_hint", "") or ""
        old_candidate_type = old_copy.get("candidate_type", "call_page")
        old_discovered_via = old_copy.get("discovered_via", "child_link")

        old_latest_year = latest_year_hint(
            old_title,
            old_copy.get("url", ""),
            old_deadline,
            old_snippet,
        )
        _, stale_flags, hard_reject = stale_year_penalty(
            latest_year=old_latest_year,
            candidate_type=old_candidate_type,
            discovered_via=old_discovered_via,
            has_deadline_hint=bool(old_deadline),
        )
        if hard_reject:
            continue

        existing_flags = old_copy.get("reason_flags", [])
        old_copy["reason_flags"] = dedupe_keep_order(existing_flags + stale_flags)
        merged[url] = old_copy

    candidates = sorted(
        merged.values(),
        key=lambda item: (
            0 if item.get("seen_in_latest_run") else 1,
            -float(item.get("confidence", 0)),
            item.get("title", "").lower(),
        ),
    )

    return {"meta": previous_payload.get("meta", {}), "candidates": candidates}


def build_meta(candidates: list[dict[str, Any]], previous_meta: dict[str, Any]) -> dict[str, Any]:
    domains: dict[str, int] = {}
    for candidate in candidates:
        domain = candidate.get("domain")
        if domain:
            domains[domain] = domains.get(domain, 0) + 1

    meta = dict(previous_meta)
    meta["generated_at"] = now_iso()
    meta["generator"] = "grant-radar-discovery 0.8"
    meta["candidate_count"] = len(candidates)
    meta["high_confidence_count"] = sum(float(c.get("confidence", 0)) >= 0.8 for c in candidates)
    meta["pending_review_count"] = sum(c.get("status") == "pending_review" for c in candidates)
    meta["approved_count"] = sum(c.get("status") == "approved" for c in candidates)
    meta["cl_drafted_count"] = sum(c.get("status") == "cl_drafted" for c in candidates)
    meta["promoted_count"] = sum(c.get("status") == "promoted" for c in candidates)
    meta["promotion_requested_count"] = sum(bool(c.get("promotion_requested")) for c in candidates)
    meta["domains_seen"] = dict(sorted(domains.items()))
    return meta


def build_memory_page_record(source: dict[str, Any], page: dict[str, Any], discovered_via: str) -> dict[str, Any]:
    return {
        "url": page["url"],
        "title": page.get("title", ""),
        "page_hash": page.get("page_hash", ""),
        "discovered_via": discovered_via,
        "source_id_hint": source["id"],
        "source_hint": source["name"],
        "checked_at": now_iso(),
    }


def discover_for_source(source: dict[str, Any], registry: list[dict[str, Any]]) -> tuple[list[Candidate], dict[str, Any]]:
    seen_at = now_iso()
    source_memory: dict[str, Any] = {
        "source_id": source["id"],
        "source_name": source["name"],
        "checked_at": seen_at,
        "errors": [],
        "pages_checked": [],
        "watch_urls": [],
    }

    watch_urls = build_watch_urls(source)
    source_memory["watch_urls"] = watch_urls

    candidates_by_family: dict[str, Candidate] = {}
    queued_child_urls: list[str] = []
    queued_seen: set[str] = set()

    for watch_url in watch_urls:
        page, error = fetch_page(watch_url)
        if error:
            source_memory["errors"].append({"url": watch_url, "error": error})
            continue
        if page is None:
            continue

        source_memory["pages_checked"].append(build_memory_page_record(source, page, "source_page"))

        candidate = classify_candidate(page, source, registry, "source_page", seen_at)
        if candidate is not None:
            existing = candidates_by_family.get(candidate.canonical_family_key)
            candidates_by_family[candidate.canonical_family_key] = (
                choose_better_candidate(existing, candidate) if existing else candidate
            )

        for link in page.get("links", []):
            child_url = link["url"]
            if child_url in queued_seen:
                continue
            if not is_same_or_child_domain(child_url, source["trusted_domain"]):
                continue
            if not looks_like_grant_link(child_url, link.get("label", ""), source.get("watch_terms", [])):
                continue
            queued_seen.add(child_url)
            queued_child_urls.append(child_url)

    max_child_links = max_child_links_for_source(source)
    for child_url in queued_child_urls[:max_child_links]:
        page, error = fetch_page(child_url)
        if error:
            source_memory["errors"].append({"url": child_url, "error": error})
            continue
        if page is None:
            continue

        source_memory["pages_checked"].append(build_memory_page_record(source, page, "child_link"))

        candidate = classify_candidate(page, source, registry, "child_link", seen_at)
        if candidate is None:
            continue

        existing = candidates_by_family.get(candidate.canonical_family_key)
        candidates_by_family[candidate.canonical_family_key] = (
            choose_better_candidate(existing, candidate) if existing else candidate
        )

    ordered_candidates = sorted(
        candidates_by_family.values(),
        key=lambda candidate: (-candidate.confidence, candidate.title.lower()),
    )

    return ordered_candidates[: max_candidates_for_source(source)], source_memory


def main() -> None:
    registry = load_json(REGISTRY_PATH, [])
    registry, registry_changed = ensure_registry_defaults(registry)
    if registry_changed:
        save_json(REGISTRY_PATH, registry)

    previous_discovery = load_json(DISCOVERY_PATH, {"meta": {}, "candidates": []})
    previous_memory = load_json(MEMORY_PATH, {"generated_at": None, "sources": []})

    all_candidates: list[Candidate] = []
    memory_sources: list[dict[str, Any]] = []

    for source in registry:
        if not source.get("discovery_enabled", True):
            continue
        discovered, source_memory = discover_for_source(source, registry)
        all_candidates.extend(discovered)
        memory_sources.append(source_memory)

    merged_payload = merge_candidates(previous_discovery, all_candidates, now_iso())
    merged_payload["meta"] = build_meta(merged_payload["candidates"], previous_discovery.get("meta", {}))

    memory_payload = {
        "generated_at": now_iso(),
        "sources": memory_sources,
        "previous_generated_at": previous_memory.get("generated_at"),
    }

    save_json(DISCOVERY_PATH, merged_payload)
    save_json(MEMORY_PATH, memory_payload)

    print(f"Discovered {len(all_candidates)} candidates across {len(memory_sources)} sources.")
    print(json.dumps(merged_payload['meta'], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()