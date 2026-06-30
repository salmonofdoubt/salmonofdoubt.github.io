from __future__ import annotations

import json
import os
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "source" / "official-downloads"
FORM_URL = "https://gis.epa.ie/GetData/Download"

TARGETS = [
    "Interim water quality review results and data 2023 (Excel)",
    "Load Reduction Indicator Data And Results 2025 (Excel)",
    "WFD Waterbody Status Elements and River Site Status 2019-2024 - Oct 2025",
    "Groundwater Quality (Excel) 1990 - 2024",
    "Coastal Water Quality 2018-2020",
    "Transitional Water Quality 2018-2020",
    "EPA River Invertebrate (Q-value) Data 2007-2025",
    "Biological Q Results 28/04/2026",
    "Bathing Water Locations and Compliance Data - 21/04/2026",
]


@dataclass
class BrowserEvent:
    target: str
    status: str
    selected_file: str = ""
    response_url: str = ""
    page_title: str = ""
    message: str = ""


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fill_email(page, email: str) -> None:
    selectors = [
        'input[name="Email"]',
        'input[name="email"]',
        'input[id*="Email"]',
        'input[type="email"]',
    ]

    for selector in selectors:
        loc = page.locator(selector)
        if loc.count():
            loc.first.fill(email)
            break

    selectors = [
        'input[name="reEmail"]',
        'input[name="ReEmail"]',
        'input[name*="reEmail"]',
        'input[name*="Confirm"]',
        'input[id*="reEmail"]',
    ]

    for selector in selectors:
        loc = page.locator(selector)
        if loc.count():
            loc.first.fill(email)
            break


def selected_file_value(page) -> str:
    selectors = [
        'input[name="SelectedFile"]',
        'select[name="SelectedFile"]',
        '[name="SelectedFile"]',
    ]

    for selector in selectors:
        loc = page.locator(selector)
        if not loc.count():
            continue

        try:
            return compact(loc.first.input_value())
        except Exception:
            pass

        try:
            return compact(loc.first.get_attribute("value") or "")
        except Exception:
            pass

    return ""


def submit(page) -> None:
    selectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Download")',
        'button:has-text("Get")',
        'input[value*="Download"]',
        'input[value*="Submit"]',
    ]

    for selector in selectors:
        loc = page.locator(selector)
        if loc.count():
            loc.first.click()
            return

    page.keyboard.press("Enter")


def main() -> int:
    email = os.environ.get("EPA_GEO_EMAIL") or os.environ.get("EPA_DOWNLOAD_EMAIL")

    if not email:
        raise SystemExit("Set EPA_GEO_EMAIL before running this script.")

    from playwright.sync_api import sync_playwright

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    events: list[BrowserEvent] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        for target in TARGETS:
            print("TARGET:", target)

            try:
                page.goto(FORM_URL, wait_until="networkidle", timeout=60000)

                # Expand likely WQ sections. Ignore failures; some sections are already visible.
                for heading in [
                    "Water / Water Framework Directive",
                    "Water Quality and Monitoring",
                    "(D) Published Water Quality Data",
                    "(E) WFD Status Additional Information",
                    "(G) Cycle 2 Waterbodies",
                ]:
                    try:
                        page.get_by_text(heading, exact=False).first.click(timeout=3000)
                        page.wait_for_timeout(500)
                    except Exception:
                        pass

                candidate = page.get_by_text(target, exact=True)

                if not candidate.count():
                    candidate = page.get_by_text(target, exact=False)

                if not candidate.count():
                    events.append(BrowserEvent(target=target, status="not_found_on_page"))
                    print("  not found")
                    continue

                candidate.first.scroll_into_view_if_needed(timeout=10000)
                candidate.first.click(timeout=10000)
                page.wait_for_timeout(1000)

                selected = selected_file_value(page)
                fill_email(page, email)

                before_url = page.url
                submit(page)

                try:
                    page.wait_for_load_state("networkidle", timeout=15000)
                except Exception:
                    page.wait_for_timeout(3000)

                body = compact(page.locator("body").inner_text(timeout=10000))
                after_url = page.url

                status = "submitted"
                lower = body.lower()

                if "email" in lower and ("sent" in lower or "link" in lower or "download" in lower):
                    status = "email_link_requested"
                elif ".zip" in lower or ".xlsx" in lower or ".xls" in lower or ".csv" in lower:
                    status = "download_link_returned"
                elif after_url != before_url:
                    status = "submitted_navigation_changed"

                events.append(
                    BrowserEvent(
                        target=target,
                        status=status,
                        selected_file=selected,
                        response_url=after_url,
                        page_title=page.title(),
                        message=body[:800],
                    )
                )

                print("  status:", status)
                print("  selected:", selected)
                print("  url:", after_url)

            except Exception as exc:
                events.append(
                    BrowserEvent(
                        target=target,
                        status="failed",
                        message=str(exc),
                    )
                )
                print("  failed:", exc)

        context.close()
        browser.close()

    result = {
        "generated_at_epoch": int(time.time()),
        "form_url": FORM_URL,
        "email_configured": True,
        "targets": TARGETS,
        "events": [asdict(event) for event in events],
    }

    out = OUT_DIR / "epa-geoportal-browser-request-manifest.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("Manifest:", out)
    print()
    for event in events:
        print("EVENT:", event.status, "|", event.selected_file, "|", event.target)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
