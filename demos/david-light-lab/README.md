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

Open the demo and wait for the scan to load. The public-domain STL is fetched from Wikimedia Commons and parsed locally in a Web Worker.

- Drag: rotate the sculpture.
- Shift + drag: roll.
- Option/Alt + drag: orbit the camera.
- Right-drag: pan.
- Wheel/pinch: zoom.
- Space: enter/leave Paint Mode.

The first load is large because the source STL is approximately 51.66 MB. The repository deliberately does not duplicate that file.

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

The application shell is cached as a PWA. The large source model is intentionally not precached in v0.1.0-beta. A network connection is therefore required to fetch the scan unless the user opens a local copy of the STL.

## Status

**v0.1.0-beta**

The current build implements the core live-reference workflow. The detailed product and engineering roadmap is in [PLAN.md](./PLAN.md).

## Citation / DOI

A Zenodo placeholder is wired into the demo template pending the first stable release:

10.5281/zenodo.0000000

## Licence

The source scan is CC0 / Public Domain as described above. Application code follows the licence of the parent salmonofdoubt.github.io repository.
