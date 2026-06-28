from __future__ import annotations

import math
from typing import Any


REQUIRED_RECORD_KEYS = {
    "id",
    "source",
    "source_label",
    "type",
    "freshness",
    "name",
    "lat",
    "lon",
    "observed_at",
    "generated_at",
    "status",
    "description",
    "url",
    "focus_area_ids",
    "parameters",
}


def normalise_key(value: Any) -> str:
    import re

    return re.sub(r"_+", "_", re.sub(r"[^\w]+", "_", str(value or "").strip().lower())).strip("_")


def safe_string(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def as_float(value: Any) -> float | None:
    if value in (None, ""):
        return None

    try:
        number = float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None

    if not math.isfinite(number):
        return None

    return number


def pick(mapping: dict[str, Any], keys: list[str], fallback: Any = None) -> Any:
    if not isinstance(mapping, dict):
        return fallback

    lower = {str(key).lower(): value for key, value in mapping.items()}

    for key in keys:
        if key in mapping:
            return mapping[key]

        value = lower.get(str(key).lower())

        if value is not None:
            return value

    return fallback


def missing_record_keys(record: dict[str, Any]) -> list[str]:
    return sorted(key for key in REQUIRED_RECORD_KEYS if key not in record)
