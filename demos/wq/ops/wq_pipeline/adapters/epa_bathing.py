from __future__ import annotations

from typing import Any

from wq_pipeline.core.geo import coordinate_from_record
from wq_pipeline.core.http import FetchResult, fetch_paged_json
from wq_pipeline.core.records import as_float, numeric_parameters, pick, safe_string
from wq_pipeline.core.status import make_source_status


EPA_BW = "https://data.epa.ie/bw/api/v1"

LOCATION_SOURCE_ID = "epa_bathing_locations"
MEASUREMENT_SOURCE_ID = "epa_bathing_measurements"
ALERT_SOURCE_ID = "epa_bathing_alerts"


def elapsed_ms(fetches: list[FetchResult]) -> int | None:
    if not fetches:
        return None
    return sum(fetch.elapsed_ms for fetch in fetches)


def source_status(
    source_defs: dict[str, dict[str, Any]],
    source_id: str,
    *,
    records: int,
    now: str,
    error: str | None,
    fetches: list[FetchResult],
) -> dict[str, Any]:
    return make_source_status(
        source_defs,
        source_id,
        status="partial" if error else "ok",
        records=records,
        fetched_at_utc=now,
        error=error,
        elapsed_ms=elapsed_ms(fetches),
    )


def build_location_records(
    locations: list[Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    location_index: dict[str, dict[str, Any]] = {}

    for idx, item in enumerate(locations):
        if not isinstance(item, dict):
            continue

        loc_id = safe_string(pick(item, ["location_id", "id", "LocationId", "beach_id"], f"location_{idx}"))
        name = safe_string(pick(item, ["name", "location_name", "beach_name", "BathingWaterName"], f"Bathing water {idx + 1}"))
        lat, lon = coordinate_from_record(item, name)

        location_index[loc_id] = {
            "name": name,
            "lat": lat,
            "lon": lon,
            "raw": item,
        }

        parameters: list[dict[str, Any]] = []
        classification = pick(
            item,
            ["current_annual_water_quality_classification", "annual_water_quality_classification", "classification"],
            None,
        )

        if classification:
            parameters.append({
                "key": "annual_classification",
                "label": "Annual classification",
                "value": str(classification),
                "unit": "",
                "basis": "EPA annual bathing-water classification",
            })

        records.append({
            "id": f"bw-location:{loc_id}",
            "source": LOCATION_SOURCE_ID,
            "source_label": source_defs[LOCATION_SOURCE_ID]["name"],
            "type": "bathing_water",
            "freshness": "seasonal",
            "name": name,
            "lat": lat,
            "lon": lon,
            "observed_at": pick(item, ["next_monitoring_date", "profile_last_updated_on"], None),
            "generated_at": now,
            "status": safe_string(classification or pick(item, ["beach_type", "type"], "location")),
            "description": safe_string(pick(item, ["description", "beach_description", "annual_water_quality_assessment"], "")),
            "url": safe_string(pick(item, ["beach_profile_url", "url", "profile_url"], "https://www.beaches.ie/")),
            "parameters": parameters,
            "raw": item,
        })

    return records, location_index


def build_measurement_records(
    measurements: list[Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
    location_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for idx, item in enumerate(measurements):
        if not isinstance(item, dict):
            continue

        loc_id = safe_string(pick(item, ["location_id", "LocationId", "beach_id"], ""))
        loc = location_index.get(loc_id, {})
        name = safe_string(
            pick(item, ["location_name", "name", "beach_name", "BathingWaterName"], loc.get("name") or f"Bathing sample {idx + 1}")
        )

        lat, lon = coordinate_from_record(item, name)

        if lat is None or lon is None:
            lat, lon = loc.get("lat"), loc.get("lon")

        parameters: list[dict[str, Any]] = []

        e_coli = pick(item, ["e_coli", "ecoli", "e_coli_result", "ecoli_result", "EColi"], None)
        entero = pick(
            item,
            [
                "intestinal_enterococci",
                "enterococci",
                "intestinal_enterococci_result",
                "enterococci_result",
                "IntestinalEnterococci",
            ],
            None,
        )

        if as_float(e_coli) is not None:
            parameters.append({
                "key": "e_coli",
                "label": "E. coli",
                "value": as_float(e_coli),
                "unit": "cfu/100 mL",
                "basis": "EPA bathing-water sample",
            })

        if as_float(entero) is not None:
            parameters.append({
                "key": "intestinal_enterococci",
                "label": "Intestinal enterococci",
                "value": as_float(entero),
                "unit": "cfu/100 mL",
                "basis": "EPA bathing-water sample",
            })

        if not parameters:
            parameters = numeric_parameters(item)

        records.append({
            "id": f"bw-measurement:{pick(item, ['monitoring_result_id', 'id'], idx)}",
            "source": MEASUREMENT_SOURCE_ID,
            "source_label": source_defs[MEASUREMENT_SOURCE_ID]["name"],
            "type": "bathing_measurement",
            "freshness": "latest",
            "name": name,
            "lat": lat,
            "lon": lon,
            "observed_at": pick(item, ["sample_date", "monitoring_date", "date", "sample_taken_on"], None),
            "generated_at": now,
            "status": safe_string(pick(item, ["sample_water_quality_status", "status", "water_quality_status"], "sample")),
            "description": "EPA bathing-water sample. Single-sample thresholds are shown as interpretive context only.",
            "url": "https://www.beaches.ie/",
            "parameters": parameters,
            "raw": item,
        })

    return records


def build_alert_records(
    alerts: list[Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
    location_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for idx, item in enumerate(alerts):
        if not isinstance(item, dict):
            continue

        loc_id = safe_string(pick(item, ["location_id", "LocationId", "beach_id"], ""))
        loc = location_index.get(loc_id, {})
        name = safe_string(
            pick(item, ["location_name", "name", "beach_name", "BathingWaterName"], loc.get("name") or f"Bathing alert {idx + 1}")
        )

        lat, lon = coordinate_from_record(item, name)

        if lat is None or lon is None:
            lat, lon = loc.get("lat"), loc.get("lon")

        records.append({
            "id": f"bw-alert:{pick(item, ['incident_id', 'id'], idx)}",
            "source": ALERT_SOURCE_ID,
            "source_label": source_defs[ALERT_SOURCE_ID]["name"],
            "type": "bathing_alert",
            "freshness": "current",
            "name": name,
            "lat": lat,
            "lon": lon,
            "observed_at": pick(item, ["start_date", "date", "created_on"], None),
            "generated_at": now,
            "status": safe_string(pick(item, ["bathing_restriction_type", "restriction_type", "status"], "alert")),
            "description": safe_string(pick(item, ["description", "incident_description", "reason"], "Current bathing-water alert or restriction.")),
            "url": safe_string(pick(item, ["notice_url", "url"], "https://www.beaches.ie/")),
            "parameters": [],
            "raw": item,
        })

    return records


def harvest_bathing(
    now: str,
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 8,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []

    locations, location_error, location_fetches = fetch_paged_json(
        f"{EPA_BW}/locations",
        timeout=timeout,
    )
    location_records, location_index = build_location_records(
        locations,
        now=now,
        source_defs=source_defs,
    )
    records.extend(location_records)
    sources.append(source_status(
        source_defs,
        LOCATION_SOURCE_ID,
        records=len(locations),
        now=now,
        error=location_error,
        fetches=location_fetches,
    ))

    measurements, measurement_error, measurement_fetches = fetch_paged_json(
        f"{EPA_BW}/measurements",
        per_page=1000,
        max_pages=4,
        timeout=timeout,
    )
    records.extend(build_measurement_records(
        measurements,
        now=now,
        source_defs=source_defs,
        location_index=location_index,
    ))
    sources.append(source_status(
        source_defs,
        MEASUREMENT_SOURCE_ID,
        records=len(measurements),
        now=now,
        error=measurement_error,
        fetches=measurement_fetches,
    ))

    alerts, alert_error, alert_fetches = fetch_paged_json(
        f"{EPA_BW}/alerts",
        per_page=1000,
        max_pages=2,
        timeout=timeout,
    )
    records.extend(build_alert_records(
        alerts,
        now=now,
        source_defs=source_defs,
        location_index=location_index,
    ))
    sources.append(source_status(
        source_defs,
        ALERT_SOURCE_ID,
        records=len(alerts),
        now=now,
        error=alert_error,
        fetches=alert_fetches,
    ))

    return records, sources
