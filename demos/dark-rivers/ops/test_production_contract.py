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

def linked_asset(pattern: str) -> str:
    match = re.search(pattern, INDEX)
    if not match:
        raise RuntimeError(f"Dark Rivers asset reference missing: {pattern}")
    name = match.group(1)
    if not (DEMO / name).is_file():
        raise RuntimeError(f"Dark Rivers linked asset does not exist: {name}")
    return name


ASSETS = {
    "app": linked_asset(r'src="\./(app\.[^"/]+\.js)"'),
    "styles": linked_asset(r'href="\./(styles\.[^"/]+\.css)"'),
    "data": linked_asset(r'src="\./(data\.[^"/]+\.js)"'),
    "site-config": linked_asset(r'src="\./(site-config\.[^"/]+\.js)"'),
}
APP = (DEMO / ASSETS["app"]).read_text(encoding="utf-8")
CSS = (DEMO / ASSETS["styles"]).read_text(encoding="utf-8")
SW = (DEMO / f"service-worker.{BUILD}.js").read_text(encoding="utf-8")


class DarkRiversProductionContractTests(unittest.TestCase):
    def test_fingerprinted_assets_are_loaded_without_query_versioning(self):
        for asset in ASSETS.values():
            self.assertIn(asset, INDEX)
            self.assertTrue((DEMO / asset).is_file(), asset)
        self.assertEqual(ASSETS["app"], f"app.{BUILD}.js")
        self.assertIn(f'const BUILD="{BUILD}"', APP)
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
        self.assertIn('els.world.setAttribute("transform",transform);', APP)
        self.assertIn('<g id="riverSystems" aria-hidden="true"></g>', INDEX)
        self.assertIn('.river-system{', CSS)

    def test_recorded_colour_persists_and_flashes_are_staggered(self):
        self.assertIn("const opacity=selected?1:.88;", APP)
        self.assertNotIn("opacityMap={fresh:", APP)
        self.assertIn('scheduleFlashes(batch,matchMedia("(max-width:650px)").matches?420:690)', APP)
        self.assertIn('choosePulseEvents(events,6)', APP)
        self.assertIn('const beatMs=790;', APP)
        self.assertIn("historical evidence, not a measurement", APP)
        self.assertNotIn("filter:drop-shadow", CSS.split(".river-reach{", 1)[1].split("}", 1)[0])
        self.assertIn("Flashes show up to six real observations", INDEX)

    def test_map_navigation_uses_fixed_hud_real_coastline_and_responsive_zoom(self):
        self.assertIn('id="irelandCoastline"', INDEX)
        self.assertIn('id="mapWorld"', INDEX)
        self.assertIn('class="map-hud"', INDEX)
        self.assertIn('mapViewportHeight=Math.max(720', APP)
        zoom_match = re.search(r'const INITIAL_MAP_ZOOM=([0-9.]+),MIN_MAP_ZOOM=([0-9.]+),MAX_MAP_ZOOM=([0-9.]+);', APP)
        self.assertIsNotNone(zoom_match)
        initial, minimum, maximum = map(float, zoom_match.groups())
        self.assertLessEqual(minimum, initial)
        self.assertLessEqual(initial, maximum)
        self.assertEqual((minimum, maximum), (.72, 12.0))
        self.assertIn('point.matrixTransform(matrix.inverse())', APP)
        self.assertIn('els.world.setAttribute("transform",transform);', APP)
        self.assertIn('.map-shell.is-zoomed .sea-label{opacity:0}', CSS)
        self.assertNotIn('class="map-annotation"', INDEX)
        self.assertRegex(INDEX, r'Natural Earth 1:(?:10|50)m')
        # Map must not imply a complete island-wide river dataset with an island outline.
        self.assertIn(".has-official-data .coastline{opacity:0}", CSS)
        self.assertIn(".has-official-data .nearby-coastline{opacity:0}", CSS)

    def test_revealed_capillaries_are_neutral_and_incremental(self):
        self.assertIn('<g id="riverContinuity" aria-hidden="true"></g>', INDEX)
        self.assertIn('continuity:$("riverContinuity")', APP)
        self.assertIn('contextMain:typeof r[8]==="string"?r[8]:""', APP)
        self.assertIn('contextBranches:typeof r[9]==="string"?r[9]:""', APP)
        self.assertIn('if(contextualReachIds.has(id))continue;', APP)
        self.assertIn('renderContinuity(latest);', APP)
        self.assertIn('.river-continuity-main{', CSS)
        self.assertIn('.river-continuity-branches{', CSS)
        self.assertIn('not measured ecological quality', INDEX)

    def test_state_bar_uses_complete_network_denominator(self):
        self.assertIn("let fullNetworkWeight=0;", APP)
        self.assertIn('base?.getTotalLength?.()', APP)
        self.assertIn("totals.Dark=Math.max(0,total-coloured);", APP)
        self.assertIn("complete mapped network share", INDEX)
        self.assertIn("Mapped network revealed", INDEX)
        self.assertNotIn("station-associated reach share", INDEX)

    def test_service_worker_matches_build_and_purges_old_caches(self):
        cache_suffix = BUILD.split("-")[-1]
        self.assertIn(f"salmon-dark-rivers-v{cache_suffix}", SW)
        for asset in ASSETS.values():
            self.assertIn(f'"./{asset}"', SW)
        self.assertIn('key.startsWith("salmon-dark-rivers-")', SW)
        self.assertIn("self.skipWaiting()", SW)
        self.assertIn("self.clients.claim()", SW)

    def test_recorded_q_history_is_next_to_playback_and_above_map(self):
        self.assertEqual(INDEX.count('id="qualityChart"'), 1)
        self.assertEqual(INDEX.count('id="playButton"'), 1)
        self.assertEqual(INDEX.count('id="yearRange"'), 1)
        self.assertLess(INDEX.index('id="playButton"'), INDEX.index('id="qualityChart"'))
        self.assertLess(INDEX.index('id="qualityChart"'), INDEX.index('id="riverMap"'))
        self.assertIn('id="playbackDeck"', INDEX)
        self.assertIn('Unobserved rivers excluded', INDEX)
        self.assertIn('Latest recorded class per sampled reach', INDEX)

    def test_quality_history_reuses_latest_observation_per_reach(self):
        self.assertIn('function prepareQualityTimeline(){', APP)
        self.assertIn('lastByReach.set(e.reachId,e.status)', APP)
        self.assertIn('qualityTimeline.push({year,counts,count:lastByReach.size});', APP)
        self.assertIn('prepareQualityTimeline();', APP)
        self.assertIn('renderQualityTimeline();', APP)
        self.assertIn('dataset.darkRiversQualityHistory=pass?"pass":"fail"', APP)

    def test_mobile_playback_is_placed_before_map_with_compact_controls(self):
        self.assertIn('@media(max-width:650px)', CSS)
        self.assertIn('.playback-deck .playback-controls{display:grid;', CSS)
        self.assertIn('grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(102px,1.12fr)', CSS)
        self.assertIn('.quality-chart-wrap,.quality-chart{height:70px}', CSS)
        self.assertIn('.map-shell{height:min(67svh,530px);min-height:340px}', CSS)

    def test_quality_year_axis_matches_real_dates_and_mobile(self):
        self.assertEqual(INDEX.count('id="qualityAxis"'), 1)
        self.assertEqual(INDEX.count('id="qualitySummary"'), 1)
        self.assertIn('function renderQualityAxis(){', APP)
        self.assertIn('for(let year=Math.ceil((min+1)/10)*10;year<max;year+=10)', APP)
        self.assertIn('((year-min)/span*100).toFixed(2)', APP)
        self.assertIn('  renderQualityAxis();', APP)
        self.assertIn('.quality-tick.is-decade:nth-child(even){display:none}', CSS)
        self.assertIn('.quality-tick.is-end{transform:translateX(-100%)}', CSS)

    def test_mobile_playback_pwa_and_zenodo_floater(self):
        self.assertIn('buildObservationIndex();', APP)
        self.assertIn('state.carry+=delta>3000?0:delta;', APP)
        self.assertIn('const interval=matchMedia("(max-width:650px)").matches?520:beatMs;', APP)
        self.assertIn('advanceBeat(elapsedBeats);', APP)
        self.assertIn('value="24"', INDEX)
        self.assertEqual(INDEX.count('id="installApp"'), 1)
        self.assertIn('id="installApp" type="button"', INDEX)
        self.assertIn('els.install.hidden=installed();', APP)
        self.assertIn('Add to Home Screen', APP)
        self.assertIn('.install-cta[hidden]{display:none!important}', CSS)
        self.assertIn('.doi-pill{display:flex;right:9px;', CSS)
        self.assertNotIn('.doi-pill{display:none}', CSS)
        self.assertIn('Zenodo · DOI pending', APP)

    def test_pwa_has_raster_install_icons_and_offline_cache(self):
        import json
        manifest = json.loads((DEMO / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.assertEqual(manifest["display"], "standalone")
        icons = manifest["icons"]
        for name, size in (("icon-192.png", "192x192"), ("icon-512.png", "512x512")):
            self.assertTrue((DEMO / name).is_file(), name)
            self.assertTrue(any(icon["src"] == f"./{name}" and icon["sizes"] == size
                                and icon["type"] == "image/png" for icon in icons))
            self.assertIn(f'"./{name}"', SW)

    def test_mobile_map_swipes_scroll_page_until_move_mode_enabled(self):
        self.assertEqual(INDEX.count('id="mapTouchPan"'), 1)
        self.assertIn('Use Move map to pan by touch', INDEX)
        self.assertIn('touch-action:pan-y;', CSS)
        self.assertIn('.river-map.is-touch-panning{touch-action:none;', CSS)
        self.assertIn('if(touch&&!state.mapTouchPanEnabled)return;', APP)
        self.assertIn('els.map.classList.toggle("is-touch-panning",state.mapTouchPanEnabled);', APP)
        self.assertIn('const next=state.mapPanPending;', APP)
        self.assertIn('applyHydroTransform(false);', APP)
        self.assertIn('if(updateLabels)updateSeaLabels();', APP)
        self.assertIn('.map-shell{height:min(53svh,430px);min-height:320px}', CSS)

    def test_no_literal_escaped_newlines_in_css(self):
        self.assertNotIn(r"\n", CSS)


if __name__ == "__main__":
    unittest.main()
