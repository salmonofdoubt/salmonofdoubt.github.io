#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
ARTWORKS_PATH = ART / "data" / "artworks.json"
CURATION_PATH = ART / "data" / "art-curation.json"
BUILD_SCRIPT = ROOT / "tools" / "build_art_gallery_static.py"

COLLECTION_SLUGS = {
    "Oil Paintings": "oil-paintings",
    "Watercolours": "watercolours",
    "Drawings": "drawings",
    "Experimental": "experimental",
    "GeoSpatial Imagery": "geospatial-imagery",
}


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def slugify(value: str) -> str:
    value = str(value or "").lower().strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-") or "artwork"


def rebuild_gallery() -> dict:
    result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT)],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        timeout=25,
        check=False,
    )

    if result.returncode != 0:
        return {
            "ok": False,
            "error": "Build failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
        }

    return {
        "ok": True,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if "," not in data_url:
        raise ValueError("Upload payload is not a valid data URL")

    header, b64 = data_url.split(",", 1)
    match = re.search(r"data:([^;]+);base64", header)
    mime = match.group(1).lower() if match else "image/jpeg"

    ext_by_mime = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    return base64.b64decode(b64), ext_by_mime.get(mime, ".jpg")


def load_artworks_payload() -> dict:
    payload = read_json(ARTWORKS_PATH, {"artworks": []})
    payload.setdefault("artworks", [])
    return payload


def save_artworks_payload(payload: dict) -> None:
    payload.setdefault("artworks", [])
    write_json(ARTWORKS_PATH, payload)


def load_curation() -> dict:
    payload = read_json(CURATION_PATH, {"homepageHero": {}, "collections": {}})
    payload.setdefault("homepageHero", {})
    payload.setdefault("collections", {})
    return payload


def save_curation(payload: dict) -> None:
    payload.setdefault("homepageHero", {})
    payload.setdefault("collections", {})
    write_json(CURATION_PATH, payload)


def record_selector(record: dict) -> dict:
    return {
        "id": record.get("id"),
        "title": record.get("title"),
        "titleContains": record.get("title"),
        "collection": record.get("collection"),
        "medium": record.get("medium"),
        "subgroup": record.get("subgroup"),
        "image": record.get("image"),
        "thumb": record.get("thumb") or record.get("image"),
        "sourceUrl": record.get("sourceUrl") or record.get("image"),
        "alt": record.get("alt") or record.get("title"),
        "text": record.get("text") or "",
        "reading": record.get("reading") or "",
    }


def prune_curation_for_hidden(record: dict) -> None:
    curation = load_curation()
    record_id = record.get("id")
    record_image = record.get("image")

    hero = curation.get("homepageHero", {})
    if hero.get("id") == record_id or hero.get("image") == record_image:
        curation["homepageHero"] = {}

    for item in curation.get("collections", {}).values():
        feature = item.get("feature", {})
        if feature.get("id") == record_id or feature.get("image") == record_image:
            item.pop("feature", None)

    save_curation(curation)


def create_artwork_from_upload(payload: dict) -> dict:
    image_data = payload.get("imageDataUrl")
    if not image_data:
        raise ValueError("Missing imageDataUrl")

    title = str(payload.get("title") or "").strip()
    if not title:
        raise ValueError("Artwork title is required")

    collection = str(payload.get("collection") or "Experimental").strip()
    collection_slug = COLLECTION_SLUGS.get(collection, slugify(collection))

    image_bytes, ext = decode_data_url(image_data)

    target_dir = ART / "assets" / "works" / collection_slug
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{slugify(title)}-{uuid.uuid4().hex[:8]}{ext}"
    target = target_dir / filename
    target.write_bytes(image_bytes)

    relative_image = str(target.relative_to(ART))

    today = time.strftime("%Y-%m-%d")

    return {
        "id": f"{collection_slug}-{slugify(title)}-{uuid.uuid4().hex[:8]}",
        "collection": collection,
        "collectionOrder": int(payload.get("collectionOrder") or 999),
        "subgroup": str(payload.get("subgroup") or "Other").strip(),
        "title": title,
        "medium": str(payload.get("medium") or collection).strip(),
        "image": relative_image,
        "thumb": relative_image,
        "source": "Local upload",
        "sourceUrl": relative_image,
        "alt": str(payload.get("alt") or title).strip(),
        "text": str(payload.get("text") or "").strip(),
        "reading": str(payload.get("reading") or "").strip(),
        "status": "active",
        "createdAt": today,
        "updatedAt": today,
    }


class CuratorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_payload(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def save_and_rebuild(self, message: str, extra: dict | None = None) -> None:
        build = rebuild_gallery()
        if not build.get("ok"):
            self.send_json(500, {"ok": False, "message": message, "build": build})
            return

        response = {"ok": True, "message": message, "build": build}
        if extra:
            response.update(extra)
        self.send_json(200, response)

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        try:
            if path == "/api/save-art-curation":
                payload = self.read_payload()
                payload.setdefault("homepageHero", {})
                payload.setdefault("collections", {})
                write_json(CURATION_PATH, payload)
                self.save_and_rebuild("Curation saved and gallery rebuilt")
                return

            if path == "/api/update-artwork":
                payload = self.read_payload()
                record_id = payload.get("id")
                if not record_id:
                    self.send_json(400, {"ok": False, "error": "Missing artwork id"})
                    return

                data = load_artworks_payload()
                editable_fields = ["title", "collection", "medium", "subgroup", "alt", "text", "reading", "status"]

                for record in data["artworks"]:
                    if record.get("id") == record_id:
                        for field in editable_fields:
                            if field in payload:
                                record[field] = payload[field]
                        record["updatedAt"] = time.strftime("%Y-%m-%d")
                        save_artworks_payload(data)

                        if str(record.get("status", "active")).lower() == "hidden":
                            prune_curation_for_hidden(record)

                        self.save_and_rebuild("Artwork updated and gallery rebuilt", {"record": record})
                        return

                self.send_json(404, {"ok": False, "error": f"No artwork found with id {record_id}"})
                return

            if path == "/api/hide-artwork":
                payload = self.read_payload()
                record_id = payload.get("id")
                if not record_id:
                    self.send_json(400, {"ok": False, "error": "Missing artwork id"})
                    return

                data = load_artworks_payload()

                for record in data["artworks"]:
                    if record.get("id") == record_id:
                        record["status"] = "hidden"
                        record["updatedAt"] = time.strftime("%Y-%m-%d")
                        save_artworks_payload(data)
                        prune_curation_for_hidden(record)
                        self.save_and_rebuild("Artwork hidden and gallery rebuilt", {"record": record})
                        return

                self.send_json(404, {"ok": False, "error": f"No artwork found with id {record_id}"})
                return

            if path == "/api/add-artwork":
                payload = self.read_payload()
                record = create_artwork_from_upload(payload)

                data = load_artworks_payload()
                data["artworks"].append(record)
                save_artworks_payload(data)

                if payload.get("makeCollectionFeature") or payload.get("makeHomepageHero"):
                    curation = load_curation()
                    selector = record_selector(record)

                    if payload.get("makeCollectionFeature"):
                        curation.setdefault("collections", {}).setdefault(record["collection"], {})["feature"] = selector

                    if payload.get("makeHomepageHero"):
                        curation["homepageHero"] = selector

                    save_curation(curation)

                self.save_and_rebuild("Artwork added and gallery rebuilt", {"record": record})
                return

            self.send_json(404, {"ok": False, "error": "Unknown endpoint"})

        except subprocess.TimeoutExpired:
            self.send_json(504, {"ok": False, "error": "Build timed out"})
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": str(exc)})


def main() -> None:
    port = int(os.environ.get("ART_CURATOR_PORT", "8000"))
    print(f"Serving DiAndré curator from {ROOT}")
    print(f"Manage art:       http://localhost:{port}/art/manage/")
    print(f"Preview:          http://localhost:{port}/art/")
    print("Use Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", port), CuratorHandler).serve_forever()


if __name__ == "__main__":
    main()
