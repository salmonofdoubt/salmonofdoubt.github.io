# Release notes

## v0.1.0

DOI: https://doi.org/10.5281/zenodo.20200900

Initial archival release of the Ireland Energy Transition Monitor.

### Includes

- Static dashboard: `index.html`, `app.js`, `styles.css`.
- Layperson method page: `method.html`.
- Zenodo-facing documentation: `README.md`.
- Generated dashboard data: `data/monitor.json`.
- Source data layers in `data/source/`.
- Demand-pressure forecast/scenario JSON.
- Python data pipeline in `ops/`.
- Validation scripts for monitor and current electricity data.

### Scope

This release is a research and civic-data prototype. It is not an official government, system-operator, market, or forecasting product.

### Known limitations

- Some source harvesters depend on public pages or endpoints that may change.
- Demand-pressure pathways are transparent scenarios, not official forecasts.
- EV demand is modelled rather than directly metered at national level.
- Some data layers may use fallback values when primary source data are unavailable.
- Validation logic is being hardened iteratively.
