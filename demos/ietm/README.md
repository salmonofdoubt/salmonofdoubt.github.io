# Ireland Energy Transition Monitor

An independent civic prototype for tracking Ireland's electricity transition using public data, generated JSON, transparent caveats, and scenario-based stress testing.

Live demo path:

    /demos/ietm/

Layperson method page:

    /demos/ietm/method.html

## Plain-language summary

The Ireland Energy Transition Monitor asks four questions:

1. What is happening on Ireland's electricity system now?
2. How much of the current generation mix is renewable, thermal/other, or interconnection-related?
3. Is Ireland moving fast enough toward the 2030 renewable-electricity target?
4. How could extra electricity demand from data centres and electric vehicles widen the catch-up burden unless matched by additional renewable electricity?

This is not an official dashboard. It is an independent, reproducible civic data product designed to make public energy-transition information easier to inspect, question, and reuse.

## Core idea

The dashboard separates three things that are often mixed together:

    live electricity conditions
    annual renewable-electricity progress
    future demand-pressure scenarios

The 2030 RES-E target is treated as a fixed goalpost. Extra electricity demand does not move that official target. However, it can make the target harder to reach because total electricity demand grows.

In simple terms:

    RES-E share = renewable electricity / total electricity demand

If data centres and EVs increase total demand, additional renewable electricity is needed just to keep the same renewable share. If that extra demand is not matched by additional renewable generation and flexibility, the projected gap to the 2030 target widens.

## What the dashboard shows

| Layer | Meaning | Status |
|---|---|---|
| Current grid pulse | Near-current generation, renewables, wind, solar, thermal/other, interconnection, and data-quality flags | harvested/generated |
| Today at a glance | simplified current electricity cards | generated |
| RES-E trajectory | annual renewable electricity progress against the 2030 benchmark | official annual indicator, transformed |
| Demand pressure | data-centre and EV-related electricity demand pressure | mixed: measured, forecast, modelled |
| Demand-pressure scenarios | low, central, high stress-test envelopes | scenario model |
| Gap-widening visual | shows how unneutralised demand can pull the projected RES-E trend downward | modelled scenario visual |
| Data caveats | explains withheld values, mismatches, missing sources, and fallback behaviour | generated/static |

## What this project is not

This project is not:

- an official Government of Ireland, EirGrid, SEAI, CRU, CSO, or EPA product;
- a trading, investment, or operational grid-dispatch tool;
- a deterministic forecast of Ireland's future electricity system;
- a claim that data centres or EVs automatically prevent the 2030 target from being reached.

It is a transparent public-interest interpretation layer built on reproducible generated data.

## State of the art and positioning

This project sits between several existing categories:

1. Live grid dashboards. These are useful for showing current system conditions, but they often do not connect real-time conditions to long-term policy accountability.
2. Official annual energy statistics. These provide authoritative retrospective indicators, but they are not always easy for the public to connect with current grid conditions or emerging demand pressures.
3. Open civic dashboards. These prioritise transparency, accessibility, and public interpretation, but can become fragile if source volatility, uncertainty, and caveats are not documented.
4. Scenario-based energy-transition analysis. These help reason about possible futures, but must clearly separate observed data, forecasts, assumptions, and speculative scenarios.

The Ireland Energy Transition Monitor connects these layers in a lightweight, reproducible static web format. Its contribution is not that it predicts the future with certainty. Its contribution is that it makes the transition-accountability problem visible: current progress, target distance, data uncertainty, and the possible effect of additional electricity demand.

## Repository structure

    demos/ietm/
    ├── index.html
    ├── app.js
    ├── styles.css
    ├── README.md
    ├── data/
    │   ├── monitor.json
    │   ├── history/
    │   │   └── daily.json
    │   └── source/
    │       ├── electricity.json
    │       ├── truth_meter.json
    │       ├── prices.json
    │       ├── market_prices.json
    │       ├── counties.json
    │       ├── county_hosting.json
    │       ├── target_tracker.json
    │       ├── demand_pressure_scenarios.json
    │       ├── demand_pressure_forecast.json
    │       └── metadata.json
    └── ops/
        ├── run_pipeline.py
        ├── build_monitor.py
        ├── validate_monitor.py
        ├── validate_current_electricity.py
        ├── harvest_eirgrid.py
        ├── harvest_eirgrid_co2.py
        ├── harvest_smartgrid_live.py
        ├── harvest_smartgrid_api_live.py
        ├── harvest_seai_prices.py
        ├── harvest_daily_market_prices.py
        ├── build_target_tracker.py
        ├── build_demand_pressure_forecast.py
        ├── update_daily_history.py
        ├── seed_daily_history.py
        └── requirements.txt

## Data pipeline

The dashboard is a static webpage. The browser does not scrape external sources directly. Instead, Python scripts and GitHub Actions generate stable JSON files.

    external public sources
            ↓
    Python harvesters / builders
            ↓
    source JSON files in data/source/
            ↓
    build_monitor.py
            ↓
    data/monitor.json
            ↓
    frontend dashboard reads local static JSON

This keeps the public page lightweight and reduces the risk that a browser session fails because a public source is slow, blocked, unavailable, or structurally changed.

## Refresh workflow

The intended automated workflow is:

    GitHub Actions schedule
            ↓
    install Python dependencies
            ↓
    run ops/run_pipeline.py
            ↓
    validate generated data
            ↓
    commit changed JSON files
            ↓
    GitHub Pages serves updated dashboard

The workflow file is:

    .github/workflows/refresh-energy-monitor.yml

## Validation philosophy

The validation system distinguishes between fatal errors and warnings.

Fatal errors should be reserved for conditions that make the published data mathematically invalid or structurally broken, such as:

- invalid JSON;
- missing required core fields;
- generation mix not reconciling near 100%;
- renewable components not reconciling with reported renewable share;
- interconnection percentage and MW values disagreeing beyond tolerance;
- a demand card being shown when the demand balance check failed.

Warnings should be used for source volatility or plausible-but-uncertain conditions, such as:

- solar generation being zero at night;
- other-renewables remainder being unusually high;
- CO2 data being unavailable;
- fallback county data being used;
- demand being withheld because generation, interconnection, and demand do not reconcile.

The pipeline should fail on impossible mathematics, not on normal night-time solar behaviour or source incompleteness.

## Current electricity model

The current electricity layer uses a generation-basis model.

| Term | Meaning |
|---|---|
| generation_mw | current system generation basis used by the dashboard |
| demand_mw | current demand where available and coherent |
| renewables_percent | reported or derived renewable percentage |
| wind_percent | wind component |
| solar_percent | solar component |
| other_renewables_percent | calculated renewable remainder |
| thermal_other_percent | non-renewable or residual generation share |
| net_import_percent | interconnection percentage |
| interconnection_mw | derived or reported interconnection MW |
| demand_balance_status | whether demand, generation, and interconnection reconcile |

Where the data do not reconcile, the dashboard withholds or caveats the affected card rather than pretending precision.

## RES-E trajectory model

The RES-E trajectory layer is an annual policy-accountability layer, not a live grid-mix layer.

It asks:

    Is Ireland's annual renewable-electricity share moving fast enough toward the 2030 benchmark?

This is different from the live current mix, which can change dramatically hour by hour.

The dashboard separates:

    live electricity mix
    annual RES-E progress
    2030 target path
    recent observed trend
    scenario pressure

## Demand-pressure scenario model

The demand-pressure model estimates how additional electricity demand from data centres and EVs could widen the renewable build burden.

The key calculation is:

    extra renewable burden = extra demand × target share

For the current 2030 RES-E framing:

    extra renewable required = extra demand × 0.80

The conversion used for average load is:

    1 TWh/year ≈ 114.08 MW average

The generated forecast file is:

    data/source/demand_pressure_forecast.json

It is built by:

    ops/build_demand_pressure_forecast.py

The scenario envelope includes:

| Scenario | Meaning |
|---|---|
| low | constrained or plateau demand-pressure case |
| central | managed growth case |
| high | high-growth pressure case, including AI/data-centre pressure and accelerated electrification |

These are scenario assumptions, not official forecasts.

## How to read the gap-widening chart

The final gap-widening chart keeps the y-axis as RES-E percentage.

The visual logic is:

    fixed 80% target
            ↑
    visible gap
            ↓
    recent observed trend
            ↓
    lower projected line if demand is unneutralised

Higher unneutralised demand should push the projected RES-E line lower, making the gap to 80% visually wider.

This is why the chart does not move the 80% target line. The target remains fixed. The risk is that the observed or projected RES-E line falls further below it.

## Measured, forecast, modelled, scenario, and fallback values

The project should always distinguish:

| Category | Meaning |
|---|---|
| measured | observed or reported historical value |
| forecast | near-term published or source-based expectation |
| modelled | calculated from transparent assumptions |
| scenario | conditional pathway used for stress testing |
| fallback | placeholder or schematic value used when primary data are unavailable |

This distinction is central to the credibility of the dashboard.

## Reproducing the data locally

From the repository root:

    cd demos/ietm
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r ops/requirements.txt
    python3 ops/run_pipeline.py

Or run selected steps:

    python3 ops/build_target_tracker.py
    python3 ops/build_demand_pressure_forecast.py
    python3 ops/build_monitor.py
    python3 ops/validate_monitor.py
    python3 ops/validate_current_electricity.py

To serve the page locally from the repository root:

    python3 -m http.server 8000

Then open:

    http://localhost:8000/demos/ietm/

## Known limitations

Current limitations include:

- public source pages and APIs may change without notice;
- some harvested values depend on HTML structure or endpoint behaviour;
- county-level values may use fallback data when source CSV files are unavailable;
- current demand is withheld when the balance check fails;
- other renewables can be a calculated remainder rather than a directly trusted technology class;
- EV demand is modelled, not directly metered at national level;
- data-centre and EV demand-pressure scenarios are conditional assumptions;
- the dashboard does not yet provide formal uncertainty intervals;
- automated workflow failures may occur when upstream sources are unavailable, rate-limited, incomplete, or structurally changed.

## Intended further work

Planned improvements include:

1. Source provenance
   - add stronger source metadata to each generated JSON value;
   - record whether each value is measured, forecast, modelled, scenario-based, or fallback.

2. Scenario model hardening
   - replace assumptions with official or traceable annual projections where available;
   - separate data-centre, EV, industrial, heat, and other electrification pressures;
   - add uncertainty bands or parameter sliders.

3. Validation
   - add tests for generated JSON files;
   - reduce brittle fatal checks;
   - retain mathematically impossible states as hard failures;
   - downgrade source volatility to warnings.

4. Frontend clarity
   - simplify the trajectory narrative;
   - improve mobile layout;
   - keep one strong gap-widening visual rather than many competing graphs.

5. Reproducible release packaging
   - prepare a standalone archival repository;
   - add citation metadata;
   - add release notes;
   - publish a Zenodo release with DOI.

6. Documentation
   - add a layperson method page;
   - document each harvester;
   - document each caveat and fallback pathway;
   - include a changelog of modelling assumptions.

## Zenodo release plan

For a Zenodo-ready release, the project should include:

    README.md
    CITATION.cff
    .zenodo.json
    LICENSE
    release notes
    stable source code snapshot
    generated example data
    clear caveat/method documentation

A Zenodo release should describe the project as a software/data research artefact, not merely as a website.

## Suggested citation

Until a DOI is minted, cite the repository and commit hash:

    Baumann, A. C. (2026). Ireland Energy Transition Monitor: An open civic dashboard for electricity-transition accountability and demand-pressure scenarios [Software and data dashboard]. GitHub. https://github.com/salmonofdoubt/salmonofdoubt.github.io

After Zenodo release, replace this with the DOI citation generated by Zenodo.

## Licence

Licence information should be confirmed before archival release. If this project is intended for open reuse, add a clear open-source licence such as MIT, Apache-2.0, GPL-3.0, or another licence appropriate to the intended reuse model.

Data-source terms should be reviewed separately from source-code licensing.

## Maintainer

André C. Baumann  
Independent researcher · Dublin, Ireland  
Climate, energy, environmental data, and Nature-based Solutions

