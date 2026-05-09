#!/usr/bin/env python3
"""Build a local World Bank snapshot for the Three Intelligences Explorer.

This creates:
  demos/intelligence/data/worldbank_snapshot.json

The static GitHub Pages app can then load a stable local data file first,
instead of making every visitor's browser fetch all World Bank indicators live.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "demos" / "intelligence"
DATA = BASE / "data"

COUNTRIES_PATH = DATA / "countries.json"
INDICATORS_PATH = DATA / "indicators.json"
OUT_PATH = DATA / "worldbank_snapshot.json"

WB_BASE = "https://api.worldbank.org/v2"
YEARS = "2010:2026"
PER_PAGE = 20000
SLEEP_BETWEEN_REQUESTS = 0.25
TIMEOUT_SECONDS = 40


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_json(url: str):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "salmonofdoubt-intelligence-demo-snapshot/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def main() -> int:
    countries = load_json(COUNTRIES_PATH)
    indicators = load_json(INDICATORS_PATH)

    country_codes = ";".join(country["code"] for country in countries)
    iso3_to_code = {country.get("iso3"): country["code"] for country in countries if country.get("iso3")}

    raw_values: dict[str, dict[str, dict]] = {}
    loaded = []
    failed = []

    for indicator in indicators:
        code = indicator["code"]
        query = urllib.parse.urlencode({
            "format": "json",
            "per_page": str(PER_PAGE),
            "date": YEARS,
        })
        url = f"{WB_BASE}/country/{country_codes}/indicator/{code}?{query}"

        try:
            payload = fetch_json(url)
            rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else None
            if not isinstance(rows, list):
                raise RuntimeError("World Bank payload did not contain a data array")

            usable_rows = 0

            for row in rows:
                if not isinstance(row, dict):
                    continue

                value = row.get("value")
                iso3 = row.get("countryiso3code")
                year_raw = row.get("date")

                if value is None or not iso3 or not year_raw:
                    continue

                country_code = iso3_to_code.get(iso3)
                if not country_code:
                    continue

                try:
                    year = int(year_raw)
                    value = float(value)
                except (TypeError, ValueError):
                    continue

                country_bucket = raw_values.setdefault(country_code, {})
                current = country_bucket.get(code)

                if not current or year > int(current["year"]):
                    country_bucket[code] = {
                        "value": value,
                        "year": year,
                        "indicator": code,
                        "label": indicator.get("label", code),
                    }

                usable_rows += 1

            if usable_rows == 0:
                raise RuntimeError("No usable rows returned for selected countries")

            loaded.append({
                "code": code,
                "label": indicator.get("label", code),
                "layer": indicator.get("layer", "unknown"),
                "usableRows": usable_rows,
            })

            print(f"loaded {code}: {usable_rows} usable rows")

        except Exception as exc:
            failed.append({
                "code": code,
                "label": indicator.get("label", code),
                "layer": indicator.get("layer", "unknown"),
                "reason": str(exc),
            })
            print(f"failed {code}: {exc}")

        time.sleep(SLEEP_BETWEEN_REQUESTS)

    value_count = sum(len(v) for v in raw_values.values())
    countries_with_any_value = sum(1 for v in raw_values.values() if v)

    report = {
        "total": len(indicators),
        "loaded": loaded,
        "failed": failed,
        "values": value_count,
        "countriesWithAnyValue": countries_with_any_value,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "years": YEARS,
    }

    snapshot = {
        "meta": {
            "title": "Three Intelligences Explorer World Bank snapshot",
            "generated_at": report["generated_at"],
            "source": "World Bank API",
            "years": YEARS,
            "country_count": len(countries),
            "indicator_count": len(indicators),
            "loaded_indicator_count": len(loaded),
            "failed_indicator_count": len(failed),
            "value_count": value_count,
            "countries_with_any_value": countries_with_any_value,
        },
        "report": report,
        "rawValues": raw_values,
    }

    OUT_PATH.write_text(json.dumps(snapshot, indent=2, sort_keys=True), encoding="utf-8")

    print("")
    print(f"wrote {OUT_PATH}")
    print(f"loaded indicators: {len(loaded)}/{len(indicators)}")
    print(f"values: {value_count}")
    print(f"countries with any value: {countries_with_any_value}")

    if len(loaded) < max(3, len(indicators) // 3):
        print("warning: snapshot built, but live indicator coverage is low")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
