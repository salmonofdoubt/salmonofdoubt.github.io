#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import html
import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "birds.json"
OUT_MD = ROOT / "ATTRIBUTION.md"
OUT_HTML = ROOT / "attribution.html"


def safe(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("\n", " ").replace("|", "\\|")
    return text or "Not parsed"


def esc(value: Any) -> str:
    return html.escape(str(value or "").strip() or "Not parsed")


def md_link(label: str, url: str) -> str:
    label = safe(label)
    url = str(url or "").strip()
    return f"[{label}]({url})" if url else label


def html_link(label: str, url: str) -> str:
    label = esc(label)
    url = str(url or "").strip()
    if not url:
        return label
    return f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{label}</a>'


def audio_row(bird: Dict[str, Any]) -> Dict[str, str] | None:
    audio = bird.get("audio")
    if not audio:
        return None

    source_url = audio.get("url") or audio.get("file") or ""

    return {
        "media": "Audio",
        "species_md": f"{safe(bird.get('common_name'))}<br><em>{safe(bird.get('scientific_name'))}</em>",
        "species_html": f"{esc(bird.get('common_name'))}<br><em>{esc(bird.get('scientific_name'))}</em>",
        "creator_md": safe(audio.get("recordist")),
        "creator_html": esc(audio.get("recordist")),
        "source_md": md_link(audio.get("source") or "xeno-canto", source_url),
        "source_html": html_link(audio.get("source") or "xeno-canto", source_url),
        "licence_md": safe(audio.get("license")),
        "licence_html": esc(audio.get("license")),
        "detail_md": safe(f"type: {audio.get('type')}, country: {audio.get('country')}, quality: {audio.get('q')}, id: {audio.get('id')}"),
        "detail_html": esc(f"type: {audio.get('type')}, country: {audio.get('country')}, quality: {audio.get('q')}, id: {audio.get('id')}")
    }


def image_row(bird: Dict[str, Any]) -> Dict[str, str] | None:
    image = bird.get("image")
    if not image:
        return None

    source_url = image.get("commons_url") or image.get("url") or image.get("original") or image.get("thumb") or ""

    return {
        "media": "Image",
        "species_md": f"{safe(bird.get('common_name'))}<br><em>{safe(bird.get('scientific_name'))}</em>",
        "species_html": f"{esc(bird.get('common_name'))}<br><em>{esc(bird.get('scientific_name'))}</em>",
        "creator_md": safe(image.get("artist")),
        "creator_html": esc(image.get("artist")),
        "source_md": md_link(image.get("source") or image.get("page_title") or "Wikimedia/Wikipedia", source_url),
        "source_html": html_link(image.get("source") or image.get("page_title") or "Wikimedia/Wikipedia", source_url),
        "licence_md": safe(image.get("license")),
        "licence_html": esc(image.get("license")),
        "detail_md": safe(f"page: {image.get('page_title')}, file: {image.get('file_title')}, query: {image.get('query')}"),
        "detail_html": esc(f"page: {image.get('page_title')}, file: {image.get('file_title')}, query: {image.get('query')}")
    }


def markdown_table(rows: List[Dict[str, str]]) -> str:
    out = "| Media | Species | Creator / recordist | Source | Licence | Details |\n"
    out += "|---|---|---|---|---|---|\n"
    for row in rows:
        out += f"| {row['media']} | {row['species_md']} | {row['creator_md']} | {row['source_md']} | {row['licence_md']} | {row['detail_md']} |\n"
    return out


def html_table(rows: List[Dict[str, str]]) -> str:
    body = ""
    for row in rows:
        body += f"""
        <tr>
          <td>{esc(row['media'])}</td>
          <td>{row['species_html']}</td>
          <td>{row['creator_html']}</td>
          <td>{row['source_html']}</td>
          <td>{row['licence_html']}</td>
          <td>{row['detail_html']}</td>
        </tr>"""
    return f"""
      <table>
        <thead>
          <tr>
            <th>Media</th>
            <th>Species</th>
            <th>Creator / recordist</th>
            <th>Source</th>
            <th>Licence</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>{body}
        </tbody>
      </table>
    """


def main() -> None:
    if not DATA_PATH.exists():
        raise SystemExit(f"Missing {DATA_PATH}. Run the BOIE harvest first.")

    payload = json.loads(DATA_PATH.read_text())
    birds = payload.get("birds", [])

    rows: List[Dict[str, str]] = []
    for bird in sorted(birds, key=lambda b: str(b.get("common_name", "")).lower()):
        audio = audio_row(bird)
        image = image_row(bird)
        if audio:
            rows.append(audio)
        if image:
            rows.append(image)

    generated = dt.datetime.now(dt.timezone.utc).isoformat()

    OUT_MD.write_text(
        "# BOIE Attribution Index\n\n"
        f"Generated: `{generated}`\n\n"
        "This file is generated from demos/boie/data/birds.json.\n\n"
        "BOIE does not claim ownership of third-party sounds or images. Media remain the work of their original creators and are subject to the licence terms shown by the source. Licence metadata may be incomplete or may change at source. Check the linked source page before reuse, redistribution, monetisation, or app-store release.\n\n"
        "## Attribution table\n\n"
        + (markdown_table(rows) if rows else "No media attribution rows found.\n")
        + "\n## Regenerate\n\npython demos/boie/ops/build_attribution.py\n"
    )

    OUT_HTML.write_text(f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOIE Attribution Index</title>
  <style>
    :root {{
      --bg: #05080d;
      --panel: rgba(9, 18, 28, 0.92);
      --ink: #e9f7f4;
      --muted: #9cb4b0;
      --line: rgba(128, 255, 200, 0.24);
      --green: #80ffc8;
      --cyan: #4ff6ff;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 12% 0%, rgba(128,255,200,0.14), transparent 28rem), var(--bg);
      color: var(--ink);
    }}
    main {{
      width: min(1180px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 28px 0 72px;
    }}
    nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }}
    nav a {{
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      color: var(--ink);
      text-decoration: none;
      font-weight: 850;
    }}
    a {{ color: var(--cyan); }}
    h1 {{
      margin: 0;
      font-size: clamp(2rem, 5vw, 4rem);
      letter-spacing: -0.06em;
    }}
    .lede {{
      max-width: 860px;
      color: var(--muted);
      line-height: 1.6;
    }}
    .panel {{
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: var(--panel);
      overflow-x: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
    }}
    th, td {{
      padding: 10px;
      border-bottom: 1px solid rgba(128,255,200,0.14);
      text-align: left;
      vertical-align: top;
      font-size: 0.9rem;
      line-height: 1.38;
    }}
    th {{
      color: var(--green);
      position: sticky;
      top: 0;
      background: #07111b;
      z-index: 1;
    }}
    .meta {{
      color: var(--muted);
      font-size: 0.92rem;
    }}
  </style>
</head>
<body>
  <main>
    <nav>
      <a href="./">← Back to BOIE</a>
      <a href="https://github.com/salmonofdoubt/salmonofdoubt.github.io/blob/master/demos/boie/README.md" target="_blank" rel="noopener">README</a>
      <a href="https://github.com/salmonofdoubt/salmonofdoubt.github.io/blob/master/demos/boie/ATTRIBUTION.md" target="_blank" rel="noopener">Markdown attribution</a>
    </nav>

    <h1>BOIE Attribution Index</h1>
    <p class="lede">
      This page lists third-party media metadata currently known to BOIE.
      BOIE does not claim ownership of third-party sounds or images.
      Media remain the work of their original creators and are subject to the licence terms shown by the source.
    </p>
    <p class="meta">Generated: {esc(generated)} · Rows: {len(rows)}</p>

    <section class="panel">
      {html_table(rows) if rows else "<p>No media attribution rows found.</p>"}
    </section>
  </main>
</body>
</html>
""")

    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_HTML}")
    print(f"Rows: {len(rows)}")


if __name__ == "__main__":
    main()
