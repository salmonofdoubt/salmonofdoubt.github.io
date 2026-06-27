#!/usr/bin/env python3
"""Grant Radar health check.

Fails on catalogue regressions:
- critical public opportunities vanish
- future-deadline calls are not marked open
- duplicate/generic promoted pages leak into public catalogue
- research-only routes leak into NDRT mode
- required opportunity fields are missing or invalid
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse, urlunparse

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"

CATALOG_PATH = DATA_DIR / "catalog.json"
REGISTRY_PATH = DATA_DIR / "source-registry.json"
DISCOVERY_AUDIT_PATH = DATA_DIR / "discovery-audit.json"
HARVEST_AUDIT_PATH = DATA_DIR / "harvest-audit.json"

VALID_PROGRAMME_KINDS = {
    "announcement_or_results",
    "one_off_call",
    "recurring_programme",
    "rolling_support",
}

VALID_PROGRAMME_STATES = {
    "archived",
    "closed",
    "open",
    "upcoming",
}

VALID_PUBLIC_STATES = {
    "public_visible",
    "review_only",
    "discovery_only",
}

CRITICAL_PUBLIC_SOURCES = {
    "heritage_community_grant": "Heritage Council Community Heritage Grant Scheme",
    "research_ireland_discover": "Research Ireland Discover Programme",
    "lawpro_cwdf": "LAWPRO Community Water Development Fund",
    "lawpro_small_grants": "LAWPRO Small Grants and Events Scheme",
    "ifi_habitats_conservation": "IFI Habitats & Conservation Funding Call",
}

FORBIDDEN_PUBLIC_SOURCE_IDS = {
    "funding",
    "heritage_funding_opportunities",
    "online_grants_system",
}

NDRT_EXCLUDED_SOURCE_IDS = {
    "teagasc_walsh",
    "research_ireland_goipg",
}

REQUIRED_FIELDS = {
    "id",
    "source_id",
    "title",
    "url",
    "programme_state",
    "programme_kind",
    "public_visible_state",
    "purposes",
    "mode_relevance",
}


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_url(url: str) -> str:
    parsed = urlparse(url)
    clean = parsed._replace(
        scheme=(parsed.scheme or "https").lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
    )
    out = urlunparse(clean)
    if out.endswith("/") and clean.path not in ("", "/"):
        out = out[:-1]
    return out


def parse_dt(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except Exception:
        return None


def line(kind: str, message: str):
    print(f"[{kind}] {message}")


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []

    catalog = load_json(CATALOG_PATH, None)
    if not catalog:
        line("FAIL", f"Missing or unreadable {CATALOG_PATH}")
        return 1

    registry = load_json(REGISTRY_PATH, [])
    opportunities = catalog.get("opportunities", [])
    sources = catalog.get("sources", [])

    if not isinstance(opportunities, list):
        failures.append("catalog.opportunities is not a list.")
        opportunities = []

    if not isinstance(sources, list):
        failures.append("catalog.sources is not a list.")
        sources = []

    public_items = [
        item for item in opportunities
        if item.get("public_visible_state") == "public_visible"
    ]

    public_by_source: dict[str, list[dict]] = {}
    for item in public_items:
        public_by_source.setdefault(item.get("source_id", ""), []).append(item)

    # Schema and enum validation.
    seen_ids = set()
    for item in opportunities:
        item_id = item.get("id", "<missing-id>")

        missing = REQUIRED_FIELDS - set(item.keys())
        if missing:
            failures.append(f"{item_id}: missing required fields {sorted(missing)}")

        if item_id in seen_ids:
            failures.append(f"Duplicate opportunity id: {item_id}")
        seen_ids.add(item_id)

        if item.get("programme_kind") not in VALID_PROGRAMME_KINDS:
            failures.append(f"{item_id}: invalid programme_kind={item.get('programme_kind')!r}")

        if item.get("programme_state") not in VALID_PROGRAMME_STATES:
            failures.append(f"{item_id}: invalid programme_state={item.get('programme_state')!r}")

        if item.get("public_visible_state") not in VALID_PUBLIC_STATES:
            failures.append(f"{item_id}: invalid public_visible_state={item.get('public_visible_state')!r}")

        if not isinstance(item.get("purposes"), list):
            failures.append(f"{item_id}: purposes is not a list.")

        if not isinstance(item.get("mode_relevance"), dict):
            failures.append(f"{item_id}: mode_relevance is not a dict.")

        if not item.get("state_source"):
            warnings.append(f"{item_id}: no state_source provenance field yet.")

    # Critical public cards must exist.
    for source_id, label in CRITICAL_PUBLIC_SOURCES.items():
        if source_id not in public_by_source:
            failures.append(f"Critical public card missing: {source_id} ({label})")

    # Known bad generic Heritage pages must not leak back into public catalogue.
    for item in public_items:
        if item.get("source_id") in FORBIDDEN_PUBLIC_SOURCE_IDS or item.get("id") in FORBIDDEN_PUBLIC_SOURCE_IDS:
            failures.append(f"Forbidden generic source leaked into public catalogue: {item.get('source_id')} / {item.get('id')}")

    # Duplicate public URLs are usually a promotion/dedup failure.
    url_map: dict[str, list[str]] = {}
    for item in public_items:
        url = canonical_url(item.get("url", ""))
        if url:
            url_map.setdefault(url, []).append(item.get("id", "<missing-id>"))

    for url, ids in sorted(url_map.items()):
        if len(ids) > 1:
            failures.append(f"Duplicate public URL {url}: {ids}")

    # Future deadline means open, unless explicitly upcoming.
    now = datetime.now(UTC)
    for item in public_items:
        deadline = parse_dt(item.get("deadline_iso"))
        if deadline and deadline > now:
            if item.get("programme_state") != "open":
                failures.append(
                    f"{item.get('id')}: future deadline {item.get('deadline_text') or item.get('deadline_iso')} "
                    f"but programme_state={item.get('programme_state')!r}"
                )

    # Research Ireland Discover should be open only when a future deadline has been parsed.
    for item in public_by_source.get("research_ireland_discover", []):
        deadline = parse_dt(item.get("deadline_iso"))
        if deadline and deadline > now and item.get("programme_state") != "open":
            failures.append("Research Ireland Discover has a future deadline but is not marked open.")

    # NDRT mode sanity: research-only routes must not be included.
    for item in opportunities:
        if item.get("source_id") in NDRT_EXCLUDED_SOURCE_IDS:
            ndrt_value = (item.get("mode_relevance") or {}).get("ndrt")
            if ndrt_value == "include":
                failures.append(f"{item.get('source_id')} leaks into NDRT mode as include.")

    # Discovery and harvest audit presence.
    discovery_audit = load_json(DISCOVERY_AUDIT_PATH, None)
    if not discovery_audit:
        warnings.append("discovery-audit.json is missing. Discovery coverage cannot be audited.")
    else:
        if discovery_audit.get("seed_count", 0) <= 0:
            failures.append("Discovery audit has zero seeds.")
        if discovery_audit.get("funding_like_links", 0) <= 0:
            warnings.append("Discovery audit found zero funding-like links.")

    harvest_audit = load_json(HARVEST_AUDIT_PATH, None)
    if not harvest_audit:
        warnings.append("harvest-audit.json is missing. Harvest state provenance cannot be audited.")
    else:
        for f in harvest_audit.get("fetch_failures_using_registry_fallback", []):
            warnings.append(
                f"Fetch failure used registry fallback, not last-known-good: {f.get('id')} ({f.get('name')})"
            )

    # Registry sanity: critical entries should exist there too.
    registry_ids = {source.get("id") for source in registry if isinstance(source, dict)}
    for source_id in CRITICAL_PUBLIC_SOURCES:
        if source_id not in registry_ids:
            failures.append(f"Critical source missing from source-registry.json: {source_id}")

    print()
    print("Grant Radar health check")
    print("========================")
    print(f"Sources in catalogue: {len(sources)}")
    print(f"Opportunities total: {len(opportunities)}")
    print(f"Public opportunities: {len(public_items)}")
    print(f"Registry sources: {len(registry_ids)}")
    print()

    if warnings:
        print("Warnings")
        print("--------")
        for msg in warnings[:80]:
            line("WARN", msg)
        if len(warnings) > 80:
            line("WARN", f"... {len(warnings) - 80} more warnings omitted")
        print()

    if failures:
        print("Failures")
        print("--------")
        for msg in failures:
            line("FAIL", msg)
        print()
        print(f"Result: FAIL ({len(failures)} failure(s), {len(warnings)} warning(s))")
        return 1

    print(f"Result: OK ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
