from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters import epa_wfd
from wq_pipeline.core.http import FetchError, FetchResult


SOURCE_DEFS = {
    "epa_wfd": {
        "name": "EPA WFD Open Data context",
        "freshness_class": "context",
        "licence": "CC BY 4.0",
        "caveat": "WFD data describe catchment and waterbody status/context, not live water chemistry.",
    }
}


class EpaWfdAdapterTests(unittest.TestCase):
    def setUp(self):
        self.original_fetch_json = epa_wfd.fetch_json

    def tearDown(self):
        epa_wfd.fetch_json = self.original_fetch_json

    def test_builds_deduped_wfd_records(self):
        items_by_keyword = [
            ("baldoyle", [
                {
                    "code": "IE_EA_090_0100",
                    "name": "Baldoyle Bay",
                    "lat": "53.397",
                    "lon": "-6.126",
                    "status": "At risk",
                    "waterbody_type": "Transitional waterbody",
                    "cycle": "2016-2021",
                },
                {
                    "code": "IE_EA_090_0100",
                    "name": "Baldoyle Bay duplicate",
                    "lat": "53.397",
                    "lon": "-6.126",
                },
            ]),
            ("sutton", [
                {
                    "waterbody_code": "IE_EA_090_0200",
                    "waterbody_name": "Sutton Creek",
                    "latitude": "53.389",
                    "longitude": "-6.110",
                    "risk": "Review",
                    "catchment_name": "Dublin Bay",
                    "year": "2021",
                }
            ]),
        ]

        records = epa_wfd.build_wfd_records(
            items_by_keyword,
            now="2026-06-29T12:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 2)

        first = records[0]
        self.assertEqual(first["id"], "wfd:IE_EA_090_0100")
        self.assertEqual(first["source"], "epa_wfd")
        self.assertEqual(first["type"], "wfd_context")
        self.assertEqual(first["lat"], 53.397)
        self.assertEqual(first["lon"], -6.126)
        self.assertEqual(first["status"], "At risk")
        self.assertEqual(first["description"], "Transitional waterbody")

        second = records[1]
        self.assertEqual(second["id"], "wfd:IE_EA_090_0200")
        self.assertEqual(second["name"], "Sutton Creek")
        self.assertEqual(second["status"], "Review")
        self.assertEqual(second["description"], "Dublin Bay")

    def test_harvest_wfd_reports_partial_on_one_keyword_failure(self):
        def fake_fetch_json(url, timeout=8):
            if "baldoyle" in url:
                return FetchResult(
                    url=url,
                    payload={"results": [{
                        "code": "IE_EA_090_0100",
                        "name": "Baldoyle Bay",
                        "lat": "53.397",
                        "lon": "-6.126",
                    }]},
                    elapsed_ms=25,
                    status_code=200,
                )

            raise FetchError(url, "simulated WFD failure", elapsed_ms=40)

        epa_wfd.fetch_json = fake_fetch_json

        records, status = epa_wfd.harvest_wfd(
            "2026-06-29T12:00:00Z",
            ["baldoyle", "broken"],
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(status["id"], "epa_wfd")
        self.assertEqual(status["status"], "partial")
        self.assertEqual(status["records"], 1)
        self.assertEqual(status["elapsed_ms"], 25)
        self.assertIn("simulated WFD failure", status["error"])

    def test_harvest_wfd_ok_when_all_keywords_fetch(self):
        def fake_fetch_json(url, timeout=8):
            return FetchResult(
                url=url,
                payload={"data": []},
                elapsed_ms=10,
                status_code=200,
            )

        epa_wfd.fetch_json = fake_fetch_json

        records, status = epa_wfd.harvest_wfd(
            "2026-06-29T12:00:00Z",
            ["baldoyle", "sutton"],
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(records, [])
        self.assertEqual(status["status"], "ok")
        self.assertEqual(status["records"], 0)
        self.assertEqual(status["elapsed_ms"], 20)


if __name__ == "__main__":
    unittest.main()
