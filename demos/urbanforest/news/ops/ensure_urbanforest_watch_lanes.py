#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path("demos/urbanforest/news")
DATA = ROOT / "data"
NEWS = DATA / "news.json"
ARCHIVE = DATA / "archive"
ARCHIVE_INDEX = ARCHIVE / "index.json"

SECTION_ALIASES = {
    "ireland-practice": "ireland-urban-forest-practice",
    "temperate-practice": "transferable-urbanforest-practice",
    "urban-nbs-implementation": "transferable-urbanforest-practice",
    "research-evidence": "research-evidence",
    "funding-policy": "funding-opportunities",
    "maintenance": "design-maintenance-risk",
}

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
        "description": "Grants, schemes, calls, awards, and practical funding routes for planting, monitoring, maintenance, schools, communities, campuses, and biodiversity."
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

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def clean_text(value: Any, limit: int = 900) -> str:
    text = str(value or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()

def canonical_url(url: str) -> str:
    parsed = urlparse(url or "")
    return parsed._replace(fragment="", query=parsed.query).geturl()

def item_id(url: str, title: str) -> str:
    key = canonical_url(url) or title
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]

def normalise_section(value: str | None) -> str:
    if not value:
        return "ireland-urban-forest-practice"
    return SECTION_ALIASES.get(value, value)

def make_item(
    section: str,
    source_id: str,
    source_name: str,
    url: str,
    title: str,
    summary: str,
    score: int,
    benefits: list[str],
    relevance: str,
    opportunity: dict[str, Any] | None = None,
) -> dict[str, Any]:
    theme = "funding-grants" if section == "funding-opportunities" else "tree-survival-maintenance"

    item = {
        "id": item_id(url, title),
        "title": title,
        "url": canonical_url(url),
        "summary": clean_text(summary),
        "published": None,
        "source_id": source_id,
        "source_name": source_name,
        "publisher": source_name,
        "section": section,
        "theme": theme,
        "tags": ["watch-source", "operational-baseline", theme],
        "score": score,
        "freshness_status": "reference",
        "freshness_label": "Operational watch source",
        "benefit_categories": benefits,
        "local_relevance": {
            "score": 18,
            "label": "Moderate Ireland relevance",
            "matched_terms": ["ireland"]
        },
        "transfer_relevance": "Ireland / Dublin first",
        "urbanforest_relevance": relevance,
    }

    if opportunity:
        item["opportunity_fit"] = opportunity

    return item

def baseline_items() -> list[dict[str, Any]]:
    funding_opportunity = {
        "fit": "Watch source",
        "score": 65,
        "eligible_hint": "Check fit for schools, community groups, universities, local authorities, NGOs, biodiversity projects, monitoring, maintenance, or education.",
        "action_needed": "Check deadline, lead applicant, eligible costs, match funding, and whether planting aftercare or monitoring can be funded."
    }

    return [
        make_item(
            section="funding-opportunities",
            source_id="baseline-heritage-council-funding",
            source_name="Heritage Council Funding",
            url="https://www.heritagecouncil.ie/funding",
            title="Funding watch: Heritage Council funding",
            summary="Baseline UrbanForest funding watch source. Check for grants that may support community biodiversity, school greening, local heritage, tree planting, education, monitoring, maintenance, and practical UrbanForest delivery. This card does not claim a specific grant is open today.",
            score=66,
            benefits=["Funding / grants", "Biodiversity / habitat", "School / education", "Community stewardship"],
            relevance="Funding watch signal: useful because UrbanForest delivery needs routes for planting, monitoring, education, community stewardship, and aftercare rather than one-off launch funding.",
            opportunity=funding_opportunity,
        ),
        make_item(
            section="funding-opportunities",
            source_id="baseline-community-foundation-ireland",
            source_name="Community Foundation Ireland",
            url="https://www.communityfoundation.ie/grants/",
            title="Funding watch: Community Foundation Ireland grants",
            summary="Baseline community and biodiversity funding watch source. Check for funding routes that could support community greening, school/community planting, local biodiversity, monitoring, education, stewardship, or maintenance connected to UrbanForest delivery.",
            score=64,
            benefits=["Funding / grants", "Community stewardship", "Biodiversity / habitat"],
            relevance="Community funding watch signal: useful for finding small-scale support routes for stewardship, local biodiversity, education, monitoring, and practical UrbanForest maintenance.",
            opportunity=funding_opportunity,
        ),
        make_item(
            section="funding-opportunities",
            source_id="baseline-eu-life-calls",
            source_name="EU LIFE Calls",
            url="https://cinea.ec.europa.eu/programmes/life/calls-proposals_en",
            title="Funding watch: EU LIFE calls",
            summary="Baseline European funding watch source. Check selectively for biodiversity, climate, urban greening, nature restoration, or nature-based solution calls where an UrbanForest project could contribute as a demonstration, monitoring, education, or implementation component.",
            score=60,
            benefits=["Funding / grants", "Planning / policy", "Monitoring / evaluation"],
            relevance="European funding watch signal: useful for larger UrbanForest demonstration, monitoring, biodiversity, climate-adaptation, or education components when a suitable consortium or lead applicant exists.",
            opportunity=funding_opportunity,
        ),
        make_item(
            section="design-maintenance-risk",
            source_id="baseline-urbanforest-maintenance",
            source_name="UrbanForest maintenance watch",
            url="https://news.google.com/search?q=urban%20trees%20watering%20survival%20maintenance%20aftercare%20soil%20drought",
            title="Design and maintenance watch: tree survival, watering, aftercare, and soil",
            summary="Baseline UrbanForest design and maintenance watch. Inspect this lane for tree survival, watering, drought stress, young-tree establishment, soil care, mulch, replacement planting, aftercare, vandalism, and long-term stewardship. Urban forests fail quietly after launch when these risks are not funded and managed.",
            score=64,
            benefits=["Tree survival / maintenance", "Soil health", "Community stewardship", "Risk / safety"],
            relevance="Maintenance watch signal: useful because UrbanForest success depends on watering, aftercare, soil care, replacement planting, and stewardship during the non-photogenic years after planting.",
        ),
        make_item(
            section="design-maintenance-risk",
            source_id="baseline-carbon-claims-risk",
            source_name="UrbanForest claims-risk watch",
            url="https://news.google.com/search?q=urban%20tree%20planting%20carbon%20claims%20survival%20maintenance%20greenwashing",
            title="Design and risk watch: weak carbon claims and survival evidence",
            summary="Baseline claims-risk watch. Useful for keeping UrbanForest communication grounded in survival, biodiversity, shade, wellbeing, soil, monitoring, and stewardship rather than overclaiming short-term carbon benefits before establishment and survival are known.",
            score=58,
            benefits=["Carbon / climate claims", "Tree survival / maintenance", "Monitoring / evaluation"],
            relevance="Claims-risk signal: useful for keeping UrbanForest communication credible by avoiding weak carbon claims and foregrounding survival, biodiversity, cooling, wellbeing, soil, and monitoring.",
        ),
    ]


def transferable_baseline_items() -> list[dict[str, Any]]:
    items = [
        make_item(
            section="transferable-urbanforest-practice",
            source_id="baseline-tiny-forest-temperate-practice",
            source_name="Tiny Forest temperate practice watch",
            url="https://news.google.com/search?q=%22tiny%20forest%22%20OR%20%22pocket%20forest%22%20Miyawaki%20UK%20Netherlands%20Europe",
            title="Transferable practice watch: tiny forests, pocket forests, and Miyawaki examples",
            summary=(
                "Baseline transferable UrbanForest practice watch. Use this to compare small urban forest, "
                "tiny forest, pocket forest, and Miyawaki-style practice from comparable temperate cities. "
                "Useful for design choices, monitoring ideas, community stewardship, and maintenance lessons."
            ),
            score=62,
            benefits=["Biodiversity / habitat", "Community stewardship", "Tree survival / maintenance", "Monitoring / evaluation"],
            relevance="Transferable practice signal: useful for learning from comparable temperate urban forest projects without turning the radar into a generic urban NbS feed.",
        ),
        make_item(
            section="transferable-urbanforest-practice",
            source_id="baseline-trees-for-cities-practice",
            source_name="Trees for Cities",
            url="https://www.treesforcities.org/stories",
            title="Transferable practice watch: Trees for Cities stories",
            summary=(
                "Baseline transferable UrbanForest practice source. Check for street-tree, school, community, "
                "urban greening, stewardship, maintenance, and delivery lessons that may transfer to Irish "
                "UrbanForest practice."
            ),
            score=60,
            benefits=["Community stewardship", "School / education", "Tree survival / maintenance", "Biodiversity / habitat"],
            relevance="Transferable practice signal: useful because comparable urban tree and community greening stories can inform UrbanForest delivery, maintenance, and communication.",
        ),
    ]

    for item in items:
        item["local_relevance"] = {
            "score": 0,
            "label": "Transferable relevance",
            "matched_terms": []
        }
        item["transfer_relevance"] = "Comparable temperate city"

    return items


def write_archive(latest: dict[str, Any]) -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    stamp = now_utc().date().isoformat()
    snapshot = ARCHIVE / f"{stamp}.json"
    snapshot.write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if ARCHIVE_INDEX.exists():
        try:
            index = json.loads(ARCHIVE_INDEX.read_text(encoding="utf-8"))
        except Exception:
            index = {"snapshots": []}
    else:
        index = {"snapshots": []}

    snapshots = [entry for entry in index.get("snapshots", []) if entry.get("date") != stamp]
    snapshots.insert(0, {
        "date": stamp,
        "path": f"data/archive/{stamp}.json",
        "count": latest.get("count", 0),
        "generated_at": latest.get("generated_at"),
    })

    ARCHIVE_INDEX.write_text(json.dumps({
        "generated_at": now_utc().isoformat(),
        "snapshots": snapshots[:180],
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def main() -> None:
    if not NEWS.exists():
        raise SystemExit(f"Missing {NEWS}. Run discover_urbanforest_news.py first.")

    latest = json.loads(NEWS.read_text(encoding="utf-8"))
    items = latest.get("items", [])

    for item in items:
        item["section"] = normalise_section(item.get("section"))

    latest["sections"] = CANONICAL_SECTIONS

    counts = {}
    for item in items:
        counts[item["section"]] = counts.get(item["section"], 0) + 1

    required_minimums = {
        "transferable-urbanforest-practice": 2,
        "funding-opportunities": 3,
        "design-maintenance-risk": 2,
    }

    existing_keys = {canonical_url(item.get("url", "")) or item.get("id") for item in items}

    for baseline in baseline_items() + transferable_baseline_items():
        lane = baseline["section"]
        if counts.get(lane, 0) >= required_minimums[lane]:
            continue

        key = canonical_url(baseline.get("url", "")) or baseline.get("id")
        if key in existing_keys:
            continue

        items.append(baseline)
        existing_keys.add(key)
        counts[lane] = counts.get(lane, 0) + 1

    items.sort(key=lambda item: (
        1 if item.get("section") == "ireland-urban-forest-practice" else 0,
        int(item.get("score", 0)),
        item.get("published") or ""
    ), reverse=True)

    latest["items"] = items
    latest["count"] = len(items)
    latest["postprocessed_at"] = now_utc().isoformat()
    latest["note"] = "Practical UrbanForest radar with guaranteed funding and design/maintenance watch lanes."

    NEWS.write_text(json.dumps(latest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_archive(latest)

    print("Ensured UrbanForest operational watch lanes.")
    print("Final counts:", counts)

if __name__ == "__main__":
    main()
