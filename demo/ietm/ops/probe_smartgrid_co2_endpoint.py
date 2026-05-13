#!/usr/bin/env python3
"""
Probe Smart Grid Dashboard pages for hidden CO2 JSON/API endpoints.

This does not modify public data.
It downloads the CO2 HTML and linked JavaScript, then searches for likely API,
JSON, CO2, intensity, and emissions endpoints.

Output:
  ops/debug/smartgrid_endpoint_probe.txt
"""

from __future__ import annotations

import re
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEBUG = ROOT / "ops" / "debug"
REPORT = DEBUG / "smartgrid_endpoint_probe.txt"

BASE = "https://www.smartgriddashboard.com"
PAGES = [
    "https://www.smartgriddashboard.com/roi/co2/",
    "https://www.smartgriddashboard.com/all/co2/",
]


def fetch(url: str) -> tuple[int, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 IrelandEnergyMonitorEndpointProbe/0.1",
            "Accept": "*/*",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, response.headers.get("content-type", ""), body
    except Exception as exc:
        return 0, "ERROR", str(exc)


def absolute(url: str, base: str) -> str:
    return urllib.parse.urljoin(base, url)


def extract_assets(html: str, page_url: str) -> list[str]:
    assets = set()

    for pattern in [
        r'<script[^>]+src=["\']([^"\']+)["\']',
        r'<link[^>]+href=["\']([^"\']+)["\']',
    ]:
        for m in re.finditer(pattern, html, flags=re.I):
            u = absolute(m.group(1), page_url)
            if any(x in u.lower() for x in [".js", ".json", "api", "co2", "carbon", "intensity"]):
                assets.add(u)

    return sorted(assets)


def extract_url_like(text: str, base_url: str) -> list[str]:
    found = set()

    # Quoted relative/absolute endpoints.
    for m in re.finditer(r'["\']([^"\']*(?:api|json|co2|carbon|intensity|emission)[^"\']*)["\']', text, flags=re.I):
        candidate = m.group(1).strip()
        if not candidate or candidate.startswith("#"):
            continue
        if candidate.startswith(("http://", "https://", "/", "./", "../")):
            found.add(absolute(candidate, base_url))

    # JS fetch/ajax URL-ish strings.
    for m in re.finditer(r'(?:url|href|endpoint|path)\s*[:=]\s*["\']([^"\']+)["\']', text, flags=re.I):
        candidate = m.group(1).strip()
        if any(x in candidate.lower() for x in ["api", "json", "co2", "carbon", "intensity", "emission"]):
            found.add(absolute(candidate, base_url))

    return sorted(found)


def looks_promising(url: str) -> bool:
    u = url.lower()
    terms = ["api", "json", "co2", "carbon", "intensity", "emission", "chart", "umbraco"]
    return any(t in u for t in terms)


def main() -> None:
    DEBUG.mkdir(parents=True, exist_ok=True)

    lines = []
    all_assets = set()
    all_candidates = set()

    for page in PAGES:
        status, ctype, html = fetch(page)
        lines.append(f"\nPAGE {page}")
        lines.append(f"STATUS {status} | {ctype}")
        lines.append(f"HTML length: {len(html)}")

        (DEBUG / (page.replace("https://", "").replace("/", "_") + ".html")).write_text(html)

        assets = extract_assets(html, page)
        lines.append("\nASSETS:")
        for a in assets:
            lines.append(f"  {a}")
            all_assets.add(a)

        candidates = extract_url_like(html, page)
        lines.append("\nHTML CANDIDATES:")
        for c in candidates:
            lines.append(f"  {c}")
            all_candidates.add(c)

    lines.append("\n\nFETCHING ASSETS")
    for asset in sorted(all_assets):
        status, ctype, body = fetch(asset)
        lines.append(f"\nASSET {asset}")
        lines.append(f"STATUS {status} | {ctype} | length={len(body)}")

        safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "_", asset.replace("https://", ""))
        (DEBUG / safe_name).write_text(body)

        candidates = extract_url_like(body, asset)
        if candidates:
            lines.append("ASSET CANDIDATES:")
            for c in candidates:
                lines.append(f"  {c}")
                all_candidates.add(c)

        # Show lines around CO2/API terms.
        for term in ["co2", "carbon", "intensity", "emission", "api", "chart", "umbraco"]:
            for m in re.finditer(term, body, flags=re.I):
                start = max(0, m.start() - 140)
                end = min(len(body), m.end() + 220)
                snippet = body[start:end].replace("\n", " ")
                lines.append(f"SNIPPET [{term}]: {snippet[:500]}")
                break

    lines.append("\n\nPROBING CANDIDATE URLS")
    for candidate in sorted(c for c in all_candidates if looks_promising(c)):
        status, ctype, body = fetch(candidate)
        preview = body[:500].replace("\n", " ")
        lines.append(f"\nCANDIDATE {candidate}")
        lines.append(f"STATUS {status} | {ctype} | length={len(body)}")
        lines.append(f"PREVIEW {preview}")

    REPORT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {REPORT.relative_to(ROOT)}")
    print("\nMost useful next command:")
    print(f"grep -niE 'api|json|co2|carbon|intensity|emission|umbraco' {REPORT.relative_to(ROOT)} | head -120")


if __name__ == "__main__":
    main()
