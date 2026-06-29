from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from harvest_wq import (
    normalise_payload_records,
    normalise_payload_sources,
    previous_record_generated_at,
    previous_record_order,
    previous_source_order,
    refresh_payload_summary,
)


class PayloadStabilityTests(unittest.TestCase):
    def test_records_preserve_previous_order_and_generated_at(self):
        previous = {
            "records": [
                {"id": "opw:2", "generated_at": "first-seen-2"},
                {"id": "opw:1", "generated_at": "first-seen-1"},
            ]
        }

        records = [
            {
                "id": "opw:1",
                "source": "opw_waterlevel",
                "type": "water_level",
                "observed_at": "2026-06-29T12:00:00Z",
                "generated_at": "new-run",
                "name": "Station 1",
            },
            {
                "id": "opw:3",
                "source": "opw_waterlevel",
                "type": "water_level",
                "observed_at": "2026-06-29T12:05:00Z",
                "generated_at": "new-run",
                "name": "Station 3",
            },
            {
                "id": "opw:2",
                "source": "opw_waterlevel",
                "type": "water_level",
                "observed_at": "2026-06-29T12:10:00Z",
                "generated_at": "new-run",
                "name": "Station 2",
            },
        ]

        normalised = normalise_payload_records(
            records,
            generated_at_cache=previous_record_generated_at(previous),
            order_cache=previous_record_order(previous),
        )

        self.assertEqual([record["id"] for record in normalised], ["opw:2", "opw:1", "opw:3"])
        self.assertEqual(normalised[0]["generated_at"], "first-seen-2")
        self.assertEqual(normalised[1]["generated_at"], "first-seen-1")
        self.assertEqual(normalised[2]["generated_at"], "2026-06-29T12:05:00Z")

    def test_sources_preserve_previous_order(self):
        previous = {
            "sources": [
                {"id": "epa_wfd"},
                {"id": "opw_waterlevel"},
            ]
        }

        sources = [
            {"id": "opw_waterlevel", "freshness_sort": 10},
            {"id": "marine_institute_weather_buoys", "freshness_sort": 20},
            {"id": "epa_wfd", "freshness_sort": 60},
        ]

        normalised = normalise_payload_sources(
            sources,
            order_cache=previous_source_order(previous),
        )

        self.assertEqual(
            [source["id"] for source in normalised],
            ["epa_wfd", "opw_waterlevel", "marine_institute_weather_buoys"],
        )

    def test_refresh_payload_summary_recounts_after_normalisation(self):
        payload = {
            "summary": {"records": 0, "mapped_records": 0},
            "records": [
                {"id": "a", "lat": 53.0, "lon": -6.0},
                {"id": "b", "lat": None, "lon": None},
            ],
        }

        refresh_payload_summary(payload)

        self.assertEqual(payload["summary"]["records"], 2)
        self.assertEqual(payload["summary"]["mapped_records"], 1)


if __name__ == "__main__":
    unittest.main()
