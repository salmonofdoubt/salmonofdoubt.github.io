from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CSS = ROOT / "demos" / "dark-rivers" / "styles.css"
HTML = ROOT / "demos" / "dark-rivers" / "index.html"


class DarkRiversAssetIntegrityTests(unittest.TestCase):
    def test_css_has_no_literal_escaped_newlines(self):
        text = CSS.read_text(encoding="utf-8")
        self.assertNotIn(r"\n", text)

    def test_required_river_selectors_exist(self):
        text = CSS.read_text(encoding="utf-8")
        for selector in (
            ".river-base",
            ".river-reach",
            '.river-reach[data-status="High"]',
            '.river-reach[data-status="Good"]',
            '.river-reach[data-status="Moderate"]',
            '.river-reach[data-status="Poor"]',
            '.river-reach[data-status="Bad"]',
        ):
            with self.subTest(selector=selector):
                self.assertIn(selector, text)

    def test_html_loads_current_versioned_assets(self):
        text = HTML.read_text(encoding="utf-8")
        self.assertIn("./styles.css?v=20260918-4", text)
        self.assertIn("./app.js?v=20260918-4", text)
        self.assertIn("./data.js?v=20260918-4", text)


if __name__ == "__main__":
    unittest.main()
