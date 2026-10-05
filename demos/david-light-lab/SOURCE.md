# Source model provenance

David Light Lab uses the public-domain 3D scan:

**Michelangelo Buonarroti — Head from the statue of David, KAS2232**

- Collection: Statens Museum for Kunst (SMK), Copenhagen
- Medium: plaster cast
- Dimensions listed by the source record: 1370 × 800 × 675 mm
- Digital file: STL
- Source file size: approximately 51.66 MB
- Licence: CC0 1.0 / Public Domain

Wikimedia Commons source:

https://commons.wikimedia.org/wiki/File:Michelangelo_Buonarroti,_Hoved_fra_statuen_af_David,_,_KAS2232,_Statens_Museum_for_Kunst,_3D_model.stl

The application does not claim authorship of the sculpture or source scan. The scan is fetched directly from Wikimedia Commons in the beta build and processed locally in the browser.

## Technical transformation

The beta STL worker:

1. reads the source triangles;
2. infers physical up/width/depth axes from the model bounding dimensions;
3. normalises the model into viewer space;
4. recomputes display normals;
5. renders the result locally with WebGL.

A future stable release may include an optimised derivative mesh to reduce download and parsing cost. Any such derivative will retain this provenance statement.
