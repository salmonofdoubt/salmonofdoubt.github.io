#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

ROOT = Path("demos/urbanforest/news")
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"
REGISTRY = DATA / "source-registry.json"
LATEST = DATA / "news.json"
INDEX = ARCHIVE / "index.json"
CURATED = DATA / "curated-items.json"

OPENALEX_WORKS = "https://api.openalex.org/works"

MAX_ITEMS = 90
MIN_SCORE = 26
CURRENT_WINDOW_DAYS = 365

HEADERS = {
    "User-Agent": "UrbanForestNbSRadar/1.0 (+https://salmonofdoubt.github.io/demos/urbanforest/news/)"
}


SECTION_ALIASES = {
    "ireland-practice": "ireland-urban-forest-practice",
    "temperate-practice": "transferable-urbanforest-practice",
    "urban-nbs-implementation": "transferable-urbanforest-practice",
    "research-evidence": "research-evidence",
    "funding-policy": "funding-opportunities",
    "maintenance": "design-maintenance-risk",
}

def normalise_section(value: str | None) -> str:
    if not value:
        return "ireland-urban-forest-practice"
    return SECTION_ALIASES.get(value, value)


CANONICAL_SECTIONS = [
    {
        "id": "ireland-urban-forest-practice",
        "title": "Ireland UrbanForest Practice",
        "description": "Irish urban forest, pocket forest, school forest, campus greening, community planting, local authority action, and implementation signals."
    },
    {
        "id": "transferable-urbanforest-practice",
        "title": "Transferable UrbanForest Practice",
        "description": "Comparable temperate-city examples where tiny forests, pocket forests, tree canopy, soil, shade, or forest-linked design lessons support UrbanForest delivery."
    },
    {
        "id": "funding-opportunities",
        "title": "Funding and Opportunities",
        "description": "Grants, schemes, calls, and support routes for planting, monitoring, maintenance, schools, communities, campuses, and biodiversity."
    },
    {
        "id": "research-evidence",
        "title": "Practical Research and Evidence",
        "description": "Evidence for urban forest biodiversity, wellbeing, shade, heat mitigation, soil, stormwater value, survival, maintenance, monitoring, and governance."
    },
    {
        "id": "design-maintenance-risk",
        "title": "Design, Maintenance and Risk",
        "description": "Tree survival, watering, drought stress, soil preparation, aftercare, vandalism, public acceptance, carbon claims, governance risk, and long-term stewardship."
    }
]


SECTIONS = [
    "ireland-urban-forest-practice",
    "transferable-urbanforest-practice",
    "funding-opportunities",
    "research-evidence",
    "design-maintenance-risk",
]

TRUE_GRANT_TERMS = [
    "grant", "grants", "funding", "fund", "funds", "scheme", "call for proposals",
    "applications open", "application deadline", "deadline", "eligible", "eligibility",
    "award", "awards", "programme", "program", "open call", "small grants",
    "biodiversity fund", "community fund", "heritage council", "life calls"
]

CORE_PATTERNS = [
    r"\burban forest\b", r"\bpocket forest\b", r"\btiny forest\b", r"\bmicro forest\b",
    r"\bmini forest\b", r"\bmiyawaki\b", r"\bcampus forest\b", r"\bschool forest\b",
    r"\bcommunity forest\b", r"\burban woodland\b", r"\burban greening\b",
    r"\burban tree\b", r"\bstreet tree\b", r"\btree canopy\b", r"\bnative planting\b",
    r"\bnature-based\b", r"\bnature based\b", r"\burban nbs\b", r"\brain garden\b",
    r"\bbioswale\b", r"\bsuds\b", r"\bgreen roof\b", r"\bdepaving\b",
    r"\bpermeable surface\b", r"\bsoil restoration\b"
]

BAD_TERMS = [
    "amazon rainforest", "forest fire", "wildfire", "logging", "deforestation",
    "stock market", "football", "film", "celebrity", "crypto", "gaming"
]

THEME_RULES = {
    "urban-heat-shade": ["urban heat", "heatwave", "cooling", "shade", "tree canopy", "heat island"],
    "biodiversity-habitat": ["biodiversity", "pollinator", "habitat", "species", "ecology", "native", "birds", "invertebrate"],
    "soil-health": ["soil", "soil restoration", "compaction", "mulch", "mycorrhiza", "organic matter"],
    "stormwater-suds": ["stormwater", "rain garden", "bioswale", "suds", "sustainable drainage", "permeable", "runoff"],
    "wellbeing": ["wellbeing", "mental health", "health", "children", "learning", "education"],
    "school-education": ["school", "students", "children", "education", "learning", "campus"],
    "community-stewardship": ["community", "volunteer", "stewardship", "participation", "citizen science"],
    "tree-survival-maintenance": ["maintenance", "survival", "watering", "aftercare", "drought", "replacement"],
    "funding-grants": TRUE_GRANT_TERMS,
    "planning-policy": ["policy", "strategy", "planning", "local authority", "council", "development plan"],
    "monitoring-evaluation": ["monitoring", "evaluation", "baseline", "indicator", "survey", "measurement"],
    "carbon-claims": ["carbon", "offset", "sequestration", "net zero", "greenwashing"],
    "risk-vandalism-safety": ["vandalism", "safety", "risk", "insurance", "allergy", "anti-social"]
}

LOCAL_TERMS = {
    "trinity": 32, "tcd": 32, "trinity college dublin": 36,
    "dublin": 26, "dublin city council": 30, "fingal": 22,
    "south dublin": 20, "dún laoghaire": 20, "dlr": 18,
    "ireland": 18, "irish": 16, "campus": 10, "school": 8
}

COMPARABLE_TERMS = {
    "uk": 9, "united kingdom": 9, "england": 8, "scotland": 8, "wales": 8,
    "netherlands": 9, "belgium": 8, "germany": 8, "france": 7, "denmark": 8,
    "europe": 7, "european": 7, "temperate": 8, "northwest europe": 10,
    "north-west europe": 10, "atlantic": 6
}

PRACTICAL_TERMS = {
    "implementation": 10, "maintenance": 12, "aftercare": 12, "watering": 12,
    "survival": 12, "monitoring": 10, "biodiversity": 10, "wellbeing": 8,
    "community": 8, "school": 8, "campus": 8, "native": 8, "planting": 6,
    "soil": 8, "mulch": 6, "case study": 10, "evidence": 8, "research": 6,
    "funding": 8, "grant": 8, "shade": 8, "cooling": 8, "stormwater": 9,
    "rain garden": 10, "bioswale": 10, "suds": 10, "green roof": 7,
    "depaving": 8, "urban heat": 10, "tree canopy": 9, "stewardship": 8
}

OPENALEX_QUERIES = [
    ("urban forest biodiversity wellbeing maintenance survival", "biodiversity-habitat", ["research", "urban-forest", "biodiversity"]),
    ("Miyawaki forest urban biodiversity monitoring survival", "tree-survival-maintenance", ["research", "miyawaki", "monitoring"]),
    ("tiny forest urban biodiversity citizen science monitoring", "monitoring-evaluation", ["research", "tiny-forest", "citizen-science"]),
    ("urban trees heat mitigation shade wellbeing", "urban-heat-shade", ["research", "urban-heat", "shade"]),
    ("urban nature-based solutions stormwater rain garden bioswale SuDS", "stormwater-suds", ["research", "urban-nbs", "suds"]),
    ("urban tree survival watering maintenance soil compaction", "tree-survival-maintenance", ["research", "maintenance", "survival"])
]


@dataclass
class RawItem:
    title: str
    url: str
    summary: str
    published: str | None
    source: dict[str, Any]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def clean_text(value: Any, limit: int = 900) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()


def canonical_url(url: str) -> str:
    parsed = urlparse(url or "")
    return parsed._replace(fragment="", query=parsed.query).geturl()


def item_id(url: str, title: str) -> str:
    key = canonical_url(url) or title
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    try:
        return date_parser.parse(str(value)).date().isoformat()
    except Exception:
        return None


def age_days(iso_date: str | None) -> int | None:
    if not iso_date:
        return None
    try:
        return (now_utc().date() - date_parser.parse(iso_date).date()).days
    except Exception:
        return None


def text_for(item: dict[str, Any] | RawItem) -> str:
    if isinstance(item, RawItem):
        return f"{item.title} {item.summary}".lower()
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    benefits = item.get("benefit_categories") if isinstance(item.get("benefit_categories"), list) else []
    return " ".join([
        str(item.get("title", "")), str(item.get("summary", "")), str(item.get("theme", "")),
        str(item.get("section", "")), " ".join(tags), " ".join(benefits)
    ]).lower()


def has_true_grant_signal(text: str) -> bool:
    return any(term in text for term in TRUE_GRANT_TERMS)


def matches_core(text: str) -> bool:
    lowered = text.lower()
    if any(term in lowered for term in BAD_TERMS):
        return False
    if any(re.search(pattern, lowered) for pattern in CORE_PATTERNS):
        return True
    if "tree" in lowered and any(term in lowered for term in ["urban", "school", "campus", "community", "street", "shade", "biodiversity"]):
        return True
    if "forest" in lowered and any(term in lowered for term in ["urban", "school", "campus", "community", "native", "biodiversity"]):
        return True
    return False


def infer_theme(text: str) -> str:
    lowered = text.lower()
    best = "urban-forest"
    best_score = 0
    for theme, terms in THEME_RULES.items():
        score = sum(1 for term in terms if term in lowered)
        if score > best_score:
            best = theme
            best_score = score
    return best


def benefit_categories(text: str) -> list[str]:
    lowered = text.lower()
    out = []
    labels = {
        "Urban heat / shade": ["urban heat", "heat island", "shade", "cooling", "tree canopy"],
        "Biodiversity / habitat": ["biodiversity", "habitat", "pollinator", "species", "native", "ecology"],
        "Soil health": ["soil", "compaction", "mulch", "mycorrhiza", "organic matter"],
        "Stormwater / SuDS": ["stormwater", "rain garden", "bioswale", "suds", "runoff", "permeable"],
        "Wellbeing / health": ["wellbeing", "mental health", "health", "children", "learning"],
        "School / education": ["school", "students", "education", "campus", "learning"],
        "Community stewardship": ["community", "volunteer", "stewardship", "citizen science"],
        "Tree survival / maintenance": ["maintenance", "aftercare", "watering", "survival", "drought"],
        "Funding / grants": TRUE_GRANT_TERMS,
        "Planning / policy": ["policy", "strategy", "planning", "council", "local authority"],
        "Monitoring / evaluation": ["monitoring", "evaluation", "baseline", "indicator", "survey"],
        "Carbon / climate claims": ["carbon", "offset", "sequestration", "net zero", "greenwashing"],
        "Risk / safety": ["vandalism", "safety", "risk", "allergy", "insurance"]
    }
    for label, terms in labels.items():
        if any(term in lowered for term in terms):
            out.append(label)
    return out[:6] or ["Urban forest / NbS"]


def locality(text: str) -> dict[str, Any]:
    score = 0
    matched = []
    for term, points in LOCAL_TERMS.items():
        if term in text:
            score += points
            matched.append(term)
    if score >= 50:
        label = "High Dublin / Ireland relevance"
    elif score >= 24:
        label = "Strong Ireland relevance"
    elif score >= 12:
        label = "Moderate Ireland relevance"
    else:
        label = "Transferable relevance"
    return {"score": min(100, score), "label": label, "matched_terms": sorted(set(matched))[:8]}


def comparable_label(text: str) -> str:
    if any(term in text for term in LOCAL_TERMS):
        return "Ireland / Dublin first"
    if any(term in text for term in COMPARABLE_TERMS):
        return "Comparable temperate city"
    return "General transferable evidence"


def infer_section(source_section: str, text: str, source_scope: str = "") -> str:
    lowered = text.lower()
    source_section = normalise_section(source_section)

    # Hard routing first.
    if matches_funding_gateway(lowered):
        return "funding-opportunities"

    if "research" in source_scope or "openalex" in source_scope:
        return "research-evidence"

    if matches_design_risk_gateway(lowered):
        return "design-maintenance-risk"

    # Respect explicit registry lane. This prevents transferable practice sources
    # being swallowed by the Ireland lane merely because an item mentions Ireland.
    if source_section in {
        "ireland-urban-forest-practice",
        "transferable-urbanforest-practice",
        "funding-opportunities",
        "research-evidence",
        "design-maintenance-risk",
    }:
        return source_section

    # Only infer Ireland when no reliable source lane exists.
    if strong_local_ireland_signal(lowered):
        return "ireland-urban-forest-practice"

    return "transferable-urbanforest-practice"



def grant_fit(text: str) -> dict[str, Any] | None:
    if not has_true_grant_signal(text):
        return None
    score = 35
    if "community" in text:
        score += 16
    if "school" in text or "education" in text:
        score += 12
    if "biodiversity" in text or "nature" in text:
        score += 14
    if "maintenance" in text or "monitoring" in text:
        score += 10
    if "ireland" in text or "irish" in text or "dublin" in text:
        score += 10
    score = min(100, score)
    fit = "High" if score >= 75 else "Medium" if score >= 55 else "Low"
    return {
        "fit": fit,
        "score": score,
        "eligible_hint": "Check fit for schools, community groups, universities, local authorities, NGOs, biodiversity projects, monitoring, or maintenance.",
        "action_needed": "Check deadline, lead applicant, match funding, eligible costs, and whether maintenance or monitoring can be funded."
    }


def urbanforest_relevance(item: dict[str, Any], benefits: list[str], loc: dict[str, Any], opportunity: dict[str, Any] | None) -> str:
    b = ", ".join(benefits[:3])
    section = item.get("section", "")
    if opportunity:
        return f"Opportunity signal: may help fund {b.lower()}, school/community planting, monitoring, maintenance, or UrbanForest delivery."
    if "Tree survival / maintenance" in benefits:
        return "Maintenance signal: useful because urban forests succeed or fail through watering, aftercare, replacement planting, soil care, and stewardship after launch."
    if "Stormwater / SuDS" in benefits:
        return "Urban NbS signal: useful for connecting small forests and tree planting to runoff, SuDS, soil, and stormwater design rather than treating planting as decoration."
    if "Urban heat / shade" in benefits:
        return "Climate-adaptation signal: useful for explaining shade, cooling, heat exposure, and tree-canopy value in practical urban design."
    if "Carbon / climate claims" in benefits:
        return "Risk signal: useful for avoiding weak carbon claims and keeping the UrbanForest argument grounded in survival, biodiversity, cooling, wellbeing, and stewardship."
    if section == "research-evidence":
        return f"Evidence signal: useful for supporting design, monitoring, communication, or funding claims around {b.lower()}."
    if loc.get("score", 0) >= 24:
        return "Local practice signal: useful because it connects to Dublin, Ireland, campuses, schools, or local-authority implementation contexts."
    return f"Practical signal: potentially useful for designing, funding, planting, maintaining, monitoring, or explaining UrbanForest work around {b.lower()}."


def research_use_type(text: str) -> str | None:
    if "review" in text or "meta-analysis" in text or "systematic review" in text:
        return "Review / evidence synthesis"
    if "monitoring" in text or "citizen science" in text or "indicator" in text:
        return "Monitoring method"
    if "maintenance" in text or "survival" in text or "watering" in text:
        return "Survival / maintenance evidence"
    if "heat" in text or "shade" in text or "cooling" in text:
        return "Heat / shade evidence"
    if "biodiversity" in text or "habitat" in text:
        return "Biodiversity evidence"
    if "wellbeing" in text or "mental health" in text:
        return "Wellbeing evidence"
    if "stormwater" in text or "suds" in text or "rain garden" in text:
        return "UrbanForest stormwater evidence"
    return None




FUNDING_CONTEXT_TERMS = [
    "biodiversity", "nature", "tree", "trees", "woodland", "forest", "urban greening",
    "community", "school", "campus", "garden", "pollinator", "climate", "environment",
    "green infrastructure", "local authority", "heritage", "education", "monitoring"
]

DESIGN_RISK_CONTEXT_TERMS = [
    "tree", "trees", "street tree", "urban tree", "tree canopy", "urban forest",
    "tiny forest", "pocket forest", "miyawaki", "urban greening", "woodland",
    "planting", "native planting", "school forest", "campus"
]

DESIGN_RISK_TERMS = [
    "maintenance", "aftercare", "watering", "watered", "drought", "survival",
    "tree survival", "replacement", "vandalism", "soil", "soil compaction",
    "mulch", "establishment", "young trees", "heat stress", "failure",
    "dead trees", "tree pit", "root", "roots", "irrigation"
]

def matches_funding_gateway(text: str) -> bool:
    lowered = text.lower()
    return has_true_grant_signal(lowered) and any(term in lowered for term in FUNDING_CONTEXT_TERMS)

def matches_design_risk_gateway(text: str) -> bool:
    lowered = text.lower()
    return (
        any(term in lowered for term in DESIGN_RISK_TERMS)
        and any(term in lowered for term in DESIGN_RISK_CONTEXT_TERMS)
    )

def matches_urbanforest_scope(text: str) -> bool:
    lowered = text.lower()
    return matches_core(lowered) or matches_funding_gateway(lowered) or matches_design_risk_gateway(lowered)


def score_raw(raw: RawItem) -> tuple[int, str, str, list[str]]:
    text = text_for(raw)

    if not matches_urbanforest_scope(text):
        return 0, "reference", "No strong UrbanForest, funding, or design-risk signal detected.", []

    score = 24

    if matches_core(text):
        for pattern in CORE_PATTERNS:
            if re.search(pattern, text):
                score += 9

    for term, points in PRACTICAL_TERMS.items():
        if term in text:
            score += points

    if matches_funding_gateway(text):
        score += 22

    if matches_design_risk_gateway(text):
        score += 22

    trust = float(raw.source.get("trust", 0.65))
    score += int(trust * 10)

    scope = raw.source.get("scope", "")
    if "ireland" in scope or "dublin" in scope:
        score += 12
    elif "temperate" in scope or "practice" in scope:
        score += 7
    elif "funding" in scope:
        score += 8
    elif "maintenance" in scope or "risk" in scope:
        score += 8

    days = age_days(raw.published)
    if days is None:
        freshness_status = "reference"
        freshness_label = "Date unknown"
        score -= 3
    elif days <= CURRENT_WINDOW_DAYS:
        freshness_status = "fresh"
        freshness_label = f"{days} days old"
        score += 5
    else:
        freshness_status = "reference"
        freshness_label = f"{days} days old · background"
        score -= min(16, int(days / 90) * 3)

    return max(0, min(100, score)), freshness_status, freshness_label, benefit_categories(text)


def fetch_rss(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()
    feed = feedparser.parse(response.content)
    items = []
    for entry in feed.entries[:35]:
        title = clean_text(entry.get("title"), 260)
        url = entry.get("link") or ""
        summary = clean_text(entry.get("summary") or entry.get("description"), 850)
        published = parse_date(entry.get("published") or entry.get("updated"))
        if title and url:
            items.append(RawItem(title, url, summary, published, source))
    return items


def fetch_page(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    items = []
    for link in soup.select("a[href]")[:220]:
        title = clean_text(link.get_text(" "), 260)
        href = link.get("href")
        if not title or not href or len(title) < 16:
            continue
        url = urljoin(source["url"], href)
        if not url.startswith("http"):
            continue
        surrounding = clean_text(link.parent.get_text(" ") if link.parent else title, 900)
        published = None
        date_match = re.search(r"\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})\b", surrounding)
        if date_match:
            published = parse_date(date_match.group(1))
        items.append(RawItem(title, url, surrounding, published, source))
    return items


def abstract_from_inverted_index(index: dict[str, list[int]] | None) -> str:
    if not isinstance(index, dict) or not index:
        return ""
    positions = []
    for word, places in index.items():
        if isinstance(places, list):
            for pos in places:
                if isinstance(pos, int):
                    positions.append((pos, word))
    return " ".join(word for _, word in sorted(positions))[:1100]


def source_name(work: dict[str, Any]) -> str:
    primary = work.get("primary_location") or {}
    if isinstance(primary, dict):
        source = primary.get("source") or {}
        if isinstance(source, dict) and source.get("display_name"):
            return source["display_name"]

    for location in work.get("locations") or []:
        location = location or {}
        if not isinstance(location, dict):
            continue
        source = location.get("source") or {}
        if isinstance(source, dict) and source.get("display_name"):
            return source["display_name"]

    return "OpenAlex"


def best_work_url(work: dict[str, Any]) -> str:
    if work.get("doi"):
        return str(work["doi"])

    best = work.get("best_oa_location") or {}
    if isinstance(best, dict):
        if best.get("landing_page_url"):
            return best["landing_page_url"]
        if best.get("pdf_url"):
            return best["pdf_url"]

    primary = work.get("primary_location") or {}
    if isinstance(primary, dict):
        if primary.get("landing_page_url"):
            return primary["landing_page_url"]
        if primary.get("pdf_url"):
            return primary["pdf_url"]

    for location in work.get("locations") or []:
        location = location or {}
        if not isinstance(location, dict):
            continue
        if location.get("landing_page_url"):
            return location["landing_page_url"]
        if location.get("pdf_url"):
            return location["pdf_url"]

    return work.get("id") or ""


def fetch_openalex() -> list[dict[str, Any]]:
    items = []
    for search, theme, tags in OPENALEX_QUERIES:
        params = {
            "search": search,
            "filter": "from_publication_date:2015-01-01,is_retracted:false",
            "per-page": "25"
        }
        try:
            response = requests.get(OPENALEX_WORKS, params=params, headers=HEADERS, timeout=35)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            print(f"OpenAlex failed: {search} :: {exc}")
            continue
        for work in payload.get("results", []):
            title = clean_text(work.get("display_name"), 320)
            url = best_work_url(work)
            if not title or not url:
                continue
            abstract = abstract_from_inverted_index(work.get("abstract_inverted_index"))
            summary = abstract or "Open the source to inspect abstract, DOI, journal, and publication metadata."
            text = f"{title} {summary}".lower()
            if not matches_urbanforest_scope(text):
                continue
            year = work.get("publication_year")
            cited = int(work.get("cited_by_count") or 0)
            score = 38 + min(18, int(math.log10(cited + 1) * 9))
            for term, points in PRACTICAL_TERMS.items():
                if term in text:
                    score += points
            if (work.get("open_access") or {}).get("is_oa"):
                score += 5
            if "review" in str(work.get("type", "")).lower() or "review" in text:
                score += 8
            if any(term in text for term in ["ireland", "dublin", "trinity"]):
                score += 12
            elif any(term in text for term in COMPARABLE_TERMS):
                score += 7
            b = benefit_categories(text)
            item = {
                "id": item_id(url, title),
                "title": title,
                "url": canonical_url(url),
                "summary": clean_text(summary, 950),
                "published": work.get("publication_date") or (f"{year}-01-01" if year else None),
                "source_id": "openalex",
                "source_name": source_name(work),
                "publisher": source_name(work),
                "section": "research-evidence",
                "theme": theme,
                "tags": list(dict.fromkeys(tags + ["research"] + (["open-access"] if (work.get("open_access") or {}).get("is_oa") else [])))[:9],
                "score": max(0, min(100, score)),
                "freshness_status": "reference",
                "freshness_label": f"{year or 'Year unknown'} · {cited} citations" + (" · open access" if (work.get("open_access") or {}).get("is_oa") else ""),
                "cited_by_count": cited,
                "openalex_id": work.get("id"),
                "doi": work.get("doi")
            }
            item = annotate_item(item)
            if item["score"] >= 42:
                items.append(item)
    return items


def load_curated_items() -> list[dict[str, Any]]:
    if not CURATED.exists():
        return []
    try:
        payload = json.loads(CURATED.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Curated item file failed: {exc}")
        return []
    out = []
    for item in payload.get("items", []):
        if not item.get("title") or not item.get("url"):
            continue
        base = {
            "id": item.get("id") or item_id(item["url"], item["title"]),
            "title": clean_text(item.get("title"), 260),
            "url": canonical_url(item.get("url", "")),
            "summary": clean_text(item.get("summary"), 900),
            "published": item.get("published"),
            "source_id": item.get("source_id", "curated"),
            "source_name": item.get("source_name", "Curated reference"),
            "publisher": item.get("publisher", item.get("source_name", "Curated reference")),
            "section": normalise_section(item.get("section", "research-evidence")),
            "theme": item.get("theme", "urban-forest"),
            "tags": item.get("tags", ["curated"]),
            "score": int(item.get("score", 90)),
            "freshness_status": item.get("freshness_status", "reference"),
            "freshness_label": item.get("freshness_label", "Curated reference")
        }
        out.append(annotate_item(base))
    return out


def annotate_item(item: dict[str, Any]) -> dict[str, Any]:
    text = text_for(item)
    benefits = benefit_categories(text)
    loc = locality(text)
    comp = comparable_label(text)
    opportunity = grant_fit(text)
    use_type = research_use_type(text)
    item["benefit_categories"] = benefits
    item["local_relevance"] = loc
    item["transfer_relevance"] = comp
    item["urbanforest_relevance"] = urbanforest_relevance(item, benefits, loc, opportunity)
    if opportunity:
        item["opportunity_fit"] = opportunity
    if use_type:
        item["research_use_type"] = use_type
    if loc["score"] >= 50:
        item["score"] = min(100, int(item.get("score", 0)) + 10)
    elif loc["score"] >= 24:
        item["score"] = min(100, int(item.get("score", 0)) + 5)
    return item




def baseline_watch_raw_item(source: dict[str, Any]) -> RawItem | None:
    section = normalise_section(source.get("section"))

    if section == "funding-opportunities":
        summary = (
            "Baseline UrbanForest funding watch source. Check this source for grants, funding, schemes, "
            "calls, deadlines, eligibility, community biodiversity, school greening, tree planting, "
            "monitoring, maintenance, education, and practical support routes. This card does not claim "
            "that a grant is currently open; it keeps a relevant funding source visible for review."
        )
        return RawItem(
            title=f"Funding watch: {source.get('name', 'source')}",
            url=source.get("url", ""),
            summary=summary,
            published=None,
            source=source,
        )

    if section == "design-maintenance-risk":
        summary = (
            "Baseline UrbanForest design and maintenance watch source. Check this source for tree survival, "
            "watering, drought stress, aftercare, replacement planting, soil care, vandalism, establishment "
            "risk, young-tree failure, weak carbon claims, and long-term stewardship issues."
        )
        return RawItem(
            title=f"Design and maintenance watch: {source.get('name', 'source')}",
            url=source.get("url", ""),
            summary=summary,
            published=None,
            source=source,
        )

    return None


def discover_source_items() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    sections = CANONICAL_SECTIONS
    seen = set()
    results = []

    for source in registry.get("sources", []):
        source_section = normalise_section(source.get("section"))
        passed_for_source = 0

        try:
            raw_items = fetch_rss(source) if source.get("type") == "rss" else fetch_page(source)
        except Exception as exc:
            print(f"Source failed: {source.get('id')} :: {exc}")
            raw_items = []

        for raw in raw_items:
            uid = item_id(raw.url, raw.title)
            if uid in seen:
                continue

            score, freshness_status, freshness_label, tags = score_raw(raw)
            if score < MIN_SCORE:
                continue

            seen.add(uid)
            passed_for_source += 1

            text = text_for(raw)
            theme = infer_theme(text)
            section = normalise_section(infer_section(raw.source.get("section", "transferable-urbanforest-practice"), text, raw.source.get("scope", "")))

            item = {
                "id": uid,
                "title": raw.title,
                "url": canonical_url(raw.url),
                "summary": raw.summary,
                "published": raw.published,
                "source_id": raw.source.get("id"),
                "source_name": raw.source.get("name"),
                "publisher": raw.source.get("name"),
                "section": section,
                "theme": theme,
                "tags": list(dict.fromkeys(tags + [theme]))[:8],
                "score": score,
                "freshness_status": freshness_status,
                "freshness_label": freshness_label
            }
            results.append(annotate_item(item))

        # Operational lanes should not vanish just because today's feed is quiet.
        if source_section in {"funding-opportunities", "design-maintenance-risk"} and passed_for_source == 0:
            baseline = baseline_watch_raw_item(source)
            if baseline:
                uid = item_id(baseline.url, baseline.title)
                if uid not in seen:
                    seen.add(uid)

                    score, freshness_status, freshness_label, tags = score_raw(baseline)
                    text = text_for(baseline)
                    theme = infer_theme(text)

                    item = {
                        "id": uid,
                        "title": baseline.title,
                        "url": canonical_url(baseline.url),
                        "summary": baseline.summary,
                        "published": baseline.published,
                        "source_id": baseline.source.get("id"),
                        "source_name": baseline.source.get("name"),
                        "publisher": baseline.source.get("name"),
                        "section": source_section,
                        "theme": theme,
                        "tags": list(dict.fromkeys(tags + [theme, "watch-source"]))[:9],
                        "score": max(score, 60 if source_section == "funding-opportunities" else 56),
                        "freshness_status": "reference",
                        "freshness_label": "Watch source"
                    }
                    results.append(annotate_item(item))

    return results, sections



def make_operational_baseline_item(section: str, source_id: str, source_name: str, url: str, title: str, summary: str, score: int) -> dict[str, Any]:
    item = {
        "id": item_id(url, title),
        "title": title,
        "url": canonical_url(url),
        "summary": clean_text(summary, 900),
        "published": None,
        "source_id": source_id,
        "source_name": source_name,
        "publisher": source_name,
        "section": section,
        "theme": "funding-grants" if section == "funding-opportunities" else "tree-survival-maintenance",
        "tags": ["watch-source", "operational-baseline", "funding-grants" if section == "funding-opportunities" else "tree-survival-maintenance"],
        "score": score,
        "freshness_status": "reference",
        "freshness_label": "Operational watch source",
    }

    return annotate_item(item)


def ensure_operational_baseline_lanes(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    existing_sections = {normalise_section(item.get("section")) for item in items}

    baselines: list[dict[str, Any]] = []

    if "funding-opportunities" not in existing_sections:
        baselines.extend([
            make_operational_baseline_item(
                section="funding-opportunities",
                source_id="baseline-heritage-council-funding",
                source_name="Heritage Council Funding",
                url="https://www.heritagecouncil.ie/funding",
                title="Funding watch: Heritage Council funding",
                summary=(
                    "Baseline UrbanForest funding watch source. Check for grants that may support "
                    "community biodiversity, school greening, local heritage, tree planting, education, "
                    "monitoring, maintenance, and practical urban forest delivery. This card keeps the "
                    "funding lane operational; it does not claim a specific grant is open today."
                ),
                score=66,
            ),
            make_operational_baseline_item(
                section="funding-opportunities",
                source_id="baseline-community-foundation-ireland",
                source_name="Community Foundation Ireland",
                url="https://www.communityfoundation.ie/grants/",
                title="Funding watch: Community Foundation Ireland grants",
                summary=(
                    "Baseline community and biodiversity funding watch source. Check for funding routes "
                    "that could support community greening, school/community planting, local biodiversity, "
                    "monitoring, education, stewardship, or maintenance connected to UrbanForest delivery."
                ),
                score=64,
            ),
            make_operational_baseline_item(
                section="funding-opportunities",
                source_id="baseline-eu-life-calls",
                source_name="EU LIFE Calls",
                url="https://cinea.ec.europa.eu/programmes/life/calls-proposals_en",
                title="Funding watch: EU LIFE calls",
                summary=(
                    "Baseline European funding watch source. Check selectively for biodiversity, climate, "
                    "urban greening, nature restoration, or nature-based solution calls where an UrbanForest "
                    "project could contribute as a demonstration, monitoring, education, or implementation component."
                ),
                score=60,
            ),
        ])

    if "design-maintenance-risk" not in existing_sections:
        baselines.extend([
            make_operational_baseline_item(
                section="design-maintenance-risk",
                source_id="baseline-urbanforest-maintenance",
                source_name="UrbanForest maintenance watch",
                url="https://news.google.com/search?q=urban%20trees%20watering%20survival%20maintenance%20aftercare%20soil%20drought",
                title="Design and maintenance watch: tree survival, watering, aftercare, and soil",
                summary=(
                    "Baseline UrbanForest design and maintenance watch. Inspect this lane for tree survival, "
                    "watering, drought stress, young-tree establishment, soil care, mulch, replacement planting, "
                    "aftercare, vandalism, and long-term stewardship. Urban forests fail quietly after launch "
                    "when these risks are not funded and managed."
                ),
                score=64,
            ),
            make_operational_baseline_item(
                section="design-maintenance-risk",
                source_id="baseline-carbon-claims-risk",
                source_name="UrbanForest claims-risk watch",
                url="https://news.google.com/search?q=urban%20tree%20planting%20carbon%20claims%20survival%20maintenance%20greenwashing",
                title="Design and risk watch: weak carbon claims and survival evidence",
                summary=(
                    "Baseline claims-risk watch. Useful for keeping UrbanForest communication grounded in "
                    "survival, biodiversity, shade, wellbeing, soil, monitoring, and stewardship rather than "
                    "overclaiming short-term carbon benefits before establishment and survival are known."
                ),
                score=58,
            ),
        ])

    if not baselines:
        return items

    existing_keys = {canonical_url(item.get("url", "")) or item.get("id") for item in items}
    for item in baselines:
        key = canonical_url(item.get("url", "")) or item.get("id")
        if key not in existing_keys:
            items.append(item)
            existing_keys.add(key)

    return items


def update_archive(latest: dict[str, Any]) -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    stamp = now_utc().date().isoformat()
    snapshot_name = f"{stamp}.json"
    (ARCHIVE / snapshot_name).write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index = {"snapshots": []}
    if INDEX.exists():
        try:
            index = json.loads(INDEX.read_text(encoding="utf-8"))
        except Exception:
            pass
    snapshots = [entry for entry in index.get("snapshots", []) if entry.get("date") != stamp]
    snapshots.insert(0, {
        "date": stamp,
        "path": f"data/archive/{snapshot_name}",
        "count": latest.get("count", 0),
        "generated_at": latest.get("generated_at")
    })
    INDEX.write_text(json.dumps({"generated_at": now_utc().isoformat(), "snapshots": snapshots[:180]}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    discovered, sections = discover_source_items()
    research = fetch_openalex()
    curated = load_curated_items()

    seen = set()
    items = []
    for item in curated + discovered + research:
        key = canonical_url(item.get("url", "")) or item.get("id")
        if key in seen:
            continue
        seen.add(key)
        items.append(item)

    items = ensure_operational_baseline_lanes(items)

    items.sort(key=lambda item: (
        1 if item.get("section") == "ireland-urban-forest-practice" else 0,
        int(item.get("score", 0)),
        item.get("published") or ""
    ), reverse=True)

    latest = {
        "generated_at": now_utc().isoformat(),
        "note": "Practical UrbanForest radar: Ireland-first practice, implementation, funding, research, and maintenance-risk intelligence.",
        "sections": sections,
        "count": len(items[:MAX_ITEMS]),
        "items": items[:MAX_ITEMS]
    }

    LATEST.write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    update_archive(latest)
    print(f"Wrote {LATEST} with {latest['count']} items.")
    print(f"Updated archive index at {INDEX}.")


if __name__ == "__main__":
    main()
