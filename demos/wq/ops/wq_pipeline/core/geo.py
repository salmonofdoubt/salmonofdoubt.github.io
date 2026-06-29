from __future__ import annotations

from typing import Any

from wq_pipeline.core.records import as_float, pick


KNOWN_LOCAL_COORDS = {'balbriggan': (53.61, -6.18),
 'baldoyle': (53.397, -6.136),
 'baldoyle bay': (53.407, -6.132),
 'delvin': (53.61, -6.28),
 'duleek': (53.66, -6.42),
 'gormanston': (53.64, -6.24),
 'howth': (53.388, -6.068),
 'julianstown': (53.67, -6.3),
 'laytown': (53.68, -6.24),
 'malahide': (53.45, -6.135),
 'malahide estuary': (53.455, -6.155),
 'nanny': (53.64, -6.23),
 'naul': (53.59, -6.29),
 'portmarnock': (53.424, -6.125),
 'river delvin': (53.61, -6.28),
 'river nanny': (53.64, -6.23),
 'sutton': (53.39, -6.11),
 'velvet strand': (53.424, -6.125)}


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
