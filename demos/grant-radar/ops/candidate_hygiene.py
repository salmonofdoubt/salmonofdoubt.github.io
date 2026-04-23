import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


LANG_SUFFIX_RE = re.compile(
    r"_(bg|cs|da|de|el|en|es|et|fi|fr|ga|hr|hu|it|lt|lv|mt|nl|pl|pt|ro|sk|sl|sv)$",
    re.IGNORECASE,
)

DROP_QUERY_KEYS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
}

NAV_NOISE_PARTS = {
    "/about",
    "/about-us",
    "/careers",
    "/career",
    "/contact",
    "/contact-us",
    "/login",
    "/search",
    "/publications",
    "/board-members",
    "/our-team",
    "/governance",
    "/policies",
    "/strategy",
}

FUNDING_TERMS = {
    "grant",
    "grants",
    "fund",
    "funding",
    "call",
    "calls",
    "scheme",
    "programme",
    "program",
    "award",
    "awards",
    "scholarship",
    "support",
    "proposal",
    "proposals",
}

DOMAIN_RULES = {
    "cinea.ec.europa.eu": {
        "allow_if_path_contains": [
            "/calls-proposals",
            "/life-calls-proposals",
        ],
        "deny_if_path_contains": [
            "/calls-tenders",
            "/index",
            "/news/",
        ],
    },
    "rea.ec.europa.eu": {
        "allow_if_path_contains": [
            "/funding-and-grants/",
        ],
        "deny_if_path_contains": [
            "/news/",
            "/guidance/",
            "/index",
        ],
    },
    "lawaters.ie": {
        "allow_if_path_contains": [
            "/cwdf",
            "/catchment-support-fund",
            "/small-grants-and-events-scheme",
            "/funding",
        ],
        "deny_if_path_contains": [
            "/contact-us",
            "/login",
            "/our-team",
            "/stories-from-the-waterside",
            "/water-heritage-day",
        ],
    },
    "heritagecouncil.ie": {
        "allow_if_path_contains": [
            "/funding/community-heritage-grant-scheme",
            "/funding/heritage-funding-opportunities",
            "/funding",
        ],
        "deny_if_path_contains": [
            "/search",
            "/about",
            "/publications",
            "/advice-and-guidance",
        ],
    },
    "researchireland.ie": {
        "allow_if_path_contains": [
            "/funding/government-ireland-postgraduate",
            "/funding",
        ],
        "deny_if_path_contains": [
            "/about-us",
            "/board-members",
            "/success-stories",
            "/strategy",
            "/publications",
        ],
    },
    "gsi.ie": {
        "allow_if_path_contains": [
            "/annual-geoheritage-grant-funding",
            "/geoheritage",
        ],
        "deny_if_path_contains": [
            "/education",
            "/research",
            "/past_projects/",
        ],
    },
}

EXACT_ALLOWLIST = {
    "lawaters.ie/cwdf",
    "lawaters.ie/catchment-support-fund",
    "lawaters.ie/small-grants-and-events-scheme",
    "researchireland.ie/funding/government-ireland-postgraduate",
    "gsi.ie/en-ie/programmes-and-projects/geoheritage/projects/pages/annual-geoheritage-grant-funding.aspx",
    "heritagecouncil.ie/funding/community-heritage-grant-scheme-2",
}


def normalize_url(raw_url: str) -> str:
    s = urlsplit(raw_url.strip())
    scheme = s.scheme.lower()
    netloc = s.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]

    path = s.path.rstrip("/") or "/"
    path = LANG_SUFFIX_RE.sub("", path)

    query_pairs = [
        (k, v)
        for k, v in parse_qsl(s.query, keep_blank_values=False)
        if k.lower() not in DROP_QUERY_KEYS
    ]
    query = urlencode(sorted(query_pairs))

    return urlunsplit((scheme, netloc, path, query, ""))


def canonical_family_key(raw_url: str) -> str:
    return normalize_url(raw_url)


def compact_host_path(raw_url: str) -> str:
    s = urlsplit(normalize_url(raw_url))
    return f"{s.netloc}{s.path}".rstrip("/").lower()


def is_obvious_nav_noise(url: str) -> bool:
    u = normalize_url(url).lower()
    return any(part in u for part in NAV_NOISE_PARTS)


def domain_rule_allows(url: str) -> bool:
    s = urlsplit(normalize_url(url))
    host = s.netloc.lower()
    path = s.path.lower()

    exact = compact_host_path(url)
    if exact in EXACT_ALLOWLIST:
        return True

    rules = DOMAIN_RULES.get(host)
    if not rules:
        return True

    deny = rules.get("deny_if_path_contains", [])
    if any(part in path for part in deny):
        return False

    allow = rules.get("allow_if_path_contains", [])
    if allow and not any(part in path for part in allow):
        return False

    return True


def funding_signal_count(url: str, title: str = "", snippet: str = "", source_hint: str = "") -> int:
    haystack = " ".join([url, title, snippet, source_hint]).lower()
    return sum(1 for term in FUNDING_TERMS if term in haystack)


def looks_like_real_candidate(candidate: dict) -> bool:
    url = candidate.get("url", "")
    title = candidate.get("title", "")
    snippet = candidate.get("snippet", "")
    source_hint = candidate.get("source_hint", "")

    if not url:
        return False

    if is_obvious_nav_noise(url):
        return False

    if not domain_rule_allows(url):
        return False

    if funding_signal_count(url, title, snippet, source_hint) < 2:
        return False

    return True


def enrich_candidate(candidate: dict) -> dict | None:
    if not looks_like_real_candidate(candidate):
        return None

    out = dict(candidate)
    out["url"] = normalize_url(out["url"])
    out["canonical_family_key"] = canonical_family_key(out["url"])
    out["domain"] = urlsplit(out["url"]).netloc.lower()
    out["is_locale_variant"] = bool(
        LANG_SUFFIX_RE.search(urlsplit(candidate.get("url", "")).path or "")
    )
    return out


def candidate_rank(candidate: dict) -> tuple:
    status = candidate.get("status", "")
    status_score = {
        "promoted": 5,
        "cl_drafted": 4,
        "pending_review": 3,
        "approved": 2,
    }.get(status, 1)

    title = (candidate.get("title") or "").lower()
    url = candidate.get("url") or ""
    confidence = float(candidate.get("confidence") or 0.0)
    discovered_via = candidate.get("discovered_via") or ""

    english_bonus = 1 if url.endswith("_en") or title.endswith(" english") else 0
    source_page_bonus = 1 if discovered_via == "source_page" else 0

    return (
        status_score,
        english_bonus,
        source_page_bonus,
        confidence,
        -len(url),
    )


def dedupe_candidates(candidates: list[dict]) -> list[dict]:
    best_by_family: dict[str, dict] = {}

    for cand in candidates:
        enriched = enrich_candidate(cand)
        if not enriched:
            continue

        family = enriched["canonical_family_key"]
        incumbent = best_by_family.get(family)

        if incumbent is None or candidate_rank(enriched) > candidate_rank(incumbent):
            best_by_family[family] = enriched

    return list(best_by_family.values())


def review_queue(candidates: list[dict]) -> list[dict]:
    cleaned = dedupe_candidates(candidates)

    queue = []
    for cand in cleaned:
        status = cand.get("status")
        already_trusted = bool(cand.get("already_trusted", False))

        if status in {"pending_review", "cl_drafted"} and not already_trusted:
            queue.append(cand)

    queue.sort(
        key=lambda c: (
            float(c.get("confidence") or 0.0),
            c.get("last_seen") or "",
        ),
        reverse=True,
    )
    return queue
