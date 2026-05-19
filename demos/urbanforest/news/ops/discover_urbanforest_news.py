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

ROOT = Path("demos/urbanforest/news")
DATA = ROOT / "data"
ARCHIVE = DATA / "archive"
REGISTRY = DATA / "source-registry.json"
LATEST = DATA / "news.json"
INDEX = ARCHIVE / "index.json"
CURATED = DATA / "curated-items.json"

MAX_ITEMS = 40
MIN_SCORE = 24
CURRENT_WINDOW_DAYS = 60

HEADERS = {
    "User-Agent": "UrbanForestNewsRadar/0.1 (+https://salmonofdoubt.github.io/demos/urbanforest/news/)"
}

CORE_PATTERNS = [
    r"\burban forest\b",
    r"\bpocket forest\b",
    r"\btiny forest\b",
    r"\bmicro forest\b",
    r"\bmini forest\b",
    r"\bmiyawaki\b",
    r"\bcampus forest\b",
    r"\bcommunity forest\b",
    r"\burban woodland\b",
    r"\bnative planting\b",
    r"\bnature-based\b",
]

THEMES = {
    "urban-forest": ["urban forest", "urban woodland", "campus forest", "urban tree", "urban greening"],
    "pocket-forest": ["pocket forest", "micro forest", "mini forest"],
    "miyawaki": ["miyawaki"],
    "biodiversity": ["biodiversity", "pollinator", "habitat", "species", "ecology", "native"],
    "wellbeing": ["wellbeing", "mental health", "social", "community", "school", "children", "learning"],
    "maintenance": ["maintenance", "survival", "watering", "mulch", "monitoring", "aftercare"],
    "funding-policy": ["funding", "grant", "policy", "strategy", "council", "local authority"],
}

GOOD_TERMS = {
    "implementation": 10,
    "maintenance": 9,
    "monitoring": 9,
    "biodiversity": 9,
    "wellbeing": 8,
    "community": 8,
    "school": 6,
    "campus": 8,
    "native": 7,
    "planting": 6,
    "survival": 8,
    "case study": 10,
    "evidence": 8,
    "research": 7,
    "funding": 8,
    "grant": 8,
    "Ireland": 10,
    "Dublin": 8,
    "Europe": 4,
}

BAD_TERMS = [
    "amazon rainforest",
    "forest fire",
    "wildfire",
    "logging",
    "deforestation",
    "stock market",
    "football",
    "film",
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


def clean_text(value: Any, limit: int = 500) -> str:
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
        date = date_parser.parse(iso_date).date()
        return (now_utc().date() - date).days
    except Exception:
        return None


def matches_core(text: str) -> bool:
    lowered = text.lower()

    if any(re.search(pattern, lowered) for pattern in CORE_PATTERNS):
        return True

    if "forest" in lowered and any(term in lowered for term in ["urban", "school", "campus", "community", "native", "biodiversity"]):
        return True

    return False


def infer_theme(text: str) -> str:
    lowered = text.lower()

    best_theme = "urban-forest"
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

    return tags[:6] or ["urban-forest"]


def score_item(item: RawItem) -> tuple[int, str, str, list[str]]:
    text = f"{item.title} {item.summary}"
    lowered = text.lower()

    if any(term in lowered for term in BAD_TERMS):
        return 0, "reference", "Excluded as likely off-topic.", []

    if not matches_core(text):
        return 0, "reference", "No strong urban/pocket/Miyawaki forest signal detected.", []

    score = 20

    for pattern in CORE_PATTERNS:
        if re.search(pattern, lowered):
            score += 12

    for term, points in GOOD_TERMS.items():
        if term.lower() in lowered:
            score += points

    trust = float(item.source.get("trust", 0.65))
    score += int(trust * 10)

    scope = item.source.get("scope", "")
    if "ireland" in scope:
        score += 10
    elif "institutional" in scope:
        score += 7
    elif "practice" in scope:
        score += 6

    days = age_days(item.published)

    if days is None:
        freshness_status = "reference"
        freshness_label = "Date unknown"
        score -= 6
    elif days <= CURRENT_WINDOW_DAYS:
        freshness_status = "fresh"
        freshness_label = f"{days} days old"
    else:
        freshness_status = "reference"
        freshness_label = f"{days} days old · background"
        score -= min(22, int(days / 30) * 4)

    score = max(0, min(100, score))
    return score, freshness_status, freshness_label, tags_for(text)


def fetch_rss(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()

    feed = feedparser.parse(response.content)
    items: list[RawItem] = []

    for entry in feed.entries[:30]:
        title = clean_text(entry.get("title"), 240)
        url = entry.get("link") or ""
        summary = clean_text(entry.get("summary") or entry.get("description"), 700)
        published = parse_date(entry.get("published") or entry.get("updated"))

        if title and url:
            items.append(RawItem(title=title, url=url, summary=summary, published=published, source=source))

    return items


def fetch_page(source: dict[str, Any]) -> list[RawItem]:
    response = requests.get(source["url"], headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    items: list[RawItem] = []

    for link in soup.select("a[href]")[:180]:
        title = clean_text(link.get_text(" "), 220)
        href = link.get("href")
        if not title or not href:
            continue

        if len(title) < 18:
            continue

        url = urljoin(source["url"], href)

        if not url.startswith("http"):
            continue

        surrounding = clean_text(link.parent.get_text(" ") if link.parent else title, 700)
        published = None

        date_match = re.search(r"\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Z][a-z]+\s+20\d{2})\b", surrounding)
        if date_match:
            published = parse_date(date_match.group(1))

        items.append(RawItem(title=title, url=url, summary=surrounding, published=published, source=source))

    return items


def registry_sections(registry: dict[str, Any]) -> list[dict[str, Any]]:
    return registry.get("sections", [])




def load_curated_items() -> list[dict[str, Any]]:
    if not CURATED.exists():
        return []

    try:
        payload = json.loads(CURATED.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Curated item file failed: {exc}")
        return []

    items = payload.get("items", [])
    clean_items: list[dict[str, Any]] = []

    for item in items:
        if not item.get("title") or not item.get("url"):
            continue

        clean_items.append({
            "id": item.get("id") or item_id(item["url"], item["title"]),
            "title": clean_text(item.get("title"), 240),
            "url": canonical_url(item.get("url", "")),
            "summary": clean_text(item.get("summary"), 900),
            "published": item.get("published"),
            "source_id": item.get("source_id", "curated"),
            "source_name": item.get("source_name", "Curated reference"),
            "publisher": item.get("publisher", item.get("source_name", "Curated reference")),
            "section": item.get("section", "research-evidence"),
            "theme": item.get("theme", "urban-forest"),
            "tags": item.get("tags", ["curated"]),
            "score": int(item.get("score", 90)),
            "freshness_status": item.get("freshness_status", "reference"),
            "freshness_label": item.get("freshness_label", "Curated reference"),
        })

    return clean_items


def discover() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    sections = registry_sections(registry)
    seen: set[str] = set()
    results: list[dict[str, Any]] = []

    for source in registry.get("sources", []):
        try:
            if source.get("type") == "rss":
                raw_items = fetch_rss(source)
            else:
                raw_items = fetch_page(source)
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

            results.append({
                "id": uid,
                "title": raw.title,
                "url": canonical_url(raw.url),
                "summary": raw.summary,
                "published": raw.published,
                "source_id": raw.source.get("id"),
                "source_name": raw.source.get("name"),
                "publisher": raw.source.get("name"),
                "section": raw.source.get("section", "ireland-practice"),
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

    index = {
        "generated_at": now_utc().isoformat(),
        "snapshots": snapshots[:180],
    }

    INDEX.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)

    discovered_items, sections = discover()
    curated_items = load_curated_items()

    seen_ids = set()
    items = []

    for item in curated_items + discovered_items:
        uid = item.get("id") or item_id(item.get("url", ""), item.get("title", ""))
        if uid in seen_ids:
            continue
        seen_ids.add(uid)
        items.append(item)

    items.sort(key=lambda item: (int(item.get("score", 0)), item.get("published") or ""), reverse=True)

    latest = {
        "generated_at": now_utc().isoformat(),
        "note": "Source-led daily radar organised into Irish practice, comparable temperate-city examples, and research evidence.",
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
