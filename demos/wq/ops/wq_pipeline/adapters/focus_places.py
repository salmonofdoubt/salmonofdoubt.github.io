from __future__ import annotations

from typing import Any

from wq_pipeline.core.status import make_source_status


SOURCE_ID = "local_focus_places"

FOCUS_PLACE_RECORDS = [
    {
        "id": "place:baldoyle",
        "name": "Baldoyle",
        "lat": 53.3999,
        "lon": -6.1250,
        "focus_area_ids": ["baldoyle_howth_malahide"],
        "description": "Local focus-place anchor for map navigation. Not a monitoring measurement.",
    },
    {
        "id": "place:howth",
        "name": "Howth",
        "lat": 53.3866,
        "lon": -6.0654,
        "focus_area_ids": ["baldoyle_howth_malahide"],
        "description": "Local focus-place anchor for map navigation. Not a monitoring measurement.",
    },
    {
        "id": "place:portmarnock",
        "name": "Portmarnock",
        "lat": 53.4231,
        "lon": -6.1375,
        "focus_area_ids": ["baldoyle_howth_malahide"],
        "description": "Local focus-place anchor for map navigation. Not a monitoring measurement.",
    },
    {
        "id": "place:malahide",
        "name": "Malahide",
        "lat": 53.4508,
        "lon": -6.1544,
        "focus_area_ids": ["baldoyle_howth_malahide"],
        "description": "Local focus-place anchor for map navigation. Not a monitoring measurement.",
    },
    {
        "id": "place:nanny",
        "name": "River Nanny focus",
        "lat": 53.6000,
        "lon": -6.3000,
        "focus_area_ids": ["nanny_delvin"],
        "description": "Local focus-place anchor for the Nanny catchment focus. Not a monitoring measurement.",
    },
    {
        "id": "place:delvin",
        "name": "River Delvin focus",
        "lat": 53.6200,
        "lon": -6.2300,
        "focus_area_ids": ["nanny_delvin"],
        "description": "Local focus-place anchor for the Delvin catchment focus. Not a monitoring measurement.",
    },
]


def build_focus_place_records(
    now: str,
    *,
    source_defs: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for place in FOCUS_PLACE_RECORDS:
        records.append({
            "id": place["id"],
            "source": SOURCE_ID,
            "source_label": source_defs[SOURCE_ID]["name"],
            "type": "focus_place",
            "freshness": "context",
            "name": place["name"],
            "lat": place["lat"],
            "lon": place["lon"],
            "observed_at": None,
            "generated_at": now,
            "status": "context anchor",
            "description": place["description"],
            "focus_area_ids": place["focus_area_ids"],
            "parameters": [
                {
                    "key": "marker_role",
                    "label": "Marker role",
                    "value": "Navigation/context anchor",
                    "unit": "",
                    "basis": "Site-defined focus-place marker",
                },
                {
                    "key": "measurement_status",
                    "label": "Measurement status",
                    "value": "Not a monitoring measurement",
                    "unit": "",
                    "basis": "Shown to make the named focus area legible on the map",
                },
            ],
            "raw": place,
        })

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status="ok",
        records=len(records),
        fetched_at_utc=now,
        elapsed_ms=0,
    )
