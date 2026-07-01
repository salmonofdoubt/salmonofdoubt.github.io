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

    def as_int(value, default=999999):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    visible = [
        record for record in records
        if str(record.get("status", "active")).lower() not in {"hidden", "deleted", "draft"}
    ]

    return sorted(
        visible,
        key=lambda record: (
            as_int(record.get("collectionOrder"), 999),
            str(record.get("collection", "")),
            as_int(record.get("sortOrder"), 999999),
            str(record.get("title", "")).lower(),
        ),
    )

def load_curation() -> dict:
    return read_json(CURATION, {"homepageHero": {}, "collections": {}})


def ordered_archive_items(items: list[dict], feature: dict | None = None) -> list[dict]:
    feature = feature or {}
    feature_id = feature.get("id")
    feature_image = feature.get("image")

    def as_int(value, default=999999):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    archive = []
    for item in items:
        if feature_id and item.get("id") == feature_id:
            continue
        if feature_image and item.get("image") == feature_image:
            continue
        archive.append(item)

    return sorted(
        archive,
        key=lambda item: (
            as_int(item.get("sortOrder"), 999999),
            str(item.get("title", "")).lower(),
        ),
    )


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
    def as_int(value, default=999999):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    return sorted(
        items,
        key=lambda item: (
            as_int(item.get("sortOrder"), 999999),
            str(item.get("title", "")).lower(),
        ),
    )

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

  <!-- Cloudflare Web Analytics -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
  <!-- End Cloudflare Web Analytics -->
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

  <!-- Cloudflare Web Analytics -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
  <!-- End Cloudflare Web Analytics -->
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

# ART_ARCHIVE_ROW_ORDER_POSTPROCESS_START
def force_public_archive_row_order() -> None:
    """Force generated public collection archive walls to match manager row-wise order."""
    from pathlib import Path
    import re

    pages = [
        Path("art/oil-paintings/index.html"),
        Path("art/watercolours/index.html"),
        Path("art/drawings/index.html"),
        Path("art/experimental/index.html"),
        Path("art/geospatial-imagery/index.html"),
    ]

    forced_style = (
        "display:grid !important;"
        "grid-template-columns:repeat(auto-fill,minmax(170px,1fr)) !important;"
        "gap:.75rem !important;"
        "align-items:start !important;"
        "columns:unset !important;"
        "column-count:initial !important;"
        "column-width:auto !important;"
        "column-gap:normal !important;"
    )

    forced_script = """
<script>
(function () {
  function forceArchiveWallRowOrder() {
    document.querySelectorAll('.archive-wall').forEach(function (wall) {
      wall.style.setProperty('display', 'grid', 'important');
      wall.style.setProperty('grid-template-columns', 'repeat(auto-fill, minmax(170px, 1fr))', 'important');
      wall.style.setProperty('gap', '.75rem', 'important');
      wall.style.setProperty('align-items', 'start', 'important');
      wall.style.setProperty('columns', 'unset', 'important');
      wall.style.setProperty('column-count', 'initial', 'important');
      wall.style.setProperty('column-width', 'auto', 'important');
      wall.style.setProperty('column-gap', 'normal', 'important');

      Array.from(wall.children).forEach(function (card) {
        card.style.setProperty('display', 'block', 'important');
        card.style.setProperty('width', 'auto', 'important');
        card.style.setProperty('max-width', 'none', 'important');
        card.style.setProperty('margin', '0', 'important');
        card.style.setProperty('break-inside', 'auto', 'important');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', forceArchiveWallRowOrder);
  forceArchiveWallRowOrder();
})();
</script>
"""

    for page in pages:
        if not page.exists():
            continue

        html = page.read_text(encoding="utf-8")

        html = re.sub(
            r'<section class="archive-wall([^"]*)"',
            lambda match: (
                '<section class="archive-wall'
                + match.group(1)
                + '" style="'
                + forced_style
                + '"'
            ),
            html,
            count=1,
        )

        html = re.sub(
            r'<script>\s*\(function \(\) \{\s*function forceArchiveWallRowOrder\(\)[\s\S]*?\}\)\(\);\s*</script>',
            '',
            html,
        )

        html = html.replace("</body>", forced_script + "\n</body>")

        page.write_text(html, encoding="utf-8")


force_public_archive_row_order()
# ART_ARCHIVE_ROW_ORDER_POSTPROCESS_END

# ART_DOCUMENTATION_BUILD_HOOK_START
def build_art_documentation_if_available() -> None:
    import subprocess
    import sys
    from pathlib import Path

    script = Path(__file__).with_name("build_art_documentation.py")
    if script.exists():
        subprocess.run([sys.executable, str(script)], check=True)


build_art_documentation_if_available()
# ART_DOCUMENTATION_BUILD_HOOK_END


def patch_art_homepage_share_qr():
    from pathlib import Path
    import re

    root = Path(__file__).resolve().parents[1]
    path = root / "art" / "index.html"
    if not path.exists():
        return

    html = path.read_text(encoding="utf-8")

    html = re.sub(
        r"\n?\s*<!-- ART_SHARE_QR_START -->[\s\S]*?<!-- ART_SHARE_QR_END -->\s*",
        "\n",
        html,
    )

    css = """
  <!-- ART_SHARE_QR_START -->
  <style>
    .portfolio-share-card {
      margin: 2rem 0;
      border: 1px solid rgba(212, 174, 108, .28);
      background:
        radial-gradient(circle at top right, rgba(212, 174, 108, .10), transparent 18rem),
        #100d0a;
      padding: 1rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
    }

    .portfolio-share-card strong {
      display: block;
      color: #fff2d7;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.35rem;
      line-height: 1;
      letter-spacing: -.035em;
    }

    .portfolio-share-card p {
      margin: .35rem 0 0;
      color: #ad9a7b;
      max-width: 46rem;
    }

    .portfolio-share-card a {
      color: #d4ae6c;
      font-weight: 900;
      text-decoration: none;
    }

    .portfolio-share-qr {
      width: 112px;
      display: grid;
      gap: .35rem;
      justify-items: center;
      color: #ad9a7b;
      font-size: .68rem;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .portfolio-share-qr img {
      width: 112px;
      height: 112px;
      display: block;
      border: 1px solid rgba(212, 174, 108, .34);
      background: #fff2d7;
      padding: .3rem;
    }

    @media (max-width: 720px) {
      .portfolio-share-card {
        grid-template-columns: 1fr;
      }

      .portfolio-share-qr {
        justify-self: start;
        width: 96px;
      }

      .portfolio-share-qr img {
        width: 96px;
        height: 96px;
      }
    }
  </style>
  <!-- ART_SHARE_QR_END -->"""

    block = """
  <!-- ART_SHARE_QR_START -->
  <section class="portfolio-share-card" aria-label="Share this portfolio">
    <div>
      <strong>Share this portfolio</strong>
      <p>
        Quick access for exhibitions, studio visits and conversations:
        <a href="https://salmonofdoubt.github.io/art/">salmonofdoubt.github.io/art/</a>
      </p>
    </div>
    <a class="portfolio-share-qr" href="https://salmonofdoubt.github.io/art/" aria-label="Open DiAndré art portfolio">
      <img src="assets/diandre-art-qr.png" alt="QR code linking to the DiAndré art portfolio">
      <span>Scan</span>
    </a>
  </section>
  <!-- ART_SHARE_QR_END -->"""

    if "</head>" in html:
        html = html.replace("</head>", css + "\n</head>", 1)

    if "</main>" in html:
        html = html.replace("</main>", block + "\n</main>", 1)
    elif "</body>" in html:
        html = html.replace("</body>", block + "\n</body>", 1)

    path.write_text(html, encoding="utf-8")
    print("Patched art/index.html with share QR card.")


if __name__ == "__main__":
    patch_art_homepage_share_qr()


def patch_art_homepage_hero_qr():
    from pathlib import Path
    import re

    root = Path(__file__).resolve().parents[1]
    path = root / "art" / "index.html"
    if not path.exists():
        return

    html = path.read_text(encoding="utf-8")

    # Remove old lower-page QR card/style if present.
    html = re.sub(
        r"\n?\s*<!-- ART_SHARE_QR_START -->[\s\S]*?<!-- ART_SHARE_QR_END -->\s*",
        "\n",
        html,
    )

    # Remove any previous hero QR patch before reinserting.
    html = re.sub(
        r"\n?\s*<!-- ART_HERO_QR_START -->[\s\S]*?<!-- ART_HERO_QR_END -->\s*",
        "\n",
        html,
    )

    css = """
  <!-- ART_HERO_QR_START -->
  <style>
    .hero-share-qr {
      margin-top: 1rem;
      display: inline-grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: .75rem;
      align-items: center;
      max-width: 26rem;
      padding: .65rem;
      border: 1px solid rgba(212, 174, 108, .28);
      background: rgba(16, 13, 10, .78);
    }

    .hero-share-qr img {
      width: 82px;
      height: 82px;
      display: block;
      background: #fff2d7;
      padding: .25rem;
      border: 1px solid rgba(212, 174, 108, .34);
    }

    .hero-share-qr strong {
      display: block;
      color: #fff2d7;
      font-size: .78rem;
      font-weight: 950;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .hero-share-qr span {
      display: block;
      margin-top: .2rem;
      color: #ad9a7b;
      font-size: .78rem;
      line-height: 1.35;
    }

    @media (max-width: 640px) {
      .hero-share-qr {
        grid-template-columns: 72px minmax(0, 1fr);
      }

      .hero-share-qr img {
        width: 72px;
        height: 72px;
      }
    }
  </style>
  <!-- ART_HERO_QR_END -->"""

    block = """
        <!-- ART_HERO_QR_START -->
        <a class="hero-share-qr" href="https://salmonofdoubt.github.io/art/" aria-label="Share DiAndré art portfolio">
          <img src="assets/diandre-art-qr.png" alt="QR code linking to the DiAndré art portfolio">
          <span>
            <strong>Share portfolio</strong>
            <span>Scan for quick access to the DiAndré art rooms.</span>
          </span>
        </a>
        <!-- ART_HERO_QR_END -->"""

    if "</head>" in html:
        html = html.replace("</head>", css + "\n</head>", 1)

    # Put it immediately after the final hero intro paragraph if possible.
    target = "The environmental and systems background is present, but the work begins with looking, colour, memory and material presence.</p>"
    if target in html:
        html = html.replace(target, target + block, 1)
    else:
        # Fallback: insert before the collections section.
        html = html.replace("<section", block + "\n<section", 1)

    path.write_text(html, encoding="utf-8")
    print("Patched hero QR into art/index.html.")


if __name__ == "__main__":
    patch_art_homepage_hero_qr()


def patch_art_pwa_metadata():
    from pathlib import Path
    import re

    root = Path(__file__).resolve().parents[1]

    pages = [
        root / "art" / "index.html",
        root / "art" / "oil-paintings" / "index.html",
        root / "art" / "watercolours" / "index.html",
        root / "art" / "drawings" / "index.html",
        root / "art" / "experimental" / "index.html",
        root / "art" / "geospatial-imagery" / "index.html",
        root / "art" / "documentation" / "index.html",
        root / "art" / "manage" / "index.html",
    ]

    head_block = """
  <!-- ART_PWA_START -->
  <link rel="manifest" href="/art/manifest.webmanifest">
  <meta name="theme-color" content="#050403">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="DiAndré">
  <link rel="apple-touch-icon" href="/art/assets/diandre-app-icon-192.png">
  <!-- ART_PWA_END -->"""

    script_block = """
  <!-- ART_PWA_START -->
  <button class="art-install-app" type="button" hidden>Install app</button>
  <style>
    .art-install-app {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 50;
      min-height: 38px;
      border: 1px solid rgba(212, 174, 108, .62);
      border-radius: 999px;
      padding: .35rem .9rem;
      background: #24190f;
      color: #fff2d7;
      box-shadow: 0 14px 40px rgba(0,0,0,.32);
      font: 900 .82rem/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
    }

    @media (max-width: 640px) {
      .art-install-app {
        right: .75rem;
        bottom: .75rem;
      }
    }
  </style>
  <script>
    (function () {
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/art/sw.js").catch(function () {});
        });
      }

      var installPrompt = null;
      var button = document.querySelector(".art-install-app");

      window.addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        installPrompt = event;
        if (button) button.hidden = false;
      });

      if (button) {
        button.addEventListener("click", function () {
          if (!installPrompt) return;
          installPrompt.prompt();
          installPrompt.userChoice.finally(function () {
            installPrompt = null;
            button.hidden = true;
          });
        });
      }

      window.addEventListener("appinstalled", function () {
        if (button) button.hidden = true;
        installPrompt = null;
      });
    }());
  </script>
  <!-- ART_PWA_END -->"""

    for path in pages:
        if not path.exists():
            continue

        html = path.read_text(encoding="utf-8")

        html = re.sub(
            r"\n?\s*<!-- ART_PWA_START -->[\s\S]*?<!-- ART_PWA_END -->\s*",
            "\n",
            html,
        )

        if "</head>" in html:
            html = html.replace("</head>", head_block + "\n</head>", 1)

        if "</body>" in html:
            html = html.replace("</body>", script_block + "\n</body>", 1)

        path.write_text(html, encoding="utf-8")

    print("Patched art pages with PWA metadata and service worker registration.")


if __name__ == "__main__":
    patch_art_pwa_metadata()


def patch_art_homepage_hero_qr_native_share():
    from pathlib import Path
    import re

    root = Path(__file__).resolve().parents[1]
    path = root / "art" / "index.html"
    if not path.exists():
        return

    html = path.read_text(encoding="utf-8")

    html = re.sub(
        r"\n?\s*<!-- ART_SHARE_QR_START -->[\s\S]*?<!-- ART_SHARE_QR_END -->\s*",
        "\n",
        html,
    )

    html = re.sub(
        r"\n?\s*<!-- ART_HERO_QR_START -->[\s\S]*?<!-- ART_HERO_QR_END -->\s*",
        "\n",
        html,
    )

    css = """
  <!-- ART_HERO_QR_START -->
  <style>
    .hero-share-qr {
      margin-top: 1rem;
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr);
      gap: .75rem;
      align-items: center;
      max-width: 28rem;
      padding: .65rem;
      border: 1px solid rgba(212, 174, 108, .28);
      background: rgba(16, 13, 10, .78);
    }

    .hero-share-qr img {
      width: 82px;
      height: 82px;
      display: block;
      background: #fff2d7;
      padding: .25rem;
      border: 1px solid rgba(212, 174, 108, .34);
    }

    .hero-share-copy {
      min-width: 0;
      display: grid;
      gap: .45rem;
      align-content: center;
    }

    .hero-share-copy strong {
      display: block;
      color: #fff2d7;
      font-size: .78rem;
      font-weight: 950;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .hero-share-copy span {
      display: block;
      color: #ad9a7b;
      font-size: .78rem;
      line-height: 1.35;
    }

    .hero-share-actions {
      display: flex;
      flex-wrap: wrap;
      gap: .45rem;
      align-items: center;
      margin-top: .1rem;
    }

    .hero-share-actions a,
    .hero-share-actions button {
      appearance: none;
      border: 1px solid rgba(212, 174, 108, .55);
      border-radius: 999px;
      background: #24190f;
      color: #fff2d7;
      min-height: 30px;
      padding: .25rem .7rem;
      font: 900 .72rem/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: .04em;
      text-decoration: none;
      cursor: pointer;
    }

    .hero-share-actions a {
      color: #d4ae6c;
      background: transparent;
    }

    .hero-share-status {
      color: #ad9a7b;
      font-size: .72rem;
      min-height: 1em;
    }

    @media (max-width: 640px) {
      .hero-share-qr {
        grid-template-columns: 72px minmax(0, 1fr);
      }

      .hero-share-qr img {
        width: 72px;
        height: 72px;
      }
    }
  </style>
  <!-- ART_HERO_QR_END -->"""

    block = """
        <!-- ART_HERO_QR_START -->
        <section class="hero-share-qr" aria-label="Share DiAndré art portfolio">
          <a href="https://salmonofdoubt.github.io/art/" aria-label="Open DiAndré art portfolio">
            <img src="assets/diandre-art-qr.png" alt="QR code linking to the DiAndré art portfolio">
          </a>
          <div class="hero-share-copy">
            <strong>Share portfolio</strong>
            <span>Scan, copy, or use your device share sheet.</span>
            <div class="hero-share-actions">
              <button type="button" data-art-share>Share</button>
              <a href="https://salmonofdoubt.github.io/art/">Open</a>
            </div>
            <span class="hero-share-status" aria-live="polite"></span>
          </div>
        </section>
        <!-- ART_HERO_QR_END -->"""

    script = """
  <!-- ART_HERO_QR_START -->
  <script>
    (function () {
      var url = "https://salmonofdoubt.github.io/art/";
      var title = "DiAndré Art";
      var text = "DiAndré art portfolio, collections and documentation archive.";
      var button = document.querySelector("[data-art-share]");
      var status = document.querySelector(".hero-share-status");

      function setStatus(message) {
        if (status) status.textContent = message || "";
      }

      async function copyFallback() {
        try {
          await navigator.clipboard.writeText(url);
          setStatus("Link copied.");
        } catch (error) {
          window.location.href = "mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(text + "\\n\\n" + url);
        }
      }

      if (!button) return;

      button.addEventListener("click", async function () {
        if (navigator.share) {
          try {
            await navigator.share({ title: title, text: text, url: url });
            setStatus("");
            return;
          } catch (error) {
            if (error && error.name === "AbortError") return;
          }
        }

        copyFallback();
      });
    }());
  </script>
  <!-- ART_HERO_QR_END -->"""

    if "</head>" in html:
        html = html.replace("</head>", css + "\n</head>", 1)

    target = "The environmental and systems background is present, but the work begins with looking, colour, memory and material presence.</p>"
    if target in html:
        html = html.replace(target, target + block, 1)
    else:
        html = html.replace("<section", block + "\n<section", 1)

    if "</body>" in html:
        html = html.replace("</body>", script + "\n</body>", 1)

    path.write_text(html, encoding="utf-8")
    print("Patched art homepage QR card with native share button.")


if __name__ == "__main__":
    patch_art_homepage_hero_qr_native_share()
