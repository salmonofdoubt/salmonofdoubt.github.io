#!/usr/bin/env python3
"""Grant Radar discovery engine.

Scans trusted funding hubs, classifies funding-looking links, suppresses stale/generic/noisy items,
preserves manual review states, and writes discovery-candidates.json plus discovery-audit.json.
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
SEEDS_PATH = DATA_DIR / "discovery-seeds.json"
CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
AUDIT_PATH = DATA_DIR / "discovery-audit.json"
MEMORY_PATH = DATA_DIR / "source-memory.json"

USER_AGENT = "GrantRadarDiscoveryBot/2.0 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
TIMEOUT = (12, 35)
MAX_LINKS_PER_SEED = 80
MAX_FETCHES = 300
CURRENT_YEAR = datetime.now(UTC).year

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IE,en;q=0.9",
}

FUNDING_TERMS = [
    "funding", "fund", "funds", "grant", "grants", "scheme", "schemes",
    "call", "calls", "programme", "program", "opportunity", "opportunities",
    "support", "application", "apply", "proposal", "proposals", "deadline",
    "scholarship", "fellowship", "expression of interest", "eoi"
]

ACTION_TERMS = [
    "apply now", "how to apply", "who can apply", "applications open",
    "application form", "eligible applicants", "eligibility criteria",
    "call for proposals", "call for applications", "deadline", "closing date",
    "applications close", "submit a proposal", "funding available"
]

NOISE_TERMS = [
    "press release", "minister announces", "minister announced",
    "results announced", "successful projects", "projects awarded",
    "awarded funding", "awardees", "tender", "tenders", "procurement",
    "case study", "newsletter"
]

THEMATIC_RELEVANCE_TERMS = [
    "water", "water quality", "catchment", "river", "wetland", "riparian",
    "biodiversity", "habitat", "ecosystem", "ecology", "nature",
    "nature-based", "nature based", "climate", "sustainability",
    "environment", "environmental", "conservation", "peatland", "soil",
    "public engagement", "citizen science", "community", "education",
    "stem engagement", "outreach"
]

GENERIC_TITLES = {
    "funding", "funding opportunities", "grants", "grant funding",
    "research", "about", "about us", "contact", "contact us",
    "news", "publications", "events", "our services", "services"
}

DENY_PATHS = [
    r"/contact/?$", r"/contact-us/?$", r"/about/?$", r"/about-us/?$",
    r"/privacy/?$", r"/cookies?/?$", r"/terms/?$", r"/login/?$",
    r"/search/?$", r"/news/?$", r"/events/?$", r"/careers/?$",
    r"/jobs/?$", r"/publications/?$"
]

BINARY_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".rar", ".7z", ".csv"
}

DEFAULT_SEEDS = [
    {
        "id": "research_ireland_funding_hub",
        "name": "Research Ireland funding hub",
        "url": "https://www.researchireland.ie/funding/",
        "trusted_domain": "researchireland.ie",
        "purposes": ["environmental research", "education", "climate action", "biodiversity", "public engagement"],
        "watch_terms": ["discover", "public engagement", "research", "climate", "sustainability", "funding", "grant", "programme"]
    },
    {
        "id": "lawpro_funding_hub",
        "name": "LAWPRO funding hub",
        "url": "https://lawaters.ie/funding/",
        "trusted_domain": "lawaters.ie",
        "purposes": ["water quality", "catchment delivery", "community nature", "citizen science", "restoration"],
        "watch_terms": ["water", "catchment", "community", "grant", "funding", "development fund", "small grants"]
    },
    {
        "id": "heritage_council_funding_hub",
        "name": "Heritage Council funding hub",
        "url": "https://www.heritagecouncil.ie/funding/",
        "trusted_domain": "heritagecouncil.ie",
        "purposes": ["heritage", "biodiversity", "community nature", "education", "surveys"],
        "watch_terms": ["heritage", "biodiversity", "community", "grant", "scheme", "funding"]
    },
    {
        "id": "epa_research_funding_hub",
        "name": "EPA research funding hub",
        "url": "https://www.epa.ie/our-services/research/epa--research-funding/",
        "trusted_domain": "epa.ie",
        "purposes": ["environmental research", "water quality", "climate action", "biodiversity"],
        "watch_terms": ["research call", "funding", "grant", "environment", "climate", "water", "biodiversity"]
    },
    {
        "id": "ifi_funding_hub",
        "name": "Inland Fisheries Ireland funding hub",
        "url": "https://www.fisheriesireland.ie/our-services/funding",
        "trusted_domain": "fisheriesireland.ie",
        "purposes": ["water quality", "habitat restoration", "riparian management", "fisheries", "catchment delivery"],
        "watch_terms": ["funding", "habitat", "conservation", "river", "riparian", "grant"]
    },
    {
        "id": "seai_grants_hub",
        "name": "SEAI grants hub",
        "url": "https://www.seai.ie/grants/",
        "trusted_domain": "seai.ie",
        "purposes": ["community energy", "energy efficiency", "climate action", "decarbonisation"],
        "watch_terms": ["grant", "grants", "funding", "community", "energy", "research"]
    },
    {
        "id": "life_calls_watch",
        "name": "EU LIFE calls watch",
        "url": "https://cinea.ec.europa.eu/programmes/life/life-calls-proposals_en",
        "trusted_domain": "cinea.ec.europa.eu",
        "purposes": ["biodiversity", "climate adaptation", "nature-based solutions", "wetlands"],
        "watch_terms": ["call", "proposal", "funding", "life", "nature", "biodiversity", "climate"]
    }
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
    query = [
        (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
    ]
    clean = parsed._replace(
        scheme=(parsed.scheme or "https").lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
        query=urlencode(query, doseq=True),
    )
    out = urlunparse(clean)
    if out.endswith("/") and clean.path not in ("", "/"):
        out = out[:-1]
    return out


def family_key(url: str) -> str:
    parsed = urlparse(canonical_url(url))
    return urlunparse(parsed._replace(query="", fragment="", path=parsed.path.rstrip("/")))


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def title_core(title: str) -> str:
    title = re.sub(r"\s+", " ", title or "").strip()
    return re.split(r"\s+[|–-]\s+", title, maxsplit=1)[0].strip()


def normalise_title(title: str) -> str:
    value = title_core(title).lower()
    value = re.sub(r"\b20\d{2}\b", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def same_or_child_domain(url: str, domain: str) -> bool:
    got = canonical_domain(url)
    expected = (domain or got).lower().replace("www.", "")
    return got == expected or got.endswith("." + expected)


def has_binary_extension(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in BINARY_EXTENSIONS)


def denied_path(url: str) -> bool:
    path = urlparse(url).path.lower().rstrip("/")
    return any(re.search(pattern, path) for pattern in DENY_PATHS)


def contains_any(text: str, terms: list[str]) -> bool:
    hay = text.lower()
    return any(term.lower() in hay for term in terms)


def hit_count(text: str, terms: list[str]) -> int:
    hay = text.lower()
    return sum(1 for term in terms if term.lower() in hay)


def extract_years(*parts: str) -> list[int]:
    years = set()
    for part in parts:
        for match in re.findall(r"\b(20\d{2})\b", part or ""):
            year = int(match)
            if 2000 <= year <= 2100:
                years.add(year)
    return sorted(years)


def latest_year(*parts: str) -> int | None:
    years = extract_years(*parts)
    return max(years) if years else None


def deadline_hint(text: str) -> str | None:
    patterns = [
        r"(deadline[^.\n\r]{0,180})",
        r"(closing date[^.\n\r]{0,180})",
        r"(applications? close[^.\n\r]{0,180})",
        r"(submit(?:ted)? by[^.\n\r]{0,180})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text or "", flags=re.I)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip(" .")
    return None


def fetch_page(url: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        return None, str(exc)

    final_url = canonical_url(response.url or url)
    raw = response.content or b""
    page_hash = "sha256:" + hashlib.sha256(raw).hexdigest()
    ctype = (response.headers.get("Content-Type") or "").lower()

    if has_binary_extension(final_url) or "application/pdf" in ctype or raw.startswith(b"%PDF-"):
        stem = Path(urlparse(final_url).path).stem or "Document"
        return {
            "url": final_url,
            "title": re.sub(r"[-_]+", " ", stem).strip(),
            "text": "",
            "snippet": "Document or binary file detected.",
            "links": [],
            "page_hash": page_hash,
            "is_binary": True,
        }, None

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = ""
    if soup.title and soup.title.string:
        title = re.sub(r"\s+", " ", soup.title.string).strip()

    lines = []
    for raw_line in soup.get_text("\n", strip=True).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        low = line.lower()
        if any(x in low for x in ["cookie policy", "accept all cookies", "skip to main content", "accessibility statement"]):
            continue
        lines.append(line)

    text = "\n".join(lines)
    snippet = re.sub(r"\s+", " ", text[:900]).strip()

    links = []
    for anchor in soup.find_all("a", href=True):
        href = canonical_url(urljoin(final_url, anchor["href"]))
        label = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True)).strip()
        if href.startswith("http"):
            links.append({"url": href, "label": label})

    return {
        "url": final_url,
        "title": title or title_core(urlparse(final_url).path.replace("/", " ")),
        "text": text,
        "snippet": snippet,
        "links": links,
        "page_hash": page_hash,
        "is_binary": False,
    }, None


def registry_index(registry: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index = {}
    for item in registry:
        url = item.get("url", "")
        if url:
            index[canonical_url(url)] = item
            index[family_key(url)] = item
        for name in [
            item.get("name", ""),
            (item.get("extract") or {}).get("title", ""),
            (item.get("extract") or {}).get("programme", ""),
        ]:
            norm = normalise_title(name)
            if norm:
                index[f"title:{norm}"] = item
    return index


def existing_match(page: dict[str, Any], index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    for key in [canonical_url(page["url"]), family_key(page["url"]), f"title:{normalise_title(page.get('title', ''))}"]:
        if key in index:
            item = index[key]
            return {"id": item.get("id"), "name": item.get("name"), "kind": key.split(":")[0]}
    return None


def link_score(url: str, label: str, seed: dict[str, Any]) -> float:
    hay = f"{url} {label}".lower()
    score = 0.0
    score += hit_count(hay, FUNDING_TERMS)
    score += 0.6 * hit_count(hay, [str(x) for x in seed.get("watch_terms", [])])
    if any(x in url.lower() for x in ["/funding/", "/grant", "/grants", "/call", "/programme", "/program"]):
        score += 2.0
    return score


def classify_type(page: dict[str, Any]) -> str:
    if page.get("is_binary"):
        return "document_file"

    title = title_core(page.get("title", ""))
    norm = normalise_title(title)
    path = urlparse(page.get("url", "")).path.lower()
    hay = f"{title} {path} {page.get('snippet', '')}".lower()

    if norm in GENERIC_TITLES or path.rstrip("/") in {"/funding", "/grants", "/our-services/funding"}:
        return "generic_funding_hub"
    if "tender" in hay or "procurement" in hay:
        return "tender"
    if any(x in hay for x in ["results announced", "successful projects", "projects awarded", "awarded funding", "awardees"]):
        return "award_result"
    if "press release" in hay or "minister announces" in hay or "announces new funding" in hay:
        return "press_release"
    if any(x in hay for x in ["scholarship", "fellowship", "phd", "postgraduate"]):
        return "scholarship"
    if "rolling" in hay or "always open" in hay:
        return "rolling_support"
    if "programme" in hay or "program" in hay or "scheme" in hay:
        return "recurring_programme"
    return "funding_call"


def infer_mode_relevance(candidate_type: str, seed: dict[str, Any]) -> dict[str, str]:
    purposes = {str(p).lower() for p in seed.get("purposes", [])}
    if candidate_type == "scholarship":
        return {"ndrt": "exclude", "research": "include", "farmer": "exclude"}
    out = {"ndrt": "maybe", "research": "maybe", "farmer": "exclude"}
    if purposes & {"water quality", "catchment delivery", "citizen science", "community nature", "restoration", "heritage"}:
        out["ndrt"] = "include"
    if purposes & {"environmental research", "research training", "biodiversity"}:
        out["research"] = "include"
    if purposes & {"farmers", "farm sustainability", "farm payments", "farm nutrient management"}:
        out["farmer"] = "include"
    return out


def classify_candidate(page: dict[str, Any], seed: dict[str, Any], index: dict[str, dict[str, Any]], previous: dict[str, Any], seen_at: str) -> dict[str, Any]:
    title = title_core(page.get("title") or seed.get("name", "Untitled"))
    url = page["url"]
    text = page.get("text", "")
    snippet = page.get("snippet", "")
    ctype = classify_type(page)
    dline = deadline_hint(text)
    year = latest_year(title, url, snippet, dline or "")
    existing = existing_match(page, index)

    hay = f"{title} {url} {snippet} {text[:3500]}".lower()
    seed_required_terms = [str(x).lower() for x in seed.get("require_any_terms_for_review", [])]
    seed_required_hit = True if not seed_required_terms else contains_any(hay, seed_required_terms)
    seed_suppressed_types = set(seed.get("suppress_candidate_types", []))
    thematic_hit = contains_any(hay, THEMATIC_RELEVANCE_TERMS)
    confidence = 0.20
    if contains_any(f"{title} {url}", FUNDING_TERMS):
        confidence += 0.25
    if contains_any(hay, ACTION_TERMS):
        confidence += 0.25
    if dline:
        confidence += 0.10
    if ctype in {"funding_call", "recurring_programme", "rolling_support", "scholarship"}:
        confidence += 0.10
    if contains_any(hay, NOISE_TERMS):
        confidence -= 0.25
    if ctype in {"generic_funding_hub", "press_release", "award_result", "tender", "document_file"}:
        confidence -= 0.30
    confidence = round(max(0.0, min(0.99, confidence)), 3)

    status = "suppressed_non_actionable"
    public_state = "discovery_only"
    reasons = []

    if existing:
        status = "suppressed_existing"
        reasons.append(f"Already covered by trusted source {existing.get('id')}")
    elif ctype in seed_suppressed_types:
        status = "suppressed_non_actionable"
        reasons.append(f"Candidate type {ctype} is suppressed for this discovery seed.")
    elif not seed_required_hit:
        status = "suppressed_non_actionable"
        reasons.append("Suppressed by seed-level thematic gate: candidate lacks required relevance terms for this funding hub.")
    elif ctype == "generic_funding_hub":
        status = "suppressed_generic_page"
        reasons.append("Generic funding hub, not a distinct opportunity.")
    elif ctype in {"document_file", "press_release", "award_result", "tender"}:
        status = "suppressed_non_actionable"
        reasons.append(f"{ctype.replace('_', ' ')} detected.")
    elif ctype == "scholarship" and not thematic_hit:
        status = "suppressed_non_actionable"
        reasons.append("Generic scholarship route without clear water, biodiversity, climate, sustainability, public-engagement, or community relevance.")
    elif ctype == "scholarship" and confidence < 0.70:
        status = "suppressed_non_actionable"
        reasons.append("Scholarship route has some thematic relevance but weak application or deadline signal.")
    elif year and year < CURRENT_YEAR - 1:
        status = "suppressed_stale"
        reasons.append(f"Appears stale for {year}.")
    elif year and year < CURRENT_YEAR and ctype == "funding_call":
        status = "suppressed_stale"
        reasons.append(f"One-off call appears stale for {year}.")
    elif confidence >= 0.55:
        status = "pending_review"
        public_state = "review_only"
        reasons.append("Funding-looking candidate on trusted hub, not already registered.")
    else:
        reasons.append("Insufficient application/funding signal.")

    cid = f"cand_{slugify(seed['id'])}_{slugify(urlparse(url).netloc + urlparse(url).path)}"
    prev = previous.get(cid) or previous.get(family_key(url)) or {}

    if prev.get("status") in {"promoted", "rejected"}:
        status = prev["status"]
        reasons.append(f"Manual state preserved: {status}.")

    return {
        "id": cid,
        "url": url,
        "canonical_family_key": family_key(url),
        "domain": canonical_domain(url),
        "title": title,
        "snippet": snippet,
        "first_seen": prev.get("first_seen") or seen_at,
        "last_seen": seen_at,
        "seen_in_latest_run": True,
        "detected_from": seed.get("id"),
        "discovered_via": seed.get("name"),
        "source_hint": seed.get("name"),
        "source_id_hint": seed.get("id"),
        "candidate_type": ctype,
        "confidence": confidence,
        "promotion_signal": "green" if status == "pending_review" and confidence >= 0.70 else ("amber" if status == "pending_review" else "red"),
        "public_visible_state": public_state,
        "promotion_reasons": reasons,
        "status": status,
        "suggested_purposes": seed.get("purposes", []),
        "suggested_applicant_types": [],
        "suggested_access_route": "direct",
        "suggested_scale": "medium",
        "mode_relevance": infer_mode_relevance(ctype, seed),
        "deadline_hint": dline,
        "latest_year_hint": year,
        "page_hash": page.get("page_hash"),
        "already_trusted": bool(existing),
        "trusted_registry_id": existing.get("id") if existing else None,
        "notes": prev.get("notes", ""),
    }


def build_seed_list(registry: list[dict[str, Any]], configured: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only explicit discovery seeds.

    Important: do not auto-turn curated registry opportunities into crawler seeds.
    Programme pages such as Walsh Scholars or Research Ireland Discover can contain
    internal pages, funded-project pages, alumni pages, and resources. Those are not
    new grant routes.
    """
    seeds = configured or DEFAULT_SEEDS[:]

    deduped = {}
    for seed in seeds:
        if seed.get("url"):
            deduped[canonical_url(seed["url"])] = seed

    return list(deduped.values())


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    seen_at = now_iso()
    registry = load_json(REGISTRY_PATH, [])
    configured_seeds = load_json(SEEDS_PATH, DEFAULT_SEEDS)
    previous_candidates = load_json(CANDIDATES_PATH, [])
    previous_memory = load_json(MEMORY_PATH, {})

    previous = {}
    if isinstance(previous_memory, dict):
        previous.update(previous_memory)
    for item in previous_candidates:
        if isinstance(item, dict):
            previous[item.get("id", "")] = item
            previous[item.get("canonical_family_key", "")] = item

    index = registry_index(registry)
    seeds = build_seed_list(registry, configured_seeds)

    counters = Counter()
    audit_seeds = []
    candidates_by_family = {}
    fetches = 0

    for seed in seeds:
        seed_url = canonical_url(seed["url"])
        counters["seed_pages_attempted"] += 1
        page, error = fetch_page(seed_url)

        seed_report = {
            "id": seed.get("id"),
            "name": seed.get("name"),
            "url": seed_url,
            "status": "ok" if page else "fetch_error",
            "fetch_error": error,
            "links_seen": 0,
            "funding_like_links": 0,
            "candidates_fetched": 0,
        }

        if not page:
            counters["seed_pages_failed"] += 1
            audit_seeds.append(seed_report)
            continue

        raw_links = page.get("links", [])
        seed_report["links_seen"] = len(raw_links)
        counters["links_seen"] += len(raw_links)

        kept = []
        for link in raw_links:
            url = canonical_url(link["url"])
            label = link.get("label", "")
            if not same_or_child_domain(url, seed.get("trusted_domain") or canonical_domain(seed_url)):
                continue
            if denied_path(url) or has_binary_extension(url):
                continue
            score = link_score(url, label, seed)
            if score >= 2.0:
                kept.append({"url": url, "label": label, "score": score})

        kept = sorted(
            {family_key(item["url"]): item for item in kept}.values(),
            key=lambda x: x["score"],
            reverse=True,
        )[:MAX_LINKS_PER_SEED]

        seed_report["funding_like_links"] = len(kept)
        counters["funding_like_links"] += len(kept)

        for link in kept:
            if fetches >= MAX_FETCHES:
                counters["candidate_fetch_limit_reached"] += 1
                break

            fetches += 1
            seed_report["candidates_fetched"] += 1

            cand_page, cand_error = fetch_page(link["url"])
            if cand_page:
                candidate = classify_candidate(cand_page, seed, index, previous, seen_at)
            else:
                cid = f"cand_{slugify(seed['id'])}_{slugify(urlparse(link['url']).netloc + urlparse(link['url']).path)}"
                candidate = {
                    "id": cid,
                    "url": link["url"],
                    "canonical_family_key": family_key(link["url"]),
                    "domain": canonical_domain(link["url"]),
                    "title": link.get("label") or link["url"],
                    "snippet": "",
                    "first_seen": seen_at,
                    "last_seen": seen_at,
                    "seen_in_latest_run": True,
                    "detected_from": seed.get("id"),
                    "discovered_via": seed.get("name"),
                    "candidate_type": "unknown",
                    "confidence": 0.0,
                    "promotion_signal": "red",
                    "public_visible_state": "discovery_only",
                    "promotion_reasons": [f"Candidate fetch failed: {cand_error}"],
                    "status": "suppressed_fetch_error",
                    "suggested_purposes": seed.get("purposes", []),
                    "mode_relevance": {"ndrt": "maybe", "research": "maybe", "farmer": "exclude"},
                    "already_trusted": False,
                    "trusted_registry_id": None,
                    "fetch_error": cand_error,
                }

            key = candidate["canonical_family_key"]
            old = candidates_by_family.get(key)
            if not old or (candidate.get("status") == "pending_review", candidate.get("confidence", 0)) > (old.get("status") == "pending_review", old.get("confidence", 0)):
                candidates_by_family[key] = candidate

        audit_seeds.append(seed_report)

    # Preserve manual decisions not seen this run.
    # Do not preserve old pending-review noise after discovery rules improve.
    for item in previous_candidates:
        if not isinstance(item, dict):
            continue
        if item.get("status") in {"promoted", "rejected"}:
            key = item.get("canonical_family_key") or item.get("id")
            if key and key not in candidates_by_family:
                retained = dict(item)
                retained["seen_in_latest_run"] = False
                candidates_by_family[key] = retained

    candidates = list(candidates_by_family.values())
    candidates.sort(key=lambda c: (
        0 if c.get("status") == "pending_review" else 1,
        -float(c.get("confidence", 0)),
        str(c.get("title", "")).lower(),
    ))

    status_counts = Counter(c.get("status", "unknown") for c in candidates)
    type_counts = Counter(c.get("candidate_type", "unknown") for c in candidates)

    audit = {
        "generated_at": seen_at,
        "engine": "hub-discovery-2.0",
        "seed_count": len(seeds),
        "seed_pages_attempted": counters["seed_pages_attempted"],
        "seed_pages_failed": counters["seed_pages_failed"],
        "links_seen": counters["links_seen"],
        "funding_like_links": counters["funding_like_links"],
        "candidate_fetches": fetches,
        "pending_review_count": status_counts.get("pending_review", 0),
        "status_counts": dict(status_counts),
        "candidate_type_counts": dict(type_counts),
        "seeds": audit_seeds,
    }

    memory = {
        c["canonical_family_key"]: {
            "id": c.get("id"),
            "title": c.get("title"),
            "url": c.get("url"),
            "status": c.get("status"),
            "first_seen": c.get("first_seen"),
            "last_seen": c.get("last_seen"),
            "page_hash": c.get("page_hash"),
        }
        for c in candidates
        if c.get("canonical_family_key")
    }

    save_json(CANDIDATES_PATH, candidates)
    save_json(AUDIT_PATH, audit)
    save_json(MEMORY_PATH, memory)

    print(f"Wrote {CANDIDATES_PATH}")
    print(f"Wrote {AUDIT_PATH}")
    print(json.dumps({
        "seed_count": audit["seed_count"],
        "funding_like_links": audit["funding_like_links"],
        "pending_review": audit["pending_review_count"],
        "status_counts": audit["status_counts"],
        "candidate_type_counts": audit["candidate_type_counts"],
        "seed_pages_failed": audit["seed_pages_failed"],
    }, indent=2))


if __name__ == "__main__":
    main()
