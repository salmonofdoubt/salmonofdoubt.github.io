# David Light Lab

**An interactive 3D reference for drawing, painting and studying light.**

> Turn the sculpture. Move the light. Study the form.

David Light Lab is an artist-focused browser tool built around a real 3D scan of the head from Michelangelo's *David*. It is designed as a live studio reference rather than a general 3D viewer.

## What it does

- free three-axis head rotation, including roll;
- separate camera orbit, pan and zoom;
- perspective and orthographic projection;
- front, three-quarter, profile and back presets;
- independently controllable key light and fill;
- light softness/form-transition control;
- world-locked or head-locked lighting;
- plaster, grayscale, 3-value, 5-value and silhouette modes;
- A-series and common canvas ratios;
- portrait/landscape crop frames;
- halves, thirds and diagonal composition guides;
- independent camera, light and crop locks;
- Paint Mode for a stable live reference;
- local study save/restore;
- shareable study state links;
- random study generator and timer;
- PNG reference export;
- installable PWA shell.

## Quick start

Open the demo and wait for the scan to load. The original Scan the World model loads by default. Choose **SMK · Plaster cast (HD)** in **Specimen** to load the separate Copenhagen plaster-cast scan on demand.

- Drag: rotate the sculpture.
- Shift + drag: roll.
- Option/Alt + drag: orbit the camera.
- Right-drag: pan.
- Wheel/pinch: zoom.
- Space: enter/leave Paint Mode.

The original indexed derivative is approximately 10.3 MiB; the optional SMK indexed derivative is 24.8 MiB. Both include precomputed smooth vertex normals. The original SMK source is not downloaded unless that specimen is selected.

## Artist workflow

1. **Explore** — find the head angle and lighting.
2. **Compose** — choose projection, paper/canvas ratio, crop and guides.
3. **Paint** — lock the reference, hide the interface and work directly from the live view.

## Two separately sourced specimens

| Specimen | Object | Model triangles | Licence |
| --- | --- | ---: | --- |
| **Original · Scan the World** (default) | Cropped full-statue scan, including shoulders and raised hand | 448,957 | CC BY-SA 4.0 |
| **SMK · Plaster cast (HD)** (optional) | SMK KAS2232, separate scan of a plaster-cast head | 1,083,370 | CC0 1.0 |

Sources and checksums are specified in [SOURCE.md](./SOURCE.md). The SMK mesh is a distinct object and is not a reconstruction of missing detail from the original scan. A higher triangle count does not guarantee improved anatomical accuracy.

The Specimen selector loads the alternative only when requested. Each specimen keeps its own camera framing and double-click anatomical focal-point calibrations. The original calibration data remains compatible with older releases. Saved studies and shared links now include the specimen identifier; older links without one still load Scan the World.

Switching specimens leaves lighting, value modes, crop and display tools intact. A newly selected specimen starts fitted to view rather than inheriting a 16× eye close-up. Returning to a previously viewed specimen restores its last framing. **Open local STL** remains available as a temporary fallback.

## Privacy

Study state is stored locally in the browser when the user chooses **Save study**. Shared study links encode the state in the URL. No drawing is uploaded. The parent Salmon of Doubt site includes Cloudflare Web Analytics.

## Offline behaviour

The application shell and cleaned David artist mesh are cached by the PWA service worker for offline use after installation/first cache fill. Local STL loading remains available as a fallback.

## Status

**v0.1.0**

The current build implements the core live-reference workflow. The detailed product and engineering roadmap is in [PLAN.md](./PLAN.md).

## Citation / DOI

Zenodo DOI for the software release:

10.5281/zenodo.23172580

## Licence

The source scan is CC0 / Public Domain as described above. Application code follows the licence of the parent salmonofdoubt.github.io repository.

### Lighting and close-up rendering (9 October 2026)

Direct light and specular highlights now respect self-shadowing through a six-face point-light depth map. Ambient fill remains deliberately uniform: set Fill / ambient to zero when checking which surfaces receive direct light. Shadow softness filters cast-shadow edges; it is an approximation, not an area-light or indirect-light simulation.

Perspective zoom magnifies the camera projection instead of scaling the sculpture toward the lamp. The canvas supports high-density screens up to 2.5×, with a six-million-pixel budget. Static views are not repeatedly drawn, and shadow maps are rebuilt only after the head, lamp or mesh changes. The existing 448,957-triangle scan is unchanged; rendering cannot reconstruct finer detail absent from that source.

A deterministic regression test uses a receiver and blocker to check occlusion, ambient fill and zoom invariance. With a local server running at port 8090 and Playwright available, run `node demos/david-light-lab/tests/lighting-regression.cjs`. Override `DAVID_TEST_URL` for another port; `CHROMIUM_EXECUTABLE` and `CHROMIUM_ARGS` support a custom Chromium installation.

### Anatomical navigation and detailed inspection (9 November 2026)

The Camera panel now includes **Both eyes**, **Left eye**, **Right eye**, **Nose**, **Mouth**, **Left ear**, and **Right ear**. Each moves **only the camera**, without altering the sculpture pose or the lamp. The first focus position is estimated from the scan's coordinates. For exact alignment, **double-click** the desired detail while a shortcut is active; on touchscreens **double-tap**. This centres the actual 3D surface point and calibrates that shortcut on the current device. These calibrations are stored separately from existing v1 study saves and can be refined again.

Zoom now extends from **0.45× to 16×**, and the mouse wheel zooms toward the cursor. Right-drag pans in the screen's direction at a speed adapted to the current magnification. Two fingers pinch and pan together. The + / − controls offer repeatable increments, while **Fit head** restores the full view. Existing saved studies and share links with two-component pan values remain compatible.

Close-ups use bounded adaptive supersampling to reduce edge jaggedness. The underlying scan remains untouched, and zoom cannot reveal geometric detail beyond what the 3D source contains.

To run the camera interaction regression with a local server and Playwright installed:
`node demos/david-light-lab/tests/navigation-regression.cjs`.

### Studio Detail (9 November 2026)

The Camera panel offers an optional **Studio Detail** checkbox. It is **off by default** to preserve existing rendering on older hardware. When enabled, the view renders at normal quality during movement. After 360 milliseconds without camera, sculpture or lighting changes, David is redrawn once with:

- bounded, device-aware canvas supersampling (up to 3.25× backing scale, 12 million desktop pixels or 6.5 million mobile pixels, subject to the graphics device's viewport limits);
- a denser 5×5 shadow-filter sampling pattern over the original footprint instead of the interactive 3×3 pattern;
- live status indicating when detail refinement has completed.

The option is remembered separately from existing saved studies, so shared study URLs, lock states, original lighting settings and offline mesh data are unchanged. The image export uses the currently displayed canvas resolution. Refinement can consume more graphics power and may not add visible detail at the scan's geometric limit. No artificial features, mesh smoothing or new texture data are generated.
