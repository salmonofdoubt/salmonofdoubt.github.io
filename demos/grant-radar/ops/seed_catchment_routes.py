#!/usr/bin/env python3
"""Seed and tune practical Irish catchment and water-quality routes for Grant Radar.

This script updates the existing source-registry.json in place:
- adds missing practical catchment routes
- tunes existing LAWPRO / Teagasc / local-delivery entries
- adds discovery-only hubs that improve the review queue without polluting the live catalogue

It is safe to re-run. Existing matching ids are updated.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
REGISTRY_PATH = DATA_DIR / "source-registry.json"


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def upsert(items: list[dict[str, Any]], new_item: dict[str, Any]) -> None:
    for index, item in enumerate(items):
        if item.get("id") == new_item["id"]:
            merged = dict(item)
            merged.update(new_item)
            items[index] = merged
            return
    items.append(new_item)


def dedupe(values: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for value in values:
        clean = str(value).strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def main() -> None:
    registry: list[dict[str, Any]] = load_json(REGISTRY_PATH, default=[])

    tuned_existing = [
        {
            "id": "lawpro_small_grants",
            "watch_paths": ["/funding/"],
            "note": "Small-scale community water-awareness, survey, signage, education and event route.",
            "extract": {
                "title": "LAWPRO Small Grants and Events Scheme",
                "programme": "LAWPRO Small Grants and Events Scheme",
                "summary_hint": "Local community micro-grants for water-quality awareness, events, surveys, signage and small practical initiatives.",
                "status_hint": "closed",
                "scale": "local",
                "access_route": "direct",
                "applicant_types": [
                    "community groups",
                    "voluntary groups",
                    "tidy towns groups",
                ],
                "mode": "single_item",
            },
        },
        {
            "id": "lawpro_cwdf",
            "watch_paths": ["/funding/"],
            "note": "Community and voluntary funding route for local water-quality projects and awareness action.",
            "extract": {
                "title": "LAWPRO Community Water Development Fund",
                "programme": "LAWPRO Community Water Development Fund",
                "summary_hint": "Local and voluntary water-quality funding route for practical projects, awareness and community action.",
                "status_hint": "closed",
                "scale": "local",
                "access_route": "direct",
                "applicant_types": [
                    "community groups",
                    "voluntary groups",
                    "environmental NGOs",
                    "tidy towns groups",
                ],
                "mode": "single_item",
            },
        },
        {
            "id": "leader_programme",
            "note": "Rolling rural development route that can support environmental, catchment and community actions through Local Action Groups.",
            "extract": {
                "title": "LEADER rural environment and community route",
                "programme": "LEADER Programme",
                "summary_hint": "Community-led local development route via Local Action Groups for rural environmental and community projects.",
                "status_hint": "open",
                "scale": "local",
                "access_route": "via local action group",
                "applicant_types": [
                    "community groups",
                    "farmers",
                    "social enterprises",
                    "rural networks",
                ],
                "mode": "single_item",
            },
        },
        {
            "id": "teagasc_walsh",
            "watch_paths": ["/environment/water-quality/"],
            "note": "Current Teagasc postgraduate opportunities page. Retained for research-facing users alongside practical farm-delivery routes.",
        },
        {
            "id": "npws_local_biodiversity_action_fund",
            "note": "Local-authority-led biodiversity route with practical habitat and partnership relevance for catchment and community delivery.",
            "extract": {
                "title": "Local Biodiversity Action Fund",
                "programme": "NPWS Local Biodiversity Action Fund",
                "summary_hint": "Local-authority-led biodiversity route relevant through partnership delivery and practical habitat action.",
                "status_hint": "closed",
                "scale": "major",
                "access_route": "via local authority",
                "applicant_types": [
                    "local authorities",
                    "community partners",
                    "environmental NGOs",
                ],
                "mode": "single_item",
            },
        },
    ]

    new_sources = [
        {
            "id": "lawpro_catchment_support_fund",
            "name": "LAWPRO Catchment Support Fund",
            "url": "https://lawaters.ie/catchment-support-fund/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "community nature",
                "restoration",
                "capacity building",
            ],
            "discovery_method": "official page text extraction",
            "note": "Capacity-building and core-cost support for catchment partnerships and local delivery bodies.",
            "trusted_domain": "lawaters.ie",
            "source_class": "programme_page",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "annual",
            "usual_open_months": [1, 2, 3],
            "watch_paths": ["/funding/"],
            "watch_terms": [
                "catchment support fund",
                "water quality",
                "catchment partnership",
                "core costs",
                "community groups",
                "local delivery",
                "river basin management plan",
            ],
            "extract": {
                "title": "LAWPRO Catchment Support Fund",
                "programme": "LAWPRO Catchment Support Fund",
                "summary_hint": "Support for catchment partnerships and community-led water-quality bodies through core and capacity costs.",
                "status_hint": "closed",
                "scale": "local",
                "access_route": "direct",
                "applicant_types": [
                    "community groups",
                    "catchment partnerships",
                    "environmental NGOs",
                    "voluntary groups",
                ],
                "mode": "single_item",
                "opportunity_type": "community grant",
            },
        },
        {
            "id": "farming_for_water_eip",
            "name": "Farming for Water EIP",
            "url": "https://www.gov.ie/en/department-of-agriculture-food-and-the-marine/press-releases/ministers-mcconalogue-hackett-and-noonan-launch-60-million-farming-for-water-eip/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "farm nutrient management",
                "sediment control",
                "nature-based solutions",
            ],
            "discovery_method": "official press release and programme monitoring",
            "note": "Targeted farm-delivery programme aimed at improving water quality at local, catchment and national levels.",
            "trusted_domain": "gov.ie",
            "source_class": "implementation_programme",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "multiannual",
            "usual_open_months": [2, 3, 4],
            "watch_terms": [
                "farming for water",
                "eip",
                "priority areas",
                "water quality",
                "farmers invited",
                "catchment",
                "mitigation measures",
            ],
            "extract": {
                "title": "Farming for Water EIP",
                "programme": "Farming for Water EIP",
                "summary_hint": "Targeted farm-delivery programme to improve water quality through measures in priority areas.",
                "status_hint": "open",
                "scale": "major",
                "access_route": "via advisor",
                "applicant_types": [
                    "farmers",
                ],
                "mode": "single_item",
                "opportunity_type": "farm payment",
            },
        },
        {
            "id": "acres_scheme",
            "name": "ACRES",
            "url": "https://www.gov.ie/en/department-of-agriculture-food-and-the-marine/campaigns/agri-climate-rural-environment-scheme-acres/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "biodiversity",
                "peatlands",
                "habitat restoration",
                "farm payments",
            ],
            "discovery_method": "official scheme page monitoring",
            "note": "Ireland's flagship agri-environment climate scheme with major water-quality relevance through actions, NPIs and landscape measures.",
            "trusted_domain": "gov.ie",
            "source_class": "implementation_programme",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "multiannual",
            "usual_open_months": [9, 10, 11],
            "watch_terms": [
                "acres",
                "water quality protection",
                "landscape actions",
                "non-productive investments",
                "farmers",
                "co-operation",
            ],
            "extract": {
                "title": "ACRES",
                "programme": "Agri-Climate Rural Environment Scheme",
                "summary_hint": "National agri-environment scheme with water-quality, biodiversity and landscape measures for farmers.",
                "status_hint": "closed",
                "scale": "major",
                "access_route": "via advisor",
                "applicant_types": [
                    "farmers",
                ],
                "mode": "single_item",
                "opportunity_type": "farm payment",
            },
        },
        {
            "id": "better_farming_for_water",
            "name": "Teagasc Better Farming for Water",
            "url": "https://teagasc.ie/environment/water-quality/better-farming-for-water/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "farm nutrient management",
                "sediment control",
                "riparian management",
            ],
            "discovery_method": "official programme page monitoring",
            "note": "Catchment-based Teagasc campaign built around practical actions for farmers to improve water quality.",
            "trusted_domain": "teagasc.ie",
            "source_class": "implementation_programme",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "ongoing",
            "usual_open_months": [],
            "watch_terms": [
                "better farming for water",
                "8 actions for change",
                "catchment action plans",
                "farmers",
                "water quality",
            ],
            "extract": {
                "title": "Teagasc Better Farming for Water",
                "programme": "Better Farming for Water",
                "summary_hint": "Practical Teagasc campaign for farmers with catchment action plans and on-farm water-quality measures.",
                "status_hint": "open",
                "scale": "support",
                "access_route": "advisory support",
                "applicant_types": [
                    "farmers",
                ],
                "mode": "single_item",
                "opportunity_type": "implementation support",
            },
        },
        {
            "id": "assap_programme",
            "name": "ASSAP",
            "url": "https://teagasc.ie/environment/water-quality/farming-for-water-quality-assap/assap-in-detail/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "farm nutrient management",
                "sediment control",
                "advisory support",
            ],
            "discovery_method": "official programme page monitoring",
            "note": "Free and confidential advisory service working with farmers in priority areas for action to improve water quality.",
            "trusted_domain": "teagasc.ie",
            "source_class": "implementation_programme",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "ongoing",
            "usual_open_months": [],
            "watch_terms": [
                "assap",
                "advisory service",
                "farmers",
                "priority areas for action",
                "water quality",
                "confidential",
            ],
            "extract": {
                "title": "ASSAP",
                "programme": "Agricultural Sustainability Support and Advisory Programme",
                "summary_hint": "Free and confidential advisory service helping farmers improve water quality in priority areas for action.",
                "status_hint": "open",
                "scale": "support",
                "access_route": "advisory support",
                "applicant_types": [
                    "farmers",
                ],
                "mode": "single_item",
                "opportunity_type": "implementation support",
            },
        },
        {
            "id": "signpost_programme",
            "name": "Teagasc Signpost Programme",
            "url": "https://teagasc.ie/environment/climate-change-air-quality/signpost-programme/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "biodiversity",
                "climate action",
                "farm sustainability",
                "advisory support",
            ],
            "discovery_method": "official programme page monitoring",
            "note": "Free advisory and demonstration-farm route with explicit water-quality and biodiversity co-benefits.",
            "trusted_domain": "teagasc.ie",
            "source_class": "implementation_programme",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "ongoing",
            "usual_open_months": [],
            "watch_terms": [
                "signpost",
                "water quality",
                "farm sustainability",
                "advisory programme",
                "demonstration farms",
                "farmers",
            ],
            "extract": {
                "title": "Teagasc Signpost Programme",
                "programme": "Signpost Programme",
                "summary_hint": "Free farm-sustainability and advisory programme that also targets water-quality and biodiversity improvement.",
                "status_hint": "open",
                "scale": "support",
                "access_route": "advisory support",
                "applicant_types": [
                    "farmers",
                ],
                "mode": "single_item",
                "opportunity_type": "implementation support",
            },
        },
        {
            "id": "ifi_habitats_conservation",
            "name": "IFI Habitats & Conservation Funding Call",
            "url": "https://www.fisheriesireland.ie/our-services/funding/habitats-conservation-funding-call-2026",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "habitat restoration",
                "riparian management",
                "fisheries",
                "catchment delivery",
            ],
            "discovery_method": "official page text extraction",
            "note": "Practical habitat and river-restoration funding route open to eligible third parties including clubs, local authorities and tidy towns groups.",
            "trusted_domain": "fisheriesireland.ie",
            "source_class": "programme_page",
            "harvest_enabled": True,
            "discovery_enabled": True,
            "cadence": "annual",
            "usual_open_months": [10, 11, 12],
            "watch_terms": [
                "habitats and conservation funding call",
                "river restoration",
                "riparian improvement",
                "tidy towns",
                "local authorities",
                "angling clubs",
                "water quality",
            ],
            "extract": {
                "title": "IFI Habitats & Conservation Funding Call",
                "programme": "Inland Fisheries Ireland funding call",
                "summary_hint": "Practical habitat, riparian, invasive species and river-restoration funding route for eligible third parties.",
                "deadline_regex": "before\\s*(?:4:00pm|17:00 pm|5:00pm)\\s*on\\s*(?:Friday,\\s*)?([A-Za-z]+\\s+[0-9]{1,2}(?:st|nd|rd|th)?\\s+[0-9]{4}|[0-9]{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]+\\s+[0-9]{4})",
                "status_hint": "open",
                "scale": "medium",
                "access_route": "direct",
                "applicant_types": [
                    "community groups",
                    "tidy towns groups",
                    "angling clubs",
                    "local authorities",
                ],
                "mode": "single_item",
                "opportunity_type": "community grant",
            },
        },
        {
            "id": "lawpro_funding_hub",
            "name": "LAWPRO funding hub",
            "url": "https://lawaters.ie/funding/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "community nature",
                "restoration",
                "citizen science",
            ],
            "discovery_method": "official funding hub monitoring",
            "note": "Discovery-only funding hub for LAWPRO schemes and updates.",
            "trusted_domain": "lawaters.ie",
            "source_class": "funding_hub",
            "harvest_enabled": False,
            "discovery_enabled": True,
            "cadence": "ongoing",
            "usual_open_months": [],
            "watch_terms": [
                "funding",
                "catchment support fund",
                "small grants",
                "community water development fund",
                "water quality",
            ],
            "watch_paths": ["/catchment-support-fund/", "/small-grants-and-events-scheme/", "/cwdf/"],
            "extract": {
                "mode": "single_item",
            },
        },
        {
            "id": "teagasc_water_quality_hub",
            "name": "Teagasc water-quality hub",
            "url": "https://teagasc.ie/environment/water-quality/",
            "scope": "Ireland",
            "purposes": [
                "water quality",
                "catchment delivery",
                "advisory support",
                "farm nutrient management",
                "sediment control",
            ],
            "discovery_method": "official water-quality hub monitoring",
            "note": "Discovery-only hub for Teagasc catchment, ASSAP and practical water-quality routes.",
            "trusted_domain": "teagasc.ie",
            "source_class": "funding_hub",
            "harvest_enabled": False,
            "discovery_enabled": True,
            "cadence": "ongoing",
            "usual_open_months": [],
            "watch_terms": [
                "better farming for water",
                "assap",
                "water quality",
                "farmers",
                "catchment action plan",
                "support",
            ],
            "watch_paths": [
                "/environment/water-quality/better-farming-for-water/",
                "/environment/water-quality/farming-for-water-quality-assap/",
            ],
            "extract": {
                "mode": "single_item",
            },
        },
    ]

    for item in tuned_existing + new_sources:
        upsert(registry, item)

    for item in registry:
        item.setdefault("harvest_enabled", True)
        item.setdefault("discovery_enabled", True)
        item.setdefault("source_class", "programme_page")
        item.setdefault("cadence", "unknown")
        item.setdefault("usual_open_months", [])
        item.setdefault("watch_paths", [])
        item.setdefault("watch_terms", [])
        item.setdefault("trusted_domain", item.get("trusted_domain") or item["url"].split("//", 1)[-1].split("/", 1)[0].removeprefix("www."))
        extract = item.setdefault("extract", {})
        extract.setdefault("mode", "single_item")
        extract.setdefault("opportunity_type", "grant")

        item["watch_terms"] = dedupe(item["watch_terms"] + item.get("purposes", []) + [item.get("name", "")])

    registry.sort(key=lambda x: x["id"])
    save_json(REGISTRY_PATH, registry)
    print(f"Updated {REGISTRY_PATH} with practical catchment routes")


if __name__ == "__main__":
    main()
