# Three Intelligences Explorer

Static GitHub Pages demo intended to live at:

`https://salmonofdoubt.github.io/demos/intelligence/`

## Purpose

This demo visualises three interacting layers:

1. **Individual intelligence**: human-capital and capability proxies.
2. **Collective intelligence**: governance, coordination, and institutional-quality proxies.
3. **Planetary intelligence**: stewardship, emissions pressure, and ecological-system proxies.

It is intentionally transparent. It is not a formal country ranking.

## Deployment

Copy the `demos/intelligence/` folder into the repo.

Then update `demos/index.html` by adding the card supplied in:

`snippets/demos-index-card.html`

Alternatively, replace `demos/index.html` with the full updated version in:

`demos/index.html`

## Data behaviour

The browser first attempts to fetch public World Bank API data live. If the request fails, it uses:

`data/country_scores_fallback.csv`

The fallback data are illustrative only. Live API mode is the intended mode.

## Main files

- `index.html`: page structure using the existing site header/footer style.
- `styles.css`: local scoped styling for the explorer.
- `app.js`: fetches World Bank API values, computes scores, renders Plotly 3D.
- `data/countries.json`: country list.
- `data/indicators.json`: model logic and indicator weights.
- `data/sources.json`: source and modelling notes.
- `ops/build_worldbank_snapshot.py`: optional local script for creating frozen snapshots later.

## Suggested local test

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/demos/intelligence/
```

## Notes

Because the page uses browser fetch requests, do not test it by double-clicking the HTML file. Use a local Python server.
