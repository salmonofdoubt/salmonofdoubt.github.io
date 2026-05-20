#!/usr/bin/env python3
"""
Add representative bird images to demos/boie/data/birds.json.

Source:
  English Wikipedia pageimages API.

Images are not copied into the repository. The site stores remote thumbnail URLs
plus the source page, so attribution and licence details remain traceable.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "birds.json"
COVERAGE_PATH = ROOT / "data" / "coverage.json"

WIKI_API = "https://en.wikipedia.org/w/api.php"

HEADERS = {
    "User-Agent": "salmonofdoubt-boie-image-enricher/1.0 (+https://salmonofdoubt.github.io/demos/boie/)"
}


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip()
    return value


def commons_file_url(filename: str) -> str:
    if not filename:
        return ""
    return "https://commons.wikimedia.org/wiki/File:" + quote(filename.replace(" ", "_"))


def fetch_page_image(title: str) -> Optional[Dict[str, Any]]:
    title = clean_title(title)
    if not title:
        return None

    response = requests.get(
        WIKI_API,
        params={
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "redirects": "1",
            "prop": "pageimages|info",
            "piprop": "thumbnail|original|name",
            "pithumbsize": "900",
            "inprop": "url",
            "titles": title,
        },
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()

    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        return None

    page = pages[0]
    if page.get("missing"):
        return None

    thumb = (page.get("thumbnail") or {}).get("source")
    original = (page.get("original") or {}).get("source")
    image_name = page.get("pageimage") or ""

    src = thumb or original
    if not src:
        return None

    return {
        "source": "English Wikipedia page image",
        "thumb": src,
        "original": original or src,
        "url": page.get("fullurl") or f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
        "page_title": page.get("title") or title,
        "file_title": f"File:{image_name}" if image_name else "",
        "commons_url": commons_file_url(image_name),
        "artist": "See linked Wikimedia source page",
        "license": "See linked Wikimedia source page",
    }


def search_best_title(query: str) -> Optional[str]:
    query = clean_title(query)
    if not query:
        return None

    response = requests.get(
        WIKI_API,
        params={
            "action": "query",
            "format": "json",
            "list": "search",
            "srlimit": "3",
            "srsearch": query,
        },
        headers=HEADERS,
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()

    hits = payload.get("query", {}).get("search", [])
    if not hits:
        return None

    return hits[0].get("title")


def image_for_bird(bird: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    common = clean_title(bird.get("common_name", ""))
    scientific = clean_title(bird.get("scientific_name", ""))

    candidates = []
    if common:
        candidates.append(common)
        candidates.append(f"{common} bird")
    if scientific:
        candidates.append(scientific)

    seen = set()
    for candidate in candidates:
        if not candidate or candidate.lower() in seen:
            continue
        seen.add(candidate.lower())

        image = fetch_page_image(candidate)
        if image:
            image["query"] = candidate
            return image

        time.sleep(0.08)

    for candidate in candidates:
        title = search_best_title(candidate)
        if not title:
            continue

        image = fetch_page_image(title)
        if image:
            image["query"] = candidate
            image["matched_title"] = title
            return image

        time.sleep(0.12)

    return None


def main() -> None:
    if not DATA_PATH.exists():
        raise SystemExit(f"Missing {DATA_PATH}. Run the BOIE bird harvester first.")

    data = json.loads(DATA_PATH.read_text())
    birds = data.get("birds", [])

    if not birds:
        raise SystemExit("No birds found in birds.json.")

    with_image = 0
    missing = []

    for i, bird in enumerate(birds, start=1):
        print(f"[{i:03d}/{len(birds):03d}] image: {bird.get('common_name', 'unknown')}")

        image = image_for_bird(bird)
        bird["image"] = image

        if image:
            with_image += 1
        else:
            missing.append({
                "common_name": bird.get("common_name"),
                "scientific_name": bird.get("scientific_name"),
            })

        time.sleep(0.12)

    now = dt.datetime.now(dt.timezone.utc).isoformat()

    data.setdefault("meta", {})
    data["meta"]["image_source"] = "English Wikipedia pageimages API"
    data["meta"]["species_with_image"] = with_image
    data["meta"]["species_without_image"] = len(birds) - with_image
    data["meta"]["image_generated_at"] = now

    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    coverage = {}
    if COVERAGE_PATH.exists():
        coverage = json.loads(COVERAGE_PATH.read_text())

    coverage["image_generated_at"] = now
    coverage["species_with_image"] = with_image
    coverage["species_without_image"] = len(birds) - with_image
    coverage["image_coverage_percent"] = round((with_image / len(birds) * 100) if birds else 0, 2)
    coverage["missing_image"] = missing

    COVERAGE_PATH.write_text(json.dumps(coverage, indent=2, ensure_ascii=False) + "\n")

    print(f"Wrote {DATA_PATH}")
    print(f"Wrote {COVERAGE_PATH}")
    print(f"Image coverage: {with_image}/{len(birds)} species")


if __name__ == "__main__":
    main()
