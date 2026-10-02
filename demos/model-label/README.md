# Model Label

Zenodo archive: https://doi.org/10.5281/zenodo.23111588

Select a model or deployment to inspect specifications, responsibility, environmental evidence and service status.

## Scheduled public evidence

`refresh-model-label.yml` refreshes disclosures, footprint-source pages and model discovery daily at 05:43 UTC. Official status APIs refresh hourly at :23. Runs are also available through Actions → Run workflow. Collection preserves the last successful evidence if a request fails and flags changed documents for review. It does not automatically rewrite reviewed specifications, carbon claims or governance judgments. Source changes need editorial interpretation.

The published Re:fresh button reloads the latest GitHub snapshot. Green means the latest full round finished without failed source checks and is under 26 hours old. Orange means missing, stale, running, partial or failed collection. A blocked source is not a service outage. Status feeds have a separate 90-minute freshness window.

GitHub checks do not establish access from Ireland and do not send chatbot prompts. Local connection tests and API credentials are excluded from the public deployment. The local Python demo retains those capabilities separately.

## Environment figures

Published historical measurements retain their dates and accounting boundaries. Undisclosed training costs show explicitly assumed scenarios, not measured release-specific totals or rankings. Full development and later update costs are not inferred from a final-run scenario.

## Publishing

The workflow commits only monitor.json, uses the existing repository write lock and safe-rebase-push helper, and requests a Pages rebuild after bot commits because GITHUB_TOKEN pushes alone do not trigger branch-based Pages builds.

Install controls and the scoped service worker are retained. Model Label v0.1.0 is archived on Zenodo as DOI 10.5281/zenodo.23111588.
