#!/usr/bin/env python3
"""
Free EirGrid Smart Grid Dashboard CO2 harvester.

This tries to extract latest CO2 intensity from the public EirGrid Smart Grid
Dashboard CO2 page. If the value is not exposed in static HTML, it does not fail;
it leaves CO2 as unavailable.

No paid API. No Electricity Maps sandbox data.
"""

from __future__ import annotations

import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ELECTRICITY = ROOT / "data" / "source" / "electricity.json"

CO2_URLS = [
    # Ireland-only view first
    "https://www.smartgriddashboard.com/roi/co2/?intensityduration=day&emissionsduration=day",
    "https://www.smartgriddashboard.com/roi/co2/",
    # All-island fallback, clearly labelled if used
    "https://www.smartgriddashboard.com/all/co2/?intensityduration=day&emissionsduration=day",
    "https://www.smartgriddashboard.com/all/co2/",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n")


def fetch_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 IrelandEnergyMonitor/0.5",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )

    with urllib.request.urlopen(req, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace")


def strip_html(raw: str) -> str:
    text = re.sub(r"<script\b.*?</script>", " ", raw, flags=re.I | re.S)
    text = re.sub(r"<style\b.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html.unescape(text)
    text = text.replace("CO₂", "CO2").replace("CO_{2}", "CO2")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def extract_latest_intensity(text: str) -> float | None:
    """
    Finds value after 'Latest CO2 intensity' and before 'gCO2/kWh'.
    Avoids today's low and emissions values.
    """
    normal = text.replace("\r", "\n")

    patterns = [
        r"Latest\s+CO2\s+intensity\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*gCO2\s*/\s*kWh",
        r"Latest\s+CO\s*2\s+intensity\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*gCO\s*2\s*/\s*kWh",
        r"Latest\s+CO2\s+intensity\s*\n\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*gCO2\s*/\s*kWh",
    ]

    for pattern in patterns:
        m = re.search(pattern, normal, flags=re.I | re.S)
        if m:
            return float(m.group(1).replace(",", ""))

    # More tolerant fallback: small window after the latest-intensity heading.
    m = re.search(r"Latest\s+CO2\s+intensity(.{0,250})", normal, flags=re.I | re.S)
    if m:
        window = m.group(1)
        n = re.search(r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*gCO2\s*/\s*kWh", window, flags=re.I)
        if n:
            return float(n.group(1).replace(",", ""))

    return None


def set_unavailable(data: dict, mode: str, caveat: str) -> dict:
    e = data.setdefault("electricity_now", {})
    e["co2_g_per_kwh"] = None
    e["co2_available"] = False
    e["co2_source"] = "EirGrid Smart Grid Dashboard"
    e["co2_unit"] = "gCO2/kWh"

    source_status = data.setdefault("source_status", {})
    source_status["carbon_intensity"] = {
        "source": "EirGrid Smart Grid Dashboard CO2 page",
        "source_url": CO2_URLS[0],
        "mode": mode,
        "harvested_at": now_iso(),
        "caveat": caveat,
    }
    return data


def main() -> int:
    data = load_json(ELECTRICITY)

    errors = []
    for url in CO2_URLS:
        try:
            raw = fetch_text(url)
            text = strip_html(raw)
            value = extract_latest_intensity(text)

            if value is None:
                errors.append(f"{url}: no static latest-intensity value found")
                continue

            region = "Ireland" if "/roi/" in url else "All island"

            e = data.setdefault("electricity_now", {})
            e["co2_g_per_kwh"] = round(value, 1)
            e["co2_available"] = True
            e["co2_source"] = f"EirGrid Smart Grid Dashboard, {region}"
            e["co2_unit"] = "gCO2/kWh"
            e["co2_region"] = region

            source_status = data.setdefault("source_status", {})
            source_status["carbon_intensity"] = {
                "source": "EirGrid Smart Grid Dashboard CO2 page",
                "source_url": url,
                "mode": "public-html-parse",
                "harvested_at": now_iso(),
                "region": region,
                "caveat": (
                    "Parsed from public Smart Grid Dashboard HTML. If Ireland-only value is not exposed, "
                    "all-island fallback may be used and is labelled."
                ),
            }

            save_json(ELECTRICITY, data)
            print(f"Wrote CO2 intensity: {value} gCO2/kWh from {region}")
            return 0

        except Exception as exc:
            errors.append(f"{url}: {exc}")

    data = set_unavailable(
        data,
        "not-exposed-in-static-html",
        "EirGrid CO2 page was reachable or attempted, but no latest static CO2 intensity value was parsed. "
        "CO2 remains n/a rather than using sandbox or estimated data. Errors: " + " | ".join(errors[:4])
    )
    save_json(ELECTRICITY, data)
    print("No EirGrid static CO2 value parsed; CO2 remains n/a.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
