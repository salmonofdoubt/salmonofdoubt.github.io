from __future__ import annotations

import urllib.parse
from typing import Any

from wq_pipeline.core.geo import coordinate_from_record
from wq_pipeline.core.http import FetchError, FetchResult, extract_items, fetch_json
from wq_pipeline.core.records import pick, safe_string
from wq_pipeline.core.status import make_source_status


SOURCE_ID = "epa_wfd"
WFD_SEARCH = "https://wfdapi.edenireland.ie/api/search"


def elapsed_ms(fetches: list[FetchResult]) -> int | None:
    if not fetches:
        return None

    return sum(fetch.elapsed_ms for fetch in fetches)


def wfd_code(item: dict[str, Any], fallback: str) -> str:
    return safe_string(
        pick(item, ["code", "wb_code", "waterbody_code", "id", "objectid"], fallback)
    )


def build_wfd_record(
    item: dict[str, Any],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
    keyword: str,
    fallback_code: str,
) -> dict[str, Any]:
    code = wfd_code(item, fallback_code)
    name = safe_string(
        pick(item, ["name", "wb_name", "waterbody_name", "label"], keyword)
    )
    lat, lon = coordinate_from_record(item, name)

    return {
        "id": f"wfd:{code}",
        "source": SOURCE_ID,
        "source_label": source_defs[SOURCE_ID]["name"],
        "type": "wfd_context",
        "freshness": "context",
        "name": name,
        "lat": lat,
        "lon": lon,
        "observed_at": pick(item, ["cycle", "date", "updated", "year"], None),
        "generated_at": now,
        "status": safe_string(pick(item, ["status", "risk", "category", "type"], "context")),
        "description": safe_string(
            pick(
                item,
                ["description", "waterbody_type", "catchment_name"],
                "EPA WFD open-data search result.",
            )
        ),
        "url": "https://www.catchments.ie/",
        "parameters": [],
        "raw": item,
    }


def build_wfd_records(
    items_by_keyword: list[tuple[str, list[Any]]],
    *,
    now: str,
    source_defs: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for keyword, items in items_by_keyword:
        for item in items:
            if not isinstance(item, dict):
                continue

            code = wfd_code(item, f"{keyword}_{len(records)}")

            if code in seen:
                continue

            seen.add(code)
            records.append(
                build_wfd_record(
                    item,
                    now=now,
                    source_defs=source_defs,
                    keyword=keyword,
                    fallback_code=f"{keyword}_{len(records)}",
                )
            )

    return records


def harvest_wfd(
    now: str,
    keywords: list[str],
    *,
    source_defs: dict[str, dict[str, Any]],
    timeout: int = 8,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    errors: list[str] = []
    fetches: list[FetchResult] = []
    items_by_keyword: list[tuple[str, list[Any]]] = []

    for keyword in keywords:
        query = urllib.parse.urlencode({"v": keyword, "size": 8})
        url = f"{WFD_SEARCH}?{query}"

        try:
            result = fetch_json(url, timeout=timeout)
        except FetchError as exc:
            errors.append(f"{keyword}: {exc}")
            continue
        except Exception as exc:
            errors.append(f"{keyword}: {exc}")
            continue

        fetches.append(result)
        items_by_keyword.append((keyword, extract_items(result.payload)))

    records = build_wfd_records(
        items_by_keyword,
        now=now,
        source_defs=source_defs,
    )

    error = "; ".join(errors[:3]) if errors else None

    return records, make_source_status(
        source_defs,
        SOURCE_ID,
        status="partial" if errors else "ok",
        records=len(records),
        fetched_at_utc=now,
        error=error,
        elapsed_ms=elapsed_ms(fetches),
    )
