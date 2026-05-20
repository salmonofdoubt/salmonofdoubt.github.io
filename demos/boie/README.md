# Birds of Ireland Sound Atlas, BOIE

Birds of Ireland Sound Atlas, BOIE, is a public GitHub Pages demo for exploring birds recorded on the Irish checklist by sound, image, month, habitat, approximate location, and broad ornithological grouping.

Live demo:
https://salmonofdoubt.github.io/demos/boie/

Source folder:
demos/boie/

## What BOIE does

BOIE turns a national bird checklist into an interactive listening and learning tool.

It provides:

- A searchable list of bird species recorded in Ireland.
- Representative bird sounds where public xeno-canto recordings are available.
- Representative images where public Wikimedia or Wikipedia-linked images are available.
- A Birds Near Me mode that estimates which birds are plausible around a chosen place and month.
- A map for approximate location selection.
- Habitat presets such as garden, park, farmland, river, estuary, coast, and bog/upland.
- Grouping by local likelihood, checklist/taxonomic group, habitat guild, or seasonal status.
- A Today’s likely chorus panel that can play a small group of likely bird sounds together.

BOIE is an educational and research-facing public demo. It is not an official bird checklist, a live biodiversity sensor, or a substitute for local field verification.

## Main user modes

### Full catalogue mode

Shows the full harvested checklist. Users can search, sort, filter by status or audio availability, and browse all species.

### Birds Near Me mode

Uses selected month, approximate map location, radius, habitat chips or habitat preset, broad species ecology, and rarity/historical-record penalties to build a local seasonal deck.

The deck asks:

What might I plausibly hear here this month?

It does not claim:

What is present here right now?

## Local match model

Each species receives a local plausibility score internally. The public interface presents this as Local match: High, Medium, or Low.

The score is based on broad heuristic factors:

- Month fit.
- Habitat fit.
- Coastal, estuarine, urban, inland, or upland signal.
- Rarity penalty.
- Historical-record penalty.
- Availability of sound and image metadata.

This is a transparent educational model, not a statistical species distribution model.

## Data sources

### Irish checklist layer

The checklist layer is harvested from:
https://en.wikipedia.org/wiki/List_of_birds_of_Ireland

BOIE preserves available status codes:

| Code | Meaning used in BOIE |
|---|---|
| A | Recorded naturally in Ireland since 1 January 1950 |
| B | Recorded naturally before 31 December 1949, but not subsequently |
| C | Introduced or established from introduced populations |
| R | Rarity requiring substantiating details |

For formal ornithological use, check against the Irish Rare Birds Committee, BirdWatch Ireland, and current authoritative checklist material.

### Sound layer

The sound layer is harvested from xeno-canto:
https://xeno-canto.org

BOIE stores remote audio links and metadata. It does not copy or redistribute audio files inside this repository.

Each sound card aims to retain species name, recording type, recordist, recording country, quality grade, source URL, and licence.

xeno-canto API v3 requires an API key:

export XENO_CANTO_API_KEY="your_key_here"
python demos/boie/ops/harvest_birds.py

Never commit the API key.

### Image layer

The image layer is enriched from public Wikimedia/Wikipedia-linked image metadata.

BOIE stores remote thumbnail/source URLs and metadata. It does not copy or redistribute image files inside this repository.

Each image card aims to retain source, linked source page, photographer or artist where available, licence where available, and Commons or Wikipedia source URL.

## Attribution policy

BOIE does not claim ownership of third-party bird sounds or images.

Third-party media remain the work of their original creators and are used under the licence metadata supplied by the source.

Each bird card exposes media attribution where available. A generated attribution index is maintained in:

- demos/boie/ATTRIBUTION.md
- demos/boie/attribution.html

Regenerate it with:

python demos/boie/ops/build_attribution.py

## Commercial-use caution

BOIE may be developed as a public app or educational product, but monetisation requires careful licence filtering.

Before any commercial or app-store release:

- Exclude or obtain permission for non-commercial media licences.
- Retain attribution on cards and in the attribution index.
- Do not market third-party sounds or images as owned by BOIE.
- Verify each file’s current source licence before redistribution or packaging.
- Prefer linking to media rather than bundling third-party media files.

This README is not legal advice.

## Privacy

BOIE may use browser geolocation when the user chooses Use my approximate location.

Current design intent:

- Location is used only in the browser session.
- BOIE does not require an account.
- BOIE does not store the user’s coordinates.
- Map clicks and geolocation are used only to sort or score the local bird deck.

If analytics, advertising, accounts, or app-store distribution are added later, the privacy statement must be reviewed.

## Local development

Serve from repository root:

python -m http.server 8000

Open:

http://127.0.0.1:8000/demos/boie/

Hard refresh after JavaScript or CSS changes:

Cmd + Shift + R

## Data refresh

Install dependencies:

pip install -r demos/boie/ops/requirements.txt

Harvest checklist and sound metadata:

export XENO_CANTO_API_KEY="your_key_here"
python demos/boie/ops/harvest_birds.py

Add or refresh image metadata:

python demos/boie/ops/enrich_bird_images.py

Build attribution index:

python demos/boie/ops/build_attribution.py

Check generated JSON:

python -m json.tool demos/boie/data/birds.json >/dev/null
python -m json.tool demos/boie/data/coverage.json >/dev/null

Check JavaScript syntax:

node --check demos/boie/app.js

## File structure

demos/boie/
  index.html
  app.js
  styles.css
  README.md
  ATTRIBUTION.md
  attribution.html
  data/
    birds.json
    coverage.json
  ops/
    harvest_birds.py
    enrich_bird_images.py
    build_attribution.py

## Known limitations

- The local deck is heuristic.
- The map does not yet use live eBird, GBIF, or BirdTrack occurrence records.
- Habitat guilds are broad and rule-based.
- Some rare, historical, or taxonomically complex species may have weak metadata.
- Some sounds or images may be missing.
- Media licence metadata should be reviewed before monetisation or app-store release.

## Future improvements

Potential next steps:

- eBird or GBIF-backed local occurrence scoring.
- Offline PWA support.
- Better Irish habitat layers.
- More precise coast and estuary detection.
- Media licence filter for commercial-compatible builds.
- Android app wrapper after PWA hardening.
