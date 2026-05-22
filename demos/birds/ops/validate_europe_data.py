from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

REQUIRED_FILES = [
    DATA / "countries.json",
    DATA / "provider-registry.json",
    DATA / "europe-pilot.json",
]

REQUIRED_COUNTRIES = {"IE", "GB", "FR", "DE", "IT"}
REQUIRED_PROVIDERS = {"local_atlas", "ebird", "gbif", "eurobirdportal", "protected_sites"}


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def main() -> None:
    warnings: list[str] = []

    for path in REQUIRED_FILES:
        if not path.exists():
            raise SystemExit(f"Missing required Europe data file: {path}")

    countries_payload = load_json(DATA / "countries.json")
    providers_payload = load_json(DATA / "provider-registry.json")
    pilot_payload = load_json(DATA / "europe-pilot.json")

    country_codes = {
        country.get("code")
        for country in countries_payload.get("countries", [])
        if isinstance(country, dict)
    }

    missing_countries = REQUIRED_COUNTRIES - country_codes
    if missing_countries:
        warnings.append(f"Missing pilot countries: {sorted(missing_countries)}")

    provider_ids = {
        provider.get("id")
        for provider in providers_payload.get("providers", [])
        if isinstance(provider, dict)
    }

    missing_providers = REQUIRED_PROVIDERS - provider_ids
    if missing_providers:
        warnings.append(f"Missing planned providers: {sorted(missing_providers)}")

    coverage = pilot_payload.get("coverage", {})
    if coverage.get("country_count") != len(country_codes):
        warnings.append("europe-pilot.json country_count does not match countries.json.")

    validation = {
        "status": "pass" if not warnings else "warning",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "scope": "birds_europe_data_foundation",
        "warnings": warnings,
    }

    validation_path = DATA / "europe-validation.json"
    validation_path.write_text(
        json.dumps(validation, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Europe data validation: {validation['status']}")
    for warning in warnings:
        print(f"Warning: {warning}")


if __name__ == "__main__":
    main()
