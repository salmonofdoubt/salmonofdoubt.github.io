from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

COUNTRIES_PATH = DATA / "countries.json"
OUTPUT_PATH = DATA / "recent-observations.json"

EBIRD_ENDPOINT = "https://api.ebird.org/v2/data/obs/{region_code}/recent"

MAX_RESULTS_PER_COUNTRY = 100
BACK_DAYS = 7
REQUEST_PAUSE_SECONDS = 1.0


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def normalise_observation(raw: dict[str, Any], country_code: str) -> dict[str, Any]:
    return {
        "species_code": raw.get("speciesCode"),
        "common_name": raw.get("comName"),
        "scientific_name": raw.get("sciName"),
        "country": country_code,
        "region": raw.get("locName"),
        "observation_date": raw.get("obsDt"),
        "count": raw.get("howMany"),
        "lat": raw.get("lat"),
        "lng": raw.get("lng"),
        "source": "eBird",
        "freshness": "recent_7_days",
        "location_id": raw.get("locId"),
        "observation_valid": raw.get("obsValid"),
        "observation_reviewed": raw.get("obsReviewed"),
    }


def fetch_country(region_code: str, token: str) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode({
        "back": BACK_DAYS,
        "maxResults": MAX_RESULTS_PER_COUNTRY,
    })

    url = f"{EBIRD_ENDPOINT.format(region_code=region_code)}?{params}"
    request = urllib.request.Request(
        url,
        headers={
            "X-eBirdApiToken": token,
            "User-Agent": "salmonofdoubt-birds-europe-provider/1.0 (+https://salmonofdoubt.github.io/demos/birds/)",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"eBird returned HTTP {response.status} for {region_code}")
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)

    countries_payload = load_json(COUNTRIES_PATH)
    countries = countries_payload.get("countries", [])

    pilot_codes = [
        country["code"]
        for country in countries
        if country.get("status") in {"active", "pilot"} and country.get("code")
    ]

    token = os.environ.get("EBIRD_API_KEY", "").strip()
    generated_at = utc_now()

    if not token:
        payload = {
            "generated_at": generated_at,
            "provider": "ebird",
            "status": "missing_api_key",
            "coverage": {
                "countries": pilot_codes,
                "back_days": BACK_DAYS,
                "max_results_per_country": MAX_RESULTS_PER_COUNTRY,
            },
            "items": [],
            "warnings": [
                "EBIRD_API_KEY is not set. Add it as a GitHub Actions repository secret before scheduled harvesting."
            ],
        }
        OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Wrote recent-observations.json with missing_api_key status.")
        return

    items: list[dict[str, Any]] = []
    warnings: list[str] = []

    for code in pilot_codes:
        try:
            raw_items = fetch_country(code, token)
            items.extend(normalise_observation(item, code) for item in raw_items)
            print(f"{code}: {len(raw_items)} observations")
        except Exception as exc:
            warning = f"{code}: {exc}"
            warnings.append(warning)
            print(f"Warning: {warning}", file=sys.stderr)

        time.sleep(REQUEST_PAUSE_SECONDS)

    payload = {
        "generated_at": generated_at,
        "provider": "ebird",
        "status": "pass" if not warnings else "warning",
        "coverage": {
            "countries": pilot_codes,
            "back_days": BACK_DAYS,
            "max_results_per_country": MAX_RESULTS_PER_COUNTRY,
            "item_count": len(items),
        },
        "items": items,
        "warnings": warnings,
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(items)} observations.")


if __name__ == "__main__":
    main()
