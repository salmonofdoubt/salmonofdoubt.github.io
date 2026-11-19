# EnvAI · useful tools, not repository listings

This public-site patch changes the existing **daily** EnvAI scanner's discovery policy. It does **not** add another workflow, database, admin UI or visible map control.

## New behaviour

- Official, dated releases of already-catalogued tools continue to be monitored as before.
- Newly created GitHub repositories are no longer public discoveries by themselves.
- A new candidate must have: (1) environmental subject metadata; (2) product-like descriptions such as *interactive map*, *dashboard* or *web app*; (3) an external HTTPS tool homepage in the repository metadata; (4) a reachable HTML website at scan time.
- The **primary link opens the website**, not the source repository. A separate evidence link retains the code/source URL.
- Curated tools and releases stay unchanged. Historical repository-only candidates are hidden immediately in the live atlas and What's New; the next daily scan also removes them from the live snapshot.
- New candidate websites are marked **Unverified**. An HTTP response does not prove the app works, that access is free or that scientific/AI claims are correct. Candidates remain search-only and never add permanent nodes to the overview.
- The existing **In review** filter becomes **Try new tools** (still unverified) and shows the direct websites. If nothing qualifies, it honestly shows no results.
- Website checks are limited to 16 per daily scan with short timeouts, rather than aggressively crawling external sites. Some genuine tools may be missed if their sites block automated checks. This is a deliberate high-precision starting point.

**Scope:** The source discovery mechanism is still GitHub metadata, which is NOT an exhaustive inventory of commercial environmental software, government portals or other tools. Expanding beyond it is a separate enhancement. This patch prioritises usefulness over sheer volume, but it does not claim automatic full functional verification.

## Install into your existing Salmon of Doubt repository

Download the ZIP to `~/Downloads` and run:

```bash
cd /Users/diandre/i_VC/salmonofdoubt.github.io
unzip -o ~/Downloads/EnvAI-useful-tools-patch.zip -d .
python3 -m unittest discover -s tests -p 'test_envai_auto_update.py' -v
node tests/test_live_data.cjs
```

Test locally using your normal local server (`python3 -m http.server 8000`). The updated pages are `/demos/envai/` and `/demos/envai/whats-new.html`.

Commit only the changed files after reviewing `git diff`:

```bash
git status --short
git add scripts/envai_auto_update.py tests/test_envai_auto_update.py tests/test_live_data.cjs \
  demos/envai/live-data.js demos/envai/whats-new.js demos/envai/whats-new.html \
  demos/envai/index.html demos/envai/how-it-works.html demos/envai/how-it-works.js \
  demos/envai/service-worker.js

git diff --cached --check
git diff --cached --stat
git commit -m "EnvAI: prioritise usable environmental tools over repositories"
git push origin master
```

There is **no new automation to enable**. Your existing daily `EnvAI — daily live updates` workflow will run this revised scanner automatically after the code has been pushed. You can optionally test it immediately from GitHub Actions, but you do not need to manually run it daily. If you want to test without writing data, run `python3 scripts/envai_auto_update.py --dry-run` locally (network required).

## Verification

Offline tests cover: an approved release, a working website candidate, repo-only leads excluded, bad and blocked sites excluded, deduplication, historical noise removal and network-failure handling. These are simulated API/website checks; no claim is made that every actual site is usable.
