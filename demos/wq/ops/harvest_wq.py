#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

from wq_pipeline.core.records import as_float

from wq_pipeline.adapters.opw_waterlevel import harvest_opw as harvest_opw_adapter
from wq_pipeline.adapters.epa_bathing import harvest_bathing as harvest_bathing_adapter
from wq_pipeline.adapters.epa_wfd import harvest_wfd as harvest_wfd_adapter
from wq_pipeline.adapters.context import planned_context_records as planned_context_records_adapter

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


SOURCE_DEFS = {
    "opw_waterlevel": {
        "name": "OPW waterlevel.ie latest readings",
        "freshness_class": "live",
        "licence": "CC BY 4.0",
        "caveat": "Latest hydrometric readings are provisional, can lag by station and should not be used as emergency advice."
    },
    "epa_bathing_locations": {
        "name": "EPA Bathing Water locations",
        "freshness_class": "seasonal",
        "licence": "CC BY 4.0",
        "caveat": "Location and annual classification data are generally seasonal or annual."
    },
    "epa_bathing_measurements": {
        "name": "EPA Bathing Water measurements",
        "freshness_class": "latest",
        "licence": "CC BY 4.0",
        "caveat": "Samples are latest official results, not continuous live sensors."
    },
    "epa_bathing_alerts": {
        "name": "EPA Bathing Water alerts",
        "freshness_class": "current",
        "licence": "CC BY 4.0",
        "caveat": "Alerts are current API records reported by local authorities to EPA."
    },
    "epa_wfd": {
        "name": "EPA WFD Open Data context",
        "freshness_class": "context",
        "licence": "CC BY 4.0",
        "caveat": "WFD data describe catchment and waterbody status/context, not live water chemistry."
    },
    "epa_geoportal_context": {
        "name": "EPA Geoportal water quality datasets",
        "freshness_class": "historical",
        "licence": "CC BY 4.0",
        "caveat": "Groundwater, coastal, transitional and Q-value datasets are planned historical/context joins."
    },
    "marine_institute_context": {
        "name": "Marine Institute ERDDAP context",
        "freshness_class": "planned",
        "licence": "check source dataset",
        "caveat": "Marine shore indicators are planned once stable datasets and variable names are selected."
    }
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_focus_config() -> dict[str, Any]:
    path = DATA_DIR / "focus-areas.json"
    return json.loads(path.read_text(encoding="utf-8"))


def focus_keywords() -> list[str]:
    config = load_focus_config()
    keywords: list[str] = []
    for area in config.get("areas", []):
        keywords.extend(area.get("keywords", []))
    deduped: list[str] = []
    seen = set()
    for keyword in keywords:
        key = str(keyword).strip().lower()
        if key and key not in seen:
            seen.add(key)
            deduped.append(str(keyword).strip())
    return deduped


def harvest_opw(now: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return harvest_opw_adapter(now, source_defs=SOURCE_DEFS)


def harvest_bathing(now: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    return harvest_bathing_adapter(now, source_defs=SOURCE_DEFS)


def harvest_wfd(now: str, keywords: list[str]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return harvest_wfd_adapter(now, keywords, source_defs=SOURCE_DEFS)


def planned_context_records(now: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    return planned_context_records_adapter(now, source_defs=SOURCE_DEFS)


def build_payload() -> dict[str, Any]:
    now = utc_now()
    keywords = focus_keywords()
    records: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []

    opw_records, opw_source = harvest_opw(now)
    records.extend(opw_records)
    sources.append(opw_source)

    bathing_records, bathing_sources = harvest_bathing(now)
    records.extend(bathing_records)
    sources.extend(bathing_sources)

    wfd_records, wfd_source = harvest_wfd(now, keywords)
    records.extend(wfd_records)
    sources.append(wfd_source)

    planned_records, planned_sources = planned_context_records(now)
    records.extend(planned_records)
    sources.extend(planned_sources)

    mapped = sum(1 for record in records if as_float(record.get("lat")) is not None and as_float(record.get("lon")) is not None)

    return {
        "version": "0.1.0",
        "generated_at_utc": now,
        "summary": {
            "records": len(records),
            "mapped_records": mapped,
            "focus": "Configured focus areas"
        },
        "sources": sources,
        "records": records,
        "analysis": {
            "cq_pairs": []
        }
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DATA_DIR / "latest.json"))
    args = parser.parse_args()

    payload = build_payload()
    write_json(Path(args.output), payload)
    write_json(DATA_DIR / "source-status.json", {
        "generated_at_utc": payload["generated_at_utc"],
        "sources": payload["sources"]
    })

    print(f"Wrote {args.output}")
    print(f"Records: {payload['summary']['records']}; mapped: {payload['summary']['mapped_records']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
