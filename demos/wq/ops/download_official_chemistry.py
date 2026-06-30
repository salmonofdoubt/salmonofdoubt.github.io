from __future__ import annotations

import json
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CHEMISTRY_DIR = ROOT / "data" / "source" / "epa-chemistry"
DOWNLOAD_DIR = ROOT / "data" / "source" / "official-downloads"
MANIFEST = DOWNLOAD_DIR / "official-chemistry-download-manifest.json"
CANDIDATES_TXT = DOWNLOAD_DIR / "official-chemistry-endpoint-candidates.txt"
LATEST_JSON = ROOT / "data" / "latest.json"

USER_AGENT = "salmonofdoubt-wq-official-downloader/0.2"
MAX_BYTES = 250 * 1024 * 1024
SCAN_LIMIT = 250

SEED_PAGES = [
    "https://www.catchments.ie/data/",
    "https://www.catchments.ie/catchments-ie-changes-chemistry-data-downloads/",
    "https://www.catchments.ie/open-data-developer-resources/",
    "https://www.catchments.ie/epa-water-quality-monitoring-datasets/",
    "https://www.catchments.ie/wp-json",
    "https://www.catchments.ie/wp-json/wp/v2/search?search=chemistry&per_page=100",
    "https://www.catchments.ie/wp-json/wp/v2/pages?search=chemistry&per_page=100",
    "https://www.catchments.ie/wp-json/wp/v2/posts?search=chemistry&per_page=100",
    "https://www.catchments.ie/wp-json/wp/v2/media?search=chemistry&per_page=100",
    "https://www.catchments.ie/wp-json/wp/v2/search?search=water%20quality&per_page=100",
    "https://www.catchments.ie/wp-json/wp/v2/search?search=download&per_page=100",
]

TARGET_TERMS = [
    "chemistry",
    "chemical",
    "water quality",
    "waterquality",
    "monitoring",
    "download",
    "csv",
    "xlsx",
    "determinand",
    "result",
    "sample",
    "subcatchment",
    "waterbody",
]

TARGET_CODES = [
    "08_3",
    "09_17",
    "08_1",
    "08_4",
    "08_5",
    "Broadmeadow_SC_010",
    "Mayne_SC_010",
    "Delvin_SC_010",
    "Nanny[Meath]_SC_010",
    "Nanny[Meath]_SC_020",
    "IE_EA_080_0100",
    "IE_EA_060_0100",
    "IE_EA_060_0000",
    "IE_EA_08B020400",
    "IE_EA_08D010080",
    "Broadmeadow Water",
    "Mayne Estuary",
    "Malahide Bay",
    "BROADMEADOW_010",
    "DELVIN_010",
    "NANNY",
]

ATTR_URL_RE = re.compile(r"""(?is)(?:href|src|data-url|data-href|action)\s*=\s*["']([^"']+)["']""")
PLAIN_URL_RE = re.compile(r"""https?://[^\s"'<>\\)]+""")
JS_STRING_RE = re.compile(r"""(?is)["'`]([^"'`]{3,500})["'`]""")
FILE_RE = re.compile(r"(?i)\.(csv|tsv|xlsx|xls|zip)(?:$|[?#])")
JS_RE = re.compile(r"(?i)\.js(?:$|[?#])")


@dataclass
class DownloadEvent:
    url: str
    status: str
    reason: str = ""
    saved_as: str = ""
    bytes: int = 0
    content_type: str = ""


def make_request(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT})


def fetch_bytes(url: str, *, timeout: int = 35) -> tuple[bytes, str, str]:
    with urllib.request.urlopen(make_request(url), timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        final_url = response.geturl()
        length = response.headers.get("content-length")

        if length and int(length) > MAX_BYTES:
            raise ValueError(f"file too large: {length} bytes")

        data = response.read(MAX_BYTES + 1)

    if len(data) > MAX_BYTES:
        raise ValueError(f"file larger than limit: {MAX_BYTES} bytes")

    return data, content_type, final_url


def fetch_text(url: str) -> tuple[str, str]:
    data, content_type, final_url = fetch_bytes(url)
    return data.decode("utf-8", errors="replace"), final_url


def normalise_url(value: str, base: str) -> str:
    value = value.strip().strip('"').strip("'").replace("\\/", "/")

    if not value:
        return ""

    if value.startswith("//"):
        value = "https:" + value

    if value.startswith("/"):
        return urllib.parse.urljoin(base, value)

    if value.startswith("http://") or value.startswith("https://"):
        return value

    if (
        value.startswith("api/")
        or value.startswith("wp-json/")
        or value.startswith("download")
        or value.startswith("data/")
        or value.startswith("assets/")
        or value.startswith("static/")
    ):
        return urllib.parse.urljoin(base, value)

    return ""


def is_interesting_text(text: str) -> bool:
    lower = text.lower()
    return any(term in lower for term in TARGET_TERMS) or any(code.lower() in lower for code in TARGET_CODES)


def extract_urls(text: str, base: str) -> set[str]:
    urls: set[str] = set()

    for match in ATTR_URL_RE.finditer(text):
        url = normalise_url(match.group(1), base)
        if url:
            urls.add(url)

    for match in PLAIN_URL_RE.finditer(text):
        url = normalise_url(match.group(0), base)
        if url:
            urls.add(url)

    for match in JS_STRING_RE.finditer(text):
        value = match.group(1)
        if is_interesting_text(value):
            url = normalise_url(value, base)
            if url:
                urls.add(url)

    return urls


def extract_endpoint_strings(text: str, base: str) -> set[str]:
    endpoints: set[str] = set()

    for match in JS_STRING_RE.finditer(text):
        value = match.group(1).strip().replace("\\/", "/")

        if not is_interesting_text(value):
            continue

        if (
            value.startswith("/")
            or value.startswith("api/")
            or value.startswith("wp-json/")
            or "download" in value.lower()
            or "chem" in value.lower()
            or "wfdapi" in value.lower()
            or "GetData" in value
        ):
            url = normalise_url(value, base)
            if url:
                endpoints.add(url)
            else:
                endpoints.add(value)

    return endpoints


def read_latest_codes() -> set[str]:
    codes = set(TARGET_CODES)

    if not LATEST_JSON.exists():
        return codes

    try:
        payload = json.loads(LATEST_JSON.read_text(encoding="utf-8"))
    except Exception:
        return codes

    for record in payload.get("records", []):
        if record.get("source") != "epa_official_wq":
            continue

        for parameter in record.get("parameters", []):
            value = str(parameter.get("value") or "").strip()
            if value.startswith("IE_") or re.match(r"^\d+_\d+$", value) or "_SC_" in value:
                codes.add(value)

    return codes


def build_probe_urls() -> set[str]:
    urls = set(SEED_PAGES)
    codes = read_latest_codes()

    search_terms = sorted(set(TARGET_TERMS + list(codes)))

    for term in search_terms:
        quoted = urllib.parse.quote(term)
        urls.update({
            f"https://www.catchments.ie/?s={quoted}",
            f"https://www.catchments.ie/wp-json/wp/v2/search?search={quoted}&per_page=100",
            f"https://www.catchments.ie/wp-json/wp/v2/pages?search={quoted}&per_page=100",
            f"https://www.catchments.ie/wp-json/wp/v2/posts?search={quoted}&per_page=100",
            f"https://www.catchments.ie/data/?search={quoted}",
            f"https://www.catchments.ie/data/#/search/{quoted}",
            f"https://www.catchments.ie/data/#/waterbody/{quoted}",
            f"https://www.catchments.ie/data/#/subcatchment/{quoted}",
        })

    for code in codes:
        quoted = urllib.parse.quote(code)
        urls.update({
            f"https://www.catchments.ie/download/chemistry/{quoted}",
            f"https://www.catchments.ie/downloads/chemistry/{quoted}.csv",
            f"https://www.catchments.ie/downloads/chemistry/{quoted}.xlsx",
            f"https://www.catchments.ie/wp-content/uploads/chemistry/{quoted}.csv",
            f"https://www.catchments.ie/wp-content/uploads/chemistry/{quoted}.xlsx",
            f"https://wfdapi.edenireland.ie/api/chemistry/{quoted}",
            f"https://wfdapi.edenireland.ie/api/waterbody/{quoted}/chemistry",
            f"https://wfdapi.edenireland.ie/api/waterbody/{quoted}/chemistrydownload",
            f"https://wfdapi.edenireland.ie/api/download/chemistry/{quoted}",
        })

    return urls


def safe_filename(url: str, content_type: str, data: bytes) -> str:
    parsed = urllib.parse.urlparse(url)
    name = Path(parsed.path).name

    if not name or "." not in name:
        name = re.sub(r"[^A-Za-z0-9_.-]+", "_", parsed.netloc + "_" + parsed.path.strip("/"))[:150]

    if FILE_RE.search(name):
        return name

    if data[:2] == b"PK":
        return name + ".zip"
    if "spreadsheet" in content_type or "excel" in content_type:
        return name + ".xlsx"
    if "csv" in content_type:
        return name + ".csv"

    head = data[:2048].decode("utf-8", errors="ignore").lower()
    if "," in head and ("sample" in head or "result" in head or "determinand" in head):
        return name + ".csv"

    return name + ".dat"


def looks_like_chemistry_file(url: str, content_type: str, data: bytes) -> bool:
    lower = (url + " " + content_type).lower()

    if FILE_RE.search(url) and any(term in lower for term in ["chem", "quality", "monitor", "data", "download"]):
        return True

    if "spreadsheet" in lower or "excel" in lower or "csv" in lower or "zip" in lower:
        head = data[:4096].decode("utf-8", errors="ignore").lower()
        return is_interesting_text(head) or data[:2] == b"PK"

    if data[:2] == b"PK":
        return True

    head = data[:4096].decode("utf-8", errors="ignore").lower()
    return (
        ("sample" in head or "date" in head)
        and ("result" in head or "determinand" in head or "parameter" in head or "chemistry" in head)
    )


def save_download(url: str, data: bytes, content_type: str) -> DownloadEvent:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHEMISTRY_DIR.mkdir(parents=True, exist_ok=True)

    name = safe_filename(url, content_type, data)
    raw_path = DOWNLOAD_DIR / name
    raw_path.write_bytes(data)

    saved_files: list[str] = []

    if zipfile.is_zipfile(raw_path):
        with zipfile.ZipFile(raw_path) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue

                inner_name = Path(info.filename).name

                if not inner_name.lower().endswith((".csv", ".tsv", ".xlsx", ".xls")):
                    continue

                target = CHEMISTRY_DIR / inner_name
                with archive.open(info) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
                saved_files.append(str(target.relative_to(ROOT)))

    elif raw_path.suffix.lower() in {".csv", ".tsv", ".xlsx", ".xls"}:
        target = CHEMISTRY_DIR / raw_path.name
        shutil.copy2(raw_path, target)
        saved_files.append(str(target.relative_to(ROOT)))

    return DownloadEvent(
        url=url,
        status="downloaded" if saved_files else "downloaded_raw_only",
        saved_as=", ".join(saved_files) if saved_files else str(raw_path.relative_to(ROOT)),
        bytes=len(data),
        content_type=content_type,
    )


def scan_url(url: str, scanned: set[str], events: list[DownloadEvent]) -> tuple[set[str], set[str]]:
    links: set[str] = set()
    endpoints: set[str] = set()

    if url in scanned or len(scanned) >= SCAN_LIMIT:
        return links, endpoints

    scanned.add(url)

    try:
        text, final_url = fetch_text(url)
    except urllib.error.HTTPError as exc:
        events.append(DownloadEvent(url=url, status="not_found", reason=f"HTTP {exc.code}"))
        return links, endpoints
    except Exception as exc:
        events.append(DownloadEvent(url=url, status="failed_scan", reason=str(exc)))
        return links, endpoints

    links = extract_urls(text, final_url)
    endpoints = extract_endpoint_strings(text, final_url)

    interesting_links = {
        link for link in links
        if is_interesting_text(link) or FILE_RE.search(link) or JS_RE.search(link)
    }

    events.append(
        DownloadEvent(
            url=url,
            status="scanned",
            reason=f"{len(links)} links, {len(interesting_links)} interesting, {len(endpoints)} endpoint strings",
        )
    )

    return interesting_links, endpoints


def main() -> int:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHEMISTRY_DIR.mkdir(parents=True, exist_ok=True)

    seed_urls = build_probe_urls()
    scanned: set[str] = set()
    to_scan: list[str] = sorted(seed_urls)
    candidate_urls: set[str] = set()
    endpoint_strings: set[str] = set()
    events: list[DownloadEvent] = []

    print("Seed/probe URLs:", len(seed_urls))

    while to_scan and len(scanned) < SCAN_LIMIT:
        url = to_scan.pop(0)
        links, endpoints = scan_url(url, scanned, events)
        endpoint_strings.update(endpoints)

        for link in sorted(links):
            if FILE_RE.search(link):
                candidate_urls.add(link)
            elif JS_RE.search(link) or "wp-json" in link or "download" in link.lower() or "chem" in link.lower():
                if link not in scanned and link not in to_scan:
                    to_scan.append(link)

    for endpoint in sorted(endpoint_strings):
        if endpoint.startswith("http") and FILE_RE.search(endpoint):
            candidate_urls.add(endpoint)

    # Try endpoint strings that look callable and chemistry-related, even without file suffix.
    for endpoint in sorted(endpoint_strings):
        if endpoint.startswith("http") and ("chem" in endpoint.lower() or "download" in endpoint.lower()):
            candidate_urls.add(endpoint)

    print("Scanned URLs:", len(scanned))
    print("Endpoint strings:", len(endpoint_strings))
    print("Candidate download URLs:", len(candidate_urls))

    downloaded = 0

    for url in sorted(candidate_urls):
        try:
            data, content_type, final_url = fetch_bytes(url, timeout=45)

            if not looks_like_chemistry_file(final_url, content_type, data):
                events.append(
                    DownloadEvent(
                        url=url,
                        status="ignored",
                        reason="not recognised as chemistry data",
                        bytes=len(data),
                        content_type=content_type,
                    )
                )
                continue

            event = save_download(final_url, data, content_type)
            events.append(event)

            if event.status.startswith("downloaded"):
                downloaded += 1
                print("Downloaded:", event.saved_as)

        except urllib.error.HTTPError as exc:
            events.append(DownloadEvent(url=url, status="failed_download", reason=f"HTTP {exc.code}"))
        except Exception as exc:
            events.append(DownloadEvent(url=url, status="failed_download", reason=str(exc)))

    chemistry_files = [
        str(path.relative_to(ROOT))
        for path in sorted(CHEMISTRY_DIR.iterdir())
        if path.is_file() and path.suffix.lower() in {".csv", ".tsv", ".xlsx", ".xls"}
    ]

    CANDIDATES_TXT.write_text(
        "\n".join(
            [
                "# Candidate endpoints discovered while searching for official chemistry downloads",
                "",
                "## Candidate download URLs",
                *sorted(candidate_urls),
                "",
                "## Endpoint strings from HTML/JS/API payloads",
                *sorted(endpoint_strings),
                "",
                "## Scanned URLs",
                *sorted(scanned),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = {
        "generated_at_epoch": int(time.time()),
        "root": str(ROOT),
        "seed_probe_urls": len(seed_urls),
        "scanned_urls": len(scanned),
        "endpoint_strings": len(endpoint_strings),
        "candidate_download_urls": len(candidate_urls),
        "downloaded_files": downloaded,
        "chemistry_files_present": chemistry_files,
        "events": [asdict(event) for event in events],
    }

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("Manifest:", MANIFEST.relative_to(ROOT))
    print("Endpoint candidates:", CANDIDATES_TXT.relative_to(ROOT))
    print("Downloaded files:", downloaded)
    print("Chemistry files present:", len(chemistry_files))

    if not chemistry_files:
        print("No direct chemistry files found yet. Endpoint candidates have been recorded for the next pass.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
