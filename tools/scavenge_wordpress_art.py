#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit, unquote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ART_DIR = ROOT / "art"
DATA_DIR = ART_DIR / "data"

SITE = "https://qiquantum.wordpress.com"

SOURCES = [
    {
        "key": "oil",
        "collection": "Oil Paintings",
        "url": f"{SITE}/",
        "intro": "Oil paintings, larger canvases, architectural heat studies, portraits where identifiable, and other studio works.",
        "order": 10,
    },
    {
        "key": "watercolour",
        "collection": "Watercolours",
        "url": f"{SITE}/water-colour/",
        "intro": "Watercolours, paper works, systems images and portrait material where identifiable.",
        "order": 20,
    },
    {
        "key": "drawings",
        "collection": "Drawings",
        "url": f"{SITE}/drawings-wip/",
        "intro": "Drawings, studies, portraits where identifiable, botanical observations and coastal works on paper.",
        "order": 30,
    },
    {
        "key": "experimental",
        "collection": "Experimental",
        "url": f"{SITE}/experimental/",
        "intro": "Studio experiments, colour tests, digital processes and unresolved visual research.",
        "order": 40,
    },
    {
        "key": "geospatial",
        "collection": "GeoSpatial Imagery",
        "url": f"{SITE}/geospatial-imagery/",
        "intro": "Maps, field layouts and spatial images where environmental evidence becomes visual structure.",
        "order": 50,
    },
]

IMAGE_RE = re.compile(
    r"""(?:
        https?:\\?/\\?/[^"'()<>\s]+?
        |
        https?://[^"'()<>\s]+?
        |
        /wp-content/uploads/[^"'()<>\s]+?
    )
    \.(?:jpe?g|png|webp)(?:\?[^"'()<>\s]+)?""",
    re.IGNORECASE | re.VERBOSE,
)

NOISE_RE = re.compile(
    r"(avatar|gravatar|profile|logo|icon|button|blank|spacer|wordpress\.com/i/|wpcom-smile|cropped-default|design-a-site)",
    re.IGNORECASE,
)

PORTRAIT_RE = re.compile(
    r"\b(portrait|self[- ]?portrait|face|figure|head|person|woman|man|girl|boy|human|andre|diandre)\b",
    re.IGNORECASE,
)


def fetch(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 salmonofdoubt-art-scavenger/2.0",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", errors="replace")


def normalise_html(raw: str) -> str:
    raw = raw.replace("\\/", "/")
    raw = html.unescape(raw)
    return raw


def canonical_url(url: str) -> str:
    url = url.replace("\\/", "/").strip()
    if url.startswith("/wp-content/"):
        url = SITE + url
    if url.startswith("//"):
        url = "https:" + url

    parts = urlsplit(url)
    path = unquote(parts.path)

    # WordPress image sizing query fragments create many duplicates. Use the full original path.
    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def strip_tags(value: str) -> str:
    value = re.sub(r"<script.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def context_for(raw: str, start: int, end: int) -> str:
    left = max(0, start - 900)
    right = min(len(raw), end + 900)
    return strip_tags(raw[left:right])[:700]


def filename_title(url: str) -> str:
    stem = Path(urlsplit(url).path).stem
    stem = unquote(stem)
    stem = re.sub(r"^original[-_a-z0-9]*", "", stem, flags=re.I)
    stem = re.sub(r"^\d{8}_\d+", "", stem)
    stem = re.sub(r"[-_]+", " ", stem).strip()
    stem = re.sub(r"\s+", " ", stem)
    if not stem or stem.isdigit():
        return "Archive work"
    return stem[:1].upper() + stem[1:]


def known_title(url: str, context: str, collection: str, index: int) -> str:
    blob = f"{url} {context}".lower()

    if "20250712_191825" in blob:
        return "Mura di Ferrara, heat wall study"

    if "red hot metropolis" in blob:
        return "Red Hot Metropolis, number 032"

    if "decisiontree" in blob or "decision tree" in blob or "tippingpoint" in blob or "bar chart" in blob:
        return "Decision tree, tipping point, bar chart"

    if "portmarnock" in blob:
        return "Portmarnock study"

    if "orto botanico" in blob or "botanico" in blob:
        return "Orto Botanico study"

    if "the shore" in blob and "underpainting" in blob:
        return "Ferrara wall, underpainting"

    title = filename_title(url)
    if title == "Archive work":
        title = f"{collection} work {index:03d}"
    return title


def subgroup_for(collection: str, title: str, context: str, url: str) -> str:
    blob = f"{title} {context} {url}".lower()

    if PORTRAIT_RE.search(blob):
        return "Portraits"

    if collection == "Oil Paintings":
        if "ferrara" in blob or "wall" in blob or "20250712_191825" in blob:
            return "Architecture, heat and place"
        if "red hot metropolis" in blob or "metropolis" in blob:
            return "Urban heat"
        if "underpainting" in blob:
            return "Process and underpaintings"
        return "Other oil paintings"

    if collection == "Watercolours":
        if "decision" in blob or "tipping" in blob or "bar chart" in blob:
            return "Systems and diagrams"
        return "Other watercolours"

    if collection == "Drawings":
        if "portmarnock" in blob or "coast" in blob:
            return "Coastal studies"
        if "orto botanico" in blob or "botanical" in blob:
            return "Botanical studies"
        return "Other drawings"

    if collection == "GeoSpatial Imagery":
        return "Maps and field images"

    return "Studio experiments"


def medium_for(collection: str, subgroup: str) -> str:
    if collection == "Oil Paintings":
        return "Oil painting"
    if collection == "Watercolours":
        return "Watercolour"
    if collection == "Drawings":
        return "Drawing"
    if collection == "GeoSpatial Imagery":
        return "Geospatial image"
    return "Experimental work"


def interpretation(title: str, collection: str, subgroup: str, context: str, url: str) -> tuple[str, str]:
    blob = f"{title} {context} {url}".lower()

    if "ferrara" in blob or "20250712_191825" in blob:
        return (
            "A study of the city wall in Ferrara: brick, heat, age and defence compressed into a red architectural field.",
            "The wall is not background. It is a thermal and historical body, holding weather, civic memory and urban enclosure.",
        )

    if "red hot metropolis" in blob or "metropolis" in blob:
        return (
            "An overheated city under larger hidden structures: climate systems, infrastructure, computation and power.",
            "The work asks what urban life feels like when the systems shaping it remain mostly invisible.",
        )

    if "decision" in blob or "tipping" in blob or "bar chart" in blob:
        return (
            "A hybrid between watercolour and systems diagram, where decision logic becomes visual, emotional and unstable.",
            "Maps and charts can assist judgement, but they must not replace situated human interpretation.",
        )

    if subgroup == "Portraits":
        return (
            "A portrait or figure-based work from the archive, held back from pure description so the face remains a site of interpretation.",
            "The portrait group is important because ecological art also needs human presence, vulnerability and witness.",
        )

    if collection == "Oil Paintings":
        return (
            "An oil work from the archive, now placed inside a more deliberate ecological and atmospheric reading.",
            "Read through material pressure, colour, place and embodied perception rather than as isolated decoration.",
        )

    if collection == "Watercolours":
        return (
            "A watercolour work where colour, mark and speed keep the image open rather than over-resolved.",
            "The medium allows ecological and systems thinking to stay provisional, mobile and human.",
        )

    if collection == "Drawings":
        return (
            "A drawing from the archive, using line as a way of slowing attention.",
            "The drawing section keeps observation close to hand, eye and place.",
        )

    if collection == "GeoSpatial Imagery":
        return (
            "A spatial image where field evidence, boundaries and sampling logic become visual structure.",
            "This is the bridge between environmental research and art: evidence made legible, but not mistaken for judgement.",
        )

    return (
        "A studio experiment retained because it shows method, risk and visual research in motion.",
        "The experimental section is the laboratory, not the storage cupboard.",
    )


def extract_from_page(source: dict[str, Any], global_seen: set[str]) -> list[dict[str, Any]]:
    raw = normalise_html(fetch(source["url"]))
    records: list[dict[str, Any]] = []

    local_seen: set[str] = set()

    for match in IMAGE_RE.finditer(raw):
        found = match.group(0)
        url = canonical_url(found)

        if NOISE_RE.search(url):
            continue

        if "/wp-content/uploads/" not in url:
            continue

        if url in local_seen:
            continue

        local_seen.add(url)

        # Allow the same image to appear on multiple pages only once, under the first source page.
        if url in global_seen:
            continue

        global_seen.add(url)

        context = context_for(raw, match.start(), match.end())
        index = len(records) + 1
        title = known_title(url, context, source["collection"], index)
        subgroup = subgroup_for(source["collection"], title, context, url)
        medium = medium_for(source["collection"], subgroup)
        text, reading = interpretation(title, source["collection"], subgroup, context, url)

        records.append(
            {
                "id": f"{source['key']}-{index:03d}",
                "collection": source["collection"],
                "collectionOrder": source["order"],
                "subgroup": subgroup,
                "title": title,
                "medium": medium,
                "image": url,
                "thumb": url,
                "source": source["collection"],
                "sourceUrl": url,
                "context": context,
                "text": text,
                "reading": reading,
                "alt": f"{title}, {medium.lower()}",
                "order": index,
            }
        )

    return records


def add_existing_feature(records: list[dict[str, Any]]) -> None:
    featured = ROOT / "images" / "001-2.jpg"
    if not featured.exists():
        return

    records.insert(
        0,
        {
            "id": "manual-nasturtium",
            "collection": "Oil Paintings",
            "collectionOrder": 5,
            "subgroup": "Ecological Interiorism",
            "title": "Nasturtium, heat bloom study",
            "medium": "Oil painting",
            "image": "../images/001-2.jpg",
            "thumb": "../images/001-2.jpg",
            "source": "GitHub",
            "sourceUrl": "",
            "context": "Existing GitHub portfolio image",
            "text": "A floral interior where colour behaves like climate perception.",
            "reading": "This is the anchor for the new style: ecological colour as climate perception inside the home.",
            "alt": "Ecological floral painting with orange, red and yellow flowers on a deep green ground",
            "order": 0,
        },
    )


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    global_seen: set[str] = set()
    records: list[dict[str, Any]] = []

    for source in SOURCES:
      print(f"Fetching {source['collection']} from {source['url']}")
      page_records = extract_from_page(source, global_seen)
      print(f"  found {len(page_records)} uploaded images")
      records.extend(page_records)

    add_existing_feature(records)

    records.sort(key=lambda item: (item["collectionOrder"], item["subgroup"], item["order"]))

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceSite": SITE,
        "sources": SOURCES,
        "notes": [
            "Generated from public WordPress page HTML by scanning uploaded media URLs.",
            "Portrait classification is heuristic until manually curated.",
            "Images are referenced from the WordPress archive for immediate completeness.",
        ],
        "artworks": records,
    }

    (DATA_DIR / "artworks.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    overrides_path = DATA_DIR / "artwork-overrides.json"
    if not overrides_path.exists():
        overrides_path.write_text(
            json.dumps(
                {
                    "instructions": "Manual corrections keyed by artwork id. Use this later for exact titles and portrait/non-portrait curation.",
                    "overrides": {},
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    print()
    print(f"Scavenged {len(records)} artworks.")
    by_collection: dict[str, int] = {}
    by_subgroup: dict[tuple[str, str], int] = {}

    for item in records:
        by_collection[item["collection"]] = by_collection.get(item["collection"], 0) + 1
        key = (item["collection"], item["subgroup"])
        by_subgroup[key] = by_subgroup.get(key, 0) + 1

    print("By collection:")
    for collection, total in sorted(by_collection.items()):
        print(f"  {collection}: {total}")

    print("By subgroup:")
    for (collection, subgroup), total in sorted(by_subgroup.items()):
        print(f"  {collection} / {subgroup}: {total}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
