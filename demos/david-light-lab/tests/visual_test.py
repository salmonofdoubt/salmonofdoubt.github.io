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
            timeout=180_000,
        )
    except Exception:
        title = await page.locator("#loadingTitle").inner_text()
        text = await page.locator("#loadingText").inner_text()
        raise AssertionError(f"{label}: model did not load: {title} / {text}")

async def diagnostic_setup(page):
    await page.evaluate("""
    () => {
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
      };
      set('key', '0.35');
      set('fill', '0.75');
      set('soft', '0.85');
      set('tone', '0.82');
      set('shine', '8');
      set('bg', '0.02');
      set('zoom', '0.92');
      set('fov', '42');
    }
    """)
    await page.wait_for_timeout(1000)

def screenshot_metrics(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    # Central viewer region only, excluding most controls.
    crop = im.crop((int(w*0.03), int(h*0.08), int(w*0.74), int(h*0.96)))
    px = list(crop.getdata())
    dark = sum(1 for r,g,b in px if max(r,g,b) < 18) / len(px)
    light = sum(1 for r,g,b in px if min(r,g,b) > 220) / len(px)
    return {"width": w, "height": h, "dark_fraction": dark, "light_fraction": light}

async def run():
    report = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # Desktop
        context = await browser.new_context(viewport={"width": 1440, "height": 1000})
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console error: {m.text}") if m.type == "error" else None)
        await wait_loaded(page, "desktop")
        await diagnostic_setup(page)
        desktop_path = OUT / "desktop.png"
        await page.screenshot(path=str(desktop_path), full_page=True)
        canvas_box = await page.locator("#gl").bounding_box()
        assert canvas_box and canvas_box["width"] > 600 and canvas_box["height"] > 500, canvas_box
        report.append(f"desktop_metrics={screenshot_metrics(desktop_path)}")
        report.append(f"desktop_errors={errors}")
        if errors:
            raise AssertionError("Desktop console/page errors: " + " | ".join(errors))
        await context.close()

        # Mobile
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
        )
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console error: {m.text}") if m.type == "error" else None)
        await wait_loaded(page, "mobile")
        await diagnostic_setup(page)
        mobile_path = OUT / "mobile.png"
        await page.screenshot(path=str(mobile_path), full_page=True)

        panel_display = await page.locator("#controlPanel").evaluate("(el) => getComputedStyle(el).display")
        canvas_box = await page.locator("#gl").bounding_box()
        assert panel_display == "none", f"Mobile controls should start hidden, got {panel_display}"
        assert canvas_box and canvas_box["width"] >= 360 and canvas_box["height"] >= 650, canvas_box
        report.append(f"mobile_metrics={screenshot_metrics(mobile_path)}")
        report.append(f"mobile_errors={errors}")
        if errors:
            raise AssertionError("Mobile console/page errors: " + " | ".join(errors))
        await context.close()

        await browser.close()

    (OUT / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))

if __name__ == "__main__":
    asyncio.run(run())
