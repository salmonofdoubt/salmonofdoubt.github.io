#!/usr/bin/env python3
"""
Probe Gas Networks Ireland imbalance-prices page for hidden data/export endpoints.

Goal:
- fetch page HTML
- fetch linked JS files from the same page
- extract likely API/export/AJAX URLs and form metadata
- write debug files so the real endpoint can be wired cleanly

This does not fabricate gas prices.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEBUG = ROOT / "ops" / "debug"
DEBUG.mkdir(parents=True, exist_ok=True)

GNI_URL = "https://www.gasnetworks.ie/about/data-transparency/balancing-actions-and-prices/imbalance-prices"


def fetch(url: str, timeout: int = 40) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "IrelandEnergyTransitionMonitor/0.58 (+https://salmonofdoubt.github.io/demos/ietm/)",
            "Accept": "text/html,application/javascript,application/json,text/plain,*/*",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="replace")


def absolute_url(base: str, value: str) -> str:
    return urllib.parse.urljoin(base, value)


def extract_urls(text: str) -> list[str]:
    patterns = [
        r'https?://[^\s"\'<>]+',
        r'["\']([^"\']*(?:api|ajax|export|csv|xlsx|download|dashboard|imbalance|price)[^"\']*)["\']',
    ]

    urls: set[str] = set()
    for pat in patterns:
        for m in re.finditer(pat, text, flags=re.I):
            value = m.group(1) if m.groups() else m.group(0)
            value = html.unescape(value).strip()
            if not value or value.startswith("#"):
                continue
            urls.add(value)
    return sorted(urls)


def extract_script_srcs(page: str) -> list[str]:
    out = []
    for m in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\']', page, flags=re.I):
        out.append(html.unescape(m.group(1)))
    return out


def extract_forms(page: str) -> list[dict]:
    forms = []
    for i, m in enumerate(re.finditer(r"<form\b[^>]*>.*?</form>", page, flags=re.I | re.S), start=1):
        block = m.group(0)
        action = re.search(r'action=["\']([^"\']*)["\']', block, flags=re.I)
        method = re.search(r'method=["\']([^"\']*)["\']', block, flags=re.I)
        inputs = []
        for im in re.finditer(r'<(?:input|button|select|textarea)\b[^>]*>', block, flags=re.I):
            tag = im.group(0)
            name = re.search(r'name=["\']([^"\']*)["\']', tag, flags=re.I)
            value = re.search(r'value=["\']([^"\']*)["\']', tag, flags=re.I)
            ident = re.search(r'id=["\']([^"\']*)["\']', tag, flags=re.I)
            typ = re.search(r'type=["\']([^"\']*)["\']', tag, flags=re.I)
            inputs.append({
                "tag": tag[:240],
                "id": html.unescape(ident.group(1)) if ident else "",
                "name": html.unescape(name.group(1)) if name else "",
                "type": html.unescape(typ.group(1)) if typ else "",
                "value": html.unescape(value.group(1)) if value else "",
            })
        forms.append({
            "index": i,
            "action": html.unescape(action.group(1)) if action else "",
            "method": html.unescape(method.group(1)) if method else "",
            "inputs": inputs,
        })
    return forms


def visible_text_sample(page: str) -> list[str]:
    s = re.sub(r"<script\b[^>]*>.*?</script>", "\n", page, flags=re.I | re.S)
    s = re.sub(r"<style\b[^>]*>.*?</style>", "\n", s, flags=re.I | re.S)
    s = re.sub(r"<[^>]+>", "\n", s)
    s = html.unescape(s)
    lines = []
    for line in s.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if line:
            lines.append(line)
    return lines[:220]


def main() -> int:
    page = fetch(GNI_URL)

    script_srcs = [absolute_url(GNI_URL, src) for src in extract_script_srcs(page)]
    same_domain_scripts = [
        u for u in script_srcs
        if urllib.parse.urlparse(u).netloc.endswith("gasnetworks.ie")
    ]

    js_results = []
    for src in same_domain_scripts[:40]:
        try:
            js = fetch(src)
            matches = extract_urls(js)
            relevant = [
                absolute_url(src, u)
                for u in matches
                if re.search(r"api|ajax|export|csv|xlsx|download|dashboard|imbalance|price|table", u, re.I)
            ]
            if relevant:
                js_results.append({
                    "script": src,
                    "matches": sorted(set(relevant))[:80],
                })
        except Exception as exc:
            js_results.append({
                "script": src,
                "error": str(exc),
            })

    page_urls = [absolute_url(GNI_URL, u) for u in extract_urls(page)]

    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "page": GNI_URL,
        "forms": extract_forms(page),
        "script_srcs": script_srcs,
        "page_candidate_urls": [
            u for u in sorted(set(page_urls))
            if re.search(r"api|ajax|export|csv|xlsx|download|dashboard|imbalance|price|table", u, re.I)
        ][:160],
        "script_candidate_urls": js_results,
        "visible_text_sample": visible_text_sample(page),
    }

    (DEBUG / "gni_imbalance_probe.json").write_text(json.dumps(payload, indent=2) + "\n")

    txt = []
    txt.append(f"PAGE {GNI_URL}")
    txt.append("")
    txt.append("FORMS")
    for form in payload["forms"]:
        txt.append(f"- form {form['index']} method={form['method']} action={form['action']}")
        for item in form["inputs"][:40]:
            txt.append(f"    id={item['id']} name={item['name']} type={item['type']} value={item['value']}")

    txt.append("")
    txt.append("PAGE CANDIDATE URLS")
    for u in payload["page_candidate_urls"]:
        txt.append(u)

    txt.append("")
    txt.append("SCRIPT CANDIDATE URLS")
    for block in payload["script_candidate_urls"]:
        txt.append(f"\nSCRIPT {block.get('script')}")
        if block.get("error"):
            txt.append(f"  ERROR {block['error']}")
        for u in block.get("matches", []):
            txt.append(f"  {u}")

    txt.append("")
    txt.append("VISIBLE TEXT SAMPLE")
    txt.extend(payload["visible_text_sample"])

    (DEBUG / "gni_imbalance_probe.txt").write_text("\n".join(txt) + "\n")

    print("Wrote ops/debug/gni_imbalance_probe.json")
    print("Wrote ops/debug/gni_imbalance_probe.txt")
    print()
    print("Useful next command:")
    print("grep -niE 'api|ajax|export|csv|xlsx|download|imbalance|sap|price|table' demos/ietm/ops/debug/gni_imbalance_probe.txt | head -220")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
