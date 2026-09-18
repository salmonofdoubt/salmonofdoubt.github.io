#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.parse
import urllib.error
import urllib.request
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

WFS_URL = "https://gis.epa.ie/geoserver/EPA/ows"
HISTORIC_Q_LAYER = "EPA:MON_Waterstations_MON_QRecords_71_18"
RECENT_Q_LAYER = "EPA:MON_QRecords_Version2"
RIVER_WATERBODY_LAYER = "EPA:WFD_RIVERWATERBODIES_CYCLE3"

SOURCE_URLS = {
    "q_map": "https://gis.epa.ie/EPAMaps/Water",
    "q_downloads": "https://gis.epa.ie/GetData/Download",
    "q_surveys": "https://epawebapp.epa.ie/qvalue/webusers/",
}

STATION_KEY_CANDIDATES = ["StationID", "StationCode", "EPALink"]
STATION_NAME_CANDIDATES = ["StationName", "Station"]
WATERBODY_KEY_CANDIDATES = ["WBWFDWISECODE", "EU_CD", "WaterbodyCode", "WaterBodyCode"]
ENTITY_NAME_CANDIDATES = ["RiverWaterbodyName", "EntityName", "WaterbodyName", "WaterBodyName", "RiverName", "NAME", "Name"]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def norm_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def property_index(props: dict[str, Any]) -> dict[str, Any]:
    return {norm_key(key): value for key, value in props.items()}


def pick(props: dict[str, Any], candidates: Iterable[str], default: Any = None) -> Any:
    indexed = property_index(props)
    for candidate in candidates:
        value = indexed.get(norm_key(candidate))
        if value not in (None, ""):
            return value
    return default


def text(value: Any, default: str = "") -> str:
    value = "" if value is None else str(value).strip()
    return value or default


def station_id(props: dict[str, Any]) -> str:
    return text(pick(props, STATION_KEY_CANDIDATES))


def parse_year(value: Any) -> int | None:
    if isinstance(value, (int, float)) and 1900 <= int(value) <= 2100:
        return int(value)
    match = re.search(r"\b((?:19|20)\d{2})\b", text(value))
    return int(match.group(1)) if match else None


def normalize_q_value(value: Any) -> str | None:
    if value in (None, ""):
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
        return f"Q{first}"
    low, high = sorted((first, second))
    return f"Q{low}-{high}"


def q_status(q_value: str | None) -> str | None:
    return {
        "Q5": "High", "Q4-5": "High", "Q4": "Good", "Q3-4": "Moderate",
        "Q3": "Poor", "Q2-3": "Poor", "Q2": "Bad", "Q1-2": "Bad", "Q1": "Bad",
    }.get(q_value or "")


def geometry_point(feature: dict[str, Any]) -> tuple[float, float] | None:
    geometry = feature.get("geometry") or {}
    kind = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if kind == "Point" and len(coords) >= 2:
        candidate = coords
    elif kind == "MultiPoint" and coords and isinstance(coords[0], list) and len(coords[0]) >= 2:
        candidate = coords[0]
    else:
        return None
    lon, lat = float(candidate[0]), float(candidate[1])
    return (lon, lat) if -11.5 <= lon <= -5.0 and 50.5 <= lat <= 56.0 else None


def geometry_lines(feature: dict[str, Any]) -> list[list[list[float]]]:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") == "LineString":
        return [geometry.get("coordinates") or []]
    if geometry.get("type") == "MultiLineString":
        return geometry.get("coordinates") or []
    return []


def event_base(feature: dict[str, Any]) -> dict[str, Any] | None:
    props = feature.get("properties") or {}
    sid = station_id(props)
    point = geometry_point(feature)
    if not sid or not point:
        return None
    return {
        "stationId": sid,
        "stationName": text(pick(props, STATION_NAME_CANDIDATES), sid),
        "waterbodyCode": text(pick(props, WATERBODY_KEY_CANDIDATES)),
        "entityName": text(pick(props, ENTITY_NAME_CANDIDATES)),
        "lon": round(point[0], 6),
        "lat": round(point[1], 6),
    }


def historical_events_from_feature(feature: dict[str, Any]) -> list[dict[str, Any]]:
    base = event_base(feature)
    if not base:
        return []
    props = feature.get("properties") or {}
    events = []
    for key, raw_value in props.items():
        match = re.fullmatch(r"QV(\d{2})", str(key), flags=re.IGNORECASE)
        if not match or raw_value in (None, ""):
            continue
        yy = int(match.group(1))
        year = 1900 + yy if yy >= 71 else 2000 + yy
        if not 1971 <= year <= 2020:
            continue
        q = normalize_q_value(raw_value)
        status = q_status(q)
        if not q or not status:
            continue
        events.append({**base, "year": year, "q": q, "status": status})
    return events


def recent_event_from_feature(feature: dict[str, Any]) -> dict[str, Any] | None:
    base = event_base(feature)
    if not base:
        return None
    props = feature.get("properties") or {}
    year = parse_year(pick(props, ["Year"]))
    if year is None or year <= 2020:
        return None
    q = normalize_q_value(pick(props, ["QValueScore", "QValue", "Q_Value"]))
    status = q_status(q)
    if not q or not status:
        return None
    return {**base, "year": year, "q": q, "status": status}


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
    return simplify_radial(clipped, 40) if len(clipped) >= 2 else None


def wfs_url(layer: str, *, count: int, start_index: int) -> str:
    query = urllib.parse.urlencode({
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": layer, "count": count, "startIndex": start_index,
        "outputFormat": "application/json", "srsName": "EPSG:4326",
    })
    return f"{WFS_URL}?{query}"


def fetch_json(url: str, timeout: int = 120, attempts: int = 3) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "SalmonOfDoubt-DarkRivers/2.0"})
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:1200]
            if 500 <= exc.code < 600 and attempt < attempts:
                last_error = exc
                time.sleep(attempt * 2)
                continue
            raise RuntimeError(f"EPA WFS HTTP {exc.code} for {url}: {body}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(attempt * 2)
                continue
            raise RuntimeError(f"EPA WFS request failed after {attempts} attempts: {url}: {exc}") from exc
    raise RuntimeError(f"EPA WFS request failed: {url}: {last_error}")


def fetch_wfs(layer: str, *, page_size: int = 1000, max_pages: int = 30) -> list[dict[str, Any]]:
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


def dedupe_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[tuple[str, int, str], dict[str, Any]] = {}
    for event in events:
        unique[(event["stationId"], int(event["year"]), event["q"])] = event
    return sorted(unique.values(), key=lambda item: (int(item["year"]), item["stationId"], item["q"]))


def build_waterbody_index(features: list[dict[str, Any]]) -> tuple[dict[str, list[list[list[float]]]], list[list[list[float]]]]:
    index: dict[str, list[list[list[float]]]] = defaultdict(list)
    network: list[list[list[float]]] = []
    for feature in features:
        lines = geometry_lines(feature)
        if not lines:
            continue
        props = feature.get("properties") or {}
        code = text(pick(props, ["EU_CD"]))
        for line in lines:
            if len(line) >= 2:
                network.append(simplify_radial(line, 220))
        if code:
            index[norm_key(code)].extend(lines)
    return dict(index), network


def build_payload(
    historic_q_features: list[dict[str, Any]],
    recent_q_features: list[dict[str, Any]],
    river_features: list[dict[str, Any]],
) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    for feature in historic_q_features:
        events.extend(historical_events_from_feature(feature))
    for feature in recent_q_features:
        event = recent_event_from_feature(feature)
        if event:
            events.append(event)
    events = dedupe_events(events)
    if not events:
        raise RuntimeError("No valid EPA Q-value events were normalised")

    waterbody_index, network = build_waterbody_index(river_features)
    by_station: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        by_station[event["stationId"]].append(event)

    reaches: dict[str, dict[str, Any]] = {}
    for sid, station_events in by_station.items():
        station_events.sort(key=lambda e: int(e["year"]))
        source = next((e for e in reversed(station_events) if e.get("waterbodyCode")), station_events[-1])
        code = norm_key(source.get("waterbodyCode"))
        lines = waterbody_index.get(code, []) if code else []
        clipped = clip_local_reach((source["lon"], source["lat"]), lines) if lines else None
        if not clipped:
            continue
        reaches[sid] = {
            "id": sid,
            "name": source.get("entityName") or source.get("stationName") or "Observed reach",
            "stationId": sid,
            "stationName": source.get("stationName") or sid,
            "waterbodyCode": source.get("waterbodyCode", ""),
            "coordinates": clipped,
        }

    for event in events:
        event["reachId"] = event["stationId"] if event["stationId"] in reaches else None

    years = [int(event["year"]) for event in events]
    unique_stations = len(by_station)
    matched_stations = len(reaches)
    unmatched_events = sum(1 for event in events if not event.get("reachId"))
    return {
        "meta": {
            "official": True,
            "generatedAt": utc_now(),
            "minYear": min(years),
            "maxYear": max(years),
            "sourceLabel": "EPA Biological Q Stations and Records",
            "licence": "Creative Commons Attribution 4.0",
            "historicQLayer": HISTORIC_Q_LAYER,
            "recentQLayer": RECENT_Q_LAYER,
            "riverLayer": RIVER_WATERBODY_LAYER,
            "historyRule": "1971-2020 from QV71..QV20; 2021 onward from Year + QValueScore",
            "reachAssociation": "Q monitoring station → WBWFDWISECODE → local ~5 km section of Cycle 3 river-waterbody geometry",
            "eventCount": len(events),
            "stationCount": unique_stations,
            "reachCount": matched_stations,
            "matchedStationRatio": round(matched_stations / unique_stations, 4) if unique_stations else 0,
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
    network = payload.get("network") or []

    if meta.get("official") is not True:
        raise RuntimeError("Output is not marked official")
    if len(events) < 10_000:
        raise RuntimeError(f"Suspiciously few Q observations: {len(events):,}")
    if int(meta.get("minYear", 9999)) > 1971:
        raise RuntimeError(f"Historical coverage does not reach 1971: {meta.get('minYear')}")
    if int(meta.get("maxYear", 0)) < 2025:
        raise RuntimeError(f"Recent coverage does not reach 2025: {meta.get('maxYear')}")
    if len(network) < 3_000:
        raise RuntimeError(f"Suspiciously small river network: {len(network):,} lines")
    if len(reaches) < 1_000:
        raise RuntimeError(f"Suspiciously few station-associated reaches: {len(reaches):,}")
    if float(meta.get("matchedStationRatio", 0)) < 0.65:
        raise RuntimeError(f"Station/reach match ratio too low: {meta.get('matchedStationRatio')}")

    allowed = {"High", "Good", "Moderate", "Poor", "Bad"}
    for event in events:
        if event.get("status") not in allowed:
            raise RuntimeError(f"Unexpected status in event: {event}")
        if not 1971 <= int(event.get("year", 0)) <= 2025:
            raise RuntimeError(f"Unexpected year in event: {event}")
        lon, lat = float(event["lon"]), float(event["lat"])
        if not (-11.5 <= lon <= -5.0 and 50.5 <= lat <= 56.0):
            raise RuntimeError(f"Observation outside Ireland bounds: {event}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static official EPA data for Dark Rivers")
    parser.add_argument("--output", default="demos/dark-rivers/data/official.json")
    args = parser.parse_args()

    print("Fetching EPA historical Q station records (1971-2020)…", file=sys.stderr)
    historic = fetch_wfs(HISTORIC_Q_LAYER)
    print(f"Fetched {len(historic):,} historical station rows", file=sys.stderr)

    print("Fetching EPA recent Q records…", file=sys.stderr)
    recent = fetch_wfs(RECENT_Q_LAYER)
    print(f"Fetched {len(recent):,} recent Q rows", file=sys.stderr)

    print("Fetching EPA Cycle 3 river waterbodies…", file=sys.stderr)
    rivers = fetch_wfs(RIVER_WATERBODY_LAYER)
    print(f"Fetched {len(rivers):,} river waterbodies", file=sys.stderr)

    payload = build_payload(historic, recent, rivers)
    validate_payload(payload)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix(output.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(output)

    size_mb = output.stat().st_size / (1024 * 1024)
    meta = payload["meta"]
    print(
        "Dark Rivers official data: "
        f"{meta['eventCount']:,} observations, {meta['stationCount']:,} stations, "
        f"{meta['reachCount']:,} matched reaches ({meta['matchedStationRatio']:.1%}), "
        f"{len(payload['network']):,} network lines, {size_mb:.2f} MiB",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
