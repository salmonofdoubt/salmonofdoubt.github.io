from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

import harvest_wq


class FocusPlaceRecordTests(unittest.TestCase):
    def test_focus_place_records_include_named_local_markers(self):
        records, source = harvest_wq.build_focus_place_records("2026-06-30T12:00:00Z")

        names = {record["name"] for record in records}

        self.assertEqual(source["id"], "local_focus_places")
        self.assertEqual(source["status"], "ok")
        self.assertIn("Baldoyle", names)
        self.assertIn("Howth", names)
        self.assertIn("Portmarnock", names)
        self.assertIn("Malahide", names)

        howth = next(record for record in records if record["name"] == "Howth")
        self.assertEqual(howth["type"], "focus_place")
        self.assertEqual(howth["source"], "local_focus_places")
        self.assertIn("baldoyle_howth_malahide", howth["focus_area_ids"])
        self.assertIn("Not a monitoring measurement", [parameter["value"] for parameter in howth["parameters"]])


if __name__ == "__main__":
    unittest.main()
