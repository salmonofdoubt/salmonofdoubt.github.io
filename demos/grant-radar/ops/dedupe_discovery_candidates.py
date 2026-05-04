#!/usr/bin/env python3
"""Deduplicate Grant Radar discovery candidates.

Keeps the best candidate per:
1. canonical_family_key / normalised URL
2. domain + normalised title

This catches imported legacy duplicates where the same opportunity appears
through several seed pages or slightly different URLs.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse, urlunparse

DATA = Path("demos/grant-radar/data/discovery-candidates.json")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def normalise_url(url: str) -> str:
    parsed = urlparse(str(url or "").strip())
    clean = parsed._replace(
        scheme=parsed.scheme.lower() or "https",
        netloc=parsed.netloc.lower().removeprefix("www."),
        path=parsed.path.rstrip("/"),
        params="",
        query="",
        fragment="",
    )
    return urlunparse(clean)


def normalise_title(title: str) -> str:
    text = str(title or "").lower()
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^a-z0-9€£$.,:/%+\-\s]", "", text)
    text = text.strip()

    # Remove agency suffixes that create fake title variants.
    text = re.sub(r"\s*-\s*european climate, infrastructure and environment executive agency\s*$", "", text)
    text = re.sub(r"\s*-\s*european research executive agency\s*$", "", text)
    text = re.sub(r"\s*\|\s*.*$", "", text)

    return text.strip()


def domain_of(item: dict) -> str:
    if item.get("domain"):
        return str(item["domain"]).lower().removeprefix("www.")
    return urlparse(str(item.get("url") or "")).netloc.lower().removeprefix("www.")


def dedupe_key(item: dict) -> tuple[str, str]:
    url = normalise_url(item.get("canonical_family_key") or item.get("url") or "")
    title = normalise_title(item.get("title") or "")
    domain = domain_of(item)

    if title:
        return ("title", f"{domain}::{title}")

    return ("url", url)


def score(item: dict) -> tuple:
    status_rank = {
        "pending_review": 5,
        "promoted": 4,
        "suppressed_existing": 3,
        "suppressed_non_actionable": 2,
        "suppressed_generic_page": 2,
        "rejected": 1,
    }

    mode_relevance = item.get("mode_relevance") or {}
    geo_fit = mode_relevance.get("geo") in {"include", "maybe"}
    positive_modes = sum(1 for v in mode_relevance.values() if v in {"include", "maybe"})

    return (
        status_rank.get(item.get("status"), 0),
        bool(item.get("deadline_hint")),
        geo_fit,
        positive_modes,
        float(item.get("confidence") or 0),
        bool(item.get("seen_in_latest_run")),
        len(str(item.get("snippet") or "")),
    )


def merge_keep(best: dict, other: dict) -> dict:
    """Keep best but retain useful provenance from duplicate."""
    merged = dict(best)

    reasons = []
    for item in (best, other):
        for r in item.get("promotion_reasons") or []:
            if r and r not in reasons:
                reasons.append(r)

    if other.get("url") and other.get("url") != best.get("url"):
        note = f"Duplicate candidate collapsed from {other.get('url')}"
        if note not in reasons:
            reasons.append(note)

    merged["promotion_reasons"] = reasons[:8]

    notes = [str(best.get("notes") or "").strip(), str(other.get("notes") or "").strip()]
    notes = [n for n in notes if n]
    if notes:
        merged["notes"] = " | ".join(dict.fromkeys(notes))

    return merged


def main() -> None:
    candidates = load_json(DATA)

    kept: dict[tuple[str, str], dict] = {}
    duplicates = []

    for item in candidates:
        key = dedupe_key(item)

        if key not in kept:
            kept[key] = item
            continue

        current = kept[key]

        if score(item) > score(current):
            kept[key] = merge_keep(item, current)
            duplicates.append((key, current, item))
        else:
            kept[key] = merge_keep(current, item)
            duplicates.append((key, item, current))

    result = list(kept.values())
    result.sort(
        key=lambda c: (
            0 if c.get("status") == "pending_review" else 1,
            c.get("source_pack") != "geo",
            -float(c.get("confidence") or 0),
            normalise_title(c.get("title") or ""),
        )
    )

    save_json(DATA, result)

    print("Before:", len(candidates))
    print("After: ", len(result))
    print("Removed duplicates:", len(candidates) - len(result))

    print("\nCollapsed duplicate titles:")
    seen_titles = set()
    for _, removed, kept_item in duplicates:
        title = removed.get("title") or ""
        if title in seen_titles:
            continue
        seen_titles.add(title)
        print("-", title)
        print("  removed:", removed.get("url"))
        print("  kept:   ", kept_item.get("url"))


if __name__ == "__main__":
    main()
