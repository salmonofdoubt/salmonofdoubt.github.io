from __future__ import annotations

from typing import Any, Callable
import datetime as dt
import urllib.parse

from wq_pipeline.core.http import FetchError, FetchResult, fetch_json
from wq_pipeline.core.records import as_float, normalise_key, safe_string
from wq_pipeline.core.status import make_source_status


SOURCE_ID = "marine_institute_weather_buoys"
ERDDAP_IWB_JSON = "https://erddap.marine.ie/erddap/tabledap/IWBNetwork.json"

IWB_COLUMNS = (
    "station_id",
    "CallSign",
    "longitude",
    "latitude",
    "time",
    "AtmosphericPressure",
    "WindDirection",
    "WindSpeed",
    "Gust",
    "WaveHeight",
    "WavePeriod",
    "MeanWaveDirection",
    "Hmax",
    "AirTemperature",
    "SeaTemperature",
    "salinity",
    "RelativeHumidity",
    "QC_Flag",
)

PARAMETER_META = {
    "AtmosphericPressure": ("atmospheric_pressure", "Atmospheric pressure", "mbar"),
    "WindDirection": ("wind_direction", "Wind direction", "degrees true"),
    "WindSpeed": ("wind_speed", "Wind speed", "knots"),
    "Gust": ("wind_gust", "Wind gust", "knots"),
    "WaveHeight": ("significant_wave_height", "Significant wave height", "m"),
    "WavePeriod": ("wave_period", "Wave period", "s"),
    "MeanWaveDirection": ("mean_wave_direction", "Mean wave direction", "degrees true"),
    "Hmax": ("maximum_wave_height", "Maximum wave height", "m"),
    "AirTemperature": ("air_temperature", "Air temperature", "°C"),
    "SeaTemperature": ("sea_temperature", "Sea surface temperature", "°C"),
    "salinity": ("salinity", "Salinity", ""),
    "RelativeHumidity": ("relative_humidity", "Relative humidity", "%"),
}

MISSING_NUMERIC_VALUES = {-999.0, 99999.0}


def erddap_start_iso(now: str | None, days_back: int) -> str:
    try:
        base = dt.datetime.fromisoformat(str(now).replace("Z", "+00:00"))
    except ValueError:
        base = dt.datetime.now(dt.timezone.utc)

    if base.tzinfo is None:
        base = base.replace(tzinfo=dt.timezone.utc)

    start = base.astimezone(dt.timezone.utc) - dt.timedelta(days=int(days_back))
    return start.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def erddap_iwb_url(days_back: int = 7, now: str | None = None) -> str:
    variable_list = ",".join(IWB_COLUMNS)
    start_iso = urllib.parse.quote(erddap_start_iso(now, days_back), safe="TZ:-")

    return f"{ERDDAP_IWB_JSON}?{variable_list}&time%3E={start_iso}"


def erddap_rows(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    table = payload.get("table")

    if not isinstance(table, dict):
        return []

    columns = table.get("columnNames") or []
    rows = table.get("rows") or []

    if not isinstance(columns, list) or not isinstance(rows, list):
        return []

    records: list[dict[str, Any]] = []

    for row in rows:
        if not isinstance(row, list):
            continue

        values = {str(column): row[index] if index < len(row) else None for index, column in enumerate(columns)}
        records.append(values)

    return records


def clean_number(value: Any) -> float | None:
    number = as_float(value)

    if number is None:
        return None

    if number in MISSING_NUMERIC_VALUES:
        return None

    return number


def parameter_list(row: dict[str, Any]) -> list[dict[str, Any]]:
    parameters: list[dict[str, Any]] = []

    for key, (param_key, label, unit) in PARAMETER_META.items():
        value = clean_number(row.get(key))

        if value is None:
            continue

        parameters.append({
            "key": param_key,
            "label": label,
            "value": value,
            "unit": unit,
            "basis": "Marine Institute ERDDAP IWBNetwork",
        })

    return parameters[:12]


def latest_by_station(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}

    for row in rows:
        station_id = safe_string(row.get("station_id"), "")
        observed_at = safe_string(row.get("time"), "")

        if not station_id or not observed_at:
            continue

        current = latest.get(station_id)

        if current is None or observed_at > safe_string(current.get("time"), ""):
            latest[station_id] = row

    return sorted(latest.values(), key=lambda item: safe_string(item.get("station_id"), ""))


def build_marine_weather_records(
    rows: list[dict[str, Any]],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    source_label = source_defs[SOURCE_ID]["name"]

    for row in latest_by_station(rows):
        station_id = safe_string(row.get("station_id"), "unknown")
        call_sign = safe_string(row.get("CallSign"), "")
        lat = clean_number(row.get("latitude"))
        lon = clean_number(row.get("longitude"))
        observed_at = safe_string(row.get("time"), None)
        parameters = parameter_list(row)

        if lat is None or lon is None:
            continue

        records.append({
            "id": f"marine-iwb:{station_id}",
            "source": SOURCE_ID,
            "source_label": source_label,
            "type": "marine_observation",
            "freshness": "near_live",
            "name": f"Irish Weather Buoy {station_id}",
            "lat": lat,
            "lon": lon,
            "observed_at": observed_at,
            "generated_at": now,
            "status": safe_string(row.get("QC_Flag"), "near-live"),
            "description": "Marine Institute ERDDAP Irish Weather Buoy Network near-real-time met-ocean observation. This is not nutrient chemistry.",
            "url": "https://erddap.marine.ie/erddap/tabledap/IWBNetwork.html",
            "focus_area_ids": [],
            "parameters": parameters,
            "raw": {
                "station_id": station_id,
                "CallSign": call_sign,
                "time": observed_at,
            },
        })

    return records


def harvest_marine_weather_buoys(
    now: str,
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 12,
    days_back: int = 3,
    fetcher: Callable[..., FetchResult] = fetch_json,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    url = erddap_iwb_url(days_back=days_back, now=now)

    try:
        result = fetcher(url, timeout=timeout)
        rows = erddap_rows(result.payload)
        records = build_marine_weather_records(rows, now=now, source_defs=source_defs)
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

    status = "ok" if records else "empty"

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status=status,
        records=len(records),
        fetched_at_utc=now,
        elapsed_ms=result.elapsed_ms,
    )
