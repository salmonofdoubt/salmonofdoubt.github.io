from __future__ import annotations

import urllib.parse
from typing import Any, Callable

from wq_pipeline.core.geo import coordinate_from_record
from wq_pipeline.core.http import FetchError, FetchResult, extract_items, fetch_json
from wq_pipeline.core.records import pick, safe_string
from wq_pipeline.core.status import make_source_status


SOURCE_ID = "epa_official_wq"

WFD_SUBCATCHMENT = "https://wfdapi.edenireland.ie/api/catchment/{catchment}/subcatchment/{subcatchment}"
WFD_WATERBODY = "https://wfdapi.edenireland.ie/api/waterbody/{code}"
WFD_ITERATIONS = "https://wfdapi.edenireland.ie/api/monitoringprogramme/iterations/{code}"
WFD_STATION_DETAILS = "https://wfdapi.edenireland.ie/api/monitoringprogramme/{code}/stationdetails/{iteration}"

DEFAULT_ITERATION = "IEMP2019-2021"

FOCUS_SUBCATCHMENTS = [
    {
        "catchment": "08",
        "subcatchment": "08_3",
        "label": "Broadmeadow_SC_010",
        "focus_area_ids": ["baldoyle_howth_malahide"],
    },
    {
        "catchment": "09",
        "subcatchment": "09_17",
        "label": "Mayne_SC_010",
        "focus_area_ids": ["baldoyle_howth_malahide"],
    },
    {
        "catchment": "08",
        "subcatchment": "08_1",
        "label": "Delvin_SC_010",
        "focus_area_ids": ["nanny_delvin"],
    },
    {
        "catchment": "08",
        "subcatchment": "08_4",
        "label": "Nanny[Meath]_SC_010",
        "focus_area_ids": ["nanny_delvin"],
    },
    {
        "catchment": "08",
        "subcatchment": "08_5",
        "label": "Nanny[Meath]_SC_020",
        "focus_area_ids": ["nanny_delvin"],
    },
]


def elapsed_ms(fetches: list[FetchResult]) -> int | None:
    return sum(fetch.elapsed_ms for fetch in fetches) if fetches else None


def first_value(item: dict[str, Any], keys: list[str], fallback: Any = None) -> Any:
    return pick(item, keys, fallback)


def waterbody_code(item: dict[str, Any], fallback: str = "") -> str:
    return safe_string(first_value(item, ["Code", "code", "WaterbodyCode", "waterbody_code"], fallback), fallback).strip()


def waterbody_name(item: dict[str, Any], fallback: str) -> str:
    return safe_string(first_value(item, ["Name", "name", "WaterbodyName", "waterbody_name"], fallback), fallback)


def station_code(item: dict[str, Any], fallback: str = "") -> str:
    return safe_string(first_value(
        item,
        ["StationCode", "stationCode", "station_code", "Code", "code", "StationID", "station_id"],
        fallback,
    ), fallback).strip()


def station_name(item: dict[str, Any], fallback: str) -> str:
    return safe_string(first_value(
        item,
        ["StationName", "stationName", "station_name", "Name", "name"],
        fallback,
    ), fallback)


def quality_element(item: dict[str, Any]) -> str:
    value = first_value(
        item,
        ["QualityElement", "qualityElement", "quality_element", "Element", "element", "Parameter", "parameter"],
        "",
    )

    if isinstance(value, list):
        return ", ".join(safe_string(part, "") for part in value if safe_string(part, ""))

    return safe_string(value, "")


def parameter(label: str, value: Any, *, key: str, basis: str, unit: str = "") -> dict[str, Any] | None:
    if value is None or value == "":
        return None

    return {
        "key": key,
        "label": label,
        "value": value,
        "unit": unit,
        "basis": basis,
    }


def compact(items: list[dict[str, Any] | None]) -> list[dict[str, Any]]:
    return [item for item in items if item is not None]


def fetch_payload(
    url: str,
    *,
    fetcher: Callable[..., FetchResult],
    timeout: int,
    fetches: list[FetchResult],
    errors: list[str],
    label: str,
) -> Any:
    try:
        result = fetcher(url, timeout=timeout)
        fetches.append(result)
        return result.payload
    except FetchError as exc:
        errors.append(f"{label}: {exc}")
    except Exception as exc:
        errors.append(f"{label}: {exc}")

    return None


def iteration_value(payload: Any) -> str:
    for item in extract_items(payload):
        if isinstance(item, str) and item.strip():
            return item.strip()

        if isinstance(item, dict):
            value = safe_string(first_value(
                item,
                ["Iteration", "iteration", "Code", "code", "Name", "name", "Id", "id"],
                "",
            ), "")
            if value:
                return value

    if isinstance(payload, str) and payload.strip():
        return payload.strip()

    return DEFAULT_ITERATION


def subcatchment_waterbodies(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict) and isinstance(payload.get("Waterbodies"), list):
        return [item for item in payload["Waterbodies"] if isinstance(item, dict)]

    return [item for item in extract_items(payload) if isinstance(item, dict)]


def build_waterbody_record(
    item: dict[str, Any],
    *,
    focus: dict[str, Any],
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    code = waterbody_code(item, f"{focus['subcatchment']}:{waterbody_name(item, 'unknown')}")
    name = waterbody_name(item, code)
    lat, lon = coordinate_from_record(item, name)
    status = safe_string(first_value(item, ["Status", "status", "Risk", "risk"], "official WQ waterbody"), "official WQ waterbody")
    wtype = safe_string(first_value(item, ["Type", "type"], ""), "")

    return {
        "id": f"official-wq:waterbody:{code}",
        "source": SOURCE_ID,
        "source_label": source_defs[SOURCE_ID]["name"],
        "type": "official_wq_waterbody",
        "freshness": "official_historic",
        "name": f"Official WQ waterbody — {name}",
        "lat": lat,
        "lon": lon,
        "observed_at": "WFD Cycle 3",
        "generated_at": now,
        "status": status,
        "description": "Official EPA WFD waterbody status record from the focus subcatchment. This is official assessed WQ status, not a live chemistry sensor.",
        "url": WFD_WATERBODY.format(code=urllib.parse.quote(code)),
        "focus_area_ids": list(focus.get("focus_area_ids", [])),
        "parameters": compact([
            parameter("Waterbody code", code, key="waterbody_code", basis="EPA WFD subcatchment Waterbodies"),
            parameter("Waterbody name", name, key="waterbody_name", basis="EPA WFD subcatchment Waterbodies"),
            parameter("Waterbody type", wtype, key="waterbody_type", basis="EPA WFD subcatchment Waterbodies"),
            parameter("Official status", status, key="official_status", basis="EPA WFD subcatchment Waterbodies"),
            parameter("Focus subcatchment", focus.get("label"), key="focus_subcatchment", basis="Configured WQ focus subcatchment"),
            parameter("Easting", first_value(item, ["Easting", "easting"], None), key="easting", basis="EPA WFD subcatchment Waterbodies", unit="m"),
            parameter("Northing", first_value(item, ["Northing", "northing"], None), key="northing", basis="EPA WFD subcatchment Waterbodies", unit="m"),
            parameter("Geometry extent", first_value(item, ["GeometryExtent", "geometryExtent"], None), key="geometry_extent", basis="EPA WFD subcatchment Waterbodies"),
            parameter("Chemistry values route", "Use Catchments.ie chemistry downloads where available for this waterbody/subcatchment", key="chemistry_values_route", basis="EPA/Catchments.ie WFD workflow"),
        ]),
        "raw": item,
    }


def build_station_record(
    item: dict[str, Any],
    *,
    waterbody: dict[str, Any],
    focus: dict[str, Any],
    iteration: str,
    now: str,
    source_defs: dict[str, dict[str, Any]],
    fallback_index: int,
) -> dict[str, Any]:
    waterbody_id = waterbody_code(waterbody)
    code = station_code(item, f"{waterbody_id}:{fallback_index}")
    name = station_name(item, code)
    lat, lon = coordinate_from_record(item, name)
    element = quality_element(item)

    return {
        "id": f"official-wq:station:{waterbody_id}:{code}",
        "source": SOURCE_ID,
        "source_label": source_defs[SOURCE_ID]["name"],
        "type": "official_wq_station",
        "freshness": "official_historic",
        "name": f"Official WQ station — {name}",
        "lat": lat,
        "lon": lon,
        "observed_at": iteration,
        "generated_at": now,
        "status": element or "official monitoring station",
        "description": "Official EPA WFD monitoring-programme station detail. Individual chemistry values may require Catchments.ie chemistry downloads.",
        "url": WFD_STATION_DETAILS.format(
            code=urllib.parse.quote(waterbody_id),
            iteration=urllib.parse.quote(iteration),
        ),
        "focus_area_ids": list(focus.get("focus_area_ids", [])),
        "parameters": compact([
            parameter("Monitoring station code", code, key="station_code", basis="EPA WFD Monitoring Programme"),
            parameter("Monitoring station name", name, key="station_name", basis="EPA WFD Monitoring Programme"),
            parameter("Waterbody code", waterbody_id, key="waterbody_code", basis="EPA WFD Monitoring Programme"),
            parameter("Waterbody name", waterbody_name(waterbody, waterbody_id), key="waterbody_name", basis="EPA WFD Monitoring Programme"),
            parameter("Programme iteration", iteration, key="programme_iteration", basis="EPA WFD Monitoring Programme"),
            parameter("Quality element / parameter group", element, key="quality_element", basis="EPA WFD Monitoring Programme"),
            parameter("Focus subcatchment", focus.get("label"), key="focus_subcatchment", basis="Configured WQ focus subcatchment"),
        ]),
        "raw": item,
    }


def harvest_official_wq(
    now: str,
    keywords: list[str],
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 8,
    max_stations: int = 160,
    fetcher: Callable[..., FetchResult] = fetch_json,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records: list[dict[str, Any]] = []
    errors: list[str] = []
    fetches: list[FetchResult] = []
    seen: set[str] = set()
    station_count = 0

    for focus in FOCUS_SUBCATCHMENTS:
        payload = fetch_payload(
            WFD_SUBCATCHMENT.format(
                catchment=urllib.parse.quote(focus["catchment"]),
                subcatchment=urllib.parse.quote(focus["subcatchment"]),
            ),
            fetcher=fetcher,
            timeout=timeout,
            fetches=fetches,
            errors=errors,
            label=f"subcatchment {focus['subcatchment']}",
        )

        if payload is None:
            continue

        for waterbody in subcatchment_waterbodies(payload):
            code = waterbody_code(waterbody)

            if not code:
                continue

            waterbody_record = build_waterbody_record(
                waterbody,
                focus=focus,
                now=now,
                source_defs=source_defs,
            )

            if waterbody_record["id"] not in seen:
                records.append(waterbody_record)
                seen.add(waterbody_record["id"])

            if station_count >= max_stations:
                continue

            iteration_payload = fetch_payload(
                WFD_ITERATIONS.format(code=urllib.parse.quote(code)),
                fetcher=fetcher,
                timeout=timeout,
                fetches=fetches,
                errors=errors,
                label=f"iterations {code}",
            )
            iteration = iteration_value(iteration_payload) if iteration_payload is not None else DEFAULT_ITERATION

            station_payload = fetch_payload(
                WFD_STATION_DETAILS.format(
                    code=urllib.parse.quote(code),
                    iteration=urllib.parse.quote(iteration),
                ),
                fetcher=fetcher,
                timeout=timeout,
                fetches=fetches,
                errors=errors,
                label=f"stationdetails {code}",
            )

            if station_payload is None:
                continue

            for index, station in enumerate(extract_items(station_payload)):
                if station_count >= max_stations:
                    break

                if not isinstance(station, dict):
                    continue

                station_record = build_station_record(
                    station,
                    waterbody=waterbody,
                    focus=focus,
                    iteration=iteration,
                    now=now,
                    source_defs=source_defs,
                    fallback_index=index,
                )

                if station_record["id"] in seen:
                    continue

                records.append(station_record)
                seen.add(station_record["id"])
                station_count += 1

    status = "ok" if records else ("failed" if errors else "empty")

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status=status,
        records=len(records),
        fetched_at_utc=now,
        error="; ".join(errors[:4]) if not records and errors else None,
        elapsed_ms=elapsed_ms(fetches),
    )
