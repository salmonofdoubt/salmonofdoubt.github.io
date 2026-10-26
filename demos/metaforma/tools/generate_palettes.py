#!/usr/bin/env python3
"""Deterministic MetaForma original-painting colour editions, by block.

Preserves each user-approved PNG master byte-for-byte. Additional colour
editions retain every pixel location and native 1448x1086 aspect ratio.
Requires pillow and numpy. Run with --block I, II, III or IV.
"""
from __future__ import annotations
from pathlib import Path
import hashlib
import json
import argparse

import numpy as np
from PIL import Image

ART = Path(__file__).resolve().parent.parent / "art"
BLOCKS = {
    "I": (
        "01-the-hundred",
        "02-roll-up",
        "03-roll-over",
        "04-single-leg-circles",
    ),
    "II": (
        "05-rolling-like-a-ball",
        "06-single-leg-stretch",
        "07-double-leg-stretch",
        "08-spine-stretch-forward",
        "09-open-leg-rocker",
    ),
    "III": (
        "10-corkscrew",
        "11-saw",
        "12-swan-dive",
        "13-single-leg-kick",
        "14-double-leg-kick",
    ),
    # Block IV is partially complete: only full-resolution originals 15–16.
    "IV": ("15-neck-pull", "16-high-scissors"),
}
HUE_ANCHORS = np.array(
    [0, 18, 40, 60, 100, 155, 190, 220, 250, 290, 345, 360], np.float32
)
# HSV hue interpolation transforms colours, never shapes or image proportions.
PALETTES = {
    "nocturne": {
        "hues": [38, 42, 45, 52, 171, 189, 204, 224, 238, 246, 394, 398],
        "sat": .85, "contrast": 1.06, "gain": .88, "lift": .015,
        "neutral_hue": 218, "neutral_sat": .085,
    },
    "venetian": {
        "hues": [11, 16, 28, 38, 130, 159, 176, 193, 206, 215, 371, 371],
        "sat": .72, "contrast": .92, "gain": 1.015, "lift": .043,
        "neutral_hue": 21, "neutral_sat": .055,
    },
    "botanical": {
        "hues": [66, 65, 62, 59, 105, 129, 137, 148, 160, 166, 426, 426],
        "sat": .42, "contrast": .97, "gain": .93, "lift": .019,
        "neutral_hue": 57, "neutral_sat": .034,
    },
    "chromatic": {
        "hues": [4, 11, 44, 48, 137, 190, 216, 230, 252, 295, 364, 364],
        "sat": 1.22, "contrast": 1.12, "gain": .99, "lift": -.005,
        "neutral_hue": 38, "neutral_sat": .055,
    },
}


def colour_grade(img: Image.Image, config: dict) -> Image.Image:
    data = np.asarray(img.convert("RGB").convert("HSV"), dtype=np.float32)
    h = data[:, :, 0] * (360 / 255)
    s = data[:, :, 1] / 255
    v = data[:, :, 2] / 255
    hue = np.mod(np.interp(h, HUE_ANCHORS, config["hues"]), 360)
    pigment = np.clip((s - .08) / .30, 0, 1)
    pigment = pigment * pigment * (3 - 2 * pigment)
    hue = hue * pigment + config["neutral_hue"] * (1 - pigment)
    saturation = np.clip(
        s * config["sat"] + (1 - pigment) * config["neutral_sat"] * (1 - s),
        0, .94
    )
    value = np.clip(
        ((v - .5) * config["contrast"] + .5) * config["gain"] + config["lift"],
        0, 1
    )
    value = np.where(value > .965, .965 + (value - .965) * .4, value)
    edited = np.stack(
        (hue * 255 / 360, saturation * 255, value * 255), axis=2
    )
    return Image.fromarray(
        np.uint8(np.clip(edited + .5, 0, 255)), "HSV"
    ).convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build MetaForma colour editions")
    parser.add_argument("--block", choices=BLOCKS, default="I")
    args = parser.parse_args()
    bases = BLOCKS[args.block]
    entries = []
    for base in bases:
        master_file = ART / (base + "-metaphysical-original.png")
        original_bytes = master_file.read_bytes()
        master_sha = hashlib.sha256(original_bytes).hexdigest()
        with Image.open(master_file) as opened:
            master = opened.convert("RGB")
        width, height = master.size
        # Original image generator output varies by a few pixels. Never resample.
        if width < 1400 or height < 1000 or abs(width / height - 4/3) > .02:
            raise RuntimeError(f"Unexpected original dimensions: {base}: {master.size}")
        # Web-optimised original, while keeping approved master PNG byte-identical.
        master.save(
            ART / (base + "-metaphysical-original.webp"),
            "WEBP", quality=91, method=6
        )
        for name, settings in PALETTES.items():
            recoloured = colour_grade(master, settings)
            png_file = ART / (base + "-" + name + ".png")
            web_file = png_file.with_suffix(".webp")
            if recoloured.size != master.size:
                raise RuntimeError("Palette altered source dimensions")
            recoloured.save(png_file, "PNG", compress_level=9)
            recoloured.save(web_file, "WEBP", quality=91, method=6)
            entries.append({
                "form": base, "palette": name, "png": png_file.name,
                "webp": web_file.name, "dimensions": list(master.size),
                "master_sha256": master_sha
            })
            print("GENERATED", png_file.name, web_file.name)
        if hashlib.sha256(master_file.read_bytes()).hexdigest() != master_sha:
            raise RuntimeError(f"Original master changed: {base}")
    (ART / ("block-" + args.block.lower() + "-palette-editions.json")).write_text(
        json.dumps({
            "schemaVersion": 1,
            "method": "HSV colour grading without geometric transforms",
            "variants": entries
        }, indent=2) + "\n", encoding="utf8"
    )
    print(f"SUCCESS: Block {args.block}, {len(bases) * 4} colour PNGs + {len(bases) * 5} full-resolution WebP editions")


if __name__ == "__main__":
    main()
