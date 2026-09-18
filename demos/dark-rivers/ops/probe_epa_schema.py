#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

WFS_URL = "https://gis.epa.ie/geoserver/EPA/ows"
UA = {"User-Agent": "SalmonOfDoubt-DarkRivers-SchemaProbe/1.0"}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()


def url(**params: object) -> str:
    return WFS_URL + "?" + urllib.parse.urlencode(params)


def capabilities() -> list[str]:
    payload = get(url(service="WFS", version="2.0.0", request="GetCapabilities"))
    root = ET.fromstring(payload)
    names = []
    for elem in root.iter():
        if elem.tag.endswith("Name") and elem.text and ":" in elem.text:
            names.append(elem.text.strip())
    return sorted(set(names))


def describe(layer: str) -> list[str]:
    payload = get(url(service="WFS", version="2.0.0", request="DescribeFeatureType", typeName=layer))
    root = ET.fromstring(payload)
    fields = []
    for elem in root.iter():
        name = elem.attrib.get("name")
        if name and name not in fields:
            fields.append(name)
    return fields


def sample(layer: str) -> dict:
    payload = get(url(
        service="WFS", version="2.0.0", request="GetFeature", typeNames=layer,
        count=3, outputFormat="application/json", srsName="EPSG:4326",
    ))
    return json.loads(payload)


def hit_count(layer: str, cql_filter: str | None = None) -> int | None:
    params = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typeNames": layer, "resultType": "hits",
    }
    if cql_filter:
        params["CQL_FILTER"] = cql_filter
    payload = get(url(**params))
    root = ET.fromstring(payload)
    for key in ("numberMatched", "numberOfFeatures"):
        for attr_name, value in root.attrib.items():
            if attr_name.endswith(key):
                try:
                    return int(value)
                except ValueError:
                    pass
    return None


def main() -> None:
    names = capabilities()
    interesting = [
        name for name in names
        if re.search(r"(Q|MON_|WATERSTATION|RIVERWATERBOD|BIOLOG)", name, re.I)
    ]
    print("=== MATCHING WFS LAYERS ===")
    for name in interesting:
        print(name)

    preferred_patterns = {
        "stations": [r"MON.*Water.*Station", r"Biological.*Q.*Station"],
        "historic_q": [r"QRecords.*71", r"MON.*QRecords.*71"],
        "q": [r"MON.*QRecords", r"Biological.*Q.*Result"],
        "rivers": [r"RIVERWATERBODIES.*CYCLE3", r"River.*Waterbod.*Cycle3"],
    }

    print("\n=== CANDIDATE SCHEMAS / SAMPLE RECORDS ===")
    selected = {}
    for key, patterns in preferred_patterns.items():
        matches = []
        for pattern in patterns:
            matches.extend([name for name in interesting if re.search(pattern, name, re.I)])
        matches = list(dict.fromkeys(matches))
        if not matches:
            print(f"\n[{key}] NO MATCH")
            continue
        layer = matches[0]
        selected[key] = layer
        print(f"\n[{key}] {layer}")
        try:
            print("fields:", describe(layer))
        except Exception as exc:
            print("describe_error:", repr(exc))
        try:
            payload = sample(layer)
            feats = payload.get("features") or []
            print("numberReturned:", payload.get("numberReturned"))
            for i, feat in enumerate(feats[:3]):
                geom = feat.get("geometry") or {}
                print(f"sample_{i+1}_geometry:", geom.get("type"))
                print(f"sample_{i+1}_coordinates_head:", json.dumps(geom.get("coordinates"), ensure_ascii=False)[:260])
                print(f"sample_{i+1}_properties:", json.dumps(feat.get("properties") or {}, ensure_ascii=False, sort_keys=True))
        except Exception as exc:
            print("sample_error:", repr(exc))

    print("\n=== COUNTS ===")
    for key, layer in selected.items():
        try:
            print(f"{key}: {hit_count(layer)}")
        except Exception as exc:
            print(f"{key}: count_error={exc!r}")
    if "q" in selected:
        print("\n=== RECENT Q YEAR COUNTS ===")
        for year in range(2019, 2026):
            try:
                print(f"{year}: {hit_count(selected['q'], f'Year={year}')}")
            except Exception as exc:
                print(f"{year}: count_error={exc!r}")

    print("\n=== SELECTED ===")
    print(json.dumps(selected, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
