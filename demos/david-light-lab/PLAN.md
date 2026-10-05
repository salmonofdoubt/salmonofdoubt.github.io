# David Light Lab — Product & Build Plan

**Working title:** David Light Lab  
**Tagline:** Turn the sculpture. Move the light. Study the form.  
**Path:** /demos/david-light-lab/  
**Catalogue number:** 19  
**Initial release:** v0.1.0-beta

## 1. Product intent

David Light Lab is a studio reference instrument, not a general-purpose 3D viewer.

Its purpose is to let an artist choose a point of view, rotate a real sculpture around any axis, control illumination independently, compose the reference for a chosen paper/canvas format, add guides, lock the reference, and paint directly from the live screen.

Core principle:

> **Set the sculpture. Set the light. Set the format. Lock it. Paint.**

## 2. Source and provenance

Use the real public-domain 3D model:

- **Head from Michelangelo's David, KAS2232**
- Statens Museum for Kunst, Copenhagen
- plaster cast
- digital model: CC0 / Public Domain
- distributed through Wikimedia Commons

The production app should never depend on an embedded third-party viewer. The current beta fetches the raw public-domain STL directly from Wikimedia and parses it locally.

Future optimisation: create a browser-ready GLB/mesh derivative that preserves facial detail while reducing the 51.66 MB first-load cost.

## 3. Modes

### Explore
Everything movable. Use for investigation.

### Compose
Set head pose, camera, projection, light, paper/canvas format, crop and guides.

### Paint
The live reference becomes deliberately stable:

- reference locked;
- controls hidden;
- screen kept awake where supported;
- accidental drag/wheel/pinch cannot alter the study;
- deliberate action required to return to editing.

## 4. Object and camera

The sculpture and POV must remain conceptually separate.

### Sculpture
- X pitch
- Y turn
- Z roll
- free drag
- front / 3/4 / profile / back presets
- **Set current as front** calibration

### Camera
- orbit
- pan
- zoom
- fit/reset
- perspective
- orthographic
- field-of-view control

Orthographic projection is a core drawing feature because it removes perspective convergence and allows proportion study without lens distortion.

## 5. Locks

Independent:

- Lock POV / camera
- Lock head
- Lock light
- Lock crop/composition
- Lock guides
- Lock everything

When locked, the interface must ignore accidental pointer, wheel, pinch and keyboard changes.

A visible **REFERENCE LOCKED** state remains available in Paint Mode.

## 6. Lighting

Artist-facing controls:

- key-light azimuth
- elevation
- distance
- intensity
- softness / form-transition control
- fill / ambient

Presets:

- Front
- 3/4
- Side
- Top
- Under
- Rim
- Flat
- Dramatic

Two reference frames:

- **World lock** — light stays fixed while the sculpture rotates.
- **Head lock** — light rotates with the sculpture.

The beta uses a lightweight real-time shading model. A later renderer may add physically explicit area-light shadow softness.

## 7. Value study

Required visual modes:

- plaster
- grayscale
- 5-value
- 3-value
- silhouette

Background:

- adjustable neutral value
- later named presets: white / light grey / mid grey / dark grey / black

The 3-value mode is intended to support separation of light family, middle mass and shadow family.

## 8. Format and composition

### Paper / canvas presets

ISO:
- A5
- A4
- A3
- A2
- A1

Common:
- 1:1
- 2:3
- 3:4
- 4:5
- 5:7
- 16:9
- US Letter

Orientation:
- portrait
- landscape

Named formats display physical dimensions, e.g.:

**A3 Portrait · 297 × 420 mm**

The app represents the composition ratio. It does not claim the on-screen display is physically A3-sized.

### Crop frame

The selected format appears as a true crop boundary over the 3D view.

The artist can compose the head within that frame before locking the POV/crop.

## 9. Guides

Core overlays:

- halves / centre
- thirds
- diagonals

Controls:
- visibility
- opacity

Planned:
- quadrants
- golden section
- custom movable facial guides
- eye / brow / nose / mouth / chin lines

Guides must align to the selected crop frame, not the browser window.

## 10. Live reference

A first-class workflow.

Requirements:

- Paint Mode hides UI;
- optional crop and guides remain;
- exact POV remains unchanged;
- reference cannot be accidentally nudged;
- screen wake lock where browser support permits;
- no page scrolling during canvas manipulation.

## 11. Study tools

Implemented / targeted:

- timer
- random plausible pose/light study
- Freeze / Lock everything
- local save
- restore last study
- shareable URL state
- PNG export

Planned:
- named saved studies
- thumbnails
- multiple save slots
- reference + guide export
- transparent PNG
- printable reference sheet

## 12. Feature study shortcuts

Planned camera shortcuts:

- full head
- eyes
- nose
- mouth
- left ear
- right ear

These should only move the camera; they must not deform geometry.

## 13. PWA / template compliance

Follow the canonical Salmon of Doubt demo template:

- static Install button in index.html
- manifest with scope "./"
- service worker registered with scope "./"
- shared Demos return control
- shared Support control
- fixed DOI pill
- Cloudflare Web Analytics
- responsive shell
- mobile safe-area handling
- asset query versioning
- cache name bumps when shell behaviour changes

The large remote model is not precached in the beta.

## 14. Repository structure

demos/david-light-lab/
- index.html
- styles.css
- app.js
- stl-worker.js
- site-config.js
- manifest.webmanifest
- service-worker.js
- icon.svg
- README.md
- PLAN.md

## 15. v0.1.0-beta acceptance criteria

### Model
- loads automatically without manual file selection in normal conditions;
- local STL fallback exists;
- eyes, nose, lips, ears and hair remain represented by the source scan;
- no synthetic replacement head is used.

### Camera / pose
- free sculpture rotation works;
- Z roll works;
- camera can orbit separately;
- perspective and orthographic both work;
- POV can be locked.

### Light
- position and intensity changes visibly alter form;
- world/head light lock works;
- light can be independently locked.

### Composition
- A3 Portrait displays 297 × 420 mm;
- crop ratio is correct;
- halves/thirds align to the crop frame;
- crop can be locked.

### Paint
- controls can disappear;
- reference is locked;
- returning to Compose does not change the study.

### Persistence
- local save/restore works;
- share link reproduces study state.

### Mobile
- panel is collapsible;
- viewer uses touch without scrolling the page during direct manipulation;
- DOI/Support/Demos controls remain clear of one another.

## 16. Next technical priorities

1. Test the raw SMK STL orientation on desktop and mobile.
2. Verify Wikimedia cross-origin model fetch on GitHub Pages.
3. Profile parse/render time for the 51.66 MB source model.
4. Produce a web-optimised derivative mesh if first-load cost is excessive.
5. Improve normal smoothing if the raw STL facets are visually distracting.
6. Add true area-light / shadow-map softness if useful for painting studies.
7. Add named multi-study storage and feature-focus views.
8. Cut v0.1.0 stable release and mint Zenodo DOI.

## 17. Product statement

# David Light Lab

**An interactive 3D reference for drawing, painting and studying light.**

> **Turn the sculpture. Move the light. Study the form.**

The best version disappears once the artist begins drawing.
