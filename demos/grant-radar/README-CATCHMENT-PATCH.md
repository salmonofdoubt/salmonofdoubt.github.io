# Grant Radar practical catchment patch

This patch strengthens Grant Radar for practical Irish catchment and water-quality delivery.

Included:
- `demos/grant-radar/ops/seed_catchment_routes.py`
- `demos/grant-radar/ops/harvest_grants.py`
- `demos/grant-radar/ops/discover_grants.py`
- `demos/grant-radar/app.js`
- `.github/workflows/refresh-grant-radar.yml`

What it does:
- adds and tunes practical Irish water-quality routes such as LAWPRO Catchment Support Fund, Farming for Water EIP, ACRES, Better Farming for Water, ASSAP, Signpost, and IFI Habitats & Conservation
- introduces discovery-only hubs to improve the review queue without polluting the trusted live catalogue
- simplifies applicant filtering by normalising to categories such as `local groups`, `farmers`, `public bodies`, and `researchers`
- simplifies scale labels to `local`, `support`, `medium`, and `major`
- preserves the existing research and community routes already in the catalogue

How to apply:
1. Copy these files into the matching paths in your repo.
2. Commit and push.
3. Run the refreshed GitHub Action once.
