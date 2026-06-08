#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "demos/ietm/data/storage-flexibility.json"
OUT_JSON = ROOT / "demos/ietm/data/storage-ranked.json"
OUT_CSV = ROOT / "demos/ietm/data/storage-ranked.csv"
OUT_MD = ROOT / "demos/ietm/data/storage-ranked.md"

IRELAND_TERMS = [
    "ireland", "irish", "eirgrid", "esb", "cru", "sem-o", "semo",
    "dublin", "cork", "galway", "limerick", "waterford", "carlow",
    "kildare", "meath", "wicklow", "wexford", "clare", "kerry",
    "mayo", "sligo", "donegal", "louth", "offaly", "laois",
    "tipperary", "kilkenny", "westmeath", "longford", "roscommon",
    "leitrim", "monaghan", "cavan"
]

NOISE_TERMS = [
    "self storage", "cloud storage", "data storage", "phone storage",
    "warehouse", "ssd", "iphone", "android", "computer storage",
    "gas storage levels", "food storage"
]

STRONG_STORAGE_TERMS = [
    "battery", "bess", "energy storage", "long duration", "ldes",
    "hydrogen", "h2", "pumped hydro", "grid flexibility",
    "flexibility", "cavern", "storage power station", "four-hour", "4-hour"
]

STATUS_POINTS = {
    "operational": 18,
    "connected": 18,
    "energised": 18,
    "approved": 14,
    "permission granted": 14,
    "planning": 8,
    "proposed": 6,
    "consultation": 5,
    "refused": -10,
    "rejected": -10
}

TRUSTED_DOMAINS = [
    "eirgrid.ie",
    "cru.ie",
    "esb.ie",
    "pleanala.ie",
    "rte.ie",
    "gov.ie",
    "sem-o.com",
    "statkraft.ie",
    "energystorageireland.com",
    "renews.biz"
]

def as_text(item: dict) -> str:
    parts = [
        item.get("name", ""),
        item.get("developer", ""),
        item.get("location", ""),
        item.get("technology", ""),
        item.get("asset_type", ""),
        item.get("status", ""),
        item.get("planning_reference", ""),
        item.get("counting_rule", ""),
        " ".join(item.get("watch_flags", []) or []),
    ]
    for source in item.get("sources", []) or []:
        if isinstance(source, dict):
            parts.append(source.get("label", ""))
            parts.append(source.get("url", ""))
    return " ".join(str(p) for p in parts).lower()

def first_source(item: dict) -> dict:
    sources = item.get("sources", []) or []
    if sources and isinstance(sources[0], dict):
        return sources[0]
    return {}

def source_domain(item: dict) -> str:
    url = first_source(item).get("url", "")
    try:
        return urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return ""

def has_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)

def numeric(item: dict, field: str) -> float:
    try:
        return float(item.get(field) or 0)
    except Exception:
        return 0.0

def classify_relevance(text: str) -> str:
    in_ireland = has_any(text, IRELAND_TERMS)
    interconnector = "interconnector" in text or "interconnection" in text

    if in_ireland:
        return "in Ireland"
    if interconnector:
        return "for Ireland"
    if has_any(text, STRONG_STORAGE_TERMS):
        return "benchmark only"
    return "unclear"

def classify_bucket(score: int, relevance: str) -> str:
    if score >= 55 and relevance in {"in Ireland", "for Ireland"}:
        return "Promising"
    if score >= 35:
        return "Watch"
    if score >= 18:
        return "Background"
    return "Reject/noise"

def score_item(item: dict) -> tuple[int, list[str], str]:
    text = as_text(item)
    score = 0
    reasons: list[str] = []

    if has_any(text, NOISE_TERMS):
        score -= 40
        reasons.append("noise term")

    if has_any(text, STRONG_STORAGE_TERMS):
        score += 18
        reasons.append("storage-specific language")

    relevance = classify_relevance(text)
    if relevance == "in Ireland":
        score += 22
        reasons.append("Ireland-sited or Ireland-specific")
    elif relevance == "for Ireland":
        score += 12
        reasons.append("system-relevant for Ireland")
    elif relevance == "benchmark only":
        score += 4
        reasons.append("benchmark only")

    capacity = numeric(item, "capacity_mw")
    energy = numeric(item, "energy_gwh")
    duration = numeric(item, "duration_hours")

    if capacity >= 50:
        score += 12
        reasons.append(">=50 MW")
    elif capacity > 0:
        score += 5
        reasons.append("capacity stated")

    if energy >= 0.2:
        score += 8
        reasons.append("energy capacity stated")

    if duration >= 4:
        score += 12
        reasons.append("4h+ duration")
    elif duration > 0:
        score += 4
        reasons.append("duration stated")

    if item.get("planning_reference"):
        score += 10
        reasons.append("planning reference")

    domain = source_domain(item)
    if any(domain.endswith(d) for d in TRUSTED_DOMAINS):
        score += 10
        reasons.append(f"trusted source: {domain}")

    for term, points in STATUS_POINTS.items():
        if term in text:
            score += points
            reasons.append(term)

    if item.get("counting_rule"):
        score += 3
        reasons.append("counting rule present")

    return score, reasons, relevance

def clean_row(item: dict, rank: int) -> dict:
    score, reasons, relevance = score_item(item)
    source = first_source(item)
    return {
        "rank": rank,
        "score": score,
        "bucket": classify_bucket(score, relevance),
        "relevance": relevance,
        "id": item.get("id", ""),
        "name": item.get("name", ""),
        "status": item.get("status", ""),
        "asset_type": item.get("asset_type", ""),
        "capacity_mw": item.get("capacity_mw", ""),
        "duration_hours": item.get("duration_hours", ""),
        "energy_gwh": item.get("energy_gwh", ""),
        "investment_eur_bn": item.get("investment_eur_bn", ""),
        "location": item.get("location", ""),
        "developer": item.get("developer", ""),
        "planning_reference": item.get("planning_reference", ""),
        "technology": item.get("technology", ""),
        "counting_rule": item.get("counting_rule", ""),
        "source": source.get("label", ""),
        "url": source.get("url", ""),
        "reasons": reasons,
        "raw": item
    }

def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing {SOURCE.relative_to(ROOT)}")

    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    raw_items = data.get("items", [])

    rows = [clean_row(item, 0) for item in raw_items if isinstance(item, dict)]
    rows.sort(key=lambda row: row["score"], reverse=True)

    for idx, row in enumerate(rows, start=1):
        row["rank"] = idx

    summary = {
        "total": len(rows),
        "promising": sum(1 for r in rows if r["bucket"] == "Promising"),
        "watch": sum(1 for r in rows if r["bucket"] == "Watch"),
        "background": sum(1 for r in rows if r["bucket"] == "Background"),
        "reject_noise": sum(1 for r in rows if r["bucket"] == "Reject/noise")
    }

    OUT_JSON.write_text(json.dumps({
        "generated_from": str(SOURCE.relative_to(ROOT)),
        "source_generated_at": data.get("generated_at", ""),
        "item_count": len(rows),
        "summary": summary,
        "ranking_note": "Default public view should show Promising and Watch only. Background and Reject/noise are retained for audit.",
        "items": rows
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    csv_rows = []
    for row in rows:
        flat = {k: v for k, v in row.items() if k not in {"raw", "reasons"}}
        flat["reasons"] = "; ".join(row["reasons"])
        csv_rows.append(flat)

    if csv_rows:
        with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys()))
            writer.writeheader()
            writer.writerows(csv_rows)

    lines = [
        "# Storage Watcher ranked shortlist",
        "",
        f"Source items: {len(rows)}",
        "",
        "| Rank | Score | Bucket | Relevance | Name | Type | Status | Capacity | Why |",
        "|---:|---:|---|---|---|---|---|---:|---|"
    ]

    for row in rows[:60]:
        name = str(row["name"]).replace("|", " ")
        if row["url"]:
            name = f"[{name}]({row['url']})"
        lines.append(
            f"| {row['rank']} | {row['score']} | {row['bucket']} | {row['relevance']} | "
            f"{name} | {row['asset_type']} | {row['status']} | {row['capacity_mw']} MW | "
            f"{'; '.join(row['reasons'])} |"
        )

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"Wrote {OUT_CSV.relative_to(ROOT)}")
    print(f"Wrote {OUT_MD.relative_to(ROOT)}")
    print("Summary:", summary)

if __name__ == "__main__":
    main()
