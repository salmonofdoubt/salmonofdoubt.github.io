from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters.epa_official_chemistry import SOURCE_ID, harvest_official_chemistry


SOURCE_DEFS = {
    SOURCE_ID: {
        "name": "EPA/Catchments official chemistry values",
        "freshness_class": "official_historic",
        "licence": "CC BY 4.0",
        "caveat": "Official chemistry values.",
    }
}


class OfficialChemistryAdapterTests(unittest.TestCase):
    def test_harvest_official_chemistry_csv_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "broadmeadow_chemistry.csv"
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=[
                        "sample_date",
                        "station_code",
                        "station_name",
                        "waterbody_code",
                        "waterbody_name",
                        "determinand",
                        "result",
                        "unit",
                    ],
                )
                writer.writeheader()
                writer.writerow({
                    "sample_date": "2023-07-18",
                    "station_code": "TW09001008BM1005",
                    "station_name": "BM160 - North End of Causeway",
                    "waterbody_code": "IE_EA_060_0100",
                    "waterbody_name": "Broadmeadow Water",
                    "determinand": "Orthophosphate as P",
                    "result": "0.041",
                    "unit": "mg/l",
                })

            context_records = [
                {
                    "source": "epa_official_wq",
                    "type": "official_wq_station",
                    "lat": 53.4665,
                    "lon": -6.1579,
                    "focus_area_ids": ["baldoyle_howth_malahide"],
                    "parameters": [
                        {"key": "station_code", "value": "TW09001008BM1005"},
                        {"key": "station_name", "value": "BM160 - North End of Causeway"},
                        {"key": "waterbody_code", "value": "IE_EA_060_0100"},
                        {"key": "waterbody_name", "value": "Broadmeadow Water"},
                    ],
                }
            ]

            records, source = harvest_official_chemistry(
                "2026-06-30T14:00:00Z",
                context_records,
                source_defs=SOURCE_DEFS,
                directory=Path(tmp),
            )

        self.assertEqual(source["id"], SOURCE_ID)
        self.assertEqual(source["status"], "ok")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["type"], "official_chemistry_result")
        self.assertEqual(records[0]["lat"], 53.4665)
        self.assertEqual(records[0]["parameters"][0]["label"], "Orthophosphate as P")
        self.assertEqual(records[0]["parameters"][0]["value"], 0.041)
        self.assertEqual(records[0]["parameters"][0]["unit"], "mg/l")


if __name__ == "__main__":
    unittest.main()
