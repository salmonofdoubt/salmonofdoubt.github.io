from __future__ import annotations

import urllib.parse
from typing import Any

from wq_pipeline.core.http import FetchError, fetch_json
from wq_pipeline.core.records import as_float, normalise_key, pick, safe_string
from wq_pipeline.core.status import make_source_status


SOURCE_ID = "opw_waterlevel"
OPW_LATEST = "https://waterlevel.ie/geojson/latest/"


def numeric_parameters(props: dict[str, Any]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    skip = {
        "lat",
        "latitude",
        "lon",
        "lng",
        "longitude",
        "x",
        "y",
        "station_ref",
        "station",
        "id",
    }

    for key, value in props.items():
        number = as_float(value)

        if number is None:
            continue

        if normalise_key(key) in skip:
            continue

        label = str(key).replace("_", " ").strip()
        unit = ""

        low = label.lower()

        if "temp" in low:
            unit = "°C"
        elif "level" in low or "waterlevel" in low or "water level" in low:
            unit = "m"
        elif "flow" in low or "discharge" in low:
            unit = "m³/s"
        elif "battery" in low:
            unit = "V"

        params.append({
            "key": normalise_key(key),
            "label": label,
            "value": number,
            "unit": unit,
            "basis": "native source field",
        })

    return params[:8]


def build_opw_records(
    features: list[Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    source_label = source_defs[SOURCE_ID]["name"]

    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            continue

        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        props = feature.get("properties") or {}

        if not isinstance(props, dict):
            continue

        if not isinstance(coords, list) or len(coords) < 2:
            continue

        lon = as_float(coords[0])
        lat = as_float(coords[1])

        if lat is None or lon is None:
            continue

        name = pick(
            props,
            ["station_name", "name", "StationName", "station", "label"],
            f"OPW station {index + 1}",
        )
        station_ref = pick(
            props,
            ["station_ref", "station_ref_no", "station", "station_no", "ref"],
            "",
        )
        sensor_ref = pick(props, ["sensor_ref", "sensor", "sensor_no"], "")
        observed = pick(props, ["datetime", "time", "timestamp", "date", "observed_at"], None)

        records.append({
            "id": f"opw:{station_ref or index}:{sensor_ref or 'latest'}",
            "source": SOURCE_ID,
            "source_label": source_label,
            "type": "water_level",
            "freshness": "live",
            "name": str(name),
            "lat": lat,
            "lon": lon,
            "observed_at": observed,
            "generated_at": now,
            "status": safe_string(pick(props, ["status", "trend", "quality"], "latest")),
            "description": "Latest OPW hydrometric reading. Parameter labels are normalised from source fields.",
            "url": "https://waterlevel.ie/",
            "parameters": numeric_parameters(props),
            "raw": props,
        })

    return records


def harvest_opw(
    now: str,
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 8,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    url = OPW_LATEST + "?" + urllib.parse.quote(now)

    try:
        result = fetch_json(url, timeout=timeout)
        payload = result.payload
        features = payload.get("features", []) if isinstance(payload, dict) else []
    except FetchError as exc:
        return [], make_source_status(
            source_defs,
            SOURCE_ID,
            status="failed",
            records=0,
            fetched_at_utc=now,
            error=str(exc),
            elapsed_ms=exc.elapsed_ms,
        )
    except Exception as exc:
        return [], make_source_status(
            source_defs,
            SOURCE_ID,
            status="failed",
            records=0,
            fetched_at_utc=now,
            error=str(exc),
        )

    records = build_opw_records(features, now=now, source_defs=source_defs)

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status="ok",
        records=len(records),
        fetched_at_utc=now,
        elapsed_ms=result.elapsed_ms,
    )
