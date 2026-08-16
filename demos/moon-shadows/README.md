# Moon Shadows

**Moon Shadows** is an interactive Sun-view demonstrator for lunar-shadow geometry and solar-eclipse statistics.

## What the visualisation shows

The reference plane:

- passes through Earth's centre;
- is perpendicular to the instantaneous Earth-to-Sun direction;
- is viewed from the Sun.

At each time step a ray is extended from the Sun through the Moon. The point where that ray intersects the Earth-centred plane is retained only if the intersection lies downstream of the Moon. This means the page plots **physical lunar-shadow passes**, not merely the Moon's projected position.

The bundled dataset spans one complete lunar nodal cycle (6,793.48 days) beginning 2000-01-01. It contains 231 physical shadow passes and 42 actual solar eclipses.


## Interactive modes

### Real system

Explore the precomputed ephemeris tracks at true scale. Scrub through an individual shadow pass, jump to the next eclipse or miss, zoom from lunar distance to Earth, and optionally exaggerate the vertical display without changing the underlying coordinates.

### Eclipse roulette

A random physical shadow pass is shown without revealing whether it generated an actual catalogued solar eclipse. Make a hit/miss prediction, then reveal the closest approach and actual event classification.

### What if?

A deliberately labelled teaching sandbox transforms the real calculated tracks to explore sensitivity to:

- lunar orbital inclination;
- mean lunar distance;
- Earth target radius.

The resulting hit rates are synthetic sensitivity results, not new ephemeris predictions.

## Data

`data/shadow-tracks.json`
: Shadow-axis tracks sampled at six-hour intervals, with penumbra and central-cone radius at each point. Actual eclipse intervals are also included at ten-minute resolution.

`data/lunation-stats.csv`
: Minimum shadow-axis approach and minimum penumbral-edge approach for each physical pass.

`data/eclipse-events.json` / `.csv`
: Actual global solar eclipses in the same interval.

The coordinates were precomputed with Swiss Ephemeris 2.10.03 in Moshier mode. The visualisation itself is plain HTML/CSS/JavaScript and does not ship Swiss Ephemeris code.

## R analysis

From `demos/moon-shadows/analysis/`:

```bash
Rscript moon-shadows.R
```

The script uses base R only and produces SVG outputs under `analysis/output/`.

## PWA

The demo has its own web-app manifest and service worker. Once served from HTTPS, supporting browsers can install it and the core app/data are cached for offline use.

## Shared demo integration

The page uses the shared:

- floating Back to Demos control;
- Zenodo DOI control;
- Support this work control.

The installer also patches the demos index and `demos/data/demos.json` so Moon Shadows is discoverable and carries a pending Zenodo DOI.

## References

Astrodienst. (2026). *Swiss Ephemeris documentation*. https://www.astro.com/swisseph/

Espenak, F. (2012). *Eclipses and the Moon's orbit*. NASA Goddard Space Flight Center. https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html

MDN Web Docs. (2026). *Making PWAs installable*. https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
