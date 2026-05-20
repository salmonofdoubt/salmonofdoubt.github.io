#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
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

ROOT = Path("demos/ndrt/news")
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"
REGISTRY = DATA / "source-registry.json"
CURATED = DATA / "curated-items.json"
LATEST = DATA / "news.json"
INDEX = ARCHIVE / "index.json"

MAX_ITEMS = 55
MIN_SCORE = 22
CURRENT_WINDOW_DAYS = 90

HEADERS = {
    "User-Agent": "NDRTWaterRadar/0.1 (+https://salmonofdoubt.github.io/demos/ndrt/news/)"
}

CORE_PATTERNS = [
    r"\briver\b",
    r"\brivers\b",
    r"\bstream\b",
    r"\bcatchment\b",
    r"\bwater quality\b",
    r"\bfreshwater\b",
    r"\blake\b",
    r"\blough\b",
    r"\bestuary\b",
    r"\blagoon\b",
    r"\bwetland\b",
    r"\bsaltmarsh\b",
    r"\briparian\b",
    r"\bfish kill\b",
    r"\balgal bloom\b",
    r"\bsewage\b",
    r"\bseptic tank\b",
    r"\bseptic tanks\b",
    r"\bdomestic wastewater\b",
    r"\bon-site wastewater\b",
    r"\bonsite wastewater\b",
    r"\bprivate well\b",
    r"\bgroundwater contamination\b",
    r"\bpollution\b",
    r"\bslurry spreading\b",
    r"\bmanure spreading\b",
    r"\borganic fertiliser\b",
    r"\borganic fertilizer\b",
    r"\bfertiliser spreading\b",
    r"\bfertilizer spreading\b",
    r"\bclosed period\b",
    r"\bspreading dates\b",
    r"\bnitrates action programme\b",
    r"\bnitrates derogation\b",
    r"\bcitizen science\b",
    r"\bnature-based\b",
    r"\brestoration\b",
    r"\bgrant\b",
    r"\bfunding\b",
    r"\bcall for proposals\b",
]

THEMES = {
    "nanny-delvin-local": ["nanny-delvin", "nanny delvin", "river nanny", "river delvin", "nanny estuary", "east meath", "north fingal", "balbriggan", "stamullen", "gormanston", "julianstown", "laytown", "bettystown", "naul", "sonairte"],
    "catchment": ["catchment", "river basin", "waterbody", "water body", "wfd", "rbmp"],
    "river-restoration": ["river restoration", "restoration", "re-meander", "fish passage", "habitat repair", "river corridor"],
    "water-quality": ["water quality", "phosphate", "nitrate", "nutrient", "sediment", "tss", "pollution", "sewage", "runoff"],
    "citizen-science": ["citizen science", "monitoring", "kick sampling", "cssi", "q-value", "volunteer"],
    "estuary-lagoon": ["estuary", "lagoon", "saltmarsh", "coastal wetland", "spartina", "tidal"],
    "lake": ["lake", "lough", "algal bloom", "cyanobacteria", "eutrophication"],
    "wetland-nbs": ["wetland", "nature-based", "pond", "riparian buffer", "constructed wetland", "buffer strip", "rewetting"],
    "biodiversity": ["biodiversity", "habitat", "species", "salmon", "trout", "eel", "lamprey", "kingfisher", "invasive"],
    "invasive-species": ["invasive species", "invasive plant", "invasive aquatic", "spartina", "cordgrass", "japanese knotweed", "himalayan balsam", "zebra mussel"],
    "birds-wetlands": ["waterbirds", "wetland birds", "estuary birds", "waders", "shorebirds", "wintering birds", "birdwatch", "breeding birds"],
    "river-ecology": ["river ecology", "freshwater ecology", "aquatic ecology", "macroinvertebrates", "fish passage", "habitat restoration", "ecological status"],
    "incident-alert": ["fish kill", "pollution incident", "do not swim", "bathing water", "algal bloom", "sewage overflow"],
    "septic-wastewater": ["septic tank", "septic tanks", "domestic wastewater", "on-site wastewater", "onsite wastewater", "private well", "groundwater contamination"],
    "grant": ["grant", "funding", "scheme", "call", "award", "opportunity", "programme"],
}

GOOD_TERMS = {
    "nanny-delvin": 22,
    "nanny delvin": 22,
    "river nanny": 22,
    "river delvin": 22,
    "nanny estuary": 20,
    "east meath": 16,
    "north fingal": 14,
    "balbriggan": 14,
    "stamullen": 14,
    "gormanston": 14,
    "julianstown": 16,
    "laytown": 14,
    "bettystown": 14,
    "mornington": 12,
    "duleek": 12,
    "naul": 12,
    "sonairte": 14,
    "Ireland": 12,
    "Irish": 10,
    "Meath": 12,
    "Louth": 12,
    "Dublin": 8,
    "Nanny": 18,
    "Delvin": 18,
    "catchment": 12,
    "river": 9,
    "stream": 8,
    "lake": 8,
    "lough": 8,
    "estuary": 10,
    "lagoon": 10,
    "wetland": 10,
    "water quality": 12,
    "citizen science": 12,
    "monitoring": 10,
    "restoration": 10,
    "biodiversity": 9,
    "invasive species": 14,
    "invasive plant": 12,
    "invasive aquatic": 13,
    "spartina": 18,
    "cordgrass": 16,
    "japanese knotweed": 12,
    "himalayan balsam": 12,
    "zebra mussel": 12,
    "waterbirds": 12,
    "wetland birds": 12,
    "estuary birds": 12,
    "waders": 10,
    "shorebirds": 10,
    "wintering birds": 10,
    "river ecology": 13,
    "freshwater ecology": 13,
    "aquatic ecology": 12,
    "macroinvertebrates": 12,
    "fish passage": 10,
    "ecological status": 10,
    "pollution": 8,
    "fish kill": 11,
    "algal bloom": 9,
    "sewage": 7,
    "septic tank": 14,
    "septic tanks": 14,
    "domestic wastewater": 14,
    "on-site wastewater": 14,
    "onsite wastewater": 14,
    "private well": 9,
    "groundwater": 9,
    "e. coli": 8,
    "faecal": 8,
    "fecal": 8,
    "grant": 14,
    "funding": 14,
    "call": 8,
    "community": 8,
    "LAWPRO": 14,
    "EPA": 10,
    "Inland Fisheries": 10,
    "NPWS": 9,
    "Rivers Trust": 9,
    "WFD": 8,
    "RBMP": 8,
}

BAD_TERMS = [
    "stock market",
    "football",
    "film",
    "celebrity",
    "river island",
    "riverdance",
    "crypto",
    "property prices",
    "crime drama",
    "water bottle",
    "bottled water",
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

def clean_text(value: Any, limit: int = 700) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()

def canonical_url(url: str) -> str:
    parsed = urlparse(url)
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


TRUE_GRANT_TERMS = [
    "grant", "grants", "funding", "fund", "funds", "scheme", "call for proposals",
    "applications open", "application deadline", "deadline", "eligible", "eligibility",
    "award", "awards", "programme", "program", "community water development fund",
    "heritage council", "life calls", "open call", "small grants", "biodiversity fund"
]

GRANT_FALSE_POSITIVE_CONTEXTS = [
    "failed inspection", "failed inspections", "inspection", "inspections",
    "environmental check", "epa report", "non-compliant", "non compliant",
    "wastewater treatment systems failed", "septic tanks failed"
]

def has_true_grant_signal(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in TRUE_GRANT_TERMS)

def likely_grant_false_positive(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in GRANT_FALSE_POSITIVE_CONTEXTS)

def infer_operational_section(source_section: str, text: str) -> str:
    lowered = text.lower()

    # Grants must be real opportunities, not merely from a grant-watch source.
    if source_section == "grants-opportunities":
        if has_true_grant_signal(lowered) and not likely_grant_false_positive(lowered):
            return "grants-opportunities"
        return "waterbody-evidence-alerts"

    # Allow true grant signals found elsewhere to move into grants.
    if has_true_grant_signal(lowered) and not likely_grant_false_positive(lowered):
        return "grants-opportunities"

    return source_section or "ireland-catchment-practice"


def matches_core(text: str) -> bool:
    lowered = text.lower()

    if any(re.search(pattern, lowered) for pattern in CORE_PATTERNS):
        return True

    water_terms = ["water", "aquatic", "freshwater", "coastal", "habitat", "biodiversity"]
    action_terms = ["monitoring", "restoration", "pollution", "grant", "funding", "community", "catchment"]
    return any(a in lowered for a in water_terms) and any(b in lowered for b in action_terms)

def infer_theme(text: str) -> str:
    lowered = text.lower()
    best_theme = "catchment"
    best_score = 0

    for theme, terms in THEMES.items():
        score = sum(1 for term in terms if term in lowered)
        if score > best_score:
            best_theme = theme
            best_score = score

    return best_theme

def tags_for(text: str) -> list[str]:
    lowered = text.lower()
    tags = []

    for theme, terms in THEMES.items():
        if any(term in lowered for term in terms):
            tags.append(theme)

    return tags[:7] or ["catchment"]

def score_item(item: RawItem) -> tuple[int, str, str, list[str]]:
    text = f"{item.title} {item.summary}"
    lowered = text.lower()

    if any(term in lowered for term in BAD_TERMS):
        return 0, "reference", "Excluded as likely off-topic.", []

    if not matches_core(text):
        return 0, "reference", "No strong water/catchment/grant signal detected.", []

    score = 18

    for pattern in CORE_PATTERNS:
        if re.search(pattern, lowered):
            score += 8

    for term, points in GOOD_TERMS.items():
        if term.lower() in lowered:
            score += points

    trust = float(item.source.get("trust", 0.65))
    score += int(trust * 10)

    scope = item.source.get("scope", "")
    section = item.source.get("section", "")

    if "ireland" in scope:
        score += 12
    if "institutional" in scope:
        score += 8
    if "funding" in scope or section == "grants-opportunities":
        score += 10
    if "practice" in scope:
        score += 6

    days = age_days(item.published)

    if days is None:
        freshness_status = "reference"
        freshness_label = "Date unknown"
        score -= 4
    elif days <= CURRENT_WINDOW_DAYS:
        freshness_status = "fresh"
        freshness_label = f"{days} days old"
        score += 6
    else:
        freshness_status = "reference"
        freshness_label = f"{days} days old · background"
        score -= min(20, int(days / 45) * 4)

    score = max(0, min(100, score))
    return score, freshness_status, freshness_label, tags_for(text)

def fetch_rss(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()
    feed = feedparser.parse(response.content)
    items: list[RawItem] = []

    for entry in feed.entries[:35]:
        title = clean_text(entry.get("title"), 260)
        url = entry.get("link") or ""
        summary = clean_text(entry.get("summary") or entry.get("description"), 800)
        published = parse_date(entry.get("published") or entry.get("updated"))

        if title and url:
            items.append(RawItem(title=title, url=url, summary=summary, published=published, source=source))

    return items

def fetch_page(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    items: list[RawItem] = []

    for link in soup.select("a[href]")[:220]:
        title = clean_text(link.get_text(" "), 240)
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

        items.append(RawItem(title=title, url=url, summary=surrounding, published=published, source=source))

    return items

def load_registry() -> dict[str, Any]:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))

def load_curated_items() -> list[dict[str, Any]]:
    if not CURATED.exists():
        return []

    try:
        payload = json.loads(CURATED.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Curated item file failed: {exc}")
        return []

    clean_items: list[dict[str, Any]] = []

    for item in payload.get("items", []):
        if not item.get("title") or not item.get("url"):
            continue

        clean_items.append({
            "id": item.get("id") or item_id(item["url"], item["title"]),
            "title": clean_text(item.get("title"), 260),
            "url": canonical_url(item.get("url", "")),
            "summary": clean_text(item.get("summary"), 1000),
            "published": item.get("published"),
            "source_id": item.get("source_id", "curated"),
            "source_name": item.get("source_name", "Curated reference"),
            "publisher": item.get("publisher", item.get("source_name", "Curated reference")),
            "section": item.get("section", "ireland-catchment-practice"),
            "theme": item.get("theme", "catchment"),
            "tags": item.get("tags", ["curated"]),
            "score": int(item.get("score", 90)),
            "freshness_status": item.get("freshness_status", "reference"),
            "freshness_label": item.get("freshness_label", "Curated reference"),
        })

    return clean_items


LOCAL_RELEVANCE_TERMS = {
    "nanny-delvin": 40,
    "nanny delvin": 40,
    "nanny-delvin rivers trust": 42,
    "nanny delvin rivers trust": 42,
    "ndrt": 36,
    "river nanny": 38,
    "nanny river": 38,
    "river delvin": 38,
    "delvin river": 38,
    "nanny estuary": 36,
    "delvin estuary": 34,
    "east meath": 30,
    "meath coast": 28,
    "north fingal": 26,
    "balbriggan": 26,
    "balrothery": 24,
    "ballyboghil": 24,
    "garristown": 22,
    "oldtown": 22,
    "stamullen": 28,
    "gormanston": 28,
    "julianstown": 30,
    "laytown": 26,
    "bettystown": 26,
    "mornington": 24,
    "duleek": 24,
    "naul": 24,
    "sonairte": 26,
    "bellewstown": 22,
    "ardcath": 22,
    "clonalvy": 22,
    "snowtown": 22,
    "meath county council": 18,
    "louth county council": 18,
    "fingal county council": 18,
    "nanny": 30,
    "delvin": 30,
    "nanny-delvin": 35,
    "meath": 22,
    "louth": 22,
    "fingal": 18,
    "dublin bay": 18,
    "boyne": 16,
    "east coast": 14,
    "irish sea": 14,
    "balbriggan": 22,
    "gormanston": 22,
    "julianstown": 22,
    "laytown": 18,
    "bettystown": 18,
    "naul": 18,
    "county meath": 22,
    "county louth": 22,
}

PRESSURE_RULES = {
    "invasive species": [
        "invasive species", "invasive plant", "invasive aquatic", "spartina", "cordgrass",
        "japanese knotweed", "himalayan balsam", "zebra mussel"
    ],
    "birds / wetland ecology": [
        "waterbirds", "wetland birds", "estuary birds", "waders", "shorebirds",
        "wintering birds", "birdwatch", "breeding birds"
    ],
    "river ecology": [
        "river ecology", "freshwater ecology", "aquatic ecology", "macroinvertebrates",
        "fish passage", "habitat restoration", "ecological status", "q-value"
    ],
    "manure / slurry timing": [
        "slurry spreading", "manure spreading", "organic fertiliser", "organic fertilizer",
        "fertiliser spreading", "fertilizer spreading", "closed period", "spreading dates",
        "rain forecast", "rainfall", "nitrates action programme", "nitrates derogation"
    ],
    "septic / domestic wastewater": [
        "septic", "domestic wastewater", "on-site wastewater", "onsite wastewater",
        "private well", "groundwater contamination", "e. coli", "faecal", "fecal"
    ],
    "slurry-manure-timing": ["slurry spreading", "manure spreading", "organic fertiliser", "organic fertilizer", "fertiliser spreading", "fertilizer spreading", "closed period", "spreading dates", "nitrates action programme", "nitrates derogation", "rainfall", "rain forecast"],
    "agricultural runoff": [
        "agricultural runoff", "farm runoff", "agriculture", "farmer", "slurry",
        "fertiliser", "fertilizer", "nutrient runoff", "field margin"
    ],
    "nutrients": [
        "phosphorus", "phosphate", "nitrogen", "nitrate", "nutrient", "eutrophication",
        "algal bloom", "cyanobacteria"
    ],
    "sediment / hydromorphology": [
        "sediment", "suspended solids", "silt", "erosion", "hydromorphology",
        "drainage", "channel", "river bank", "bank erosion"
    ],
    "habitat / biodiversity": [
        "biodiversity", "habitat", "species", "salmon", "trout", "eel", "lamprey",
        "macroinvertebrate", "pollinator", "wetland", "saltmarsh"
    ],
    "invasive species": [
        "invasive", "invasive species", "spartina", "japanese knotweed", "himalayan balsam"
    ],
    "incident / alert": [
        "fish kill", "pollution incident", "sewage overflow", "algal bloom",
        "do not swim", "bathing water", "contamination"
    ],
    "citizen science / monitoring": [
        "citizen science", "monitoring", "volunteer", "kick sampling", "cssi",
        "q-value", "sampling", "field observation"
    ],
    "funding / grant": [
        "grant", "funding", "scheme", "call", "award", "programme", "opportunity"
    ],
    "policy / governance": [
        "policy", "governance", "lawpro", "epa", "npws", "water framework directive",
        "wfd", "rbmp", "river basin management"
    ],
    "NbS / restoration": [
        "nature-based", "nature based", "riparian buffer", "constructed wetland",
        "wetland restoration", "rewetting", "pond", "river restoration", "buffer strip",
        "floodplain"
    ],
}

def text_for_annotation(item: dict[str, Any]) -> str:
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    return " ".join([
        str(item.get("title", "")),
        str(item.get("summary", "")),
        str(item.get("section", "")),
        str(item.get("theme", "")),
        " ".join(map(str, tags)),
        str(item.get("source_name", "")),
    ]).lower()

def pressure_categories_for(text: str) -> list[str]:
    categories = []
    for label, terms in PRESSURE_RULES.items():
        if any(term in text for term in terms):
            categories.append(label)
    return categories[:5] or ["general catchment signal"]

def local_relevance_for(text: str) -> dict[str, Any]:
    score = 0
    matched = []

    for term, points in LOCAL_RELEVANCE_TERMS.items():
        if term in text:
            score += points
            matched.append(term)

    if "ireland" in text or "irish" in text:
        score += 10
        matched.append("Ireland")

    if "east coast" in text or "irish sea" in text:
        score += 8

    score = max(0, min(100, score))

    if score >= 45:
        label = "High local relevance"
    elif score >= 20:
        label = "Moderate local relevance"
    elif score >= 8:
        label = "Ireland-wide relevance"
    else:
        label = "Transferable relevance"

    return {
        "score": score,
        "label": label,
        "matched_terms": sorted(set(matched))[:8]
    }

def grant_fit_for(item: dict[str, Any], text: str) -> dict[str, Any] | None:
    if not has_true_grant_signal(text) or likely_grant_false_positive(text):
        return None

    fit_score = 35

    if "community" in text:
        fit_score += 18
    if "water" in text or "catchment" in text or "river" in text:
        fit_score += 18
    if "biodiversity" in text or "heritage" in text or "wetland" in text:
        fit_score += 14
    if "citizen science" in text or "monitoring" in text or "education" in text:
        fit_score += 12
    if "ireland" in text or "irish" in text:
        fit_score += 10

    fit_score = max(0, min(100, fit_score))

    if fit_score >= 75:
        fit = "High"
    elif fit_score >= 55:
        fit = "Medium"
    else:
        fit = "Low"

    return {
        "fit": fit,
        "score": fit_score,
        "eligible_hint": "Likely worth checking for community, biodiversity, water-quality, education, or citizen-science eligibility.",
        "action_needed": "Check deadline, applicant eligibility, match-funding needs, and whether NDRT or a partner body should lead."
    }

def action_relevance_for(item: dict[str, Any], pressures: list[str], local: dict[str, Any], grant_fit: dict[str, Any] | None) -> str:
    section = item.get("section", "")
    title = str(item.get("title", "")).lower()
    pressure_text = ", ".join(pressures[:3])

    if grant_fit:
        return f"Funding signal for the Trust: check whether this can support {pressure_text}, citizen science, engagement, or small catchment actions."

    if "invasive species" in pressures:
        return "Ecological pressure signal: invasive species such as Spartina, knotweed, balsam, or aquatic invaders can affect habitats, access, estuary condition, and restoration priorities."

    if "birds / wetland ecology" in pressures:
        return "Ecology signal: bird and wetland indicators can help connect river, estuary, lagoon, saltmarsh, and habitat condition to visible biodiversity outcomes."

    if "river ecology" in pressures:
        return "River ecology signal: useful for understanding habitat condition, macroinvertebrates, fish passage, ecological status, and monitoring priorities for Nanny Watch."

    if "manure / slurry timing" in pressures:
        return "Agricultural timing signal: slurry or manure may be legally spread while rainfall/runoff risk is still high, which is directly relevant to nutrients, sediment pathways, farmer engagement, and catchment messaging."

    if "septic" in title or "domestic wastewater" in title or "septic / domestic wastewater" in pressures:
        return "Potential catchment-pressure signal: septic or domestic wastewater issues can affect groundwater, small streams, bathing waters, and local engagement priorities."

    if "incident / alert" in pressures:
        return "Operational watch signal: this may indicate a water-quality incident, bathing-water concern, fish kill, pollution pathway, or public-reporting opportunity."

    if "citizen science / monitoring" in pressures:
        return "Monitoring signal: useful for shaping Nanny Watch methods, volunteer training, repeat observations, or field evidence protocols."

    if "NbS / restoration" in pressures:
        return "Restoration signal: potentially useful for riparian, wetland, floodplain, habitat, or runoff-interception measures."

    if section == "research-papers":
        return f"Evidence signal: use this to support practical decisions, explain methods, or justify action around {pressure_text}."

    if local.get("score", 0) >= 20:
        return f"Local relevance signal: useful because it connects to {local.get('label', 'local relevance')} and the Trust's catchment-facing work."

    return f"General practical signal: may help the Trust track {pressure_text}, policy, funding, monitoring, or community action."

def research_use_type_for(text: str) -> str | None:
    if "review" in text or "meta-analysis" in text or "systematic review" in text:
        return "Review / evidence synthesis"
    if "citizen science" in text or "monitoring" in text or "macroinvertebrate" in text:
        return "Monitoring method"
    if "constructed wetland" in text or "riparian" in text or "nature-based" in text or "nature based" in text:
        return "NbS effectiveness"
    if "policy" in text or "governance" in text or "wfd" in text:
        return "Policy / governance"
    if "case study" in text or "field study" in text:
        return "Case / field evidence"
    return None

def annotate_item(item: dict[str, Any]) -> dict[str, Any]:
    text = text_for_annotation(item)
    pressures = pressure_categories_for(text)
    local = local_relevance_for(text)
    grant_fit = grant_fit_for(item, text)

    item["pressure_categories"] = pressures
    item["local_relevance"] = local
    item["action_relevance"] = action_relevance_for(item, pressures, local, grant_fit)

    if grant_fit:
        item["opportunity_fit"] = grant_fit

    research_use = research_use_type_for(text)
    if research_use:
        item["research_use_type"] = research_use

    # Locality boost, but do not let it swamp all other scoring.
    if local["score"] >= 45:
        item["score"] = min(100, int(item.get("score", 0)) + 8)
    elif local["score"] >= 20:
        item["score"] = min(100, int(item.get("score", 0)) + 4)

    return item


def discover() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    registry = load_registry()
    sections = registry.get("sections", [])
    seen: set[str] = set()
    results: list[dict[str, Any]] = []

    for source in registry.get("sources", []):
        try:
            raw_items = fetch_rss(source) if source.get("type") == "rss" else fetch_page(source)
        except Exception as exc:
            print(f"Source failed: {source.get('id')} :: {exc}")
            continue

        for raw in raw_items:
            uid = item_id(raw.url, raw.title)
            if uid in seen:
                continue
            seen.add(uid)

            score, freshness_status, freshness_label, tags = score_item(raw)

            if score < MIN_SCORE:
                continue

            text = f"{raw.title} {raw.summary}"
            theme = infer_theme(text)

            inferred_section = infer_operational_section(
                raw.source.get("section", "ireland-catchment-practice"),
                text
            )

            results.append({
                "id": uid,
                "title": raw.title,
                "url": canonical_url(raw.url),
                "summary": raw.summary,
                "published": raw.published,
                "source_id": raw.source.get("id"),
                "source_name": raw.source.get("name"),
                "publisher": raw.source.get("name"),
                "section": inferred_section,
                "theme": theme,
                "tags": tags,
                "score": score,
                "freshness_status": freshness_status,
                "freshness_label": freshness_label,
            })

    results.sort(key=lambda item: (item.get("score", 0), item.get("published") or ""), reverse=True)
    return results[:MAX_ITEMS], sections

def update_archive(latest: dict[str, Any]) -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    stamp = now_utc().date().isoformat()
    snapshot_name = f"{stamp}.json"
    snapshot_path = ARCHIVE / snapshot_name

    snapshot_path.write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if INDEX.exists():
        try:
            index = json.loads(INDEX.read_text(encoding="utf-8"))
        except Exception:
            index = {"snapshots": []}
    else:
        index = {"snapshots": []}

    snapshots = [entry for entry in index.get("snapshots", []) if entry.get("date") != stamp]
    snapshots.insert(0, {
        "date": stamp,
        "path": f"data/archive/{snapshot_name}",
        "count": latest.get("count", 0),
        "generated_at": latest.get("generated_at"),
    })

    INDEX.write_text(json.dumps({
        "generated_at": now_utc().isoformat(),
        "snapshots": snapshots[:180],
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    discovered_items, sections = discover()
    curated_items = load_curated_items()

    seen_urls = set()
    items = []

    for item in curated_items + discovered_items:
        key = canonical_url(item.get("url", "")) or item.get("id")
        if key in seen_urls:
            continue
        seen_urls.add(key)
        items.append(annotate_item(item))

    items.sort(key=lambda item: (int(item.get("score", 0)), item.get("published") or ""), reverse=True)

    latest = {
        "generated_at": now_utc().isoformat(),
        "note": "Source-led daily radar for Nanny-Delvin: Irish catchment practice, waterbody evidence/alerts, and grants/opportunities.",
        "sections": sections,
        "count": len(items),
        "items": items,
    }

    LATEST.write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    update_archive(latest)

    print(f"Wrote {LATEST} with {len(items)} items.")
    print(f"Updated archive index at {INDEX}.")

if __name__ == "__main__":
    main()
