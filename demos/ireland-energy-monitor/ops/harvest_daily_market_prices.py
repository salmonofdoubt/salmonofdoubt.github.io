#!/usr/bin/env python3
"""
Ireland Energy Monitor: daily market price layer.

Important distinction:
- Electricity market price: market/system signal, not a household tariff.
- Gas imbalance price: balancing/system signal, not a household tariff.
- SEAI household prices remain the affordability layer.

This harvester is intentionally conservative. It never fabricates prices. If a
source blocks scripted access or a parser cannot prove a value, the output is
labelled n/a with an explicit caveat.
"""

from __future__ import annotations

import json
import re
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUT = SOURCE / "market_prices.json"


SMARTGRID_CHART = "https://www.smartgriddashboard.com/api/chart/"
GNI_IMBALANCE = "https://www.gasnetworks.ie/about/data-transparency/balancing-actions-and-prices/imbalance-prices"
SEMOPX_RESULTS = "https://www.semopx.com/market-data/market-results"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fetch_text(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyMonitor/0.16 (+https://salmonofdoubt.github.io/demos/ireland-energy-monitor/)",
            "Accept": "text/html,application/json,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def fetch_json(url: str, timeout: int = 30) -> Any:
    return json.loads(fetch_text(url, timeout=timeout))


def number_or_none(value: Any) -> float | None:
    try:
        if value is None:
            return None
        text = str(value).strip().replace(",", ".")
        if not text:
            return None
        return float(text)
    except Exception:
        return None


def smartgrid_chart_url(date: datetime, chart_type: str, areas: str) -> str:
    day = date.strftime("%d-%b-%Y")
    params = {
        "region": "ROI",
        "chartType": chart_type,
        "dateRange": "day",
        "dateFrom": f"{day} 00:00",
        "dateTo": f"{day} 23:59",
        "areas": areas,
    }
    return f"{SMARTGRID_CHART}?{urllib.parse.urlencode(params)}"


def extract_price_rows(payload: Any) -> list[dict]:
    if isinstance(payload, dict):
        rows = payload.get("Rows") or payload.get("rows") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []

    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue

        field = str(
            row.get("FieldName")
            or row.get("fieldName")
            or row.get("name")
            or row.get("label")
            or ""
        ).upper()

        if "PRICE" not in field and "IMBALANCE" not in field:
            continue

        value = (
            row.get("Value")
            if "Value" in row
            else row.get("value")
            if "value" in row
            else row.get("Y")
            if "Y" in row
            else None
        )

        n = number_or_none(value)
        if n is None:
            continue

        time = (
            row.get("EffectiveTime")
            or row.get("effectiveTime")
            or row.get("time")
            or row.get("DateTime")
            or row.get("dateTime")
        )

        out.append({
            "field": field,
            "value": n,
            "time": str(time or ""),
        })

    return out


def harvest_electricity_market_price() -> dict:
    """
    Prefer Smart Grid Dashboard market-pricing API as a free daily electricity
    market/system price signal. This is not the SEMOpx household price and must
    not be labelled as a tariff.
    """
    errors: list[str] = []

    today = datetime.now(timezone.utc)
    date_candidates = [today, today - timedelta(days=1)]
    chart_candidates = [
        ("market-pricing", "imbalance-price-volume"),
        ("market-pricing", "pricing2"),
        ("marketpricing", "imbalance-price-volume"),
        ("market-pricing", "imbalancepricevolume"),
    ]

    for date in date_candidates:
        for chart_type, areas in chart_candidates:
            url = smartgrid_chart_url(date, chart_type, areas)
            try:
                payload = fetch_json(url)
                rows = extract_price_rows(payload)

                if not rows:
                    errors.append(f"{url}: no price rows parsed")
                    continue

                values = [r["value"] for r in rows if number_or_none(r.get("value")) is not None]
                latest = rows[-1]
                latest_value = float(latest["value"])
                avg_value = statistics.mean(values) if values else latest_value

                return {
                    "label": "Electricity market price",
                    "value": f"{latest_value:.2f} €/MWh",
                    "numeric_value": round(latest_value, 2),
                    "unit": "€/MWh",
                    "status": "mapped",
                    "period": date.strftime("%Y-%m-%d"),
                    "source": "EirGrid Smart Grid Dashboard market-pricing API",
                    "source_url": url,
                    "detail": (
                        "Daily electricity market/system price signal. "
                        "This is not a household electricity tariff."
                    ),
                    "stats": {
                        "daily_average_eur_per_mwh": round(avg_value, 2),
                        "row_count": len(rows),
                        "latest_time": latest.get("time"),
                        "latest_field": latest.get("field"),
                    },
                }
            except Exception as exc:
                errors.append(f"{url}: {exc}")

    return {
        "label": "Electricity market price",
        "value": "n/a",
        "numeric_value": None,
        "unit": "€/MWh",
        "status": "not-parsed",
        "period": today.strftime("%Y-%m-%d"),
        "source": "EirGrid Smart Grid Dashboard / SEMOpx market data",
        "source_url": SEMOPX_RESULTS,
        "detail": (
            "Daily electricity market price layer is installed, but no value was parsed in this run. "
            "Do not substitute SEAI household prices here."
        ),
        "errors": errors[-8:],
    }


def parse_gni_numbers_from_html(html: str) -> dict[str, float]:
    """
    Best-effort parser. The GNI page is interactive and may not expose the data
    table in plain HTML. We only accept values if labels are visible near numbers.
    """
    text = re.sub(r"\s+", " ", html)

    patterns = {
        "sap": r"System Average Price.*?SAP.*?([0-9]+(?:[.,][0-9]+)?)",
        "smp_buy": r"SMP Buy.*?([0-9]+(?:[.,][0-9]+)?)",
        "smp_sell": r"SMP Sell.*?([0-9]+(?:[.,][0-9]+)?)",
    }

    found: dict[str, float] = {}
    for key, pattern in patterns.items():
      m = re.search(pattern, text, flags=re.I)
      if m:
          n = number_or_none(m.group(1))
          if n is not None:
              found[key] = n

    return found


def harvest_gas_imbalance_price() -> dict:
    errors: list[str] = []

    try:
        html = fetch_text(GNI_IMBALANCE)
        parsed = parse_gni_numbers_from_html(html)

        if parsed.get("sap") is not None:
            sap = parsed["sap"]
            return {
                "label": "Gas imbalance price",
                "value": f"{sap:.2f} c/kWh",
                "numeric_value": round(sap, 2),
                "unit": "c/kWh",
                "status": "mapped",
                "period": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "source": "Gas Networks Ireland imbalance prices",
                "source_url": GNI_IMBALANCE,
                "detail": (
                    "Daily gas-system imbalance price signal. "
                    "This is not a household gas tariff."
                ),
                "stats": {
                    "sap_cent_per_kwh": parsed.get("sap"),
                    "smp_buy_cent_per_kwh": parsed.get("smp_buy"),
                    "smp_sell_cent_per_kwh": parsed.get("smp_sell"),
                },
            }

        errors.append("GNI page fetched, but SAP value was not visible in static HTML.")
    except Exception as exc:
        errors.append(str(exc))

    return {
        "label": "Gas imbalance price",
        "value": "n/a",
        "numeric_value": None,
        "unit": "c/kWh",
        "status": "not-parsed",
        "period": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "Gas Networks Ireland imbalance prices",
        "source_url": GNI_IMBALANCE,
        "detail": (
            "Daily gas imbalance price layer is installed, but no SAP value was parsed in this run. "
            "Do not substitute SEAI household gas prices here."
        ),
        "errors": errors,
    }


def main() -> int:
    SOURCE.mkdir(parents=True, exist_ok=True)

    electricity = harvest_electricity_market_price()
    gas = harvest_gas_imbalance_price()

    payload = {
        "meta": {
            "generated_at": now_iso(),
            "mode": "daily-market-price-layer",
            "caveat": (
                "Market/system prices are not household tariffs. "
                "Household affordability remains the SEAI semi-annual price layer."
            ),
            "sources": [
                "EirGrid Smart Grid Dashboard market pricing",
                "SEMOpx market results",
                "Gas Networks Ireland imbalance prices",
            ],
        },
        "market_prices": [
            electricity,
            gas,
        ],
    }

    OUT.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(json.dumps(payload, indent=2)[:2200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
