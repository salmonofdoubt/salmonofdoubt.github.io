from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(OPS_DIR))

from build_dark_rivers import build_payload, clip_local_reach, normalize_q_value, parse_year, q_status


class DarkRiversBuilderTests(unittest.TestCase):
    def test_q_normalisation_and_status(self):
        cases = {
            "Q5": ("Q5", "High"),
            "4-5": ("Q4-5", "High"),
            4: ("Q4", "Good"),
            3.5: ("Q3-4", "Moderate"),
            "Q3": ("Q3", "Poor"),
            "2-3": ("Q2-3", "Poor"),
            2: ("Q2", "Bad"),
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

    def test_local_reach_clipping(self):
        line = [[-6.60, 53.60], [-6.58, 53.60], [-6.56, 53.60], [-6.54, 53.60]]
        clipped = clip_local_reach((-6.565, 53.6002), [line], radius_m=1800, max_match_distance_m=500)
        self.assertIsNotNone(clipped)
        self.assertGreaterEqual(len(clipped), 2)

    def test_build_payload_joins_station_waterbody_and_q(self):
        stations = [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-6.56, 53.60]},
            "properties": {
                "EPALink": "08N010100",
                "StationName": "Test station",
                "WBWFDWISECODE": "IE_EA_TEST_001",
                "EntityName": "Test River",
            },
        }]
        historic = [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-6.56, 53.60]},
            "properties": {"EPALink": "08N010100", "QValue": "Q3-4", "Year": 2018},
        }]
        latest = [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-6.56, 53.60]},
            "properties": {"EPALink": "08N010100", "QValue": "Q4", "Year": 2025},
        }]
        rivers = [{
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[-6.60, 53.60], [-6.56, 53.60], [-6.52, 53.60]]},
            "properties": {"EU_CD": "IE_EA_TEST_001"},
        }]
        payload = build_payload(stations, historic, latest, rivers)
        self.assertTrue(payload["meta"]["official"])
        self.assertEqual(payload["meta"]["minYear"], 2018)
        self.assertEqual(payload["meta"]["maxYear"], 2025)
        self.assertEqual(len(payload["events"]), 2)
        self.assertEqual(len(payload["reaches"]), 1)
        self.assertEqual(payload["events"][0]["reachId"], "08n010100")
        self.assertEqual(payload["events"][1]["status"], "Good")


if __name__ == "__main__":
    unittest.main()
