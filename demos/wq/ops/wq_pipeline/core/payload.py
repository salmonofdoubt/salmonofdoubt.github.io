from __future__ import annotations

from collections import Counter
from typing import Any


EXPECTED_SOURCE_COUNT = 11
MIN_TOTAL_RECORDS = 100
MIN_OPW_RECORDS = 1000

REQUIRED_SOURCE_IDS = (
    "opw_waterlevel",
    "epa_bathing_locations",
    "epa_bathing_measurements",
    "epa_bathing_alerts",
    "epa_wfd",
    "epa_official_wq",
    "epa_official_chemistry",
    "epa_geoportal_context",
    "marine_institute_weather_buoys",
    "local_focus_places",
    "met_eireann_observations",
)


def records_by_source(payload: dict[str, Any]) -> dict[str, int]:
    records = payload.get("records", [])

    if not isinstance(records, list):
        return {}

    return dict(Counter(str(record.get("source", "unknown")) for record in records if isinstance(record, dict)))


def source_statuses(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    sources = payload.get("sources", [])

    if not isinstance(sources, list):
        return {}

    return {
        str(source.get("id")): source
        for source in sources
        if isinstance(source, dict) and source.get("id")
    }


def payload_health(
    payload: dict[str, Any],
    *,
    min_total_records: int = MIN_TOTAL_RECORDS,
    min_opw_records: int = MIN_OPW_RECORDS,
    expected_source_count: int = EXPECTED_SOURCE_COUNT,
    required_source_ids: tuple[str, ...] = REQUIRED_SOURCE_IDS,
) -> dict[str, Any]:
    records = payload.get("records", [])
    sources = payload.get("sources", [])

    record_count = len(records) if isinstance(records, list) else 0
    source_count = len(sources) if isinstance(sources, list) else 0
    source_map = source_statuses(payload)
    source_counts = records_by_source(payload)

    issues: list[str] = []

    if record_count < min_total_records:
        issues.append(f"record count {record_count} is below minimum {min_total_records}")

    if source_count < expected_source_count:
        issues.append(f"source count {source_count} is below expected {expected_source_count}")

    for source_id in required_source_ids:
        if source_id not in source_map:
            issues.append(f"required source {source_id} is missing")

    opw_source = source_map.get("opw_waterlevel")

    if opw_source is None:
        issues.append("OPW source status is missing")
    else:
        opw_status = opw_source.get("status")
        opw_reported_records = int(opw_source.get("records") or 0)
        opw_actual_records = int(source_counts.get("opw_waterlevel") or 0)

        if opw_status != "ok":
            issues.append(f"OPW source status is {opw_status!r}, not 'ok'")

        if opw_reported_records < min_opw_records:
            issues.append(f"OPW reported records {opw_reported_records} below minimum {min_opw_records}")

        if opw_actual_records < min_opw_records:
            issues.append(f"OPW payload records {opw_actual_records} below minimum {min_opw_records}")

    return {
        "ok": not issues,
        "status": "ok" if not issues else "rejected",
        "issues": issues,
        "record_count": record_count,
        "source_count": source_count,
        "records_by_source": source_counts,
        "minimums": {
            "records": min_total_records,
            "opw_records": min_opw_records,
            "sources": expected_source_count,
        },
    }
