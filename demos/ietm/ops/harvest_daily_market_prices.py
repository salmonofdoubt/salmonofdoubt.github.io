#!/usr/bin/env python3
"""
Ireland Energy Transition Monitor: daily/live market price layer.

Important distinction:
- Electricity system price: EirGrid Smart Grid Dashboard imbalance settlement price, €/MWh.
- Gas balancing price: Gas Networks Ireland imbalance price / SAP, c/kWh.
- SEAI household prices remain the household affordability layer.

This harvester never substitutes household prices for market prices.
If a price cannot be proven from the source page, it returns n/a with errors.
"""

from __future__ import annotations

import html
import json
import re
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEBUG = ROOT / "ops" / "debug"
OUT = SOURCE / "market_prices.json"
PROBE = DEBUG / "market_price_probe.json"
GNI_MANUAL = SOURCE / "gni_imbalance_manual.json"

EIRGRID_MARKET_PAGES = [
    "https://www.smartgriddashboard.com/roi/market-pricing/",
    "https://www.smartgriddashboard.com/demand/market-pricing/",
    "https://www.smartgriddashboard.com/kWh/market-pricing/",
    "https://www.smartgriddashboard.com/market-pricing/",
]

GNI_IMBALANCE_PAGES = [
    "https://www.gasnetworks.ie/about/data-transparency/balancing-actions-and-prices/imbalance-prices",
    "https://www.gasnetworks.ie/corporate/gas-regulation/transparency-and-publicat/dashboard-reporting/balancing-actions-and-prices/imbalance-prices",
]

SEMOPX_RESULTS = "https://www.semopx.com/market-data/market-results"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def fetch_text(url: str, timeout: int = 40) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.57 (+https://salmonofdoubt.github.io/demos/ietm/)",
            "Accept": "text/html,application/json,text/plain,*/*",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def visible_lines(raw_html: str) -> list[str]:
    s = re.sub(r"<script\b[^>]*>.*?</script>", "\n", raw_html, flags=re.I | re.S)
    s = re.sub(r"<style\b[^>]*>.*?</style>", "\n", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", "\n", s)
    s = html.unescape(s)

    out: list[str] = []
    for line in s.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            out.append(line)
    return out


def number_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None

        # Support Irish/EU-ish and API-ish number forms.
        text = text.replace("€", "").replace("£", "").replace("c/kWh", "").replace("€/MWh", "")
        text = text.replace(",", "")
        return float(re.search(r"[-+]?\d+(?:\.\d+)?", text).group(0))
    except Exception:
        return None


def eur_per_mwh_to_c_per_kwh(value: float | None) -> float | None:
    if value is None:
        return None
    # €1/MWh = €0.001/kWh = 0.1 cent/kWh
    return value * 0.1


def plausible_electricity_eur_per_mwh(value: float | None) -> bool:
    if value is None:
        return False
    return -500 <= float(value) <= 5000


def plausible_gas_cent_per_kwh(value: float | None) -> bool:
    if value is None:
        return False
    # Reject years/dates and absurd parser mistakes.
    return -50 <= float(value) <= 250


def find_price_after_label(lines: list[str], label_pattern: str, max_ahead: int = 10) -> tuple[float | None, str]:
    label_re = re.compile(label_pattern, flags=re.I)

    for i, line in enumerate(lines):
        if not label_re.search(line):
            continue

        # Case 1: label and price on same line
        n = number_or_none(line)
        if n is not None and "price" not in line.lower().strip():
            return n, line

        # Case 2: price in following lines
        for j in range(i + 1, min(len(lines), i + max_ahead + 1)):
            candidate = lines[j]
            if re.search(r"€|£|c/kWh|cent|[0-9]", candidate, flags=re.I):
                n = number_or_none(candidate)
                if n is not None:
                    return n, candidate

    return None, ""


def regex_price(text: str, label_pattern: str) -> tuple[float | None, str]:
    # Matches e.g. "Latest Imbalance Settlement Price €170.81"
    pattern = re.compile(label_pattern + r".{0,120}?[€£]?\s*([-+]?\d+(?:[.,]\d+)?)", flags=re.I | re.S)
    m = pattern.search(text)
    if not m:
        return None, ""
    n = number_or_none(m.group(1))
    return n, m.group(0)


def parse_eirgrid_market_page(raw_html: str) -> dict[str, Any]:
    lines = visible_lines(raw_html)
    text = "\n".join(lines)

    latest, latest_line = find_price_after_label(lines, r"Latest\s+Imbalance\s+Settlement\s+Price")
    if latest is None:
        latest, latest_line = regex_price(text, r"Latest\s+Imbalance\s+Settlement\s+Price")

    min_price, min_line = find_price_after_label(lines, r"Min\s+daily\s+price")
    max_price, max_line = find_price_after_label(lines, r"Max\s+daily\s+price")

    date_text = ""
    m = re.search(r"Today\s*\(([^)]+)\)", text, flags=re.I)
    if m:
        date_text = m.group(1).strip()

    return {
        "latest_eur_per_mwh": latest,
        "min_eur_per_mwh": min_price,
        "max_eur_per_mwh": max_price,
        "date_text": date_text,
        "latest_line": latest_line,
        "min_line": min_line,
        "max_line": max_line,
        "sample": lines[:120],
    }


def harvest_electricity_market_price() -> dict:
    errors: list[str] = []
    probes: list[dict] = []

    for url in EIRGRID_MARKET_PAGES:
        try:
            raw = fetch_text(url)
            parsed = parse_eirgrid_market_page(raw)
            probes.append({"url": url, "parsed": parsed})

            latest = parsed.get("latest_eur_per_mwh")
            if plausible_electricity_eur_per_mwh(latest):
                latest = float(latest)
                min_price = parsed.get("min_eur_per_mwh")
                max_price = parsed.get("max_eur_per_mwh")
                c_per_kwh = eur_per_mwh_to_c_per_kwh(latest)

                stats = {
                    "latest_eur_per_mwh": round(latest, 2),
                    "latest_c_per_kwh_equivalent": round(c_per_kwh, 2) if c_per_kwh is not None else None,
                    "dashboard_date": parsed.get("date_text") or "",
                    "latest_line": parsed.get("latest_line") or "",
                }

                if plausible_electricity_eur_per_mwh(min_price):
                    stats["daily_min_eur_per_mwh"] = round(float(min_price), 2)
                if plausible_electricity_eur_per_mwh(max_price):
                    stats["daily_max_eur_per_mwh"] = round(float(max_price), 2)

                return {
                    "label": "Electricity system price",
                    "value": f"{latest:.2f} €/MWh",
                    "numeric_value": round(latest, 2),
                    "unit": "€/MWh",
                    "equivalent_value": f"{c_per_kwh:.2f} c/kWh" if c_per_kwh is not None else None,
                    "numeric_value_c_per_kwh": round(c_per_kwh, 2) if c_per_kwh is not None else None,
                    "status": "mapped",
                    "period": today_key(),
                    "freshness": "latest settlement period visible on Smart Grid Dashboard",
                    "source": "EirGrid Smart Grid Dashboard imbalance settlement price",
                    "source_url": url,
                    "detail": (
                        "Latest electricity imbalance settlement price. This is a system/market signal, "
                        "not a household electricity tariff."
                    ),
                    "stats": stats,
                }

            errors.append(f"{url}: latest imbalance settlement price not parsed or implausible: {latest}")
        except Exception as exc:
            errors.append(f"{url}: {exc}")

    return {
        "label": "Electricity system price",
        "value": "n/a",
        "numeric_value": None,
        "unit": "€/MWh",
        "equivalent_value": None,
        "numeric_value_c_per_kwh": None,
        "status": "not-parsed",
        "period": today_key(),
        "freshness": "unavailable in current run",
        "source": "EirGrid Smart Grid Dashboard / SEMOpx market data",
        "source_url": SEMOPX_RESULTS,
        "detail": (
            "Electricity system price layer is installed, but no latest Smart Grid Dashboard value "
            "was parsed in this run. Do not substitute SEAI household prices here."
        ),
        "errors": errors[-10:],
    }


def parse_gni_page(raw_html: str) -> dict[str, Any]:
    lines = visible_lines(raw_html)
    text = "\n".join(lines)

    # The GNI page is often interactive. Sometimes the selected table values are
    # not present in static HTML. We parse only labelled values and reject years.
    labels = {
        "sap_cent_per_kwh": r"(System\s+Average\s+Price|SAP)",
        "smp_buy_cent_per_kwh": r"(SMP\s+Buy|System\s+Marginal\s+Price.*?Buy)",
        "smp_sell_cent_per_kwh": r"(SMP\s+Sell|System\s+Marginal\s+Price.*?Sell)",
    }

    out: dict[str, Any] = {"sample": lines[:140]}

    for key, pattern in labels.items():
        n, found_line = find_price_after_label(lines, pattern, max_ahead=16)
        if n is not None and plausible_gas_cent_per_kwh(n):
            # Reject obvious default-date/year captures.
            if int(abs(n)) in range(1900, 2101):
                continue
            out[key] = round(float(n), 4)
            out[f"{key}_line"] = found_line

    date_match = re.search(r"Select a day\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})", text, flags=re.I)
    if date_match:
        out["date_text"] = date_match.group(1)

    return out



def read_gni_manual_fallback() -> dict | None:
    if not GNI_MANUAL.exists():
        return None

    try:
        data = json.loads(GNI_MANUAL.read_text())
    except Exception:
        return None

    if not data.get("enabled"):
        return None

    sap = number_or_none(data.get("sap_cent_per_kwh"))
    if not plausible_gas_cent_per_kwh(sap):
        return None

    date = str(data.get("date") or today_key())
    source_url = data.get("source_url") or GNI_IMBALANCE_PAGES[0]

    return {
        "label": "Gas balancing price",
        "value": f"{sap:.2f} c/kWh",
        "numeric_value": round(sap, 2),
        "unit": "c/kWh",
        "status": "mapped",
        "mode": "manual-official-source",
        "period": date,
        "freshness": "manually entered from Gas Networks Ireland table/export",
        "source": "Gas Networks Ireland imbalance prices",
        "source_url": source_url,
        "detail": (
            "Gas Networks Ireland System Average Price / imbalance price. "
            "This is a gas-system balancing signal, not a household gas tariff. "
            "Value entered from official GNI table/export while the hidden endpoint is being wired."
        ),
        "stats": {
            "sap_cent_per_kwh": round(sap, 4),
            "smp_buy_cent_per_kwh": number_or_none(data.get("smp_buy_cent_per_kwh")),
            "smp_sell_cent_per_kwh": number_or_none(data.get("smp_sell_cent_per_kwh")),
            "manual_note": data.get("note", ""),
        },
    }

def harvest_gas_balancing_price() -> dict:
    manual = read_gni_manual_fallback()
    if manual:
        return manual

    errors: list[str] = []
    probes: list[dict] = []

    for url in GNI_IMBALANCE_PAGES:
        try:
            raw = fetch_text(url)
            parsed = parse_gni_page(raw)
            probes.append({"url": url, "parsed": parsed})

            sap = parsed.get("sap_cent_per_kwh")
            if plausible_gas_cent_per_kwh(sap):
                sap = float(sap)
                return {
                    "label": "Gas balancing price",
                    "value": f"{sap:.2f} c/kWh",
                    "numeric_value": round(sap, 2),
                    "unit": "c/kWh",
                    "status": "mapped",
                    "period": today_key(),
                    "freshness": "daily gas-day value visible on Gas Networks Ireland page",
                    "source": "Gas Networks Ireland imbalance prices",
                    "source_url": url,
                    "detail": (
                        "Gas Networks Ireland System Average Price / imbalance price. "
                        "This is a gas-system balancing signal, not a household gas tariff."
                    ),
                    "stats": {
                        "sap_cent_per_kwh": parsed.get("sap_cent_per_kwh"),
                        "smp_buy_cent_per_kwh": parsed.get("smp_buy_cent_per_kwh"),
                        "smp_sell_cent_per_kwh": parsed.get("smp_sell_cent_per_kwh"),
                        "dashboard_date": parsed.get("date_text") or "",
                    },
                }

            errors.append(f"{url}: no plausible SAP c/kWh value visible in static HTML")
        except Exception as exc:
            errors.append(f"{url}: {exc}")

    return {
        "label": "Gas balancing price",
        "value": "n/a",
        "numeric_value": None,
        "unit": "c/kWh",
        "status": "not-parsed",
        "period": today_key(),
        "freshness": "unavailable in current run",
        "source": "Gas Networks Ireland imbalance prices",
        "source_url": GNI_IMBALANCE_PAGES[0],
        "detail": (
            "Daily gas balancing-price layer is installed, but no plausible SAP c/kWh value "
            "was visible in the fetched static HTML. Do not substitute SEAI household gas prices here."
        ),
        "errors": errors[-10:],
    }


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)
    DEBUG.mkdir(parents=True, exist_ok=True)

    electricity = harvest_electricity_market_price()
    gas = harvest_gas_balancing_price()

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "mode": "system-market-price-layer",
            "caveat": (
                "Market/system prices are not household tariffs. "
                "Household affordability remains the SEAI semi-annual price layer."
            ),
            "sources": [
                "EirGrid Smart Grid Dashboard imbalance settlement price",
                "SEMOpx market results",
                "Gas Networks Ireland imbalance prices",
            ],
        },
        "market_prices": [electricity, gas],
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")

    PROBE.write_text(json.dumps({
        "generated_at": now_iso(),
        "electricity_status": electricity.get("status"),
        "gas_status": gas.get("status"),
        "electricity": electricity,
        "gas": gas,
    }, indent=2) + "\n")

    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(json.dumps(payload, indent=2)[:3000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
