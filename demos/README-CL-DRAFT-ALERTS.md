# Grant Radar CL draft alert patch

This patch makes new promotion CL drafts visible.

Included:
- `demos/grant-radar/ops/promote_candidate.py`
- `demos/grant-radar/ops/generate_promotion_drafts.py`
- `demos/grant-radar/ops/discover_grants.py`
- `demos/grant-radar/review.html`
- `.github/workflows/refresh-grant-radar.yml`
- `demos/grant-radar/promotion-drafts/.gitkeep`

What changes:
- approved candidates can automatically receive a reviewable CL draft
- draft files are generated as HTML + JSON under `promotion-drafts/`
- candidate status moves to `cl_drafted`
- discovery preserves CL draft metadata across refreshes
- the review page shows `CL draft ready` counts and links directly to the draft

Typical flow:
1. mark candidate `approved` in `data/discovery-candidates.json`
2. run the workflow or `python demos/grant-radar/ops/generate_promotion_drafts.py`
3. open the review page and look for `CL draft ready`
4. inspect the draft HTML
5. only then apply with:
   `python demos/grant-radar/ops/promote_candidate.py --id CANDIDATE_ID --apply`
6. run `python demos/grant-radar/ops/harvest_grants.py`
