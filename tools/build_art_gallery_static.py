from __future__ import annotations

from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
DATA = ART / "data" / "artworks.json"
CURATION = ART / "data" / "art-curation.json"

COLLECTIONS = [
    {"name": "Oil Paintings", "slug": "oil-paintings", "kicker": "Oil on canvas and board", "description": "Portraits, interiors, flowers, walls, urban heat and other oil works.", "score_terms": ["interior", "window", "curtain", "door", "room", "ferrara", "mura", "portrait"]},
    {"name": "Watercolours", "slug": "watercolours", "kicker": "Watercolour and paper", "description": "Colour studies, portraits where identifiable, systems images and paper works.", "score_terms": ["watercolour", "portrait", "colour", "study"]},
    {"name": "Drawings", "slug": "drawings", "kicker": "Drawing and observation", "description": "Portraits, coastal studies, botanical works and other drawings.", "score_terms": ["drawing", "portrait", "coast", "botanical", "observation"]},
    {"name": "Experimental", "slug": "experimental", "kicker": "Studio research", "description": "Colour tests, digital processes, material accidents and unresolved visual research.", "score_terms": ["cloud", "blue", "sky", "experimental", "colour", "abstract"]},
    {"name": "GeoSpatial Imagery", "slug": "geospatial-imagery", "kicker": "Maps and spatial images", "description": "Geospatial imagery, field layouts and visual systems work.", "score_terms": ["geospatial", "map", "field", "site", "spatial"]},
]

HERO_FALLBACK = "../images/001-2.jpg"


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def load_artworks() -> list[dict]:
    records = read_json(DATA, {"artworks": []}).get("artworks", [])
    return [
        record for record in records
        if str(record.get("status", "active")).lower() not in {"hidden", "deleted", "draft"}
    ]

def load_curation() -> dict:
    return read_json(CURATION, {"homepageHero": {}, "collections": {}})


def group_by_collection(artworks: list[dict]) -> dict[str, list[dict]]:
    grouped = {item["name"]: [] for item in COLLECTIONS}
    for artwork in artworks:
        collection = artwork.get("collection")
        if collection in grouped:
            grouped[collection].append(artwork)
    return grouped


def blob(item: dict) -> str:
    return " ".join(str(item.get(k, "")) for k in [
        "id", "title", "collection", "subgroup", "medium", "image", "thumb",
        "sourceUrl", "text", "reading", "alt"
    ]).lower()


def curated_item(selector: dict, collection_name: str | None = None) -> dict | None:
    if not selector or not selector.get("image"):
        return None

    return {
        "id": selector.get("id") or f"curated-{(collection_name or 'feature').lower().replace(' ', '-')}",
        "collection": collection_name or selector.get("collection") or "",
        "title": selector.get("title") or selector.get("titleContains") or "Selected work",
        "medium": selector.get("medium") or "",
        "subgroup": selector.get("subgroup") or "Curated feature",
        "image": selector["image"],
        "thumb": selector.get("thumb") or selector["image"],
        "sourceUrl": selector.get("sourceUrl") or selector["image"],
        "alt": selector.get("alt") or selector.get("title") or "Selected artwork",
        "text": selector.get("text") or "",
        "reading": selector.get("reading") or "",
        "order": -999
    }


def selector_matches(item: dict, selector: dict) -> bool:
    if not selector:
        return False

    if selector.get("id") and item.get("id") == selector["id"]:
        return True

    if selector.get("image"):
        image = selector["image"]
        if item.get("image") == image or item.get("thumb") == image or item.get("sourceUrl") == image:
            return True

    if selector.get("titleContains"):
        return str(selector["titleContains"]).lower() in str(item.get("title", "")).lower()

    return False


def score_item(item: dict, terms: list[str]) -> int:
    text = blob(item)
    title = str(item.get("title", "")).lower()
    score = 0
    if title and "work " not in title:
        score += 12
    for term in terms:
        if term in text:
            score += 10
    return score


def choose_feature(items: list[dict], collection: dict, curation: dict) -> dict | None:
    rule = curation.get("collections", {}).get(collection["name"], {}).get("feature", {})

    if rule:
        for item in items:
            if selector_matches(item, rule):
                return item
        external = curated_item(rule, collection["name"])
        if external:
            return external

    if not items:
        return None

    return max(items, key=lambda item: score_item(item, collection["score_terms"]))


def choose_home_hero(grouped: dict[str, list[dict]], curation: dict) -> dict | None:
    rule = curation.get("homepageHero", {})
    target_collection = rule.get("collection")
    candidates = grouped.get(target_collection, []) if target_collection else [item for group in grouped.values() for item in group]

    for item in candidates:
        if selector_matches(item, rule):
            return item

    external = curated_item(rule, target_collection)
    if external:
        return external

    oil = next(item for item in COLLECTIONS if item["name"] == "Oil Paintings")
    return choose_feature(grouped.get("Oil Paintings", []), oil, curation)


def ordered_archive(items: list[dict], collection: dict, feature: dict | None) -> list[dict]:
    ordered = sorted(items, key=lambda item: score_item(item, collection["score_terms"]), reverse=True)
    if not feature:
        return ordered

    feature_id = feature.get("id")
    feature_image = feature.get("image")
    return [
        item for item in ordered
        if item.get("id") != feature_id
        and item.get("image") != feature_image
        and item.get("thumb") != feature_image
        and item.get("sourceUrl") != feature_image
    ]


def image_path(item: dict | None, nested: bool = False, thumb: bool = False) -> str:
    if item:
        value = (item.get("thumb") if thumb else item.get("image")) or item.get("image") or item.get("thumb") or HERO_FALLBACK
    else:
        value = HERO_FALLBACK

    if value.startswith("http://") or value.startswith("https://") or value.startswith("/"):
        return value

    return ("../" + value) if nested else value


def footer_html() -> str:
    return '''  <footer class="site-footer">
    <div class="container">
      <p class="small">© André Baumann / DiAndré.</p>
      <p class="small">
        <a class="text-link" href="mailto:andre.c.baumann@gmail.com">Email</a>
        <a class="text-link" href="https://www.instagram.com/diandre.42/" target="_blank" rel="noopener">Instagram</a>
        <a class="text-link" href="https://qiquantum.wordpress.com/" target="_blank" rel="noopener">WordPress archive</a>
      </p>
    </div>
  </footer>
'''


def room_tile_html(collection: dict, items: list[dict], curation: dict) -> str:
    feature = choose_feature(items, collection, curation)
    return f'''      <a class="room-tile" href="{collection["slug"]}/">
        <div class="room-tile-media">
          <img src="{esc(image_path(feature, thumb=True))}" alt="{esc((feature or {}).get("alt") or (feature or {}).get("title") or collection["name"])}" loading="lazy">
        </div>
        <div class="room-tile-copy">
          <p class="micro">{esc(collection["kicker"])}</p>
          <h2>{esc(collection["name"])}</h2>
          <p>{esc(collection["description"])}</p>
          <small>{len(items)} works</small>
        </div>
      </a>'''


def home_page_html(grouped: dict[str, list[dict]], curation: dict) -> str:
    hero = choose_home_hero(grouped, curation)
    tiles = "\n".join(room_tile_html(collection, grouped.get(collection["name"], []), curation) for collection in COLLECTIONS)

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
    <section class="artist-intro">
      <div class="intro-copy">
        <p class="micro">Painter · visual artist · systems thinker</p>
        <h1>DiAndré</h1>
        <p>I make oil paintings, watercolours, drawings and spatial images. The work moves between portraits, interiors, flowers, city walls, maps and the atmosphere of places.</p>
        <p>The environmental and systems background is present, but the work begins with looking, colour, memory and material presence.</p>
      </div>
      <figure class="intro-image">
        <img src="{esc(image_path(hero))}" alt="{esc((hero or {}).get("alt") or (hero or {}).get("title") or "Featured artwork")}">
      </figure>
    </section>

    <section class="room-index" aria-labelledby="rooms-title">
      <div class="gallery-heading">
        <p class="micro">Collections</p>
        <h2 id="rooms-title">Five rooms.</h2>
        <p>Each room opens with a selected work, then continues into the wider archive.</p>
      </div>
      <div class="room-grid">
{tiles}
      </div>
    </section>

    <section class="about-strip" aria-labelledby="about-title">
      <p class="micro">About</p>
      <h2 id="about-title">A painter with a systems eye.</h2>
      <p>DiAndré is the visual art practice of André Baumann: painter, independent environmental researcher and systems thinker. The work is environmentally inclined, but not reduced to messaging. It is about seeing, presence, pressure, memory and place.</p>
    </section>
  </main>

{footer_html()}
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def work_card_html(item: dict, nested: bool = True) -> str:
    title = item.get("title") or "Untitled"
    meta = " · ".join(part for part in [item.get("medium"), item.get("subgroup")] if part)
    return f'''        <a class="work-card" href="{esc(image_path(item, nested=nested))}"
          data-title="{esc(title)}"
          data-meta="{esc(meta)}"
          data-text="{esc(item.get("text"))}"
          data-reading="{esc(item.get("reading"))}"
          data-source="{esc(item.get("sourceUrl"))}">
          <img src="{esc(image_path(item, nested=nested, thumb=True))}" alt="{esc(item.get("alt") or title)}" loading="lazy">
          <span class="work-title">{esc(title)}</span>
          <span class="work-meta">{esc(meta)}</span>
        </a>'''


def collection_page_html(collection: dict, items: list[dict], curation: dict) -> str:
    feature = choose_feature(items, collection, curation)
    archive_items = ordered_archive(items, collection, feature)

    title = (feature or {}).get("title") or collection["name"]
    meta = " · ".join(part for part in [(feature or {}).get("medium"), (feature or {}).get("subgroup")] if part)
    wall = "\n".join(work_card_html(item, nested=True) for item in archive_items)

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
<body class="art-body">
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

    <section class="collection-intro">
      <p class="micro">{esc(collection["kicker"])}</p>
      <h1>{esc(collection["name"])}</h1>
      <p>{esc(collection["description"])}</p>
      <small>{len(items)} works</small>
    </section>

    <section class="lead-work">
      <a href="{esc(image_path(feature, nested=True))}" class="lead-link"
        data-title="{esc(title)}"
        data-meta="{esc(meta)}"
        data-text="{esc((feature or {}).get("text"))}"
        data-reading="{esc((feature or {}).get("reading"))}"
        data-source="{esc((feature or {}).get("sourceUrl"))}">
        <img src="{esc(image_path(feature, nested=True))}" alt="{esc((feature or {}).get("alt") or title)}">
      </a>
      <p><strong>{esc(title)}</strong>{(" <span>" + esc(meta) + "</span>") if meta else ""}</p>
    </section>

    <section class="archive-wall" aria-label="{esc(collection["name"])} archive">
{wall}
    </section>
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

{footer_html()}
  <script src="../assets/art-gallery.js" defer></script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def main() -> None:
    artworks = load_artworks()
    curation = load_curation()
    grouped = group_by_collection(artworks)

    (ART / "index.html").write_text(home_page_html(grouped, curation), encoding="utf-8")

    print("Built configurable art gallery.")
    for collection in COLLECTIONS:
        items = grouped.get(collection["name"], [])
        feature = choose_feature(items, collection, curation)
        print(f"{collection['name']}: {len(items)} works | feature: {(feature or {}).get('title', 'None')}")

        out_dir = ART / collection["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(collection_page_html(collection, items, curation), encoding="utf-8")


if __name__ == "__main__":
    main()
