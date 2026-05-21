from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

REQUIRED_FILES = [
    ROOT / "index.html",
    ROOT / "styles.css",
    ROOT / "app.js",
    ROOT / "manifest.webmanifest",
    ROOT / "service-worker.js",
    DATA_DIR / "app-status.json",
]

REQUIRED_MANIFEST_FIELDS = [
    "name",
    "short_name",
    "start_url",
    "scope",
    "display",
    "icons",
]


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}") from exc


def main() -> None:
    warnings: list[str] = []

    for path in REQUIRED_FILES:
        if not path.exists():
            raise SystemExit(f"Missing required PWA file: {path}")

    index_html = (ROOT / "index.html").read_text(encoding="utf-8")

    if "manifest.webmanifest" not in index_html:
        warnings.append("index.html does not reference manifest.webmanifest.")

    if "serviceWorker" not in index_html:
        warnings.append("index.html does not register a service worker.")

    manifest = load_json(ROOT / "manifest.webmanifest")

    for field in REQUIRED_MANIFEST_FIELDS:
        if field not in manifest:
            warnings.append(f"manifest.webmanifest missing required field: {field}")

    icons = manifest.get("icons", [])
    icon_sizes = {icon.get("sizes") for icon in icons if isinstance(icon, dict)}

    for expected in {"192x192", "512x512"}:
        if expected not in icon_sizes:
            warnings.append(f"manifest.webmanifest missing icon size {expected}.")

    for icon in icons:
        src = icon.get("src")
        if not src:
            continue
        icon_path = ROOT / src
        if not icon_path.exists():
            warnings.append(f"Manifest icon missing on disk: {src}")

    validation = {
        "status": "pass" if not warnings else "warning",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "warnings": warnings,
    }

    (DATA_DIR / "validation.json").write_text(
        json.dumps(validation, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"PWA validation: {validation['status']}")
    for warning in warnings:
        print(f"Warning: {warning}")


if __name__ == "__main__":
    main()
