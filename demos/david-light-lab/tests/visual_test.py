import asyncio
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8000/demos/david-light-lab/"
OUT = Path(__file__).parent / "output"
OUT.mkdir(parents=True, exist_ok=True)

async def wait_loaded(page, label):
    await page.goto(URL, wait_until="domcontentloaded", timeout=60_000)
    await page.wait_for_selector("#loadingCard", timeout=10_000)
    try:
        await page.wait_for_function(
            "() => document.querySelector('#loadingCard')?.classList.contains('is-hidden')",
            timeout=60_000,
        )
    except Exception:
        title = await page.locator("#loadingTitle").inner_text()
        text = await page.locator("#loadingText").inner_text()
        raise AssertionError(f"{label}: model did not load: {title} / {text}")

async def set_controls(page, values):
    await page.evaluate(
        """values => {
          for (const [id, value] of Object.entries(values)) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.value = value;
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
          }
        }""",
        values,
    )
    await page.wait_for_timeout(500)

def canvas_metrics(path):
    im = Image.open(path).convert("L")
    hist = im.histogram()
    total = im.width * im.height
    very_dark = sum(hist[:18]) / total
    mid_or_light = sum(hist[45:]) / total
    return {
        "width": im.width,
        "height": im.height,
        "very_dark_fraction": round(very_dark, 4),
        "mid_or_light_fraction": round(mid_or_light, 4),
    }

async def configure_context(browser, **kwargs):
    context = await browser.new_context(service_workers="block", **kwargs)

    # The demo is tested locally. Cloudflare analytics is irrelevant to the
    # renderer and otherwise generates a generic ERR_FAILED in headless Chromium.
    await context.route(
        "https://static.cloudflareinsights.com/**",
        lambda route: route.fulfill(status=200, content_type="application/javascript", body=""),
    )
    await context.route(
        "**/cdn-cgi/rum**",
        lambda route: route.fulfill(status=204, body=""),
    )
    return context

async def test_page(browser, label, viewport, mobile=False):
    context = await configure_context(
        browser,
        viewport=viewport,
        device_scale_factor=1,
        is_mobile=mobile,
        has_touch=mobile,
    )
    page = await context.new_page()

    page_errors = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    await wait_loaded(page, label)

    if page_errors:
        raise AssertionError(f"{label}: JavaScript page errors: {page_errors}")

    canvas = page.locator("#gl")
    box = await canvas.bounding_box()
    assert box, f"{label}: canvas is not visible"

    if mobile:
        panel_display = await page.locator("#controlPanel").evaluate("(el) => getComputedStyle(el).display")
        assert panel_display == "none", f"{label}: mobile controls should start hidden, got {panel_display}"
        assert box["width"] >= 360 and box["height"] >= 650, box

        toggle = page.locator("#togglePanel")
        assert await toggle.is_visible(), f"{label}: mobile Controls button must be visible"
        await toggle.click()
        await page.wait_for_timeout(200)

        panel_box = await page.locator("#controlPanel").bounding_box()
        assert panel_box, f"{label}: controls drawer did not open"
        assert panel_box["width"] >= 360, panel_box
        assert panel_box["height"] <= viewport["height"] * 0.78, panel_box
        assert panel_box["y"] + panel_box["height"] <= viewport["height"], panel_box

        close_box = await page.locator("#mobilePanelClose").bounding_box()
        assert close_box and close_box["width"] >= 44 and close_box["height"] >= 44, close_box

        open_details = await page.locator("#controlPanel details[open]").count()
        assert open_details == 0, f"{label}: mobile control groups should start collapsed"

        drawer_path = OUT / f"{label}_controls.png"
        await page.screenshot(path=str(drawer_path), full_page=True)

        await page.locator("#mobilePanelClose").click()
        await page.wait_for_timeout(100)
        panel_display = await page.locator("#controlPanel").evaluate("(el) => getComputedStyle(el).display")
        assert panel_display == "none", f"{label}: controls drawer did not close"
    else:
        assert box["width"] > 600 and box["height"] > 500, box
        header_controls = await page.locator("#togglePanel").evaluate("(el) => getComputedStyle(el).display")
        assert header_controls == "none", f"{label}: desktop Controls button should remain hidden, got {header_controls}"

    # Composition interaction diagnostic: a plain click-drag in Compose must
    # move the sculpture. This is the Mac-trackpad path (no mouse required).
    await page.locator('[data-mode="compose"]').click()
    before_compose = OUT / f"{label}_compose_before.png"
    after_compose = OUT / f"{label}_compose_after.png"
    await canvas.screenshot(path=str(before_compose))
    cbox = await canvas.bounding_box()
    await page.mouse.move(cbox["x"] + cbox["width"]*0.50, cbox["y"] + cbox["height"]*0.50)
    await page.mouse.down()
    await page.mouse.move(cbox["x"] + cbox["width"]*0.62, cbox["y"] + cbox["height"]*0.43, steps=8)
    await page.mouse.up()
    await page.wait_for_timeout(150)
    await canvas.screenshot(path=str(after_compose))

    before_im = Image.open(before_compose).convert("L")
    after_im = Image.open(after_compose).convert("L")
    diff = sum(abs(a-b) for a,b in zip(before_im.getdata(), after_im.getdata())) / (before_im.width*before_im.height)
    assert diff > 1.0, f"{label}: Compose click-drag did not visibly pan the sculpture (diff={diff:.3f})"
    await page.locator('[data-mode="explore"]').click()

    # Flat-light diagnostic: proves the actual mesh is continuous/present
    # independently of directional-light shading.
    await set_controls(page, {
        "key":"0.00","fill":"0.82","soft":"0.85",
        "tone":"0.82","shine":"8","bg":"0.02","zoom":"0.92","fov":"42"
    })
    flat_path = OUT / f"{label}_flat.png"
    await canvas.screenshot(path=str(flat_path))
    flat_metrics = canvas_metrics(flat_path)
    assert flat_metrics["mid_or_light_fraction"] > 0.12, f"{label}: model appears blank in flat light: {flat_metrics}"

    # Artist lighting diagnostic: this is the rendering that previously showed
    # patchwork/holes, so it must be captured separately.
    await set_controls(page, {
        "key":"1.05","fill":"0.24","soft":"0.55",
        "az":"35","el":"30","dist":"2.20",
        "tone":"0.82","shine":"18","bg":"0.02"
    })
    lit_path = OUT / f"{label}_lit.png"
    await canvas.screenshot(path=str(lit_path))
    lit_metrics = canvas_metrics(lit_path)
    assert lit_metrics["mid_or_light_fraction"] > 0.08, f"{label}: lit model appears blank: {lit_metrics}"

    await context.close()
    return flat_metrics, lit_metrics

async def run():
    report = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        dflat, dlit = await test_page(
            browser, "desktop", {"width":1440,"height":1000}, mobile=False
        )
        report.append(f"desktop_flat={dflat}")
        report.append(f"desktop_lit={dlit}")

        mflat, mlit = await test_page(
            browser, "mobile", {"width":390,"height":844}, mobile=True
        )
        report.append(f"mobile_flat={mflat}")
        report.append(f"mobile_lit={mlit}")

        await browser.close()

    (OUT / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))

if __name__ == "__main__":
    asyncio.run(run())
