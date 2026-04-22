# Grant Radar request issue flow

This patch adds a suggest box on the review page and routes promotion decisions through GitHub issues.

What you get:
- a checkbox on each candidate card: `Suggest for promotion`
- a button that opens a prefilled GitHub request issue
- an issue-driven workflow:
  - issue opened -> candidate marked as request open, CL draft generated
  - issue edited with `Accept promotion into trusted catalogue` checked -> candidate promoted into main catalogue
  - issue edited with `Reject suggestion` checked -> suggestion flag cleared

Files included:
- `demos/grant-radar/review.html`
- `demos/grant-radar/ops/discover_grants.py`
- `demos/grant-radar/ops/promote_candidate.py`
- `demos/grant-radar/ops/generate_promotion_drafts.py`
- `demos/grant-radar/ops/handle_promotion_issue.py`
- `.github/workflows/refresh-grant-radar.yml`
- `.github/workflows/candidate-promotion-requests.yml`

Important note:
the review page is static GitHub Pages. It cannot write directly to the repo by itself.
So the checkbox opens a GitHub issue, and the workflow performs the actual state change.

After applying this patch:
1. On `review.html`, tick `Suggest for promotion`
2. Click `Open request issue`
3. Submit the issue
4. The workflow marks the request open and generates the CL draft
5. In the issue, tick either:
   - `Accept promotion into trusted catalogue`
   - `Reject suggestion`
6. Save the issue
7. The workflow will either promote or clear the request
