from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.core.http import FetchResult
from wq_pipeline.adapters.marine_erddap import (
    SOURCE_ID,
    build_marine_weather_records,
    erddap_iwb_url,
    erddap_rows,
    harvest_marine_weather_buoys,
    latest_by_station,
)


SOURCE_DEFS = {
    SOURCE_ID: {
        "name": "Marine Institute Irish Weather Buoy Network",
        "freshness_class": "near_live",
        "licence": "check source dataset",
        "caveat": "Near-real-time met-ocean observations.",
    }
}


def table_payload(rows):
    return {
        "table": {
            "columnNames": [
                "station_id",
                "CallSign",
                "longitude",
                "latitude",
                "time",
                "AtmosphericPressure",
                "WindSpeed",
                "WaveHeight",
                "AirTemperature",
                "SeaTemperature",
                "salinity",
                "QC_Flag",
            ],
            "rows": rows,
        }
    }


class MarineErddapAdapterTests(unittest.TestCase):
    def test_erddap_url_requests_recent_iwb_json(self):
        url = erddap_iwb_url(days_back=2, now="2026-06-29T12:00:00Z")

        self.assertIn("IWBNetwork.json", url)
        self.assertIn("station_id", url)
        self.assertIn("SeaTemperature", url)
        self.assertIn("time%3E=2026-06-27T12:00:00Z", url)
        self.assertNotIn("orderByMax", url)

    def test_erddap_rows_maps_columns(self):
        rows = erddap_rows(table_payload([
            ["M2", "62092", -5.4, 53.4, "2026-06-29T12:00:00Z", 1012, 10, 1.2, 15, 13, 34.5, "good"]
        ]))

        self.assertEqual(rows[0]["station_id"], "M2")
        self.assertEqual(rows[0]["SeaTemperature"], 13)

    def test_latest_by_station_keeps_newest_observation(self):
        rows = erddap_rows(table_payload([
            ["M2", "62092", -5.4, 53.4, "2026-06-29T10:00:00Z", 1011, 8, 1.1, 14, 12.9, 34.2, "old"],
            ["M2", "62092", -5.4, 53.4, "2026-06-29T12:00:00Z", 1012, 10, 1.2, 15, 13.1, 34.5, "new"],
            ["M3", "62093", -10.5, 51.2, "2026-06-29T11:00:00Z", 1010, 12, 1.8, 16, 14.2, 35.0, "ok"],
        ]))

        latest = latest_by_station(rows)

        self.assertEqual(len(latest), 2)
        self.assertEqual(next(row for row in latest if row["station_id"] == "M2")["QC_Flag"], "new")

    def test_build_records_uses_latest_and_omits_missing_values(self):
        rows = erddap_rows(table_payload([
            ["M2", "62092", -5.4, 53.4, "2026-06-29T10:00:00Z", 1011, -999, 1.1, 14, 12.9, 34.2, "old"],
            ["M2", "62092", -5.4, 53.4, "2026-06-29T12:00:00Z", 1012, -999, 1.2, 15, 13.1, 34.5, "new"],
        ]))

        records = build_marine_weather_records(rows, now="2026-06-29T12:30:00Z", source_defs=SOURCE_DEFS)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["source"], SOURCE_ID)
        self.assertEqual(records[0]["type"], "marine_observation")
        self.assertEqual(records[0]["freshness"], "near_live")
        self.assertEqual(records[0]["observed_at"], "2026-06-29T12:00:00Z")
        self.assertNotIn("wind_speed", [param["key"] for param in records[0]["parameters"]])
        self.assertIn("sea_temperature", [param["key"] for param in records[0]["parameters"]])

    def test_harvest_with_fake_fetcher_returns_status(self):
        def fake_fetcher(url, timeout=12):
            return FetchResult(
                url=url,
                elapsed_ms=12,
                status_code=200,
                payload=table_payload([
                    ["M2", "62092", -5.4, 53.4, "2026-06-29T12:00:00Z", 1012, 10, 1.2, 15, 13.1, 34.5, "ok"]
                ]),
            )

        records, source = harvest_marine_weather_buoys(
            "2026-06-29T12:30:00Z",
            source_defs=SOURCE_DEFS,
            fetcher=fake_fetcher,
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(source["id"], SOURCE_ID)
        self.assertEqual(source["status"], "ok")
        self.assertEqual(source["records"], 1)
        self.assertTrue(source["is_live_signal"])


if __name__ == "__main__":
    unittest.main()
