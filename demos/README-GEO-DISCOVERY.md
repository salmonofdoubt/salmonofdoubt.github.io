# Geo Radar discovery patch

This patch extends the existing `demos/geo-radar/` site with a discovery layer similar to Grant Radar.

Included:
- `demos/geo-radar/ops/discover_grants.py`
- `demos/geo-radar/review.html`
- `demos/geo-radar/data/discovery-candidates.json`
- `demos/geo-radar/data/source-memory.json`
- `.github/workflows/refresh-geo-radar.yml`
- updated `demos/geo-radar/index.html` with a `Review candidates` link

Important:
- discovery does NOT publish directly to `catalog.json`
- the public Geo Radar remains the trusted catalogue
- candidate pages are reviewed separately in `review.html`
