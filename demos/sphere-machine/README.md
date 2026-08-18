# Sphere Machine · Rotational Envelope Lab

Interactive GitHub Pages demo for exploring rotational orbits and outer envelopes of standard 3D solids and thin 2D forms.

## Scientific idea

A rigid rotation preserves the distance of every material point from the rotation centre:

`||R x|| = ||x||` for orthogonal rotation matrices `R`.

Therefore, any chosen point moves on a spherical shell of fixed radius. A single rotation axis normally produces a circle or ring. A richer orientation programme can send fixed-radius outer points through many more directions, making the accumulated outer envelope approximately spherical.

The interface deliberately distinguishes the instantaneous object from its accumulated rotational envelope. It does **not** claim that a cube literally becomes a sphere.

## Shapes

- Cube
- Square pyramid
- Tetrahedron
- Octahedron
- Icosahedron
- Sphere
- Cylinder
- Cone
- Torus
- Thin triangle
- Thin circle
- Thin rectangle

## Controls

- Independent X/Y/Z axis toggles
- Independent angular velocity from -180 to +180 degrees per second
- Still, X-only, XY weave, and XYZ sphere-search presets
- Clear envelope, reset orientation, and reset camera
- Toggle trail, reference sphere, axes, and object edges
- Trace-density control

## Implementation

- Static HTML/CSS/JavaScript suitable for GitHub Pages
- Three.js 0.160.1 pinned through an import map
- OrbitControls for camera manipulation
- 30,000-point bounded trace buffer
- Equal-solid-angle directional occupancy approximation using uniform z and azimuth bins
- Responsive desktop/mobile layout and reduced-motion handling

## Concept reference

https://zenodo.org/records/16985564
