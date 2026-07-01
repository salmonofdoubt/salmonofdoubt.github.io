#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "art" / "assets" / "docs"
MANIFEST = DOCS / "documentation.json"
OUT = ROOT / "art" / "documentation" / "index.html"
TOKEN = "ba3bb7ae04424113b5e7cebe70bd86d4"


def esc(value: object) -> str:
    return (
        str(value or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def load_items() -> list[dict]:
    if not MANIFEST.exists():
        raise SystemExit(f"Missing {MANIFEST}. Run tools/make_art_documentation_thumbnails.py first.")
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return data.get("items", [])


def exists_from_href(href: str) -> bool:
    return bool(href) and (OUT.parent / href).resolve().exists()


def card_html(item: dict) -> str:
    pdf = item.get("pdf", "")
    cover = item.get("cover", "")
    group_class = str(item.get("group", "")).lower().replace(" ", "-")
    disabled = "" if exists_from_href(pdf) else " disabled"
    missing = "" if exists_from_href(pdf) else '<p class="missing">PDF missing locally.</p>'

    return f"""
        <article class="doc-card {esc(group_class)}">
          <a class="cover" href="{esc(pdf)}" target="_blank" rel="noopener">
            <img src="{esc(cover)}" alt="{esc(item.get("title", ""))} {esc(item.get("subtitle", ""))} cover" loading="lazy">
          </a>
          <div class="doc-copy">
            <p class="micro">{esc(item.get("kind"))} · {esc(item.get("year"))}</p>
            <h3>{esc(item.get("title"))}<span>{esc(item.get("subtitle"))}</span></h3>
            <p>{esc(item.get("description"))}</p>
            {missing}
            <div class="doc-actions">
              <a class="button{disabled}" href="{esc(pdf)}" target="_blank" rel="noopener">Open PDF</a>
              <a class="button ghost{disabled}" href="{esc(pdf)}" download>Download</a>
            </div>
          </div>
        </article>
    """


def section_html(group: str, items: list[dict]) -> str:
    cards = "\n".join(card_html(item) for item in items if item.get("group") == group)
    extra = " journal-grid" if group == "Art Journals" else ""

    return f"""
    <section class="doc-section" aria-labelledby="{esc(group.lower().replace(" ", "-"))}">
      <div class="section-head">
        <p class="micro">Documentation</p>
        <h2 id="{esc(group.lower().replace(" ", "-"))}">{esc(group)}</h2>
      </div>
      <div class="doc-grid{extra}">
{cards}
      </div>
    </section>
    """


def build_documentation_page() -> None:
    items = load_items()
    sections = "\n".join(section_html(group, items) for group in ["Art Books", "Art Journals"])

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documentation · DiAndré Art</title>
  <meta name="description" content="DiAndré art books, art journals, process documents and visual research archive.">
  <style>
    :root {{
      --bg: #050403;
      --panel: #100d0a;
      --line: rgba(212, 174, 108, 0.28);
      --text: #f1e1c5;
      --muted: #ad9a7b;
      --gold: #d4ae6c;
    }}

    * {{ box-sizing: border-box; }}

    body {{
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(156, 58, 22, .12), transparent 34rem),
        var(--bg);
      color: var(--text);
      font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}

    main {{
      width: min(1320px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 1.8rem 0 4rem;
    }}

    a {{ color: inherit; text-decoration: none; }}

    .back {{
      display: inline-flex;
      margin-bottom: 1.1rem;
      color: var(--gold);
      font-weight: 900;
    }}

    .hero {{
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      padding: 1.5rem 0 1.4rem;
      display: grid;
      grid-template-columns: 1fr;
      gap: .6rem;
    }}

    h1, h2, h3 {{
      font-family: Georgia, "Times New Roman", serif;
      color: #fff2d7;
      letter-spacing: -.045em;
      line-height: .92;
    }}

    h1 {{
      margin: 0;
      font-size: clamp(3.4rem, 10vw, 8.5rem);
      max-width: 100%;
      overflow-wrap: anywhere;
    }}

    h2 {{
      margin: 0;
      font-size: clamp(2.1rem, 5.5vw, 4.5rem);
    }}

    h3 {{
      margin: .25rem 0 .6rem;
      font-size: 1.45rem;
      line-height: 1;
    }}

    h3 span {{
      display: block;
      margin-top: .2rem;
      color: var(--gold);
      font-size: .95em;
    }}

    .intro {{
      margin: 0;
      color: var(--muted);
      max-width: 68rem;
    }}

    .micro {{
      margin: 0 0 .45rem;
      color: var(--gold);
      font-size: .68rem;
      font-weight: 950;
      letter-spacing: .16em;
      text-transform: uppercase;
    }}

    .doc-section {{
      margin-top: 2.4rem;
    }}

    .section-head {{
      margin-bottom: 1rem;
    }}

    .doc-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      align-items: stretch;
    }}

    .journal-grid {{
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }}

    .doc-card {{
      border: 1px solid var(--line);
      background: var(--panel);
      min-width: 0;
      display: grid;
      grid-template-rows: auto 1fr;
    }}

    .cover {{
      display: block;
      aspect-ratio: 4 / 3;
      background: #050403;
      border-bottom: 1px solid rgba(212, 174, 108, .18);
      overflow: hidden;
    }}

    .cover img {{
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      background: #050403;
    }}

    .doc-copy {{
      padding: .9rem;
      display: grid;
      align-content: start;
      min-height: 10.8rem;
    }}

    .doc-copy p {{
      margin: 0 0 .8rem;
      color: var(--muted);
    }}

    .missing {{
      color: #ffb8ae !important;
    }}

    .doc-actions {{
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      margin-top: .2rem;
    }}

    .button {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      border: 1px solid rgba(212, 174, 108, .6);
      border-radius: 999px;
      padding: .28rem .75rem;
      color: #fff2d7;
      font-size: .82rem;
      font-weight: 950;
      background: #24190f;
    }}

    .button.ghost {{
      background: transparent;
      color: var(--gold);
    }}

    .button.disabled {{
      opacity: .4;
      pointer-events: none;
    }}

    @media (max-width: 1020px) {{
      .doc-grid,
      .journal-grid {{
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }}
    }}

    @media (max-width: 640px) {{
      main {{
        width: min(100% - 1rem, 1320px);
        padding-top: 1rem;
      }}

      h1 {{
        font-size: clamp(3rem, 17vw, 5.5rem);
      }}

      .doc-grid,
      .journal-grid {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
<main>
  <a class="back" href="../">← Back to art</a>

  <section class="hero">
    <div>
      <p class="micro">Archive / process / provenance</p>
      <h1>Documentation</h1>
    </div>
    <p class="intro">
      Art books, process journals, slide-derived PDFs and visual research documents.
      The portfolio rooms stay curated; this archive preserves the working record behind them.
    </p>
  </section>

{sections}
</main>

  <!-- Cloudflare Web Analytics -->
  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{{"token": "{TOKEN}"}}'></script>
  <!-- End Cloudflare Web Analytics -->
</body>
</html>
"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Built {OUT.relative_to(ROOT)}")


def patch_art_index() -> None:
    path = ROOT / "art" / "index.html"
    if not path.exists():
        return

    html = path.read_text(encoding="utf-8")

    html = re.sub(
        r"\n?\s*<!-- ART_DOCUMENTATION_LINK_START -->[\s\S]*?<!-- ART_DOCUMENTATION_LINK_END -->\s*",
        "\n",
        html,
    )

    css = """
  <!-- ART_DOCUMENTATION_LINK_START -->
  <style>
    .documentation-callout {
      margin: 2rem 0;
      border: 1px solid rgba(212, 174, 108, .28);
      background: #100d0a;
      padding: 1rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
    }
    .documentation-callout p { margin: .25rem 0 0; color: #ad9a7b; }
    .documentation-callout strong {
      display: block;
      color: #fff2d7;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.45rem;
      line-height: 1;
    }
    .documentation-callout a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid rgba(212, 174, 108, .55);
      border-radius: 999px;
      padding: .3rem .85rem;
      color: #fff2d7;
      background: #24190f;
      font-size: .82rem;
      font-weight: 900;
      text-decoration: none;
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .documentation-callout { grid-template-columns: 1fr; }
    }
  </style>
  <!-- ART_DOCUMENTATION_LINK_END -->"""

    block = """
  <!-- ART_DOCUMENTATION_LINK_START -->
  <section class="documentation-callout" aria-label="Documentation archive">
    <div>
      <strong>Documentation archive</strong>
      <p>Art books, process journals, slide-derived PDFs and visual research behind the portfolio.</p>
    </div>
    <a href="documentation/">Open documentation</a>
  </section>
  <!-- ART_DOCUMENTATION_LINK_END -->"""

    if "</head>" in html:
        html = html.replace("</head>", css + "\n</head>", 1)

    if "</main>" in html:
        html = html.replace("</main>", block + "\n</main>", 1)
    elif "</body>" in html:
        html = html.replace("</body>", block + "\n</body>", 1)

    path.write_text(html, encoding="utf-8")
    print("Patched art/index.html documentation callout.")


if __name__ == "__main__":
    build_documentation_page()
    patch_art_index()
