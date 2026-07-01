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


def slugify(value: str) -> str:
    value = str(value or "").lower().strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-") or "artwork"


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ensure_artwork_ids(payload: dict) -> bool:
    changed = False
    records = payload.setdefault("artworks", [])
    used = {record.get("id") for record in records if record.get("id")}

    for index, record in enumerate(records, start=1):
        if not record.get("id"):
            base = f"{slugify(record.get('collection', 'art'))}-{slugify(record.get('title', 'untitled'))}"
            candidate = base
            counter = 2
            while candidate in used:
                candidate = f"{base}-{counter}"
                counter += 1
            record["id"] = candidate
            used.add(candidate)
            changed = True

        if not record.get("status"):
            record["status"] = "active"
            changed = True

        if not record.get("thumb") and record.get("image"):
            record["thumb"] = record["image"]
            changed = True

        if not record.get("sourceUrl") and record.get("image"):
            record["sourceUrl"] = record["image"]
            changed = True

    return changed


def load_artworks_payload(write_back: bool = False) -> dict:
    payload = read_json(ARTWORKS_PATH, {"artworks": []})
    changed = ensure_artwork_ids(payload)
    if changed and write_back:
        write_json(ARTWORKS_PATH, payload)
    return payload


def load_curation() -> dict:
    payload = read_json(CURATION_PATH, {"homepageHero": {}, "collections": {}})
    payload.setdefault("homepageHero", {})
    payload.setdefault("collections", {})
    return payload


def rebuild_gallery() -> dict:
    result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT)],
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        timeout=30,
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


def find_record(records: list[dict], payload: dict) -> dict | None:
    record_id = payload.get("id")
    image = payload.get("image")

    for record in records:
        if record_id and record.get("id") == record_id:
            return record
        if image and record.get("image") == image:
            return record

    return None


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


def prune_curation_for_record(record: dict) -> None:
    curation = load_curation()
    record_id = record.get("id")
    record_image = record.get("image")

    hero = curation.get("homepageHero", {})
    if hero.get("id") == record_id or hero.get("image") == record_image:
        curation["homepageHero"] = {}

    for collection_rule in curation.get("collections", {}).values():
        feature = collection_rule.get("feature", {})
        if feature.get("id") == record_id or feature.get("image") == record_image:
            collection_rule.pop("feature", None)

    write_json(CURATION_PATH, curation)


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    if "," not in data_url:
        raise ValueError("Upload payload is not a valid data URL")

    header, encoded = data_url.split(",", 1)
    match = re.search(r"data:([^;]+);base64", header)
    mime = match.group(1).lower() if match else "image/jpeg"

    ext_by_mime = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    return base64.b64decode(encoded), ext_by_mime.get(mime, ".jpg")


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


class ArtManagerHandler(SimpleHTTPRequestHandler):
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
            self.send_json(500, {"ok": False, "error": build.get("error"), "message": message, "build": build})
            return

        payload = {"ok": True, "message": message, "build": build}
        if extra:
            payload.update(extra)
        self.send_json(200, payload)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "server": "art-manager", "root": str(ROOT)})
            return
        super().do_GET()

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
                data = load_artworks_payload(write_back=True)
                record = find_record(data["artworks"], payload)

                if not record:
                    self.send_json(404, {"ok": False, "error": "No matching artwork found"})
                    return

                editable_fields = ["title", "collection", "medium", "subgroup", "alt", "text", "reading", "status"]

                for field in editable_fields:
                    if field in payload:
                        record[field] = payload[field]

                record["updatedAt"] = time.strftime("%Y-%m-%d")

                if str(record.get("status", "active")).lower() == "hidden":
                    prune_curation_for_record(record)

                write_json(ARTWORKS_PATH, data)
                self.save_and_rebuild("Artwork updated and gallery rebuilt", {"record": record})
                return

            if path == "/api/hide-artwork":
                payload = self.read_payload()
                data = load_artworks_payload(write_back=True)
                record = find_record(data["artworks"], payload)

                if not record:
                    self.send_json(404, {"ok": False, "error": "No matching artwork found"})
                    return

                record["status"] = "hidden"
                record["updatedAt"] = time.strftime("%Y-%m-%d")

                prune_curation_for_record(record)
                write_json(ARTWORKS_PATH, data)
                self.save_and_rebuild("Artwork hidden and gallery rebuilt", {"record": record})
                return

            if path == "/api/reorder-collection":
                payload = self.read_payload()
                collection = str(payload.get("collection") or "").strip()
                ordered_ids = [str(item) for item in (payload.get("orderedIds") or [])]

                if not collection:
                    self.send_json(400, {"ok": False, "error": "Missing collection"})
                    return

                if not ordered_ids:
                    self.send_json(400, {"ok": False, "error": "No orderedIds supplied"})
                    return

                data = read_json(ARTWORKS_PATH, {"artworks": []})
                records = data.setdefault("artworks", [])

                ordered_set = set(ordered_ids)
                rank = {record_id: index for index, record_id in enumerate(ordered_ids)}

                selected_collection = []
                other_records = []

                for record in records:
                    if record.get("collection") == collection:
                        selected_collection.append(record)
                    else:
                        other_records.append(record)

                def current_order(record):
                    try:
                        return int(record.get("sortOrder", 999999))
                    except (TypeError, ValueError):
                        return 999999

                # Put dragged active records in the requested order.
                ordered_selected = [
                    record for record in selected_collection
                    if str(record.get("id")) in ordered_set
                ]
                ordered_selected.sort(key=lambda record: rank[str(record.get("id"))])

                # Keep hidden/draft/missing records after the active ordered run,
                # preserving their previous relative order.
                leftovers = [
                    record for record in selected_collection
                    if str(record.get("id")) not in ordered_set
                ]
                leftovers.sort(key=lambda record: (current_order(record), str(record.get("title", "")).lower()))

                rewritten_collection = ordered_selected + leftovers

                for index, record in enumerate(rewritten_collection, start=1):
                    record["sortOrder"] = index * 10
                    record["updatedAt"] = time.strftime("%Y-%m-%d")

                # Rebuild the full JSON in collection blocks, preserving other collections.
                rebuilt = []
                inserted = False

                for record in records:
                    if record.get("collection") == collection:
                        if not inserted:
                            rebuilt.extend(rewritten_collection)
                            inserted = True
                    else:
                        rebuilt.append(record)

                data["artworks"] = rebuilt
                write_json(ARTWORKS_PATH, data)

                touched = ordered_selected[0] if ordered_selected else None
                self.save_and_rebuild("Artwork order saved and gallery rebuilt", {"record": touched})
                return

            if path == "/api/add-artwork":
                payload = self.read_payload()
                record = create_artwork_from_upload(payload)

                data = load_artworks_payload(write_back=True)
                data["artworks"].append(record)
                write_json(ARTWORKS_PATH, data)

                if payload.get("makeCollectionFeature") or payload.get("makeHomepageHero"):
                    curation = load_curation()
                    selector = record_selector(record)

                    if payload.get("makeCollectionFeature"):
                        curation["collections"].setdefault(record["collection"], {})["feature"] = selector

                    if payload.get("makeHomepageHero"):
                        curation["homepageHero"] = selector

                    write_json(CURATION_PATH, curation)

                self.save_and_rebuild("Artwork added and gallery rebuilt", {"record": record})
                return

            self.send_json(404, {"ok": False, "error": f"Unknown API endpoint: {path}"})

        except subprocess.TimeoutExpired:
            self.send_json(504, {"ok": False, "error": "Build timed out"})
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": str(exc)})


def main() -> None:
    load_artworks_payload(write_back=True)

    port = int(os.environ.get("ART_CURATOR_PORT", "8000"))

    print()
    print("SALMONOFDOUBT local server")
    print()
    print(f"Site preview: http://localhost:{port}/")
    print(f"Art manager:  http://localhost:{port}/art/manage/")
    print(f"Health check: http://localhost:{port}/api/health")
    print()
    print("Press Ctrl+C here when finished.")
    print()

    ThreadingHTTPServer(("127.0.0.1", port), ArtManagerHandler).serve_forever()


if __name__ == "__main__":
    main()
