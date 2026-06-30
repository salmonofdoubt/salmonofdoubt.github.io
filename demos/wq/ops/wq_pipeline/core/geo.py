from __future__ import annotations

import math

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


def irish_grid_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """Approximate inverse TM65 / Irish Grid to latitude/longitude.

    EPA WFD records expose Easting/Northing in Irish Grid-style projected metres.
    This inverse Transverse Mercator calculation is accurate enough for web-map
    positioning of official WFD waterbody centroids.
    """
    a = 6377340.189
    b = 6356034.447
    f0 = 1.000035
    lat0 = math.radians(53.5)
    lon0 = math.radians(-8.0)
    n0 = 250000.0
    e0 = 200000.0
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)

    lat = lat0
    m = 0.0

    while abs(northing - n0 - m) >= 0.00001:
        lat = (northing - n0 - m) / (a * f0) + lat
        ma = (1 + n + 1.25 * n**2 + 1.25 * n**3) * (lat - lat0)
        mb = (3 * n + 3 * n**2 + 2.625 * n**3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        mc = (1.875 * n**2 + 1.875 * n**3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        md = (35 / 24 * n**3) * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        m = b * f0 * (ma - mb + mc - md)

    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    tan_lat = math.tan(lat)
    nu = a * f0 / math.sqrt(1 - e2 * sin_lat**2)
    rho = a * f0 * (1 - e2) / ((1 - e2 * sin_lat**2) ** 1.5)
    eta2 = nu / rho - 1
    d_e = easting - e0
    sec_lat = 1 / cos_lat

    vii = tan_lat / (2 * rho * nu)
    viii = tan_lat / (24 * rho * nu**3) * (5 + 3 * tan_lat**2 + eta2 - 9 * tan_lat**2 * eta2)
    ix = tan_lat / (720 * rho * nu**5) * (61 + 90 * tan_lat**2 + 45 * tan_lat**4)
    x = sec_lat / nu
    xi = sec_lat / (6 * nu**3) * (nu / rho + 2 * tan_lat**2)
    xii = sec_lat / (120 * nu**5) * (5 + 28 * tan_lat**2 + 24 * tan_lat**4)
    xiia = sec_lat / (5040 * nu**7) * (61 + 662 * tan_lat**2 + 1320 * tan_lat**4 + 720 * tan_lat**6)

    lat_out = lat - vii * d_e**2 + viii * d_e**4 - ix * d_e**6
    lon_out = lon0 + x * d_e - xi * d_e**3 + xii * d_e**5 - xiia * d_e**7

    return math.degrees(lat_out), math.degrees(lon_out)


def coordinate_from_record(record: dict[str, Any], name_hint: str = "") -> tuple[float | None, float | None]:
    lat = as_float(pick(record, ["lat", "latitude", "y", "Latitude", "LATITUDE"]))
    lon = as_float(pick(record, ["lon", "lng", "long", "longitude", "x", "Longitude", "LONGITUDE"]))

    if lat is not None and lon is not None:
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon

    easting = as_float(pick(record, ["Easting", "easting", "east", "x"]))
    northing = as_float(pick(record, ["Northing", "northing", "north", "y"]))

    if easting is not None and northing is not None:
        if 0 <= easting <= 400000 and 0 <= northing <= 400000:
            return irish_grid_to_wgs84(easting, northing)

    text = f"{name_hint} " + " ".join(str(value) for value in record.values() if isinstance(value, str))
    text = text.lower()

    for key, coords in KNOWN_LOCAL_COORDS.items():
        if key in text:
            return coords

    return None, None
