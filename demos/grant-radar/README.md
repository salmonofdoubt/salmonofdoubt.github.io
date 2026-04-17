# Grant Radar demo

A GitHub Pages-ready demonstrator for tracking grants and calls in the nature, ecology, biodiversity, environmental, climate, and community-funding space.

## What it does

- filters opportunities by **purpose** first
- then narrows by **applicant type**, **access route**, **grant scale**, **status**, **change type**, and **deadline window**
- surfaces recently changed calls separately from the main list
- keeps a registry of tracked official sources
- includes both **major research calls** and **smaller community-scale funding routes**
- works as a static site under `demos/grant-radar/`

## Folder contents

- `index.html` – main page
- `styles.css` – visual system
- `app.js` – filtering and rendering logic
- `data/catalog.json` – generated catalogue read by the browser
- `data/source-registry.json` – tracked websites and extraction rules
- `ops/harvest_grants.py` – simple Python harvester
- `ops/requirements.txt` – Python dependencies for the harvester
- `.github/workflows/refresh-grant-radar.yml` – scheduled GitHub Action

## Deploy inside your demos directory

Create a folder such as:

```text
/demos/grant-radar/
```

Then copy these files into it. The page uses relative paths, so it will work from that subdirectory.

## Local preview

From the directory root, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Refresh the catalogue locally

Install dependencies:

```bash
pip install -r ops/requirements.txt
```

Run the harvester:

```bash
python ops/harvest_grants.py
```

## Notes

This demo is intentionally conservative. GitHub Pages is static hosting, so the browser should not be responsible for crawling arbitrary grant websites directly. Instead, the crawler writes a clean JSON catalogue ahead of time, and the front end renders that output.

The seeded dataset now demonstrates a mixed funding ecology:

- major research and consortium calls
- direct community micro-grants
- small and medium community funding streams
- routes that are only reachable **via local authority** or **via local action group**
- award/result announcements that still matter for tracking future cycles

## First edits you will probably want

- replace the placeholder code, issue and discussions URLs in `index.html`
- add more sources to `data/source-registry.json`
- tune regex extraction in `ops/harvest_grants.py`
- add more purpose tags that fit your NbS and ecology focus
- duplicate the seeded pattern for county-level or trust-level grants if you want a more local radar
