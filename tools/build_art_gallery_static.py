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
        "pinned_selectors": [
            {"all": ["window", "curtain"]},
            {"all": ["door", "curtain"]},
            {"any": ["burnt sienna", "sienna", "interior", "doorway", "window", "curtain", "room"]},
        ],
        "score_terms": ["interior", "window", "curtain", "door", "room", "ferrara", "mura", "portrait"],
    },
    {
        "name": "Watercolours",
        "slug": "watercolours",
        "kicker": "Watercolour and paper",
        "description": "Colour studies, portraits where identifiable, systems images and paper works.",
        "pinned_selectors": [],
        "score_terms": ["watercolour", "portrait", "colour", "study"],
    },
    {
        "name": "Drawings",
        "slug": "drawings",
        "kicker": "Drawing and observation",
        "description": "Portraits, coastal studies, botanical works and other drawings.",
        "pinned_selectors": [],
        "score_terms": ["drawing", "portrait", "coast", "botanical", "observation"],
    },
    {
        "name": "Experimental",
        "slug": "experimental",
        "kicker": "Studio research",
        "description": "Colour tests, digital processes, material accidents and unresolved visual research.",
        "pinned_selectors": [
            {"all": ["cloud", "blue"]},
            {"any": ["blue cloud", "cloud", "sky", "cumulus"]},
        ],
        "score_terms": ["cloud", "blue", "sky", "experimental", "colour", "abstract"],
    },
    {
        "name": "GeoSpatial Imagery",
        "slug": "geospatial-imagery",
        "kicker": "Maps and spatial images",
        "description": "Geospatial imagery, field layouts and visual systems work.",
        "pinned_selectors": [],
        "score_terms": ["geospatial", "map", "field", "site", "spatial"],
    },
]

HERO_FALLBACK = "../images/001-2.jpg"


CURATED_FEATURES = {
    "Oil Paintings": {
        "id": "curated-oil-burnt-sienna-interior",
        "collection": "Oil Paintings",
        "collectionOrder": 1,
        "subgroup": "Interiors and places",
        "title": "Burnt sienna interior",
        "medium": "Oil painting",
        "image": "https://qiquantum.wordpress.com/wp-content/uploads/2022/10/20260628_1839553.jpg",
        "thumb": "https://qiquantum.wordpress.com/wp-content/uploads/2022/10/20260628_1839553.jpg",
        "source": "WordPress archive",
        "sourceUrl": "https://qiquantum.wordpress.com/wp-content/uploads/2022/10/20260628_1839553.jpg",
        "alt": "Burnt sienna oil painting of an interior with doorway, curtain, bed and warm light",
        "text": "A burnt-sienna interior: doorway, curtain, bed, wall and warm light held as a quiet domestic threshold.",
        "reading": "This is the oil painting anchor because it presents atmosphere, interiority, memory and painterly restraint more strongly than a decorative colour signature.",
        "order": -100
    }
}



def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def load_artworks() -> list[dict]:
    if not DATA.exists():
        return []
    data = json.loads(DATA.read_text(encoding="utf-8"))
    return data.get("artworks", [])


def group_by_collection(artworks: list[dict]) -> dict[str, list[dict]]:
    grouped = {item["name"]: [] for item in COLLECTIONS}
    for artwork in artworks:
        collection = artwork.get("collection")
        if collection in grouped:
            grouped[collection].append(artwork)
    return grouped


def text_blob(item: dict) -> str:
    fields = [
        item.get("id"),
        item.get("title"),
        item.get("medium"),
        item.get("subgroup"),
        item.get("text"),
        item.get("reading"),
        item.get("image"),
        item.get("thumb"),
        item.get("sourceUrl"),
    ]
    return " ".join(str(field or "") for field in fields).lower()


def score_item(item: dict, score_terms: list[str]) -> int:
    blob = text_blob(item)
    title = str(item.get("title", "")).lower()
    score = 0

    if title and "work " not in title:
        score += 16

    for term in score_terms:
        if term in blob:
            score += 18

    bonus_terms = {
        "portrait": 18,
        "ferrara": 24,
        "mura": 20,
        "interior": 20,
        "window": 18,
        "curtain": 18,
        "cloud": 24,
        "blue": 14,
        "geospatial": 20,
        "map": 14,
    }

    for term, points in bonus_terms.items():
        if term in blob:
            score += points

    return score


def matches_selector(item: dict, selector: dict) -> bool:
    blob = text_blob(item)
    all_terms = selector.get("all", [])
    any_terms = selector.get("any", [])
    exclude_terms = selector.get("exclude", [])

    if any(term in blob for term in exclude_terms):
        return False
    if all_terms and not all(term in blob for term in all_terms):
        return False
    if any_terms and not any(term in blob for term in any_terms):
        return False
    return True


def choose_feature(items: list[dict], collection: dict) -> dict | None:
    curated = CURATED_FEATURES.get(collection["name"])
    if curated:
        return curated

    if not items:
        return None

    for selector in collection.get("pinned_selectors", []):
        matches = [item for item in items if matches_selector(item, selector)]
        if matches:
            return max(matches, key=lambda item: score_item(item, collection["score_terms"]))

    return max(items, key=lambda item: score_item(item, collection["score_terms"]))

def ordered_archive(items: list[dict], collection: dict, chosen_feature: dict | None) -> list[dict]:
    ordered = sorted(items, key=lambda item: score_item(item, collection["score_terms"]), reverse=True)

    if chosen_feature is None:
        return ordered

    feature_id = chosen_feature.get("id")
    feature_image = chosen_feature.get("image")
    feature_source = chosen_feature.get("sourceUrl")

    return [
        item for item in ordered
        if item.get("id") != feature_id
        and item.get("image") != feature_image
        and item.get("thumb") != feature_image
        and item.get("sourceUrl") != feature_source
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


def room_tile_html(collection: dict, items: list[dict]) -> str:
    feature = choose_feature(items, collection)
    return f'''      <a class="room-tile" href="{collection["slug"]}/">
        <div class="room-tile-media">
          <img src="{esc(image_path(feature, nested=False, thumb=True))}" alt="{esc((feature or {}).get("alt") or (feature or {}).get("title") or collection["name"])}" loading="lazy">
        </div>
        <div class="room-tile-copy">
          <p class="micro">{esc(collection["kicker"])}</p>
          <h2>{esc(collection["name"])}</h2>
          <p>{esc(collection["description"])}</p>
          <small>{len(items)} works</small>
        </div>
      </a>'''


def home_page_html(grouped: dict[str, list[dict]]) -> str:
    oil_collection = next(item for item in COLLECTIONS if item["name"] == "Oil Paintings")
    oil_feature = choose_feature(grouped.get("Oil Paintings", []), oil_collection)
    hero_image = image_path(oil_feature, nested=False, thumb=False)

    tiles = "\n".join(
        room_tile_html(collection, grouped.get(collection["name"], []))
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
    <section class="artist-intro">
      <div class="intro-copy">
        <p class="micro">Painter · visual artist · systems thinker</p>
        <h1>DiAndré</h1>
        <p>I make oil paintings, watercolours, drawings and spatial images. The work moves between portraits, interiors, flowers, city walls, maps and the atmosphere of places.</p>
        <p>The environmental and systems background is present, but the work begins with looking, colour, memory and material presence.</p>
      </div>
      <figure class="intro-image">
        <img src="{esc(hero_image)}" alt="{esc((oil_feature or {}).get("alt") or (oil_feature or {}).get("title") or "Featured oil painting")}">
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

    return f'''        <a class="work-card" href="{esc(image_path(item, nested=nested, thumb=False))}"
          data-title="{esc(title)}"
          data-meta="{esc(meta)}"
          data-text="{esc(item.get("text"))}"
          data-reading="{esc(item.get("reading"))}"
          data-source="{esc(item.get("sourceUrl"))}">
          <img src="{esc(image_path(item, nested=nested, thumb=True))}" alt="{esc(item.get("alt") or title)}" loading="lazy">
          <span class="work-title">{esc(title)}</span>
          <span class="work-meta">{esc(meta)}</span>
        </a>'''


def collection_page_html(collection: dict, items: list[dict]) -> str:
    feature = choose_feature(items, collection)
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
      <a href="{esc(image_path(feature, nested=True, thumb=False))}" class="lead-link"
        data-title="{esc(title)}"
        data-meta="{esc(meta)}"
        data-text="{esc((feature or {}).get("text"))}"
        data-reading="{esc((feature or {}).get("reading"))}"
        data-source="{esc((feature or {}).get("sourceUrl"))}">
        <img src="{esc(image_path(feature, nested=True, thumb=False))}" alt="{esc((feature or {}).get("alt") or title)}">
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
    grouped = group_by_collection(artworks)

    (ART / "index.html").write_text(home_page_html(grouped), encoding="utf-8")

    print("Built static art gallery.")
    for collection in COLLECTIONS:
        items = grouped.get(collection["name"], [])
        feature = choose_feature(items, collection)
        feature_title = (feature or {}).get("title") or "None"
        print(f"{collection['name']}: {len(items)} works | feature: {feature_title}")

        out_dir = ART / collection["slug"]
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "index.html").write_text(
            collection_page_html(collection, items),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
