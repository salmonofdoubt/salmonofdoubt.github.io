# Dark Rivers

Interaction prototype for a future EPA biological Q-value river-history demo.

## Visual grammar

- Dark reach: no observation has yet been revealed for that reach in the selected year.
- Small white flare: a sampling event occurs in that year.
- Reach colour: latest revealed biological Q-value class for that reach.
- Observation age: colour quietly fades as the latest revealed observation becomes older.
- Timeline scrub: reconstructs the visible knowledge state at any year.

Age fading is deliberately subtle and must never be interpreted as ecological deterioration or improvement. It represents only the age of the displayed observation.

## Prototype boundary

The current river geometry and sampling events are **illustrative**. They are deliberately labelled as prototype data in the interface so no synthetic observation can be mistaken for an EPA record.

The status mapping follows the EPA biological Q-value classes:

- High: Q5 / Q4-5
- Good: Q4
- Moderate: Q3-4
- Poor: Q3 / Q2-3
- Bad: Q2 / Q1-2 / Q1

## Production data adapter

`data.js` is the only prototype-data surface. Replace it with generated static data from the EPA Biological Q Stations + Biological Q Records and an authoritative river-network/reach dataset. The rendering and playback code can remain unchanged if the generated objects retain the same `reaches[]` and `events[]` interface.

## Design rule

Dark Rivers should remain restrained. Avoid permanent glows, saturated traffic-light colours, oversized pulses, animated basemaps, or decorative motion unrelated to sampling. Time means time; colour means observed class; brightness means observation age.

## Template compliance

Built from `/demos/demo-template/` conventions:

- static Install button in `index.html`
- local CSS loaded in `<head>`
- shared Demos and Support controls
- scoped manifest and service worker
- fixed bottom-right Zenodo DOI placeholder
- mobile safe-area handling
- versioned local assets and unique PWA cache


## Official data pipeline

The production path is now implemented in `ops/build_dark_rivers.py`.

It retrieves official EPA Web Feature Service layers for:

- water monitoring stations,
- historical and latest biological Q-value records,
- Cycle 3 river waterbody geometry.

The builder normalises Q values, joins observations to monitoring stations, uses the Water Framework Directive waterbody identifier where available, and clips a short local mapped reach around the monitoring station. This avoids presenting one station observation as if it directly measured an entire river.

Generated data is written to `data/official.json`. The browser prefers this validated static file and falls back to `data.js` only when an official build is unavailable.

A scheduled GitHub Actions workflow refreshes the official file weekly and preserves the last good file when the upstream build fails.
