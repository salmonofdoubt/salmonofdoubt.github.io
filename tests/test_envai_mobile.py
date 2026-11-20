"""Browser smoke checks for EnvAI's mobile-first layout, without changing desktop."""
import contextlib
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def bounds(locator):
    result = locator.bounding_box()
    assert result is not None
    return result

def check_page(page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    page.goto("http://127.0.0.1:8897/demos/envai/", wait_until="domcontentloaded")
    page.locator("#nodes .node").first.wait_for(timeout=20000)
    page.wait_for_function("document.querySelector('#totalNum').textContent !== '…'")
    overflow = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    assert overflow <= 2, f"Horizontal overflow at {width}px: {overflow}px"
    assert page.locator("#mobileFields .field-tab").count() == 4
    intro = bounds(page.locator(".map-intro"))
    tabs = bounds(page.locator("#mobileFields"))
    graph = bounds(page.locator("#stage"))
    assert intro["y"] + intro["height"] <= tabs["y"] + 2, "Intro overlaps field selector"
    assert tabs["y"] + tabs["height"] <= graph["y"] + 2, "Field selector overlaps constellation"
    assert graph["height"] >= 360, "Map too small to use with fingers"
    assert page.locator("#hubs .node.hub").count() == 1, "Four fields must not overlap on mobile"
    assert page.locator("#mobileFields [data-field='Biodiversity & wildlife']").get_attribute("aria-pressed") == "true"
    page.screenshot(path=f"/tmp/envai-mobile-{width}.png", full_page=True)
    page.locator("#mobileFields [data-field='Climate & energy']").click()
    assert page.locator("#mobileFields [data-field='Climate & energy']").get_attribute("aria-pressed") == "true"
    assert page.locator("#hubs .node.hub").count() == 1
    assert "CLIMATE" in page.locator("#hubs").text_content()
    assert page.locator("#nodes .category-node:not([data-id$='review'])").count() == 3
    assert page.locator("#nodes [data-id='trace']").count() == 0, (
        "Climate TRACE must not be featured beside its AI-augmented category")
    group = page.locator("#nodes .category-node").first
    if group.count():
        group.click(force=True)
        page.locator("#focusInfo").wait_for(state="visible")
        detail = bounds(page.locator("#focusInfo"))
        map_rect = bounds(page.locator("#stage"))
        assert detail["y"] >= map_rect["y"] + map_rect["height"]-2, "Details overlap the map"
        page.locator(".focus-group-trigger").click()
        assert page.locator("#dialog").is_visible(), "Full group browser inaccessible"
        assert page.locator(".group-browser-row").count() >= 3
        page.locator("#dialogClose").click()
    page.locator("#search").fill("BirdCast")
    page.wait_for_timeout(300)
    assert page.locator("#mobileFields [data-field='Biodiversity & wildlife']").get_attribute("aria-pressed") == "true", "Search must switch to matching field"

def main():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 8897), handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            for width, height in [(320, 700), (390, 844), (680, 800)]:
                page = browser.new_page(viewport={"width":width,"height":height}, device_scale_factor=1)
                check_page(page, width, height)
                page.close()
            desktop = browser.new_page(viewport={"width": 1440, "height": 900})
            desktop.goto("http://127.0.0.1:8897/demos/envai/", wait_until="domcontentloaded")
            desktop.locator("#nodes .node").first.wait_for(timeout=20000)
            assert desktop.locator("#hubs .node.hub").count() == 4, "Desktop constellation regressed"
            assert not desktop.locator("#mobileFields").is_visible(), "Mobile tabs leak into desktop"
            assert desktop.locator("#nodes .category-node:not([data-id$='review'])").count() == 12, (
                "Four fields must each expose exactly three AI-category nodes")
            assert desktop.locator("#nodes .node:not(.category-node)").count() == 0, (
                "Individual featured tools must never appear beside categories")
            assert desktop.locator("#nodes [data-id='trace']").count() == 0, (
                "Regression: Climate TRACE must be nested")
            desktop.screenshot(path="/tmp/envai-desktop.png", full_page=True)
            # Explicit regression for the screenshot: only AI-augmented contains
            # Climate TRACE, with a parent-child edge; never a direct hub edge.
            group = desktop.locator("#nodes [data-id='group:climate-energy:aug']")
            assert group.count() == 1, "Missing climate AI-augmented category"
            group.click(force=True)
            desktop.locator("#nodes [data-id='trace']").wait_for(timeout=10000)
            assert desktop.locator("#edges .categoryline[data-b='trace']").count() == 1, (
                "Climate TRACE must connect to its AI category")
            assert desktop.locator("#edges .hubline[data-b='trace']").count() == 0, (
                "A tool must never connect directly to the environmental hub")
            assert desktop.locator("#nodes [data-id='trace']").count() == 1
            desktop.screenshot(path="/tmp/envai-climate-augmented.png", full_page=True)
            desktop.locator("#hubs [data-id='hub:Climate & energy']").click(force=True)
            assert desktop.locator("#nodes [data-id='trace']").count() == 0, (
                "Clicking field hub must collapse expanded tools")
            browser.close()
        print("PASS: mobile 320/390/680 and desktop, strict 3-level hierarchy, Climate TRACE nested, category fan-out, no overflow")
    finally:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    main()
