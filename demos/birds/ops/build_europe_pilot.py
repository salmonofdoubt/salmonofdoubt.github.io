from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

COUNTRIES_PATH = DATA / "countries.json"
PROVIDERS_PATH = DATA / "provider-registry.json"
OUTPUT_PATH = DATA / "europe-pilot.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    now = datetime.now(timezone.utc).isoformat()

    countries = load_json(COUNTRIES_PATH)
    providers = load_json(PROVIDERS_PATH)

    countries["generated_at"] = now
    providers["generated_at"] = now

    pilot = {
        "generated_at": now,
        "app": "European Bird Radar",
        "mode": "europe_data_foundation",
        "coverage": {
            "scope": "five-country pilot",
            "country_count": len(countries.get("countries", [])),
            "countries": [country["code"] for country in countries.get("countries", [])],
        },
        "providers": [
            {
                "id": provider["id"],
                "name": provider["name"],
                "role": provider["role"],
                "status": provider["status"],
            }
            for provider in providers.get("providers", [])
        ],
        "data_contract": {
            "observation_fields": [
                "species_code",
                "common_name",
                "scientific_name",
                "country",
                "region",
                "observation_date",
                "count",
                "lat",
                "lng",
                "source",
                "freshness",
            ],
            "status": "draft"
        },
        "notes": [
            "This is a structural Europe-ready data layer.",
            "Live external providers are not harvested in this foundation step.",
            "The existing sound atlas remains the active baseline provider."
        ]
    }

    COUNTRIES_PATH.write_text(
        json.dumps(countries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    PROVIDERS_PATH.write_text(
        json.dumps(providers, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    OUTPUT_PATH.write_text(
        json.dumps(pilot, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
