# Geo Radar demo

A GitHub Pages-ready demonstrator for tracking Germany and EU funding routes relevant to geoscience, geochemistry, hydrogen, subsurface storage, geothermal systems, wetland interfaces, and sustainability-linked research.

## What it does

- filters funding routes by **scientific purpose** first
- then narrows by **applicant type**, **access route**, **grant scale**, **status**, **change type**, and **deadline window**
- surfaces recently changed items separately from the full list
- keeps a registry of tracked official sources
- is tuned to a senior GFZ/Potsdam-style profile rather than a generic grant browser
- works as a static site under `demos/geo-radar/`

## Folder contents

- `index.html` — main page
- `styles.css` — visual system
- `app.js` — filtering and rendering logic
- `data/catalog.json` — generated catalogue read by the browser
- `data/source-registry.json` — tracked websites and extraction rules
- `ops/harvest_grants.py` — conservative Python harvester
- `ops/requirements.txt` — Python dependencies
- `.github/workflows/refresh-geo-radar.yml` — scheduled GitHub Action

## Current thematic fit

This seed catalogue is designed around:

- geoscience and geochemistry
- hydrogen and subsurface storage
- geothermal and gas-monitoring routes
- investigator-led, network, consortium, and fellowship pathways
- Germany-first and EU-second opportunity scanning

## Local preview

From the directory root, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/demos/geo-radar/
```

## Refresh the catalogue locally

Install dependencies:

```bash
pip install -r demos/geo-radar/ops/requirements.txt
```

Run the harvester:

```bash
python demos/geo-radar/ops/harvest_grants.py
```

## Notes

This demo is intentionally conservative. GitHub Pages is static hosting, so the browser should not crawl arbitrary funding sites directly. Instead, the crawler writes a clean JSON catalogue ahead of time and the front end renders the result.

The initial source set prioritises:

- DFG investigator and network programmes
- ERC established-researcher routes
- Horizon and Clean Hydrogen consortium calls
- German applied-energy-research funding
- direct GFZ careers-page monitoring
- a GFZ-hosted fellowship route alongside the external RIFS page
- a Potsdam-relevant bridge fellowship route
