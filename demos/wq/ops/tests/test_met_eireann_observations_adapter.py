from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.core.http import FetchResult
from wq_pipeline.adapters.met_eireann_observations import (
    SOURCE_ID,
    build_met_eireann_records,
    harvest_met_eireann_observations,
    latest_row,
    observation_url,
    parse_observed_at,
    rainfall_status,
)


SOURCE_DEFS = {
    SOURCE_ID: {
        "name": "Met Éireann current station observations",
        "freshness_class": "near_live",
        "licence": "check source terms",
        "caveat": "Current station rainfall/weather observations are event-driver context.",
    }
}


class MetEireannObservationAdapterTests(unittest.TestCase):
    def test_observation_url(self):
        self.assertEqual(
            observation_url("dublin-airport"),
            "https://prodapi.metweb.ie/observations/dublin-airport/today",
        )

    def test_latest_row_accepts_list_payload(self):
        row = latest_row([
            {"reportTime": "10:00", "rainfall": "0.0"},
            {"reportTime": "11:00", "rainfall": "2.1"},
        ])

        self.assertEqual(row["reportTime"], "11:00")

    def test_parse_observed_at(self):
        observed = parse_observed_at(
            {"date": "29-06-2026", "reportTime": "16:00"},
            "2026-06-29T17:00:00Z",
        )

        self.assertEqual(observed, "2026-06-29T16:00:00Z")

    def test_rainfall_status_classes(self):
        self.assertEqual(rainfall_status(None), "observation")
        self.assertEqual(rainfall_status(0.0), "dry")
        self.assertEqual(rainfall_status(0.3), "light rainfall")
        self.assertEqual(rainfall_status(2.0), "rainfall trigger")
        self.assertEqual(rainfall_status(5.0), "heavy rainfall trigger")

    def test_build_records(self):
        station_payloads = [
            (
                {"slug": "dublin-airport", "name": "Dublin Airport", "lat": 53.428, "lon": -6.241},
                [
                    {
                        "date": "29-06-2026",
                        "reportTime": "16:00",
                        "rainfall": "2.4",
                        "temperature": "14.5",
                        "humidity": "81",
                        "pressure": "1008",
                        "weatherDescription": "Rain",
                    }
                ],
            )
        ]

        records = build_met_eireann_records(
            station_payloads,
            now="2026-06-29T17:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["source"], SOURCE_ID)
        self.assertEqual(records[0]["type"], "rainfall_observation")
        self.assertEqual(records[0]["freshness"], "near_live")
        self.assertEqual(records[0]["status"], "rainfall trigger")
        self.assertEqual(records[0]["observed_at"], "2026-06-29T16:00:00Z")
        self.assertIn("rainfall", [parameter["key"] for parameter in records[0]["parameters"]])

    def test_harvest_with_fake_fetcher(self):
        def fake_fetcher(url, timeout=8):
            return FetchResult(
                url=url,
                elapsed_ms=8,
                status_code=200,
                payload=[
                    {
                        "date": "29-06-2026",
                        "reportTime": "16:00",
                        "rainfall": "0.4",
                        "temperature": "15.1",
                    }
                ],
            )

        records, source = harvest_met_eireann_observations(
            "2026-06-29T17:00:00Z",
            source_defs=SOURCE_DEFS,
            fetcher=fake_fetcher,
            stations=[
                {"slug": "dublin-airport", "name": "Dublin Airport", "lat": 53.428, "lon": -6.241}
            ],
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(source["id"], SOURCE_ID)
        self.assertEqual(source["status"], "ok")
        self.assertEqual(source["records"], 1)
        self.assertTrue(source["is_live_signal"])


if __name__ == "__main__":
    unittest.main()
