from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ZONES_PATH = ROOT / "data" / "habitat-zones.geojson"


def point_in_ring(lat: float, lng: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1

    for i, coord in enumerate(ring):
        xi, yi = coord[0], coord[1]
        xj, yj = ring[j][0], ring[j][1]

        intersects = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )

        if intersects:
            inside = not inside

        j = i

    return inside


def point_in_feature(lat: float, lng: float, feature: dict) -> bool:
    geometry = feature.get("geometry") or {}
    gtype = geometry.get("type")
    coordinates = geometry.get("coordinates") or []

    if gtype == "Polygon":
        return any(point_in_ring(lat, lng, ring) for ring in coordinates)

    if gtype == "MultiPolygon":
        return any(
            any(point_in_ring(lat, lng, ring) for ring in polygon)
            for polygon in coordinates
        )

    return False


def habitats_at(lat: float, lng: float, features: list[dict]) -> set[str]:
    habitats: set[str] = set()

    for feature in features:
        if point_in_feature(lat, lng, feature):
            habitats.update(feature.get("properties", {}).get("habitats", []))

    return habitats


def main() -> None:
    payload = json.loads(ZONES_PATH.read_text(encoding="utf-8"))
    features = payload.get("features", [])

    if payload.get("type") != "FeatureCollection":
        raise SystemExit("habitat-zones.geojson must be a FeatureCollection")

    if not features:
        raise SystemExit("habitat-zones.geojson has no features")

    for feature in features:
        props = feature.get("properties", {})
        for required in ["id", "label", "country", "habitats"]:
            if required not in props:
                raise SystemExit(f"Feature missing property {required}: {props}")

    checks = [
        {
            "name": "Vorpommersche Boddenlandschaft",
            "lat": 54.43,
            "lng": 12.86,
            "must_include": {"coast", "wetland"},
        },
        {
            "name": "Central Germany",
            "lat": 50.11,
            "lng": 8.68,
            "must_exclude": {"coast", "wetland", "estuary"},
        },
        {
            "name": "Camargue",
            "lat": 43.52,
            "lng": 4.57,
            "must_include": {"coast", "wetland", "estuary"},
        },
        {
            "name": "Venetian Lagoon",
            "lat": 45.44,
            "lng": 12.33,
            "must_include": {"coast", "wetland", "estuary"},
        },
        {
            "name": "Baldoyle / Dublin Bay",
            "lat": 53.45,
            "lng": -6.15,
            "must_include": {"coast", "wetland", "estuary"},
        },
    ]

    for check in checks:
        found = habitats_at(check["lat"], check["lng"], features)
        missing = set(check.get("must_include", set())) - found
        forbidden = set(check.get("must_exclude", set())) & found

        if missing:
            raise SystemExit(f"{check['name']} missing expected habitats: {sorted(missing)}; found {sorted(found)}")

        if forbidden:
            raise SystemExit(f"{check['name']} included forbidden habitats: {sorted(forbidden)}; found {sorted(found)}")

    print(f"Habitat zones validation: pass ({len(features)} features)")


if __name__ == "__main__":
    main()
