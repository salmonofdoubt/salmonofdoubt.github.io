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

Open the demo and wait for the scan to load. A cleaned, indexed artist mesh derived from the Wikimedia Commons Scan the World model loads directly from the demo.

- Drag: rotate the sculpture.
- Shift + drag: roll.
- Option/Alt + drag: orbit the camera.
- Right-drag: pan.
- Wheel/pinch: zoom.
- Space: enter/leave Paint Mode.

The built-in derivative mesh is about 7.1 MB, substantially smaller than the roughly 57 MB source STL, and includes precomputed smooth vertex normals.

## Artist workflow

1. **Explore** — find the head angle and lighting.
2. **Compose** — choose projection, paper/canvas ratio, crop and guides.
3. **Paint** — lock the reference, hide the interface and work directly from the live view.

## Model source

**Michelangelo Buonarroti, _Head from the statue of David_, KAS2232**  
Statens Museum for Kunst, Copenhagen.  
Plaster cast. Digital 3D file released under CC0 / Public Domain.

Source:
https://commons.wikimedia.org/wiki/File:Michelangelo_Buonarroti,_Hoved_fra_statuen_af_David,_,_KAS2232,_Statens_Museum_for_Kunst,_3D_model.stl

The viewer performs an automatic axis-orientation heuristic because raw STL files do not carry a standard anatomical coordinate system. If required, rotate the sculpture and use **Set current as front**.

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
