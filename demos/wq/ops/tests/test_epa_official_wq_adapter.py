from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters.epa_official_wq import (
    SOURCE_ID,
    build_waterbody_record,
    harvest_official_wq,
)
from wq_pipeline.core.http import FetchResult


SOURCE_DEFS = {
    SOURCE_ID: {
        "name": "EPA official WFD water-quality records",
        "freshness_class": "official_historic",
        "licence": "CC BY 4.0",
        "caveat": "Official WFD waterbody and monitoring-programme records.",
    }
}


class OfficialWqAdapterTests(unittest.TestCase):
    def test_build_waterbody_record_from_subcatchment_item(self):
        record = build_waterbody_record(
            {
                "Name": "BROADMEADOW_010",
                "Code": "IE_EA_08B020400",
                "Type": "River",
                "Status": "Poor",
                "Easting": 303865.31,
                "Northing": 251755.51,
                "GeometryExtent": "301936,251191,305940,252670",
            },
            focus={
                "catchment": "08",
                "subcatchment": "08_3",
                "label": "Broadmeadow_SC_010",
                "focus_area_ids": ["baldoyle_howth_malahide"],
            },
            now="2026-06-30T12:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(record["source"], SOURCE_ID)
        self.assertEqual(record["type"], "official_wq_waterbody")
        self.assertEqual(record["status"], "Poor")
        self.assertEqual(record["focus_area_ids"], ["baldoyle_howth_malahide"])
        self.assertIsNotNone(record["lat"])
        self.assertIsNotNone(record["lon"])

    def test_harvest_official_wq_with_fake_fetcher(self):
        def fake_fetcher(url, timeout=8):
            if "/subcatchment/" in url:
                return FetchResult(
                    url=url,
                    elapsed_ms=4,
                    status_code=200,
                    payload={
                        "Waterbodies": [
                            {
                                "Name": "BROADMEADOW_010",
                                "Code": "IE_EA_08B020400",
                                "Type": "River",
                                "Status": "Poor",
                                "Easting": 303865.31,
                                "Northing": 251755.51,
                            }
                        ]
                    },
                )

            if "/iterations/" in url:
                return FetchResult(url=url, elapsed_ms=4, status_code=200, payload=["IEMP2019-2021"])

            if "/stationdetails/" in url:
                return FetchResult(url=url, elapsed_ms=4, status_code=200, payload=[])

            raise AssertionError(url)

        records, source = harvest_official_wq(
            "2026-06-30T12:00:00Z",
            [],
            source_defs=SOURCE_DEFS,
            fetcher=fake_fetcher,
        )

        self.assertEqual(source["id"], SOURCE_ID)
        self.assertEqual(source["status"], "ok")
        self.assertGreaterEqual(len(records), 1)
        self.assertTrue(all(record["type"] == "official_wq_waterbody" for record in records))


if __name__ == "__main__":
    unittest.main()
