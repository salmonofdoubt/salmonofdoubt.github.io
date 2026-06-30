#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "art" / "data" / "artworks.json"
CACHE_PATH = ROOT / "art" / "data" / "image-fingerprints.json"


def ensure_pillow():
    try:
        from PIL import Image  # noqa: F401
        return
    except ImportError:
        print("Pillow not found. Installing into current environment...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])


ensure_pillow()
from PIL import Image, ImageOps  # noqa: E402


def fetch_bytes(url_or_path: str) -> bytes:
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        req = Request(
            url_or_path,
            headers={
                "User-Agent": "Mozilla/5.0 salmonofdoubt-art-dedupe/1.0",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
        )
        with urlopen(req, timeout=60) as response:
            return response.read()

    local = (ROOT / "art" / url_or_path).resolve()
    if not local.exists():
        local = (ROOT / url_or_path).resolve()
    return local.read_bytes()


def ahash(image_bytes: bytes, size: int = 12) -> str:
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("L").resize((size, size), Image.Resampling.LANCZOS)
        pixels = list(img.getdata())

    avg = sum(pixels) / len(pixels)
    bits = "".join("1" if px >= avg else "0" for px in pixels)
    return hex(int(bits, 2))[2:].zfill((size * size + 3) // 4)


def dhash(image_bytes: bytes, size: int = 12) -> str:
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
        pixels = list(img.getdata())

    rows = [pixels[i * (size + 1):(i + 1) * (size + 1)] for i in range(size)]
    bits = []
    for row in rows:
        for left, right in zip(row, row[1:]):
            bits.append("1" if left > right else "0")

    return hex(int("".join(bits), 2))[2:].zfill((size * size + 3) // 4)


def hamming_hex(a: str, b: str) -> int:
    return (int(a, 16) ^ int(b, 16)).bit_count()


def fingerprint(item: dict, cache: dict) -> dict:
    key = item.get("image", "")
    if key in cache:
        return cache[key]

    image_bytes = fetch_bytes(key)

    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        width, height = img.size

    fp = {
        "url": key,
        "bytes_sha1": hashlib.sha1(image_bytes).hexdigest(),
        "ahash": ahash(image_bytes),
        "dhash": dhash(image_bytes),
        "width": width,
        "height": height,
        "aspect_bucket": round(width / height, 2) if height else 0,
    }

    cache[key] = fp
    return fp


def title_quality(item: dict) -> int:
    title = item.get("title", "")
    score = 0

    if "work " not in title.lower():
        score += 20
    if any(token in title.lower() for token in ["ferrara", "nasturtium", "metropolis", "portmarnock", "decision", "orto"]):
        score += 20
    if item.get("sourceUrl", "") == "":
        score += 10
    if "Portraits" in item.get("subgroup", ""):
        score += 5
    if len(title) > 18:
        score += 3

    return score


def duplicate_score(a: dict, b: dict) -> int:
    if a["bytes_sha1"] == b["bytes_sha1"]:
        return 999

    if abs(a["aspect_bucket"] - b["aspect_bucket"]) > 0.03:
        return 0

    a_dist = hamming_hex(a["ahash"], b["ahash"])
    d_dist = hamming_hex(a["dhash"], b["dhash"])

    # Both hashes are 144-bit. These thresholds catch duplicate uploads,
    # resized versions, mild compression changes and repeated gallery entries.
    if a_dist <= 6 and d_dist <= 10:
        return 100

    if a_dist <= 10 and d_dist <= 14:
        return 75

    return 0


def merge_items(keeper: dict, duplicate: dict) -> dict:
    merged = dict(keeper)
    sources = set(keeper.get("duplicateSourceUrls", []))
    if keeper.get("sourceUrl"):
        sources.add(keeper["sourceUrl"])
    if duplicate.get("sourceUrl"):
        sources.add(duplicate["sourceUrl"])
    merged["duplicateSourceUrls"] = sorted(sources)

    # Keep a useful note for future manual curation.
    notes = list(keeper.get("curationNotes", []))
    notes.append(
        f"Removed near-duplicate: {duplicate.get('id')} / {duplicate.get('title')} / {duplicate.get('image')}"
    )
    merged["curationNotes"] = notes
    return merged


def main() -> int:
    if not MANIFEST_PATH.exists():
        raise SystemExit("Missing art/data/artworks.json. Run the WordPress scavenger first.")

    data = json.loads(MANIFEST_PATH.read_text())
    artworks = data.get("artworks", [])

    cache = {}
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text())

    print(f"Loaded {len(artworks)} artworks")

    enriched = []
    for index, item in enumerate(artworks, start=1):
        try:
            fp = fingerprint(item, cache)
            enriched.append((item, fp))
            print(f"OK   {index:03d}/{len(artworks):03d} {item.get('title')}")
        except Exception as exc:
            print(f"WARN fingerprint failed for {item.get('id')} {item.get('image')}: {exc}")
            # Keep failed items rather than deleting them.
            fp = {
                "url": item.get("image", ""),
                "bytes_sha1": item.get("image", ""),
                "ahash": "0",
                "dhash": "0",
                "width": 0,
                "height": 0,
                "aspect_bucket": 0,
            }
            enriched.append((item, fp))

    CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")

    kept: list[tuple[dict, dict]] = []
    removed: list[tuple[dict, dict, int]] = []

    for item, fp in enriched:
        duplicate_index = None
        duplicate_strength = 0

        for i, (kept_item, kept_fp) in enumerate(kept):
            strength = duplicate_score(fp, kept_fp)
            if strength > duplicate_strength:
                duplicate_strength = strength
                duplicate_index = i

        if duplicate_index is None or duplicate_strength < 75:
            kept.append((item, fp))
            continue

        kept_item, kept_fp = kept[duplicate_index]

        # Prefer the record with the stronger title or manual/local source.
        if title_quality(item) > title_quality(kept_item):
            item = merge_items(item, kept_item)
            kept[duplicate_index] = (item, fp)
            removed.append((kept_item, item, duplicate_strength))
        else:
            kept_item = merge_items(kept_item, item)
            kept[duplicate_index] = (kept_item, kept_fp)
            removed.append((item, kept_item, duplicate_strength))

    deduped = [item for item, _ in kept]
    deduped.sort(key=lambda item: (item.get("collectionOrder", 999), item.get("subgroup", ""), item.get("order", 999)))

    data["artworks"] = deduped
    data["dedupedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    data["dedupeNotes"] = [
        "Duplicates removed using perceptual hashes, not merely identical URLs.",
        "Removed records are noted in curationNotes on the retained artwork where possible.",
        "Thresholds are intentionally conservative to avoid deleting different paintings with similar palettes.",
    ]

    MANIFEST_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    print()
    print(f"Before:  {len(artworks)}")
    print(f"After:   {len(deduped)}")
    print(f"Removed: {len(removed)}")

    if removed:
        print()
        print("Removed duplicates:")
        for duplicate, keeper, strength in removed[:80]:
            print(f"- {duplicate.get('title')}  -> kept {keeper.get('title')}  score={strength}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
