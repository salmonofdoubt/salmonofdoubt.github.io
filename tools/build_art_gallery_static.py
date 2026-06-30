from __future__ import annotations

import html
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
DATA = ART / "data" / "artworks.json"

def ensure_pillow():
    try:
        from PIL import Image, ImageOps  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])

ensure_pillow()
from PIL import Image, ImageOps  # noqa: E402

COLLECTIONS = [
    {
        "name": "Oil Paintings",
        "slug": "oil-paintings",
        "kicker": "Oil on canvas and board",
        "description": "Portraits, interiors, flowers, walls, urban heat and other oil works.",
        "terms": ["manual-nasturtium", "ferrara", "mura", "red hot metropolis", "portrait"],
        "preferred_feature_keywords": [
            "burnt sienna", "sienna", "interior", "window", "curtain", "door", "doorway", "room"
        ],
        "feature_mode": "warm_sienna",
    },
    {
        "name": "Watercolours",
        "slug": "watercolours",
        "kicker": "Watercolour and paper",
        "description": "Colour studies, portraits where identifiable, systems images and paper works.",
        "terms": ["decision", "tipping", "watercolour", "portrait", "framed"],
        "preferred_feature_keywords": [],
        "feature_mode": "default",
    },
    {
        "name": "Drawings",
        "slug": "drawings",
        "kicker": "Drawing and observation",
        "description": "Portraits, coastal studies, botanical works and other drawings.",
        "terms": ["portrait", "portmarnock", "botanical", "orto", "coast"],
        "preferred_feature_keywords": [],
        "feature_mode": "default",
    },
    {
        "name": "Experimental",
        "slug": "experimental",
        "kicker": "Studio research",
        "description": "Colour tests, digital processes, material accidents and unresolved visual research.",
        "terms": ["experimental", "colour", "abstract", "studio"],
        "preferred_feature_keywords": ["cloud", "sky", "blue cloud", "cumulus"],
        "feature_mode": "blue_cloud",
    },
    {
        "name": "GeoSpatial Imagery",
        "slug": "geospatial-imagery",
        "kicker": "Maps and spatial images",
        "description": "Geospatial imagery, field layouts and visual systems work.",
        "terms": ["geospatial", "field", "map", "site", "agevaluate"],
        "preferred_feature_keywords": [],
        "feature_mode": "default",
    },
]

HOME_HERO = "../images/001-2.jpg"


def esc(value):
    return html.escape(str(value or ""), quote=True)


def load_artworks():
    if not DATA.exists():
        return []
    data = json.loads(DATA.read_text())
    return data.get("artworks", [])


def by_collection(artworks):
    grouped = {item["name"]: [] for item in COLLECTIONS}
    for item in artworks:
        name = item.get("collection")
        if name in grouped:
            grouped[name].append(item)
    return grouped


def blob_for(item):
    return " ".join(
        str(item.get(key, ""))
        for key in ["id", "title", "subgroup", "image", "thumb", "text", "reading", "sourceUrl"]
    ).lower()


def base_score(item, terms):
    blob = blob_for(item)
    value = 0
    title = str(item.get("title", "")).lower()

    if "work " not in title:
        value += 20

    for term in terms:
        if term in blob:
            value += 22

    priority = {
        "manual-nasturtium": 80,
        "ferrara": 65,
        "mura": 55,
        "red hot metropolis": 50,
        "portrait": 34,
        "portmarnock": 30,
        "decision": 30,
        "tipping": 30,
        "geospatial": 30,
        "field map": 30,
    }

    for term, points in priority.items():
        if term in blob:
            value += points

    return value


def local_image_path(raw):
    if not raw or raw.startswith("http://") or raw.startswith("https://") or raw.startswith("/"):
        return None

    candidates = [
        ART / raw,
        ROOT / raw,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def image_stats(item):
    raw = item.get("thumb") or item.get("image")
    path = local_image_path(raw)
    if not path:
        return None

    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((140, 140))
            pixels = list(img.getdata())
    except Exception:
        return None

    total = max(len(pixels), 1)
    warm = 0
    blue = 0
    white = 0
    dark = 0

    for r, g, b in pixels:
        if r > 80 and g > 40 and b < 140 and r > g * 1.04 and g > b * 1.03:
            warm += 1
        if b > 120 and b > r * 1.10 and b > g * 1.05:
            blue += 1
        if r > 185 and g > 185 and b > 185:
            white += 1
        if r < 60 and g < 60 and b < 60:
            dark += 1

    return {
        "warm_share": warm / total,
        "blue_share": blue / total,
        "white_share": white / total,
        "dark_share": dark / total,
    }


def visual_feature_score(item, mode):
    stats = image_stats(item)
    if not stats:
        return 0

    if mode == "warm_sienna":
        return int(
            1000 * (
                1.7 * stats["warm_share"]
                + 0.25 * stats["dark_share"]
                - 0.2 * stats["blue_share"]
            )
        )

    if mode == "blue_cloud":
        return int(
            1000 * (
                1.8 * stats["blue_share"]
                + 1.0 * stats["white_share"]
                - 0.2 * stats["dark_share"]
            )
        )

    return 0


def feature_score(item, collection):
    score = base_score(item, collection["terms"])
    blob = blob_for(item)

    for keyword in collection.get("preferred_feature_keywords", []):
        if keyword and keyword in blob:
            score += 250

    score += visual_feature_score(item, collection.get("feature_mode", "default"))
    return score


def ordered(items, collection):
    return sorted(items, key=lambda item: feature_score(item, collection), reverse=True)


def image_src(item, nested=False, fallback=HOME_HERO):
    if item:
        value = item.get("image") or item.get("thumb") or fallback
    else:
        value = fallback

    if value.startswith("http://") or value.startswith("https://") or value.startswith("/"):
        return value

    return ("../" + value) if nested else value


def thumb_src(item, nested=False, fallback=HOME_HERO):
    if item:
        value = item.get("thumb") or item.get("image") or fallback
    else:
        value = fallback

    if value.startswith("http://") or value.startswith("https://") or value.startswith("/"):
        return value

    return ("../" + value) if nested else value


def artist_footer():
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


def home_tile(collection, items):
    lead = ordered(items, collection)[0] if items else None

    return f'''      <a class="room-tile" href="{collection["slug"]}/">
        <img src="{esc(thumb_src(lead))}" alt="{esc((lead or {}).get("alt") or collection["name"])}" loading="lazy">
        <span>{esc(collection["kicker"])}</span>
        <h2>{esc(collection["name"])}</h2>
        <p>{esc(collection["description"])}</p>
        <small>{len(items)} works</small>
      </a>'''


def home_page(grouped):
    tiles = "\n".join(
        home_tile(collection, grouped.get(collection["name"], []))
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
        <img src="{HOME_HERO}" alt="Large floral oil painting with orange, red and yellow flowers on a green ground">
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

{artist_footer()}
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def work_card(item, nested=True):
    image = image_src(item, nested=nested)
    thumb = thumb_src(item, nested=nested)
    title = item.get("title") or "Untitled"
    meta = " · ".join(part for part in [item.get("medium"), item.get("subgroup")] if part)

    return f'''        <a class="work-card" href="{esc(image)}"
          data-title="{esc(title)}"
          data-meta="{esc(meta)}"
          data-text="{esc(item.get("text"))}"
          data-reading="{esc(item.get("reading"))}"
          data-source="{esc(item.get("sourceUrl"))}">
          <img src="{esc(thumb)}" alt="{esc(item.get("alt") or title)}" loading="lazy">
          <span class="work-title">{esc(title)}</span>
          <span class="work-meta">{esc(meta)}</span>
        </a>'''


def collection_page(collection, items):
    arranged = ordered(items, collection)
    lead = arranged[0] if arranged else None
    rest = arranged[1:] if arranged else []

    wall = "\n".join(work_card(item, nested=True) for item in rest)

    lead_image = image_src(lead, nested=True)
    lead_title = (lead or {}).get("title") or collection["name"]
    lead_meta = " · ".join(
        part for part in [(lead or {}).get("medium"), (lead or {}).get("subgroup")] if part
    )

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
      <a href="{esc(lead_image)}" class="lead-link"
        data-title="{esc(lead_title)}"
        data-meta="{esc(lead_meta)}"
        data-text="{esc((lead or {}).get("text"))}"
        data-reading="{esc((lead or {}).get("reading"))}"
        data-source="{esc((lead or {}).get("sourceUrl"))}">
        <img src="{esc(lead_image)}" alt="{esc((lead or {}).get("alt") or lead_title)}">
      </a>
      <p><strong>{esc(lead_title)}</strong> <span>{esc(lead_meta)}</span></p>
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

{artist_footer()}
  <script src="../assets/art-gallery.js" defer></script>
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "ba3bb7ae04424113b5e7cebe70bd86d4"}}'></script>
</body>
</html>
'''


def main():
    artworks = load_artworks()
    grouped = by_collection(artworks)

    (ART / "index.html").write_text(home_page(grouped), encoding="utf-8")

    print("Built static gallery.")
    for collection in COLLECTIONS:
        items = grouped.get(collection["name"], [])
        ordered_items = ordered(items, collection)
        lead = ordered_items[0] if ordered_items else None
        lead_label = (lead or {}).get("title") or "None"
        print(f"{collection['name']}: {len(items)} works | feature: {lead_label}")

        out = ART / collection["slug"]
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(
            collection_page(collection, items),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
