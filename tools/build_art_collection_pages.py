#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
DATA = ART / "data" / "artworks.json"

COLLECTIONS = [
    {
        "name": "Oil Paintings",
        "slug": "oil-paintings",
        "kicker": "Oil on canvas and board",
        "description": "Portraits, interiors, flowers, walls, urban heat and other oil works.",
        "terms": ["manual-nasturtium", "ferrara", "mura", "red hot metropolis", "portrait"],
    },
    {
        "name": "Watercolours",
        "slug": "watercolours",
        "kicker": "Watercolour and paper",
        "description": "Colour studies, portraits where identifiable, systems images and paper works.",
        "terms": ["decision", "tipping", "watercolour", "portrait", "framed"],
    },
    {
        "name": "Drawings",
        "slug": "drawings",
        "kicker": "Drawing and observation",
        "description": "Portraits, coastal studies, botanical works and other drawings.",
        "terms": ["portrait", "portmarnock", "botanical", "orto", "coast"],
    },
    {
        "name": "Experimental",
        "slug": "experimental",
        "kicker": "Studio research",
        "description": "Colour tests, digital processes, material accidents and unresolved visual research.",
        "terms": ["experimental", "colour", "abstract", "studio"],
    },
    {
        "name": "GeoSpatial Imagery",
        "slug": "geospatial-imagery",
        "kicker": "Maps and spatial images",
        "description": "Geospatial imagery, field layouts and visual systems work.",
        "terms": ["geospatial", "field", "map", "site", "agevaluate"],
    },
]

HERO_IMAGE = "../images/001-2.jpg"


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def load_manifest() -> dict:
    if DATA.exists():
        return json.loads(DATA.read_text())
    return {"artworks": []}


def group_by_collection(artworks: list[dict]) -> dict[str, list[dict]]:
    grouped = {item["name"]: [] for item in COLLECTIONS}
    for artwork in artworks:
        collection = artwork.get("collection")
        if collection in grouped:
            grouped[collection].append(artwork)
    return grouped


def image_src(item: dict | None, fallback: str = HERO_IMAGE) -> str:
    if not item:
        return fallback
    return item.get("thumb") or item.get("image") or fallback


def score_artwork(item: dict, terms: list[str]) -> int:
    blob = " ".join(
        str(item.get(key, ""))
        for key in ["id", "title", "subgroup", "image", "text", "reading"]
    ).lower()

    score = 0

    title = str(item.get("title", "")).lower()
    if "work " not in title:
        score += 20

    for term in terms:
        if term in blob:
            score += 24

    priority_terms = {
        "manual-nasturtium": 70,
        "ferrara": 60,
        "mura": 56,
        "red hot metropolis": 52,
        "portrait": 34,
        "portmarnock": 30,
        "decision": 30,
        "tipping": 30,
        "geospatial": 30,
        "field map": 30,
    }

    for term, points in priority_terms.items():
        if term in blob:
            score += points

    return score


def featured(items: list[dict], collection: dict, limit: int = 6) -> list[dict]:
    return sorted(items, key=lambda item: score_artwork(item, collection["terms"]), reverse=True)[:limit]


def collection_tile(collection: dict, items: list[dict]) -> str:
    lead = featured(items, collection, 1)[0] if items else None

    return f'''      <a class="collection-tile" href="{collection["slug"]}/">
        <img src="{esc(image_src(lead))}" alt="{esc((lead or {}).get("alt") or (lead or {}).get("title") or collection["name"])}" loading="lazy">
        <div class="collection-tile-caption">
          <p class="micro">{esc(collection["kicker"])}</p>
          <h2>{esc(collection["name"])}</h2>
          <p>{esc(collection["description"])}</p>
          <small>{len(items)} works</small>
        </div>
      </a>'''


def art_index_html(grouped: dict[str, list[dict]]) -> str:
    tiles = "\n".join(
        collection_tile(collection, grouped.get(collection["name"], []))
        for collection in COLLECTIONS
    )

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="theme-color" content="#070605">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DiAndré | Painter & Visual Artist</title>
  <meta name="description" content="DiAndré, the visual art practice of André Baumann: oil paintings, watercolours, drawings, experimental work and geospatial imagery.">
  <link rel="stylesheet" href="../assets/css/site.css">
  <link rel="stylesheet" href="assets/art-gallery.css">
</head>
<body class="art-body art-home">
  <header class="site-header">
    <div class="container topbar">
      <a class="brand" href="../index.html">André Baumann</a>
      <nav class="nav" aria-label="Primary">
        <a href="../index.html">Home</a>
        <a href="index.html" aria-current="page">Art</a>
        <a href="../music/">Music</a>
        <a href="../demos/">Demos</a>
      </nav>
    </div>
  </header>

  <main class="art-main">
    <section class="home-hero" aria-labelledby="art-title">
      <div class="home-copy">
        <p class="micro">Painter · visual artist · systems thinker</p>
        <h1 id="art-title">DiAndré</h1>
        <p>
          I make oil paintings, watercolours, drawings and spatial images. The work moves between portraits, interiors, flowers, city walls, maps and the atmosphere of places.
        </p>
        <p>
          The environmental and systems background is present, but the work begins with looking, colour, memory and material presence.
        </p>
        <nav class="small-nav" aria-label="Art collections">
          <a href="oil-paintings/">Oil</a>
          <a href="watercolours/">Watercolours</a>
          <a href="drawings/">Drawings</a>
          <a href="experimental/">Experimental</a>
          <a href="geospatial-imagery/">GeoSpatial</a>
        </nav>
      </div>

      <figure class="home-image">
        <img src="{HERO_IMAGE}" alt="Large floral oil painting with orange, red and yellow flowers on a green ground">
      </figure>
    </section>

    <section class="home-section">
      <div class="section-heading">
        <p class="micro">Collections</p>
        <h2>Five rooms.</h2>
        <p>Each room opens with a selected work, then the wider archive continues inside.</p>
      </div>

      <div class="collection-tiles">
{tiles}
      </div>
    </section>

    <section class="home-section about-section">
      <div class="section-heading">
        <p class="micro">About</p>
        <h2>A painter with a systems eye.</h2>
        <p>DiAndré is the visual art practice of André Baumann: painter, independent environmental researcher and systems thinker. The work is environmentally inclined, but not reduced to messaging. It is about seeing, presence, pressure, memory and place.</p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p class="small">© André Baumann / DiAndré.</p>
      <p class="small">
        <a class="text-link" href="mailto:andre.c.baumann@gmail.com">Email</a>
        <a class="text-link" href="https://www.instagram.com/diandre.42/" target="_blank" rel="noopener">Instagram</a>
        <a class="text-link" href="https://qiquantum.wordpress.com/" target="_blank" rel="noopener">WordPress archive</a>
      </p>
    </div>
  </footer>

  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def collection_page_html(collection: dict, items: list[dict]) -> str:
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="theme-color" content="#070605">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DiAndré | {esc(collection["name"])}</title>
  <meta name="description" content="{esc(collection["description"])}">
  <link rel="stylesheet" href="../../assets/css/site.css">
  <link rel="stylesheet" href="../assets/art-gallery.css">
</head>
<body class="art-body" data-page-type="collection" data-collection="{esc(collection["name"])}" data-manifest-path="../data/artworks.json" data-asset-prefix="../">
  <header class="site-header">
    <div class="container topbar">
      <a class="brand" href="../../index.html">André Baumann</a>
      <nav class="nav" aria-label="Primary">
        <a href="../../index.html">Home</a>
        <a href="../index.html" aria-current="page">Art</a>
        <a href="../../music/">Music</a>
        <a href="../../demos/">Demos</a>
      </nav>
    </div>
  </header>

  <main class="art-main">
    <p class="back-row"><a class="small-button" href="../index.html">← Back to Art</a></p>

    <section class="collection-header">
      <div>
        <p class="micro">{esc(collection["kicker"])}</p>
        <h1>{esc(collection["name"])}</h1>
      </div>
      <p>{esc(collection["description"])}</p>
      <p class="count">{len(items)} works</p>
    </section>

    <section id="collection-root" class="collection-root" aria-live="polite"></section>
  </main>

  <dialog class="work-lightbox" id="work-lightbox" aria-labelledby="lightbox-title">
    <div class="lightbox-inner">
      <div class="lightbox-image-wrap"><img id="lightbox-image" alt=""></div>
      <div class="lightbox-copy">
        <button class="lightbox-close" type="button" aria-label="Close artwork view">×</button>
        <p class="lightbox-meta" id="lightbox-meta"></p>
        <h3 id="lightbox-title"></h3>
        <p class="lightbox-text" id="lightbox-text"></p>
        <p class="lightbox-reading" id="lightbox-reading"></p>
        <p id="lightbox-source"></p>
      </div>
    </div>
  </dialog>

  <footer class="site-footer">
    <div class="container">
      <p class="small"><a class="text-link" href="../index.html">Back to Art</a> · © André Baumann / DiAndré.</p>
    </div>
  </footer>

  <script src="../assets/art-gallery.js" defer></script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def main() -> None:
    manifest = load_manifest()
    grouped = group_by_collection(manifest.get("artworks", []))

    (ART / "index.html").write_text(art_index_html(grouped), encoding="utf-8")

    for collection in COLLECTIONS:
        out_dir = ART / collection["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(
            collection_page_html(collection, grouped.get(collection["name"], [])),
            encoding="utf-8",
        )

    print("Built calm gallery pages.")
    for collection in COLLECTIONS:
        print(f"{collection['name']}: {len(grouped.get(collection['name'], []))} works")


if __name__ == "__main__":
    main()
