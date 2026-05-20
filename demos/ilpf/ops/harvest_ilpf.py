#!/usr/bin/env python3
"""
ILPF harvester.

Purpose
-------
Fetch public Irish Life / myBline fund-performance pages once per run and write
static JSON files for a GitHub Pages dashboard.

Important
---------
This does not log in to Irish Life. It only collects public fund information.
Irish Life notes that funds can be released in multiple series and that public
fund charges/prices may not match the precise series held by a member.

Outputs
-------
../data/funds.json    Current watchlist snapshot.
../data/history.json  Append-only daily history by fund ID and source date.

Run locally
-----------
python demos/ilpf/ops/harvest_ilpf.py
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CURRENT_PATH = DATA_DIR / "funds.json"
HISTORY_PATH = DATA_DIR / "history.json"

MYBLINE_URL = "https://my.bline.ie/fund-centre"
IRISHLIFE_INVESTMENT_URL = "https://www.irishlife.ie/investments/fund-prices-and-performance-investments/"
IRISHLIFE_HUB_URL = "https://www.irishlife.ie/fund-information/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; IrishLifeFundWatch/1.0; "
        "+https://github.com/salmonofdoubt/salmonofdoubt.github.io)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IE,en;q=0.9",
}

# Watchlist requested by the user. Keep aliases conservative to avoid reporting a
# different fund as if it were the exact pension series.
WATCHLIST: list[dict[str, Any]] = [
    {
        "id": "new-world-indexed-all-country-equity",
        "display_name": "New World Indexed All Country Equity Fund",
        "aliases": [
            "New World Indx All Country Equity Fund",
            "New World Indexed All Country Equity Fund",
        ],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?SQ4=",
    },
    {
        "id": "consensus",
        "display_name": "Consensus Fund",
        "aliases": ["Consensus Fund"],
    },
    {
        "id": "empower-annuity-objective",
        "display_name": "EMPOWER Annuity Objective Fund",
        "aliases": ["EMPOWER Annuity Objective Fund", "Empower Annuity Objective Fund"],
    },
    {
        "id": "empower-cash",
        "display_name": "EMPOWER Cash Fund",
        "aliases": ["EMPOWER Cash Fund", "Empower Cash Fund"],
    },
    {
        "id": "empower-cautious-growth",
        "display_name": "EMPOWER Cautious Growth Fund",
        "aliases": ["EMPOWER Cautious Growth Fund", "Empower Cautious Growth Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?XEC=",
    },
    {
        "id": "empower-growth",
        "display_name": "EMPOWER Growth Fund",
        "aliases": ["EMPOWER Growth Fund", "Empower Growth Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?OPG=",
    },
    {
        "id": "empower-high-growth",
        "display_name": "EMPOWER High Growth Fund",
        "aliases": ["EMPOWER High Growth Fund", "Empower High Growth Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?XEH=",
    },
    {
        "id": "empower-stability",
        "display_name": "EMPOWER Stability Fund",
        "aliases": ["EMPOWER Stability Fund", "Empower Stability Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?XES=",
    },
    {
        "id": "indexed-world-equity",
        "display_name": "Indexed World Equity Fund",
        "aliases": ["Indexed World Equity Fund", "Indexed World Equities"],
    },
    {
        "id": "irish-property",
        "display_name": "Irish Property Fund",
        "aliases": ["Irish Property Fund", "Irish Property Fund (Irish Prop IS)", "Pension Property Fund"],
    },
    {
        "id": "multi-manager-target-return",
        "display_name": "Multi-Manager Target Return Fund",
        "aliases": ["Multi Manager Target Return Fund", "Multi-Manager Target Return Fund"],
    },
    {
        "id": "new-world-indexed-emerging-market-equity",
        "display_name": "New World Indexed Emerging Market Equity Fund",
        "aliases": [
            "New World Indx EM Equity Fund",
            "New World Indexed Emerging Market Equity Fund",
            "New World Indexed EM Equity Fund",
        ],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?IG3=",
    },
    {
        "id": "new-world-indexed-euro-corporate-bond",
        "display_name": "New World Indexed Euro Corporate Bond Fund",
        "aliases": [
            "New World Indx Euro Corporate Bond Fund",
            "New World Indexed Euro Corporate Bond Fund",
            "New World Indexed Euro Corporate Bond",
        ],
    },
    {
        "id": "alternative-energy",
        "display_name": "Alternative Energy Fund",
        "aliases": ["Alternative Energy Fund"],
    },
    {
        "id": "water",
        "display_name": "Water Fund",
        "aliases": ["Water Fund"],
    },
    {
        "id": "indexed-global-sustainable-equity",
        "display_name": "Indexed Global Sustainable Equity Fund",
        "aliases": ["Indexed Global Sustainable Equity Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?GGL=",
    },
    {
        "id": "indexed-islamic-equity",
        "display_name": "Indexed Islamic Equity Fund",
        "aliases": ["Indexed Islamic Equity Fund"],
        "employer_url": "https://www.irishlifeemployersolutions.ie/fund?FWB=",
    },
]

PERF_KEYS = [
    "one_month",
    "three_months",
    "six_months",
    "one_year",
    "three_years",
    "five_years",
    "ten_years",
    "since_launch",
]

DATE_RE = re.compile(r"\b\d{1,2}/\d{1,2}/\d{4}\b")
ASOF_RE = re.compile(r"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b")
PCT_RE = re.compile(r"[-+]?\d+(?:\.\d+)?%|-+")
RISK_RE = re.compile(r"\bIL\s*([1-7])\b|\bRisk\s*([1-7])\b", re.I)


@dataclass
class FundRow:
    canonical_name: str
    source_name: str | None
    status: str
    risk: str | None = None
    launch_date: str | None = None
    performance_to: str | None = None
    performance: dict[str, float | None] | None = None
    source_url: str | None = None
    factsheet_url: str | None = None
    note: str | None = None


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\bindx\b", "indexed", text)
    text = re.sub(r"\bem\b", "emerging market", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_percent(token: str) -> float | None:
    token = token.strip()
    if not token or set(token) == {"-"}:
        return None
    return float(token.replace("%", ""))


def get_html(url: str) -> str:
    response = requests.get(url, headers=HEADERS, timeout=35)
    response.raise_for_status()
    return response.text


def absolute_url(base: str, href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith("http"):
        return href
    parsed = urlparse(base)
    root = f"{parsed.scheme}://{parsed.netloc}"
    if href.startswith("/"):
        return root + href
    return root + "/" + href


def row_from_tokens(name: str, tokens: list[str], source_url: str, factsheet_url: str | None = None) -> FundRow | None:
    text = " ".join(t for t in tokens if t)
    risk_match = RISK_RE.search(text)
    risk = None
    if risk_match:
        risk = risk_match.group(1) or risk_match.group(2)

    launch_match = DATE_RE.search(text)
    asof_matches = ASOF_RE.findall(text)
    pct_tokens = PCT_RE.findall(text)

    if not launch_match or len(pct_tokens) < 4:
        return None

    performance = {key: None for key in PERF_KEYS}
    for key, token in zip(PERF_KEYS, pct_tokens[: len(PERF_KEYS)]):
        performance[key] = parse_percent(token)

    return FundRow(
        canonical_name=name,
        source_name=name,
        status="ok",
        risk=risk,
        launch_date=launch_match.group(0),
        performance_to=asof_matches[-1] if asof_matches else None,
        performance=performance,
        source_url=source_url,
        factsheet_url=factsheet_url,
        note="Public performance table. This may not be the exact member policy series.",
    )


def parse_mybline(html: str) -> dict[str, FundRow]:
    soup = BeautifulSoup(html, "html.parser")
    rows: dict[str, FundRow] = {}

    # Preferred parser: HTML table rows.
    for tr in soup.select("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["th", "td"])]
        if len(cells) < 5:
            continue
        link = tr.find("a")
        name = link.get_text(" ", strip=True) if link else cells[0]
        if not name or "fund" not in name.lower() and "equit" not in name.lower() and "consensus" not in name.lower():
            continue
        factsheet_link = None
        for a in tr.find_all("a"):
            if "factsheet" in a.get_text(" ", strip=True).lower():
                factsheet_link = absolute_url(MYBLINE_URL, a.get("href"))
                break
        row = row_from_tokens(name, cells, MYBLINE_URL, factsheet_link)
        if row:
            rows[normalise(name)] = row

    # Fallback parser: rendered text order. Useful when the public page is a
    # Drupal/JS hybrid but the server still includes table text.
    if not rows:
        lines = [line.strip() for line in soup.get_text("\n").splitlines() if line.strip()]
        fund_link_by_text = {
            a.get_text(" ", strip=True): absolute_url(MYBLINE_URL, a.get("href"))
            for a in soup.find_all("a")
            if a.get_text(" ", strip=True)
        }
        for i, line in enumerate(lines):
            if not looks_like_fund_name(line):
                continue
            block = lines[i : i + 10]
            factsheet = None
            if "View Factsheet" in " ".join(block):
                # There may be more than one link nearby. Keep this conservative;
                # a missing factsheet URL is preferable to a wrong one.
                factsheet = fund_link_by_text.get("View Factsheet")
            row = row_from_tokens(line, block, MYBLINE_URL, factsheet)
            if row:
                rows[normalise(line)] = row

    return rows


def looks_like_fund_name(text: str) -> bool:
    lower = text.lower()
    if len(text) > 90 or len(text) < 5:
        return False
    return any(word in lower for word in ["fund", "equities", "equity", "consensus", "maps", "portfolio", "stability"])


def match_watchlist(target: dict[str, Any], parsed_rows: dict[str, FundRow]) -> FundRow | None:
    alias_norms = [normalise(a) for a in target.get("aliases", [])]

    for alias in alias_norms:
        if alias in parsed_rows:
            return parsed_rows[alias]

    # Conservative fuzzy match: alias must be wholly contained in source or vice versa.
    for alias in alias_norms:
        for key, row in parsed_rows.items():
            if alias and (alias in key or key in alias):
                # Avoid accidental EMPOWER/Empower external matches by requiring fund-like names.
                if len(alias.split()) >= 3:
                    return row
    return None


def check_employer_page(target: dict[str, Any]) -> tuple[str | None, str | None]:
    url = target.get("employer_url")
    if not url:
        return None, None
    try:
        html = get_html(url)
    except Exception as exc:  # noqa: BLE001
        return url, f"Employer Solutions page check failed: {exc}"
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    if "Data for this fund is currently unavailable" in text:
        return url, "Irish Life Employer Solutions page exists, but currently says public data for this fund is unavailable."
    return url, "Irish Life Employer Solutions page exists, but this scraper did not find a public performance row."


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def merge_history(current: dict[str, Any]) -> dict[str, Any]:
    history = load_json(HISTORY_PATH, {"generated_at": None, "series": {}})
    series = history.setdefault("series", {})

    for fund in current["funds"]:
        fund_id = fund["id"]
        series.setdefault(fund_id, [])
        if fund.get("status") != "ok":
            continue
        perf_to = fund.get("performance_to") or current.get("generated_at")[:10]
        existing_dates = {entry.get("performance_to") for entry in series[fund_id]}
        if perf_to in existing_dates:
            # Replace same source date to correct any parser/source changes.
            series[fund_id] = [e for e in series[fund_id] if e.get("performance_to") != perf_to]
        series[fund_id].append(
            {
                "performance_to": perf_to,
                "harvested_at": current["generated_at"],
                "risk": fund.get("risk"),
                "performance": fund.get("performance"),
                "source_name": fund.get("source_name"),
            }
        )
        series[fund_id] = sorted(series[fund_id], key=lambda e: e.get("performance_to") or "")[-730:]

    history["generated_at"] = current["generated_at"]
    return history


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    warnings: list[str] = []
    source_html = ""
    try:
        source_html = get_html(MYBLINE_URL)
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"Could not fetch {MYBLINE_URL}: {exc}")

    parsed_rows = parse_mybline(source_html) if source_html else {}

    funds: list[dict[str, Any]] = []
    for target in WATCHLIST:
        matched = match_watchlist(target, parsed_rows)
        if matched:
            payload = asdict(matched)
            payload.update(
                {
                    "id": target["id"],
                    "display_name": target["display_name"],
                    "aliases": target.get("aliases", []),
                }
            )
            funds.append(payload)
            continue

        employer_url, note = check_employer_page(target)
        funds.append(
            {
                "id": target["id"],
                "display_name": target["display_name"],
                "aliases": target.get("aliases", []),
                "canonical_name": target["display_name"],
                "source_name": None,
                "status": "missing_public_row",
                "risk": None,
                "launch_date": None,
                "performance_to": None,
                "performance": None,
                "source_url": employer_url or MYBLINE_URL,
                "factsheet_url": None,
                "note": note or "No matching public row found on the myBline fund centre.",
            }
        )
        time.sleep(0.3)

    ok_count = sum(1 for f in funds if f["status"] == "ok")
    current = {
        "schema_version": 1,
        "generated_at": generated_at,
        "source_pages": [MYBLINE_URL, IRISHLIFE_HUB_URL, IRISHLIFE_INVESTMENT_URL],
        "disclaimer": (
            "Public fund information only. Irish Life may operate multiple fund series; "
            "public fund charges and pricing may not match the exact series held in a member policy."
        ),
        "summary": {
            "watchlist_count": len(funds),
            "matched_public_rows": ok_count,
            "missing_public_rows": len(funds) - ok_count,
        },
        "warnings": warnings,
        "funds": funds,
    }

    CURRENT_PATH.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    history = merge_history(current)
    HISTORY_PATH.write_text(json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {CURRENT_PATH.relative_to(ROOT.parent.parent)}")
    print(f"Wrote {HISTORY_PATH.relative_to(ROOT.parent.parent)}")
    print(f"Matched {ok_count}/{len(funds)} public fund rows")
    return 0 if ok_count > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
