# Ireland Energy Transition Monitor

Open civic prototype for tracking Ireland's energy transition.

## Current status

This demo is wired as a small static data product.

The front end reads:

    data/monitor.json

That file is generated from modular source files:

    data/source/electricity.json
    data/source/truth_meter.json
    data/source/prices.json
    data/source/counties.json
    data/source/metadata.json

## Build locally

    python3 ops/build_monitor.py
    python3 ops/validate_monitor.py

## Intended production pipeline

Later versions should replace the static source files with harvesters for:

- EirGrid real-time electricity data
- SEAI energy statistics and prices
- SEAI renewable electricity county dashboard
- CSO transport indicators
- Gas Networks Ireland gas demand reporting

The browser should not scrape external sources directly. GitHub Actions should harvest and write stable local JSON.
