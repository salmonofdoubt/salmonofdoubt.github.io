import argparse
import json
from pathlib import Path

from candidate_hygiene import dedupe_candidates, review_queue


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Clean and deduplicate Grant Radar candidate JSON."
    )
    parser.add_argument(
        "input",
        nargs="?",
        default="discovered_candidates.json",
        help="Input JSON file. Default: discovered_candidates.json",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="discovered_candidates.clean.json",
        help="Output JSON file. Default: discovered_candidates.clean.json",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    with input_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    raw_candidates = payload.get("candidates", [])
    cleaned_candidates = dedupe_candidates(raw_candidates)
    queue = review_queue(cleaned_candidates)

    meta = payload.setdefault("meta", {})
    meta["candidate_count_before_clean"] = len(raw_candidates)
    meta["candidate_count_after_clean"] = len(cleaned_candidates)
    meta["review_queue_count_after_clean"] = len(queue)

    payload["candidates"] = cleaned_candidates

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Cleaned {len(raw_candidates)} -> {len(cleaned_candidates)}")
    print(f"Review queue after clean: {len(queue)}")
    print(f"Wrote: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
