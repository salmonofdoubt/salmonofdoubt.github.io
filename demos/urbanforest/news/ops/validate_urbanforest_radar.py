#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("demos/urbanforest/news")
DATA = ROOT / "data"
NEWS = DATA / "news.json"
HEALTH = DATA / "source-health.json"
DIGEST = DATA / "weekly-digest.json"
VALIDATION = DATA / "validation.json"
WORKFLOW = Path(".github/workflows/refresh-urbanforest-news.yml")

EXPECTED_SECTIONS = {
    "ireland-urban-forest-practice",
    "transferable-urbanforest-practice",
    "funding-opportunities",
    "research-evidence",
    "design-maintenance-risk",
}

REQUIRED_MINIMUMS = {
    "ireland-urban-forest-practice": 3,
    "transferable-urbanforest-practice": 2,
    "funding-opportunities": 3,
    "research-evidence": 5,
    "design-maintenance-risk": 2,
}

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json(path: Path) -> dict:
    if not path.exists():
        raise AssertionError(f"Missing required file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))

def key_url(url: str) -> str:
    parsed = urlparse(url or "")
    return parsed._replace(fragment="", query=parsed.query).geturl()

def main() -> None:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        latest = load_json(NEWS)
    except Exception as exc:
        print(f"Validation failed before item checks: {exc}")
        raise

    items = latest.get("items", [])
    if not isinstance(items, list) or not items:
        errors.append("news.json has no items.")

    sections = {}
    duplicate_urls = {}
    missing_fields = []

    seen_urls = set()
    for item in items:
        section = item.get("section")
        sections[section] = sections.get(section, 0) + 1

        if section not in EXPECTED_SECTIONS:
            errors.append(f"Unknown section: {section} :: {item.get('title')}")

        for field in ["id", "title", "url", "source_id", "source_name", "score", "urbanforest_relevance", "benefit_categories", "local_relevance"]:
            if item.get(field) in (None, "", []):
                missing_fields.append((item.get("title"), field))

        url = key_url(item.get("url", ""))
        if url:
            if url in seen_urls:
                duplicate_urls[url] = duplicate_urls.get(url, 1) + 1
            seen_urls.add(url)

    for section, minimum in REQUIRED_MINIMUMS.items():
        if sections.get(section, 0) < minimum:
            errors.append(f"Section {section} has {sections.get(section, 0)} items, below required minimum {minimum}.")

    if missing_fields:
        for title, field in missing_fields[:20]:
            errors.append(f"Missing field {field}: {title}")
        if len(missing_fields) > 20:
            errors.append(f"{len(missing_fields) - 20} more missing-field issues.")

    if duplicate_urls:
        for url, count in list(duplicate_urls.items())[:20]:
            warnings.append(f"Duplicate URL appears {count} times: {url}")

    watch_count = sum(1 for item in items if "watch-source" in (item.get("tags") or []))
    watch_ratio = watch_count / max(1, len(items))
    if watch_ratio > 0.35:
        warnings.append(f"Watch-source ratio is high: {watch_count}/{len(items)} = {watch_ratio:.2%}")

    research_count = sections.get("research-evidence", 0)
    if research_count / max(1, len(items)) > 0.55:
        warnings.append(f"Research lane dominates current output: {research_count}/{len(items)}.")

    if HEALTH.exists():
        health = load_json(HEALTH)
        health_sections = health.get("items_by_section", {})
        for section, count in sections.items():
            if health_sections.get(section) not in (None, count):
                warnings.append(f"source-health section count mismatch for {section}: health={health_sections.get(section)} news={count}")

    if not DIGEST.exists():
        warnings.append("weekly-digest.json is missing before validation.")

    if WORKFLOW.exists():
        workflow_text = WORKFLOW.read_text(encoding="utf-8")
        for script in [
            "discover_urbanforest_news.py",
            "ensure_urbanforest_watch_lanes.py",
            "audit_urbanforest_radar.py",
            "validate_urbanforest_radar.py",
        ]:
            if script not in workflow_text:
                errors.append(f"Workflow does not run {script}.")
    else:
        warnings.append("Refresh workflow file not found.")

    report = {
        "generated_at": now_utc(),
        "status": "fail" if errors else "pass",
        "total_items": len(items),
        "items_by_section": sections,
        "watch_source_count": watch_count,
        "watch_source_ratio": round(watch_ratio, 4),
        "errors": errors,
        "warnings": warnings,
    }

    VALIDATION.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))

    if errors:
        sys.exit(1)

if __name__ == "__main__":
    main()
