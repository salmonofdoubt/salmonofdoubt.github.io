# MetaForma — Evidence-First Classical 34 Atlas

**Status:** Static, source-linked, anatomically unverified MetaForma artwork **withheld**.

Website route: `/demos/metaforma/`

## Progression and website controls

- Navigation now follows the six progression blocks supplied by the user: 1–4 Foundation & Warm-Up; 5–9 Rolling & Core Series; 10–14 Rotations & Inversions; 15–20 Torso & Leg Integration; 21–26 Lateral & Peak Balance; 27–34 Dynamic Flow & Culmination. All 34 exercise links and evidence records remain unchanged.
- Shared Salmon of Doubt **Support this work** menu (GitHub Sponsors and Buy Me a Coffee), using `../shared/demo-support.js` and its CSS.
- Shared **Zenodo DOI** control, currently `10.5281/zenodo.0000000` (pending; non-clickable until a real Zenodo archive exists), with metadata in `demos/data/demos.json`.
- **Install me** control, app manifest, SVG icon, browser-specific install instructions and scoped, network-first offline shell. Native installation availability varies by browser; externally linked human tutorials are not available offline.
- `test-site-controls.cjs` verifies these controls and the six-block grouping; GitHub Actions runs it beside the original evidence test.

## Published scope

- Classical 34 sequence in the same order and terminology as Lesley Logan's [online index](https://onlinepilatesclasses.com/blog/the-original-34-classical-pilates-mat-exercises/).
- Direct links to 34 independently located human tutorial pages.
- Key source correction: the overview link for exercise 8 opens a standing variation; this atlas links to [the seated Spine Stretch Forward mat tutorial](https://onlinepilatesclasses.com/pilates-exercises/mat-exercises/mat-spine-stretch-forward/).
- All illustrated AI exercise poses quarantined. **Zero generated images** are used for instructional movements.
- Original CSS metaphysical piazza is atmospheric only; it is not an exercise image.
- No animation, republished third-party images, or ungrounded exercise instructions.

## Machine-readable evidence and publishing gate

`evidence.json` has exactly 34 records with source URLs and explicit pose/art/instructor approval fields. `test-evidence.cjs` checks repertoire identity, duplicates, all 34 site links and prevents marking any drawing approved without complete keyframe, joint/contact and named instructor review fields.

Run: `node demos/metaforma/test-evidence.cjs` (from repository root). GitHub Actions executes the same test when this demo or its workflow is modified.

**A matching tutorial page is not biomechanical validation.** Human subject matter expertise is still required for teaching claims.

## Quarantined historic assets

The earlier 8 generated plates depict multiple incorrect anatomical and classical movement configurations (examples include Neck Pull, Crab and Control Balance misidentification and impossible foot/hip positions). They were never valid for educational instruction and are **not linked by this public atlas**. The archived creative exercise studies may be retained privately for art-direction reference, but must not be reintroduced as teaching aids.

## Reference

Lesley Logan. “Joseph Pilates’ 34 Original Mat Exercises: Complete Guide.” Online Pilates Classes, 7 September 2025. Individual exercise tutorial links are stored in `evidence.json`.

This is a research/art demo and not medical or exercise advice.
