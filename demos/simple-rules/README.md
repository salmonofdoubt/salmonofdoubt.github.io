# Simple Rules Explorer

Interactive educational demo for distinguishing four related but non-equivalent ideas:

1. **Order** — coherent flocking using Reynolds-style local rules.
2. **Complexity** — emergent flock-level patterns from local interactions and disturbance.
3. **Chaos** — deterministic sensitive dependence using the logistic map.
4. **Fractals** — Sierpiński chaos game and Newton basin boundaries.

## Scientific intent

The demo deliberately avoids claiming that visually disordered boids are mathematically chaotic, or that every repeated pattern is fractal. Each tab uses a mechanism appropriate to the concept being taught.

## Technical notes

- Static GitHub Pages compatible.
- No build step and no third-party JavaScript dependency.
- Canvas-based simulations.
- Uses shared `/demos/shared/` return, DOI and support controls.
- Zenodo DOI remains a placeholder until a release is archived.

## References

Devaney, R. L. (1989). *An introduction to chaotic dynamical systems* (2nd ed.). Addison-Wesley.

Grebogi, C., Ott, E., & Yorke, J. A. (1983). Fractal basin boundaries, long-lived chaotic transients, and unstable-unstable pair bifurcation. *Physical Review Letters, 50*(13), 935–938. https://doi.org/10.1103/PhysRevLett.50.935

May, R. M. (1976). Simple mathematical models with very complicated dynamics. *Nature, 261*, 459–467. https://doi.org/10.1038/261459a0

Reynolds, C. W. (1987). Flocks, herds, and schools: A distributed behavioral model. *Computer Graphics, 21*(4), 25–34. https://doi.org/10.1145/37402.37406
