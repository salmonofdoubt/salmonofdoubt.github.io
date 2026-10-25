# MetaForma — Evidence-First Classical 34 Atlas

**Status:** Static evidence-first gallery. Forms 01–09 original artwork hosted and staged for visual review; no Pilates instructor-verification claimed.

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
- Previous anatomy-defective generated poses remain quarantined. The 9 new user-submitted Gemini plates are **distinct incoming art assets** and are shown as works of art, not teaching-certified demonstrations. They are not instructor-verified.
- The original CSS metaphysical piazza remains atmospheric only. All six progression blocks now have a distinct named de Chirico-inspired architectural setting.
- No animation, republished third-party images, or ungrounded exercise instructions.
- New `artwork-intake.json`, `artwork-gallery.js`, and `art/README.md` document the nine original-file mappings and completed original binary upload. Missing art shows a placeholder, not a broken image. The optional local preview loads from your own device and does **not** upload artwork.

## First batch of illustrated plates (visual review only)

- **Block I — Setting I, The Piazza of the Cypresses:** 01 The Hundred, 02 Roll Up, 03 Roll Over, 04 One Leg Circle. Four earlier Gemini JPEGs supplied in chat.
- **Block II — Setting II, The Silent Red Tower:** 05 Rolling Back, 06 Single Leg Stretch, 07 Double Leg Stretch, 08 Spine Stretch, 09 Open Leg Rocker. Five principal PNG files in the supplied Block II ZIP; variants are deliberately excluded.
- **Form 06:** The main submitted image depicts a different architectural setting; it remains a review candidate, not final.
- **Original file preservation:** All nine images were uploaded directly to GitHub as JPEG/PNG and checked against the ZIP originals. SHA-1 content hashes are recorded in `artwork-intake.json` and verified in CI. No replacement or re-encoding is permitted without explicit review.

## Block III intake — artwork pending

**Setting III: Piazza d'Italia — The Portico of Ariadne** (ochre arcades, central statue on pedestal, emerald sky; no trains).

- 10 Cork-Screw — SUPINE LEGS UP → RIGHT CIRCLE SWEEP → THE CORK-SCREW.
- 11 The Saw — SEATED ARMS WIDE → AXIAL SPINE TWIST → THE SAW.
- 12 Swan-Dive — PRONE EXTENSION → FORWARD ROCK → THE SWAN-DIVE.
- 13 One Leg Kick — FOREARM SPHINX → RIGHT HEEL KICK → THE ONE LEG KICK.
- 14 Double Kick — PRONE HANDS CLASPED → DOUBLE HEEL KICK → THE DOUBLE KICK.

These labels come from the user's supplied three-pose design brief. **The corresponding image files have not been uploaded.** Five reserved gallery slots use provisional names `10.png`–`14.png`, subject to inspecting the actual ZIP (preserve JPEG/PNG source format, not renaming extensions incorrectly). The gallery links to human reference tutorials remain present. Instructor verification has not been granted.

## Machine-readable evidence and publishing gate

`evidence.json` has exactly 34 records with source URLs and explicit pose/art/instructor approval fields. `test-evidence.cjs` checks repertoire identity, duplicates, all 34 site links and prevents marking any drawing approved without complete keyframe, joint/contact and named instructor review fields.

Run: `node demos/metaforma/test-evidence.cjs` (from repository root). GitHub Actions executes the same test when this demo or its workflow is modified.

**A matching tutorial page is not biomechanical validation.** Human subject matter expertise is still required for teaching claims.

## Quarantined historic assets

The earlier 8 generated plates depict multiple incorrect anatomical and classical movement configurations (examples include Neck Pull, Crab and Control Balance misidentification and impossible foot/hip positions). They were never valid for educational instruction and are **not linked by this public atlas**. The archived creative exercise studies may be retained privately for art-direction reference, but must not be reintroduced as teaching aids.

## Reference

Lesley Logan. “Joseph Pilates’ 34 Original Mat Exercises: Complete Guide.” Online Pilates Classes, 7 September 2025. Individual exercise tutorial links are stored in `evidence.json`.

This is a research/art demo and not medical or exercise advice.
