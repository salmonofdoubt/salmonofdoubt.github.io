#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

ROOT = Path("demos/ndrt/news")
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"
LATEST = DATA / "news.json"
INDEX = ARCHIVE / "index.json"

OPENALEX_WORKS = "https://api.openalex.org/works"

MAX_RESEARCH_ITEMS = 36
MIN_RESEARCH_SCORE = 34
FROM_PUBLICATION_DATE = "2014-01-01"

RESEARCH_SECTION = {
    "id": "research-papers",
    "title": "Practical Research Papers and Reviews",
    "description": (
        "Scholarly evidence ranked for practical Nanny-Delvin usefulness: Ireland first, "
        "comparable temperate systems second, and transferable NbS / water-quality evidence where it helps action."
    )
}

QUERIES = [
    ("Ireland catchment water quality river restoration phosphorus agricultural runoff", "water-quality", "ireland-direct",
     ["research", "ireland", "water-quality", "catchment", "agriculture"]),
    ("Irish rivers water quality nutrients phosphorus sediment catchment management", "catchment", "ireland-direct",
     ["research", "ireland", "rivers", "nutrients", "sediment"]),
    ("Ireland riparian buffer agricultural runoff water quality nutrient sediment", "wetland-nbs", "ireland-direct",
     ["research", "ireland", "riparian-buffer", "agriculture"]),
    ("Ireland constructed wetland agricultural runoff phosphorus nitrogen water quality", "wetland-nbs", "ireland-direct",
     ["research", "ireland", "constructed-wetland", "nutrients"]),
    ("Ireland citizen science river monitoring freshwater macroinvertebrate water quality", "citizen-science", "ireland-direct",
     ["research", "ireland", "citizen-science", "monitoring"]),
    ("Ireland estuary lagoon saltmarsh restoration biodiversity water quality", "estuary-lagoon", "ireland-direct",
     ["research", "ireland", "estuary", "lagoon", "saltmarsh"]),
    ("UK Ireland river restoration water quality catchment management biodiversity", "river-restoration", "comparable-temperate",
     ["research", "uk-ireland", "river-restoration", "catchment"]),
    ("temperate Europe river restoration water quality nature-based solutions catchment", "river-restoration", "comparable-temperate",
     ["research", "temperate", "europe", "nbs"]),
    ("riparian buffer nutrient sediment agricultural runoff temperate catchment review", "wetland-nbs", "transferable-review",
     ["research", "review", "riparian-buffer", "nutrients"]),
    ("constructed wetlands nutrient removal agricultural runoff review phosphorus nitrogen", "wetland-nbs", "transferable-review",
     ["research", "review", "constructed-wetland", "nutrients"]),
    ("nature based solutions freshwater water quality catchment restoration review", "wetland-nbs", "transferable-review",
     ["research", "review", "nbs", "freshwater"]),
    ("citizen science freshwater monitoring river water quality macroinvertebrate review", "citizen-science", "transferable-review",
     ["research", "review", "citizen-science", "monitoring"])
]

IRELAND_TERMS = [
    "ireland", "irish", "republic of ireland", "northern ireland", "meath", "louth",
    "dublin", "boyne", "water framework directive", "wfd", "river basin management"
]

COMPARABLE_TERMS = [
    "united kingdom", "uk", "england", "scotland", "wales", "europe",
    "european", "temperate", "northwest europe", "north-west europe", "atlantic"
]

DISTANT_CONTEXT_TERMS = [
    "ethiopia", "kenya", "india", "china", "brazil", "tropical", "semi-arid", "arid", "monsoon"
]

PRACTICAL_TERMS = [
    "implementation", "management", "maintenance", "monitoring", "effectiveness", "performance",
    "design", "cost", "landowner", "farmer", "agricultural", "agriculture", "runoff",
    "field scale", "catchment scale", "policy", "governance", "community", "citizen science",
    "restoration", "habitat", "biodiversity", "water quality", "nutrient", "phosphorus",
    "nitrogen", "sediment", "suspended solids", "hydrology", "floodplain", "buffer",
    "riparian", "wetland", "constructed wetland", "integrated constructed wetland",
    "pond", "swale", "peatland", "saltmarsh", "estuary", "lagoon", "macroinvertebrate"
]

NBS_TERMS = [
    "nature-based", "nature based", "constructed wetland", "integrated constructed wetland",
    "riparian buffer", "buffer strip", "sediment pond", "retention pond", "wetland",
    "rewetting", "floodplain restoration", "river restoration", "re-meander", "remeander",
    "woody debris", "wet woodland", "hedgerow", "field margin"
]

EVIDENCE_TERMS = [
    "review", "systematic review", "meta-analysis", "meta analysis", "long-term",
    "long term", "field study", "case study", "before-after", "monitoring data"
]

BAD_TERMS = [
    "clinical", "human disease", "drinking water bottle", "desalination",
    "cryptocurrency", "marine plastic in the open ocean"
]

HEADERS = {
    "User-Agent": "NDRTWaterRadar/0.2 (+https://salmonofdoubt.github.io/demos/ndrt/news/)"
}

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def clean_text(value: Any, limit: int = 1000) -> str:
    text = str(value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()

def canonical_url(url: str) -> str:
    parsed = urlparse(url or "")
    return parsed._replace(fragment="", query=parsed.query).geturl()

def item_id(url: str, title: str) -> str:
    key = canonical_url(url) or title
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]

def abstract_from_inverted_index(index: dict[str, list[int]] | None) -> str:
    if not isinstance(index, dict) or not index:
        return ""

    positions = []
    for word, places in index.items():
        if not isinstance(places, list):
            continue
        for pos in places:
            if isinstance(pos, int):
                positions.append((pos, word))

    return " ".join(word for _, word in sorted(positions))[:1200]

def source_name(work: dict[str, Any]) -> str:
    return (
        work.get("primary_location", {})
        .get("source", {})
        .get("display_name")
    ) or "OpenAlex"

def best_url(work: dict[str, Any]) -> str:
    if work.get("doi"):
        return str(work["doi"])

    oa = work.get("best_oa_location") or {}
    return oa.get("landing_page_url") or oa.get("pdf_url") or work.get("id") or ""

def publication_year(work: dict[str, Any]) -> int | None:
    try:
        return int(work.get("publication_year"))
    except Exception:
        return None

def count_terms(text: str, terms: list[str]) -> int:
    return sum(1 for term in terms if term in text)

def geography_score(text: str) -> tuple[str, int]:
    ireland = count_terms(text, IRELAND_TERMS)
    comparable = count_terms(text, COMPARABLE_TERMS)
    distant = count_terms(text, DISTANT_CONTEXT_TERMS)

    if ireland:
        return "Ireland / direct relevance", 26 + ireland * 6
    if comparable:
        return "Comparable temperate relevance", 13 + comparable * 4
    if distant:
        return "Lower geographic transferability", -8 - distant * 3
    return "General transferable evidence", 0

def priority_bonus(priority: str) -> int:
    return {
        "ireland-direct": 16,
        "comparable-temperate": 8,
        "transferable-review": 4
    }.get(priority, 0)

def practical_fit_label(score: int, geography: str) -> str:
    if score >= 82:
        return f"High practical fit · {geography}"
    if score >= 68:
        return f"Useful practical evidence · {geography}"
    if score >= 50:
        return f"Background evidence · {geography}"
    return f"Low-priority evidence · {geography}"

def score_work(work: dict[str, Any], priority: str) -> tuple[int, str]:
    title = clean_text(work.get("display_name"), 350)
    abstract = abstract_from_inverted_index(work.get("abstract_inverted_index"))
    text = f"{title} {abstract}".lower()

    if any(term in text for term in BAD_TERMS):
        return 0, "Excluded as off-topic"

    score = 24
    geography, geo_points = geography_score(text)
    score += geo_points
    score += priority_bonus(priority)

    practical_count = count_terms(text, PRACTICAL_TERMS)
    nbs_count = count_terms(text, NBS_TERMS)
    evidence_count = count_terms(text, EVIDENCE_TERMS)

    score += practical_count * 5
    score += nbs_count * 7
    score += evidence_count * 6

    cited = int(work.get("cited_by_count") or 0)
    if cited:
        score += min(18, int(math.log10(cited + 1) * 9))

    year = publication_year(work)
    if year:
        age = now_utc().year - year
        if age <= 2:
            score += 8
        elif age <= 5:
            score += 6
        elif age <= 10:
            score += 3

    if (work.get("open_access") or {}).get("is_oa"):
        score += 5

    work_type = str(work.get("type") or "").lower()
    if work_type == "review":
        score += 8
    elif work_type == "article":
        score += 3

    # Do not let distant single-location studies dominate unless they are clearly transferable.
    if geography == "Lower geographic transferability" and evidence_count == 0 and nbs_count < 2:
        score -= 15

    # Avoid pure academic relevance with no operational use.
    if practical_count + nbs_count + evidence_count < 3:
        score -= 12

    return max(0, min(100, score)), geography

def fetch_query(search: str, theme: str, priority: str, tags: list[str]) -> list[dict[str, Any]]:
    params = {
        "search": search,
        "filter": f"from_publication_date:{FROM_PUBLICATION_DATE},is_retracted:false",
        "per-page": "35"
    }

    response = requests.get(OPENALEX_WORKS, params=params, headers=HEADERS, timeout=40)
    response.raise_for_status()
    payload = response.json()

    items = []

    for work in payload.get("results", []):
        title = clean_text(work.get("display_name"), 350)
        url = best_url(work)

        if not title or not url:
            continue

        abstract = abstract_from_inverted_index(work.get("abstract_inverted_index"))
        summary = abstract or "Open the source to inspect the abstract, journal, DOI, and publication metadata."

        score, geography = score_work(work, priority)
        if score < MIN_RESEARCH_SCORE:
            continue

        year = publication_year(work)
        published = work.get("publication_date") or (f"{year}-01-01" if year else None)
        cited = int(work.get("cited_by_count") or 0)
        oa = (work.get("open_access") or {}).get("is_oa")

        out_tags = list(tags)
        if oa:
            out_tags.append("open-access")
        if cited >= 50:
            out_tags.append("highly-cited")
        if "review" in title.lower() or "review" in summary.lower():
            out_tags.append("review")
        if geography.startswith("Ireland"):
            out_tags.append("ireland-first")
        elif geography.startswith("Comparable"):
            out_tags.append("temperate-transfer")
        elif geography.startswith("Lower"):
            out_tags.append("lower-transferability")

        items.append({
            "id": item_id(url, title),
            "title": title,
            "url": canonical_url(url),
            "summary": clean_text(summary, 950),
            "published": published,
            "source_id": "openalex",
            "source_name": source_name(work),
            "publisher": source_name(work),
            "section": "research-papers",
            "theme": theme,
            "tags": list(dict.fromkeys(out_tags))[:9],
            "score": score,
            "freshness_status": "reference",
            "freshness_label": f"{year or 'Year unknown'} · {cited} citations" + (" · open access" if oa else ""),
            "practical_fit": practical_fit_label(score, geography),
            "geographic_relevance": geography,
            "doi": work.get("doi"),
            "cited_by_count": cited,
            "openalex_id": work.get("id")
        })

    return items


RESEARCH_PRESSURE_RULES = {
    "water quality": ["water quality", "phosphorus", "phosphate", "nitrogen", "nitrate", "nutrient", "eutrophication"],
    "agricultural runoff": ["agricultural", "agriculture", "runoff", "farm", "field margin"],
    "sediment / hydromorphology": ["sediment", "suspended solids", "erosion", "hydromorphology", "channel"],
    "NbS / restoration": ["nature-based", "nature based", "constructed wetland", "riparian", "wetland", "river restoration", "floodplain"],
    "citizen science / monitoring": ["citizen science", "monitoring", "macroinvertebrate", "sampling", "field observation"],
    "estuary / lagoon": ["estuary", "lagoon", "saltmarsh", "coastal wetland"],
    "habitat / biodiversity": ["biodiversity", "habitat", "species", "ecology"]
}

def research_pressure_categories(text: str) -> list[str]:
    out = []
    for label, terms in RESEARCH_PRESSURE_RULES.items():
        if any(term in text for term in terms):
            out.append(label)
    return out[:5] or ["research evidence"]

def research_use_type(text: str) -> str:
    if "systematic review" in text or "meta-analysis" in text or "meta analysis" in text or "review" in text:
        return "Review / evidence synthesis"
    if "citizen science" in text or "macroinvertebrate" in text or "monitoring" in text:
        return "Monitoring method"
    if "constructed wetland" in text or "riparian" in text or "nature-based" in text or "nature based" in text:
        return "NbS effectiveness"
    if "policy" in text or "governance" in text or "water framework directive" in text or "wfd" in text:
        return "Policy / governance"
    if "case study" in text or "field study" in text:
        return "Case / field evidence"
    return "Supporting evidence"

def research_action_relevance(text: str, geography: str, pressures: list[str], use_type: str) -> str:
    pressure_text = ", ".join(pressures[:3])

    if geography.startswith("Ireland"):
        return f"Ireland-first evidence: use this to support Trust decisions, engagement, or methods around {pressure_text}."
    if geography.startswith("Comparable"):
        return f"Comparable-system evidence: useful where Nanny-Delvin needs transferable practice for {pressure_text}."
    if use_type == "Review / evidence synthesis":
        return f"Evidence synthesis: useful for explaining why an intervention or monitoring approach is defensible for {pressure_text}."
    if use_type == "NbS effectiveness":
        return f"NbS evidence: potentially useful for selecting or justifying measures that improve water quality through {pressure_text}."
    if use_type == "Monitoring method":
        return f"Monitoring evidence: potentially useful for Nanny Watch protocols, volunteer training, or interpreting field observations."
    return f"Research signal: background evidence that may support practical catchment action around {pressure_text}."

def annotate_research_item(item: dict[str, Any]) -> dict[str, Any]:
    text = " ".join([
        str(item.get("title", "")),
        str(item.get("summary", "")),
        " ".join(item.get("tags", []) if isinstance(item.get("tags"), list) else [])
    ]).lower()

    pressures = research_pressure_categories(text)
    use_type = research_use_type(text)
    geography = item.get("geographic_relevance", "General transferable evidence")

    item["pressure_categories"] = pressures
    item["research_use_type"] = use_type
    item["action_relevance"] = research_action_relevance(text, geography, pressures, use_type)

    return item


def load_latest() -> dict[str, Any]:
    if not LATEST.exists():
        return {"generated_at": now_utc().isoformat(), "note": "", "sections": [], "count": 0, "items": []}
    return json.loads(LATEST.read_text(encoding="utf-8"))

def ensure_research_section(data: dict[str, Any]) -> None:
    sections = data.get("sections") if isinstance(data.get("sections"), list) else []
    sections = [s for s in sections if s.get("id") != "research-papers"]
    sections.append(RESEARCH_SECTION)
    data["sections"] = sections

def update_archive(data: dict[str, Any]) -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    stamp = now_utc().date().isoformat()
    snapshot_name = f"{stamp}.json"
    (ARCHIVE / snapshot_name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if INDEX.exists():
        try:
            index = json.loads(INDEX.read_text(encoding="utf-8"))
        except Exception:
            index = {"snapshots": []}
    else:
        index = {"snapshots": []}

    snapshots = [s for s in index.get("snapshots", []) if s.get("date") != stamp]
    snapshots.insert(0, {
        "date": stamp,
        "path": f"data/archive/{snapshot_name}",
        "count": data.get("count", 0),
        "generated_at": data.get("generated_at")
    })

    INDEX.write_text(json.dumps({
        "generated_at": now_utc().isoformat(),
        "snapshots": snapshots[:180]
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def main() -> None:
    data = load_latest()
    ensure_research_section(data)

    non_research = [item for item in data.get("items", []) if item.get("section") != "research-papers"]

    found = []
    for search, theme, priority, tags in QUERIES:
        try:
            batch = fetch_query(search, theme, priority, tags)
            print(f"{len(batch):02d} research items :: {search}")
            found.extend(batch)
        except Exception as exc:
            print(f"OpenAlex query failed: {search} :: {exc}")

    deduped = []
    seen = set()

    for item in found:
        key = canonical_url(item.get("url", "")) or item.get("id")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    deduped.sort(
        key=lambda item: (
            2 if "ireland-first" in item.get("tags", []) else 1 if "temperate-transfer" in item.get("tags", []) else 0,
            int(item.get("score", 0)),
            int(item.get("cited_by_count", 0)),
            item.get("published") or ""
        ),
        reverse=True
    )

    research = [annotate_research_item(item) for item in deduped[:MAX_RESEARCH_ITEMS]]

    data["items"] = non_research + research
    data["items"].sort(key=lambda item: (int(item.get("score", 0)), item.get("published") or ""), reverse=True)
    data["count"] = len(data["items"])
    data["generated_at"] = now_utc().isoformat()
    data["note"] = (
        "Source-led daily radar for Nanny-Delvin: practical Irish catchment signals, "
        "waterbody evidence/alerts, grants/opportunities, and research ranked by Trust usefulness."
    )

    LATEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    update_archive(data)

    print(f"Rebuilt research lane with {len(research)} practical research items.")
    print(f"Wrote {LATEST} with {data['count']} total items.")

if __name__ == "__main__":
    main()
