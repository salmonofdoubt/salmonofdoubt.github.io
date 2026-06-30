from __future__ import annotations

import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "source" / "official-downloads"
CHEM_DIR = ROOT / "data" / "source" / "epa-chemistry"
FORM_URL = "https://gis.epa.ie/GetData/Download"
USER_AGENT = "salmonofdoubt-wq-epa-geoportal-requester/0.1"

TARGET_LABELS = [
    "Interim water quality review results and data 2023 (Excel)",
    "Load Reduction Indicator Data And Results 2025 (Excel)",
    "WFD Waterbody Status Elements and River Site Status 2019-2024 - Oct 2025",
    "Groundwater Quality (Excel) 1990 - 2024",
    "Coastal Water Quality 2018-2020",
    "Transitional Water Quality 2018-2020",
    "EPA River Invertebrate (Q-value) Data 2007-2025",
    "Bathing Water Locations and Compliance Data - 21/04/2026",
]

KEYWORDS = [
    "water quality",
    "quality",
    "chemistry",
    "interim water quality",
    "load reduction",
    "groundwater quality",
    "coastal water quality",
    "transitional water quality",
    "river invertebrate",
    "q-value",
    "bathing water",
    "wfd waterbody status",
]


@dataclass
class DatasetCandidate:
    label: str
    value: str
    source: str
    matched: bool


@dataclass
class RequestEvent:
    label: str
    value: str
    status: str
    reason: str = ""
    response_url: str = ""
    response_excerpt: str = ""


def fetch(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace"), response.geturl()


def post(url: str, data: dict[str, str]) -> tuple[str, str]:
    payload = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as response:
        body = response.read().decode("utf-8", errors="replace")
        return body, response.geturl()


def clean(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def inputs(html_text: str) -> dict[str, str]:
    found: dict[str, str] = {}

    for match in re.finditer(r"(?is)<input\b[^>]*>", html_text):
        tag = match.group(0)
        name = re.search(r'''(?is)\bname=["']([^"']+)["']''', tag)
        if not name:
            continue
        value = re.search(r'''(?is)\bvalue=["']([^"']*)["']''', tag)
        found[name.group(1)] = html.unescape(value.group(1)) if value else ""

    return found


def form_action(html_text: str, base_url: str) -> str:
    match = re.search(r'''(?is)<form\b[^>]*\baction=["']([^"']+)["']''', html_text)

    if not match:
        return base_url

    return urllib.parse.urljoin(base_url, html.unescape(match.group(1)))


def select_options(html_text: str) -> list[DatasetCandidate]:
    candidates: list[DatasetCandidate] = []

    for select in re.finditer(r"(?is)<select\b[^>]*>.*?</select>", html_text):
        select_html = select.group(0)
        select_name = ""
        name_match = re.search(r'''(?is)\bname=["']([^"']+)["']''', select_html)
        if name_match:
            select_name = html.unescape(name_match.group(1))

        for option in re.finditer(r"(?is)<option\b([^>]*)>(.*?)</option>", select_html):
            attrs, body = option.groups()
            value_match = re.search(r'''(?is)\bvalue=["']([^"']*)["']''', attrs)
            value = html.unescape(value_match.group(1)) if value_match else clean(body)
            label = clean(body)
            lower = label.lower()
            matched = any(target.lower() == lower for target in TARGET_LABELS) or any(key in lower for key in KEYWORDS)

            if label and value:
                candidates.append(DatasetCandidate(label=label, value=value, source=select_name, matched=matched))

    # Some EPA page variants render list items/buttons instead of option tags.
    for button in re.finditer(r"(?is)<(?:button|a|li|div)\b([^>]*)>(.*?)</(?:button|a|li|div)>", html_text):
        attrs, body = button.groups()
        label = clean(body)
        lower = label.lower()

        if not label:
            continue

        matched = any(target.lower() == lower for target in TARGET_LABELS) or any(key in lower for key in KEYWORDS)

        if not matched:
            continue

        value = ""
        for key in ("data-id", "data-value", "value", "href", "data-url"):
            value_match = re.search(rf'''(?is)\b{key}=["']([^"']+)["']''', attrs)
            if value_match:
                value = html.unescape(value_match.group(1))
                break

        candidates.append(DatasetCandidate(label=label, value=value or label, source="html-list", matched=True))

    dedup: dict[tuple[str, str], DatasetCandidate] = {}
    for candidate in candidates:
        dedup[(candidate.label, candidate.value)] = candidate

    return list(dedup.values())


def likely_field_names(form_fields: dict[str, str], candidates: list[DatasetCandidate]) -> tuple[list[str], list[str]]:
    names = list(form_fields)

    dataset_names = [
        name for name in names
        if any(token in name.lower() for token in ["dataset", "data", "download", "layer", "file", "id"])
    ]

    email_names = [
        name for name in names
        if "email" in name.lower()
    ]

    for candidate in candidates:
        if candidate.source and candidate.source not in dataset_names:
            dataset_names.insert(0, candidate.source)

    if not dataset_names:
        dataset_names = ["dataset", "Dataset", "selectedDataset", "download", "DownloadId", "id"]

    if not email_names:
        email_names = ["email", "Email", "EmailAddress", "confirmEmail", "ConfirmEmail"]

    return dataset_names, email_names


def request_dataset(
    action: str,
    form_fields: dict[str, str],
    dataset_name: str,
    email_names: list[str],
    email_address: str,
    candidate: DatasetCandidate,
) -> RequestEvent:
    data = dict(form_fields)
    data[dataset_name] = candidate.value

    for name in email_names:
        data[name] = email_address

    # Try common confirm-email names even if not in the form.
    for name in ["ConfirmEmail", "confirmEmail", "EmailConfirm", "emailConfirm", "Email2", "email2"]:
        data.setdefault(name, email_address)

    try:
        body, response_url = post(action, data)
        excerpt = clean(body)[:700]
        lower = (body + " " + response_url).lower()

        if any(token in lower for token in [".zip", ".xlsx", ".xls", ".csv", "download"]):
            status = "requested_or_download_link_returned"
        elif "email" in lower and any(token in lower for token in ["sent", "link", "download"]):
            status = "email_link_requested"
        else:
            status = "submitted_unknown_response"

        return RequestEvent(
            label=candidate.label,
            value=candidate.value,
            status=status,
            response_url=response_url,
            response_excerpt=excerpt,
        )

    except Exception as exc:
        return RequestEvent(
            label=candidate.label,
            value=candidate.value,
            status="request_failed",
            reason=str(exc),
        )


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CHEM_DIR.mkdir(parents=True, exist_ok=True)

    body, final_url = fetch(FORM_URL)
    action = form_action(body, final_url)
    form_fields = inputs(body)
    candidates = select_options(body)

    matched = [candidate for candidate in candidates if candidate.matched]
    dataset_names, email_names = likely_field_names(form_fields, candidates)
    email_address = os.environ.get("EPA_GEO_EMAIL") or os.environ.get("EPA_DOWNLOAD_EMAIL") or ""

    events: list[RequestEvent] = []

    if email_address:
        for candidate in matched:
            event = None
            for dataset_name in dataset_names[:5]:
                event = request_dataset(action, form_fields, dataset_name, email_names, email_address, candidate)
                events.append(event)
                if event.status != "request_failed":
                    break
    else:
        events.append(
            RequestEvent(
                label="EPA Geoportal email",
                value="EPA_GEO_EMAIL",
                status="blocked_missing_email",
                reason="EPA Geoportal asks for an email address before providing download links. Set EPA_GEO_EMAIL to request links.",
            )
        )

    result: dict[str, Any] = {
        "generated_at_epoch": int(time.time()),
        "form_url": FORM_URL,
        "final_url": final_url,
        "form_action": action,
        "form_fields": sorted(form_fields),
        "dataset_field_candidates": dataset_names,
        "email_field_candidates": email_names,
        "candidate_count": len(candidates),
        "matched_candidate_count": len(matched),
        "matched_candidates": [asdict(candidate) for candidate in matched],
        "events": [asdict(event) for event in events],
    }

    (OUT_DIR / "epa-geoportal-wq-request-manifest.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    (OUT_DIR / "epa-geoportal-wq-candidates.txt").write_text(
        "\n".join(
            [
                "# EPA Geoportal WQ candidate datasets",
                "",
                "## Matched candidates",
                *[f"{candidate.value}\t{candidate.label}\t{candidate.source}" for candidate in matched],
                "",
                "## All candidates",
                *[f"{candidate.value}\t{candidate.label}\t{candidate.source}" for candidate in candidates],
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print("Form action:", action)
    print("Form fields:", len(form_fields))
    print("Candidate datasets:", len(candidates))
    print("Matched WQ datasets:", len(matched))
    print("Email configured:", bool(email_address))
    print("Manifest:", OUT_DIR / "epa-geoportal-wq-request-manifest.json")

    for candidate in matched[:30]:
        print("MATCH:", candidate.value, "|", candidate.label, "| field:", candidate.source)

    for event in events:
        print("EVENT:", event.status, "|", event.label, "|", event.reason)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
