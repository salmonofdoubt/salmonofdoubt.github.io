# Three Intelligences Explorer

Three Intelligences Explorer is an interactive GitHub Pages demo for exploring three linked forms of systems intelligence: individual capability, collective coordination, and planetary stewardship.

Public demo: https://salmonofdoubt.github.io/demos/intelligence/
Method page: https://salmonofdoubt.github.io/demos/intelligence/readme.html
Archived release DOI: https://doi.org/10.5281/zenodo.19633908

Version: v0.3 public prototype
Updated: 2026-05-09
Build: static GitHub Pages demo

## Summary

The demo asks whether countries can combine human capability, collective coordination, and planetary feedback strongly enough to move toward mature-technosphere readiness while Earth as a whole remains in an immature technosphere condition.

The 3D model uses:
- X-axis: Individual intelligence proxy
- Y-axis: Collective intelligence proxy
- Z-axis: Planetary intelligence proxy

A selected country receives a readiness score, readiness band, five planetary-intelligence diagnostics, comparison context, source transparency, and downloadable text/PDF report options.

## What this is

This is a systems-readiness prototype. It is not a national IQ ranking, not a league table of smart countries, not a settled scientific index, and not a claim that any country has achieved planetary intelligence.

## Conceptual basis

Frank, A., Grinspoon, D., & Walker, S. I. (2022). Intelligence as a planetary scale process. International Journal of Astrobiology, 21, 47-61. https://doi.org/10.1017/S147355042100029X

## Core logic

Earth is treated as an immature technosphere. Countries are not placed into geosphere or biosphere stages. Countries are scored for relative readiness inside the current immature global technosphere.

## Data modes

Live mode attempts to retrieve public World Bank indicator data in the browser.

Fallback mode loads data/country_scores_fallback.csv when live data cannot be retrieved reliably. Fallback mode is useful for continuity and interface testing, but should not be cited as a final empirical ranking.

## Indicators

Individual intelligence uses Human Capital Index, internet users, tertiary enrolment, and life expectancy.

Collective intelligence uses government effectiveness, rule of law, control of corruption, voice and accountability, and regulatory quality.

Planetary intelligence uses renewable energy consumption, protected areas, forest area, CO2 emissions per capita, and PM2.5 exposure.

## Scoring

Layer score = weighted average of valid transformed indicator scores.

Overall synergy = average of individual, collective, and planetary layer scores.

Mature Technosphere Gap = average of five planetary-intelligence diagnostics minus 0.35 times ecological pressure.

## Readiness bands

0-24: Emerging readiness
25-49: Immature readiness
50-74: Transitioning readiness
75-100: Mature-candidate readiness

## Known limitations

The model uses proxy indicators. Country-level scores hide internal variation. The planetary layer is incomplete. Readiness is model-dependent. Fallback mode is illustrative.

## Local testing

Run from the repository root:

python3 -m http.server 8010

Then open:

http://localhost:8010/demos/intelligence/
http://localhost:8010/demos/intelligence/readme.html
