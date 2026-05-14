#!/usr/bin/env python3
"""
SEAI price harvester for Ireland Energy Monitor.

Strategy:
1. Try to fetch and parse SEAI's Energy Price Trends page.
2. If SEAI blocks the request, write a small official fallback snapshot.
3. Never break the public site because of a blocked source.

Official fallback values currently embedded from SEAI Energy Price Trends page:
- Household electricity 2025S1: 31.72 c/kWh; 2024S2: 30.59 c/kWh; EU-27 2025S1: 29.34 c/kWh
- Household gas 2025S1: 12.33 c/kWh; 2024S2: 13.68 c/kWh; EU-27 2025S1: 11.68 c/kWh
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUT = SOURCE / "prices.json"
METADATA = SOURCE / "metadata.json"

SEAI_PRICES_URL = "https://www.seai.ie/data-and-insights/seai-statistics/prices"


FALLBACK_ROWS = {
    "household_electricity": [
        {"period": "2024S2", "ireland": 30.59, "euro_area": 31.38, "eu27": 29.41},
        {"period": "2025S1", "ireland": 31.72, "euro_area": 31.20, "eu27": 29.34},
    ],
    "household_gas": [
        {"period": "2024S2", "ireland": 13.68, "euro_area": 13.55, "eu27": 12.76},
        {"period": "2025S1", "ireland": 12.33, "euro_area": 12.39, "eu27": 11.68},
    ],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fetch_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 IrelandEnergyMonitor/0.3 "
                "(+https://salmonofdoubt.github.io/demos/ietm/)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        raw = response.read()
    return raw.decode("utf-8", errors="replace")


def strip_html(html: str) -> str:
    text = re.sub(r"<script\b.*?</script>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = text.replace("&nbsp;", " ")
    text = text.replace("&amp;", "&")
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text


def normalise_period(period: str) -> str:
    period = period.strip()
    m = re.match(r"^S([12])\s+(\d{4})$", period)
    if m:
        return f"{m.group(2)}S{m.group(1)}"
    return period


def period_key(period: str) -> tuple[int, int]:
    p = normalise_period(period)
    m = re.match(r"^(\d{4})S([12])$", p)
    if not m:
        return (0, 0)
    return (int(m.group(1)), int(m.group(2)))


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def extract_table(text: str, title_pattern: str) -> list[dict[str, Any]]:
    start = re.search(title_pattern, text, flags=re.I)
    if not start:
        return []

    block = text[start.start(): start.start() + 25000]
    source_pos = re.search(r"\bSource\s*:", block, flags=re.I)
    if source_pos:
        block = block[:source_pos.start()]

    row_re = re.compile(
        r"\b((?:S[12]\s+\d{4})|(?:\d{4}S[12]))\s*,\s*"
        r"([0-9.]+)?\s*,\s*([0-9.]+)?\s*,\s*([0-9.]+)?"
    )

    rows = []
    for m in row_re.finditer(block):
        rows.append({
            "period": normalise_period(m.group(1)),
            "ireland": parse_float(m.group(2)),
            "euro_area": parse_float(m.group(3)),
            "eu27": parse_float(m.group(4)),
        })

    rows.sort(key=lambda r: period_key(r["period"]))
    return rows


def latest_with_previous(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    usable = [r for r in rows if r.get("ireland") is not None]
    if not usable:
        return None

    latest = usable[-1]
    previous = usable[-2] if len(usable) >= 2 else None

    change = None
    if previous and previous.get("ireland") is not None:
        change = latest["ireland"] - previous["ireland"]

    return {
        "latest": latest,
        "previous": previous,
        "change": change,
    }


def price_card(label: str, latest: dict[str, Any] | None, source_label: str) -> dict[str, Any]:
    if not latest:
        return {
            "label": label,
            "value": "n/a",
            "detail": f"Not mapped from {source_label}.",
            "status": "missing",
            "source": source_label,
        }

    row = latest["latest"]
    change = latest["change"]
    value = row["ireland"]
    period = row["period"]

    if change is None:
        change_text = "no previous comparison"
    else:
        direction = "up" if change > 0 else "down" if change < 0 else "flat"
        change_text = f"{direction} {abs(change):.2f} c/kWh from previous period"

    eu_text = ""
    if row.get("eu27") is not None:
        diff = value - row["eu27"]
        relation = "above" if diff > 0 else "below" if diff < 0 else "equal to"
        eu_text = f"; {abs(diff):.2f} c/kWh {relation} EU-27"

    return {
        "label": label,
        "value": f"{value:.2f} c/kWh",
        "detail": f"Latest official SEAI semester: {period}; {change_text}{eu_text}. Not a live supplier tariff.",
        "status": "mapped",
        "period": period,
        "ireland_c_per_kwh": value,
        "eu27_c_per_kwh": row.get("eu27"),
        "change_c_per_kwh": change,
        "unit": "Euro cent/kWh",
        "source": source_label,
    }


def write_metadata(success: bool, message: str, mode: str) -> None:
    existing = {}
    if METADATA.exists():
        try:
            existing = json.loads(METADATA.read_text())
        except json.JSONDecodeError:
            existing = {}

    sources = existing.get("sources", [])
    for source in [
        "SEAI Energy Price Trends page",
        "SEAI official fallback price snapshot",
    ]:
        if source not in sources:
            sources.append(source)

    existing.update({
        "last_seai_price_harvest_at": now_iso(),
        "seai_price_status": message,
        "seai_price_mode": mode,
        "sources": sources,
        "confidence": "Medium" if success else existing.get("confidence", "Low"),
    })

    METADATA.write_text(json.dumps(existing, indent=2) + "\n")


def build_payload(electricity_rows: list[dict[str, Any]], gas_rows: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    electricity_latest = latest_with_previous(electricity_rows)
    gas_latest = latest_with_previous(gas_rows)

    return {
        "prices": [
            price_card(
                "Household electricity",
                electricity_latest,
                "SEAI Energy Price Trends"
            ),
            price_card(
                "Household gas",
                gas_latest,
                "SEAI Energy Price Trends"
            ),
            {
                "label": "Transport fuels",
                "value": "pending",
                "detail": "Transport-fuel price layer not yet wired. Planned after electricity and gas.",
                "status": "planned",
                "source": "SEAI fuel price comparisons, planned",
            }
        ],
        "source_status": {
            "source": "SEAI Energy Price Trends",
            "source_url": SEAI_PRICES_URL,
            "harvested_at": now_iso(),
            "mode": mode,
            "electricity_household_rows": len(electricity_rows),
            "gas_household_rows": len(gas_rows),
            "caveat": (
                "Best-effort parser. If SEAI blocks scripted access, the site uses "
                "an embedded official fallback snapshot and labels it as such."
            )
        }
    }


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)

    try:
        html = fetch_text(SEAI_PRICES_URL)
        text = strip_html(html)

        electricity_rows = extract_table(text, r"Average electricity price to households")
        gas_rows = extract_table(text, r"Average gas price to households|Average natural gas price to households")

        if not electricity_rows or not gas_rows:
            raise RuntimeError("SEAI page fetched but expected household price tables were not parsed.")

        payload = build_payload(electricity_rows, gas_rows, "live-page-parse")
        OUT.write_text(json.dumps(payload, indent=2) + "\n")
        write_metadata(True, "SEAI price harvester succeeded using live page parse.", "live-page-parse")

        print(f"Wrote {OUT.relative_to(ROOT)} from live SEAI page")
        print(json.dumps(payload["source_status"], indent=2))
        return 0

    except Exception as exc:
        print(f"WARNING: SEAI live fetch/parse failed: {exc}", file=sys.stderr)

        payload = build_payload(
            FALLBACK_ROWS["household_electricity"],
            FALLBACK_ROWS["household_gas"],
            "official-fallback-snapshot"
        )
        OUT.write_text(json.dumps(payload, indent=2) + "\n")
        write_metadata(
            True,
            f"SEAI live fetch/parse failed; official fallback snapshot used. Reason: {exc}",
            "official-fallback-snapshot"
        )

        print(f"Wrote {OUT.relative_to(ROOT)} from official fallback snapshot")
        print(json.dumps(payload["source_status"], indent=2))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
