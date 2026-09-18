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
