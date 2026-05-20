#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path("demos/urbanforest/news")
DATA = ROOT / "data"
REGISTRY = DATA / "source-registry.json"
LATEST = DATA / "news.json"
ARCHIVE_INDEX = DATA / "archive" / "index.json"
SOURCE_HEALTH = DATA / "source-health.json"
WEEKLY_DIGEST = DATA / "weekly-digest.json"

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback

def section(item: dict[str, Any]) -> str:
    return item.get("section") or "unknown"

def practical_score(item: dict[str, Any]) -> float:
    score = float(item.get("score") or 0)
    if item.get("urbanforest_relevance"):
        score += 10
    if item.get("opportunity_fit", {}).get("fit") == "High":
        score += 14
    if item.get("local_relevance", {}).get("score", 0) >= 50:
        score += 14
    elif item.get("local_relevance", {}).get("score", 0) >= 24:
        score += 8
    if item.get("freshness_status") == "fresh":
        score += 6
    benefits = item.get("benefit_categories") if isinstance(item.get("benefit_categories"), list) else []
    for benefit in benefits:
        if benefit in ["Tree survival / maintenance", "Funding / grants", "Stormwater / SuDS", "Urban heat / shade"]:
            score += 7
        elif benefit in ["Biodiversity / habitat", "Monitoring / evaluation", "Community stewardship"]:
            score += 5
    return score

def build_health() -> dict[str, Any]:
    registry = load_json(REGISTRY, {"sources": [], "sections": []})
    latest = load_json(LATEST, {"items": []})
    archive = load_json(ARCHIVE_INDEX, {"snapshots": []})
    items = latest.get("items", [])
    sources = registry.get("sources", [])

    by_source = {}
    by_section = {}
    for item in items:
        by_source[item.get("source_id", "unknown")] = by_source.get(item.get("source_id", "unknown"), 0) + 1
        by_section[section(item)] = by_section.get(section(item), 0) + 1

    source_rows = []
    for source in sources:
        count = by_source.get(source.get("id"), 0)
        source_rows.append({
            "id": source.get("id"),
            "name": source.get("name"),
            "type": source.get("type"),
            "section": source.get("section"),
            "scope": source.get("scope"),
            "url": source.get("url"),
            "host": urlparse(source.get("url", "")).netloc,
            "status": "active" if count else "checked-no-current-items",
            "current_item_count": count
        })

    return {
        "generated_at": now_utc(),
        "latest_generated_at": latest.get("generated_at"),
        "total_items": len(items),
        "total_sources": len(sources),
        "sources_active": sum(1 for s in source_rows if s["status"] == "active"),
        "sources_checked_no_current_items": sum(1 for s in source_rows if s["status"] == "checked-no-current-items"),
        "sources_failed": 0,
        "items_by_section": by_section,
        "annotation_coverage": {
            "urbanforest_relevance": sum(1 for i in items if i.get("urbanforest_relevance")),
            "benefit_categories": sum(1 for i in items if i.get("benefit_categories")),
            "local_relevance": sum(1 for i in items if i.get("local_relevance")),
            "opportunity_fit": sum(1 for i in items if i.get("opportunity_fit")),
            "research_use_type": sum(1 for i in items if i.get("research_use_type"))
        },
        "archive_snapshots": len(archive.get("snapshots", [])),
        "sources": source_rows
    }

def build_digest() -> dict[str, Any]:
    latest = load_json(LATEST, {"items": []})
    items = latest.get("items", [])

    lane_counts = {}
    benefit_counts = {}
    for item in items:
        lane_counts[section(item)] = lane_counts.get(section(item), 0) + 1
        for benefit in item.get("benefit_categories", []) if isinstance(item.get("benefit_categories"), list) else []:
            benefit_counts[benefit] = benefit_counts.get(benefit, 0) + 1

    ranked = sorted(items, key=practical_score, reverse=True)[:10]

    return {
        "generated_at": now_utc(),
        "latest_generated_at": latest.get("generated_at"),
        "title": "UrbanForest weekly practical digest",
        "summary": "Top practical signals for urban forest and urban NbS delivery, funding, evidence, maintenance, and communication.",
        "lane_counts": lane_counts,
        "top_benefit_categories": [{"benefit": k, "count": v} for k, v in sorted(benefit_counts.items(), key=lambda kv: kv[1], reverse=True)[:12]],
        "items": [{
            "id": item.get("id"),
            "title": item.get("title"),
            "url": item.get("url"),
            "section": item.get("section"),
            "source_name": item.get("source_name"),
            "published": item.get("published"),
            "score": item.get("score"),
            "practical_score": round(practical_score(item), 1),
            "benefit_categories": item.get("benefit_categories", []),
            "local_relevance": item.get("local_relevance"),
            "opportunity_fit": item.get("opportunity_fit"),
            "research_use_type": item.get("research_use_type"),
            "urbanforest_relevance": item.get("urbanforest_relevance")
        } for item in ranked]
    }

def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    health = build_health()
    digest = build_digest()
    SOURCE_HEALTH.write_text(json.dumps(health, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    WEEKLY_DIGEST.write_text(json.dumps(digest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {SOURCE_HEALTH}")
    print(f"Wrote {WEEKLY_DIGEST}")

if __name__ == "__main__":
    main()
