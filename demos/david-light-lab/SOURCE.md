# Source model provenance

David Light Lab currently uses the Wikimedia Commons featured 3D model:

**David (Michelangelo).stl**

- Subject: Michelangelo's *David*
- Digitisation: Scan the World
- Method described by the source: photogrammetry and structured-light scanning
- Digital file: STL
- File size: approximately 57.22 MB
- Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

Wikimedia Commons source:

https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl

Attribution: Scan the World / Jonathan Beck via Wikimedia Commons.

## Technical transformation

The application does not store a modified copy of the source mesh in the repository. At runtime the browser:

1. downloads the source STL from Wikimedia Commons;
2. identifies the sculpture's major physical axes;
3. retains the upper portion containing the head, neck and shoulder region;
4. recentres and rescales that retained region for the artist viewport;
5. welds coincident display vertices conceptually by position and computes averaged smooth normals;
6. renders the result locally with WebGL.

This runtime extraction replaced the earlier SMK head-cast scan because that file contains substantial scan voids that remain visible under studio lighting.

The source model remains subject to CC BY-SA 4.0. The application code and surrounding site retain their own repository licensing.
