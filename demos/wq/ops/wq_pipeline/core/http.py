from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


DEFAULT_TIMEOUT_SECONDS = 8
DEFAULT_USER_AGENT = "salmonofdoubt-wq/0.2.0 (+https://salmonofdoubt.github.io/demos/wq/)"


class FetchError(RuntimeError):
    def __init__(self, url: str, message: str, elapsed_ms: int | None = None):
        self.url = url
        self.elapsed_ms = elapsed_ms
        super().__init__(message)


@dataclass(frozen=True)
class FetchResult:
    url: str
    payload: Any
    elapsed_ms: int
    status_code: int | None = None


def fetch_json(
    url: str,
    *,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    user_agent: str = DEFAULT_USER_AGENT,
) -> FetchResult:
    started = time.monotonic()
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            elapsed_ms = int((time.monotonic() - started) * 1000)
            return FetchResult(
                url=url,
                payload=json.loads(body),
                elapsed_ms=elapsed_ms,
                status_code=getattr(response, "status", None),
            )

    except urllib.error.HTTPError as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        raise FetchError(url, f"HTTP {exc.code}: {exc.reason}", elapsed_ms) from exc

    except urllib.error.URLError as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        raise FetchError(url, f"URL error: {exc.reason}", elapsed_ms) from exc

    except TimeoutError as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        raise FetchError(url, f"Timeout after {timeout}s", elapsed_ms) from exc

    except json.JSONDecodeError as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        raise FetchError(url, f"Invalid JSON: {exc}", elapsed_ms) from exc


def extract_items(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        if payload.get("type") == "FeatureCollection" and isinstance(payload.get("features"), list):
            return payload["features"]

        for key in (
            "data",
            "results",
            "items",
            "locations",
            "measurements",
            "alerts",
            "features",
        ):
            value = payload.get(key)
            if isinstance(value, list):
                return value

    return []


def page_url(base_url: str, page: int, per_page: int) -> str:
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{urllib.parse.urlencode({'page': page, 'per_page': per_page})}"


def fetch_paged_json(
    base_url: str,
    *,
    per_page: int = 1000,
    max_pages: int = 8,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
    pause_seconds: float = 0.2,
) -> tuple[list[Any], str | None, list[FetchResult]]:
    items: list[Any] = []
    results: list[FetchResult] = []
    seen_pages: set[str] = set()

    for page in range(1, max_pages + 1):
        url = page_url(base_url, page, per_page)

        try:
            result = fetch_json(url, timeout=timeout)
        except FetchError as exc:
            return items, str(exc), results

        results.append(result)
        page_items = extract_items(result.payload)
        fingerprint = json.dumps(page_items[:3], sort_keys=True, default=str)

        if fingerprint in seen_pages:
            break

        seen_pages.add(fingerprint)

        if not page_items:
            break

        items.extend(page_items)

        if len(page_items) < per_page:
            break

        if pause_seconds > 0:
            time.sleep(pause_seconds)

    return items, None, results
