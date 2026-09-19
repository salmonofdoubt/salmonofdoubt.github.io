from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEMO = ROOT / "demos" / "dark-rivers"
INDEX = (DEMO / "index.html").read_text(encoding="utf-8")

BUILD_MATCH = re.search(r'data-dark-rivers-version="([^"]+)"', INDEX)
if not BUILD_MATCH:
    raise RuntimeError("Dark Rivers build fingerprint missing from index.html")
BUILD = BUILD_MATCH.group(1)

APP = (DEMO / f"app.{BUILD}.js").read_text(encoding="utf-8")
CSS = (DEMO / f"styles.{BUILD}.css").read_text(encoding="utf-8")
SW = (DEMO / f"service-worker.{BUILD}.js").read_text(encoding="utf-8")


class DarkRiversProductionContractTests(unittest.TestCase):
    def test_fingerprinted_assets_are_loaded_without_query_versioning(self):
        for asset in (
            f"styles.{BUILD}.css",
            f"app.{BUILD}.js",
            f"data.{BUILD}.js",
            f"site-config.{BUILD}.js",
        ):
            self.assertIn(asset, INDEX)
        self.assertNotIn("styles.css?v=", INDEX)
        self.assertNotIn("app.js?v=", INDEX)
        self.assertNotIn("data.js?v=", INDEX)

    def test_static_first_paint_contains_all_fallback_reaches(self):
        paths = re.findall(r'<path class="river-reach"[^>]+data-reach-id="([^"]+)"', INDEX)
        self.assertEqual(len(paths), 15)
        self.assertEqual(len(set(paths)), 15)
        self.assertIn('data-reach-id="r02" data-rendered="observed"', INDEX)
        self.assertIn("1 / 15", INDEX)

    def test_renderer_exposes_browser_verified_health_state(self):
        for token in (
            "dataset.darkRiversVersion=BUILD",
            'dataset.darkRiversRender=pass?"pass":"fail"',
            "dataset.darkRiversVisible=String(visiblyColoured.length)",
            "getComputedStyle(path)",
            'new URLSearchParams(location.search).has("smoke")',
        ):
            self.assertIn(token, APP)

    def test_renderer_supports_compact_official_data(self):
        for token in (
            'dark-rivers-compact-v1',
            "normalizeOfficial",
            "networkPath",
            "stationLon",
            "stationLat",
        ):
            self.assertIn(token, APP)

    def test_base_css_cannot_override_dynamic_reach_visuals(self):
        match = re.search(r"\.river-reach\{([^}]*)\}", CSS)
        self.assertIsNotNone(match)
        block = match.group(1)
        for forbidden in ("stroke:", "stroke-width:", "opacity:", "fill:"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, block)

    def test_connected_system_selection_uses_lazy_single_path(self):
        self.assertIn('systems:$("riverSystems")', APP)
        self.assertIn('fetch("./data/systems.json",{cache:"no-store"})', APP)
        self.assertIn('els.systems.replaceChildren(path)', APP)
        self.assertIn('for(const layer of [els.base,els.systems,els.network,els.flashes])', APP)
        self.assertIn('<g id="riverSystems" aria-hidden="true"></g>', INDEX)
        self.assertIn('.river-system{', CSS)

    def test_recorded_colour_persists_and_flashes_are_staggered(self):
        self.assertIn("const opacity=selected?1:.88;", APP)
        self.assertNotIn("opacityMap={fresh:", APP)
        self.assertIn('scheduleFlashes(batch,690)', APP)
        self.assertIn('choosePulseEvents(events,6)', APP)
        self.assertIn('const beatMs=790;', APP)
        self.assertIn("historical evidence, not a measurement", APP)
        self.assertNotIn("filter:drop-shadow", CSS.split(".river-reach{", 1)[1].split("}", 1)[0])
        self.assertIn("flashes show up to six real observations", INDEX)

    def test_map_navigation_uses_fixed_hud_real_coastline_and_responsive_zoom(self):
        self.assertIn('id="irelandCoastline"', INDEX)
        self.assertIn('id="mapWorld"', INDEX)
        self.assertIn('class="map-hud"', INDEX)
        self.assertIn('mapViewportHeight=Math.max(720', APP)
        self.assertIn('const INITIAL_MAP_ZOOM=1.05,MIN_MAP_ZOOM=.72,MAX_MAP_ZOOM=12;', APP)
        self.assertIn('point.matrixTransform(matrix.inverse())', APP)
        self.assertIn('els.world.setAttribute("transform",transform);', APP)
        self.assertIn('.map-shell.is-zoomed .sea-label{opacity:0}', CSS)
        self.assertNotIn('class="map-annotation"', INDEX)
        self.assertIn('Natural Earth 1:50m', INDEX)

    def test_service_worker_matches_build_and_purges_old_caches(self):
        cache_suffix = BUILD.split("-")[-1]
        self.assertIn(f"salmon-dark-rivers-v{cache_suffix}", SW)
        self.assertIn('key.startsWith("salmon-dark-rivers-")', SW)
        self.assertIn("self.skipWaiting()", SW)
        self.assertIn("self.clients.claim()", SW)

    def test_no_literal_escaped_newlines_in_css(self):
        self.assertNotIn(r"\n", CSS)


if __name__ == "__main__":
    unittest.main()
