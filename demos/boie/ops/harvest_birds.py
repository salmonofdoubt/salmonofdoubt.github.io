#!/usr/bin/env python3
"""
Birds of Ireland Sound Atlas harvester.

Builds:
  demos/boie/data/birds.json
  demos/boie/data/coverage.json

Sources:
  - Checklist: https://en.wikipedia.org/wiki/List_of_birds_of_Ireland
  - Audio metadata: https://xeno-canto.org API v3

The page is intentionally attribution-forward. Audio is linked remotely, not copied
into this repository. Each card keeps recordist, source URL, licence, country, and quality.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlencode, unquote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_PATH = DATA_DIR / "birds.json"
COVERAGE_PATH = DATA_DIR / "coverage.json"

CHECKLIST_URL = "https://en.wikipedia.org/wiki/List_of_birds_of_Ireland"
XC_API = "https://xeno-canto.org/api/3/recordings"
XC_API_KEY = os.environ.get("XENO_CANTO_API_KEY", "").strip()
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

HEADERS = {
    "User-Agent": "salmonofdoubt-boie-sound-atlas/1.0 (+https://salmonofdoubt.github.io/demos/boie/)"
}

STATUS_LABELS = {
    "A": "Recorded naturally in Ireland since 1 January 1950",
    "B": "Recorded naturally in Ireland before 31 December 1949, but not subsequently",
    "C": "Introduced or established from introduced populations",
    "R": "Rarity requiring substantiating details",
}

QUALITY_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}


def clean_text(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]", "", value or "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def split_binomials(value: str) -> List[str]:
    value = clean_text(value)
    value = value.replace(" or ", " / ")
    chunks = [clean_text(part) for part in value.split("/") if clean_text(part)]
    good = []
    for chunk in chunks:
        tokens = re.findall(r"[A-Z][a-z]+|[a-z][a-z-]+", chunk)
        if len(tokens) >= 2:
            good.append(f"{tokens[0]} {tokens[1]}")
    return good or ([value] if value else [])


def status_codes(value: str) -> List[str]:
    return [code for code in ["A", "B", "C", "R"] if re.search(rf"\b{code}\b", value or "")]


def previous_heading(table) -> str:
    node = table
    while node:
        node = node.find_previous(["h2", "h3"])
        if not node:
            return "Unspecified"
        text = clean_text(node.get_text(" ", strip=True)).replace("[edit]", "")
        if text and text.lower() not in {"references", "external links", "see also"}:
            return text
    return "Unspecified"


def parse_checklist() -> List[Dict[str, Any]]:
    response = requests.get(CHECKLIST_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    birds: List[Dict[str, Any]] = []
    seen: set[Tuple[str, str]] = set()

    for table in soup.select("table.wikitable"):
        rows = table.select("tr")
        if not rows:
            continue

        header_cells = [clean_text(th.get_text(" ", strip=True)).lower() for th in rows[0].select("th")]
        if not {"common name", "binomial", "status"}.issubset(set(header_cells)):
            continue

        idx = {name: header_cells.index(name) for name in header_cells}
        group = previous_heading(table)

        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < len(header_cells):
                continue

            common = clean_text(cells[idx["common name"]].get_text(" ", strip=True))
            binomial = clean_text(cells[idx["binomial"]].get_text(" ", strip=True))
            irish = clean_text(cells[idx.get("irish name", -1)].get_text(" ", strip=True)) if "irish name" in idx else ""
            status = clean_text(cells[idx["status"]].get_text(" ", strip=True))

            if not common or not binomial:
                continue

            scientific_names = split_binomials(binomial)
            canonical = scientific_names[0] if scientific_names else binomial
            key = (common.lower(), canonical.lower())
            if key in seen:
                continue

            seen.add(key)
            birds.append(
                {
                    "common_name": common,
                    "scientific_name": canonical,
                    "scientific_alternatives": scientific_names,
                    "irish_name": irish,
                    "group": group,
                    "status": status,
                    "status_codes": status_codes(status),
                    "status_labels": [STATUS_LABELS[c] for c in status_codes(status)],
                    "checklist_source": CHECKLIST_URL,
                    "audio": None,
                    "image": None,
                }
            )

    birds.sort(key=lambda b: b["common_name"].lower())
    return birds



def html_to_plain_text(value: str) -> str:
    """Convert Commons extmetadata HTML-ish fields into plain readable text."""
    if not value:
        return ""
    text = BeautifulSoup(str(value), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def chunks(values: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(values), size):
        yield values[i:i + size]


def commons_title_from_wikidata_image(value: str) -> str:
    """Turn a Wikidata P18 image URL into a Commons File: title."""
    if not value:
        return ""
    marker = "/Special:FilePath/"
    if marker in value:
        filename = value.split(marker, 1)[1]
    else:
        filename = value.rsplit("/", 1)[-1]
    filename = unquote(filename).replace("_", " ").strip()
    if not filename:
        return ""
    return filename if filename.startswith("File:") else f"File:{filename}"


def fetch_wikidata_taxon_images(scientific_names: List[str]) -> Dict[str, str]:
    """Return scientific name -> Commons File:title using Wikidata taxon image P18."""
    image_titles: Dict[str, str] = {}

    for batch in chunks(scientific_names, 80):
        values = " ".join(json.dumps(name, ensure_ascii=False) for name in batch)
        query = f"""
        SELECT ?taxonName ?image WHERE {{
          VALUES ?taxonName {{ {values} }}
          ?taxon wdt:P225 ?taxonName.
          ?taxon wdt:P18 ?image.
        }}
        """

        response = requests.get(
            WIKIDATA_SPARQL,
            params={"query": query, "format": "json"},
            headers={**HEADERS, "Accept": "application/sparql-results+json"},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()

        for row in payload.get("results", {}).get("bindings", []):
            name = row.get("taxonName", {}).get("value", "")
            image_url = row.get("image", {}).get("value", "")
            title = commons_title_from_wikidata_image(image_url)
            if name and title and name not in image_titles:
                image_titles[name] = title

        time.sleep(0.5)

    return image_titles


def fetch_commons_image_metadata(file_titles: List[str]) -> Dict[str, Dict[str, Any]]:
    """Return Commons File:title -> image metadata with thumbnail and attribution."""
    metadata: Dict[str, Dict[str, Any]] = {}

    for batch in chunks(file_titles, 50):
        response = requests.get(
            COMMONS_API,
            params={
                "action": "query",
                "format": "json",
                "formatversion": "2",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "iiurlwidth": "900",
                "titles": "|".join(batch),
            },
            headers=HEADERS,
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()

        for page in payload.get("query", {}).get("pages", []):
            title = page.get("title", "")
            infos = page.get("imageinfo", [])
            if not title or not infos:
                continue

            info = infos[0]
            ext = info.get("extmetadata", {}) or {}

            def meta(key: str) -> str:
                return html_to_plain_text((ext.get(key) or {}).get("value", ""))

            metadata[title] = {
                "source": "Wikimedia Commons via Wikidata",
                "file_title": title,
                "thumb": info.get("thumburl") or info.get("url") or "",
                "url": info.get("descriptionurl") or info.get("descriptionshorturl") or "",
                "artist": meta("Artist") or meta("Attribution") or "Unknown photographer",
                "credit": meta("Credit"),
                "license": meta("LicenseShortName") or meta("UsageTerms"),
                "license_url": (ext.get("LicenseUrl") or {}).get("value", ""),
            }

        time.sleep(0.5)

    return metadata


def build_image_lookup(birds: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Build scientific name -> image metadata for all parsed checklist birds."""
    scientific_names = sorted({
        name
        for bird in birds
        for name in (bird.get("scientific_alternatives") or [bird.get("scientific_name", "")])
        if name
    })

    print(f"Looking up images for {len(scientific_names)} scientific names via Wikidata.")
    name_to_file = fetch_wikidata_taxon_images(scientific_names)
    print(f"Wikidata image matches: {len(name_to_file)}")

    file_titles = sorted(set(name_to_file.values()))
    file_to_meta = fetch_commons_image_metadata(file_titles)
    print(f"Commons image metadata matches: {len(file_to_meta)}")

    return {
        name: file_to_meta[file_title]
        for name, file_title in name_to_file.items()
        if file_title in file_to_meta
    }


def xc_query_for(scientific: str, extra: str = "") -> str:
    parts = scientific.split()
    if len(parts) < 2:
        return scientific
    query = f"gen:{parts[0]} sp:{parts[1]}"
    if extra:
        query += f" {extra}"
    return query


def fetch_xc_recordings(query: str) -> Dict[str, Any]:
    """Fetch xeno-canto recordings from API v3.

    API v3 requires an API key. Keep the key out of git:
    export XENO_CANTO_API_KEY="your_key_here"
    """
    if not XC_API_KEY:
        raise RuntimeError(
            "Missing XENO_CANTO_API_KEY. Get an API key from https://xeno-canto.org/account "
            "and run: export XENO_CANTO_API_KEY='your_key_here'"
        )

    response = requests.get(
        XC_API,
        params={"query": query, "key": XC_API_KEY},
        headers=HEADERS,
        timeout=30,
    )

    if response.status_code in {401, 403}:
        raise RuntimeError(
            "xeno-canto authentication failed. Check XENO_CANTO_API_KEY. "
            f"Response: {response.text[:300]}"
        )

    if response.status_code == 404:
        return {
            "numRecordings": "0",
            "recordings": [],
            "query": query,
            "warning": "404 no recordings for query",
        }

    response.raise_for_status()
    payload = response.json()

    if "recordings" not in payload:
        raise RuntimeError(
            f"Unexpected xeno-canto API response for {query}: {str(payload)[:500]}"
        )

    return payload


def normalise_file_url(value: str) -> str:
    if not value:
        return ""
    if value.startswith("//"):
        return "https:" + value
    if value.startswith("/"):
        return "https://xeno-canto.org" + value
    return value


def score_recording(rec: Dict[str, Any]) -> Tuple[int, int, int]:
    q = QUALITY_ORDER.get(str(rec.get("q", "")).upper(), 9)
    raw_type = rec.get("type", [])
    if isinstance(raw_type, list):
        type_text = " ".join(str(x) for x in raw_type).lower()
    else:
        type_text = str(raw_type).lower()
    type_score = 0 if "song" in type_text else 1 if "call" in type_text else 2
    country_score = 0 if str(rec.get("cnt", "")).lower() in {"ireland", "united kingdom"} else 1
    return (type_score, q, country_score)


def choose_recording(records: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    usable = [r for r in records if r.get("file")]
    if not usable:
        return None

    usable.sort(key=score_recording)
    rec = usable[0]

    return {
        "id": rec.get("id"),
        "english_name": rec.get("en"),
        "scientific_name": f"{rec.get('gen', '')} {rec.get('sp', '')}".strip(),
        "recordist": rec.get("rec"),
        "country": rec.get("cnt"),
        "location": rec.get("loc"),
        "date": rec.get("date"),
        "time": rec.get("time"),
        "type": rec.get("type"),
        "q": rec.get("q"),
        "length": rec.get("length"),
        "license": rec.get("lic"),
        "url": rec.get("url"),
        "file": normalise_file_url(rec.get("file", "")),
        "source": "xeno-canto",
    }


def find_audio_for_species(scientific_names: Iterable[str]) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    tried: List[str] = []

    extras = [
        "q:A type:song",
        "q:B type:song",
        "type:song",
        "q:A type:call",
        "q:B type:call",
        "type:call",
        "q:A",
        "q:B",
        "",
    ]

    for scientific in scientific_names:
        for extra in extras:
            query = xc_query_for(scientific, extra)
            tried.append(query)
            try:
                payload = fetch_xc_recordings(query)
            except Exception as exc:
                print(f"warning: xeno-canto query failed for {query}: {exc}")
                time.sleep(1.0)
                continue

            records = payload.get("recordings", [])
            selected = choose_recording(records)
            time.sleep(0.32)
            if selected:
                selected["query"] = query
                return selected, tried

    return None, tried


def preflight_xc_api() -> None:
    """Fail early if xeno-canto API v3 or the key is not usable."""
    test_query = "gen:Erithacus sp:rubecula"
    payload = fetch_xc_recordings(test_query)
    records = payload.get("recordings", [])

    if not records:
        raise RuntimeError(
            "xeno-canto API preflight failed: no recordings returned for European robin. "
            "The key may work, but the query syntax or API response has changed."
        )

    print(f"xeno-canto API preflight OK: {len(records)} robin recordings available.")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


    preflight_xc_api()

    birds = parse_checklist()
    print(f"Parsed {len(birds)} Irish checklist species.")

    image_lookup = build_image_lookup(birds)

    missing = 0
    with_audio = 0
    query_log: Dict[str, Any] = {}

    for i, bird in enumerate(birds, start=1):
        names = bird.get("scientific_alternatives") or [bird["scientific_name"]]
        print(f"[{i:03d}/{len(birds):03d}] {bird['common_name']} ({bird['scientific_name']})")

        image = None
        for name in names:
            image = image_lookup.get(name)
            if image:
                break
        bird["image"] = image

        audio, tried = find_audio_for_species(names)
        bird["audio"] = audio
        query_log[bird["scientific_name"]] = tried

        if audio:
            with_audio += 1
        else:
            missing += 1

    now = dt.datetime.now(dt.timezone.utc).isoformat()

    payload = {
        "meta": {
            "title": "Birds of Ireland Sound Atlas",
            "generated_at": now,
            "checklist_source": CHECKLIST_URL,
            "audio_source": "https://xeno-canto.org",
            "total_species": len(birds),
            "species_with_audio": with_audio,
            "species_without_audio": missing,
            "species_with_image": sum(1 for b in birds if b.get("image")),
            "species_without_image": sum(1 for b in birds if not b.get("image")),
            "status_labels": STATUS_LABELS,
        },
        "birds": birds,
    }

    coverage = {
        "generated_at": now,
        "total_species": len(birds),
        "species_with_audio": with_audio,
        "species_without_audio": missing,
        "species_with_image": sum(1 for b in birds if b.get("image")),
        "species_without_image": sum(1 for b in birds if not b.get("image")),
        "coverage_percent": round((with_audio / len(birds) * 100) if birds else 0, 2),
        "missing_audio": [
            {
                "common_name": b["common_name"],
                "scientific_name": b["scientific_name"],
                "status_codes": b.get("status_codes", []),
            }
            for b in birds
            if not b.get("audio")
        ],
        "query_log": query_log,
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    COVERAGE_PATH.write_text(json.dumps(coverage, indent=2, ensure_ascii=False) + "\n")

    print(f"Wrote {OUT_PATH}")
    print(f"Wrote {COVERAGE_PATH}")
    print(f"Coverage: {with_audio}/{len(birds)} species ({coverage['coverage_percent']}%)")


if __name__ == "__main__":
    main()
