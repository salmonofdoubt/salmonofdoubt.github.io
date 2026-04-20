#!/usr/bin/env python3
"""Conservative harvester for the static Geo Radar catalogue.

It fetches configured official pages, applies lightweight source-specific
regex extraction when available, and writes one JSON catalogue for the
browser interface. It also compares against the previous saved catalogue
to flag new entries or deadline changes.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
REGISTRY_PATH = DATA_DIR / "source-registry.json"
CATALOG_PATH = DATA_DIR / "catalog.json"
USER_AGENT = "GeoRadarBot/1.0 (+https://salmonofdoubt.github.io/demos/geo-radar/)"
TIMEOUT = (10, 30)


@dataclass
class ExtractedItem:
    source_id: str
    source_name: str
    title: str
    programme: str
    url: str
    summary: str
    status: str
    change_type: str
    changed_at: str | None
    deadline_iso: str | None
    deadline_text: str | None
    region: str
    audience: list[str]
    applicant_types: list[str]
    access_route: str | None
    scale: str | None
    purposes: list[str]
    keywords: list[str]
    cta_label: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": slugify(f"{self.source_id}_{self.title}"),
            "source_id": self.source_id,
            "source_name": self.source_name,
            "title": self.title,
            "programme": self.programme,
            "url": self.url,
            "summary": self.summary,
            "status": self.status,
            "change_type": self.change_type,
            "changed_at": self.changed_at,
            "deadline_iso": self.deadline_iso,
            "deadline_text": self.deadline_text,
            "region": self.region,
            "audience": self.audience,
            "applicant_types": self.applicant_types,
            "access_route": self.access_route,
            "scale": self.scale,
            "purposes": self.purposes,
            "keywords": self.keywords,
            "cta_label": self.cta_label,
        }


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_text(url: str) -> tuple[str, str | None]:
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n", strip=True)
    last_modified = response.headers.get("Last-Modified")
    if last_modified:
        try:
            return text, parsedate_to_datetime(last_modified).astimezone(UTC).isoformat()
        except Exception:
            return text, None
    return text, None


def regex_extract(pattern: str | None, text: str) -> str | None:
    if not pattern:
        return None
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip(" .")


def normalise_date(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    cleaned = re.sub(r"\b(st|nd|rd|th)\b", "", value)
    try:
        dt = dateparser.parse(cleaned, dayfirst=True)
        if not dt:
            return None, value
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC).isoformat(), value
    except Exception:
        return None, value


def determine_change(item: ExtractedItem, previous_map: dict[str, dict[str, Any]], seen_at: str) -> None:
    key = slugify(f"{item.source_id}_{item.title}")
    old = previous_map.get(key)
    if not old:
        item.change_type = "new"
        item.changed_at = seen_at
        return

    old_deadline = old.get("deadline_text") or ""
    new_deadline = item.deadline_text or ""
    if old_deadline != new_deadline:
        item.change_type = "deadline_updated"
        item.changed_at = seen_at
        return

    old_status = old.get("status") or ""
    if old_status != item.status:
        item.change_type = "status_changed"
        item.changed_at = seen_at
        return

    item.change_type = old.get("change_type", "none") if old.get("change_type") == "awarded" else "none"
    item.changed_at = old.get("changed_at")


def harvest() -> dict[str, Any]:
    registry = load_json(REGISTRY_PATH, default=[])
    previous_catalog = load_json(CATALOG_PATH, default={})
    previous_items = {item["id"]: item for item in previous_catalog.get("opportunities", [])}

    seen_at = datetime.now(UTC).replace(microsecond=0).isoformat()
    sources_out: list[dict[str, Any]] = []
    items_out: list[dict[str, Any]] = []
    purposes_seen: set[str] = set()
    applicant_seen: set[str] = set()
    access_seen: set[str] = set()
    scale_seen: set[str] = set()

    for source in registry:
        extract = source.get("extract", {})
        summary = extract.get("summary_hint") or source.get("note", "")
        applicant_types = extract.get("applicant_types", [])
        access_route = extract.get("access_route")
        scale = extract.get("scale")
        keywords = sorted({source["name"].lower(), *(source.get("purposes", [])), *applicant_types})

        try:
            text, checked_at = fetch_text(source["url"])
            deadline_raw = regex_extract(extract.get("deadline_regex"), text)
            launch_raw = regex_extract(extract.get("launch_regex"), text) or regex_extract(extract.get("open_regex"), text)
            deadline_iso, deadline_text = normalise_date(deadline_raw)

            item = ExtractedItem(
                source_id=source["id"],
                source_name=source["name"],
                title=extract.get("title", source["name"]),
                programme=extract.get("programme", source["name"]),
                url=source["url"],
                summary=summary,
                status=extract.get("status_hint", "open"),
                change_type="none",
                changed_at=None,
                deadline_iso=deadline_iso,
                deadline_text=deadline_text or (f"Launch or open marker: {launch_raw}" if launch_raw else None),
                region=source.get("scope", "—"),
                audience=applicant_types,
                applicant_types=applicant_types,
                access_route=access_route,
                scale=scale,
                purposes=source.get("purposes", []),
                keywords=keywords,
                cta_label=f"Open {source['name']}",
            )

            determine_change(item, previous_items, seen_at)
            items_out.append(item.as_dict())

            sources_out.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source.get("scope", "—"),
                    "purposes": source.get("purposes", []),
                    "note": source.get("note", ""),
                    "last_checked": checked_at or seen_at,
                    "discovery_method": source.get("discovery_method", "configured extraction"),
                    "fetch_status": "ok",
                }
            )

        except requests.exceptions.RequestException as exc:
            print(f"[WARN] Failed to fetch {source['name']} ({source['url']}): {exc}")

            sources_out.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source.get("scope", "—"),
                    "purposes": source.get("purposes", []),
                    "note": source.get("note", ""),
                    "last_checked": seen_at,
                    "discovery_method": source.get("discovery_method", "configured extraction"),
                    "fetch_status": "error",
                    "fetch_error": str(exc),
                }
            )

        purposes_seen.update(source.get("purposes", []))
        applicant_seen.update(applicant_types)
        if access_route:
            access_seen.add(access_route)
        if scale:
            scale_seen.add(scale)

    return {
        "meta": {
            "title": "Geo Radar",
            "generated_at": seen_at,
            "generator": "geo-radar-demo 1.0.0",
            "available_purposes": sorted(purposes_seen),
            "available_applicant_types": sorted(applicant_seen),
            "available_access_routes": sorted(access_seen),
            "available_scales": sorted(scale_seen),
        },
        "sources": sources_out,
        "opportunities": items_out,
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    catalog = harvest()
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {CATALOG_PATH}")


if __name__ == "__main__":
    main()
