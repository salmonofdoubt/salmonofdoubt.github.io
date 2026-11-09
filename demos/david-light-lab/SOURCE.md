# David Light Lab: specimen provenance and reproduction

David Light Lab offers two distinct scans of Michelangelo's *David*. **The original Scan the World specimen remains the default.** The optional SMK specimen is a scan of a separate plaster cast, not a geometric enhancement of the original marble or of Scan the World's asset.

## A · Scan the World (default)

- **Source:** *David (Michelangelo).stl*, Wikimedia Commons: https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl
- **Digitisation:** Scan the World / Jonathan Beck
- **Method described by original source:** photogrammetry and structured light
- **Licence:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
- **Original scan:** approximately 57.22 MB STL covering the statue
- **Displayed derivative:** `assets/david-head.dlb`, 10,786,176 bytes; approximately 448,957 indexed triangles

The derivative retains the upper statue including head, shoulders and raised hand. Source and derivative licensing obligations remain in force.

### Rebuild

`python demos/david-light-lab/tools/build_mesh.py`

This script retains the upper portion of the full source and welds vertices, corrects face winding and computes area-weighted smooth normals.

## B · Statens Museum for Kunst KAS2232 (optional)

- **Source:** *Michelangelo Buonarroti, Hoved fra statuen af David*, KAS2232
- **Institution:** Statens Museum for Kunst (SMK), Copenhagen
- **Object:** plaster-cast head, approximately 1,370 × 800 × 675 mm
- **Licence:** Creative Commons CC0 1.0 Universal
- **Original source page:** https://commons.wikimedia.org/wiki/File:Michelangelo_Buonarroti,_Hoved_fra_statuen_af_David,_,_KAS2232,_Statens_Museum_for_Kunst,_3D_model.stl
- **Original STL:** 54,168,584 bytes; 1,083,370 triangles
- **Verified SHA-1 of original:** `ead5fae70be51dfc883a232ffd633ec236967c4a`
- **Packaged model:** `assets/david-smk-kas2232.dlb`, 26,000,796 bytes; 541,681 vertices and 1,083,370 triangles
- **Packaged SHA-256:** `7825d2b92d72e7571bf54437984cc1eb2bc8119611413d8dd14e50a95f9aad1e`

The separate model is larger and has more triangles, but this does **not** by itself prove higher anatomical fidelity. Compare eye, mouth, nose and ear details under identical lighting and zoom before judging it preferable.

### Rebuild

`python -m pip install numpy`

`python demos/david-light-lab/tools/build_smk_specimen.py`

The converter downloads the exact STL and verifies its length and SHA-1 before performing coordinate alignment, full-head scaling, vertex welding, degenerate-face removal, winding correction and area-weighted normal calculation. Its output is the same binary `DLB1` format used by David Light Lab.

## Browser behaviour and attribution

The Scan the World mesh is loaded first for ordinary visits. The SMK asset loads only on selection and is cached after first successful retrieval where browser storage allows. No second specimen is part of the install-time precache; users who have never selected it do not download it.

The app saves camera framing and anatomical focal-point calibration separately for each specimen. Older study links without a specimen identifier continue to resolve to Scan the World. A local STL can still be opened as a temporary third state, but cannot be reconstructed from a saved URL alone.

The source model is not sent to any additional third-party service by specimen switching. The visible provenance link identifies the currently selected specimen.

**Licensing note:** SMK's CC0 does not change the licensing of the original Scan the World model or derivative.
