Drop these files into:

  demos/grant-radar/ops/

Files:
- candidate_hygiene.py
- clean_horizon_candidates.py

Example run:

  python demos/grant-radar/ops/clean_horizon_candidates.py \
    demos/grant-radar/data/discovered_candidates.json \
    -o demos/grant-radar/data/discovered_candidates.clean.json

For the review page builder, import:

  from candidate_hygiene import review_queue

and replace the raw review list creation with:

  review_items = review_queue(payload.get("candidates", []))
