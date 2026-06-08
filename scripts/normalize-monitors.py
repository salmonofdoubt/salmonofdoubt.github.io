#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"warning: could not parse {path}: {exc}")
        return default

def first_value(data: dict[str, Any], keys: list[str], fallback: Any = None) -> Any:
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return fallback

def normalise_manual_items() -> list[dict[str, Any]]:
    data = load_json(DATA / "monitor-items.manual.json", {"items": []})
    items = data.get("items", []) if isinstance(data, dict) else []
    return [normalise_item(item, source="manual") for item in items if isinstance(item, dict)]

def normalise_item(item: dict[str, Any], source: str) -> dict[str, Any]:
    title = first_value(item, ["title", "name", "headline"], "Untitled monitor item")
    monitor = first_value(item, ["monitor", "monitor_id"], "unknown")
    lane = first_value(item, ["lane", "section", "category"], "general")
    source_url = first_value(item, ["source_url", "url", "link"], "")
    source_name = first_value(item, ["source_name", "source", "publisher"], source)
    updated_at = first_value(item, ["updated_at", "published_at", "date"], "")
    item_id = first_value(item, ["id"], slugify(f"{monitor}-{lane}-{title}-{source_url}"))

    return {
        "id": item_id,
        "monitor": monitor,
        "lane": lane,
        "title": title,
        "summary": first_value(item, ["summary", "description", "snippet"], ""),
        "status": first_value(item, ["status"], "watch"),
        "importance": first_value(item, ["importance"], "medium"),
        "confidence": first_value(item, ["confidence"], "medium"),
        "location": first_value(item, ["location"], ""),
        "source_name": source_name,
        "source_url": source_url,
        "published_at": first_value(item, ["published_at", "date"], ""),
        "updated_at": updated_at,
        "tags": item.get("tags", []),
        "counting_rule": first_value(item, ["counting_rule"], ""),
        "caveat": first_value(item, ["caveat"], ""),
        "origin": source
    }

def slugify(value: str) -> str:
    keep = []
    last_dash = False
    for char in value.lower():
        if char.isalnum():
            keep.append(char)
            last_dash = False
        elif not last_dash:
            keep.append("-")
            last_dash = True
    return "".join(keep).strip("-")[:140] or "monitor-item"

def harvest_storage_flexibility() -> list[dict[str, Any]]:
    path = ROOT / "demos/ietm/data/storage-flexibility.json"
    data = load_json(path, {"items": []})
    if not isinstance(data, dict):
        return []
    results = []
    for item in data.get("items", []):
        if not isinstance(item, dict):
            continue
        sources = item.get("sources") or []
        first_source = sources[0] if sources and isinstance(sources[0], dict) else {}
        results.append(normalise_item({
            "id": item.get("id"),
            "monitor": "ietm",
            "lane": "storage-flexibility",
            "title": item.get("name"),
            "summary": item.get("technology"),
            "status": item.get("status", "watch"),
            "importance": "high",
            "confidence": "medium" if "Proposed" in str(item.get("status", "")) else "high",
            "location": item.get("location"),
            "source_name": first_source.get("label", "Storage flexibility data"),
            "source_url": first_source.get("url", ""),
            "updated_at": data.get("generated_at", ""),
            "tags": [item.get("asset_type", "storage"), "grid-flexibility"],
            "counting_rule": item.get("counting_rule", ""),
            "caveat": "; ".join(item.get("watch_flags", []))
        }, source=str(path.relative_to(ROOT))))
    return results

def harvest_news_monitor(monitor_id: str, path_text: str, limit: int = 12) -> list[dict[str, Any]]:
    path = ROOT / path_text
    data = load_json(path, {"items": []})
    if not isinstance(data, dict):
        return []
    items = data.get("items", [])
    if not isinstance(items, list):
        return []

    results = []
    for raw in items[:limit]:
        if not isinstance(raw, dict):
            continue
        results.append(normalise_item({
            "monitor": monitor_id,
            "lane": first_value(raw, ["section", "lane", "category"], "news"),
            "title": first_value(raw, ["title", "headline", "name"], "Untitled news item"),
            "summary": first_value(raw, ["summary", "description", "snippet"], ""),
            "status": "watch",
            "importance": first_value(raw, ["importance"], "medium"),
            "confidence": first_value(raw, ["confidence"], "medium"),
            "source_name": first_value(raw, ["source", "publisher", "source_name"], "source"),
            "source_url": first_value(raw, ["url", "link", "source_url"], ""),
            "published_at": first_value(raw, ["published_at", "date"], ""),
            "updated_at": data.get("generated_at", ""),
            "tags": raw.get("tags", [])
        }, source=path_text))
    return results

def dedupe(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    out = []
    for item in items:
        key = item.get("id") or slugify(item.get("title", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out

def main() -> None:
    DATA.mkdir(exist_ok=True)

    items: list[dict[str, Any]] = []
    items.extend(normalise_manual_items())
    items.extend(harvest_storage_flexibility())
    items.extend(harvest_news_monitor("urbanforest", "demos/urbanforest/news/data/news.json"))
    items.extend(harvest_news_monitor("ndrt", "demos/ndrt/news/data/news.json"))

    items = dedupe(items)
    payload = {
        "generated_at": now_iso(),
        "schema_version": "1.0.0",
        "item_count": len(items),
        "items": items
    }
    (DATA / "monitor-items.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"normalised {len(items)} monitor items")

if __name__ == "__main__":
    main()
