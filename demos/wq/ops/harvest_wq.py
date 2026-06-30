#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

from wq_pipeline.core.records import as_float
from wq_pipeline.core.payload import payload_health

from wq_pipeline.adapters.opw_waterlevel import harvest_opw as harvest_opw_adapter
from wq_pipeline.adapters.epa_bathing import harvest_bathing as harvest_bathing_adapter
from wq_pipeline.adapters.epa_wfd import harvest_wfd as harvest_wfd_adapter
from wq_pipeline.adapters.context import planned_context_records as planned_context_records_adapter
from wq_pipeline.adapters.marine_erddap import harvest_marine_weather_buoys as harvest_marine_weather_buoys_adapter
from wq_pipeline.adapters.met_eireann_observations import harvest_met_eireann_observations as harvest_met_eireann_observations_adapter
from wq_pipeline.adapters.focus_places import build_focus_place_records as build_focus_place_records_adapter

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
    "marine_institute_weather_buoys": {
        "name": "Marine Institute Irish Weather Buoy Network",
        "freshness_class": "near_live",
        "licence": "check source dataset",
        "caveat": "Near-real-time met-ocean observations from ERDDAP; useful for coastal context, not nutrient chemistry."
    },
    "met_eireann_observations": {
        "name": "Met Éireann current station observations",
        "freshness_class": "near_live",
        "licence": "check source terms",
        "caveat": "Current station rainfall/weather observations are event-driver context, not water-quality chemistry."
    },
    "local_focus_places": {
        "name": "Local focus-place anchors",
        "freshness_class": "context",
        "licence": "site-defined context",
        "caveat": "Navigation/context markers for named focus places. These are not monitoring measurements."
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


def harvest_marine_weather_buoys(now: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return harvest_marine_weather_buoys_adapter(now, source_defs=SOURCE_DEFS)


def harvest_met_eireann_observations(now: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return harvest_met_eireann_observations_adapter(now, source_defs=SOURCE_DEFS)


def build_focus_place_records(now: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return build_focus_place_records_adapter(now, source_defs=SOURCE_DEFS)




def load_previous_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

    return payload if isinstance(payload, dict) else {}


def previous_record_generated_at(payload: dict[str, Any]) -> dict[str, str]:
    cache: dict[str, str] = {}

    for record in payload.get("records", []):
        if not isinstance(record, dict):
            continue

        record_id = str(record.get("id") or "").strip()
        generated_at = str(record.get("generated_at") or "").strip()

        if record_id and generated_at:
            cache[record_id] = generated_at

    return cache


def previous_record_order(payload: dict[str, Any]) -> dict[str, int]:
    order: dict[str, int] = {}

    for index, record in enumerate(payload.get("records", [])):
        if not isinstance(record, dict):
            continue

        record_id = str(record.get("id") or "").strip()

        if record_id and record_id not in order:
            order[record_id] = index

    return order


def previous_source_order(payload: dict[str, Any]) -> dict[str, int]:
    order: dict[str, int] = {}

    for index, source in enumerate(payload.get("sources", [])):
        if not isinstance(source, dict):
            continue

        source_id = str(source.get("id") or "").strip()

        if source_id and source_id not in order:
            order[source_id] = index

    return order


def normalise_payload_records(
    records: list[dict[str, Any]],
    *,
    generated_at_cache: dict[str, str] | None = None,
    order_cache: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    generated_at_cache = generated_at_cache or {}
    order_cache = order_cache or {}

    normalised: list[dict[str, Any]] = []

    for record in records:
        item = dict(record)
        record_id = str(item.get("id") or "").strip()
        observed_at = str(item.get("observed_at") or "").strip()

        if record_id and generated_at_cache.get(record_id):
            item["generated_at"] = generated_at_cache[record_id]
        elif observed_at:
            item["generated_at"] = observed_at

        normalised.append(item)

    def sort_key(record: dict[str, Any]) -> tuple[Any, ...]:
        record_id = str(record.get("id") or "")

        if record_id in order_cache:
            return (0, order_cache[record_id])

        return (
            1,
            str(record.get("source") or ""),
            str(record.get("type") or ""),
            record_id,
            str(record.get("observed_at") or ""),
            str(record.get("name") or ""),
        )

    return sorted(normalised, key=sort_key)


def normalise_payload_sources(
    sources: list[dict[str, Any]],
    *,
    order_cache: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    order_cache = order_cache or {}

    def sort_key(source: dict[str, Any]) -> tuple[Any, ...]:
        source_id = str(source.get("id") or "")

        if source_id in order_cache:
            return (0, order_cache[source_id])

        return (
            1,
            int(source.get("freshness_sort") or 999),
            source_id,
        )

    return sorted((dict(source) for source in sources), key=sort_key)


def refresh_payload_summary(payload: dict[str, Any]) -> None:
    records = payload.get("records", [])
    mapped = sum(
        1
        for record in records
        if as_float(record.get("lat")) is not None and as_float(record.get("lon")) is not None
    )

    payload.setdefault("summary", {})
    payload["summary"]["records"] = len(records)
    payload["summary"]["mapped_records"] = mapped


def build_payload() -> dict[str, Any]:
    now = utc_now()
    keywords = focus_keywords()
    records: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []

    focus_place_records, focus_place_source = build_focus_place_records(now)
    records.extend(focus_place_records)
    sources.append(focus_place_source)

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

    marine_records, marine_source = harvest_marine_weather_buoys(now)
    records.extend(marine_records)
    sources.append(marine_source)

    rainfall_records, rainfall_source = harvest_met_eireann_observations(now)
    records.extend(rainfall_records)
    sources.append(rainfall_source)

    records = normalise_payload_records(records)
    sources = normalise_payload_sources(sources)
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


def source_status_output_path(output_path: Path) -> Path:
    default_output = DATA_DIR / "latest.json"

    if output_path.resolve() == default_output.resolve():
        return DATA_DIR / "source-status.json"

    return output_path.with_name(f"{output_path.stem}-source-status.json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DATA_DIR / "latest.json"))
    parser.add_argument(
        "--allow-degraded",
        action="store_true",
        help="Write the new payload even if health checks fail.",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    payload = build_payload()

    previous_payload = load_previous_payload(output_path)
    payload["records"] = normalise_payload_records(
        payload["records"],
        generated_at_cache=previous_record_generated_at(previous_payload),
        order_cache=previous_record_order(previous_payload),
    )
    payload["sources"] = normalise_payload_sources(
        payload["sources"],
        order_cache=previous_source_order(previous_payload),
    )
    refresh_payload_summary(payload)

    health = payload_health(payload)
    payload["harvest_health"] = health

    source_status_payload = {
        "generated_at_utc": payload["generated_at_utc"],
        "sources": payload["sources"],
        "harvest_health": health,
    }

    should_write_latest = health["ok"] or args.allow_degraded or not output_path.exists()

    if should_write_latest:
        write_json(output_path, payload)
        print(f"Wrote {output_path}")
    else:
        print(f"Rejected degraded WQ payload; preserved existing {output_path}")
        for issue in health["issues"]:
            print(f"- {issue}")

    write_json(source_status_output_path(output_path), source_status_payload)

    print(f"Records: {payload['summary']['records']}; mapped: {payload['summary']['mapped_records']}")
    print(f"Harvest health: {health['status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
