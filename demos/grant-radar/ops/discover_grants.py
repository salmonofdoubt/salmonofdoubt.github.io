#!/usr/bin/env python3
"""Grant Radar discovery with separate promotion signal.

This script keeps discovery confidence for relevance, but also writes a
promotion signal that is much stricter:

- green: genuinely promotable / actionable
- amber: plausible, but incomplete or needs careful review
- red: discovery only, not a good public-visible grant candidate

It also suppresses stale and clearly non-actionable pages more aggressively.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
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

USER_AGENT = "GrantRadarDiscoverBot/0.9 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
TIMEOUT = (10, 30)

MAX_WATCH_URLS_PER_SOURCE = 8
MAX_CHILD_LINKS_PER_SOURCE = 18
MAX_CANDIDATES_PER_SOURCE = 14

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

DISCOVERY_PHRASES = [
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
]

NEGATIVE_PROMOTION_PHRASES = [
    "deadline has passed",
    "deadline for these calls has now passed",
    "successful projects",
    "projects awarded",
    "awarded funding",
    "awarded projects",
    "press release",
    "minister announces",
    "minister announced",
    "announce over €",
    "announces over €",
    "announces new funding",
    "launches €",
    "launches a €",
    "results announced",
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
    promotion_signal: str
    public_visible_state: str
    promotion_reasons: list[str]
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
            "promotion_signal": self.promotion_signal,
            "public_visible_state": self.public_visible_state,
            "promotion_reasons": self.promotion_reasons,
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


def page_title_core(title: str) -> str:
    core = re.split(r"\s+[|\-–]\s+", title, maxsplit=1)[0]
    return re.sub(r"\s+", " ", core).strip()


def looks_generic_title(title: str) -> bool:
    return page_title_core(title).lower() in GENERIC_TITLE_PATTERNS


def text_has_any(text: str, phrases: list[str]) -> bool:
    lowered = text.lower()
    return any(phrase.lower() in lowered for phrase in phrases)


def count_phrase_hits(text: str, phrases: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for phrase in phrases if phrase.lower() in lowered)


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
    if has("business", "enterprise", "founder", "micro-enterprise", "sme"):
        simplified.append("businesses")
    if has("ngo", "non-governmental", "conservation group", "environmental ngo", "heritage ngo"):
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
            "allow_pdf_candidates": False,
        }
        for key, value in defaults.items():
            if key not in source:
                source[key] = value
                changed = True

        watch_terms = list(source.get("watch_terms", []))
        watch_terms += list(source.get("purposes", []))
        watch_terms += [source.get("name", "")]
        watch_terms += COMMON_WATCH_TERMS
        source["watch_terms"] = dedupe_keep_order(watch_terms)

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

        year_match = re.search(r"\b(20\d{2})\b", final_url)
        if year_match and year_match.group(1) not in title:
            title = f"{title} {year_match.group(1)}"

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


def is_denied_child_url(url: str) -> bool:
    path = urlparse(url).path.lower().rstrip("/")
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


def max_child_links_for_source(source: dict[str, Any]) -> int:
    if source.get("source_class") == "funding_hub":
        return 28
    return MAX_CHILD_LINKS_PER_SOURCE


def max_candidates_for_source(source: dict[str, Any]) -> int:
    if source.get("source_class") == "funding_hub":
        return 20
    return MAX_CANDIDATES_PER_SOURCE


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


def candidate_type_from_page(title: str, url: str, deadline_hint: str | None) -> str:
    lowered_title = page_title_core(title).lower()
    lowered_url = url.lower()

    if any(token in lowered_title for token in ["award", "awarded", "results"]) or "awarded" in lowered_url:
        return "award_page"
    if "press release" in lowered_title or "announce" in lowered_title or "announces" in lowered_title:
        return "news_page"
    if "news" in lowered_title:
        return "news_page"
    if any(token in lowered_title for token in ["support", "programme", "program", "campaign", "hub", "funding"]) and not deadline_hint:
        return "support_page"
    return "call_page"


def stale_penalty_or_reject(
    latest_year: int | None,
    candidate_type: str,
    discovered_via: str,
    has_deadline_hint: bool,
) -> tuple[float, list[str], bool]:
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
        penalty += 0.35
        flags.append("stale_deadline_year")
    if candidate_type == "call_page" and age >= 1:
        penalty += 0.18
        flags.append("stale_call_year")
    if discovered_via == "child_link" and age >= 1:
        penalty += 0.08
        flags.append("stale_child_page")

    return penalty, flags, False


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
        score += 0.06
        flags.append("practical_route")

    if source_class in {"funding_hub", "programme_page", "implementation_programme"} and purposes.intersection(PRACTICAL_PURPOSES):
        score += 0.04
        flags.append("river_trust_source_class")

    if scale in PRACTICAL_SCALES:
        score += 0.05
        flags.append("practical_scale")

    if access_route in PRACTICAL_ACCESS_ROUTES:
        score += 0.05
        flags.append("practical_access")

    if any(value in COMMUNITY_APPLICANT_TYPES for value in applicant_types):
        score += 0.06
        flags.append("community_applicant_fit")

    if text_has_any(" ".join(source.get("watch_terms", [])), RIVER_TRUST_TERMS):
        score += 0.04
        flags.append("river_trust_terms")

    return score, flags


def compute_promotion_signal(
    *,
    candidate_type: str,
    confidence: float,
    combined_text: str,
    title: str,
    deadline_hint: str | None,
    applicant_types: list[str],
    access_route: str | None,
    scale: str | None,
    practical_fit: bool,
) -> tuple[str, str, list[str]]:
    reasons: list[str] = []

    has_negative = text_has_any(combined_text, NEGATIVE_PROMOTION_PHRASES)
    has_actionable = text_has_any(combined_text, ACTIONABLE_PHRASES)
    has_strong_title = text_has_any(f"{page_title_core(title).lower()} {title.lower()}", STRONG_TITLE_HINT_TERMS)
    generic = looks_generic_title(title)

    completeness = 0
    if applicant_types:
        completeness += 1
    if access_route:
        completeness += 1
    if scale:
        completeness += 1

    if has_negative:
        reasons.append("contains results, announcement, or passed-deadline language")
        return "red", "discovery_only", reasons

    if candidate_type == "award_page":
        reasons.append("award/results page rather than live funding route")
        return "red", "discovery_only", reasons

    if candidate_type == "news_page":
        reasons.append("news or ministerial announcement page")
        return "red", "discovery_only", reasons

    if generic and not has_actionable:
        reasons.append("generic page without clear application route")
        return "red", "discovery_only", reasons

    if deadline_hint:
        reasons.append("deadline language detected")
    if applicant_types:
        reasons.append("applicant type present")
    if access_route:
        reasons.append("access route present")
    if scale:
        reasons.append("scale present")
    if has_actionable:
        reasons.append("clear application or call language")
    if practical_fit:
        reasons.append("good fit for community or river-trust use")

    if (
        candidate_type == "call_page"
        and has_actionable
        and completeness == 3
        and confidence >= 0.58
        and not generic
    ):
        return "green", "public_visible", reasons

    if (
        candidate_type == "support_page"
        and (has_actionable or has_strong_title)
        and completeness == 3
        and confidence >= 0.55
    ):
        return "green", "public_visible", reasons

    if (
        has_actionable
        and completeness >= 2
        and confidence >= 0.50
    ):
        return "amber", "review_only", reasons

    if (
        candidate_type == "support_page"
        and practical_fit
        and completeness >= 1
        and confidence >= 0.48
    ):
        return "amber", "review_only", reasons

    reasons.append("not strong enough for public promotion")
    return "red", "discovery_only", reasons


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
    combined = f"{title}\n{snippet}\n{text[:5000]}".lower()
    trusted_domain = source["trusted_domain"]
    extract = source.get("extract", {})

    if page.get("is_pdf") and not source.get("allow_pdf_candidates", False):
        return None

    phrase_hits = count_phrase_hits(combined, DISCOVERY_PHRASES)
    watch_hits = count_phrase_hits(combined, source.get("watch_terms", []))
    title_hits = count_phrase_hits(f"{page_title_core(title).lower()} {page['url'].lower()}", STRONG_TITLE_HINT_TERMS)
    deadline_hint = detect_deadline_hint(text)

    raw_applicant_types = extract.get("applicant_types", [])
    applicant_types = normalise_applicant_types(raw_applicant_types)
    access_route = normalise_access_route(extract.get("access_route"))
    scale = normalise_scale(extract.get("scale"))

    candidate_type = candidate_type_from_page(title, page["url"], deadline_hint)

    confidence = 0.0
    reason_flags: list[str] = []

    if is_same_or_child_domain(page["url"], trusted_domain):
        confidence += 0.22
        reason_flags.append("trusted_domain")

    if phrase_hits:
        confidence += min(0.20, 0.06 * phrase_hits)
        reason_flags.append("funding_or_support_phrase")

    if text_has_any(combined, ACTIONABLE_PHRASES):
        confidence += 0.12
        reason_flags.append("application_route_language")

    if deadline_hint:
        confidence += 0.08
        reason_flags.append("deadline_detected")

    if watch_hits:
        confidence += min(0.12, 0.02 * watch_hits)
        reason_flags.append("watch_term_overlap")

    if title_hits:
        confidence += min(0.10, 0.04 * title_hits)
        reason_flags.append("strong_title_hint")

    if text_has_any(combined, RIVER_TRUST_TERMS):
        confidence += 0.07
        reason_flags.append("river_trust_term_hit")

    source_bonus, source_bonus_flags = source_priority_bonus(source, applicant_types, access_route, scale)
    confidence += source_bonus
    reason_flags.extend(source_bonus_flags)

    if source.get("source_class") == "funding_hub" and discovered_via == "child_link":
        confidence += 0.07
        reason_flags.append("funding_hub_child")

    if source.get("usual_open_months"):
        month = datetime.now(UTC).month
        if month in source.get("usual_open_months", []):
            confidence += 0.08
            reason_flags.append("cycle_window_match")

    if discovered_via == "child_link":
        confidence += 0.06
        reason_flags.append("child_page")

    if looks_generic_title(title):
        confidence -= 0.18
        reason_flags.append("generic_title_penalty")

    if candidate_type in {"news_page", "award_page"}:
        confidence -= 0.12
        reason_flags.append("time_bound_page_penalty")

    if text_has_any(combined, NEGATIVE_PROMOTION_PHRASES):
        confidence -= 0.22
        reason_flags.append("negative_promotion_language")

    latest_year = latest_year_hint(title, page["url"], deadline_hint or "", snippet, text[:2500])
    stale_penalty, stale_flags, hard_reject = stale_penalty_or_reject(
        latest_year=latest_year,
        candidate_type=candidate_type,
        discovered_via=discovered_via,
        has_deadline_hint=bool(deadline_hint),
    )
    confidence -= stale_penalty
    reason_flags.extend(stale_flags)

    if hard_reject:
        return None

    confidence = max(0.0, min(confidence, 0.95))
    if confidence < 0.42:
        return None

    practical_fit = bool(set(source.get("purposes", [])).intersection(PRACTICAL_PURPOSES))
    promotion_signal, public_visible_state, promotion_reasons = compute_promotion_signal(
        candidate_type=candidate_type,
        confidence=confidence,
        combined_text=combined,
        title=title,
        deadline_hint=deadline_hint,
        applicant_types=applicant_types,
        access_route=access_route,
        scale=scale,
        practical_fit=practical_fit,
    )

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
        promotion_signal=promotion_signal,
        public_visible_state=public_visible_state,
        promotion_reasons=dedupe_keep_order(promotion_reasons),
        status="pending_review",
        suggested_purposes=list(source.get("purposes", []))[:8],
        suggested_applicant_types=applicant_types[:8],
        suggested_access_route=access_route,
        suggested_scale=scale,
        reason_flags=dedupe_keep_order(reason_flags),
        deadline_hint=deadline_hint,
        page_hash=page["page_hash"],
        notes="",
        seen_in_latest_run=True,
        already_trusted=bool(registry_match),
        trusted_registry_id=registry_match["id"] if registry_match else None,
    )


def choose_better_candidate(existing: Candidate, candidate: Candidate) -> Candidate:
    signal_rank = {"green": 3, "amber": 2, "red": 1}
    existing_signal = signal_rank.get(existing.promotion_signal, 0)
    candidate_signal = signal_rank.get(candidate.promotion_signal, 0)

    if candidate_signal > existing_signal:
        return candidate
    if existing_signal > candidate_signal:
        return existing

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
    if existing.confidence > candidate.confidence:
        return existing

    if len(candidate.url) < len(existing.url):
        return candidate

    return existing


def should_keep_previous_candidate(item: dict[str, Any]) -> bool:
    status = item.get("status", "pending_review")
    if item.get("promotion_requested") or status in {"approved", "cl_drafted", "promoted", "rejected"}:
        return True

    combined = f"{item.get('title', '')}\n{item.get('snippet', '')}\n{item.get('deadline_hint', '')}".lower()
    if text_has_any(combined, NEGATIVE_PROMOTION_PHRASES):
        return False

    latest_year = latest_year_hint(
        item.get("title", ""),
        item.get("url", ""),
        item.get("deadline_hint", "") or "",
        item.get("snippet", ""),
    )
    _, _, hard_reject = stale_penalty_or_reject(
        latest_year=latest_year,
        candidate_type=item.get("candidate_type", "call_page"),
        discovered_via=item.get("discovered_via", "child_link"),
        has_deadline_hint=bool(item.get("deadline_hint")),
    )
    return not hard_reject


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
        if not should_keep_previous_candidate(old):
            continue
        old_copy = dict(old)
        old_copy["seen_in_latest_run"] = False
        old_copy["last_seen"] = old.get("last_seen", seen_at)
        merged[url] = old_copy

    return {"meta": previous_payload.get("meta", {}), "candidates": list(merged.values())}


def build_meta(candidates: list[dict[str, Any]], generated_at: str) -> dict[str, Any]:
    domains = Counter(c.get("domain") for c in candidates if c.get("domain"))
    return {
        "generated_at": generated_at,
        "generator": "grant-radar-discovery 0.9",
        "candidate_count": len(candidates),
        "high_confidence_count": sum(float(c.get("confidence", 0)) >= 0.8 for c in candidates),
        "pending_review_count": sum(c.get("status") == "pending_review" for c in candidates),
        "approved_count": sum(c.get("status") == "approved" for c in candidates),
        "cl_drafted_count": sum(c.get("status") == "cl_drafted" for c in candidates),
        "promoted_count": sum(c.get("status") == "promoted" for c in candidates),
        "promotion_requested_count": sum(bool(c.get("promotion_requested")) for c in candidates),
        "green_count": sum(c.get("promotion_signal") == "green" for c in candidates),
        "amber_count": sum(c.get("promotion_signal") == "amber" for c in candidates),
        "red_count": sum(c.get("promotion_signal") == "red" for c in candidates),
        "domains_seen": dict(sorted(domains.items())),
    }


def discover_from_source(
    source: dict[str, Any],
    registry: list[dict[str, Any]],
    memory: dict[str, Any],
    seen_at: str,
) -> list[Candidate]:
    if not source.get("discovery_enabled", True):
        return []

    pages_memory = memory.setdefault("pages", {})
    errors_memory = memory.setdefault("errors", {})
    child_limit = max_child_links_for_source(source)
    candidate_limit = max_candidates_for_source(source)

    watch_urls = build_watch_urls(source)
    collected: dict[str, Candidate] = {}
    child_urls: list[str] = []

    for watch_url in watch_urls:
        page, error = fetch_page(watch_url)
        if error:
            errors_memory[watch_url] = {"error": error, "last_seen": seen_at}
            continue

        pages_memory[watch_url] = {
            "title": page["title"],
            "page_hash": page["page_hash"],
            "last_seen": seen_at,
        }

        candidate = classify_candidate(
            page=page,
            source=source,
            registry=registry,
            discovered_via="source_page",
            seen_at=seen_at,
        )
        if candidate is not None:
            existing = collected.get(candidate.canonical_family_key)
            collected[candidate.canonical_family_key] = candidate if existing is None else choose_better_candidate(existing, candidate)

        for link in page["links"]:
            if not is_same_or_child_domain(link["url"], source["trusted_domain"]):
                continue
            if looks_like_grant_link(link["url"], link["label"], source.get("watch_terms", [])):
                child_urls.append(link["url"])

    child_urls = dedupe_keep_order(child_urls)[:child_limit]

    for child_url in child_urls:
        page, error = fetch_page(child_url)
        if error:
            errors_memory[child_url] = {"error": error, "last_seen": seen_at}
            continue

        pages_memory[child_url] = {
            "title": page["title"],
            "page_hash": page["page_hash"],
            "last_seen": seen_at,
        }

        candidate = classify_candidate(
            page=page,
            source=source,
            registry=registry,
            discovered_via="child_link",
            seen_at=seen_at,
        )
        if candidate is None:
            continue

        existing = collected.get(candidate.canonical_family_key)
        collected[candidate.canonical_family_key] = candidate if existing is None else choose_better_candidate(existing, candidate)

    ordered_candidates = sorted(
        collected.values(),
        key=lambda item: (
            {"green": 0, "amber": 1, "red": 2}.get(item.promotion_signal, 3),
            -item.confidence,
            item.title.lower(),
        ),
    )
    return ordered_candidates[:candidate_limit]


def main() -> None:
    generated_at = now_iso()

    registry = load_json(REGISTRY_PATH, [])
    registry, registry_changed = ensure_registry_defaults(registry)
    if registry_changed:
        save_json(REGISTRY_PATH, registry)

    previous_payload = load_json(DISCOVERY_PATH, {"meta": {}, "candidates": []})
    memory = load_json(MEMORY_PATH, {"pages": {}, "errors": {}})

    discovered: list[Candidate] = []
    for source in registry:
        discovered.extend(discover_from_source(source, registry, memory, generated_at))

    by_family: dict[str, Candidate] = {}
    for candidate in discovered:
        existing = by_family.get(candidate.canonical_family_key)
        by_family[candidate.canonical_family_key] = candidate if existing is None else choose_better_candidate(existing, candidate)

    final_candidates = sorted(
        (candidate.as_dict() for candidate in by_family.values()),
        key=lambda item: (
            {"green": 0, "amber": 1, "red": 2}.get(item.get("promotion_signal", "red"), 3),
            -float(item.get("confidence", 0)),
            (item.get("title") or "").lower(),
        ),
    )

    merged_payload = merge_candidates(
        previous_payload=previous_payload,
        newly_found=[Candidate(**candidate) for candidate in final_candidates],
        seen_at=generated_at,
    )
    merged_payload["meta"] = build_meta(merged_payload["candidates"], generated_at)

    save_json(DISCOVERY_PATH, merged_payload)
    save_json(MEMORY_PATH, memory)

    print(f"Wrote {DISCOVERY_PATH}")
    print(json.dumps(merged_payload["meta"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()