from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(OPS_DIR))

from build_dark_rivers import (
    build_payload,
    clip_local_reach,
    geometry_point,
    historical_events_from_feature,
    merge_connected_lines,
    normalize_q_value,
    parse_year,
    q_status,
    recent_event_from_feature,
)


class DarkRiversBuilderTests(unittest.TestCase):
    def test_q_normalisation_and_status(self):
        cases = {
            "Q5": ("Q5", "High"),
            "4-5": ("Q4-5", "High"),
            "4*": ("Q4", "Good"),
            "3-4*": ("Q3-4", "Moderate"),
            "Q3": ("Q3", "Poor"),
            "2-3/0": ("Q2-3", "Poor"),
            "2/0": ("Q2", "Bad"),
            1.5: ("Q1-2", "Bad"),
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                q = normalize_q_value(raw)
                self.assertEqual(q, expected[0])
                self.assertEqual(q_status(q), expected[1])

    def test_year_parser(self):
        self.assertEqual(parse_year("surveyed 2018-07-03"), 2018)
        self.assertEqual(parse_year(2025), 2025)
        self.assertIsNone(parse_year("not dated"))

    def test_multipoint_geometry(self):
        feature = {"geometry": {"type": "MultiPoint", "coordinates": [[-6.20, 53.17]]}}
        self.assertEqual(geometry_point(feature), (-6.2, 53.17))

    def test_historical_wide_record_becomes_multiple_events(self):
        feature = {
            "geometry": {"type": "MultiPoint", "coordinates": [[-7.87, 54.73]]},
            "properties": {
                "StationID": "RS01B010100",
                "StationName": "Test station",
                "EntityName": "TEST RIVER",
                "WBWFDWISECODE": "IE_NW_TEST_001",
                "QV90": "4*",
                "QV19": "3-4",
                "QV20": "4*",
            },
        }
        events = historical_events_from_feature(feature)
        self.assertEqual([e["year"] for e in events], [1990, 2019, 2020])
        self.assertEqual([e["q"] for e in events], ["Q4", "Q3-4", "Q4"])

    def test_recent_layer_excludes_2020_overlap(self):
        old = {
            "geometry": {"type": "MultiPoint", "coordinates": [[-6.2, 53.17]]},
            "properties": {
                "StationCode": "RS10G010200",
                "StationName": "Station",
                "WBWFDWISECODE": "IE_EA_TEST_001",
                "Year": 2020,
                "QValueScore": "4",
            },
        }
        new = {
            **old,
            "properties": {**old["properties"], "Year": 2025, "QValueScore": "3"},
        }
        self.assertIsNone(recent_event_from_feature(old))
        event = recent_event_from_feature(new)
        self.assertIsNotNone(event)
        self.assertEqual(event["year"], 2025)
        self.assertEqual(event["q"], "Q3")

    def test_merge_connected_lines_stops_at_branch_junctions(self):
        lines = [
            [[-6.60, 53.60], [-6.58, 53.60]],
            [[-6.58, 53.60], [-6.56, 53.60]],
            [[-6.56, 53.60], [-6.54, 53.60]],
            [[-6.56, 53.60], [-6.56, 53.62]],
        ]
        merged = merge_connected_lines(lines)
        self.assertLess(len(merged), len(lines))
        self.assertGreaterEqual(len(merged), 3)

    def test_local_reach_clipping(self):
        line = [[-6.60, 53.60], [-6.58, 53.60], [-6.56, 53.60], [-6.54, 53.60]]
        clipped = clip_local_reach((-6.565, 53.6002), [line], radius_m=1800, max_match_distance_m=500)
        self.assertIsNotNone(clipped)
        self.assertGreaterEqual(len(clipped), 2)

    def test_build_payload_joins_q_records_to_current_waterbody_geometry(self):
        historic = [{
            "type": "Feature",
            "geometry": {"type": "MultiPoint", "coordinates": [[-6.56, 53.60]]},
            "properties": {
                "StationID": "RS10G010200",
                "StationName": "Test station",
                "EntityName": "Test River",
                "WBWFDWISECODE": "IE_EA_TEST_001",
                "QV18": "3-4",
                "QV20": "4",
            },
        }]
        recent = [{
            "type": "Feature",
            "geometry": {"type": "MultiPoint", "coordinates": [[-6.56, 53.60]]},
            "properties": {
                "StationCode": "RS10G010200",
                "StationName": "Test station",
                "RiverWaterbodyName": "TEST RIVER_010",
                "WBWFDWISECODE": "IE_EA_TEST_001",
                "Year": 2025,
                "QValueScore": "3",
            },
        }]
        rivers = [{
            "type": "Feature",
            "geometry": {"type": "MultiLineString", "coordinates": [[[-6.60, 53.60], [-6.56, 53.60], [-6.52, 53.60]]]},
            "properties": {"EU_CD": "IE_EA_TEST_001", "NAME": "TEST RIVER_010"},
        }]
        payload = build_payload(historic, recent, rivers)
        self.assertTrue(payload["meta"]["official"])
        self.assertEqual(payload["meta"]["minYear"], 2018)
        self.assertEqual(payload["meta"]["maxYear"], 2025)
        self.assertEqual(len(payload["events"]), 3)
        self.assertEqual(len(payload["reaches"]), 1)
        self.assertEqual(payload["events"][0]["reachId"], "RS10G010200")
        self.assertEqual(payload["events"][-1]["status"], "Poor")


if __name__ == "__main__":
    unittest.main()
