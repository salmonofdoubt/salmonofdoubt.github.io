#!/usr/bin/env python3
"""
Probe Smart Grid Dashboard for machine-readable chart/table endpoints.

Goal:
- stop relying on visible-page scraping
- find the actual chart/table JSON behind demand, wind, solar, generation,
  interconnection and fuel-mix panels
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEBUG = ROOT / "ops" / "debug"
DEBUG.mkdir(parents=True, exist_ok=True)

BASE = "https://www.smartgriddashboard.com"

PAGES = {
    "overview": f"{BASE}/",
    "roi_demand": f"{BASE}/roi/demand/",
    "roi_generation": f"{BASE}/roi/generation/",
    "roi_wind": f"{BASE}/roi/wind/",
    "roi_solar": f"{BASE}/roi/solar/",
    "roi_interconnection": f"{BASE}/roi/interconnection/",
    "roi_market": f"{BASE}/roi/market-pricing/",
    "roi_co2": f"{BASE}/roi/co2/",
}

API_CANDIDATES = [
    "/api/chart/",
    "/api/charts/",
    "/api/data/",
    "/api/table/",
    "/umbraco/api/chart/",
    "/umbraco/api/dashboard/",
]

TEST_QUERIES = [
    {
        "region": "ROI",
        "chartType": "demand",
        "dateRange": "day",
        "areas": "demandactual,demandforecast",
    },
    {
        "region": "ROI",
        "chartType": "generation",
        "dateRange": "day",
        "areas": "solaractual,windactual,systemdemand",
    },
    {
        "region": "ROI",
        "chartType": "generation",
        "dateRange": "day",
        "areas": "windactual,solaractual,systemgeneration",
    },
    {
        "region": "ROI",
        "chartType": "wind",
        "dateRange": "day",
        "areas": "windactual,windforecast",
    },
    {
        "region": "ROI",
        "chartType": "solar",
        "dateRange": "day",
        "areas": "solaractual,solarforecast",
    },
    {
        "region": "ROI",
        "chartType": "interconnection",
        "dateRange": "day",
        "areas": "ewic,moyle,greenlink,netinterconnection",
    },
    {
        "region": "ROI",
        "chartType": "market-pricing",
        "dateRange": "day",
        "areas": "imbalance-price-volume,pricing2",
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fetch(url: str, timeout: int = 40) -> tuple[int, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.65 (+https://salmonofdoubt.github.io/demos/ietm/)",
            "Accept": "text/html,application/json,application/javascript,text/plain,*/*",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        content_type = r.headers.get("content-type", "")
        return r.status, content_type, r.read().decode("utf-8", errors="replace")


def abs_url(base: str, value: str) -> str:
    return urllib.parse.urljoin(base, value)


def extract_script_srcs(page: str, base: str) -> list[str]:
    out = []
    for m in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\']', page, flags=re.I):
        out.append(abs_url(base, html.unescape(m.group(1))))
    return sorted(set(out))


def extract_candidate_strings(text: str, base: str) -> list[str]:
    patterns = [
        r'https?://[^\s"\'<>]+',
        r'["\']([^"\']*(?:api|chart|table|ajax|compareData|datefrom|duration|generation|demand|wind|solar|interconnection|co2|market)[^"\']*)["\']',
    ]

    found = set()
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.I):
            value = m.group(1) if m.groups() else m.group(0)
            value = html.unescape(value).strip()
            if not value or value.startswith("#"):
                continue
            found.add(abs_url(base, value))

    return sorted(found)


def safe_json_preview(text: str) -> Any:
    try:
        obj = json.loads(text)
    except Exception:
        return None

    if isinstance(obj, dict):
        return {
            "type": "dict",
            "keys": list(obj.keys())[:20],
            "sample": json.dumps(obj)[:900],
        }

    if isinstance(obj, list):
        return {
            "type": "list",
            "length": len(obj),
            "sample": json.dumps(obj[:3])[:900],
        }

    return {"type": type(obj).__name__, "sample": str(obj)[:500]}


def endpoint_url(path: str, params: dict[str, str]) -> str:
    return BASE + path + "?" + urllib.parse.urlencode(params)


def main() -> int:
    page_results = {}
    scripts = set()
    page_candidates = set()

    for name, url in PAGES.items():
        try:
            status, content_type, text = fetch(url)
            script_srcs = extract_script_srcs(text, url)
            candidates = extract_candidate_strings(text, url)

            scripts.update(script_srcs)
            page_candidates.update(candidates)

            page_results[name] = {
                "url": url,
                "status": status,
                "content_type": content_type,
                "script_count": len(script_srcs),
                "candidate_count": len(candidates),
                "scripts": script_srcs[:80],
                "candidates": candidates[:120],
                "text_sample": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text))[:1200],
            }
        except Exception as exc:
            page_results[name] = {
                "url": url,
                "error": str(exc),
            }

    script_results = []
    for src in sorted(scripts):
        if "smartgriddashboard.com" not in src:
            continue
        try:
            status, content_type, text = fetch(src)
            candidates = extract_candidate_strings(text, src)
            relevant = [
                u for u in candidates
                if re.search(r"api|chart|table|compareData|generation|demand|wind|solar|interconnection|co2|market", u, re.I)
            ]
            if relevant:
                script_results.append({
                    "script": src,
                    "status": status,
                    "content_type": content_type,
                    "matches": relevant[:120],
                })
        except Exception as exc:
            script_results.append({
                "script": src,
                "error": str(exc),
            })

    endpoint_tests = []

    for api_path in API_CANDIDATES:
        for params in TEST_QUERIES:
            url = endpoint_url(api_path, params)
            try:
                status, content_type, text = fetch(url)
                endpoint_tests.append({
                    "url": url,
                    "status": status,
                    "content_type": content_type,
                    "length": len(text),
                    "json_preview": safe_json_preview(text),
                    "text_preview": text[:500],
                })
            except Exception as exc:
                endpoint_tests.append({
                    "url": url,
                    "error": str(exc),
                })

    payload = {
        "generated_at": now_iso(),
        "purpose": "Find Smart Grid Dashboard machine-readable chart/table endpoints",
        "pages": page_results,
        "page_candidates": sorted(page_candidates)[:260],
        "script_results": script_results,
        "endpoint_tests": endpoint_tests,
        "next_manual_step": "Use browser DevTools Network > Fetch/XHR on Smart Grid Dashboard, click View in Table / Compare Data, then copy the successful request as cURL.",
    }

    (DEBUG / "smartgrid_endpoint_probe.json").write_text(json.dumps(payload, indent=2) + "\n")

    lines = []
    lines.append("SMART GRID ENDPOINT PROBE")
    lines.append(f"generated_at: {payload['generated_at']}")
    lines.append("")
    lines.append("ENDPOINT TESTS")
    for test in endpoint_tests:
        lines.append("")
        lines.append(test["url"])
        if "error" in test:
            lines.append(f"  ERROR {test['error']}")
        else:
            lines.append(f"  status={test['status']} content_type={test['content_type']} length={test['length']}")
            if test.get("json_preview"):
                lines.append(f"  JSON {test['json_preview']}")
            else:
                lines.append(f"  TEXT {test.get('text_preview', '')[:240]}")

    lines.append("")
    lines.append("SCRIPT MATCHES")
    for block in script_results:
        lines.append("")
        lines.append(f"SCRIPT {block.get('script')}")
        if block.get("error"):
            lines.append(f"  ERROR {block['error']}")
        for match in block.get("matches", [])[:80]:
            lines.append(f"  {match}")

    (DEBUG / "smartgrid_endpoint_probe.txt").write_text("\n".join(lines) + "\n")

    print("Wrote ops/debug/smartgrid_endpoint_probe.json")
    print("Wrote ops/debug/smartgrid_endpoint_probe.txt")
    print()
    print("Inspect:")
    print("grep -niE 'status=200|json|api|chart|table|demand|wind|solar|generation|interconnection' demos/ietm/ops/debug/smartgrid_endpoint_probe.txt | head -260")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
