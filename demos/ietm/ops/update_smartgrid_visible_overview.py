#!/usr/bin/env python3
"""
Optional SmartGrid visible-page cross-check.

This file intentionally does NOT populate canonical electricity_now values.
The structured SmartGrid API harvester is authoritative for live electricity.

The visible page is scraped only as a public-facing cross-check. If its HTML
changes or renders incompletely, this script records diagnostics and exits
non-zero. run_pipeline.py marks this step optional and continues to the
normalisation and validation gates.
"""

from __future__ import annotations

import html
import json
import math
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "data" / "monitor.json"
SOURCE_ELECTRICITY = ROOT / "data" / "source" / "electricity.json"
DEBUG_OUT = ROOT / "ops" / "debug" / "smartgrid_visible_overview_debug.json"

URL = "https://www.smartgriddashboard.com/all/generation/"

NUMBER = r"([+-]?\d[\d,]*(?:\.\d+)?)"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def fetch_visible_generation_page() -> tuple[str, str]:
    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": (
                "IrelandEnergyTransitionMonitor/1.2 "
                "(+https://salmonofdoubt.github.io/demos/ietm/)"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )

    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read().decode("utf-8", errors="replace")

    without_scripts = re.sub(
        r"<script\b.*?</script>", " ", raw, flags=re.I | re.S
    )
    without_styles = re.sub(
        r"<style\b.*?</style>", " ", without_scripts, flags=re.I | re.S
    )
    text = html.unescape(re.sub(r"<[^>]+>", "\n", without_styles))
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    flat = " ".join(lines)

    return raw, flat


def parse_number(text: str) -> float:
    return float(text.replace(",", "").strip())


def _find_after(
    flat: str,
    label_pattern: str,
    unit: str,
    start: int,
    max_gap: int = 1200,
    optional_parenthetical: bool = False,
) -> re.Match[str]:
    parenthetical = r"(?:\s*\([^)]{0,180}\))?" if optional_parenthetical else ""
    pattern = re.compile(
        label_pattern
        + parenthetical
        + r"\s*(?::|[–—])?\s*"
        + NUMBER
        + r"\s*"
        + re.escape(unit),
        flags=re.I | re.S,
    )

    match = pattern.search(flat, pos=start)
    if not match:
        raise RuntimeError(f"Could not parse visible metric: {label_pattern} {unit}")

    if match.start() - start > max_gap:
        raise RuntimeError(
            f"Visible metric '{label_pattern}' was too far from the preceding KPI; "
            "refusing an ambiguous match."
        )

    return match


def find_generation_kpi_block(flat: str) -> dict:
    """
    Parse the visible KPI sequence while tolerating presentational changes.

    We still require:
      1. the same four labels,
      2. the expected units,
      3. the expected order,
      4. short distances between cards.

    This is deliberately more robust than one giant exact regex, while still
    refusing to harvest arbitrary values from later charts or page legends.
    """
    generation = _find_after(
        flat,
        r"LATEST\s+SYSTEM\s+GENERATION",
        "MW",
        start=0,
        max_gap=len(flat),
    )
    thermal = _find_after(
        flat,
        r"THERMAL\s+GENERATION",
        "%",
        start=generation.end(),
        optional_parenthetical=True,
    )
    renewable = _find_after(
        flat,
        r"RENEWABLE\s+GENERATION",
        "%",
        start=thermal.end(),
    )
    net_import = _find_after(
        flat,
        r"NET\s+IMPORT",
        "%",
        start=renewable.end(),
    )

    values = {
        "generation_mw": parse_number(generation.group(1)),
        "thermal_generation_percent": parse_number(thermal.group(1)),
        "renewable_generation_percent": parse_number(renewable.group(1)),
        "net_import_percent": parse_number(net_import.group(1)),
    }

    if not math.isfinite(values["generation_mw"]) or not (
        500 <= values["generation_mw"] <= 14000
    ):
        raise RuntimeError("Parsed visible generation_mw is implausible.")

    for key in ("thermal_generation_percent", "renewable_generation_percent"):
        if not math.isfinite(values[key]) or not (0 <= values[key] <= 100):
            raise RuntimeError(f"Parsed visible {key} is implausible.")

    if not math.isfinite(values["net_import_percent"]) or not (
        -100 <= values["net_import_percent"] <= 100
    ):
        raise RuntimeError("Parsed visible net_import_percent is implausible.")

    values["matched_context"] = flat[
        max(0, generation.start() - 180) : min(len(flat), net_import.end() + 180)
    ]
    return values


def cross_check_payload(overview: dict) -> dict:
    generation_mw = overview["generation_mw"]
    net_import_percent = overview["net_import_percent"]
    interconnection_mw = generation_mw * net_import_percent / 100.0

    return {
        "available": True,
        "generation_mw": round(generation_mw),
        "renewable_generation_percent": round(
            overview["renewable_generation_percent"], 2
        ),
        "thermal_generation_percent": round(
            overview["thermal_generation_percent"], 2
        ),
        "net_import_percent": round(net_import_percent, 2),
        "derived_interconnection_mw": round(interconnection_mw),
        "source_url": URL,
        "harvested_at": now_iso(),
        "role": "optional_visible_page_cross_check",
        "note": (
            "Visible SmartGrid System Generation KPI values. These do not "
            "overwrite canonical SmartGrid API electricity values."
        ),
    }


def patch_success(path: Path, overview: dict) -> None:
    data = read_json(path)
    e = data.setdefault("electricity_now", {})

    # Remove legacy fields that made the visible page look authoritative.
    for key in (
        "thermal_generation_percent",
        "interconnection_note",
        "smartgrid_visible_overview_url",
        "smartgrid_visible_overview_harvested_at",
    ):
        e.pop(key, None)

    e["smartgrid_visible_overview"] = cross_check_payload(overview)

    data.setdefault("source_status", {})
    data["source_status"]["smartgrid_visible_overview"] = {
        "source": "SmartGrid Dashboard visible System Generation page",
        "source_url": URL,
        "harvested_at": now_iso(),
        "mode": "optional-visible-page-cross-check",
        "available": True,
        "caveat": (
            "Visible HTML is used only as a cross-check. Canonical live "
            "electricity values come from the structured SmartGrid API and are "
            "not overwritten by this page scraper."
        ),
    }

    write_json(path, data)


def patch_failure(path: Path, error: str) -> None:
    if not path.exists():
        return

    data = read_json(path)
    e = data.setdefault("electricity_now", {})

    for key in (
        "thermal_generation_percent",
        "interconnection_note",
        "smartgrid_visible_overview_url",
        "smartgrid_visible_overview_harvested_at",
    ):
        e.pop(key, None)

    e["smartgrid_visible_overview"] = {
        "available": False,
        "source_url": URL,
        "harvested_at": now_iso(),
        "role": "optional_visible_page_cross_check",
        "error": error,
    }

    data.setdefault("source_status", {})
    data["source_status"]["smartgrid_visible_overview"] = {
        "source": "SmartGrid Dashboard visible System Generation page",
        "source_url": URL,
        "harvested_at": now_iso(),
        "mode": "optional-visible-page-cross-check",
        "available": False,
        "caveat": (
            "Visible page could not be parsed. This does not invalidate the "
            "structured SmartGrid API harvest."
        ),
        "error": error,
    }

    write_json(path, data)


def main() -> int:
    raw = ""
    flat = ""

    try:
        raw, flat = fetch_visible_generation_page()
        overview = find_generation_kpi_block(flat)
        matched_context = overview.pop("matched_context")

        overview.update(
            {
                "source_url": URL,
                "harvested_at": now_iso(),
            }
        )

        patch_success(SOURCE_ELECTRICITY, overview)
        patch_success(MONITOR, overview)

        debug = {
            "source_url": URL,
            "harvested_at": now_iso(),
            "status": "parsed",
            "overview": overview,
            "response_length": len(raw),
            "flat_text_excerpt": flat[:6000],
            "matched_kpi_context": matched_context,
            "note": (
                "Optional visible-page cross-check only. Canonical live values "
                "remain those produced by the SmartGrid API harvester."
            ),
        }
        write_json(DEBUG_OUT, debug)

        print("Updated optional visible SmartGrid System Generation cross-check.")
        print("generation_mw:", round(overview["generation_mw"]))
        print(
            "renewable_generation_percent:",
            overview["renewable_generation_percent"],
        )
        print(
            "thermal_generation_percent:",
            overview["thermal_generation_percent"],
        )
        print("net_import_percent:", overview["net_import_percent"])
        return 0

    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

        patch_failure(SOURCE_ELECTRICITY, error)
        patch_failure(MONITOR, error)

        debug = {
            "source_url": URL,
            "harvested_at": now_iso(),
            "status": "unavailable",
            "error": error,
            "response_length": len(raw),
            "flat_text_excerpt": flat[:6000],
            "note": (
                "Visible-page cross-check failed. Structured SmartGrid API data "
                "must remain authoritative; run_pipeline.py will continue."
            ),
        }
        write_json(DEBUG_OUT, debug)

        print(
            "Optional SmartGrid visible-page cross-check unavailable: "
            f"{error}",
            file=sys.stderr,
        )
        print(f"Debug written: {DEBUG_OUT.relative_to(ROOT)}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
