from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.core.payload import payload_health


def payload(opw_status="ok", opw_records=2000, include_opw=True, total_records=2002, source_count=7):
    source_ids = [
        "opw_waterlevel",
        "epa_bathing_locations",
        "epa_bathing_measurements",
        "epa_bathing_alerts",
        "epa_wfd",
        "epa_geoportal_context",
        "marine_institute_weather_buoys",
    ][:source_count]

    sources = []

    for source_id in source_ids:
        if source_id == "opw_waterlevel" and not include_opw:
            continue

        sources.append({
            "id": source_id,
            "status": opw_status if source_id == "opw_waterlevel" else "ok",
            "records": opw_records if source_id == "opw_waterlevel" else 0,
        })

    records = []

    if include_opw:
        records.extend({"source": "opw_waterlevel"} for _ in range(opw_records))

    while len(records) < total_records:
        records.append({"source": "epa_geoportal_context"})

    return {
        "sources": sources,
        "records": records,
    }


class PayloadHealthTests(unittest.TestCase):
    def test_healthy_payload_passes(self):
        health = payload_health(payload())

        self.assertTrue(health["ok"])
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["record_count"], 2002)
        self.assertEqual(health["records_by_source"]["opw_waterlevel"], 2000)

    def test_missing_opw_fails(self):
        health = payload_health(payload(include_opw=False, opw_records=0, total_records=2002))

        self.assertFalse(health["ok"])
        self.assertEqual(health["status"], "rejected")
        self.assertTrue(any("OPW" in issue or "opw_waterlevel" in issue for issue in health["issues"]))

    def test_low_opw_record_count_fails(self):
        health = payload_health(payload(opw_records=10, total_records=2002))

        self.assertFalse(health["ok"])
        self.assertTrue(any("OPW" in issue for issue in health["issues"]))

    def test_failed_opw_status_fails(self):
        health = payload_health(payload(opw_status="failed", opw_records=2000))

        self.assertFalse(health["ok"])
        self.assertTrue(any("not 'ok'" in issue for issue in health["issues"]))

    def test_incomplete_source_count_fails(self):
        health = payload_health(payload(source_count=3))

        self.assertFalse(health["ok"])
        self.assertTrue(any("source count" in issue for issue in health["issues"]))


if __name__ == "__main__":
    unittest.main()
