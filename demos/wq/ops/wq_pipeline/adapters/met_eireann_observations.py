from __future__ import annotations

import datetime as dt
from typing import Any, Callable

from wq_pipeline.core.http import FetchError, FetchResult, fetch_json
from wq_pipeline.core.records import as_float, normalise_key, safe_string
from wq_pipeline.core.status import make_source_status


SOURCE_ID = "met_eireann_observations"
OBSERVATION_URL = "https://prodapi.metweb.ie/observations/{station}/today"

# Station subset chosen to cover current WQ focus geography without making the
# scheduled refresh slow or brittle. Slugs are the Met Éireann public observation slugs.
STATIONS = [
    {"slug": "dublin-airport", "name": "Dublin Airport", "lat": 53.428, "lon": -6.241},
    {"slug": "phoenix-park", "name": "Phoenix Park", "lat": 53.363, "lon": -6.333},
    {"slug": "dunsany", "name": "Dunsany", "lat": 53.515, "lon": -6.660},
    {"slug": "markree", "name": "Markree", "lat": 54.174, "lon": -8.458},
    {"slug": "finner", "name": "Finner", "lat": 54.493, "lon": -8.243},
    {"slug": "mace-head", "name": "Mace Head", "lat": 53.326, "lon": -9.904},
    {"slug": "johnstown-castle", "name": "Johnstown Castle", "lat": 52.298, "lon": -6.497},
    {"slug": "gurteen", "name": "Gurteen", "lat": 53.053, "lon": -8.008},
]


def observation_url(station_slug: str) -> str:
    return OBSERVATION_URL.format(station=station_slug)


def parse_observed_at(row: dict[str, Any], fallback_now: str) -> str:
    date_value = safe_string(row.get("date"), "")
    report_time = safe_string(row.get("reportTime") or row.get("report_time") or row.get("time"), "")

    if date_value and report_time:
        for date_format in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                parsed_date = dt.datetime.strptime(date_value, date_format).date()
                parsed_time = dt.datetime.strptime(report_time[:5], "%H:%M").time()
                return dt.datetime.combine(parsed_date, parsed_time, tzinfo=dt.timezone.utc).isoformat().replace("+00:00", "Z")
            except ValueError:
                continue

    timestamp = safe_string(row.get("timestamp") or row.get("observed_at"), "")

    if timestamp:
        return timestamp

    return fallback_now


def latest_row(payload: Any) -> dict[str, Any] | None:
    if isinstance(payload, dict):
        observations = payload.get("observations") or payload.get("data") or payload.get("results")
    else:
        observations = payload

    if not isinstance(observations, list):
        return None

    candidates = [row for row in observations if isinstance(row, dict)]

    if not candidates:
        return None

    return candidates[-1]


def numeric_parameter(row: dict[str, Any], source_key: str, key: str, label: str, unit: str) -> dict[str, Any] | None:
    value = as_float(row.get(source_key))

    if value is None:
        return None

    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": unit,
        "basis": "Met Éireann current station observation",
    }


def rainfall_status(rainfall_mm: float | None) -> str:
    if rainfall_mm is None:
        return "observation"

    if rainfall_mm >= 5:
        return "heavy rainfall trigger"

    if rainfall_mm >= 2:
        return "rainfall trigger"

    if rainfall_mm >= 0.2:
        return "light rainfall"

    return "dry"


def build_observation_record(
    station: dict[str, Any],
    row: dict[str, Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    rainfall = as_float(row.get("rainfall"))
    observed_at = parse_observed_at(row, now)

    parameters = [
        numeric_parameter(row, "rainfall", "rainfall", "Rainfall", "mm"),
        numeric_parameter(row, "temperature", "air_temperature", "Air temperature", "°C"),
        numeric_parameter(row, "windSpeed", "wind_speed", "Wind speed", ""),
        numeric_parameter(row, "windGust", "wind_gust", "Wind gust", ""),
        numeric_parameter(row, "humidity", "relative_humidity", "Relative humidity", "%"),
        numeric_parameter(row, "pressure", "atmospheric_pressure", "Atmospheric pressure", "hPa"),
    ]
    parameters = [parameter for parameter in parameters if parameter is not None]

    text = safe_string(row.get("weatherDescription") or row.get("text"), "")

    if text and not any(parameter["key"] == "weather_description" for parameter in parameters):
        parameters.append({
            "key": "weather_description",
            "label": "Weather description",
            "value": text,
            "unit": "",
            "basis": "Met Éireann current station observation",
        })

    slug = safe_string(station.get("slug"), "station")
    name = safe_string(station.get("name"), slug)

    return {
        "id": f"met-eireann:{slug}",
        "source": SOURCE_ID,
        "source_label": source_defs[SOURCE_ID]["name"],
        "type": "rainfall_observation",
        "freshness": "near_live",
        "name": f"Rainfall observation — {name}",
        "lat": as_float(station.get("lat")),
        "lon": as_float(station.get("lon")),
        "observed_at": observed_at,
        "generated_at": now,
        "status": rainfall_status(rainfall),
        "description": "Current Met Éireann station observation. Rainfall is treated as a catchment event driver/proxy, not as water-quality chemistry.",
        "url": "https://www.met.ie/latest-reports/observations",
        "focus_area_ids": [],
        "parameters": parameters,
        "raw": {
            "station": slug,
            "reportTime": row.get("reportTime"),
            "date": row.get("date"),
            "rainfall": row.get("rainfall"),
            "weatherDescription": row.get("weatherDescription"),
        },
    }


def build_met_eireann_records(
    station_payloads: list[tuple[dict[str, Any], Any]],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for station, payload in station_payloads:
        row = latest_row(payload)

        if not row:
            continue

        record = build_observation_record(station, row, now=now, source_defs=source_defs)

        if record:
            records.append(record)

    return records


def harvest_met_eireann_observations(
    now: str,
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 8,
    fetcher: Callable[..., FetchResult] = fetch_json,
    stations: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    station_list = stations or STATIONS
    station_payloads: list[tuple[dict[str, Any], Any]] = []
    errors: list[str] = []
    elapsed_ms = 0

    for station in station_list:
        slug = safe_string(station.get("slug"), "")

        if not slug:
            continue

        url = observation_url(slug)

        try:
            result = fetcher(url, timeout=timeout)
            station_payloads.append((station, result.payload))
            elapsed_ms += int(result.elapsed_ms or 0)
        except FetchError as exc:
            errors.append(f"{slug}: {exc}")
            elapsed_ms += int(exc.elapsed_ms or 0)
        except Exception as exc:
            errors.append(f"{slug}: {exc}")

    records = build_met_eireann_records(station_payloads, now=now, source_defs=source_defs)

    if records and errors:
        status = "partial"
    elif records:
        status = "ok"
    elif errors:
        status = "failed"
    else:
        status = "empty"

    error_text = "; ".join(errors[:4]) if errors and not records else None

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status=status,
        records=len(records),
        fetched_at_utc=now,
        error=error_text,
        elapsed_ms=elapsed_ms,
    )
