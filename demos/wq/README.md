# Catchment Pulse Ireland

A map-first GitHub Pages PWA for Irish water-quality and hydrometric signals.

## Current scope

- OPW `waterlevel.ie` latest hydrometric GeoJSON.
- EPA Bathing Water API: locations, measurements and current alerts.
- EPA WFD Open Data API context searches for configured focus areas.
- Explicit scaffolding for groundwater, marine shore indicators and flow-concentration analysis.

## Focus areas

- Baldoyle Bay · Howth · Portmarnock · Malahide
- Nanny–Delvin Rivers

Focus areas are configured in `data/focus-areas.json`, not hard-coded into the interface.

## Scientific design

The app separates:

- live hydrometry
- latest official bathing-water chemistry
- WFD and groundwater classification context
- historical/periodic chemistry datasets
- planned C-Q analysis

The app must not imply that historical chemistry is live telemetry.

## Data update

The GitHub Action `refresh-wq.yml` runs every 15 minutes, respecting the OPW bulk access courtesy limit.

## References

Environmental Protection Agency. (2026). Bathing Water Open Data API. EPA Ireland. https://data.epa.ie/api-list/bathing-water-open-data/

Environmental Protection Agency. (2026). WFD Open Data API. EPA Ireland. https://data.epa.ie/api-list/wfd-open-data/

Environmental Protection Agency. (2026). EPA Geoportal download data. EPA Ireland. https://gis.epa.ie/GetData/Download

Office of Public Works. (2026). waterlevel.ie API. https://waterlevel.ie/page/api/
