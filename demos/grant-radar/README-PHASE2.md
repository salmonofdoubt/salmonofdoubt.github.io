# Grant Radar Phase 2 patch

This patch improves the **existing** Grant Radar codebase without replacing its trusted tracker.

## What it adds

- `ops/discover_grants.py`
  - scans trusted domains derived from `data/source-registry.json`
  - discovers candidate funding pages
  - writes `data/discovery-candidates.json`
  - writes `data/source-memory.json`
  - auto-extends registry entries with Phase 2 defaults if fields are missing

- `review.html`
  - lightweight reviewer page for discovery candidates
  - intended to sit beside the live radar without publishing candidates automatically

- `.github/workflows/refresh-grant-radar.yml`
  - runs discovery before the trusted harvest
  - commits discovery data and source-memory data

## Important design rule

Discovery does **not** publish directly to `catalog.json`.

The trusted live site should continue to be written only by `ops/harvest_grants.py`.

## Files included

- `.github/workflows/refresh-grant-radar.yml`
- `demos/grant-radar/ops/discover_grants.py`
- `demos/grant-radar/review.html`
- `demos/grant-radar/data/discovery-candidates.json`
- `demos/grant-radar/data/source-memory.json`

## Apply

Copy these files into the matching paths in your repository root.

## Notes

This patch assumes your existing `source-registry.json`, `catalog.json`, `harvest_grants.py`, and `requirements.txt` remain in place.
