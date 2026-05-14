#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import math
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MONITOR = ROOT / "data" / "monitor.json"
SOURCE_ELECTRICITY = ROOT / "data" / "source" / "electricity.json"
DEBUG_OUT = ROOT / "ops" / "debug" / "smartgrid_visible_overview_debug.json"

URL = "https://www.smartgriddashboard.com/all/generation/"


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
            "User-Agent": "IrelandEnergyTransitionMonitor/1.1 (+https://salmonofdoubt.github.io/demos/ietm/)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IE,en;q=0.9",
        },
    )

    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read().decode("utf-8", errors="replace")

    without_scripts = re.sub(r"<script\b.*?</script>", " ", raw, flags=re.I | re.S)
    without_styles = re.sub(r"<style\b.*?</style>", " ", without_scripts, flags=re.I | re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", without_styles))
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    flat = " ".join(lines)

    return raw, flat


def parse_number(text: str) -> float:
    clean = text.replace(",", "").strip()
    return float(clean)


def find_metric(flat: str, label_pattern: str, unit: str) -> float:
    pattern = label_pattern + r"\s+([+-]?\d[\d,]*(?:\.\d+)?)\s*" + re.escape(unit)
    match = re.search(pattern, flat, flags=re.I)
    if not match:
        raise RuntimeError(f"Could not parse metric: {label_pattern} {unit}")
    return parse_number(match.group(1))


def find_generation_kpi_block(flat: str) -> dict:
    """
    Parse only the visible four-card System Generation KPI sequence:

    LATEST SYSTEM GENERATION ... MW
    THERMAL GENERATION ... %
    RENEWABLE GENERATION ... %
    NET IMPORT ... %

    This avoids accidentally taking a later chart/legend/embedded value.
    """
    pattern = re.compile(
        r"LATEST\s+SYSTEM\s+GENERATION\s+"
        r"(?P<generation>[+-]?\d[\d,]*(?:\.\d+)?)\s*MW"
        r".{0,900}?"
        r"THERMAL\s+GENERATION\s+\(COAL,\s*GAS,\s*OTHER\)\s+"
        r"(?P<thermal>[+-]?\d[\d,]*(?:\.\d+)?)\s*%"
        r".{0,900}?"
        r"RENEWABLE\s+GENERATION\s+"
        r"(?P<renewable>[+-]?\d[\d,]*(?:\.\d+)?)\s*%"
        r".{0,900}?"
        r"NET\s+IMPORT\s+"
        r"(?P<net_import>[+-]?\d[\d,]*(?:\.\d+)?)\s*%",
        flags=re.I | re.S,
    )

    match = pattern.search(flat)
    if not match:
        raise RuntimeError("Could not parse visible System Generation KPI block.")

    return {
        "generation_mw": parse_number(match.group("generation")),
        "thermal_generation_percent": parse_number(match.group("thermal")),
        "renewable_generation_percent": parse_number(match.group("renewable")),
        "net_import_percent": parse_number(match.group("net_import")),
        "matched_context": flat[max(0, match.start() - 180): min(len(flat), match.end() + 180)],
    }


def patch(path: Path, overview: dict) -> None:
    data = read_json(path)
    e = data.setdefault("electricity_now", {})

    generation_mw = overview["generation_mw"]
    net_import_percent = overview["net_import_percent"]
    interconnection_mw = generation_mw * net_import_percent / 100.0

    e.update({
        "generation_mw": round(generation_mw),
        "renewables_percent": round(overview["renewable_generation_percent"], 2),
        "thermal_generation_percent": round(overview["thermal_generation_percent"], 2),

        "net_import_percent": round(net_import_percent, 2),
        "interconnection_percent": round(net_import_percent, 2),
        "interconnection_mw": round(interconnection_mw),
        "imports_mw": round(max(interconnection_mw, 0.0)),
        "exports_mw": round(max(-interconnection_mw, 0.0)),
        "imports_percent": round(max(net_import_percent, 0.0), 2),
        "exports_percent": round(max(-net_import_percent, 0.0), 2),
        "interconnection_direction": (
            "exporting" if interconnection_mw < -0.5
            else "importing" if interconnection_mw > 0.5
            else "near balanced"
        ),
        "interconnection_basis": "smartgrid_visible_generation_overview_net_import_percent",
        "interconnection_note": "Live SmartGrid System Generation page NET IMPORT % converted to MW using visible system generation.",
        "smartgrid_visible_overview_url": URL,
        "smartgrid_visible_overview_harvested_at": now_iso(),
    })

    data.setdefault("source_status", {})
    data["source_status"]["smartgrid_visible_overview"] = {
        "source": "SmartGrid Dashboard visible System Generation page",
        "source_url": URL,
        "harvested_at": now_iso(),
        "mode": "visible-page-current-kpi-parser",
        "caveat": "Uses the visible System Generation KPI values. Net Import % is converted to MW from visible system generation for the top KPI card.",
    }

    write_json(path, data)


def main() -> int:
    raw, flat = fetch_visible_generation_page()

    overview = find_generation_kpi_block(flat)
    matched_context = overview.pop("matched_context")
    overview.update({
        "source_url": URL,
        "harvested_at": now_iso(),
    })

    if not math.isfinite(overview["generation_mw"]) or overview["generation_mw"] <= 0:
        raise RuntimeError("Parsed generation_mw is not valid.")

    patch(SOURCE_ELECTRICITY, overview)
    patch(MONITOR, overview)

    debug = {
        "source_url": URL,
        "harvested_at": now_iso(),
        "overview": overview,
        "flat_text_excerpt": flat[:6000],
        "matched_kpi_context": matched_context,
        "note": "Net Import % is live-parsed from the visible SmartGrid generation page, not hardcoded.",
    }
    write_json(DEBUG_OUT, debug)

    derived_mw = overview["generation_mw"] * overview["net_import_percent"] / 100.0

    print("Updated from visible SmartGrid System Generation page.")
    print("generation_mw:", round(overview["generation_mw"]))
    print("renewable_generation_percent:", overview["renewable_generation_percent"])
    print("thermal_generation_percent:", overview["thermal_generation_percent"])
    print("net_import_percent:", overview["net_import_percent"])
    print("derived_interconnection_mw:", round(derived_mw))
    print("direction:", "exporting" if derived_mw < -0.5 else "importing" if derived_mw > 0.5 else "near balanced")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
