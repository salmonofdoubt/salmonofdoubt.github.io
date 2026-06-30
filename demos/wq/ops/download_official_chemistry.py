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
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
CHEMISTRY_DIR = ROOT / "data" / "source" / "epa-chemistry"
DOWNLOAD_DIR = ROOT / "data" / "source" / "official-downloads"
MANIFEST = DOWNLOAD_DIR / "official-chemistry-download-manifest.json"
LATEST_JSON = ROOT / "data" / "latest.json"

USER_AGENT = "salmonofdoubt-wq-official-downloader/0.1"
MAX_BYTES = 250 * 1024 * 1024

SEED_PAGES = [
    "https://www.catchments.ie/data/",
    "https://www.catchments.ie/wfd-data-dashboards/",
    "https://www.catchments.ie/catchments-ie-changes-chemistry-data-downloads/",
    "https://www.catchments.ie/epa-water-quality-monitoring-datasets/",
    "https://gis.epa.ie/GetData/Download",
]

TARGET_TEXT = [
    "chemistry",
    "water quality",
    "transitional water quality",
    "coastal water quality",
    "groundwater quality",
    "interim water quality review results and data",
    "load reduction indicator data",
]

TARGET_CODES = [
    "08_3",
    "09_17",
    "08_1",
    "08_4",
    "08_5",
    "IE_EA_080_0100",
    "IE_EA_060_0100",
    "IE_EA_060_0000",
    "IE_EA_08B020400",
    "IE_EA_08D010080",
]

URL_RE = re.compile(r"""(?i)(?:href|src|data-url|data-href|url)\s*=\s*["']([^"']+)["']|https?://[^\s"'<>)]+"?""")
FILE_RE = re.compile(r"(?i)\.(csv|tsv|xlsx|xls|zip)(?:$|[?#])")


@dataclass
class DownloadEvent:
    url: str
    status: str
    reason: str = ""
    saved_as: str = ""
    bytes: int = 0


def request(url: str, *, timeout: int = 30) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"User-Agent": USER_AGENT})


def fetch_bytes(url: str, *, timeout: int = 30) -> tuple[bytes, str, str]:
    with urllib.request.urlopen(request(url), timeout=timeout) as response:
        content_type = response.headers.get("content-type", "")
        final_url = response.geturl()
        length = response.headers.get("content-length")

        if length and int(length) > MAX_BYTES:
            raise ValueError(f"file too large: {length} bytes")

        data = response.read(MAX_BYTES + 1)

    if len(data) > MAX_BYTES:
        raise ValueError(f"file larger than limit: {MAX_BYTES} bytes")

    return data, content_type, final_url


def fetch_text(url: str) -> str:
    data, _content_type, _final_url = fetch_bytes(url, timeout=30)
    return data.decode("utf-8", errors="replace")


def normalise_url(url: str, base: str) -> str:
    url = url.strip().strip('"').strip("'")
    if not url:
        return ""
    return urllib.parse.urljoin(base, url)


def discover_urls_from_html(html: str, base: str) -> set[str]:
    found: set[str] = set()

    for match in URL_RE.finditer(html):
        value = next(group for group in match.groups() if group) if match.groups() else match.group(0)
        url = normalise_url(value, base)

        if not url.startswith("http"):
            continue

        lowered = url.lower()
        surrounding = html[max(0, match.start() - 300): match.end() + 300].lower()

        if FILE_RE.search(url):
            if any(term in lowered or term in surrounding for term in TARGET_TEXT):
                found.add(url)
            continue

        if "download" in lowered or "getdata" in lowered or "chem" in lowered:
            found.add(url)

    return found


def build_probe_urls() -> set[str]:
    urls = set(SEED_PAGES)

    # These are deliberate probes. Some will 404. Successful ones are kept in the manifest.
    for code in TARGET_CODES:
        quoted = urllib.parse.quote(code)
        urls.update({
            f"https://www.catchments.ie/data/#/waterbody/{quoted}",
            f"https://www.catchments.ie/data/#/subcatchment/{quoted}",
            f"https://www.catchments.ie/data/?code={quoted}",
            f"https://www.catchments.ie/data/?search={quoted}",
            f"https://www.catchments.ie/download/chemistry/{quoted}",
            f"https://www.catchments.ie/downloads/chemistry/{quoted}.csv",
            f"https://www.catchments.ie/downloads/chemistry/{quoted}.xlsx",
            f"https://wfdapi.edenireland.ie/api/chemistry/{quoted}",
            f"https://wfdapi.edenireland.ie/api/waterbody/{quoted}/chemistry",
        })

    if LATEST_JSON.exists():
        try:
            payload = json.loads(LATEST_JSON.read_text(encoding="utf-8"))
            for record in payload.get("records", []):
                if record.get("source") != "epa_official_wq":
                    continue
                for parameter in record.get("parameters", []):
                    value = str(parameter.get("value") or "")
                    if value.startswith("IE_") or re.match(r"^\d+_\d+$", value):
                        quoted = urllib.parse.quote(value)
                        urls.update({
                            f"https://www.catchments.ie/data/#/waterbody/{quoted}",
                            f"https://www.catchments.ie/data/?search={quoted}",
                            f"https://www.catchments.ie/download/chemistry/{quoted}",
                            f"https://www.catchments.ie/downloads/chemistry/{quoted}.csv",
                            f"https://www.catchments.ie/downloads/chemistry/{quoted}.xlsx",
                        })
        except Exception:
            pass

    return urls


def safe_filename(url: str, content_type: str, data: bytes) -> str:
    parsed = urllib.parse.urlparse(url)
    name = Path(parsed.path).name

    if not name or "." not in name:
        name = re.sub(r"[^A-Za-z0-9_.-]+", "_", parsed.netloc + "_" + parsed.path.strip("/"))[:120]

    if FILE_RE.search(name):
        return name

    if data[:2] == b"PK":
        return name + ".zip"
    if "spreadsheet" in content_type or "excel" in content_type:
        return name + ".xlsx"
    if "csv" in content_type or data[:200].count(b",") >= 2:
        return name + ".csv"

    return name + ".dat"


def looks_like_data(url: str, content_type: str, data: bytes) -> bool:
    lowered = (url + " " + content_type).lower()

    if FILE_RE.search(url):
        return True
    if "spreadsheet" in lowered or "excel" in lowered or "csv" in lowered or "zip" in lowered:
        return True
    if data[:2] == b"PK":
        return True

    head = data[:2048].decode("utf-8", errors="ignore").lower()
    if "sample" in head and ("result" in head or "determinand" in head or "chemistry" in head):
        return True

    return False


def save_download(url: str, data: bytes, content_type: str) -> DownloadEvent:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHEMISTRY_DIR.mkdir(parents=True, exist_ok=True)

    name = safe_filename(url, content_type, data)
    raw_path = DOWNLOAD_DIR / name
    raw_path.write_bytes(data)

    saved_files = []

    if zipfile.is_zipfile(raw_path):
        with zipfile.ZipFile(raw_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                inner = Path(info.filename).name
                if not FILE_RE.search(inner):
                    continue
                if not inner.lower().endswith((".csv", ".tsv", ".xlsx", ".xls")):
                    continue
                target = CHEMISTRY_DIR / inner
                with zf.open(info) as src, target.open("wb") as dst:
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
    )


def main() -> int:
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    CHEMISTRY_DIR.mkdir(parents=True, exist_ok=True)

    probe_urls = build_probe_urls()
    discovered: set[str] = set()
    events: list[DownloadEvent] = []

    print("Seed/probe URLs:", len(probe_urls))

    for url in sorted(probe_urls):
        try:
            html = fetch_text(url)
            links = discover_urls_from_html(html, url)
            discovered.update(links)
            events.append(DownloadEvent(url=url, status="scanned", reason=f"{len(links)} candidate links"))
        except urllib.error.HTTPError as exc:
            events.append(DownloadEvent(url=url, status="not_found", reason=f"HTTP {exc.code}"))
        except Exception as exc:
            events.append(DownloadEvent(url=url, status="failed_scan", reason=str(exc)))

    # Also try any file-looking probe URLs directly.
    discovered.update(url for url in probe_urls if FILE_RE.search(url))

    print("Discovered candidate download URLs:", len(discovered))

    downloaded = 0

    for url in sorted(discovered):
        try:
            data, content_type, final_url = fetch_bytes(url, timeout=45)

            if not looks_like_data(final_url, content_type, data):
                events.append(DownloadEvent(url=url, status="ignored", reason=f"not a recognised data file: {content_type}"))
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

    manifest = {
        "generated_at_epoch": int(time.time()),
        "seed_probe_urls": len(probe_urls),
        "candidate_download_urls": len(discovered),
        "downloaded_files": downloaded,
        "chemistry_files_present": [
            str(path.relative_to(ROOT))
            for path in sorted(CHEMISTRY_DIR.iterdir())
            if path.is_file() and path.suffix.lower() in {".csv", ".tsv", ".xlsx", ".xls"}
        ],
        "events": [asdict(event) for event in events],
    }

    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("Manifest:", MANIFEST.relative_to(ROOT))
    print("Downloaded files:", downloaded)
    print("Chemistry files present:", len(manifest["chemistry_files_present"]))

    if manifest["chemistry_files_present"]:
        return 0

    print("No direct official chemistry files were downloadable from discovered public links.")
    print("The manifest records which public endpoints were tested.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
