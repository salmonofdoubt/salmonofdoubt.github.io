# River Basin Boundary Explorer

Interactive browser demonstration of a genuine three-attractor Newton fractal, with an optional Irish river analogy.

## Current interaction model

### Learn the fractal

- Run a guided experiment that finds two nearly identical starting points with different final outcomes.
- Zoom deeper into the sensitive edge.
- Click any pixel to classify its outcome.

### Explore the river analogy

1. Choose an Irish river reach for geographic context.
2. Click anywhere in the coloured outcome map to place the illustrative river-state point, or use **Place point near a sensitive edge**.
3. Apply a storm pulse or intervention.
4. Compare the colour before and after the movement. Crossing into another colour changes the illustrative final outcome.

The map supplies location only. It does not provide model input data.

## Stability and interface changes

- Experiment results remain inside their panel and no longer overlap later content.
- Hidden result panels are explicitly removed from layout.
- The fractal is calculated off-screen and presented only when complete, avoiding progressive redraw jitter.
- Wheel zoom is debounced.
- A river-mode click now changes the actual point from which storm and intervention movements begin.
- The previous and current points are connected by a visible arrow.
- Plain colour names replace abstract Outcome A, B and C labels.

## Scientific status

The fractal is mathematically genuine and is generated from Newton's method for `z³ = 1`. The river names, map locations, storm pulses and intervention vectors are illustrative. They do not establish fractal dynamics in the Nanny, Delvin or any other Irish river.

## Local preview

From the repository root:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/demos/fractal-river/
```
