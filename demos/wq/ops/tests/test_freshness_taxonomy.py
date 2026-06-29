from __future__ import annotations

import sys
import unittest
from pathlib import Path

OPS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS_DIR))

import harvest_wq
from wq_pipeline.core.freshness import enrich_source_status, normalise_freshness_class


class FreshnessTaxonomyTests(unittest.TestCase):
    def test_wfd_is_context_not_live(self):
        enriched = enrich_source_status("epa_wfd", {"name": "EPA WFD"})

        self.assertEqual(enriched["freshness_class"], "context")
        self.assertEqual(enriched["signal_layer"], "wfd_context")
        self.assertFalse(enriched["is_live_signal"])
        self.assertIn("not real-time", enriched["display_hint"])

    def test_opw_is_live_signal(self):
        enriched = enrich_source_status("opw_waterlevel", {"name": "OPW"})

        self.assertEqual(enriched["freshness_class"], "live")
        self.assertEqual(enriched["signal_layer"], "live_signal")
        self.assertTrue(enriched["is_live_signal"])

    def test_current_maps_to_near_live(self):
        self.assertEqual(normalise_freshness_class("current"), "near_live")

    def test_custom_output_keeps_source_status_next_to_custom_output(self):
        custom = Path("/tmp/wq-custom-latest.json")
        self.assertEqual(
            harvest_wq.source_status_output_path(custom),
            Path("/tmp/wq-custom-latest-source-status.json"),
        )

    def test_default_output_uses_repo_source_status(self):
        self.assertEqual(
            harvest_wq.source_status_output_path(harvest_wq.DATA_DIR / "latest.json"),
            harvest_wq.DATA_DIR / "source-status.json",
        )


if __name__ == "__main__":
    unittest.main()
