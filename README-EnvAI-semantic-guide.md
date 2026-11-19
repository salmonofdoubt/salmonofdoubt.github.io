# EnvAI — semantic discovery, cluster orbits & field guide

This **cumulative local-only patch** contains all the changes from the semantic-search / dotted-cluster updates, plus an entirely new **How EnvAI works** page. It preserves the small clickable tool labels, classification colours, the nearby legend, the bottom information rail, the What’s New colour key and the existing Salmon of Doubt navigation.

## Install into your local Salmon of Doubt checkout

1. Download `EnvAI-semantic-guide-patch.zip` to `~/Downloads`.
2. In your Mac Terminal:

```bash
unzip -o ~/Downloads/EnvAI-semantic-guide-patch.zip -d /Users/diandre/i_VC/salmonofdoubt.github.io
cd /Users/diandre/i_VC/salmonofdoubt.github.io
python3 -m http.server 8000
```

If the server is running already, **do not start a second one**; just refresh.

- Atlas: `http://localhost:8000/demos/envai/?guide=1`
- What’s New: `http://localhost:8000/demos/envai/whats-new.html?guide=1`
- How EnvAI works: `http://localhost:8000/demos/envai/how-it-works.html`

No `git commit`, `git push`, catalogue reinstall, or changes to `demos/catalog.js` are required. `git status --short` shows local file modifications. If the old service worker temporarily persists, hard-reload (`Cmd+Shift+R`). The new service worker uses network-first updates to reduce stale local versions.

## What the guide documents

- Current size and last editorial review date **read from actual JSON at page load**; no fixed, stale numbers.
- End-to-end structure: source discovery → unverified review queue → curated catalogue → map, semantic search and What’s New.
- Three colour classes (traditional digital / AI-augmented / AI-native) and a muted Unverified state, including editorial checks and references to the EU AI Act definition of inference.
- Explainable connections and the distinction between a similarity network and verified integration or partnership.
- Semantic search is an **editable, local, controlled-vocabulary ranking**, not an LLM. Four environmental field clusters, at most 15 representative nodes per field; six temporary search matches are shown.
- Discovery workflow: **scheduled 08:18 UTC daily only if the optional GitHub Action is installed and enabled**. This adds unverified leads only. Human approval and a site update are required to incorporate a tool. No promised editorial turnaround or automatic verified launch claim.
- “Released recently” (actual dated event) is separate from “newly added to EnvAI” and “under review”. NEW uses a 90-day rolling event window.

## Changed files

`demos/envai/` contains:

- `how-it-works.html`, `how-it-works.css`, `how-it-works.js` (new)
- `index.html`, `app.js`, `styles.css` (network, navigation, search and cluster outlines)
- `semantic-search.js` (curated concept index)
- `whats-new.html`, `whats-new.js`, `news.css` (feed, colour key, guide navigation)
- `data/tools.json` (52 catalogue entries, including whale monitoring tools that are *newly indexed*, not newly launched)
- `service-worker.js` (guide cached for offline reading, freshness improvements)

Other EnvAI files already in your local repo remain untouched.

## Maintenance

Update the approved catalogue in `data/tools.json` with source-backed records. The optional automated scanner targets only a selected set of GitHub sources and writes *unverified leads* to `data/discoveries.json`. New technologies are **not** guaranteed to be incorporated every day; the methodology page deliberately says so.

Architecture and AI-class policy are editor-authored, not independently certified. Keep the definitions under review as models, products and evidence change.

The patch changes local files only; publication to GitHub Pages requires a deliberate commit and push.
