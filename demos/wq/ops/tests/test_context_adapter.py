from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

from wq_pipeline.adapters.context import planned_context_records


SOURCE_DEFS = {
    "epa_geoportal_context": {
        "name": "EPA Geoportal water quality datasets",
        "freshness_class": "historical",
        "licence": "CC BY 4.0",
        "caveat": "Groundwater, coastal, transitional and Q-value datasets are planned historical/context joins.",
    },
}


class ContextAdapterTests(unittest.TestCase):
    def test_planned_context_records_and_statuses(self):
        records, sources = planned_context_records(
            "2026-06-29T12:00:00Z",
            source_defs=SOURCE_DEFS,
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(len(sources), 1)

        self.assertEqual(
            {record["source"] for record in records},
            {"epa_geoportal_context"},
        )

        by_id = {source["id"]: source for source in sources}

        self.assertEqual(by_id["epa_geoportal_context"]["status"], "planned")
        self.assertEqual(by_id["epa_geoportal_context"]["records"], 1)


if __name__ == "__main__":
    unittest.main()
