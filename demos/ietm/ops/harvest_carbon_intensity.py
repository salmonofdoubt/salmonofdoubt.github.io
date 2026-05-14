#!/usr/bin/env python3
"""
Optional carbon-intensity harvester.

Primary optional source:
  Electricity Maps API v4 carbon-intensity/latest, zone=IE

Requires GitHub secret / environment variable:
  ELECTRICITYMAPS_API_KEY

If no key is present, this script leaves CO2 as unavailable and does not fail.
"""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ELECTRICITY = ROOT / "data" / "source" / "electricity.json"

API_URL = "https://api.electricitymap.org/v4/carbon-intensity/latest"
ZONE = "IE"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


def fetch_electricitymaps(api_key: str) -> dict:
    query = urllib.parse.urlencode({
        "zone": ZONE,
        "emissionFactorType": "direct"
    })
    url = f"{API_URL}?{query}"

    req = urllib.request.Request(
        url,
        headers={
            "auth-token": api_key,
            "Accept": "application/json",
            "User-Agent": "IrelandEnergyMonitor/0.4"
        },
    )

    with urllib.request.urlopen(req, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    data = load_json(ELECTRICITY)
    e = data.setdefault("electricity_now", {})
    source_status = data.setdefault("source_status", {})

    api_key = os.getenv("ELECTRICITYMAPS_API_KEY")
    key_mode = os.getenv("ELECTRICITYMAPS_KEY_MODE", "sandbox").strip().lower()

    # Safety guard:
    # Electricity Maps sandbox keys return sample/randomised data.
    # Do not publish sandbox values as public CO2 intensity.
    if api_key and key_mode != "live":
        e["co2_g_per_kwh"] = None
        e["co2_available"] = False
        source_status["carbon_intensity"] = {
            "source": "Electricity Maps",
            "mode": f"{key_mode}-disabled",
            "harvested_at": now_iso(),
            "caveat": "Electricity Maps key is present but not marked live. Sandbox/sample CO2 data are intentionally not published."
        }
        save_json(ELECTRICITY, data)
        print("Electricity Maps key present, but mode is not live; CO2 remains n/a.")
        return 0

    if not api_key:
        e["co2_g_per_kwh"] = None
        e["co2_available"] = False
        source_status["carbon_intensity"] = {
            "source": "Electricity Maps",
            "mode": "not-configured",
            "harvested_at": now_iso(),
            "caveat": "Set ELECTRICITYMAPS_API_KEY as a GitHub Actions secret to enable CO2 intensity."
        }
        save_json(ELECTRICITY, data)
        print("No ELECTRICITYMAPS_API_KEY found; CO2 remains n/a.")
        return 0

    try:
        payload = fetch_electricitymaps(api_key)
        value = payload.get("carbonIntensity")

        if value is None:
            raise RuntimeError(f"No carbonIntensity in response: {payload}")

        e["co2_g_per_kwh"] = round(float(value), 1)
        e["co2_available"] = True
        e["co2_source"] = "Electricity Maps"
        e["co2_unit"] = "gCO2e/kWh"
        e["co2_zone"] = payload.get("zone", ZONE)
        e["co2_datetime"] = payload.get("datetime")

        source_status["carbon_intensity"] = {
            "source": "Electricity Maps carbon-intensity/latest",
            "source_url": "https://app.electricitymaps.com/developer-hub/api/reference",
            "mode": "api",
            "harvested_at": now_iso(),
            "zone": payload.get("zone", ZONE),
            "datetime": payload.get("datetime"),
            "caveat": "Electricity Maps reports carbon intensity in gCO2e/kWh; this is not the same accounting basis as EirGrid's CO2/kWh display."
        }

        save_json(ELECTRICITY, data)
        print(f"Wrote CO2 intensity: {value} gCO2e/kWh")
        return 0

    except Exception as exc:
        e["co2_g_per_kwh"] = None
        e["co2_available"] = False
        source_status["carbon_intensity"] = {
            "source": "Electricity Maps",
            "mode": "failed",
            "harvested_at": now_iso(),
            "caveat": f"Carbon harvester failed: {exc}"
        }
        save_json(ELECTRICITY, data)
        print(f"Carbon harvester failed safely: {exc}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
