# Nanny-Delvin Water Radar

The Nanny-Delvin Water Radar is a daily, source-led catchment intelligence layer for the Nanny-Delvin Rivers Trust demonstrator.

It is not just a news feed. It is designed to help a rivers trust notice practical signals that may support restoration, monitoring, citizen science, funding, engagement, and evidence-based decision making.

## Public pages

- Radar: https://salmonofdoubt.github.io/demos/ndrt/news/
- Method page: https://salmonofdoubt.github.io/demos/ndrt/news/how-it-works/
- NDRT microsite: https://salmonofdoubt.github.io/demos/ndrt/

## Purpose

The guiding question is:

Does this help the Trust decide what to do, monitor, fund, explain, or avoid?

The radar therefore prioritises practical usefulness over exhaustive coverage.

## Four lanes

| Lane | Purpose |
|---|---|
| Ireland Catchment Practice | Irish catchment, restoration, water-quality, citizen-science, and community-action signals. |
| Waterbody Evidence and Alerts | Incidents, ecology, invasive species, river ecology, estuaries, lagoons, septic tanks, slurry timing, and monitoring signals. |
| Grants and Opportunities | Funding calls and support routes relevant to river trusts, biodiversity, education, citizen science, wetlands, and water quality. |
| Practical Research Papers and Reviews | Research ranked for practical usefulness, with Ireland first, comparable temperate systems second, and transferable NbS evidence where useful. |


## Nanny-Delvin locality logic

The radar now gives extra weight to local and near-local signals, including:

- Nanny-Delvin
- River Nanny
- River Delvin
- Nanny estuary
- East Meath
- North Fingal
- Balbriggan
- Gormanston
- Julianstown
- Laytown
- Bettystown
- Mornington
- Stamullen
- Duleek
- Naul
- Sonairte
- Meath, Louth, and Fingal council contexts

This is not a GIS boundary model. It is a textual locality boost that helps weak but relevant local signals rise above generic national or European items.

## Watched pressure categories

The radar watches for:

- septic / domestic wastewater
- manure / slurry timing
- agricultural runoff
- nutrients
- sediment / hydromorphology
- incident / alert
- invasive species
- birds / wetland ecology
- river ecology
- citizen science / monitoring
- NbS / restoration
- funding / grant
- policy / governance
- habitat / biodiversity
- estuary / lagoon

## Practical intelligence fields

Generated items may include:

| Field | Meaning |
|---|---|
| pressure_categories | Catchment pressures or practical themes detected in the item. |
| action_relevance | Short explanation of why the item may matter for Trust action. |
| local_relevance | Locality score and matched local terms. |
| opportunity_fit | Grant fit estimate, eligibility hint, and action needed. |
| research_use_type | Practical use type for research papers. |
| practical_fit | Research relevance label when available. |
| geographic_relevance | Ireland-first, comparable-temperate, or general-transferability signal. |

## Generated data files

| File | Role |
|---|---|
| data/news.json | Current radar output used by the public page. |
| data/archive/YYYY-MM-DD.json | Daily dated snapshot. |
| data/archive/index.json | Index of daily snapshots. |
| data/source-health.json | Source health, item counts, failures, and coverage summary. |
| data/weekly-digest.json | Practical shortlist ranked for Trust action. |
| data/source-registry.json | Source list and lane definitions. |
| data/curated-items.json | Manually curated fixed references and watch items. |

## Main scripts

| Script | Role |
|---|---|
| ops/discover_ndrt_news.py | Harvests news, official pages, grants, incidents, ecology, and practical catchment signals. |
| ops/enrich_ndrt_research.py | Adds relevant research papers and reviews using OpenAlex. |
| ops/audit_ndrt_radar.py | Builds source-health and weekly-digest operational files. |

## Refresh workflow

The GitHub Actions workflow is:

.github/workflows/refresh-ndrt-water-radar.yml

It runs daily at 05:21 UTC, which is 06:21 Irish summer time.

It can also be run manually from GitHub Actions.

The workflow runs:

- python demos/ndrt/news/ops/discover_ndrt_news.py
- python demos/ndrt/news/ops/enrich_ndrt_research.py
- python demos/ndrt/news/ops/audit_ndrt_radar.py

It commits changed generated files:

- demos/ndrt/news/data/news.json
- demos/ndrt/news/data/archive/
- demos/ndrt/news/data/source-health.json
- demos/ndrt/news/data/weekly-digest.json

## Local refresh

From the repository root:

    python3 -m pip install -r demos/ndrt/news/ops/requirements.txt

    python3 demos/ndrt/news/ops/discover_ndrt_news.py
    python3 demos/ndrt/news/ops/enrich_ndrt_research.py
    python3 demos/ndrt/news/ops/audit_ndrt_radar.py

Then serve locally:

    python3 -m http.server 8000

Open:

- http://127.0.0.1:8000/demos/ndrt/news/
- http://127.0.0.1:8000/demos/ndrt/news/how-it-works/

## Local sanity checks

    python3 -m py_compile demos/ndrt/news/ops/discover_ndrt_news.py
    python3 -m py_compile demos/ndrt/news/ops/enrich_ndrt_research.py
    python3 -m py_compile demos/ndrt/news/ops/audit_ndrt_radar.py

    python3 -m json.tool demos/ndrt/news/data/news.json >/dev/null
    python3 -m json.tool demos/ndrt/news/data/source-health.json >/dev/null
    python3 -m json.tool demos/ndrt/news/data/weekly-digest.json >/dev/null
    python3 -m json.tool demos/ndrt/news/data/archive/index.json >/dev/null

## Ranking philosophy

The radar is intentionally practical. It prioritises:

1. Nanny-Delvin local relevance.
2. Ireland-wide relevance.
3. Comparable temperate and north-west European relevance.
4. Practical pressure categories.
5. Freshness for news and incidents.
6. Trust action relevance.
7. Funding fit.
8. Research usefulness.

A highly relevant local or Irish practical signal may outrank a generic research item.

## Grant logic

Grant items are treated as opportunities, not ordinary news.

When possible, the radar adds:

- fit
- score
- eligible_hint
- action_needed

These are heuristic. Deadlines, eligibility, lead applicant, and match funding must still be checked manually.

## Research logic

Research enrichment is Ireland-first.

Research is ranked approximately as:

1. Ireland and Irish catchment evidence.
2. UK, Ireland, north-west Europe, and temperate comparable systems.
3. Transferable reviews and methods papers.
4. Distant single-place case studies only when clearly useful.

Research papers should support practical Trust decisions, monitoring, grant applications, communication, or restoration design.

## Known limitations

The radar is a decision-support aid, not an authority.

Known limitations:

- Google News RSS can miss relevant items.
- Official source pages can change layout.
- Some source pages may block automated requests.
- Grant deadlines usually require manual checking.
- Research relevance depends on metadata and abstract quality.
- Daily outputs may include duplicates or marginal items.
- The score is a prioritisation aid, not a factual rating.

## Maintenance notes

Good future improvements:

- review / promote workflow
- manual reject list
- deadline extraction for grants
- weekly digest page
- source failure history
- more local Nanny-Delvin place terms
- curated evidence library

Avoid adding unlimited watch terms without review. The stronger next step is editorial control: keep, reject, promote, and explain.

## File map

demos/ndrt/news/
├── index.html
├── how-it-works/
│   └── index.html
├── css/
│   └── news.css
├── js/
│   └── news.js
├── data/
│   ├── news.json
│   ├── weekly-digest.json
│   ├── source-health.json
│   ├── source-registry.json
│   ├── curated-items.json
│   └── archive/
│       ├── index.json
│       └── YYYY-MM-DD.json
└── ops/
    ├── discover_ndrt_news.py
    ├── enrich_ndrt_research.py
    ├── audit_ndrt_radar.py
    └── requirements.txt
