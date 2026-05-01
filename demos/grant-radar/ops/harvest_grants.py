#!/usr/bin/env python3
"""Grant Radar harvester using the compact public-state model.

Public model written to catalog items:
- programme_kind: recurring_programme | rolling_support | one_off_call | announcement_or_results
- programme_state: open | upcoming | closed | archived
- expected_next_window: human-readable next round hint or null
- public_visible_state: public_visible | review_only | discovery_only

Legacy compatibility fields are still emitted so the front end does not break:
- public_visibility
- current_availability
- recurrence_type
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

SITE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = SITE_DIR / "data"
REGISTRY_PATH = DATA_DIR / "source-registry.json"
CATALOG_PATH = DATA_DIR / "catalog.json"
HARVEST_MEMORY_PATH = DATA_DIR / "harvest-memory.json"
HARVEST_AUDIT_PATH = DATA_DIR / "harvest-audit.json"
USER_AGENT = "GrantRadarBot/1.5 (+https://salmonofdoubt.github.io/demos/grant-radar/)"
TIMEOUT = (10, 30)

APPLICANT_PRIORITY = [
    "local groups",
    "farmers",
    "public bodies",
    "researchers",
    "businesses",
    "NGOs",
    "schools",
    "households",
]

SCALE_PRIORITY = ["local", "support", "medium", "major"]

ACCESS_PRIORITY = [
    "direct",
    "advisory support",
    "via advisor",
    "via local authority",
    "via local action group",
    "via project coordinator",
    "consortium",
]

PROGRAMME_KIND_VALUES = {
    "recurring_programme",
    "rolling_support",
    "one_off_call",
    "announcement_or_results",
}
PROGRAMME_STATE_VALUES = {"open", "upcoming", "closed", "archived"}
PUBLIC_VISIBLE_STATE_VALUES = {"public_visible", "review_only", "discovery_only"}

LEGACY_PUBLIC_VISIBILITY_VALUES = {"public_visible", "discovery_only", "archived"}
LEGACY_CURRENT_AVAILABILITY_VALUES = {"open_now", "closed_for_now", "closed", "unknown"}
LEGACY_RECURRENCE_TYPE_VALUES = {"recurring", "rolling", "one_off", "unknown"}

MONTH_NAMES = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


@dataclass
class ExtractedItem:
    source_id: str
    source_name: str
    title: str
    programme: str
    url: str
    summary: str
    status: str
    change_type: str
    changed_at: str | None
    deadline_iso: str | None
    deadline_text: str | None
    region: str
    audience: list[str]
    applicant_types: list[str]
    access_route: str | None
    scale: str | None
    purposes: list[str]
    keywords: list[str]
    cta_label: str
    opportunity_type: str
    programme_kind: str
    programme_state: str
    expected_next_window: str | None
    public_visible_state: str
    last_verified_at: str
    last_open_year: int | None
    public_visibility: str
    current_availability: str
    recurrence_type: str
    mode_relevance: dict[str, str]
    mode_reason: dict[str, str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": slugify(f"{self.source_id}_{self.title}"),
            "source_id": self.source_id,
            "source_name": self.source_name,
            "title": self.title,
            "programme": self.programme,
            "url": self.url,
            "summary": self.summary,
            "status": self.status,
            "change_type": self.change_type,
            "changed_at": self.changed_at,
            "deadline_iso": self.deadline_iso,
            "deadline_text": self.deadline_text,
            "region": self.region,
            "audience": self.audience,
            "applicant_types": self.applicant_types,
            "access_route": self.access_route,
            "scale": self.scale,
            "purposes": self.purposes,
            "keywords": self.keywords,
            "cta_label": self.cta_label,
            "opportunity_type": self.opportunity_type,
            "programme_kind": self.programme_kind,
            "programme_state": self.programme_state,
            "expected_next_window": self.expected_next_window,
            "public_visible_state": self.public_visible_state,
            "last_verified_at": self.last_verified_at,
            "last_open_year": self.last_open_year,
            "public_visibility": self.public_visibility,
            "current_availability": self.current_availability,
            "recurrence_type": self.recurrence_type,
            "mode_relevance": self.mode_relevance,
            "mode_reason": self.mode_reason,
        }


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def fetch_text(url: str) -> tuple[str, str | None]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IE,en;q=0.9",
        "Cache-Control": "no-cache",
    }
    response = requests.get(url, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    text = soup.get_text("\n", strip=True)
    last_modified = response.headers.get("Last-Modified")
    if last_modified:
        try:
            return text, parsedate_to_datetime(last_modified).astimezone(UTC).isoformat()
        except Exception:
            return text, None
    return text, None


def regex_extract(pattern: str | None, text: str) -> str | None:
    if not pattern:
        return None
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip(" .")


def normalise_date(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None

    display = re.sub(r"\s+", " ", str(value)).strip(" .")
    cleaned = re.sub(r"(\d{1,2})(st|nd|rd|th)\b", r"\1", display, flags=re.IGNORECASE)
    cleaned = re.sub(r"\blocal Irish time\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bIrish time\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bIST\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace(".", ":")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.")

    try:
        dt = dateparser.parse(cleaned, dayfirst=True)
        if not dt:
            return None, display
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC).isoformat(), display
    except Exception:
        return None, display


def dedupe_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        clean = str(value).strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        out.append(clean)
    return out


def ordered(values: list[str], priority: list[str]) -> list[str]:
    unique = dedupe_keep_order(values)
    order_map = {value: index for index, value in enumerate(priority)}
    return sorted(unique, key=lambda value: (order_map.get(value, 999), value.lower()))


def normalise_applicant_types(raw_types: list[str]) -> list[str]:
    lowered = [value.lower() for value in raw_types]
    simplified: list[str] = []

    def has(*needles: str) -> bool:
        return any(any(needle in value for needle in needles) for value in lowered)

    if has(
        "community",
        "voluntary",
        "tidy",
        "angling",
        "association",
        "local development",
        "catchment partnership",
        "rural network",
        "social enterprise",
        "community partners",
        "river trust",
    ):
        simplified.append("local groups")
    if has("farmer", "farmers", "farm family"):
        simplified.append("farmers")
    if has("local authorit", "public bod", "project coordinator", "state agenc", "co-operation project"):
        simplified.append("public bodies")
    if has("research", "universit", "institute", "phd", "postgraduate", "scholar"):
        simplified.append("researchers")
    if has("business", "enterprise", "founder", "micro-enterprise"):
        simplified.append("businesses")
    if has("ngo", "non-governmental", "conservation group", "heritage ngo", "environmental ngo"):
        simplified.append("NGOs")
    if has("school"):
        simplified.append("schools")
    if has("homeowner", "household"):
        simplified.append("households")

    if not simplified:
        simplified = raw_types[:]

    return ordered(simplified, APPLICANT_PRIORITY)


def normalise_scale(raw_scale: str | None) -> str | None:
    if not raw_scale:
        return None
    lowered = raw_scale.lower().strip()
    if lowered in {"micro", "small", "local"}:
        return "local"
    if lowered in {"support", "advisory support", "implementation support"}:
        return "support"
    if lowered == "medium":
        return "medium"
    if lowered == "major":
        return "major"
    return raw_scale


def normalise_access_route(raw_route: str | None) -> str | None:
    if not raw_route:
        return None
    lowered = raw_route.lower().strip()
    if lowered in {"advisory support", "implementation support"}:
        return "advisory support"
    if lowered in {"via advisor", "via adviser", "via project advisor"}:
        return "via advisor"
    if lowered in {"via local authority", "via local authorities"}:
        return "via local authority"
    if lowered in {"via local action group", "via lag"}:
        return "via local action group"
    if lowered in {"via project coordinator"}:
        return "via project coordinator"
    if lowered in {"consortium", "via consortium"}:
        return "consortium"
    return "direct" if lowered == "direct" else raw_route


def valid_or_none(value: str | None, allowed: set[str]) -> str | None:
    if not value:
        return None
    lowered = str(value).strip().lower()
    return lowered if lowered in allowed else None


def month_window_label(months: list[int], year: int | None = None) -> str | None:
    unique_months = sorted({int(m) for m in months if isinstance(m, int) and 1 <= int(m) <= 12})
    if not unique_months:
        return None

    if len(unique_months) == 1:
        label = MONTH_NAMES[unique_months[0]]
    else:
        contiguous = all(unique_months[i] + 1 == unique_months[i + 1] for i in range(len(unique_months) - 1))
        if contiguous:
            label = f"{MONTH_NAMES[unique_months[0]]}–{MONTH_NAMES[unique_months[-1]]}"
        else:
            label = ", ".join(MONTH_NAMES[m] for m in unique_months)

    return f"{label} {year}" if year else label


def title_lower(source: dict[str, Any]) -> str:
    extract = source.get("extract", {})
    title = extract.get("title") or source.get("name") or ""
    return str(title).strip().lower()


def legacy_recurrence_type_to_programme_kind(value: str | None) -> str | None:
    lowered = valid_or_none(value, LEGACY_RECURRENCE_TYPE_VALUES)
    if lowered == "recurring":
        return "recurring_programme"
    if lowered == "rolling":
        return "rolling_support"
    if lowered == "one_off":
        return "one_off_call"
    return None


def legacy_current_availability_to_programme_state(
    value: str | None,
    programme_kind: str,
) -> str | None:
    lowered = valid_or_none(value, LEGACY_CURRENT_AVAILABILITY_VALUES)
    if lowered == "open_now":
        return "open"
    if lowered == "closed_for_now":
        return "closed"
    if lowered == "closed":
        if programme_kind in {"one_off_call", "announcement_or_results"}:
            return "archived"
        return "closed"
    return None


def legacy_public_visibility_to_public_visible_state(value: str | None) -> str | None:
    lowered = valid_or_none(value, LEGACY_PUBLIC_VISIBILITY_VALUES)
    if lowered == "public_visible":
        return "public_visible"
    if lowered in {"discovery_only", "archived"}:
        return "discovery_only"
    return None


def programme_kind_to_legacy_recurrence_type(programme_kind: str) -> str:
    if programme_kind == "recurring_programme":
        return "recurring"
    if programme_kind == "rolling_support":
        return "rolling"
    if programme_kind in {"one_off_call", "announcement_or_results"}:
        return "one_off"
    return "unknown"


def programme_state_to_legacy_current_availability(programme_kind: str, programme_state: str) -> str:
    if programme_state == "open":
        return "open_now"
    if programme_state == "upcoming":
        return "closed_for_now"
    if programme_state == "closed":
        return "closed_for_now" if programme_kind in {"recurring_programme", "rolling_support"} else "closed"
    if programme_state == "archived":
        return "closed"
    return "unknown"


def new_public_visible_state_to_legacy_public_visibility(
    public_visible_state: str,
    programme_state: str,
) -> str:
    if public_visible_state == "public_visible":
        return "public_visible"
    if programme_state == "archived":
        return "archived"
    return "discovery_only"


def infer_programme_kind(source: dict[str, Any], opportunity_type: str, access_route: str | None) -> str:
    extract = source.get("extract", {})

    explicit = valid_or_none(
        extract.get("programme_kind") or source.get("programme_kind"),
        PROGRAMME_KIND_VALUES,
    )
    if explicit:
        return explicit

    legacy = legacy_recurrence_type_to_programme_kind(
        extract.get("recurrence_type") or source.get("recurrence_type")
    )
    if legacy:
        return legacy

    lowered_title = title_lower(source)
    source_class = str(source.get("source_class", "")).strip().lower()
    cadence = str(source.get("cadence", "")).strip().lower()
    lowered_opportunity_type = str(opportunity_type or "").strip().lower()
    lowered_access = str(access_route or "").strip().lower()

    if (
        source_class == "news_hub"
        or "press release" in lowered_title
        or "minister announces" in lowered_title
        or "announces over €" in lowered_title
        or "results" in lowered_title
        or "awarded" in lowered_title
    ):
        return "announcement_or_results"

    if cadence in {"ongoing", "rolling"}:
        return "rolling_support"

    if cadence in {"annual", "multiannual"}:
        return "recurring_programme"

    if cadence in {"historic", "one_off"} or source_class in {"historic_call", "historic_programme"}:
        return "one_off_call"

    if source_class in {"implementation_programme", "support_programme"}:
        return "rolling_support"

    if lowered_access in {"advisory support", "via advisor", "via local authority", "via local action group"}:
        return "rolling_support"

    if lowered_opportunity_type in {"support", "advisory support"}:
        return "rolling_support"

    if re.search(r"\b20\d{2}\b", lowered_title):
        return "one_off_call"

    if "grant scheme" in lowered_title or "scholarship programme" in lowered_title:
        return "recurring_programme"

    if "programme" in lowered_title or "support" in lowered_title or "advisory" in lowered_title:
        return "rolling_support"

    return "one_off_call"


def infer_programme_state(source: dict[str, Any], status_hint: str, programme_kind: str) -> str:
    extract = source.get("extract", {})

    explicit = valid_or_none(
        extract.get("programme_state") or source.get("programme_state"),
        PROGRAMME_STATE_VALUES,
    )
    if explicit:
        return explicit

    legacy = legacy_current_availability_to_programme_state(
        extract.get("current_availability") or source.get("current_availability"),
        programme_kind,
    )
    if legacy:
        return legacy

    lowered_status = str(status_hint or "").strip().lower()

    if lowered_status == "open":
        return "open"
    if lowered_status == "upcoming":
        return "upcoming"

    if programme_kind in {"recurring_programme", "rolling_support"}:
        return "closed"

    if lowered_status in {"closed", "awarded", "expired"}:
        return "archived"

    return "archived"


def infer_last_open_year(
    source: dict[str, Any],
    deadline_iso: str | None,
    programme_state: str,
) -> int | None:
    explicit = source.get("last_open_year")
    if isinstance(explicit, int):
        return explicit

    if deadline_iso:
        try:
            return datetime.fromisoformat(deadline_iso.replace("Z", "+00:00")).year
        except Exception:
            pass

    if programme_state == "open":
        return datetime.now(UTC).year

    return None


def infer_expected_next_window(
    source: dict[str, Any],
    programme_kind: str,
    programme_state: str,
    last_open_year: int | None,
) -> str | None:
    extract = source.get("extract", {})
    explicit = extract.get("expected_next_window") or source.get("expected_next_window")
    if explicit:
        return str(explicit)

    if programme_kind == "rolling_support":
        return "Rolling"

    if programme_kind != "recurring_programme":
        return None

    months = source.get("usual_open_months") or []
    if not isinstance(months, list) or not months:
        return None

    if programme_state == "open":
        target_year = datetime.now(UTC).year
    elif programme_state in {"closed", "archived"}:
        target_year = (last_open_year + 1) if last_open_year else (datetime.now(UTC).year + 1)
    else:
        target_year = datetime.now(UTC).year

    return month_window_label(months, target_year)


def infer_public_visible_state(
    source: dict[str, Any],
    programme_kind: str,
    programme_state: str,
) -> str:
    extract = source.get("extract", {})

    explicit = valid_or_none(
        extract.get("public_visible_state") or source.get("public_visible_state"),
        PUBLIC_VISIBLE_STATE_VALUES,
    )
    if explicit:
        return explicit

    legacy = legacy_public_visibility_to_public_visible_state(
        extract.get("public_visibility") or source.get("public_visibility")
    )
    if legacy:
        return legacy

    source_class = str(source.get("source_class", "")).strip().lower()

    if source_class in {"funding_hub", "news_hub"}:
        return "discovery_only"

    if programme_kind == "announcement_or_results":
        return "discovery_only"

    if programme_kind == "one_off_call" and programme_state == "archived":
        return "discovery_only"

    if programme_state == "archived":
        return "discovery_only"

    return "public_visible"


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(UTC)
    except Exception:
        return None


def generic_deadline_extract(text: str) -> str | None:
    patterns = [
        r"Deadline\s*#?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20[0-9]{2}(?:,?\s*[0-9]{1,2}[:.][0-9]{2})?(?:\s*(?:local Irish time|Irish time|UTC|GMT|IST))?)",
        r"(?:Application deadline|Submission deadline|Applicant submission deadline|Closing date)\s*#?\s*:?\s*([^\n\r]{0,160}?20[0-9]{2}(?:[^\n\r]{0,80})?)",
        r"(?:Applications? close|Applications? must be submitted by|Submit(?:ted)? by)\s*:?\s*([^\n\r]{0,160}?20[0-9]{2}(?:[^\n\r]{0,80})?)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text or "", flags=re.IGNORECASE | re.DOTALL)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip(" .")
    return None


def explicit_page_status(text: str) -> str | None:
    lines = [
        re.sub(r"\s+", " ", line).strip()
        for line in (text or "").splitlines()
        if re.sub(r"\s+", " ", line).strip()
    ]
    lowered = [line.lower() for line in lines]

    joined = "\n".join(lines)
    match = re.search(
        r"(?:Status|Programme status|Call status)\s*#?\s*(Open|Closed|Upcoming)",
        joined,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).lower()

    for i, line in enumerate(lowered):
        if line in {"status", "programme status", "call status"} and i + 1 < len(lowered):
            nxt = lowered[i + 1]
            if nxt in {"open", "closed", "upcoming"}:
                return nxt

        # Many funding pages use a compact card: "Open" followed shortly by "Deadline".
        if line in {"open", "closed", "upcoming"}:
            nearby = " ".join(lowered[i + 1:i + 6])
            if "deadline" in nearby or "application" in nearby or "funding" in nearby:
                return line

    return None


def resolve_dynamic_state(
    *,
    text: str,
    source: dict[str, Any],
    programme_kind: str,
    registry_programme_state: str,
    deadline_iso: str | None,
    seen_at: str,
) -> dict[str, Any]:
    now_dt = parse_iso_datetime(seen_at) or datetime.now(UTC)
    deadline_dt = parse_iso_datetime(deadline_iso)
    page_status = explicit_page_status(text)

    state = registry_programme_state
    state_source = "registry_fallback"
    confidence = 0.45

    if deadline_dt:
        if deadline_dt > now_dt:
            state = "open"
            state_source = "deadline_future"
            confidence = 0.90
        else:
            if programme_kind in {"recurring_programme", "rolling_support"}:
                state = "closed"
                state_source = "deadline_past_recurring"
                confidence = 0.82
            else:
                state = "archived"
                state_source = "deadline_past_one_off"
                confidence = 0.82

    if page_status == "open":
        state = "open"
        state_source = "page_status_open"
        confidence = 0.95
    elif page_status == "upcoming" and state != "open":
        state = "upcoming"
        state_source = "page_status_upcoming"
        confidence = 0.90
    elif page_status == "closed" and not (deadline_dt and deadline_dt > now_dt):
        if programme_kind in {"recurring_programme", "rolling_support"}:
            state = "closed"
        else:
            state = "archived"
        state_source = "page_status_closed"
        confidence = 0.90

    if state == "archived":
        public_visible_state = "discovery_only"
    else:
        public_visible_state = infer_public_visible_state(source, programme_kind, state)

    return {
        "programme_state": state,
        "public_visible_state": public_visible_state,
        "state_source": state_source,
        "state_confidence": confidence,
        "page_status": page_status,
    }


def memory_entry_from_item(item: dict[str, Any], seen_at: str) -> dict[str, Any]:
    return {
        "source_id": item.get("source_id"),
        "title": item.get("title"),
        "url": item.get("url"),
        "programme_state": item.get("programme_state"),
        "programme_kind": item.get("programme_kind"),
        "public_visible_state": item.get("public_visible_state"),
        "deadline_iso": item.get("deadline_iso"),
        "deadline_text": item.get("deadline_text"),
        "expected_next_window": item.get("expected_next_window"),
        "last_open_year": item.get("last_open_year"),
        "last_successful_fetch_at": seen_at,
        "state_source": item.get("state_source"),
        "state_confidence": item.get("state_confidence"),
    }


def determine_change(item: ExtractedItem, previous_map: dict[str, dict[str, Any]], seen_at: str) -> None:
    key = slugify(f"{item.source_id}_{item.title}")
    old = previous_map.get(key)
    if not old:
        item.change_type = "new"
        item.changed_at = seen_at
        return

    old_deadline = old.get("deadline_text") or ""
    new_deadline = item.deadline_text or ""
    if old_deadline != new_deadline:
        item.change_type = "deadline_updated"
        item.changed_at = seen_at
        return

    old_state = old.get("programme_state") or old.get("status") or ""
    if old_state != item.programme_state:
        item.change_type = "status_changed"
        item.changed_at = seen_at
        return

    item.change_type = old.get("change_type", "none") if old.get("change_type") == "awarded" else "none"
    item.changed_at = old.get("changed_at")


def harvest() -> dict[str, Any]:
    registry = load_json(REGISTRY_PATH, default=[])
    previous_catalog = load_json(CATALOG_PATH, default={})
    previous_items = {item["id"]: item for item in previous_catalog.get("opportunities", [])}
    harvest_memory = load_json(HARVEST_MEMORY_PATH, default={})

    seen_at = datetime.now(UTC).replace(microsecond=0).isoformat()
    harvest_audit: dict[str, Any] = {
        "generated_at": seen_at,
        "engine": "dynamic-state-harvest-2.0",
        "state_mismatches": [],
        "fetch_failures_using_last_known_good": [],
        "fetch_failures_using_registry_fallback": [],
        "state_source_counts": {},
    }
    sources_out: list[dict[str, Any]] = []
    items_out: list[dict[str, Any]] = []

    purposes_seen: set[str] = set()
    applicant_seen: set[str] = set()
    access_seen: set[str] = set()
    scale_seen: set[str] = set()
    kind_seen: set[str] = set()
    state_seen: set[str] = set()
    public_state_seen: set[str] = set()

    for source in registry:
        if not source.get("harvest_enabled", True):
            continue

        extract = source.get("extract", {})
        summary = extract.get("summary_hint") or source.get("note", "")
        raw_applicant_types = extract.get("applicant_types", [])
        applicant_types = normalise_applicant_types(raw_applicant_types)
        access_route = normalise_access_route(extract.get("access_route"))
        scale = normalise_scale(extract.get("scale"))
        opportunity_type = extract.get("opportunity_type", "grant")
        status_hint = str(extract.get("status_hint", "open")).strip().lower()

        keywords = ordered(
            [
                str(source.get("name", "")).lower(),
                *source.get("purposes", []),
                *raw_applicant_types,
                *applicant_types,
                opportunity_type,
            ],
            [],
        )

        try:
            text, checked_at = fetch_text(source["url"])
            verified_at = checked_at or seen_at

            deadline_raw = regex_extract(extract.get("deadline_regex"), text) or generic_deadline_extract(text)
            launch_raw = regex_extract(extract.get("launch_regex"), text) or regex_extract(extract.get("open_regex"), text)
            deadline_iso, deadline_text = normalise_date(deadline_raw)

            programme_kind = infer_programme_kind(source, opportunity_type, access_route)
            registry_programme_state = infer_programme_state(source, status_hint, programme_kind)
            dynamic_state = resolve_dynamic_state(
                text=text,
                source=source,
                programme_kind=programme_kind,
                registry_programme_state=registry_programme_state,
                deadline_iso=deadline_iso,
                seen_at=seen_at,
            )
            programme_state = dynamic_state["programme_state"]
            public_visible_state = dynamic_state["public_visible_state"]

            if registry_programme_state != programme_state:
                harvest_audit["state_mismatches"].append(
                    {
                        "id": source["id"],
                        "name": source["name"],
                        "registry_state": registry_programme_state,
                        "page_state": programme_state,
                        "state_source": dynamic_state["state_source"],
                        "deadline_text": deadline_text,
                    }
                )

            last_open_year = infer_last_open_year(source, deadline_iso, programme_state)
            expected_next_window = infer_expected_next_window(
                source,
                programme_kind,
                programme_state,
                last_open_year,
            )

            legacy_recurrence_type = programme_kind_to_legacy_recurrence_type(programme_kind)
            legacy_current_availability = programme_state_to_legacy_current_availability(
                programme_kind,
                programme_state,
            )
            legacy_public_visibility = new_public_visible_state_to_legacy_public_visibility(
                public_visible_state,
                programme_state,
            )

            public_status = programme_state if programme_state in {"open", "upcoming", "closed"} else "closed"

            item = ExtractedItem(
                source_id=source["id"],
                source_name=source["name"],
                title=extract.get("title", source["name"]),
                programme=extract.get("programme", source["name"]),
                url=source["url"],
                summary=summary,
                status=public_status,
                change_type="none",
                changed_at=None,
                deadline_iso=deadline_iso,
                deadline_text=deadline_text or (f"Launch or open marker: {launch_raw}" if launch_raw else None),
                region=source.get("scope", "—"),
                audience=raw_applicant_types,
                applicant_types=applicant_types,
                access_route=access_route,
                scale=scale,
                purposes=source.get("purposes", []),
                keywords=keywords,
                cta_label=f"Open {source['name']}",
                opportunity_type=opportunity_type,
                programme_kind=programme_kind,
                programme_state=programme_state,
                expected_next_window=expected_next_window,
                public_visible_state=public_visible_state,
                last_verified_at=verified_at,
                last_open_year=last_open_year,
                public_visibility=legacy_public_visibility,
                current_availability=legacy_current_availability,
                recurrence_type=legacy_recurrence_type,
                mode_relevance=dict(source.get("mode_relevance", {})),
                mode_reason=dict(source.get("mode_reason", {})),
            )

            determine_change(item, previous_items, seen_at)
            item_dict = item.as_dict()
            item_dict.update(
                {
                    "state_source": dynamic_state["state_source"],
                    "state_confidence": dynamic_state["state_confidence"],
                    "page_status": dynamic_state["page_status"],
                    "fetch_status": "ok",
                    "last_successful_fetch_at": verified_at,
                }
            )
            items_out.append(item_dict)
            harvest_memory[source["id"]] = memory_entry_from_item(item_dict, verified_at)

            sources_out.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source.get("scope", "—"),
                    "purposes": source.get("purposes", []),
                    "note": source.get("note", ""),
                    "last_checked": verified_at,
                    "discovery_method": source.get("discovery_method", "configured extraction"),
                    "fetch_status": "ok",
                }
            )

        except requests.exceptions.RequestException as exc:
            print(f"[WARN] Failed to fetch {source['name']} ({source['url']}): {exc}")

            # Keep curated registry entries visible even when the source website
            # times out, blocks the bot, or has a transient SSL/content error.
            # The source card records the fetch error, but the opportunity card
            # is still generated from the trusted registry metadata.
            programme_kind = infer_programme_kind(source, opportunity_type, access_route)
            memory_entry = harvest_memory.get(source["id"], {}) if isinstance(harvest_memory, dict) else {}

            if memory_entry:
                programme_state = memory_entry.get("programme_state") or infer_programme_state(source, status_hint, programme_kind)
                public_visible_state = memory_entry.get("public_visible_state") or infer_public_visible_state(
                    source,
                    programme_kind,
                    programme_state,
                )
                last_open_year = memory_entry.get("last_open_year")
                expected_next_window = memory_entry.get("expected_next_window")
                fallback_deadline_iso = memory_entry.get("deadline_iso")
                fallback_deadline_text = memory_entry.get("deadline_text")
                fallback_verified_at = memory_entry.get("last_successful_fetch_at") or seen_at
                fallback_state_source = "last_known_good"
                fallback_state_confidence = 0.70
                harvest_audit["fetch_failures_using_last_known_good"].append(
                    {
                        "id": source["id"],
                        "name": source["name"],
                        "error": str(exc),
                        "last_successful_fetch_at": fallback_verified_at,
                        "programme_state": programme_state,
                    }
                )
            else:
                programme_state = infer_programme_state(source, status_hint, programme_kind)
                last_open_year = infer_last_open_year(source, None, programme_state)
                expected_next_window = infer_expected_next_window(
                    source,
                    programme_kind,
                    programme_state,
                    last_open_year,
                )
                public_visible_state = infer_public_visible_state(
                    source,
                    programme_kind,
                    programme_state,
                )
                fallback_deadline_iso = None
                fallback_deadline_text = None
                fallback_verified_at = seen_at
                fallback_state_source = "registry_fallback_after_fetch_error"
                fallback_state_confidence = 0.35
                harvest_audit["fetch_failures_using_registry_fallback"].append(
                    {
                        "id": source["id"],
                        "name": source["name"],
                        "error": str(exc),
                        "programme_state": programme_state,
                    }
                )

            legacy_recurrence_type = programme_kind_to_legacy_recurrence_type(programme_kind)
            legacy_current_availability = programme_state_to_legacy_current_availability(
                programme_kind,
                programme_state,
            )
            legacy_public_visibility = new_public_visible_state_to_legacy_public_visibility(
                public_visible_state,
                programme_state,
            )

            public_status = programme_state if programme_state in {"open", "upcoming", "closed"} else "closed"

            fallback_item = ExtractedItem(
                source_id=source["id"],
                source_name=source["name"],
                title=extract.get("title", source["name"]),
                programme=extract.get("programme", source["name"]),
                url=source["url"],
                summary=summary,
                status=public_status,
                change_type="none",
                changed_at=None,
                deadline_iso=fallback_deadline_iso,
                deadline_text=fallback_deadline_text,
                region=source.get("scope", "—"),
                audience=raw_applicant_types,
                applicant_types=applicant_types,
                access_route=access_route,
                scale=scale,
                purposes=source.get("purposes", []),
                keywords=keywords,
                cta_label=f"Open {source['name']}",
                opportunity_type=opportunity_type,
                programme_kind=programme_kind,
                programme_state=programme_state,
                expected_next_window=expected_next_window,
                public_visible_state=public_visible_state,
                last_verified_at=fallback_verified_at,
                last_open_year=last_open_year,
                public_visibility=legacy_public_visibility,
                current_availability=legacy_current_availability,
                recurrence_type=legacy_recurrence_type,
                mode_relevance=dict(source.get("mode_relevance", {})),
                mode_reason=dict(source.get("mode_reason", {})),
            )

            determine_change(fallback_item, previous_items, seen_at)
            fallback_dict = fallback_item.as_dict()
            fallback_dict.update(
                {
                    "state_source": fallback_state_source,
                    "state_confidence": fallback_state_confidence,
                    "fetch_status": "error",
                    "fetch_error": str(exc),
                    "last_successful_fetch_at": fallback_verified_at if memory_entry else None,
                }
            )
            items_out.append(fallback_dict)

            sources_out.append(
                {
                    "id": source["id"],
                    "name": source["name"],
                    "url": source["url"],
                    "scope": source.get("scope", "—"),
                    "purposes": source.get("purposes", []),
                    "note": source.get("note", ""),
                    "last_checked": seen_at,
                    "discovery_method": source.get("discovery_method", "configured extraction"),
                    "fetch_status": "error",
                    "fetch_error": str(exc),
                }
            )

        purposes_seen.update(source.get("purposes", []))
        applicant_seen.update(applicant_types)
        if access_route:
            access_seen.add(access_route)
        if scale:
            scale_seen.add(scale)

    for item in items_out:
        kind_seen.add(item.get("programme_kind", "one_off_call"))
        state_seen.add(item.get("programme_state", "closed"))
        public_state_seen.add(item.get("public_visible_state", "discovery_only"))

    public_items = [item for item in items_out if item.get("public_visible_state") == "public_visible"]
    discovery_only_items = [item for item in items_out if item.get("public_visible_state") == "discovery_only"]
    archived_items = [item for item in items_out if item.get("programme_state") == "archived"]

    source_counts: dict[str, int] = {}
    for item in items_out:
        key = str(item.get("state_source") or "unknown")
        source_counts[key] = source_counts.get(key, 0) + 1
    harvest_audit["state_source_counts"] = source_counts
    harvest_audit["public_visible_count"] = len(public_items)
    harvest_audit["total_harvested_count"] = len(items_out)

    save_json(HARVEST_MEMORY_PATH, harvest_memory)
    save_json(HARVEST_AUDIT_PATH, harvest_audit)

    return {
        "meta": {
            "title": "Grant Radar",
            "generated_at": seen_at,
            "generator": "grant-radar-demo 1.5.0",
            "available_purposes": sorted(purposes_seen),
            "available_applicant_types": ordered(list(applicant_seen), APPLICANT_PRIORITY),
            "available_access_routes": ordered(list(access_seen), ACCESS_PRIORITY),
            "available_scales": ordered(list(scale_seen), SCALE_PRIORITY),
            "available_programme_kinds": sorted(kind_seen),
            "available_programme_states": sorted(state_seen),
            "available_public_visible_states": sorted(public_state_seen),
            "public_visible_count": len(public_items),
            "discovery_only_count": len(discovery_only_items),
            "archived_count": len(archived_items),
            "total_harvested_count": len(items_out),
        },
        "sources": sources_out,
        "opportunities": items_out,
    }


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    catalog = harvest()
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {CATALOG_PATH}")


if __name__ == "__main__":
    main()