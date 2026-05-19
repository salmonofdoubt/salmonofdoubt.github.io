#!/usr/bin/env python3
"""Daily Ireland-focused Water NbS story discovery.

Design principle: source-led discovery, not blind internet scraping. The radar
favours practical surface-water-quality measures, aquatic ecology, and
water-related biodiversity over generic climate or nature stories.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

import feedparser
import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REPORT_DIR = ROOT / "reports"
REGISTRY_PATH = DATA_DIR / "source-registry.json"
STORIES_PATH = DATA_DIR / "stories.json"
LATEST_REPORT_PATH = REPORT_DIR / "latest.md"

USER_AGENT = "WaterNbSStoryRadar/0.2 (+https://salmonofdoubt.github.io/; source-led environmental monitoring)"
TIMEOUT = 20
MAX_PER_SOURCE = 35
MAX_TOTAL_ITEMS = 160
MIN_SCORE = 28
CURRENT_WINDOW_DAYS = 45
STRATEGIC_WINDOW_DAYS = 90

# The brand lens: practical, Ireland-facing, water-first NbS.
# Generic climate, carbon, tree-planting, or biodiversity stories should only rise
# when there is a clear surface-water, aquatic-ecology, or implementation hook.
WATER_OUTCOME_TERMS: dict[str, int] = {
    "surface water": 30,
    "water quality": 30,
    "freshwater": 22,
    "river": 20,
    "rivers": 20,
    "stream": 18,
    "streams": 18,
    "lake": 18,
    "lakes": 18,
    "estuary": 18,
    "catchment": 22,
    "sub-catchment": 18,
    "water body": 18,
    "water bodies": 18,
    "water framework directive": 24,
    "wfd": 18,
    "river basin management plan": 22,
    "rbmp": 16,
    "ecological status": 26,
    "high status": 22,
    "blue dot": 18,
    "q-value": 22,
    "macroinvertebrate": 22,
    "macroinvertebrates": 22,
    "aquatic ecology": 24,
    "aquatic biodiversity": 26,
    "water-related biodiversity": 26,
    "fish passage": 22,
    "salmonid": 18,
    "trout": 14,
    "salmon": 14,
    "eel": 14,
    "spawning": 18,
    "freshwater pearl mussel": 26,
    "wetland": 18,
    "wetlands": 18,
    "eutrophication": 24,
    "phosphorus": 24,
    "phosphate": 24,
    "orthophosphate": 24,
    "nitrogen": 18,
    "nitrate": 18,
    "ammonia": 20,
    "ammonium": 20,
    "nutrient": 20,
    "nutrients": 20,
    "sediment": 22,
    "silt": 18,
    "suspended solids": 22,
    "tss": 18,
    "turbidity": 18,
    "runoff": 22,
    "farm runoff": 26,
    "urban runoff": 24,
    "stormwater": 22,
    "rainwater": 20,
    "combined sewer overflow": 20,
    "bathing water": 18,
    "pollution": 16,
    "pesticide": 18,
    "hydromorphology": 22,
    "riparian ecology": 24,
}

PRACTICAL_MEASURE_TERMS: dict[str, int] = {
    "constructed wetland": 32,
    "integrated constructed wetland": 34,
    "treatment wetland": 32,
    "pond": 18,
    "sediment pond": 30,
    "attenuation pond": 26,
    "detention basin": 24,
    "retention basin": 24,
    "swale": 24,
    "bioswale": 26,
    "rain garden": 26,
    "bioretention": 28,
    "suds": 26,
    "sustainable drainage": 28,
    "nature-based surface water management": 34,
    "surface water management": 26,
    "riparian buffer": 32,
    "riparian buffers": 32,
    "buffer strip": 28,
    "buffer strips": 28,
    "vegetated buffer": 28,
    "field margin": 18,
    "interception": 20,
    "nutrient interception": 30,
    "sediment interception": 30,
    "slow the flow": 22,
    "natural flood management": 22,
    "floodplain reconnection": 28,
    "river restoration": 30,
    "stream restoration": 30,
    "river corridor": 24,
    "instream habitat": 26,
    "in-stream habitat": 26,
    "large woody debris": 22,
    "fish pass": 22,
    "barrier removal": 22,
    "cattle exclusion": 28,
    "livestock exclusion": 28,
    "fencing": 18,
    "drinking point": 18,
    "solar pump": 14,
    "farmyard runoff": 26,
    "yard runoff": 24,
    "overland flow": 20,
    "drain blocking": 24,
    "rewetting": 22,
    "peatland restoration": 26,
    "bog restoration": 22,
    "hedgerow": 12,
    "riparian planting": 24,
    "native woodland": 14,
    "woodland buffer": 24,
    "denitrifying bioreactor": 28,
    "woodchip bioreactor": 28,
    "phosphorus trap": 28,
    "p trap": 22,
    "measures": 14,
    "mitigation measure": 20,
    "restoration project": 20,
}

IMPLEMENTATION_TERMS: dict[str, int] = {
    "pilot": 22,
    "trial": 22,
    "demonstration": 20,
    "case study": 20,
    "before and after": 22,
    "monitoring": 20,
    "evidence": 16,
    "results": 16,
    "funding": 18,
    "grant": 18,
    "scheme": 16,
    "call for applications": 18,
    "guidance": 18,
    "toolkit": 18,
    "design": 16,
    "maintenance": 18,
    "operation": 14,
    "delivery": 18,
    "implemented": 18,
    "installed": 18,
    "constructed": 20,
    "restored": 18,
    "advisory": 14,
    "farmer": 14,
    "farmers": 14,
    "local authority": 16,
    "community": 12,
    "citizen science": 16,
    "cost": 12,
    "lessons learned": 20,
}

IRELAND_TERMS: dict[str, int] = {
    "ireland": 24,
    "irish": 22,
    "éire": 20,
    "dublin": 14,
    "cork": 12,
    "galway": 12,
    "limerick": 12,
    "waterford": 12,
    "sligo": 12,
    "mayo": 12,
    "meath": 12,
    "louth": 12,
    "kildare": 12,
    "wicklow": 12,
    "donegal": 12,
    "clare": 12,
    "tipperary": 12,
    "kilkenny": 12,
    "wexford": 12,
    "leitrim": 12,
    "roscommon": 12,
    "offaly": 12,
    "laois": 12,
    "westmeath": 12,
    "longford": 12,
    "monaghan": 12,
    "cavan": 12,
    "fingal": 12,
    "dlr": 10,
    "local authority": 12,
    "lawpro": 20,
    "catchments.ie": 18,
    "farming for water": 20,
    "acres": 18,
    "teagasc": 18,
    "epa": 14,
    "npws": 14,
    "inland fisheries ireland": 20,
    "ifi": 14,
    "uisce éireann": 14,
}

# Vague green keywords get a modest base score only. They are not enough for a top ranking.
GENERAL_NBS_TERMS: dict[str, int] = {
    "nature-based solution": 20,
    "nature based solution": 20,
    "nbs": 14,
    "green infrastructure": 12,
    "blue-green": 14,
    "biodiversity": 10,
    "habitat": 10,
    "nature restoration": 12,
    "ecosystem restoration": 12,
    "climate adaptation": 8,
    "tree planting": 4,
    "urban forest": 4,
    "carbon sequestration": 2,
}

DILUTION_TERMS: dict[str, int] = {
    "carbon credit": 18,
    "carbon credits": 18,
    "offset": 16,
    "offsetting": 16,
    "net zero": 10,
    "tourism": 8,
    "wellbeing": 8,
    "amenity": 6,
    "parks and recreation": 6,
}

ANGLE_RULES: list[tuple[str, list[str]]] = [
    ("Farm runoff and nutrient interception", ["farm runoff", "agriculture", "farmer", "farming for water", "acres", "buffer strip", "cattle exclusion", "drinking point", "farmyard runoff", "nutrient", "phosphorus", "nitrate"]),
    ("Riparian buffers and river corridors", ["riparian", "river corridor", "buffer strip", "woodland buffer", "riparian planting", "stream", "river", "bank", "instream habitat", "fish passage"]),
    ("Wetlands, ponds and sediment control", ["constructed wetland", "treatment wetland", "integrated constructed wetland", "wetland", "pond", "sediment pond", "silt", "attenuation pond", "phosphorus trap"]),
    ("Urban SuDS and rainwater quality", ["suds", "sustainable drainage", "stormwater", "rainwater", "urban runoff", "rain garden", "bioretention", "swale", "surface water management"]),
    ("Aquatic ecology and biodiversity", ["aquatic ecology", "aquatic biodiversity", "macroinvertebrate", "q-value", "salmon", "trout", "eel", "freshwater pearl mussel", "spawning", "habitat"]),
    ("Peatland hydrology and water quality", ["peatland", "bog", "rewetting", "drain blocking", "dissolved organic carbon", "wetland", "water retention"]),
    ("WFD, monitoring and evidence", ["water framework directive", "wfd", "rbmp", "ecological status", "monitoring", "evidence", "data", "q-value", "catchment assessment"]),
    ("Funding, guidance and delivery", ["funding", "grant", "scheme", "guidance", "toolkit", "call for applications", "delivery", "implemented", "local authority"]),
]

STOP_TITLE_WORDS = {"the", "and", "for", "with", "from", "that", "this", "into", "over", "under", "new", "ireland", "irish"}


@dataclass
class RawItem:
    source: dict[str, Any]
    title: str
    url: str
    summary: str = ""
    published: str | None = None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def canonical_url(url: str) -> str:
    parsed = urlparse(url.strip())
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    cleaned = parsed._replace(fragment="", query="", path=path)
    return urlunparse(cleaned)


def text_fingerprint(title: str) -> str:
    words = re.findall(r"[a-z0-9]+", title.lower())
    useful = [w for w in words if w not in STOP_TITLE_WORDS]
    return "-".join(useful[:10]) or hashlib.sha1(title.encode("utf-8")).hexdigest()[:12]


def item_id(url: str, title: str) -> str:
    base = canonical_url(url) or text_fingerprint(title)
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def clean_text(value: str | None, limit: int = 900) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    text = html.unescape(soup.get_text(" ", strip=True))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    candidates = [value] if isinstance(value, str) else [str(value)]
    for candidate in candidates:
        try:
            return date_parser.parse(candidate).date().isoformat()
        except Exception:
            try:
                return parsedate_to_datetime(candidate).date().isoformat()
            except Exception:
                continue
    return None


def days_since(iso_date: str | None) -> int | None:
    if not iso_date:
        return None
    try:
        published = date_parser.parse(iso_date).date()
        return (now_utc().date() - published).days
    except Exception:
        return None


def recency_profile(item: RawItem) -> tuple[int | None, str, str, int, int | None]:
    age = days_since(item.published)
    lowered = " ".join([item.title, item.summary]).lower()
    has_call_or_deadline = any(term in lowered for term in [
        "call for expressions of interest",
        "expression of interest",
        "expressions of interest",
        "deadline",
        "closing date",
        "call for applications",
        "applications close",
        "funding call",
        "grant call",
    ])
    if age is None:
        return None, "unknown", "No publication date detected; verify currency before posting.", 10, 58
    if age < 0:
        return age, "future", "Future-dated item; verify source date.", 0, None
    if age <= 14:
        return age, "fresh", "Fresh item; suitable for current commentary if the source is credible.", 0, None
    if age <= CURRENT_WINDOW_DAYS:
        return age, "current", "Current enough for LinkedIn if the practical water hook is strong.", 4, None
    if has_call_or_deadline and age > 30:
        return age, "stale_call", "Older call or deadline item; treat as archive/reference unless the source confirms it is still open.", 45, 38
    if age <= STRATEGIC_WINDOW_DAYS:
        return age, "strategic", "No longer fresh news; use only if it gives useful policy, design, or delivery context.", 14, 72
    return age, "stale", "Older than the normal current-news window; keep as background or precedent, not as today's story.", 32, 52


def fetch(url: str) -> requests.Response:
    return requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)


def discover_rss(source: dict[str, Any]) -> list[RawItem]:
    parsed = feedparser.parse(source["url"], request_headers={"User-Agent": USER_AGENT})
    items: list[RawItem] = []
    for entry in parsed.entries[:MAX_PER_SOURCE]:
        title = clean_text(entry.get("title", ""), 240)
        url = canonical_url(entry.get("link", ""))
        if not title or not url:
            continue
        summary = clean_text(entry.get("summary") or entry.get("description") or "")
        published = parse_date(entry.get("published") or entry.get("updated") or entry.get("created"))
        items.append(RawItem(source=source, title=title, url=url, summary=summary, published=published))
    return items


def discover_html_listing(source: dict[str, Any]) -> list[RawItem]:
    response = fetch(source["url"])
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    selector = source.get("link_selector") or "a"
    base_host = urlparse(source["url"]).netloc
    items: list[RawItem] = []
    seen: set[str] = set()

    for anchor in soup.select(selector):
        title = clean_text(anchor.get_text(" ", strip=True), 240)
        href = anchor.get("href")
        if not title or not href or len(title) < 12:
            continue
        url = canonical_url(urljoin(source["url"], href))
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc and parsed.netloc != base_host:
            continue
        if url in seen:
            continue
        seen.add(url)
        items.append(RawItem(source=source, title=title, url=url, summary="", published=None))
        if len(items) >= MAX_PER_SOURCE:
            break
    return items


def discover_source(source: dict[str, Any]) -> list[RawItem]:
    try:
        if source["type"] == "rss":
            return discover_rss(source)
        if source["type"] == "html_listing":
            return discover_html_listing(source)
    except Exception as exc:
        print(f"WARN source failed: {source.get('id')} {exc}", file=sys.stderr)
    return []


def term_hits(text: str, terms: dict[str, int]) -> tuple[int, list[str]]:
    lowered = text.lower()
    score = 0
    hits: list[str] = []
    for term, weight in terms.items():
        if term in lowered:
            score += weight
            hits.append(term)
    return score, hits


def choose_angle(text: str) -> str:
    lowered = text.lower()
    best = ("Water NbS opportunity", 0)
    for angle, terms in ANGLE_RULES:
        count = sum(1 for term in terms if term in lowered)
        if count > best[1]:
            best = (angle, count)
    return best[0]


def score_band(score: int) -> str:
    if score >= 85:
        return "excellent"
    if score >= 68:
        return "strong"
    if score >= 50:
        return "promising"
    if score >= 32:
        return "watch"
    return "weak"


def sentence_summary(item: RawItem, terms: list[str]) -> str:
    if item.summary:
        return item.summary
    if terms:
        return f"Potential water-NbS item detected from source title. Matched terms include: {', '.join(terms[:6])}."
    return "Potentially relevant item detected from a monitored Irish environmental source."


def build_relevance_text(
    angle: str,
    ireland_hits: list[str],
    water_hits: list[str],
    measure_hits: list[str],
    implementation_hits: list[str],
) -> tuple[str, str, str, str, str]:
    ireland = "Direct Irish relevance detected." if ireland_hits else "Irish relevance inferred from the monitored Irish source; confirm by reading the source."
    if ireland_hits:
        ireland += f" Evidence terms: {', '.join(ireland_hits[:5])}."

    water = "Strong water-quality/ecology signal detected." if water_hits else "Weak explicit water signal; only retain if the source confirms a surface-water or aquatic-ecology hook."
    if water_hits:
        water += f" Evidence terms: {', '.join(water_hits[:7])}."

    practical = "Practical delivery signal detected." if measure_hits or implementation_hits else "Practical delivery hook is not yet obvious; check whether this is more than general awareness."
    practical_terms = list(dict.fromkeys(measure_hits + implementation_hits))[:7]
    if practical_terms:
        practical += f" Evidence terms: {', '.join(practical_terms)}."

    brand_fit = {
        "Farm runoff and nutrient interception": "Very strong fit when it shows how farm-scale measures reduce nutrient, sediment, or pathogen pressure before water reaches rivers and streams.",
        "Riparian buffers and river corridors": "Strong fit because it connects land management, hydrological pathways, habitat structure, and river ecology.",
        "Wetlands, ponds and sediment control": "Very strong fit where the story shows treatment, retention, sediment capture, or nutrient interception rather than generic greening.",
        "Urban SuDS and rainwater quality": "Strong fit when framed around pollutant load reduction, runoff control, river protection, and maintainable street-scale design.",
        "Aquatic ecology and biodiversity": "Strong fit when biodiversity is linked to water bodies, hydromorphology, fish passage, macroinvertebrates, or ecological status.",
        "Peatland hydrology and water quality": "Good fit where peatland restoration is connected to hydrology, downstream water quality, dissolved organic carbon, or aquatic habitat.",
        "WFD, monitoring and evidence": "Strong fit because it lets you discuss measurable outcomes, traceability, and whether interventions improve ecological status.",
        "Funding, guidance and delivery": "Useful when it gives practitioners a route to implement real measures rather than simply admiring the concept.",
    }.get(angle, "Keep only if there is a clear practical water-quality, aquatic ecology, or water-biodiversity angle.")

    why = f"{brand_fit} The strongest LinkedIn angle is practical: what measure was used, what pressure it addresses, where it fits in the catchment, and how success will be monitored."
    return ireland, water, practical, brand_fit, why


def linkedin_draft(item: RawItem, angle: str, brand_fit: str) -> str:
    source = item.source.get("name") or item.source.get("id") or "Source"
    published = item.published or "n.d."
    title = item.title or "Untitled item"
    url = item.url or ""
    citation = f"{source}. ({published}). {title}.
{url}"

    return (
        "A practical Water NbS signal for Ireland.

"
        f"{title}

"
        "This caught my attention because it connects land management with what ultimately matters in a catchment: "
        "cleaner surface water, healthier aquatic ecology, and better conditions for water-related biodiversity.

"
        "For me, the useful question is not simply whether a project is green or nature-based. "
        "The useful question is whether it changes a pressure pathway.

"
        "What I would look for:
"
        "• pressure reduced: nutrients, sediment, runoff, hydromorphological alteration, or habitat fragmentation
"
        "• catchment position: source area, pathway, riparian zone, floodplain, wetland, drain, stream, or receiving water
"
        "• practical intervention: buffer, wetland, pond, SuDS feature, peatland rewetting, river restoration, fencing, planting, or flow attenuation
"
        "• monitoring evidence: chemistry, sediment, flow, macroinvertebrates, fish, habitat condition, or ecological status
"
        "• repeatability: whether this can be maintained and applied elsewhere in Ireland

"
        f"My take: {brand_fit}

"
        "This is where Nature-based Solutions become serious: not as decorative greening, but as practical catchment infrastructure "
        "that supports water quality, ecology, and biodiversity.

"
        f"Source:
{citation}

"
        "#NatureBasedSolutions #WaterQuality #FreshwaterEcology #Biodiversity #Ireland #CatchmentManagement"
    )



def tags_for(source: dict[str, Any], angle: str, hits: list[str]) -> list[str]:
    tags = list(source.get("tags", []))
    tags.extend([angle, "Ireland", "Water NbS", "Surface water quality", "Aquatic ecology"])
    tags.extend(hits[:6])
    clean: list[str] = []
    for tag in tags:
        label = str(tag).strip()
        if label and label not in clean:
            clean.append(label)
    return clean[:12]


def source_scope_boost(source_id: str) -> int:
    return {
        "catchments-news": 14,
        "lawpro-news": 14,
        "farming-for-water": 14,
        "epa-news": 12,
        "epa-hydrometric": 10,
        "epa-consultations": 8,
        "inland-fisheries-news": 12,
        "npws-news": 8,
        "teagasc-environment": 8,
        "biodiversity-ireland": 6,
        "climate-adapt-nbs": 3,
    }.get(source_id, 3)


def enrich(item: RawItem, previous: dict[str, Any] | None = None) -> dict[str, Any] | None:
    text = " ".join([item.title, item.summary, item.source.get("scope", ""), " ".join(item.source.get("tags", []))])
    water_score, water_hits = term_hits(text, WATER_OUTCOME_TERMS)
    measure_score, measure_hits = term_hits(text, PRACTICAL_MEASURE_TERMS)
    implementation_score, implementation_hits = term_hits(text, IMPLEMENTATION_TERMS)
    ireland_score, ireland_hits = term_hits(text, IRELAND_TERMS)
    general_score, general_hits = term_hits(text, GENERAL_NBS_TERMS)
    dilution_score, dilution_hits = term_hits(text, DILUTION_TERMS)

    has_water_core = water_score >= 20 or any(term in water_hits for term in ["water quality", "surface water", "ecological status", "aquatic ecology", "aquatic biodiversity"])
    has_practical_core = measure_score >= 24 or implementation_score >= 20

    trust_score = int(float(item.source.get("trust", 0.7)) * 10)
    source_boost = source_scope_boost(str(item.source.get("id", "")))
    age_days, freshness_status, freshness_note, recency_penalty, recency_cap = recency_profile(item)

    # Water and practical implementation dominate. Generic NbS and climate terms can help but cannot carry a story.
    score = water_score + measure_score + implementation_score + ireland_score + min(general_score, 24) + trust_score + source_boost - dilution_score - recency_penalty
    if not has_water_core:
        score -= 22
    if not has_practical_core:
        score -= 12
    if dilution_hits and not has_water_core:
        score -= 12
    if recency_cap is not None:
        score = min(score, recency_cap)
    score = max(0, min(100, score))

    if score < MIN_SCORE:
        return None

    angle = choose_angle(text)
    evidence = list(dict.fromkeys(water_hits + measure_hits + implementation_hits + ireland_hits + general_hits))[:14]
    ireland, water, practical, brand_fit, why = build_relevance_text(angle, ireland_hits, water_hits, measure_hits, implementation_hits)
    identifier = item_id(item.url, item.title)
    out = {
        "id": identifier,
        "title": item.title,
        "source_name": item.source.get("name"),
        "source_id": item.source.get("id"),
        "url": item.url,
        "published": item.published,
        "summary": sentence_summary(item, evidence),
        "age_days": age_days,
        "freshness_status": freshness_status,
        "freshness_note": freshness_note,
        "source_citation": f"{item.source.get('name', 'Source')}. ({item.published or 'n.d.'}). {item.title}. {item.url}",
        "score": score,
        "score_band": score_band(score),
        "angle": angle,
        "ireland_relevance": ireland,
        "water_relevance": water,
        "practical_relevance": practical,
        "brand_fit": brand_fit,
        "why_post": why,
        "evidence_terms": evidence,
        "tags": tags_for(item.source, angle, evidence),
        "curation_status": "new",
        "linkedin_draft": linkedin_draft(item, angle, brand_fit),
        "discovered_at": now_utc().isoformat(),
    }
    if previous:
        for key in ["curation_status", "editor_notes", "linkedin_draft"]:
            if previous.get(key):
                out[key] = previous[key]
        out["first_seen"] = previous.get("first_seen") or previous.get("discovered_at") or out["discovered_at"]
    else:
        out["first_seen"] = out["discovered_at"]
    return out


def markdown_report(payload: dict[str, Any]) -> str:
    today = now_utc().date().isoformat()
    items = payload.get("items", [])
    top = items[:12]
    lines = [
        f"# Water NbS Story Radar · {today}",
        "",
        f"Generated: {payload.get('generated_at')}",
        f"Candidates: {payload.get('candidate_count', 0)} from {payload.get('source_count', 0)} sources",
        "",
        "Editorial lens: practical measures that improve surface water quality, aquatic ecology, and water-related biodiversity in Ireland.",
        "",
        "## Editorial picks to consider",
        "",
    ]
    if not top:
        lines.append("No strong candidates found today. Consider broadening water-quality keywords or adding sources.")
    for index, item in enumerate(top, 1):
        lines.extend([
            f"### {index}. {item['title']}",
            "",
            f"Score: {item['score']} · {item.get('score_band', 'candidate')} · Source: {item.get('source_name', 'unknown')}",
            "",
            f"URL: {item['url']}",
            "",
            f"Angle: {item.get('angle', 'Unclassified')}",
            "",
            f"Freshness: {item.get('freshness_note', '')}",
            "",
            f"Water signal: {item.get('water_relevance', '')}",
            "",
            f"Practical signal: {item.get('practical_relevance', '')}",
            "",
            f"Brand fit: {item.get('brand_fit', '')}",
            "",
            f"Summary: {item.get('summary', '')}",
            "",
            "LinkedIn draft:",
            "",
            item.get("linkedin_draft", ""),
            "",
            "Decision: [ ] pick  [ ] watch  [ ] reject",
            "",
            "---",
            "",
        ])
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    registry = load_json(REGISTRY_PATH, {"sources": []})
    previous_payload = load_json(STORIES_PATH, {"items": []})
    previous_by_id = {item.get("id"): item for item in previous_payload.get("items", []) if item.get("id")}
    previous_by_url = {canonical_url(item.get("url", "")): item for item in previous_payload.get("items", []) if item.get("url")}

    raw_items: list[RawItem] = []
    for source in registry.get("sources", []):
        raw_items.extend(discover_source(source))

    enriched: dict[str, dict[str, Any]] = {}
    for raw in raw_items:
        identifier = item_id(raw.url, raw.title)
        prev = previous_by_id.get(identifier) or previous_by_url.get(canonical_url(raw.url))
        item = enrich(raw, prev)
        if not item:
            continue
        existing = enriched.get(item["id"])
        if not existing or item["score"] > existing["score"]:
            enriched[item["id"]] = item

    # Preserve selected and watched items that temporarily disappear from feeds.
    for old in previous_payload.get("items", []):
        if old.get("curation_status") in {"selected", "watch"} and old.get("id") not in enriched:
            old = dict(old)
            old["score"] = max(0, int(old.get("score", 0)) - 6)
            enriched[old["id"]] = old

    items = sorted(enriched.values(), key=lambda x: (int(x.get("score", 0)), x.get("published") or ""), reverse=True)[:MAX_TOTAL_ITEMS]
    payload = {
        "version": "0.2.0",
        "generated_at": now_utc().isoformat(),
        "run_id": now_utc().strftime("%Y%m%dT%H%M%SZ"),
        "source_count": len(registry.get("sources", [])),
        "candidate_count": len(items),
        "editorial_lens": "Practical surface-water quality, aquatic ecology, and water-related biodiversity stories for Ireland-focused NbS communication.",
        "items": items,
    }
    write_json(STORIES_PATH, payload)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = markdown_report(payload)
    dated_report = REPORT_DIR / f"{now_utc().date().isoformat()}.md"
    dated_report.write_text(report, encoding="utf-8")
    LATEST_REPORT_PATH.write_text(report, encoding="utf-8")
    print(f"Wrote {STORIES_PATH.relative_to(ROOT)} with {len(items)} candidates")
    print(f"Wrote {dated_report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
