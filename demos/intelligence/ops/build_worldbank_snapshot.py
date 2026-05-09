"""Build a frozen World Bank snapshot for the Three Intelligences Explorer.

Run from demos/intelligence/ after installing requests and pandas:

    python ops/build_worldbank_snapshot.py

This writes data/country_scores_snapshot.csv using the same model as app.js.
"""
from __future__ import annotations

import json
from pathlib import Path
import requests
import pandas as pd

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
WB_BASE = "https://api.worldbank.org/v2"


def clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


def transform(value: float, meta: dict) -> float:
    t = meta["transform"]
    if t == "scale_0_1":
        score = value * 100
    elif t == "percent":
        score = value
    elif t == "capped_percent":
        score = min(value, meta.get("cap", 100)) / meta.get("cap", 100) * 100
    elif t == "wgi_estimate":
        score = (value + 2.5) / 5 * 100
    elif t == "linear":
        score = (value - meta["min"]) / (meta["max"] - meta["min"]) * 100
    elif t == "inverse_linear":
        score = 100 - (value - meta["min"]) / (meta["max"] - meta["min"]) * 100
    else:
        score = value
    return clamp(score)


def fetch_indicator(country_codes: str, indicator_code: str) -> list[dict]:
    url = f"{WB_BASE}/country/{country_codes}/indicator/{indicator_code}"
    params = {"format": "json", "per_page": 20000, "date": "2010:2026"}
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()
    return payload[1] if len(payload) > 1 and isinstance(payload[1], list) else []


def weighted_average(items: list[tuple[float, float]]) -> float | None:
    valid = [(s, w) for s, w in items if s is not None]
    if not valid:
        return None
    wsum = sum(w for _, w in valid)
    return sum(s * w for s, w in valid) / wsum


def main() -> None:
    countries = json.loads((DATA / "countries.json").read_text(encoding="utf-8"))
    indicators = json.loads((DATA / "indicators.json").read_text(encoding="utf-8"))
    codes = ";".join(c["code"] for c in countries)
    by_country: dict[str, dict[str, dict]] = {c["iso3"]: {} for c in countries}

    for indicator in indicators:
        rows = fetch_indicator(codes, indicator["code"])
        for row in rows:
            value = row.get("value")
            iso3 = row.get("countryiso3code")
            if value is None or iso3 not in by_country:
                continue
            year = int(row["date"])
            current = by_country[iso3].get(indicator["code"])
            if current is None or year > current["year"]:
                by_country[iso3][indicator["code"]] = {"value": float(value), "year": year}

    out = []
    for country in countries:
        buckets = {"individual": [], "collective": [], "planetary": []}
        for indicator in indicators:
            record = by_country[country["iso3"]].get(indicator["code"])
            if not record:
                continue
            score = transform(record["value"], indicator)
            buckets[indicator["layer"]].append((score, indicator["weight"]))
        individual = weighted_average(buckets["individual"])
        collective = weighted_average(buckets["collective"])
        planetary = weighted_average(buckets["planetary"])
        vals = [v for v in [individual, collective, planetary] if v is not None]
        if not vals:
            continue
        out.append({
            "country": country["name"],
            "code": country["code"],
            "region": country["region"],
            "individual_intelligence": round(individual or 0, 2),
            "collective_intelligence": round(collective or 0, 2),
            "planetary_intelligence": round(planetary or 0, 2),
            "overall_synergy": round(sum(vals) / len(vals), 2),
            "data_status": "Frozen World Bank snapshot"
        })

    pd.DataFrame(out).to_csv(DATA / "country_scores_snapshot.csv", index=False)
    print(f"Wrote {DATA / 'country_scores_snapshot.csv'}")


if __name__ == "__main__":
    main()
