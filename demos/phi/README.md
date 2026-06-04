# P(HI) Judgement Lab

Static website demo for human-led decision-making with AI support. Built for the short public GitHub Pages URL:

```text
/demos/phi/
```

The tool helps users frame decisions, compare options, audit bias, generate red-team prompts, run an NbS spatial decision audit, and export a Markdown decision memo.

## Core principle

AI may assist reasoning, but the human remains responsible for values, consequences, and action.

## Files

```text
index.html
styles.css
app.js
README.md
```

## Run locally from this folder

```bash
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000
```

## Install into the GitHub Pages repo

This ZIP contains a top-level folder called `phi`. From the repository root:

```bash
git status --short
git fetch origin
git pull --ff-only origin master
mkdir -p demos
unzip -o ~/Downloads/phi_demo.zip -d demos
python3 -m http.server 8000
```

Then test:

```text
http://127.0.0.1:8000/demos/phi/
```

If it looks good:

```bash
git status --short
git add demos/phi
git commit -m "Add P(HI) decision lab demo"
git push origin master
```

## No backend

The demo uses browser local storage only. There is no login, database, analytics, or AI API call.

## Next improvements

1. Add a real GeoJSON demo catchment with Leaflet.
2. Add configurable criteria weights for the NbS-SDSS module.
3. Add sensitivity analysis for option and suitability scores.
4. Add a project article link once the P(HI) article is published.
5. Add citation metadata and Zenodo release files.



## EcoLogits

This demo is intentionally static and browser-based.

Measured or directly knowable from the design:
- No backend.
- No database.
- No login.
- No AI API call.
- Local storage only.

Estimated AI use avoided:
- The memo reports 1 avoided AI text-generation call per generated decision memo.
- Default estimate: about 0.34 Wh avoided.
- Plausible range: 0.18-0.67 Wh avoided.
- This is an avoided-inference estimate, not a measured footprint.

Not claimed:
- Exact device electricity use.
- Exact hosting, transfer, water, or carbon impact.
- Exact water or carbon savings from avoided AI use.

EcoLogits principle: report measured data where available, use transparent estimates where necessary, and avoid false precision.


## AI handoff

The intended workflow is:

1. P(HI) frames the decision locally in the browser.
2. The user copies the memo, red-team prompt, or NbS/SDSS evidence audit prompt.
3. The user pastes it into an AI system for critique.
4. AI challenges assumptions, evidence gaps, bias, and false certainty.
5. The human revises the memo and remains responsible for the decision.

Core phrase: Structure first. Challenge with AI. Decide yourself.

EcoLogits note: local memo generation avoids a default AI text-generation call. If the user then pastes the output into AI, that external AI use should be counted separately.
