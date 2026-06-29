from __future__ import annotations

from typing import Any

from wq_pipeline.core.status import make_source_status as core_make_source_status


def planned_context_records(now: str, *, source_defs: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    def make_source_status(source_id: str, status: str, records: int, fetched_at: str, error: str | None = None) -> dict[str, Any]:
        return core_make_source_status(
            source_defs,
            source_id,
            status=status,
            records=records,
            fetched_at_utc=fetched_at,
            error=error,
        )
    records = [
        {
            "id": "groundwater:geoportal-planned",
            "source": "epa_geoportal_context",
            "source_label": source_defs["epa_geoportal_context"]["name"],
            "type": "groundwater_context",
            "freshness": "historical",
            "name": "Groundwater quality and monitoring stations",
            "lat": 53.58,
            "lon": -6.25,
            "observed_at": None,
            "generated_at": now,
            "status": "planned join",
            "description": "EPA Geoportal lists groundwater monitoring stations and groundwater quality Excel data. This will be joined as a historical/context layer.",
            "url": "https://gis.epa.ie/GetData/Download",
            "parameters": [],
            "raw": {}
        },
        {
            "id": "marine:erddap-planned",
            "source": "marine_institute_context",
            "source_label": source_defs["marine_institute_context"]["name"],
            "type": "marine_context",
            "freshness": "planned",
            "name": "Marine shore indicators",
            "lat": 53.39,
            "lon": -6.08,
            "observed_at": None,
            "generated_at": now,
            "status": "planned join",
            "description": "Marine Institute ERDDAP datasets are planned for tide, sea temperature and coastal water context.",
            "url": "https://erddap.marine.ie/erddap/index.html",
            "parameters": [],
            "raw": {}
        }
    ]

    sources = [
        make_source_status("epa_geoportal_context", "planned", 1, now),
        make_source_status("marine_institute_context", "planned", 1, now)
    ]

    return records, sources
