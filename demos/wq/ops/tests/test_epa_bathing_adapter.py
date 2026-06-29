from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters import epa_bathing


SOURCE_DEFS = {
    "epa_bathing_locations": {
        "name": "EPA Bathing Water locations",
        "freshness_class": "seasonal",
        "licence": "CC BY 4.0",
        "caveat": "Location and annual classification data are generally seasonal or annual.",
    },
    "epa_bathing_measurements": {
        "name": "EPA Bathing Water measurements",
        "freshness_class": "latest",
        "licence": "CC BY 4.0",
        "caveat": "Samples are latest official results, not continuous live sensors.",
    },
    "epa_bathing_alerts": {
        "name": "EPA Bathing Water alerts",
        "freshness_class": "current",
        "licence": "CC BY 4.0",
        "caveat": "Alerts are current API records reported by local authorities to EPA.",
    },
}


class EpaBathingAdapterTests(unittest.TestCase):
    def setUp(self):
        self.original_fetch = epa_bathing.fetch_paged_json

    def tearDown(self):
        epa_bathing.fetch_paged_json = self.original_fetch

    def test_builds_locations_measurements_and_alerts(self):
        def fake_fetch(base_url, **kwargs):
            if base_url.endswith("/locations"):
                return ([{
                    "location_id": "BAL",
                    "name": "Synthetic Beach",
                    "lat": "53.399",
                    "lon": "-6.126",
                    "classification": "Excellent",
                    "description": "Test bathing location",
                    "beach_profile_url": "https://example.test/location",
                }], None, [])

            if base_url.endswith("/measurements"):
                return ([{
                    "monitoring_result_id": "M1",
                    "location_id": "BAL",
                    "sample_date": "2026-06-28",
                    "e_coli": "12",
                    "intestinal_enterococci": "4",
                    "sample_water_quality_status": "good",
                }], None, [])

            if base_url.endswith("/alerts"):
                return ([{
                    "incident_id": "A1",
                    "location_id": "BAL",
                    "start_date": "2026-06-29",
                    "bathing_restriction_type": "advice",
                    "description": "Test alert",
                    "notice_url": "https://example.test/alert",
                }], None, [])

            return ([], "unexpected URL", [])

        epa_bathing.fetch_paged_json = fake_fetch

        records, sources = epa_bathing.harvest_bathing(
            "2026-06-28T12:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 3)
        self.assertEqual([source["status"] for source in sources], ["ok", "ok", "ok"])
        self.assertEqual([source["records"] for source in sources], [1, 1, 1])

        location = records[0]
        self.assertEqual(location["id"], "bw-location:BAL")
        self.assertEqual(location["source"], "epa_bathing_locations")
        self.assertEqual(location["lat"], 53.399)
        self.assertEqual(location["lon"], -6.126)
        self.assertEqual(location["parameters"][0]["key"], "annual_classification")

        measurement = records[1]
        self.assertEqual(measurement["id"], "bw-measurement:M1")
        self.assertEqual(measurement["source"], "epa_bathing_measurements")
        self.assertEqual(measurement["lat"], 53.399)
        self.assertEqual(measurement["lon"], -6.126)

        params = {param["key"]: param["value"] for param in measurement["parameters"]}
        self.assertEqual(params["e_coli"], 12.0)
        self.assertEqual(params["intestinal_enterococci"], 4.0)

        alert = records[2]
        self.assertEqual(alert["id"], "bw-alert:A1")
        self.assertEqual(alert["source"], "epa_bathing_alerts")
        self.assertEqual(alert["status"], "advice")

    def test_source_error_becomes_partial_without_crashing(self):
        def fake_fetch(base_url, **kwargs):
            if base_url.endswith("/locations"):
                return ([], None, [])

            if base_url.endswith("/measurements"):
                return ([], "simulated measurement failure", [])

            if base_url.endswith("/alerts"):
                return ([], None, [])

            return ([], "unexpected URL", [])

        epa_bathing.fetch_paged_json = fake_fetch

        records, sources = epa_bathing.harvest_bathing(
            "2026-06-28T12:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(records, [])

        by_id = {source["id"]: source for source in sources}
        self.assertEqual(by_id["epa_bathing_locations"]["status"], "ok")
        self.assertEqual(by_id["epa_bathing_measurements"]["status"], "partial")
        self.assertIn("simulated measurement failure", by_id["epa_bathing_measurements"]["error"])
        self.assertEqual(by_id["epa_bathing_alerts"]["status"], "ok")


if __name__ == "__main__":
    unittest.main()
