# MetaForma · Metaphysical Kineticism

**Status:** Art-only exhibition. Block I has four approved painterly PNG originals and 16 colour-treated variants. Later blocks remain provisional scalable vector studies.

## Exhibition

- **34 distinct studies**, each with a title and a short curatorial description.
- **Five curated chromatic interpretations:** Metaphysical Original, Nocturne, Venetian Light, Botanical Silence, Chromatic Modernism.
- Six art-themed groups: Emergence, Suspension, Rotation, Tension, Equilibrium and Release.
- Responsive, keyboard-accessible gallery with artwork dialog, next/previous navigation, palette swatches and downloadable SVGs.
- No Pilates exercise teaching, anatomical claims, tutorial links or approval badges in the public interface.
- Artwork scales losslessly as vector graphics; no old low-resolution crop is enlarged or distorted.
- This vector series is a **functional interim release**, not a claim that the final individually rendered paintings are finished.

## Long-term image editions

The original 34-image composite and the earlier 170-file WebP package contain some crops only ~170–250 px wide. Those are unsuitable as large exhibition masters and are not referenced in the new public page.

When individual high-resolution painted studies are approved, they may replace or complement the present SVG edition **one artwork at a time**, keeping consistent IDs, titles, palettes and navigation. Do not stretch images or force object-fit:cover on artwork.

## Deployment / testing

Entry: `demos/metaforma/index.html`.

```bash
node demos/metaforma/test-site-controls.cjs
node demos/metaforma/test-evidence.cjs
node demos/metaforma/test-artwork-gallery.cjs
```

`art-gallery.js` and `art-gallery.css` are separate, cacheable static assets. The offline shell was versioned for the replacement.


## Block I painterly edition (Forms 01–04)

- 01 The Hundred, 02 Roll Up, 03 Roll Over, 04 Single Leg Circles. Canonical repertoire names and block boundaries remain unchanged.
- Four uploaded, user-approved 1448×1086 PNGs remain byte-identical. They are never cropped, stretched or overwritten.
- Palette generator `tools/generate_palettes.py` creates four additional colour-treated full-resolution PNGs per original, plus lightweight 1448×1086 WebPs for all 20 editions used by the gallery.
- Nocturne, Venetian Light, Botanical Silence and Chromatic Modernism are systematic transformations of the original pigment hues. They do not alter any geometric pixel locations; they preserve the architectural setting, transparent shapes and surface textures.
- The website's swatches switch among real painted image assets for the first four forms, rather than the earlier vector approximations. The remaining 30 studies stay in the provisional vector viewer until approved full-frame paintings exist.
- `test-palette-assets.cjs` checks the approved originals' Git blob SHA-1 and PNG dimensions, all 16 new PNGs, 20 WebPs, manifest, and no-crop display settings. Tests run in GitHub Actions.
- Gallery WebP files optimise browsing; the artwork viewer downloads the corresponding full-resolution PNG.

## Historical files

Legacy evidence.json, artwork-intake.json, original art images, old art loader and anatomy documentation remain in the repository for provenance. They are **not presented or linked** in the public art gallery. Existing bytes and their hash checks are preserved. Git history provides additional recovery.

## Future Pilates AI project

The gallery is intentionally independent. A potential Pilates AI practicum, if approved, could be introduced later as an **entirely separate route or opt-in section**, without turning the artwork gallery into teaching material.

No Zenodo DOI is claimed until a real archive exists.
