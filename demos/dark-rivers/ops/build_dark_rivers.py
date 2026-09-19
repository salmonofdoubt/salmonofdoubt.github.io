#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

WFS_URL = "https://gis.epa.ie/geoserver/EPA/ows"
HISTORIC_Q_LAYER = "EPA:MON_Waterstations_MON_QRecords_71_18"
RECENT_Q_LAYER = "EPA:MON_QRecords_Version2"
RIVER_WATERBODY_LAYER = "EPA:WFD_RIVERWATERBODIES_CYCLE3"

LAYER_SORTS = {
    HISTORIC_Q_LAYER: "StationID A",
    RECENT_Q_LAYER: "StationCode A,Year A",
    RIVER_WATERBODY_LAYER: "EU_CD A",
}

SOURCE_URLS = {
    "q_map": "https://gis.epa.ie/EPAMaps/Water",
    "q_downloads": "https://gis.epa.ie/GetData/Download",
    "q_surveys": "https://epawebapp.epa.ie/qvalue/webusers/",
}

STATION_KEY_CANDIDATES = ["StationID", "StationCode", "EPALink"]
STATION_NAME_CANDIDATES = ["StationName", "Station"]
WATERBODY_KEY_CANDIDATES = ["WBWFDWISECODE", "EU_CD", "WaterbodyCode", "WaterBodyCode"]
ENTITY_NAME_CANDIDATES = ["RiverWaterbodyName", "EntityName", "WaterbodyName", "WaterBodyName", "RiverName", "NAME", "Name"]

SVG_MIN_LON = -10.75
SVG_MAX_LON = -5.75
SVG_MIN_LAT = 51.25
SVG_MAX_LAT = 55.55
SVG_LEFT = 145.0
SVG_RIGHT = 855.0
SVG_TOP = 45.0
SVG_BOTTOM = 680.0



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
    if second is None or abs(second - first) != 1:
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
        if q and status:
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
        return [[float(p[0]), float(p[1])] for p in coords]
    out = [coords[0]]
    for point in coords[1:-1]:
        if haversine_m(out[-1], point) >= min_distance_m:
            out.append(point)
    out.append(coords[-1])
    return [[float(p[0]), float(p[1])] for p in out]


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


def project_svg(lon: float, lat: float) -> tuple[float, float]:
    x = SVG_LEFT + (lon - SVG_MIN_LON) / (SVG_MAX_LON - SVG_MIN_LON) * (SVG_RIGHT - SVG_LEFT)
    y = SVG_BOTTOM - (lat - SVG_MIN_LAT) / (SVG_MAX_LAT - SVG_MIN_LAT) * (SVG_BOTTOM - SVG_TOP)
    return x, y


def fmt_svg(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def svg_path_from_coords(coords: list[list[float]], min_distance_m: float = 0) -> str:
    if min_distance_m > 0:
        coords = simplify_radial(coords, min_distance_m)
    projected: list[tuple[float, float]] = []
    for point in coords:
        if len(point) < 2:
            continue
        xy = (round(project_svg(float(point[0]), float(point[1]))[0], 1),
              round(project_svg(float(point[0]), float(point[1]))[1], 1))
        if not projected or xy != projected[-1]:
            projected.append(xy)
    if len(projected) < 2:
        return ""
    first, *rest = projected
    path = f"M{fmt_svg(first[0])} {fmt_svg(first[1])}"
    for x, y in rest:
        path += f"L{fmt_svg(x)} {fmt_svg(y)}"
    return path


def wfs_url(layer: str, *, count: int, start_index: int, sort_by: str | None = None) -> str:
    params = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": layer, "count": count, "startIndex": start_index,
        "outputFormat": "application/json", "srsName": "EPSG:4326",
    }
    if sort_by:
        params["sortBy"] = sort_by
    return f"{WFS_URL}?{urllib.parse.urlencode(params)}"


def fetch_json(url: str, timeout: int = 120, attempts: int = 3) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "SalmonOfDoubt-DarkRivers/3.0"})
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
        payload = fetch_json(wfs_url(
            layer,
            count=page_size,
            start_index=page * page_size,
            sort_by=LAYER_SORTS.get(layer),
        ))
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


def build_waterbody_index_and_network_path(
    features: list[dict[str, Any]],
) -> tuple[dict[str, list[list[list[float]]]], str, int]:
    index: dict[str, list[list[list[float]]]] = defaultdict(list)
    network_parts: list[str] = []
    segment_count = 0
    for feature in features:
        lines = geometry_lines(feature)
        if not lines:
            continue
        props = feature.get("properties") or {}
        code = text(pick(props, ["EU_CD"]))
        if code:
            index[norm_key(code)].extend(lines)
        for line in lines:
            d = svg_path_from_coords(line, min_distance_m=260)
            if d:
                network_parts.append(d)
                segment_count += 1
    return dict(index), "".join(network_parts), segment_count



def vertex_key(point: list[float]) -> tuple[int, int]:
    """Shared source vertices within about one metre, never arbitrary proximity."""
    return (round(float(point[0]) * 100000), round(float(point[1]) * 100000))


def build_connected_systems(
    features: list[dict[str, Any]],
) -> tuple[list[list[Any]], dict[str, list[str]]]:
    """Connect river geometry only where mapped vertices actually meet.

    The result is a *connected drainage component*, not a single named river or
    a model of flow direction. Keep path geometry in the separate lazy-loaded
    systems file so the interactive timeline does not download it twice.
    """
    segments: list[tuple[str, list[list[float]], str]] = []
    per_code: dict[str, list[int]] = defaultdict(list)
    endpoints: dict[tuple[int, int], list[int]] = defaultdict(list)

    for feature in features:
        props = feature.get("properties") or {}
        code = norm_key(text(pick(props, ["EU_CD"])))
        label = text(pick(props, ["NAME", "RiverWaterbodyName", "RiverName"]))
        for original in geometry_lines(feature):
            coords = [
                [float(p[0]), float(p[1])] for p in original
                if isinstance(p, (list, tuple)) and len(p) >= 2
            ]
            if len(coords) < 2:
                continue
            sid = len(segments)
            segments.append((code, coords, label))
            if code:
                per_code[code].append(sid)
            endpoints[vertex_key(coords[0])].append(sid)
            endpoints[vertex_key(coords[-1])].append(sid)

    parent = list(range(len(segments)))
    rank = [0] * len(segments)

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        if rank[ra] == rank[rb]:
            rank[ra] += 1

    # First join exact/snap-matched endpoints. Then match endpoints that meet
    # interior vertices of another mapped line (T-shaped confluences).
    for ids in endpoints.values():
        for sid in ids[1:]:
            union(ids[0], sid)
    for sid, (_code, coords, _label) in enumerate(segments):
        for point in coords[1:-1]:
            attached = endpoints.get(vertex_key(point))
            if attached:
                union(sid, attached[0])

    components: dict[int, list[int]] = defaultdict(list)
    for sid in range(len(segments)):
        components[find(sid)].append(sid)

    systems: list[list[Any]] = []
    segment_system: dict[int, str] = {}
    for i, members in enumerate(
        sorted(components.values(), key=lambda ids: (-len(ids), ids[0])), start=1
    ):
        system_id = f"sys_{i:05d}"
        # Do not label a multi-river drainage network as a single river.
        distinct_names = {segments[sid][2] for sid in members if segments[sid][2]}
        label = next(iter(distinct_names)) if len(distinct_names) == 1 else "Connected drainage network"
        paths = [
            svg_path_from_coords(segments[sid][1], min_distance_m=260)
            for sid in members
        ]
        path = "".join(p for p in paths if p)
        if not path:
            continue
        systems.append([system_id, label, path, len(members)])
        for sid in members:
            segment_system[sid] = system_id

    code_systems = {
        code: [segment_system.get(sid, "") for sid in ids]
        for code, ids in per_code.items()
    }
    return systems, code_systems


def build_payload(
    historic_q_features: list[dict[str, Any]],
    recent_q_features: list[dict[str, Any]],
    river_features: list[dict[str, Any]],
) -> dict[str, Any]:
    expanded_events: list[dict[str, Any]] = []
    for feature in historic_q_features:
        expanded_events.extend(historical_events_from_feature(feature))
    for feature in recent_q_features:
        event = recent_event_from_feature(feature)
        if event:
            expanded_events.append(event)
    expanded_events = dedupe_events(expanded_events)
    if not expanded_events:
        raise RuntimeError("No valid EPA Q-value events were normalised")

    waterbody_index, network_path, network_segment_count = build_waterbody_index_and_network_path(river_features)
    systems, code_systems = build_connected_systems(river_features)
    by_station: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in expanded_events:
        by_station[event["stationId"]].append(event)

    reach_rows: list[list[Any]] = []
    matched_station_ids: set[str] = set()
    for sid, station_events in by_station.items():
        station_events.sort(key=lambda e: int(e["year"]))
        source = next((e for e in reversed(station_events) if e.get("waterbodyCode")), station_events[-1])
        code = norm_key(source.get("waterbodyCode"))
        lines = waterbody_index.get(code, []) if code else []
        nearest = nearest_line_position((source["lon"], source["lat"]), lines) if lines else None
        clipped = clip_local_reach((source["lon"], source["lat"]), lines) if nearest else None
        if not clipped:
            continue
        # Match this station to the connected component of its actual
        # nearest waterbody part, not merely the first component sharing EU_CD.
        alternatives = code_systems.get(code, [])
        system_id = alternatives[nearest[0]] if nearest and nearest[0] < len(alternatives) else ""
        d = svg_path_from_coords(clipped)
        if not d:
            continue
        matched_station_ids.add(sid)
        reach_rows.append([
            sid,
            source.get("entityName") or source.get("stationName") or "Observed reach",
            source.get("stationName") or sid,
            source.get("waterbodyCode", ""),
            source["lon"],
            source["lat"],
            d,
            system_id,
        ])

    event_rows: list[list[Any]] = []
    unmatched_events = 0
    for event in expanded_events:
        if event["stationId"] in matched_station_ids:
            event_rows.append([event["year"], event["stationId"], event["q"], event["status"]])
        else:
            unmatched_events += 1
            event_rows.append([
                event["year"], None, event["q"], event["status"],
                event["lon"], event["lat"], event["stationName"],
            ])

    years = [int(event["year"]) for event in expanded_events]
    unique_stations = len(by_station)
    matched_stations = len(matched_station_ids)
    return {
        "meta": {
            "official": True,
            "format": "dark-rivers-compact-v1",
            "minYear": min(years),
            "maxYear": max(years),
            "sourceLabel": "EPA Biological Q Stations and Records",
            "licence": "Creative Commons Attribution 4.0",
            "historicQLayer": HISTORIC_Q_LAYER,
            "recentQLayer": RECENT_Q_LAYER,
            "riverLayer": RIVER_WATERBODY_LAYER,
            "historyRule": "1971-2020 from QV71..QV20; 2021 onward from Year + QValueScore",
            "reachAssociation": "Q monitoring station → WBWFDWISECODE → local mapped section of Cycle 3 river-waterbody geometry",
            "eventCount": len(event_rows),
            "stationCount": unique_stations,
            "reachCount": matched_stations,
            "matchedStationRatio": round(matched_stations / unique_stations, 4) if unique_stations else 0,
            "unmatchedEvents": unmatched_events,
            "networkSegmentCount": network_segment_count,
            "networkPathChars": len(network_path),
            "systemCount": len(systems),
            "systemTopology": "Connected source vertices; no assumed flow direction or inferred ecological status",
            "sources": SOURCE_URLS,
        },
        "networkPath": network_path,
        "systems": systems,
        "reaches": reach_rows,
        "events": event_rows,
    }


def validate_payload(payload: dict[str, Any]) -> None:
    meta = payload.get("meta") or {}
    events = payload.get("events") or []
    reaches = payload.get("reaches") or []
    network_path = payload.get("networkPath") or ""

    if meta.get("official") is not True or meta.get("format") != "dark-rivers-compact-v1":
        raise RuntimeError("Output is not the expected official compact format")
    if len(events) < 10_000:
        raise RuntimeError(f"Suspiciously few Q observations: {len(events):,}")
    if int(meta.get("minYear", 9999)) > 1971:
        raise RuntimeError(f"Historical coverage does not reach 1971: {meta.get('minYear')}")
    if int(meta.get("maxYear", 0)) < 2025:
        raise RuntimeError(f"Recent coverage does not reach 2025: {meta.get('maxYear')}")
    if len(network_path) < 100_000:
        raise RuntimeError(f"Suspiciously small projected river network: {len(network_path):,} chars")
    if len(reaches) < 1_000:
        raise RuntimeError(f"Suspiciously few station-associated reaches: {len(reaches):,}")
    if float(meta.get("matchedStationRatio", 0)) < 0.65:
        raise RuntimeError(f"Station/reach match ratio too low: {meta.get('matchedStationRatio')}")

    systems = payload.get("systems") or []
    system_ids = {row[0] for row in systems}
    if not system_ids:
        raise RuntimeError("No connected drainage components were produced")
    for row in reaches:
        if len(row) >= 8 and row[7] and row[7] not in system_ids:
            raise RuntimeError(f"Station references unknown connected system: {row[0]}")

    reach_ids = {row[0] for row in reaches if len(row) >= 7}
    if len(reach_ids) != len(reaches):
        raise RuntimeError("Reach IDs are not unique or a reach row is malformed")

    allowed = {"High", "Good", "Moderate", "Poor", "Bad"}
    for row in events:
        if len(row) < 4:
            raise RuntimeError(f"Malformed event row: {row}")
        year, reach_id, _q, status = row[:4]
        if status not in allowed:
            raise RuntimeError(f"Unexpected status in event: {row}")
        if not 1971 <= int(year) <= 2025:
            raise RuntimeError(f"Unexpected year in event: {row}")
        if reach_id is not None and reach_id not in reach_ids:
            raise RuntimeError(f"Event references unknown reach: {row}")

    for row in reaches:
        lon, lat = float(row[4]), float(row[5])
        if not (-11.5 <= lon <= -5.0 and 50.5 <= lat <= 56.0):
            raise RuntimeError(f"Reach station outside Ireland bounds: {row[:6]}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build compact static official EPA data for Dark Rivers")
    parser.add_argument("--output", default="demos/dark-rivers/data/official.json")
    parser.add_argument("--systems-output", default="demos/dark-rivers/data/systems.json")
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
    # Store only lightweight system IDs beside Q observations. Full connected
    # SVG paths live in a separate file and are fetched only on river selection.
    system_payload = {
        "format": "dark-rivers-connected-systems-v1",
        "systems": payload["systems"],
    }
    main_payload = {key: value for key, value in payload.items() if key != "systems"}
    temp.write_text(json.dumps(main_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(output)
    systems_output = Path(args.systems_output)
    systems_output.parent.mkdir(parents=True, exist_ok=True)
    systems_temp = systems_output.with_suffix(systems_output.suffix + ".tmp")
    systems_temp.write_text(json.dumps(system_payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    systems_temp.replace(systems_output)

    size_mb = output.stat().st_size / (1024 * 1024)
    if size_mb > 15:
        raise RuntimeError(f"Compact Dark Rivers dataset unexpectedly large: {size_mb:.2f} MiB")

    meta = payload["meta"]
    print(
        "Dark Rivers official compact data: "
        f"{meta['eventCount']:,} observations, {meta['stationCount']:,} stations, "
        f"{meta['reachCount']:,} matched reaches ({meta['matchedStationRatio']:.1%}), "
        f"{meta['networkSegmentCount']:,} source line fragments, "
        f"{meta['systemCount']:,} connected drainage components, "
        f"{meta['networkPathChars']:,} projected path chars, {size_mb:.2f} MiB",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
