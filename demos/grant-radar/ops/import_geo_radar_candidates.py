#!/usr/bin/env python3
"""Import legacy Geo Radar records into Grant Radar review queue."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
GEO_DATA = ROOT / "demos" / "geo-radar" / "data"
GRANT_DATA = ROOT / "demos" / "grant-radar" / "data"
OUT = GRANT_DATA / "discovery-candidates.json"

SKIP_FILE_BITS = {"audit", "memory", "schema"}

def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))

def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")[:140]

def domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host

def family_key(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme or 'https'}://{parsed.netloc.lower()}{parsed.path.rstrip('/')}"

def iter_records(payload: Any):
    if isinstance(payload, list):
        yield from (x for x in payload if isinstance(x, dict))
    elif isinstance(payload, dict):
        for key in ("opportunities", "candidates", "sources", "items", "grants", "seeds"):
            value = payload.get(key)
            if isinstance(value, list):
                yield from (x for x in value if isinstance(x, dict))

def title_of(item: dict[str, Any]) -> str:
    return str(
        item.get("title")
        or item.get("name")
        or item.get("programme")
        or item.get("source_name")
        or "Geo Radar candidate"
    ).strip()

def snippet_of(item: dict[str, Any]) -> str:
    return str(
        item.get("snippet")
        or item.get("description")
        or item.get("summary")
        or item.get("extract")
        or ""
    ).strip()

def mode_relevance(item: dict[str, Any]) -> dict[str, str]:
    text = " ".join(str(v or "") for v in [
        title_of(item),
        item.get("url"),
        snippet_of(item),
        *(item.get("purposes") or []),
        *(item.get("suggested_purposes") or []),
    ]).lower()

    rel = {
        "geo": "include",
        "research": "include",
        "ndrt": "exclude",
        "farmer": "exclude",
    }

    if any(x in text for x in ["hydrogen", "geothermal", "energy", "climate", "transition"]):
        rel["climate"] = "maybe"
    else:
        rel["climate"] = "exclude"

    return rel

def candidate_type(item: dict[str, Any]) -> str:
    text = f"{title_of(item)} {item.get('url', '')} {snippet_of(item)}".lower()

    if any(x in text for x in ["fellowship", "scholarship", "studentship", "phd"]):
        return "scholarship"
    if any(x in text for x in ["jobs", "vacancy", "career", "postdoc", "professorship"]):
        return "career_route"
    if any(x in text for x in ["call", "grant", "funding", "programme", "program", "scheme"]):
        return "recurring_programme"
    return "geo_watch"

def main() -> None:
    existing = load_json(OUT, [])
    if not isinstance(existing, list):
        raise SystemExit("discovery-candidates.json is not a list")

    seen = {
        c.get("canonical_family_key") or family_key(str(c.get("url", "")))
        for c in existing
        if c.get("url")
    }

    imported = []
    now = datetime.now(UTC).replace(microsecond=0).isoformat()

    if not GEO_DATA.exists():
        raise SystemExit(f"Missing Geo Radar data folder: {GEO_DATA}")

    for path in sorted(GEO_DATA.glob("*.json")):
        if any(bit in path.name.lower() for bit in SKIP_FILE_BITS):
            continue

        payload = load_json(path, None)
        if payload is None:
            continue

        for item in iter_records(payload):
            url = str(item.get("url") or item.get("href") or item.get("link") or "").strip()
            if not url.startswith("http"):
                continue

            fam = family_key(url)
            if fam in seen:
                continue

            title = title_of(item)
            cid_base = f"geo_import_{domain(url)}_{urlparse(url).path}"
            cid = "cand_" + slug(cid_base)
            page_hash = "sha256:" + hashlib.sha256(url.encode("utf-8")).hexdigest()

            c = {
                "id": cid,
                "url": url,
                "canonical_family_key": fam,
                "domain": domain(url),
                "title": title,
                "snippet": snippet_of(item),
                "first_seen": now,
                "last_seen": now,
                "seen_in_latest_run": True,
                "detected_from": "geo_radar_legacy_import",
                "discovered_via": f"Geo Radar legacy import: {path.name}",
                "source_hint": "Geo Radar legacy import",
                "source_id_hint": "geo_radar_legacy_import",
                "source_pack": "geo",
                "candidate_type": candidate_type(item),
                "confidence": float(item.get("confidence") or 0.72),
                "promotion_signal": "amber",
                "public_visible_state": "review_only",
                "promotion_reasons": [
                    "Imported from legacy Geo Radar for review inside Grant Radar Geo / Earth Systems mode."
                ],
                "status": "pending_review",
                "triage_class": "geo_import_review",
                "triage_reason": "Legacy Geo Radar candidate imported for manual review.",
                "suggested_purposes": item.get("purposes") or item.get("suggested_purposes") or [
                    "geoscience",
                    "environmental research",
                    "geochemistry",
                    "subsurface storage",
                ],
                "suggested_applicant_types": item.get("applicant_types") or item.get("suggested_applicant_types") or [],
                "suggested_access_route": item.get("access_route") or item.get("suggested_access_route") or "direct",
                "suggested_scale": item.get("scale") or item.get("suggested_scale") or "medium",
                "mode_relevance": mode_relevance(item),
                "deadline_hint": item.get("deadline_hint") or item.get("deadline_text"),
                "latest_year_hint": item.get("latest_year_hint"),
                "page_hash": page_hash,
                "already_trusted": False,
                "trusted_registry_id": None,
                "notes": "Imported from legacy Geo Radar after Geo Radar was folded into Grant Radar.",
            }

            imported.append(c)
            seen.add(fam)

    existing.extend(imported)
    existing.sort(key=lambda c: (
        0 if c.get("status") == "pending_review" else 1,
        c.get("source_pack") != "geo",
        -float(c.get("confidence") or 0),
        str(c.get("title") or "").lower(),
    ))

    save_json(OUT, existing)

    geo_count = sum(
        1 for c in existing
        if (c.get("mode_relevance") or {}).get("geo") in {"include", "maybe"}
    )

    print("Imported Geo Radar candidates:", len(imported))
    print("Total Geo-fit candidates now:", geo_count)

    for c in imported[:30]:
        print("-", c["title"], "|", c["url"])

if __name__ == "__main__":
    main()
