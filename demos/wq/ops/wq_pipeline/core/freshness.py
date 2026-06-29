from __future__ import annotations

from typing import Any


FRESHNESS_CLASSES: dict[str, dict[str, Any]] = {
    "live": {
        "label": "Live signal",
        "description": "Latest automated sensor or hydrometric readings.",
        "sort": 10,
    },
    "near_live": {
        "label": "Near-live alert",
        "description": "Current alert, restriction, or operational update.",
        "sort": 20,
    },
    "recent": {
        "label": "Recent official observation",
        "description": "Recent official sample or observation, not continuous live sensing.",
        "sort": 30,
    },
    "seasonal": {
        "label": "Seasonal official data",
        "description": "Seasonal or annual official monitoring information.",
        "sort": 40,
    },
    "historical": {
        "label": "Historical context",
        "description": "Historical dataset or archived monitoring context.",
        "sort": 50,
    },
    "context": {
        "label": "WFD/context layer",
        "description": "Assessment or regulatory context, not real-time water quality.",
        "sort": 60,
    },
    "planned": {
        "label": "Planned source",
        "description": "Source identified for future integration.",
        "sort": 70,
    },
}


SOURCE_TAXONOMY: dict[str, dict[str, Any]] = {
    "opw_waterlevel": {
        "freshness_class": "live",
        "signal_layer": "live_signal",
        "source_group": "hydrology",
        "is_live_signal": True,
        "display_hint": "Live hydrological pulse; not a chemistry sensor.",
    },
    "epa_bathing_alerts": {
        "freshness_class": "near_live",
        "signal_layer": "live_signal",
        "source_group": "public_health",
        "is_live_signal": True,
        "display_hint": "Current bathing-water alert or restriction.",
    },
    "epa_bathing_measurements": {
        "freshness_class": "recent",
        "signal_layer": "recent_observation",
        "source_group": "public_health",
        "is_live_signal": False,
        "display_hint": "Latest official bathing sample, not continuous live sensing.",
    },
    "epa_bathing_locations": {
        "freshness_class": "seasonal",
        "signal_layer": "official_context",
        "source_group": "public_health",
        "is_live_signal": False,
        "display_hint": "Seasonal location/profile/classification context.",
    },
    "epa_wfd": {
        "freshness_class": "context",
        "signal_layer": "wfd_context",
        "source_group": "regulatory_context",
        "is_live_signal": False,
        "display_hint": "WFD assessment context; not real-time water quality.",
    },
    "epa_geoportal_context": {
        "freshness_class": "historical",
        "signal_layer": "historical_context",
        "source_group": "regulatory_context",
        "is_live_signal": False,
        "display_hint": "Historical/context data layer.",
    },
    "marine_institute_context": {
        "freshness_class": "planned",
        "signal_layer": "planned_near_live",
        "source_group": "marine",
        "is_live_signal": False,
        "display_hint": "Planned marine/near-live integration.",
    },
}


def normalise_freshness_class(value: Any) -> str:
    key = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")

    if key in FRESHNESS_CLASSES:
        return key

    if key == "latest":
        return "recent"

    if key == "current":
        return "near_live"

    return "context"


def enrich_source_status(source_id: str, source: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(source)
    taxonomy = SOURCE_TAXONOMY.get(source_id, {})

    freshness_class = normalise_freshness_class(
        enriched.get("freshness_class") or taxonomy.get("freshness_class")
    )

    enriched["freshness_class"] = freshness_class
    enriched["freshness_label"] = FRESHNESS_CLASSES[freshness_class]["label"]
    enriched["freshness_description"] = FRESHNESS_CLASSES[freshness_class]["description"]
    enriched["freshness_sort"] = FRESHNESS_CLASSES[freshness_class]["sort"]
    enriched["signal_layer"] = taxonomy.get("signal_layer", "context")
    enriched["source_group"] = taxonomy.get("source_group", "context")
    enriched["is_live_signal"] = bool(taxonomy.get("is_live_signal", False))
    enriched["display_hint"] = taxonomy.get("display_hint", enriched.get("caveat", ""))

    return enriched
