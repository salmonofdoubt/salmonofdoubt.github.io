# Source model provenance

David Light Lab uses the Wikimedia Commons featured 3D model:

**David (Michelangelo).stl**

- Subject: Michelangelo's *David*
- Digitisation: Scan the World
- Method described by the source: photogrammetry and structured-light scanning
- Digital source file: STL
- Source file size: approximately 57.22 MB
- Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

Wikimedia Commons source:

https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl

Attribution: Scan the World / Jonathan Beck via Wikimedia Commons.

## Included derivative mesh

The repository includes:

`assets/david-head.dlb`

This is a cleaned, indexed derivative generated from the source scan for David Light Lab. It retains the upper sculpture region used by the artist viewer and stores:

- welded vertex positions;
- precomputed smooth vertex normals;
- indexed triangles.

The derivative is approximately 7.1 MB. It remains subject to the source model's CC BY-SA 4.0 licence.

## Reproducible preprocessing

`tools/build_mesh.py` documents the transformation used to generate the derivative:

1. download the Wikimedia source STL;
2. identify the sculpture's major physical axes;
3. retain the upper region containing head, neck and shoulders;
4. reorient, centre and rescale it for the viewer;
5. weld coincident STL vertices;
6. remove degenerate triangles;
7. align face winding with source normals;
8. compute area-weighted smooth vertex normals;
9. write the indexed `DLB1` browser mesh.

This preprocessing replaced the earlier strategy of guessing/fixing raw STL normals at runtime. The browser now receives deterministic geometry and normals rather than repairing the source on every load.
