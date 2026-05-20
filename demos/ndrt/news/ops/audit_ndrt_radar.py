#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup

ROOT = Path("demos/ndrt/news")
DATA = ROOT / "data"
REGISTRY = DATA / "source-registry.json"
LATEST = DATA / "news.json"
ARCHIVE_INDEX = DATA / "archive" / "index.json"
SOURCE_HEALTH = DATA / "source-health.json"
WEEKLY_DIGEST = DATA / "weekly-digest.json"

HEADERS = {
    "User-Agent": "NDRTWaterRadarAudit/0.1 (+https://salmonofdoubt.github.io/demos/ndrt/news/)"
}

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback

def host(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return ""

def item_section(item: dict[str, Any]) -> str:
    return item.get("section") or item.get("section_id") or "unknown"

def practical_score(item: dict[str, Any]) -> float:
    score = float(item.get("score") or 0)

    if item.get("action_relevance"):
        score += 10

    pressures = item.get("pressure_categories") if isinstance(item.get("pressure_categories"), list) else []
    local = item.get("local_relevance") if isinstance(item.get("local_relevance"), dict) else {}
    opportunity = item.get("opportunity_fit") if isinstance(item.get("opportunity_fit"), dict) else {}

    pressure_boosts = {
        "septic / domestic wastewater": 9,
        "manure / slurry timing": 9,
        "incident / alert": 8,
        "NbS / restoration": 7,
        "citizen science / monitoring": 7,
        "invasive species": 7,
        "river ecology": 7,
        "birds / wetland ecology": 6,
        "agricultural runoff": 8,
        "nutrients": 8,
        "sediment / hydromorphology": 7,
    }

    for pressure in pressures:
        score += pressure_boosts.get(pressure, 3)

    if local.get("score", 0) >= 45:
        score += 14
    elif local.get("score", 0) >= 20:
        score += 8
    elif local.get("label") == "Ireland-wide relevance":
        score += 5

    if opportunity.get("fit") == "High":
        score += 14
    elif opportunity.get("fit") == "Medium":
        score += 7

    if item.get("freshness_status") == "fresh":
        score += 8

    if item.get("section") == "research-papers":
        score -= 4
        if item.get("research_use_type") in {
            "Review / evidence synthesis",
            "NbS effectiveness",
            "Monitoring method",
            "Policy / governance"
        }:
            score += 8

    return score

def fetch_source_status(source: dict[str, Any], current_count: int) -> dict[str, Any]:
    started = time.time()
    url = source.get("url", "")
    status_code = None
    discovered_hint = 0
    error = None

    try:
        response = requests.get(url, headers=HEADERS, timeout=25)
        status_code = response.status_code
        ok = 200 <= status_code < 400

        if ok and source.get("type") == "rss":
            feed = feedparser.parse(response.content)
            discovered_hint = len(feed.entries or [])
        elif ok:
            soup = BeautifulSoup(response.text, "html.parser")
            discovered_hint = len(soup.select("a[href]"))

    except Exception as exc:
        ok = False
        error = str(exc)[:240]

    elapsed_ms = int((time.time() - started) * 1000)

    if not ok:
        label = "failed"
    elif current_count > 0:
        label = "active"
    else:
        label = "checked-no-current-items"

    return {
        "id": source.get("id"),
        "name": source.get("name"),
        "type": source.get("type"),
        "section": source.get("section"),
        "scope": source.get("scope"),
        "url": url,
        "host": host(url),
        "status": label,
        "http_status": status_code,
        "current_item_count": current_count,
        "discovered_hint_count": discovered_hint,
        "elapsed_ms": elapsed_ms,
        "error": error,
    }

def build_source_health() -> dict[str, Any]:
    registry = load_json(REGISTRY, {"sources": [], "sections": []})
    latest = load_json(LATEST, {"items": [], "sections": []})
    archive = load_json(ARCHIVE_INDEX, {"snapshots": []})

    items = latest.get("items", [])
    sources = registry.get("sources", [])

    item_count_by_source: dict[str, int] = {}
    item_count_by_section: dict[str, int] = {}

    for item in items:
        source_id = item.get("source_id") or "unknown"
        item_count_by_source[source_id] = item_count_by_source.get(source_id, 0) + 1

        section = item_section(item)
        item_count_by_section[section] = item_count_by_section.get(section, 0) + 1

    source_statuses = [
        fetch_source_status(source, item_count_by_source.get(source.get("id"), 0))
        for source in sources
    ]

    annotations = {
        "action_relevance": sum(1 for item in items if item.get("action_relevance")),
        "pressure_categories": sum(1 for item in items if item.get("pressure_categories")),
        "local_relevance": sum(1 for item in items if item.get("local_relevance")),
        "opportunity_fit": sum(1 for item in items if item.get("opportunity_fit")),
        "research_use_type": sum(1 for item in items if item.get("research_use_type")),
    }

    return {
        "generated_at": now_utc(),
        "latest_generated_at": latest.get("generated_at"),
        "total_items": len(items),
        "total_sources": len(sources),
        "sources_active": sum(1 for s in source_statuses if s["status"] == "active"),
        "sources_checked_no_current_items": sum(1 for s in source_statuses if s["status"] == "checked-no-current-items"),
        "sources_failed": sum(1 for s in source_statuses if s["status"] == "failed"),
        "items_by_section": item_count_by_section,
        "annotation_coverage": annotations,
        "archive_snapshots": len(archive.get("snapshots", [])),
        "sources": source_statuses,
    }

def build_weekly_digest() -> dict[str, Any]:
    latest = load_json(LATEST, {"items": [], "sections": []})
    items = latest.get("items", [])

    lane_counts: dict[str, int] = {}
    pressure_counts: dict[str, int] = {}

    for item in items:
        lane_counts[item_section(item)] = lane_counts.get(item_section(item), 0) + 1

        pressures = item.get("pressure_categories") if isinstance(item.get("pressure_categories"), list) else []
        for pressure in pressures:
            pressure_counts[pressure] = pressure_counts.get(pressure, 0) + 1

    ranked = sorted(items, key=practical_score, reverse=True)

    digest_items = []
    for item in ranked[:10]:
        digest_items.append({
            "id": item.get("id"),
            "title": item.get("title"),
            "url": item.get("url"),
            "section": item.get("section"),
            "source_name": item.get("source_name"),
            "published": item.get("published"),
            "score": item.get("score"),
            "practical_score": round(practical_score(item), 1),
            "freshness_label": item.get("freshness_label"),
            "pressure_categories": item.get("pressure_categories", []),
            "local_relevance": item.get("local_relevance"),
            "opportunity_fit": item.get("opportunity_fit"),
            "research_use_type": item.get("research_use_type"),
            "action_relevance": item.get("action_relevance"),
        })

    top_pressures = sorted(
        pressure_counts.items(),
        key=lambda kv: kv[1],
        reverse=True
    )[:12]

    return {
        "generated_at": now_utc(),
        "latest_generated_at": latest.get("generated_at"),
        "title": "NDRT weekly practical digest",
        "summary": "Top practical signals ranked for Nanny-Delvin Rivers Trust action, monitoring, engagement, funding, and evidence use.",
        "lane_counts": lane_counts,
        "top_pressure_categories": [
            {"pressure": pressure, "count": count}
            for pressure, count in top_pressures
        ],
        "items": digest_items,
    }

def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)

    health = build_source_health()
    digest = build_weekly_digest()

    SOURCE_HEALTH.write_text(json.dumps(health, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    WEEKLY_DIGEST.write_text(json.dumps(digest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {SOURCE_HEALTH}")
    print(f"Wrote {WEEKLY_DIGEST}")
    print(f"Sources: {health['sources_active']} active, {health['sources_failed']} failed, {health['sources_checked_no_current_items']} checked-no-current-items")
    print(f"Digest items: {len(digest['items'])}")

if __name__ == "__main__":
    main()
