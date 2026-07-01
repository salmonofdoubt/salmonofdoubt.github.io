#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json
import shutil
import subprocess
from collections import deque

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "art" / "assets" / "docs"
COVERS = DOCS / "covers"
MANIFEST = DOCS / "documentation.json"

COVERS.mkdir(parents=True, exist_ok=True)

ITEMS = [
    {
        "slug": "diandre-art-book-001-summer-2022",
        "title": "DiAndré Art Book #001",
        "subtitle": "Summer 2022",
        "year": "2022",
        "kind": "Art book",
        "group": "Art Books",
        "pdf": "../assets/docs/diandre-art-book-001-summer-2022.pdf",
        "description": "Early art book documenting drawings, underpaintings, studio process and the emergence of the DiAndré visual language.",
    },
    {
        "slug": "diandre-art-book-002-2023",
        "title": "DiAndré Art Book #002",
        "subtitle": "2023",
        "year": "2023",
        "kind": "Art book",
        "group": "Art Books",
        "pdf": "../assets/docs/diandre-art-book-002-2023.pdf",
        "description": "A 2023 art book around studio work, La Stanza, Ferrara, Venice, lichen, drawings and atmospheric painting.",
    },
    {
        "slug": "diandre-art-book-003-2024",
        "title": "DiAndré Art Book #003",
        "subtitle": "2024",
        "year": "2024",
        "kind": "Art book",
        "group": "Art Books",
        "pdf": "../assets/docs/diandre-art-book-003-2024.pdf",
        "description": "A 2024 art book connecting Venice, watercolours, exhibition material, pavement studies, QGIS and visual research.",
    },
    {
        "slug": "diandre-art-journal-2022",
        "title": "DiAndré Art Journal",
        "subtitle": "2022",
        "year": "2022",
        "kind": "Art journal",
        "group": "Art Journals",
        "pdf": "../assets/docs/diandre-art-journal-2022.pdf",
        "description": "A process journal capturing early studies, sketches, colour decisions and studio documentation.",
    },
    {
        "slug": "diandre-art-journal-2023",
        "title": "DiAndré Art Journal",
        "subtitle": "2023",
        "year": "2023",
        "kind": "Art journal",
        "group": "Art Journals",
        "pdf": "../assets/docs/diandre-art-journal-2023.pdf",
        "description": "A 2023 process journal on abstraction, colour theory, drawings, transformations, Ferrara, Venice and unrealised work.",
    },
    {
        "slug": "diandre-art-journal-2024",
        "title": "DiAndré Art Journal",
        "subtitle": "2024",
        "year": "2024",
        "kind": "Art journal",
        "group": "Art Journals",
        "pdf": "../assets/docs/diandre-art-journal-2024.pdf",
        "description": "A 2024 process journal covering abstraction, colour, painting modes, Venice, Ferrara, watercolours and experimental work.",
    },
    {
        "slug": "diandre-art-journal-2025",
        "title": "DiAndré Art Journal",
        "subtitle": "2025",
        "year": "2025",
        "kind": "Art journal",
        "group": "Art Journals",
        "pdf": "../assets/docs/diandre-art-journal-2025.pdf",
        "description": "A 2025 process journal connecting principles, TCD exhibition material, Mirror or Door, light phenomena and future systems art.",
    },
]


def repo_pdf_path(item: dict) -> Path:
    return (ROOT / "art" / "documentation" / item["pdf"]).resolve()


def run_quiet(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def render_first_page_if_needed(item: dict) -> Path | None:
    slug = item["slug"]
    pdf = repo_pdf_path(item)
    raw = COVERS / f"{slug}-raw.png"

    if raw.exists() and raw.stat().st_size > 1000:
        return raw

    if not pdf.exists():
        print(f"Missing PDF: {pdf}")
        return None

    tmpdir = COVERS / f".render-{slug}"
    shutil.rmtree(tmpdir, ignore_errors=True)
    tmpdir.mkdir(parents=True, exist_ok=True)

    # macOS QuickLook gives reliable first-page previews for both PDF-derived books and slide PDFs.
    run_quiet(["qlmanage", "-t", "-s", "1800", "-o", str(tmpdir), str(pdf)])

    candidates = sorted(tmpdir.glob("*.png")) + sorted(tmpdir.glob("*.jpg")) + sorted(tmpdir.glob("*.jpeg"))
    if not candidates:
        # fallback to sips if QuickLook refuses
        fallback = tmpdir / "fallback.png"
        run_quiet(["sips", "-s", "format", "png", str(pdf), "--out", str(fallback)])
        if fallback.exists():
            candidates = [fallback]

    if not candidates:
        shutil.rmtree(tmpdir, ignore_errors=True)
        print(f"Could not render first page for {pdf.name}")
        return None

    shutil.move(str(candidates[0]), str(raw))
    shutil.rmtree(tmpdir, ignore_errors=True)

    if raw.exists() and raw.stat().st_size > 1000:
        print(f"Rendered raw cover: {raw.name}")
        return raw

    return None


def largest_saturated_region(image: Image.Image) -> tuple[int, int, int, int] | None:
    small = image.convert("RGB")
    small.thumbnail((900, 900))

    w, h = small.size
    pixels = small.load()

    mask = [[False] * w for _ in range(h)]

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            saturation = mx - mn
            brightness = (r + g + b) / 3

            # Exclude the white Google Photos page and black text.
            # Keep saturated artwork regions.
            if saturation > 38 and 35 < brightness < 248:
                mask[y][x] = True

    seen = [[False] * w for _ in range(h)]
    best = None

    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0] or not mask[y0][x0]:
                continue

            q = deque([(x0, y0)])
            seen[y0][x0] = True
            xs = []
            ys = []

            while q:
                x, y = q.popleft()
                xs.append(x)
                ys.append(y)

                for nx in (x - 1, x, x + 1):
                    for ny in (y - 1, y, y + 1):
                        if nx == x and ny == y:
                            continue
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            q.append((nx, ny))

            if len(xs) < 350:
                continue

            left, top, right, bottom = min(xs), min(ys), max(xs) + 1, max(ys) + 1
            bw = right - left
            bh = bottom - top
            area = bw * bh

            # Reject tiny logos / QR fragments.
            if bw < w * 0.08 or bh < h * 0.08:
                continue

            if best is None or area > best[0]:
                best = (area, left, top, right, bottom)

    if best is None:
        return None

    _, left, top, right, bottom = best
    sx = image.width / w
    sy = image.height / h

    full = (
        int(left * sx),
        int(top * sy),
        int(right * sx),
        int(bottom * sy),
    )

    return full


def crop_book_art(raw_path: Path) -> Image.Image:
    image = Image.open(raw_path).convert("RGB")
    bbox = largest_saturated_region(image)

    if bbox is None:
        # Conservative manual cover-zone fallback: upper/middle right area of Google Photos cover.
        w, h = image.size
        bbox = (int(w * 0.34), int(h * 0.05), int(w * 0.94), int(h * 0.55))

    left, top, right, bottom = bbox

    pad_x = int((right - left) * 0.14)
    pad_y = int((bottom - top) * 0.14)

    left = max(0, left - pad_x)
    top = max(0, top - pad_y)
    right = min(image.width, right + pad_x)
    bottom = min(image.height, bottom + pad_y)

    return image.crop((left, top, right, bottom))


def compose_thumbnail(source: Image.Image, out_path: Path, mode: str) -> None:
    canvas_w, canvas_h = 1200, 900
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#050403")

    img = source.convert("RGB")

    if mode == "book":
        max_w = int(canvas_w * 0.94)
        max_h = int(canvas_h * 0.88)
    else:
        max_w = int(canvas_w * 0.90)
        max_h = int(canvas_h * 0.82)

    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

    x = (canvas_w - img.width) // 2
    y = (canvas_h - img.height) // 2

    canvas.paste(img, (x, y))
    canvas.save(out_path, quality=94)


def make_thumbnails() -> None:
    output_items = []

    for item in ITEMS:
        raw = render_first_page_if_needed(item)

        thumb = COVERS / f"{item['slug']}-thumb.png"

        if raw and raw.exists():
            if item["group"] == "Art Books":
                source = crop_book_art(raw)
                compose_thumbnail(source, thumb, "book")
                print(f"Book thumbnail: {thumb.name}")
            else:
                source = Image.open(raw).convert("RGB")
                compose_thumbnail(source, thumb, "journal")
                print(f"Journal thumbnail: {thumb.name}")
        else:
            # Minimal fallback, still dark and deliberate.
            fallback = Image.new("RGB", (1200, 900), "#050403")
            fallback.save(thumb)
            print(f"Fallback thumbnail: {thumb.name}")

        item = dict(item)
        item["cover"] = f"../assets/docs/covers/{thumb.name}"
        output_items.append(item)

    MANIFEST.write_text(
        json.dumps({"updated": "2026-07-01", "items": output_items}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    make_thumbnails()
