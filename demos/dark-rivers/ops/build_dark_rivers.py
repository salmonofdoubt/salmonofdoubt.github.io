#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

WFS_URL = "https://gis.epa.ie/geoserver/EPA/ows"
STATION_LAYER = "EPA:MON_WaterStations"
HISTORIC_Q_LAYER = "EPA:MON_Waterstations_MON_QRecords_71_18"
LATEST_Q_LAYER = "EPA:MON_QRecords_Version2"
RIVER_WATERBODY_LAYER = "EPA:WFD_RIVERWATERBODIES_CYCLE3"

SOURCE_URLS = {
    "stations": "https://data.gov.ie/dataset/water-monitoring-stations",
    "river_network": "https://data.gov.ie/dataset/inspire-water-framework-directive-river-network-routes",
    "q_map": "https://gis.epa.ie/EPAMaps/Water",
    "q_downloads": "https://gis.epa.ie/GetData/Download",
}

Q_KEY_CANDIDATES = [
    "QValue", "Q_Value", "QVAL", "Q", "BioticIndex", "BiologicalQValue",
    "QRating", "Q_Rating", "Result", "QScore",
]
YEAR_KEY_CANDIDATES = [
    "Year", "SampleYear", "SurveyYear", "MonitoringYear", "QYear", "SampleDate",
    "SurveyDate", "Date", "ObservedAt", "ResultDate",
]
STATION_KEY_CANDIDATES = [
    "EPALink", "StationID", "StationId", "StationCode", "Code", "MON_STATION_ID",
]
STATION_NAME_CANDIDATES = ["StationName", "Name", "Station", "MON_STATION_NAME"]
WATERBODY_KEY_CANDIDATES = [
    "WBWFDWISECODE", "WFDWISECODE", "EU_CD", "WaterbodyCode", "WaterBodyCode",
    "WBCode", "Code",
]
ENTITY_NAME_CANDIDATES = ["EntityName", "WaterbodyName", "WaterBodyName", "RiverName", "NAME", "Name"]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def norm_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def property_index(props: dict[str, Any]) -> dict[str, Any]:
    return {norm_key(key): value for key, value in props.items()}


def pick(props: dict[str, Any], candidates: Iterable[str], default: Any = None) -> Any:
    indexed = property_index(props)
    for candidate in candidates:
        key = norm_key(candidate)
        if key in indexed and indexed[key] not in (None, ""):
            return indexed[key]
    return default


def text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    value = str(value).strip()
    return value if value else default


def station_keys(props: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    indexed = property_index(props)
    for candidate in STATION_KEY_CANDIDATES:
        value = indexed.get(norm_key(candidate))
        if value not in (None, ""):
            key = norm_key(value)
            if key and key not in keys:
                keys.append(key)
    return keys


def parse_year(value: Any) -> int | None:
    if isinstance(value, (int, float)) and 1900 <= int(value) <= 2100:
        return int(value)
    match = re.search(r"\b((?:19|20)\d{2})\b", text(value))
    return int(match.group(1)) if match else None


def find_year(props: dict[str, Any]) -> int | None:
    value = pick(props, YEAR_KEY_CANDIDATES)
    year = parse_year(value)
    if year:
        return year
    for key, value in props.items():
        nk = norm_key(key)
        if "year" in nk or "date" in nk:
            year = parse_year(value)
            if year:
                return year
    return None


def normalize_q_value(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        if not 1 <= numeric <= 5:
            return None
        whole = int(math.floor(numeric + 1e-9))
        if abs(numeric - whole) < 0.01:
            return f"Q{whole}"
        if abs(numeric - (whole + 0.5)) < 0.08 and whole < 5:
            return f"Q{whole}-{whole + 1}"
        return None

    raw = text(value).upper().replace("–", "-").replace("—", "-").replace(" ", "")
    match = re.search(r"Q?([1-5])(?:[-/.]([1-5]))?", raw)
    if not match:
        return None
    first = int(match.group(1))
    second = int(match.group(2)) if match.group(2) else None
    if second is None:
        return f"Q{first}"
    if abs(second - first) != 1:
        return None
    low, high = sorted((first, second))
    return f"Q{low}-{high}"


def find_q_value(props: dict[str, Any]) -> str | None:
    q = normalize_q_value(pick(props, Q_KEY_CANDIDATES))
    if q:
        return q
    for key, value in props.items():
        nk = norm_key(key)
        if nk == "q" or (nk.startswith("q") and any(part in nk for part in ("value", "rating", "score", "biotic"))):
            q = normalize_q_value(value)
            if q:
                return q
    return None


def q_status(q_value: str | None) -> str | None:
    return {
        "Q5": "High", "Q4-5": "High", "Q4": "Good", "Q3-4": "Moderate",
        "Q3": "Poor", "Q2-3": "Poor", "Q2": "Bad", "Q1-2": "Bad", "Q1": "Bad",
    }.get(q_value or "")


def geometry_point(feature: dict[str, Any]) -> tuple[float, float] | None:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "Point":
        return None
    coords = geometry.get("coordinates") or []
    if len(coords) < 2:
        return None
    lon, lat = float(coords[0]), float(coords[1])
    return (lon, lat) if -11.5 <= lon <= -5.0 and 50.5 <= lat <= 56.0 else None


def geometry_lines(feature: dict[str, Any]) -> list[list[list[float]]]:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") == "LineString":
        return [geometry.get("coordinates") or []]
    if geometry.get("type") == "MultiLineString":
        return geometry.get("coordinates") or []
    return []


def haversine_m(a: list[float] | tuple[float, float], b: list[float] | tuple[float, float]) -> float:
    lon1, lat1 = math.radians(float(a[0])), math.radians(float(a[1]))
    lon2, lat2 = math.radians(float(b[0])), math.radians(float(b[1]))
    dlon, dlat = lon2 - lon1, lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(min(1.0, math.sqrt(h)))


def simplify_radial(coords: list[list[float]], min_distance_m: float) -> list[list[float]]:
    if len(coords) <= 2:
        return [[round(float(p[0]), 6), round(float(p[1]), 6)] for p in coords]
    out = [coords[0]]
    for point in coords[1:-1]:
        if haversine_m(out[-1], point) >= min_distance_m:
            out.append(point)
    out.append(coords[-1])
    return [[round(float(p[0]), 6), round(float(p[1]), 6)] for p in out]


def point_segment_distance_m(point: tuple[float, float], a: list[float], b: list[float]) -> tuple[float, float]:
    lon, lat = point
    scale_x = 111320 * math.cos(math.radians(lat))
    scale_y = 110540
    ax, ay = (float(a[0]) - lon) * scale_x, (float(a[1]) - lat) * scale_y
    bx, by = (float(b[0]) - lon) * scale_x, (float(b[1]) - lat) * scale_y
    vx, vy = bx - ax, by - ay
    denom = vx * vx + vy * vy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, -(ax * vx + ay * vy) / denom))
    cx, cy = ax + t * vx, ay + t * vy
    return math.hypot(cx, cy), t


def nearest_line_position(point: tuple[float, float], lines: list[list[list[float]]]) -> tuple[int, int, float, float] | None:
    best = None
    for line_index, coords in enumerate(lines):
        for seg_index in range(len(coords) - 1):
            distance, t = point_segment_distance_m(point, coords[seg_index], coords[seg_index + 1])
            if best is None or distance < best[3]:
                best = (line_index, seg_index, t, distance)
    return best


def clip_local_reach(
    point: tuple[float, float],
    lines: list[list[list[float]]],
    radius_m: float = 2500,
    max_match_distance_m: float = 1500,
) -> list[list[float]] | None:
    nearest = nearest_line_position(point, lines)
    if nearest is None:
        return None
    line_index, seg_index, _, distance = nearest
    if distance > max_match_distance_m:
        return None
    coords = lines[line_index]
    start = seg_index
    walked = 0.0
    while start > 0 and walked < radius_m:
        walked += haversine_m(coords[start], coords[start - 1])
        start -= 1
    end = seg_index + 1
    walked = 0.0
    while end < len(coords) - 1 and walked < radius_m:
        walked += haversine_m(coords[end], coords[end + 1])
        end += 1
    clipped = coords[start:end + 1]
    return simplify_radial(clipped, 35) if len(clipped) >= 2 else None


def wfs_url(layer: str, *, count: int, start_index: int) -> str:
    query = urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": layer, "count": count, "startIndex": start_index,
        "outputFormat": "application/json", "srsName": "EPSG:4326",
    })
    return f"{WFS_URL}?{query}"


def fetch_json(url: str, timeout: int = 60) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "SalmonOfDoubt-DarkRivers/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def fetch_wfs(layer: str, *, page_size: int = 5000, max_pages: int = 100) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = []
    for page in range(max_pages):
        payload = fetch_json(wfs_url(layer, count=page_size, start_index=page * page_size))
        page_features = payload.get("features") or []
        if not isinstance(page_features, list):
            raise RuntimeError(f"WFS layer {layer} returned no feature list")
        features.extend(feature for feature in page_features if isinstance(feature, dict))
        if len(page_features) < page_size:
            return features
    raise RuntimeError(f"WFS layer {layer} exceeded {max_pages * page_size:,} features")


def build_station_index(features: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for feature in features:
        props = feature.get("properties") or {}
        record = {
            "point": geometry_point(feature),
            "name": text(pick(props, STATION_NAME_CANDIDATES), "Monitoring station"),
            "waterbody": text(pick(props, WATERBODY_KEY_CANDIDATES)),
            "entity": text(pick(props, ENTITY_NAME_CANDIDATES)),
        }
        for key in station_keys(props):
            index.setdefault(key, record)
    return index


def build_waterbody_index(features: list[dict[str, Any]]) -> tuple[dict[str, list[list[list[float]]]], list[list[list[float]]]]:
    index: dict[str, list[list[list[float]]]] = defaultdict(list)
    network: list[list[list[float]]] = []
    for feature in features:
        props = feature.get("properties") or {}
        lines = geometry_lines(feature)
        if not lines:
            continue
        for line in lines:
            if len(line) >= 2:
                network.append(simplify_radial(line, 180))
        code = text(pick(props, WATERBODY_KEY_CANDIDATES))
        if code:
            index[norm_key(code)].extend(lines)
    return dict(index), network


def event_from_feature(feature: dict[str, Any], station_index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    props = feature.get("properties") or {}
    q = find_q_value(props)
    year = find_year(props)
    status = q_status(q)
    if not q or not year or not status:
        return None

    keys = station_keys(props)
    station = next((station_index[key] for key in keys if key in station_index), None)
    point = geometry_point(feature) or (station or {}).get("point")
    if not point:
        return None

    station_id = keys[0] if keys else norm_key(pick(props, STATION_NAME_CANDIDATES, f"{point[0]}:{point[1]}"))
    return {
        "year": year,
        "stationId": station_id,
        "stationName": text(pick(props, STATION_NAME_CANDIDATES), (station or {}).get("name", "Monitoring station")),
        "waterbodyCode": text(pick(props, WATERBODY_KEY_CANDIDATES), (station or {}).get("waterbody", "")),
        "entityName": text(pick(props, ENTITY_NAME_CANDIDATES), (station or {}).get("entity", "")),
        "q": q,
        "status": status,
        "lon": round(float(point[0]), 6),
        "lat": round(float(point[1]), 6),
    }


def dedupe_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique = {}
    for event in events:
        unique[(event["stationId"], event["year"], event["q"])] = event
    return sorted(unique.values(), key=lambda item: (item["year"], item["stationId"], item["q"]))


def build_payload(
    station_features: list[dict[str, Any]],
    historic_q_features: list[dict[str, Any]],
    latest_q_features: list[dict[str, Any]],
    river_features: list[dict[str, Any]],
) -> dict[str, Any]:
    station_index = build_station_index(station_features)
    waterbody_index, network = build_waterbody_index(river_features)

    events = []
    for feature in [*historic_q_features, *latest_q_features]:
        event = event_from_feature(feature, station_index)
        if event:
            events.append(event)
    events = dedupe_events(events)
    if not events:
        raise RuntimeError("No valid Q-value events could be normalised from EPA WFS layers")

    reaches: dict[str, dict[str, Any]] = {}
    for event in events:
        reach_id = event["stationId"]
        event["reachId"] = None
        if reach_id in reaches:
            event["reachId"] = reach_id
            continue
        code = norm_key(event.get("waterbodyCode"))
        lines = waterbody_index.get(code, []) if code else []
        clipped = clip_local_reach((event["lon"], event["lat"]), lines) if lines else None
        if clipped:
            reaches[reach_id] = {
                "id": reach_id,
                "name": event.get("entityName") or event.get("stationName") or "Observed reach",
                "stationId": event["stationId"],
                "stationName": event["stationName"],
                "waterbodyCode": event.get("waterbodyCode", ""),
                "coordinates": clipped,
            }
            event["reachId"] = reach_id

    for event in events:
        if event["stationId"] in reaches:
            event["reachId"] = event["stationId"]

    years = [event["year"] for event in events]
    unmatched_events = sum(1 for event in events if not event.get("reachId"))
    return {
        "meta": {
            "official": True,
            "generatedAt": utc_now(),
            "minYear": min(years),
            "maxYear": max(years),
            "sourceLabel": "EPA River Ecology Monitoring Programme",
            "licence": "Creative Commons Attribution 4.0",
            "qLayers": [HISTORIC_Q_LAYER, LATEST_Q_LAYER],
            "stationLayer": STATION_LAYER,
            "riverLayer": RIVER_WATERBODY_LAYER,
            "reachAssociation": "Monitoring station → WFD river waterbody code → local ~5 km mapped section around the station",
            "eventCount": len(events),
            "reachCount": len(reaches),
            "unmatchedEvents": unmatched_events,
            "sources": SOURCE_URLS,
        },
        "network": network,
        "reaches": list(reaches.values()),
        "events": events,
    }


def validate_payload(payload: dict[str, Any]) -> None:
    meta = payload.get("meta") or {}
    events = payload.get("events") or []
    reaches = payload.get("reaches") or []
    if meta.get("official") is not True:
        raise RuntimeError("Output is not marked official")
    if not events:
        raise RuntimeError("Output contains no observations")
    if not payload.get("network"):
        raise RuntimeError("Output contains no river network geometry")
    if not reaches:
        raise RuntimeError("Output contains no station-associated local reaches")
    for event in events:
        if event.get("status") not in {"High", "Good", "Moderate", "Poor", "Bad"}:
            raise RuntimeError(f"Unexpected status in event: {event}")
        if not 1900 <= int(event.get("year", 0)) <= 2100:
            raise RuntimeError(f"Unexpected year in event: {event}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static official data for the Dark Rivers demo")
    parser.add_argument("--output", default="demos/dark-rivers/data/official.json")
    args = parser.parse_args()

    print("Fetching EPA monitoring stations…", file=sys.stderr)
    stations = fetch_wfs(STATION_LAYER)
    print("Fetching EPA historical Q values…", file=sys.stderr)
    historic = fetch_wfs(HISTORIC_Q_LAYER)
    print("Fetching EPA latest Q values…", file=sys.stderr)
    latest = fetch_wfs(LATEST_Q_LAYER)
    print("Fetching EPA Cycle 3 river waterbodies…", file=sys.stderr)
    rivers = fetch_wfs(RIVER_WATERBODY_LAYER)

    payload = build_payload(stations, historic, latest, rivers)
    validate_payload(payload)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(output.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(output)

    print(
        f"Wrote {len(payload['events']):,} events, {len(payload['reaches']):,} local reaches, "
        f"{len(payload['network']):,} network lines to {output}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
