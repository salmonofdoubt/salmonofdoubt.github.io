from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters import opw_waterlevel
from wq_pipeline.core.http import FetchError


SOURCE_DEFS = {
    "opw_waterlevel": {
        "name": "OPW waterlevel.ie latest readings",
        "freshness_class": "live",
        "licence": "CC BY 4.0",
        "caveat": "Latest hydrometric readings are provisional.",
    }
}


class OpwWaterlevelAdapterTests(unittest.TestCase):
    def test_build_records_from_geojson_feature(self):
        features = [{
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": ["-6.2001", "53.4002"],
            },
            "properties": {
                "station_name": "Test Station",
                "station_ref": "12345",
                "sensor_ref": "A",
                "datetime": "2026-06-28T12:00:00Z",
                "waterlevel": "1.23",
                "flow": "4.56",
                "battery": "12.1",
                "status": "latest",
            },
        }]

        records = opw_waterlevel.build_opw_records(
            features,
            now="2026-06-28T12:05:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 1)

        record = records[0]
        self.assertEqual(record["id"], "opw:12345:A")
        self.assertEqual(record["source"], "opw_waterlevel")
        self.assertEqual(record["source_label"], "OPW waterlevel.ie latest readings")
        self.assertEqual(record["type"], "water_level")
        self.assertEqual(record["lat"], 53.4002)
        self.assertEqual(record["lon"], -6.2001)
        self.assertEqual(record["observed_at"], "2026-06-28T12:00:00Z")
        self.assertEqual(record["status"], "latest")

        units = {param["key"]: param["unit"] for param in record["parameters"]}
        self.assertEqual(units["waterlevel"], "m")
        self.assertEqual(units["flow"], "m³/s")
        self.assertEqual(units["battery"], "V")

    def test_invalid_features_are_skipped(self):
        features = [
            {"geometry": {"coordinates": []}, "properties": {"station_name": "Broken"}},
            {"geometry": {"coordinates": ["not-a-number", "53.4"]}, "properties": {}},
            "not a feature",
        ]

        records = opw_waterlevel.build_opw_records(
            features,
            now="2026-06-28T12:05:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(records, [])

    def test_fetch_failure_returns_failed_source_status(self):
        original_fetch_json = opw_waterlevel.fetch_json

        def failing_fetch_json(url, timeout=8):
            raise FetchError(url, "simulated failure", elapsed_ms=123)

        opw_waterlevel.fetch_json = failing_fetch_json

        try:
            records, status = opw_waterlevel.harvest_opw(
                "2026-06-28T12:05:00Z",
                source_defs=SOURCE_DEFS,
            )
        finally:
            opw_waterlevel.fetch_json = original_fetch_json

        self.assertEqual(records, [])
        self.assertEqual(status["id"], "opw_waterlevel")
        self.assertEqual(status["status"], "failed")
        self.assertEqual(status["records"], 0)
        self.assertEqual(status["elapsed_ms"], 123)
        self.assertIn("simulated failure", status["error"])


if __name__ == "__main__":
    unittest.main()
