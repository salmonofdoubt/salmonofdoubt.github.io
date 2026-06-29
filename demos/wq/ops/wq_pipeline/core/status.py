from __future__ import annotations

from typing import Any

from wq_pipeline.core.freshness import enrich_source_status


def make_source_status(
    source_defs: dict[str, dict[str, Any]],
    source_id: str,
    *,
    status: str,
    records: int,
    fetched_at_utc: str,
    error: str | None = None,
    elapsed_ms: int | None = None,
) -> dict[str, Any]:
    base = enrich_source_status(source_id, dict(source_defs.get(source_id, {})))

    source = {
        **base,
        "id": source_id,
        "status": status,
        "records": records,
        "fetched_at_utc": fetched_at_utc,
    }

    if error:
        source["error"] = error

    if elapsed_ms is not None:
        source["elapsed_ms"] = elapsed_ms

    return source


def combine_status(statuses: list[dict[str, Any]]) -> str:
    if not statuses:
        return "empty"

    failed = [source for source in statuses if source.get("status") == "failed"]
    ok = [source for source in statuses if source.get("status") == "ok"]

    if failed and ok:
        return "partial"

    if failed:
        return "failed"

    if ok:
        return "ok"

    return "context"
