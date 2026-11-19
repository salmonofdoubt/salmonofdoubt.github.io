# EnvAI — clean the existing catalogue (19 November 2026)

This is a **local-only patch** for an already installed EnvAI on `salmonofdoubt.github.io`.
It keeps the constellation design and its semantic search, all classification colours, DOI/Support/Install controls, and the existing daily GitHub Actions updater.

## What changes

- **25 practical tools** remain in the public map and search (16 direct online tools, 6 access-request services, 3 installable apps). These categories describe how someone can get started, not a guarantee of site availability or unrestricted access.
- **27 model/code repositories, generic research projects and dataset references** are moved *out of the public map, search and What's New*. Nothing is deleted: the records, sources and editorial reasons remain in `demos/envai/data/tools.json` for transparency and future review.
- All 52 original seed records are flagged `baselineEntry: true` to stop retroactively flooding **New to EnvAI**. Future approved entries with a real `addedAt` date and no baseline flag still appear there. Dated releases for practical tools continue to appear under Releases & Updates.
- The map and What's New now link to actual application or access destinations whenever available, with clear actions: **Open tool**, **Get app**, or **Access details**.
- A live, source-linked and reachable new tool candidate still joins search and the review feed as **Unverified**. Its node does **not** become a permanent constellation point.
- Semantic topic search is intact, including Water/whale and Nature/bird associations.

Examples of more direct destinations: Climate TRACE Explorer, OpenAQ Explorer and iNaturalist observations.

This is **editorial screening**, not an independent test of every external tool's functionality, quality, pricing, login restrictions or scientific accuracy. Current research references remain in the source data, but **will not be promoted simply because they have a recent GitHub release**.

## Install locally

You can inspect what will be overwritten first:

```bash
unzip -l ~/Downloads/EnvAI-practical-tools-cleanup.zip
```

To install into your local checkout:

```bash
cd /Users/diandre/i_VC/salmonofdoubt.github.io
unzip -o ~/Downloads/EnvAI-practical-tools-cleanup.zip -d .
node tests/test_envai_practical.cjs
python3 -m http.server 8000
```

Open `http://localhost:8000/demos/envai/?clean=1` and `http://localhost:8000/demos/envai/whats-new.html?clean=1` in your browser. If a local server is already running, do not start another; just refresh (Cmd+Shift+R) and use the versioned URL.

The ZIP only includes:

- `demos/envai/data/tools.json`
- `demos/envai/app.js`, `live-data.js`, `whats-new.js`, `how-it-works.js`
- `demos/envai/index.html`, `whats-new.html`, `how-it-works.html`, `service-worker.js`
- `tests/test_envai_practical.cjs`

It **does not** include or modify the scheduled GitHub workflow, scanner, discovered live data, original demos catalogue, or admin/editor files.

## Publish after local review

```bash
cd /Users/diandre/i_VC/salmonofdoubt.github.io
git status --short
git diff -- demos/envai/ tests/test_envai_practical.cjs

git add demos/envai/data/tools.json \
  demos/envai/app.js demos/envai/live-data.js demos/envai/whats-new.js \
  demos/envai/how-it-works.js demos/envai/index.html \
  demos/envai/whats-new.html demos/envai/how-it-works.html \
  demos/envai/service-worker.js tests/test_envai_practical.cjs

git diff --cached --check
git diff --cached --stat
git commit -m "EnvAI: show practical tools and archive research-only clutter"
git push origin master
```

If you don't want to publish yet, stop before the commit/push commands. Your daily automation will continue using the public files until you push.

## Tests

- `node --check` on all four changed JavaScript files
- `node tests/test_envai_practical.cjs`: tests classification totals, target URLs, no GitHub-only destinations among public tools, semantic whale/bird queries, search exclusion and baseline news suppression

Browser rendering should be visually checked on localhost before publishing, as external application availability can change.
