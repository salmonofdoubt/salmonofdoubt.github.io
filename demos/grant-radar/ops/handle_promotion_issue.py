#!/usr/bin/env python3
"""Handle GitHub issue-driven promotion requests for Grant Radar candidates.

This version is more fault-tolerant than the original:
- parses candidate_id and candidate_url from the issue body
- falls back to the issue title if candidate_id is missing from the body
- normalises URLs before matching
- comments diagnostic information back to the issue
- exits cleanly instead of hard-failing when the candidate cannot be resolved
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import requests

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
CANDIDATES_PATH = DATA_DIR / "discovery-candidates.json"
PROMOTE_SCRIPT = SITE_DIR / "ops" / "promote_candidate.py"
HARVEST_SCRIPT = SITE_DIR / "ops" / "harvest_grants.py"

GITHUB_EVENT_PATH = Path(os.environ["GITHUB_EVENT_PATH"])
GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
GITHUB_REPOSITORY = os.environ["GITHUB_REPOSITORY"]
API_BASE = f"https://api.github.com/repos/{GITHUB_REPOSITORY}"


def load_json(path: Path, default: Any):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_url(url: str | None) -> str | None:
    if not url:
        return None

    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.netloc:
        return url.strip()

    cleaned_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith("utm_")
    ]

    normalised = parsed._replace(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
        query=urlencode(cleaned_query, doseq=True),
    )

    out = urlunparse(normalised)
    if out.endswith("/") and parsed.path not in ("", "/"):
        out = out[:-1]
    return out


def update_meta_counts(payload: dict[str, Any]) -> None:
    candidates = payload.get("candidates", [])
    meta = payload.setdefault("meta", {})
    meta["candidate_count"] = len(candidates)
    meta["high_confidence_count"] = sum(1 for item in candidates if float(item.get("confidence", 0)) >= 0.8)
    meta["pending_review_count"] = sum(1 for item in candidates if item.get("status") == "pending_review")
    meta["approved_count"] = sum(1 for item in candidates if item.get("status") == "approved")
    meta["cl_drafted_count"] = sum(1 for item in candidates if item.get("status") == "cl_drafted")
    meta["promoted_count"] = sum(1 for item in candidates if item.get("status") == "promoted")
    meta["promotion_requested_count"] = sum(1 for item in candidates if item.get("promotion_requested"))


def parse_issue_body(body: str) -> tuple[str | None, str | None, bool, bool]:
    # Some issue bodies arrive with literal "\n" sequences instead of clean line breaks.
    # Normalise those first so both browser-created and email-edited issues are parseable.
    normalised = body.replace("\\r\\n", "\n").replace("\\n", "\n")

    candidate_id = None
    candidate_url = None

    id_match = re.search(r"candidate_id:\s*([^\s]+)", normalised, flags=re.IGNORECASE)
    if id_match:
        candidate_id = id_match.group(1).strip()

    url_match = re.search(r"candidate_url:\s*(https?://\S+)", normalised, flags=re.IGNORECASE)
    if url_match:
        candidate_url = url_match.group(1).strip()

    accept = bool(
        re.search(
            r"-\s*\[x\]\s*Accept promotion into trusted catalogue",
            normalised,
            flags=re.IGNORECASE,
        )
    )
    reject = bool(
        re.search(
            r"-\s*\[x\]\s*Reject suggestion",
            normalised,
            flags=re.IGNORECASE,
        )
    )

    return candidate_id, candidate_url, accept, reject

def parse_candidate_id_from_title(title: str) -> str | None:
    # Preferred exact pattern
    match = re.match(r"^\[Grant Radar\]\s+Promote candidate\s+(.+?)\s*$", title.strip())
    if match:
        return match.group(1).strip()

    # Fallback: try to extract a cand_* token from anywhere in the title
    match = re.search(r"\b(cand_[a-z0-9_]+)\b", title.lower())
    if match:
        return match.group(1).strip()

    return None


def find_candidate(payload: dict[str, Any], candidate_id: str | None, candidate_url: str | None) -> dict[str, Any] | None:
    candidates = payload.get("candidates", [])

    if candidate_id:
        for item in candidates:
            if item.get("id") == candidate_id:
                return item

    if candidate_url:
        raw_target = candidate_url.strip()
        canonical_target = canonical_url(candidate_url)

        for item in candidates:
            if item.get("url") == raw_target:
                return item

        for item in candidates:
            item_url = item.get("url")
            if canonical_url(item_url) == canonical_target:
                return item

    return None


def gh_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }


def issue_comment(issue_number: int, body: str) -> None:
    requests.post(
        f"{API_BASE}/issues/{issue_number}/comments",
        headers=gh_headers(),
        json={"body": body},
        timeout=30,
    ).raise_for_status()


def close_issue(issue_number: int) -> None:
    requests.patch(
        f"{API_BASE}/issues/{issue_number}",
        headers=gh_headers(),
        json={"state": "closed"},
        timeout=30,
    ).raise_for_status()


def clear_request(candidate: dict[str, Any]) -> None:
    origin_status = candidate.get("request_origin_status") or "pending_review"
    if candidate.get("status") != "promoted":
        candidate["status"] = origin_status
    candidate["promotion_requested"] = False
    candidate["promotion_request_issue_number"] = None
    candidate["promotion_request_issue_url"] = None
    candidate["request_origin_status"] = None
    candidate["cl_draft_ready"] = False
    candidate["cl_draft_generated_at"] = None
    candidate["cl_draft_json"] = None
    candidate["cl_draft_html"] = None


def main() -> None:
    event = load_json(GITHUB_EVENT_PATH, {})
    issue = event.get("issue", {})
    title = issue.get("title", "") or ""

    if not title.startswith("[Grant Radar] Promote candidate"):
        print("Issue is not a Grant Radar promotion request. Exiting.")
        return

    issue_number = issue["number"]
    issue_url = issue["html_url"]
    body = issue.get("body", "") or ""

    candidate_id, candidate_url, accept, reject = parse_issue_body(body)
    title_candidate_id = parse_candidate_id_from_title(title)

    if not candidate_id and title_candidate_id:
        candidate_id = title_candidate_id

    payload = load_json(CANDIDATES_PATH, default={})
    candidate = find_candidate(payload, candidate_id, candidate_url)

    if not candidate:
        diagnostic = (
            "I could not find the referenced candidate in `discovery-candidates.json`.\n\n"
            f"- Parsed `candidate_id` from body/title: `{candidate_id or 'None'}`\n"
            f"- Parsed `candidate_url` from body: `{candidate_url or 'None'}`\n\n"
            "This usually means the issue body did not preserve the candidate fields exactly, "
            "or the candidate is no longer present in the latest discovery queue."
        )
        issue_comment(issue_number, diagnostic)
        print("Candidate not found")
        return

    action = event.get("action", "")
    print(f"Handling issue action: {action} for candidate {candidate.get('id')}")

    if reject:
        clear_request(candidate)
        update_meta_counts(payload)
        save_json(CANDIDATES_PATH, payload)
        issue_comment(
            issue_number,
            "Suggestion rejected. The request flag and draft metadata have been cleared from the review queue.",
        )
        close_issue(issue_number)
        return

    if accept:
        subprocess.run(
            [sys.executable, str(PROMOTE_SCRIPT), "--id", candidate["id"], "--apply"],
            check=True,
        )
        subprocess.run(
            [sys.executable, str(HARVEST_SCRIPT)],
            check=True,
        )

        payload = load_json(CANDIDATES_PATH, default={})
        candidate = find_candidate(payload, candidate_id, candidate_url)

        if candidate:
            candidate["promotion_requested"] = False
            candidate["promotion_request_issue_number"] = issue_number
            candidate["promotion_request_issue_url"] = issue_url
            candidate["request_origin_status"] = None
            update_meta_counts(payload)
            save_json(CANDIDATES_PATH, payload)

        issue_comment(
            issue_number,
            "Promotion accepted. The candidate has been added to `source-registry.json` and the trusted catalogue has been rebuilt.",
        )
        close_issue(issue_number)
        return

    # Open or edited request without accept/reject decision yet
    if not candidate.get("promotion_requested"):
        candidate["promotion_requested"] = True
        candidate["promotion_request_issue_number"] = issue_number
        candidate["promotion_request_issue_url"] = issue_url
        candidate["request_origin_status"] = candidate.get("status") or "pending_review"
        update_meta_counts(payload)
        save_json(CANDIDATES_PATH, payload)

    subprocess.run(
        [sys.executable, str(PROMOTE_SCRIPT), "--id", candidate["id"]],
        check=True,
    )
    issue_comment(
        issue_number,
        "Promotion request registered. A reviewable CL draft has been generated and linked from the review queue.",
    )


if __name__ == "__main__":
    main()