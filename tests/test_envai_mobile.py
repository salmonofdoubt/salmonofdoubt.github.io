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
    assert page.locator("#nodes .purpose-node").count() == 4
    assert page.locator("#nodes [data-id='trace']").count() == 0, (
        "Climate TRACE must not appear outside Emissions & energy")
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

def check_pending_result(page):
    # Recreate the user's screenshot deterministically: one fresh, unverified
    # lead is expanded and then tapped. The atlas must remain expanded.
    example={"schemaVersion":1,"releaseEvents":[],"toolHealth":{},
      "leads":[{"id":"fixture-fish","title":"Example Fish Tracker",
        "domain":"Water & oceans","accessType":"web","siteReachable":True,
        "url":"https://example.org/fish","evidence":"https://example.org/evidence",
        "note":"A discovered environmental website awaiting review.",
        "tags":["fish"]}]}
    page.route("**/data/live-updates.json*",
        lambda route:route.fulfill(json=example))
    page.goto("http://127.0.0.1:8897/demos/envai/",wait_until="domcontentloaded")
    page.locator("#nodes .node").first.wait_for(timeout=20000)
    page.locator("#mobileFields [data-field='Water & oceans']").click()
    group=page.locator("#nodes [data-id='group:water-oceans:review']")
    group.wait_for(timeout=10000)
    group.click(force=True)
    result=page.locator("#nodes [data-id='lead:fixture-fish']")
    result.wait_for(timeout=10000)
    assert result.evaluate("(el) => el.tagName.toLowerCase()") == "a"
    assert result.get_attribute("href") == "https://example.org/fish"
    page.context.route("https://example.org/fish",
        lambda route:route.fulfill(status=200,content_type="text/html",body="<title>Example Fish Tracker</title>"))
    with page.context.expect_page(timeout=10000) as opened:
        result.tap(force=True)
    opened.value.close()
    assert result.count()==1, "Tapping a discovery must not collapse its explosion"
    assert page.locator("#nodes [data-id='group:water-oceans:review']").count()==1
    assert page.locator("#focusInfo").is_visible(), "Topic details must remain available"


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
            assert desktop.locator("#nodes .purpose-node").count() == 16, (
                "Four fields must expose exactly 16 curated environmental topics")
            assert desktop.locator("#nodes .node:not(.category-node)").count() == 0, (
                "Individual featured tools must never appear beside environmental topics")
            assert desktop.locator("#nodes [data-id='trace']").count() == 0, (
                "Regression: Climate TRACE must be inside Emissions & energy")
            # Search and the map must include resources regardless of AI
            # classification: Climate TRACE and Carbon Mapper share a purpose.
            group_tools = desktop.locator("#nodes .purpose-node")
            assert group_tools.count() == 16
            assert desktop.locator("#nodes [data-id='group:climate-energy:air-quality']").count() == 1
            assert desktop.locator("#nodes [data-id='group:water-oceans:marine-species']").count() == 1
            desktop.screenshot(path="/tmp/envai-desktop.png", full_page=True)
            # Explicit regression for the screenshot: Emissions & energy contains
            # Climate TRACE, with a parent-child edge; never a direct hub edge.
            group = desktop.locator("#nodes [data-id='group:climate-energy:emissions-energy']")
            assert group.count() == 1, "Missing climate Emissions & energy topic"
            group.click(force=True)
            desktop.locator("#nodes [data-id='trace']").wait_for(timeout=10000)
            assert desktop.locator("#edges .categoryline[data-b='trace']").count() == 1, (
                "Climate TRACE must connect to the Emissions & energy topic")
            assert desktop.locator("#edges .hubline[data-b='trace']").count() == 0, (
                "An individual tool must not bypass its environmental topic")
            assert desktop.locator("#nodes [data-id='trace']").count() == 1
            # A tool is a real outbound link, never another select() operation.
            # Opening it must leave the underlying topic fan-out intact.
            trace=desktop.locator("#nodes [data-id='trace']")
            assert trace.evaluate("(el) => el.tagName.toLowerCase()") == "a"
            assert trace.get_attribute("href") == "https://climatetrace.org/explore"
            assert trace.get_attribute("target") == "_blank"
            desktop.context.route("https://climatetrace.org/**",
                lambda route: route.fulfill(status=200,content_type="text/html",body="<title>Climate TRACE</title>"))
            bounds_trace=trace.bounding_box()
            assert bounds_trace is not None
            pointer_target=desktop.evaluate("""box => {
              const e=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);
              return {tag:e?.tagName||null,
                node:e?.closest('[data-id]')?.getAttribute('data-id')||null,
                className:e?.getAttribute('class')||null};
            }""",bounds_trace)
            assert pointer_target["node"]=="trace", (
                f"SVG tool is visually obstructed / not hit-testable: {pointer_target}")
            with desktop.context.expect_page(timeout=5000) as opened:
                trace.click()
            popup=opened.value
            popup.close()
            assert desktop.locator("#nodes [data-id='trace']").count() == 1, (
                "Opening a tool must not retract the expanded topic")
            assert desktop.locator("#nodes [data-id='group:climate-energy:emissions-energy']").count() == 1
            desktop.screenshot(path="/tmp/envai-climate-augmented.png", full_page=True)

            # Search results have the same single-tap outbound behaviour.
            desktop.locator("#search").fill("OpenAQ")
            search_result=desktop.locator("#searchCandidates [data-tool-id='openaq']")
            search_result.wait_for(timeout=10000)
            assert search_result.evaluate("(el) => el.tagName.toLowerCase()") == "a"
            assert search_result.get_attribute("href") == "https://explore.openaq.org/"
            desktop.context.route("https://explore.openaq.org/**",
                lambda route: route.fulfill(status=200,content_type="text/html",body="<title>OpenAQ</title>"))
            with desktop.context.expect_page(timeout=10000) as opened:
                search_result.click(force=True)
            opened.value.close()
            assert desktop.locator("#searchCandidates [data-tool-id='openaq']").count() == 1, (
                "Opening a search hit must preserve search results")
            desktop.locator("#search").fill("")
            desktop.locator("#hubs [data-id='hub:Climate & energy']").click(force=True)
            assert desktop.locator("#nodes [data-id='trace']").count() == 0, (
                "Clicking field hub must collapse expanded tools")
            phone=browser.new_page(viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
            check_pending_result(phone)
            phone.close()
            browser.close()
        print("PASS: mobile 320/390/680 + desktop; individual tools, search hits and mobile unverified results open without collapsing; versioned layout")
    finally:
        server.shutdown()
        server.server_close()

if __name__ == "__main__":
    main()
