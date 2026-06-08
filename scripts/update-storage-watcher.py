#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "demos" / "ietm" / "data"

MANUAL_PATH = DATA_DIR / "storage-flexibility.manual.json"
CONFIG_PATH = DATA_DIR / "storage-watch-config.json"
OUT_PATH = DATA_DIR / "storage-flexibility.json"

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search?q={query}&hl=en-IE&gl=IE&ceid=IE:en"

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"warning: could not parse {path}: {exc}")
        return default

def strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()

def stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8", errors="ignore")).hexdigest()[:12]
    return f"{prefix}-{digest}"

def fetch_url(url: str, timeout: int = 20) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "SalmonOfDoubt-IETM-StorageWatcher/1.0 (+https://salmonofdoubt.github.io/demos/ietm/)"
        }
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()

def parse_rss_items(xml_bytes: bytes) -> list[dict[str, str]]:
    root = ET.fromstring(xml_bytes)
    items = []

    for item in root.findall(".//item"):
        title = strip_html(item.findtext("title") or "")
        link = strip_html(item.findtext("link") or "")
        description = strip_html(item.findtext("description") or "")
        published = strip_html(item.findtext("pubDate") or "")
        source = item.find("{*}source")
        source_name = strip_html(source.text if source is not None and source.text else "Google News")

        if title and link:
            items.append({
                "title": title,
                "link": link,
                "description": description,
                "published": published,
                "source": source_name
            })

    return items

def text_score(text: str, positive_terms: list[str], negative_terms: list[str]) -> int:
    lower = text.lower()
    score = 0

    for term in positive_terms:
        if term.lower() in lower:
            score += 2

    for term in negative_terms:
        if term.lower() in lower:
            score -= 4

    if "ireland" in lower or "irish" in lower or "carlow" in lower:
        score += 2

    if re.search(r"\b(mw|gwh|battery|hydrogen|grid|electricity|planning|renewable)\b", lower):
        score += 2

    return score

def extract_number(patterns: list[str], text: str) -> float | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I)
        if match:
            try:
                return float(match.group(1).replace(",", ""))
            except Exception:
                pass
    return None

def classify_asset_type(text: str) -> str:
    lower = text.lower()
    if "hydrogen" in lower or " h2 " in f" {lower} " or "cavern" in lower:
        return "LDES / green hydrogen storage"
    if "battery" in lower or "bess" in lower:
        return "Battery energy storage"
    if "pumped hydro" in lower:
        return "Pumped hydro storage"
    if "interconnector" in lower:
        return "Grid flexibility / interconnector"
    return "Storage / grid flexibility"

def classify_status(text: str) -> str:
    lower = text.lower()
    if "refused" in lower or "rejected" in lower:
        return "Refused / challenged"
    if "approved" in lower or "permission granted" in lower:
        return "Approved"
    if "planning" in lower or "consultation" in lower or "proposed" in lower or "unveils" in lower:
        return "Proposed / planning"
    if "operational" in lower or "energised" in lower or "connected" in lower:
        return "Operational / connected"
    return "Watch item"

def discover_items(config: dict[str, Any]) -> list[dict[str, Any]]:
    discovered: list[dict[str, Any]] = []
    seen_links: set[str] = set()

    positive_terms = config.get("positive_terms", [])
    negative_terms = config.get("negative_terms", [])

    for query in config.get("queries", []):
        encoded = urllib.parse.quote(query)
        url = GOOGLE_NEWS_RSS.format(query=encoded)

        try:
            xml = fetch_url(url)
            rss_items = parse_rss_items(xml)
        except Exception as exc:
            print(f"warning: query failed: {query}: {exc}")
            continue

        for raw in rss_items:
            link = raw["link"]
            if link in seen_links:
                continue

            text = f"{raw['title']} {raw['description']} {raw['source']}"
            if text_score(text, positive_terms, negative_terms) < 4:
                continue

            seen_links.add(link)

            capacity_mw = extract_number([r"(\d+(?:\.\d+)?)\s*MW"], text)
            energy_gwh = extract_number([r"(\d+(?:\.\d+)?)\s*GWh"], text)
            duration_hours = extract_number([r"(\d+(?:\.\d+)?)\s*(?:h|hour|hours)\b"], text)
            investment_eur_bn = extract_number([r"€\s*(\d+(?:\.\d+)?)\s*bn", r"€\s*(\d+(?:\.\d+)?)\s*billion"], text)

            discovered.append({
                "id": stable_id("storage-news", link or raw["title"]),
                "name": raw["title"],
                "developer": "",
                "location": infer_location(text),
                "planning_reference": "",
                "technology": raw["description"] or raw["title"],
                "asset_type": classify_asset_type(text),
                "capacity_mw": capacity_mw,
                "duration_hours": duration_hours,
                "energy_gwh": energy_gwh,
                "investment_eur_bn": investment_eur_bn,
                "status": classify_status(text),
                "counting_rule": "Do not include in renewable generation totals unless this is explicitly connected renewable generation.",
                "watch_flags": [
                    "Discovered from news/search feed",
                    "Verify planning, connection and operational status before using in analysis"
                ],
                "sources": [
                    {
                        "label": raw["source"],
                        "url": link
                    }
                ],
                "published_at": raw["published"],
                "discovered_at": now_iso(),
                "query_match": query
            })

        time.sleep(1)

    return discovered

def infer_location(text: str) -> str:
    counties = [
        "Carlow", "Dublin", "Cork", "Galway", "Mayo", "Sligo", "Meath", "Kildare",
        "Louth", "Limerick", "Clare", "Kerry", "Waterford", "Wexford", "Wicklow",
        "Tipperary", "Kilkenny", "Laois", "Offaly", "Westmeath", "Longford",
        "Roscommon", "Leitrim", "Donegal", "Monaghan", "Cavan"
    ]
    for county in counties:
        if re.search(rf"\b{re.escape(county)}\b", text, flags=re.I):
            return f"Co. {county}"
    if "ireland" in text.lower() or "irish" in text.lower():
        return "Ireland"
    return ""

def item_key(item: dict[str, Any]) -> str:
    sources = item.get("sources") or []
    url = ""
    if sources and isinstance(sources[0], dict):
        url = sources[0].get("url", "")
    return (url or item.get("name") or item.get("id") or "").lower().strip()

def related_to_project(news: dict[str, Any], project: dict[str, Any]) -> bool:
    text = " ".join([
        str(news.get("name", "")),
        str(news.get("technology", "")),
        str(news.get("location", "")),
        " ".join(str(s.get("label", "")) for s in news.get("sources", []) if isinstance(s, dict))
    ]).lower()

    terms = [
        project.get("name", ""),
        project.get("developer", ""),
        project.get("location", ""),
        project.get("planning_reference", "")
    ]

    useful_terms = []
    for term in terms:
        for bit in re.split(r"[/,()\-]+|\s{2,}", str(term)):
            bit = bit.strip()
            if len(bit) >= 5:
                useful_terms.append(bit.lower())

    return any(term and term in text for term in useful_terms)

def attach_project_updates(manual_items: list[dict[str, Any]], discovered: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enhanced = []

    for project in manual_items:
        item = dict(project)
        updates = []

        for news in discovered:
            if related_to_project(news, project):
                source = (news.get("sources") or [{}])[0]
                updates.append({
                    "title": news.get("name", ""),
                    "source": source.get("label", ""),
                    "url": source.get("url", ""),
                    "published_at": news.get("published_at", ""),
                    "discovered_at": news.get("discovered_at", "")
                })

        if updates:
            existing = item.get("latest_updates", [])
            combined = existing + updates
            seen = set()
            unique = []
            for update in combined:
                key = update.get("url") or update.get("title")
                if key in seen:
                    continue
                seen.add(key)
                unique.append(update)
            item["latest_updates"] = unique[:8]

        enhanced.append(item)

    return enhanced

def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    manual = load_json(MANUAL_PATH, {
        "monitor": "Irish Energy Transition Monitor",
        "lane": "Storage, hydrogen and grid flexibility",
        "classification_note": "Storage and flexibility are tracked separately from renewable generation.",
        "items": []
    })

    config = load_json(CONFIG_PATH, {"queries": [], "positive_terms": [], "negative_terms": []})

    manual_items = manual.get("items", []) if isinstance(manual, dict) else []
    discovered = discover_items(config)
    enhanced_manual = attach_project_updates(manual_items, discovered)

    seen = set()
    merged = []

    for item in enhanced_manual + discovered:
        key = item_key(item)
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)

    payload = {
        "generated_at": now_iso(),
        "monitor": "Irish Energy Transition Monitor",
        "lane": "Storage, hydrogen and grid flexibility",
        "classification_note": "Storage, hydrogen and grid-flexibility assets support renewable integration but must not be counted as connected renewable generation.",
        "source_mode": "manual tracked projects plus RSS discovery",
        "item_count": len(merged),
        "items": merged,
        "query_terms": config.get("queries", [])
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"storage watcher wrote {len(merged)} items to {OUT_PATH.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
