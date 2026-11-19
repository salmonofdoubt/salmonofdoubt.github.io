# EnvAI — automatic daily updates (Salmon of Doubt)

This patch adds **working, opt-in, scheduled automation** to the existing EnvAI site. It does not add public admin pages, dependencies, a separate server, or new always-visible controls.

## What runs automatically

After you commit this patch to the `master` branch and manually run the workflow once:

- GitHub Actions runs **daily at 07:23 UTC** (usually, but GitHub can delay a scheduled run).
- It checks official GitHub releases for **approved catalogue entries** (13 explicitly watched sources plus approved items with a direct GitHub repository link). Releases are recorded with a real publication date, version and direct evidence link.
- It searches for newly created repositories about biodiversity, ecological monitoring, Earth observation, climate forecasting and marine conservation. These are **UNVERIFIED discovery leads**, *not* assumed product launches.
- It writes **only** `demos/envai/data/live-updates.json`. This file is public and must never contain credentials or private review notes.
- **What's New** shows watched releases in “Releases & updates”, with discovered candidates in “In review”. The page displays the date and health of the last successful scan.
- **The atlas** inherits watched release dates for existing tools; candidates become searchable **as unverified**, but the map's 15-per-field limit remains intact and candidate nodes never appear in the default constellation.
- The public pages read the latest GitHub raw JSON on page load. This is intentional: GitHub Actions commits using `GITHUB_TOKEN` don't trigger GitHub Pages' branch publication. It also means the rest of your GitHub Pages site remains on its existing publishing setup.

No new release or project is invented if no relevant item is found. Daily scanning does **not** imply daily new launches. The AI-native/augmented/traditional classification of a new tool still requires editorial verification.

## Install into YOUR existing repository (macOS)

From any terminal:

```sh
unzip -o ~/Downloads/EnvAI-auto-updates.zip -d /Users/diandre/i_VC/salmonofdoubt.github.io

cd /Users/diandre/i_VC/salmonofdoubt.github.io
python3 -m unittest discover -s tests -p 'test_envai_auto_update.py' -v
node tests/test_live_data.cjs  # optional: Node.js is needed only for this check
```

This step **does not push** or change any GitHub settings. Your existing `demos/catalog.js`, `data/tools.json`, and project controls are left alone.

To test the site locally before publishing:

```sh
cd /Users/diandre/i_VC/salmonofdoubt.github.io
python3 -m http.server 8000
```

Open:

- http://localhost:8000/demos/envai/
- http://localhost:8000/demos/envai/whats-new.html
- http://localhost:8000/demos/envai/how-it-works.html

The initial scan display says **first run pending** until the GitHub workflow executes.

## Publish the automation

In a second terminal (from your repository root):

```sh
git status --short

git add demos/envai/index.html demos/envai/app.js \
  demos/envai/live-data.js demos/envai/whats-new.html demos/envai/whats-new.js \
  demos/envai/how-it-works.html demos/envai/how-it-works.js \
  demos/envai/service-worker.js demos/envai/data/live-updates.json \
  scripts/envai_auto_update.py \
  .github/workflows/envai-live-updates.yml \
  tests/test_envai_auto_update.py tests/test_live_data.cjs \
  README-ENVAI-AUTO-UPDATES.md

git diff --cached --check
git diff --cached --stat
# Inspect staged files before proceeding.
git commit -m "EnvAI: enable daily discovery and live release updates"
git push origin master
```

If the earlier public EnvAI changes are still uncommitted, review and commit those too **before** running the workflow. Avoid staging unrelated files or private editor resources.

## Enable the first update

1. Open **https://github.com/salmonofdoubt/salmonofdoubt.github.io/actions**.
2. In the left sidebar choose **EnvAI — daily live updates**.
3. Click **Run workflow** (choose the `master` branch).
4. Inspect the run log. On success, `demos/envai/data/live-updates.json` will contain an actual `lastSuccessAt` scan date, source statistics and any newly found items.
5. Open https://salmonofdoubt.github.io/demos/envai/whats-new.html and check the **Last successful scan** line. You may need to refresh or wait for GitHub raw's edge cache.

If the worker reports permission denied when pushing, check **Settings → Actions → General → Workflow permissions**. The workflow requests `contents: write`, but repository policies may restrict it. Do not put personal tokens in website files. If a branch protection rule prevents bot commits, a maintainer must explicitly allow this workflow or choose a compatible branch-update policy.

You can also run the scanner locally without writing anything:

```sh
python3 scripts/envai_auto_update.py --dry-run
```

Internet access is required for the GitHub API. This release was tested with offline source fixtures; the scanner cannot perform a real scan from this package-building environment.

## Transparency and limitations

- **Official project release** = source-dated GitHub release, not a claim that the tool is better, independently assessed or newly invented.
- **Discovery lead** = a GitHub repository that appears relevant, but has not been assessed for functionality, accuracy, launch status or AI category.
- **Approved map catalogue** = maintainer-reviewed `data/tools.json`, unchanged by the bot.
- **Search index** = approved tools plus clearly unverified lead matches, limited to six visible search results.
- **Coverage** = selected GitHub sources, not all environmental organisations, websites, papers, proprietary software or news announcements.
- **Publishing** = after the initial user push, automatic data updates are read from GitHub raw, bypassing GitHub Pages' bot-commit rebuild limitation.
- **Scheduled maintenance** = public GitHub repository schedules may be disabled after 60 days of inactivity. Failed scans or stale data are identifiable from status instead of silently claiming to be current.

To expand coverage, edit the `SEARCHES` or `WATCHED` list in `scripts/envai_auto_update.py`; newly approved entries with a direct GitHub repository URL are automatically watched. Review changes to query definitions, and rerun tests before committing.
