# MetaForma · Metaphysical Kineticism

**Status:** Art-only, scalable-vector preview; review before merging. This replaces the public Pilates teaching/research atlas with an independent contemporary-art gallery.

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

## Historical files

Legacy evidence.json, artwork-intake.json, original art images, old art loader and anatomy documentation remain in the repository for provenance. They are **not presented or linked** in the public art gallery. Existing bytes and their hash checks are preserved. Git history provides additional recovery.

## Future Pilates AI project

The gallery is intentionally independent. A potential Pilates AI practicum, if approved, could be introduced later as an **entirely separate route or opt-in section**, without turning the artwork gallery into teaching material.

No Zenodo DOI is claimed until a real archive exists.
