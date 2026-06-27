#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

OPW_LATEST = "https://waterlevel.ie/geojson/latest/"
EPA_BW = "https://data.epa.ie/bw/api/v1"
WFD_SEARCH = "https://wfdapi.edenireland.ie/api/search"

KNOWN_LOCAL_COORDS = {
    "baldoyle": (53.397, -6.136),
    "baldoyle bay": (53.407, -6.132),
    "howth": (53.388, -6.068),
    "sutton": (53.390, -6.110),
    "portmarnock": (53.424, -6.125),
    "velvet strand": (53.424, -6.125),
    "malahide": (53.450, -6.135),
    "malahide estuary": (53.455, -6.155),
    "nanny": (53.64, -6.23),
    "river nanny": (53.64, -6.23),
    "delvin": (53.61, -6.28),
    "river delvin": (53.61, -6.28),
    "balbriggan": (53.61, -6.18),
    "gormanston": (53.64, -6.24),
    "laytown": (53.68, -6.24),
    "julianstown": (53.67, -6.30),
    "duleek": (53.66, -6.42),
    "naul": (53.59, -6.29)
}

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


def fetch_json(url: str, timeout: int = 30) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "salmonofdoubt-wq/0.1.0 (+https://salmonofdoubt.github.io/demos/wq/)"
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read()
    return json.loads(data.decode("utf-8"))


def extract_items(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        for key in ("features", "data", "results", "items", "locations", "measurements", "alerts"):
            value = payload.get(key)
            if isinstance(value, list):
                return value

        if payload and all(isinstance(value, dict) for value in payload.values()):
            return list(payload.values())

    return []


def fetch_paged(base_url: str, per_page: int = 1000, max_pages: int = 8) -> tuple[list[Any], str | None]:
    all_items: list[Any] = []
    last_error = None
    seen_pages: set[str] = set()

    for page in range(1, max_pages + 1):
        separator = "&" if "?" in base_url else "?"
        url = f"{base_url}{separator}page={page}&per_page={per_page}"

        try:
            payload = fetch_json(url)
        except Exception as exc:
            last_error = str(exc)
            break

        page_items = extract_items(payload)
        fingerprint = json.dumps(page_items[:3], sort_keys=True, default=str)

        if fingerprint in seen_pages:
            break

        seen_pages.add(fingerprint)

        if not page_items:
            break

        all_items.extend(page_items)

        if len(page_items) < per_page:
            break

        time.sleep(0.2)

    return all_items, last_error


def as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None

    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None

    if not math.isfinite(number):
        return None

    return number


def safe_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def pick(record: dict[str, Any], names: list[str], default: Any = None) -> Any:
    lower = {str(key).lower(): value for key, value in record.items()}

    for name in names:
        if name in record:
            return record[name]
        value = lower.get(name.lower())
        if value is not None:
            return value

    return default


def coordinate_from_record(record: dict[str, Any], name_hint: str = "") -> tuple[float | None, float | None]:
    lat = as_float(pick(record, ["lat", "latitude", "y", "Latitude", "LATITUDE"]))
    lon = as_float(pick(record, ["lon", "lng", "long", "longitude", "x", "Longitude", "LONGITUDE"]))

    if lat is not None and lon is not None:
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon

    text = f"{name_hint} " + " ".join(str(value) for value in record.values() if isinstance(value, str))
    text = text.lower()

    for key, coords in KNOWN_LOCAL_COORDS.items():
        if key in text:
            return coords

    return None, None


def normalise_key(value: Any) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in str(value or "").strip().lower()).strip("_")


def text_contains_focus(value: Any, keywords: list[str]) -> bool:
    text = json.dumps(value, ensure_ascii=False, default=str).lower()
    return any(keyword.lower() in text for keyword in keywords)


def make_source_status(source_id: str, status: str, records: int, fetched_at: str, error: str | None = None) -> dict[str, Any]:
    base = dict(SOURCE_DEFS[source_id])
    base.update({
        "id": source_id,
        "status": status,
        "records": records,
        "fetched_at_utc": fetched_at
    })

    if error:
        base["error"] = error

    return base


def numeric_parameters(props: dict[str, Any]) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    skip = {"lat", "latitude", "lon", "lng", "longitude", "x", "y", "station_ref", "station", "id"}

    for key, value in props.items():
        n = as_float(value)
        if n is None:
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
            "value": n,
            "unit": unit,
            "basis": "native source field"
        })

    return params[:8]


def harvest_opw(now: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    url = OPW_LATEST + "?" + urllib.parse.quote(now)

    try:
        payload = fetch_json(url)
        features = payload.get("features", []) if isinstance(payload, dict) else []
    except Exception as exc:
        return [], make_source_status("opw_waterlevel", "failed", 0, now, str(exc))

    records: list[dict[str, Any]] = []

    for idx, feature in enumerate(features):
        if not isinstance(feature, dict):
            continue

        geometry = feature.get("geometry") or {}
        coords = geometry.get("coordinates") or []
        props = feature.get("properties") or {}

        if not isinstance(props, dict) or not isinstance(coords, list) or len(coords) < 2:
            continue

        lon = as_float(coords[0])
        lat = as_float(coords[1])

        if lat is None or lon is None:
            continue

        name = pick(props, ["station_name", "name", "StationName", "station", "label"], f"OPW station {idx + 1}")
        station_ref = pick(props, ["station_ref", "station_ref_no", "station", "station_no", "ref"], "")
        sensor_ref = pick(props, ["sensor_ref", "sensor", "sensor_no"], "")
        observed = pick(props, ["datetime", "time", "timestamp", "date", "observed_at"], None)

        records.append({
            "id": f"opw:{station_ref or idx}:{sensor_ref or 'latest'}",
            "source": "opw_waterlevel",
            "source_label": SOURCE_DEFS["opw_waterlevel"]["name"],
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
            "raw": props
        })

    return records, make_source_status("opw_waterlevel", "ok", len(records), now)


def harvest_bathing(now: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    sources: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []

    locations, location_error = fetch_paged(f"{EPA_BW}/locations")
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
            "raw": item
        }

        parameters = []
        classification = pick(item, ["current_annual_water_quality_classification", "annual_water_quality_classification", "classification"], None)

        if classification:
            parameters.append({
                "key": "annual_classification",
                "label": "Annual classification",
                "value": str(classification),
                "unit": "",
                "basis": "EPA annual bathing-water classification"
            })

        records.append({
            "id": f"bw-location:{loc_id}",
            "source": "epa_bathing_locations",
            "source_label": SOURCE_DEFS["epa_bathing_locations"]["name"],
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
            "raw": item
        })

    sources.append(make_source_status(
        "epa_bathing_locations",
        "partial" if location_error else "ok",
        len(locations),
        now,
        location_error
    ))

    measurements, measurement_error = fetch_paged(f"{EPA_BW}/measurements", per_page=1000, max_pages=4)

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

        parameters = []

        e_coli = pick(item, ["e_coli", "ecoli", "e_coli_result", "ecoli_result", "EColi"], None)
        entero = pick(item, [
            "intestinal_enterococci",
            "enterococci",
            "intestinal_enterococci_result",
            "enterococci_result",
            "IntestinalEnterococci"
        ], None)

        if as_float(e_coli) is not None:
            parameters.append({
                "key": "e_coli",
                "label": "E. coli",
                "value": as_float(e_coli),
                "unit": "cfu/100 mL",
                "basis": "EPA bathing-water sample"
            })

        if as_float(entero) is not None:
            parameters.append({
                "key": "intestinal_enterococci",
                "label": "Intestinal enterococci",
                "value": as_float(entero),
                "unit": "cfu/100 mL",
                "basis": "EPA bathing-water sample"
            })

        if not parameters:
            parameters = numeric_parameters(item)

        records.append({
            "id": f"bw-measurement:{pick(item, ['monitoring_result_id', 'id'], idx)}",
            "source": "epa_bathing_measurements",
            "source_label": SOURCE_DEFS["epa_bathing_measurements"]["name"],
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
            "raw": item
        })

    sources.append(make_source_status(
        "epa_bathing_measurements",
        "partial" if measurement_error else "ok",
        len(measurements),
        now,
        measurement_error
    ))

    alerts, alert_error = fetch_paged(f"{EPA_BW}/alerts", per_page=1000, max_pages=2)

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
            "source": "epa_bathing_alerts",
            "source_label": SOURCE_DEFS["epa_bathing_alerts"]["name"],
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
            "raw": item
        })

    sources.append(make_source_status(
        "epa_bathing_alerts",
        "partial" if alert_error else "ok",
        len(alerts),
        now,
        alert_error
    ))

    return records, sources


def harvest_wfd(now: str, keywords: list[str]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records: list[dict[str, Any]] = []
    errors: list[str] = []

    for keyword in keywords:
        query = urllib.parse.urlencode({"v": keyword, "size": 8})
        url = f"{WFD_SEARCH}?{query}"

        try:
            payload = fetch_json(url)
            items = extract_items(payload)
        except Exception as exc:
            errors.append(f"{keyword}: {exc}")
            continue

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue

            if not text_contains_focus(item, keywords):
                continue

            name = safe_string(pick(item, ["name", "Name", "label", "title"], keyword))
            code = safe_string(pick(item, ["code", "Code", "id", "waterbodyCode"], f"{keyword}_{idx}"))
            lat, lon = coordinate_from_record(item, name)

            records.append({
                "id": f"wfd:{code}",
                "source": "epa_wfd",
                "source_label": SOURCE_DEFS["epa_wfd"]["name"],
                "type": "wfd_context",
                "freshness": "context",
                "name": name,
                "lat": lat,
                "lon": lon,
                "observed_at": None,
                "generated_at": now,
                "status": safe_string(pick(item, ["status", "risk", "category", "type"], "context")),
                "description": "WFD search result connected to the configured focus keyword set.",
                "url": "https://www.catchments.ie/",
                "parameters": [],
                "raw": item
            })

        time.sleep(0.15)

    deduped = []
    seen = set()
    for record in records:
        if record["id"] in seen:
            continue
        seen.add(record["id"])
        deduped.append(record)

    return deduped, make_source_status(
        "epa_wfd",
        "partial" if errors else "ok",
        len(deduped),
        now,
        "; ".join(errors[:3]) if errors else None
    )


def planned_context_records(now: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records = [
        {
            "id": "groundwater:geoportal-planned",
            "source": "epa_geoportal_context",
            "source_label": SOURCE_DEFS["epa_geoportal_context"]["name"],
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
            "source_label": SOURCE_DEFS["marine_institute_context"]["name"],
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
