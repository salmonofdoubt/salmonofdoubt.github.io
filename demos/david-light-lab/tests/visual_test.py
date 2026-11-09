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
        # CSS specifies 44px. Subpixel browser geometry may report 43.99998px.
        assert close_box and close_box["width"] >= 43.95 and close_box["height"] >= 43.95, close_box

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

    # New navigation regression on the real production mesh.
    # Read saved state through the existing public Save study control.
    async def camera_snapshot():
        return await page.evaluate("""() => {
            document.getElementById('saveStudy').click();
            const saved=JSON.parse(localStorage.getItem('david-light-lab:study:v1'));
            return {specimen:saved.specimen,head:saved.headQuat, light:saved.controls.az,
                target:saved.pan, camera:saved.cameraQuat,
                zoom:Number(saved.controls.zoom)};
        }""")

    await set_controls(page, {"key":"0.00","fill":"0.82","tone":"0.82","zoom":"1"})
    before_focus = await camera_snapshot()
    focus = "nose" if mobile else "eyes"
    await page.evaluate(
        "(key) => document.querySelector('[data-focus=\"'+key+'\"]').click()",
        focus,
    )
    # Await the actual animation target rather than assuming a fast GPU frame rate.
    expected_zoom = 11 if mobile else 6.5
    await page.wait_for_function(
        "(target) => Math.abs(Number(document.getElementById('zoom').value)-target)<0.05",
        arg=expected_zoom,
        timeout=15_000,
    )
    after_focus = await camera_snapshot()
    assert after_focus["head"] == before_focus["head"], f"{label}: focus altered sculpture pose"
    assert after_focus["light"] == before_focus["light"], f"{label}: focus altered lamp"
    assert after_focus["zoom"] >= 6, f"{label}: anatomical focus did not zoom: {after_focus}"
    assert len(after_focus["target"]) == 3, f"{label}: missing 3D focus target"

    focus_path = OUT / f"{label}_anatomical_focus.png"
    await canvas.screenshot(path=str(focus_path))
    focus_metrics = canvas_metrics(focus_path)
    assert focus_metrics["mid_or_light_fraction"] > 0.015, (
        f"{label}: anatomical focus shows no sculpture: {focus_metrics}"
    )

    await page.evaluate("() => document.getElementById('zoomDecrease').click()")
    assert (await camera_snapshot())["zoom"] < after_focus["zoom"], f"{label}: zoom out did not work"
    await page.evaluate("() => document.getElementById('zoomIncrease').click()")
    assert (await camera_snapshot())["zoom"] > 1, f"{label}: zoom in did not work"
    await page.evaluate("() => document.getElementById('fitView').click()")
    fitted = await camera_snapshot()
    assert fitted["zoom"] == 1 and fitted["target"] == [0,0,0], (
        f"{label}: Fit head did not restore camera: {fitted}"
    )
    # Studio Detail comparison uses the real David geometry, not a mock mesh.
    # It must refine only after settling, and revert cleanly when turned off.
    await page.evaluate(
        "() => document.querySelector('[data-focus=\"eyes\"]').click()"
    )
    await page.wait_for_function(
        "() => Math.abs(Number(document.getElementById('zoom').value)-6.5)<0.05",
        timeout=15_000,
    )
    await set_controls(page, {"zoom":"12","key":"1.15","fill":"0.23","soft":"0.55"})
    baseline_size = await canvas.evaluate(
        "(c) => ({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight})"
    )
    await canvas.screenshot(path=str(OUT / f"{label}_detail_off.png"))

    await page.evaluate("""() => {
        const t=document.getElementById('studioDetail');
        t.checked=true;
        t.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    await page.wait_for_function(
        "() => document.getElementById('detailStatus').textContent.startsWith('Refined')",
        timeout=10_000,
    )
    refined_size = await canvas.evaluate(
        "(c) => ({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight})"
    )
    assert refined_size["width"]*refined_size["height"] > (
        baseline_size["width"]*baseline_size["height"]*1.5
    ), f"{label}: settled detail did not increase render resolution: {baseline_size} to {refined_size}"
    assert refined_size["cssWidth"] == baseline_size["cssWidth"], (
        f"{label}: Studio Detail changed the visible layout"
    )
    await canvas.screenshot(path=str(OUT / f"{label}_detail_on.png"))
    assert await page.evaluate(
        "() => document.getElementById('gl').getContext('webgl2').getError()"
    ) == 0, f"{label}: WebGL reported an error after detail pass"

    await page.evaluate("""() => {
        const t=document.getElementById('studioDetail');
        t.checked=false;
        t.dispatchEvent(new Event('change',{bubbles:true}));
    }""")
    await page.wait_for_function(
        "() => document.getElementById('detailStatus').textContent==='Off'"
    )
    reverted_size = await canvas.evaluate("(c) => c.width*c.height")
    assert reverted_size == baseline_size["width"]*baseline_size["height"], (
        f"{label}: turning Studio Detail off did not restore regular rendering"
    )

    # Both actual, separately sourced specimens must render correctly.
    original_view = await camera_snapshot()
    assert original_view["specimen"] == "scan-the-world", original_view
    assert await page.locator("#specimenSelect").input_value() == "scan-the-world"
    assert "David_(Michelangelo).stl" in (
        await page.locator("#specimenSource").get_attribute("href")
    )

    async def select_specimen(specimen):
        await page.evaluate("""id => {
            const picker=document.getElementById('specimenSelect');
            picker.value=id;
            picker.dispatchEvent(new Event('change',{bubbles:true}));
        }""", specimen)
        status = "SMK ready" if specimen == "smk-kas2232" else "Original ready"
        await page.wait_for_function(
            "(s) => document.getElementById('specimenLoadStatus').textContent===s",
            arg=status,timeout=120_000
        )

    await select_specimen("smk-kas2232")
    smk_initial = await camera_snapshot()
    assert smk_initial["specimen"] == "smk-kas2232", smk_initial
    assert smk_initial["zoom"] == 1, f"{label}: new specimen inherited old eye close-up"
    assert smk_initial["light"] == original_view["light"], (
        f"{label}: changing specimens altered light azimuth"
    )
    assert "KAS2232" in await page.locator("#specimenSource").get_attribute("href")
    assert "CC0" in await page.locator("#specimenDescription").inner_text()

    await set_controls(page, {"zoom":"1","key":"0.00","fill":"0.82","bg":"0.02"})
    smk_full_path = OUT / f"{label}_smk_plaster_full.png"
    await canvas.screenshot(path=str(smk_full_path))
    smk_full = canvas_metrics(smk_full_path)
    assert smk_full["mid_or_light_fraction"] > .10, (
        f"{label}: SMK model renders as blank: {smk_full}"
    )

    await page.evaluate(
        "() => document.querySelector('[data-focus=\"eyes\"]').click()"
    )
    await page.wait_for_function(
        "() => Math.abs(Number(document.getElementById('zoom').value)-6.5)<0.05",
        timeout=20_000
    )
    smk_eye_path = OUT / f"{label}_smk_plaster_eye.png"
    await canvas.screenshot(path=str(smk_eye_path))
    smk_eye = canvas_metrics(smk_eye_path)
    assert smk_eye["mid_or_light_fraction"] > .015, (
        f"{label}: SMK anatomical focus produces blank canvas: {smk_eye}"
    )

    # The source model and its last camera position are preserved on return.
    await select_specimen("scan-the-world")
    restored_original = await camera_snapshot()
    assert restored_original["specimen"] == "scan-the-world"
    assert abs(restored_original["zoom"] - original_view["zoom"]) < .05, (
        f"{label}: switching back did not recover original camera"
    )
    assert restored_original["head"] == original_view["head"], (
        f"{label}: specimen switch changed original head orientation"
    )
    assert not page_errors, f"{label}: specimen test raised browser errors: {page_errors}"

    assert not page_errors, f"{label}: navigation produced browser errors: {page_errors}"

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
