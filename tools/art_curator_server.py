#!/usr/bin/env python3
from __future__ import annotations
import shutil

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
from urllib.parse import unquote, urlparse

import html
import art_google_photos as google_photos
import art_publish

from art_studio_assets import (
    bulk_link_assets as studio_bulk_link_assets,
    client_asset as studio_client_asset,
    delete_asset as studio_delete_asset,
    file_for_asset as studio_file_for_asset,
    find_asset as studio_find_asset,
    load_assets as studio_load_assets,
    update_asset as studio_update_asset,
    upload_asset as studio_upload_asset,
)
from art_related import (
    add_reference_upload,
    build_public_related,
    client_reference,
    delete_reference_record,
    delete_related_set,
    load_master,
    reference_path,
    save_master,
    save_reference,
    save_related_set,
)

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"
ARTWORKS_PATH = ART / "data" / "artworks.json"
CURATION_PATH = ART / "data" / "art-curation.json"
RELATED_WORKS_PATH = ART / "data" / "related-works.json"
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

    def publish_same_origin(self) -> bool:
        """Strictly local publication capability. Refuse cross-site browser calls."""
        port = int(os.environ.get("ART_CURATOR_PORT", "8000"))
        allowed = {f"localhost:{port}", f"127.0.0.1:{port}"}
        host = self.headers.get("Host", "")
        if host not in allowed:
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://" + host}:
            return False
        fetch_site = self.headers.get("Sec-Fetch-Site", "")
        if fetch_site not in {"", "same-origin", "none"}:
            return False
        return True

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

        if path == "/api/art-publish/review":
            if not self.publish_same_origin():
                self.send_json(403, {"ok": False, "error": "Open ARTS Manager on localhost to review publication."})
                return
            try:
                self.send_json(200, art_publish.review())
            except art_publish.PublishError as exc:
                self.send_json(409, {"ok": False, "error": str(exc)})
            return

        if path == "/api/art-publish/status":
            if not self.publish_same_origin():
                self.send_json(403, {"ok": False, "error": "Local ARTS Manager only."})
                return
            try:
                report = art_publish.review()
                self.send_json(200, {"ok": True, "pending": len(report["files"]),
                                     "excluded": len(report["excluded"]),
                                     "branch": report["branch"]})
            except art_publish.PublishError as exc:
                self.send_json(409, {"ok": False, "error": str(exc)})
            return

        if path == "/api/art-publish/publish-review":
            if not self.publish_same_origin():
                self.send_json(403, {"ok": False, "error": "Local ARTS Manager only."})
                return
            try:
                self.send_json(200, art_publish.publish_review())
            except art_publish.PublishError as exc:
                self.send_json(409, {"ok": False, "error": str(exc)})
            return


        if path == "/api/google-photos/status":
            self.send_json(200, {"ok": True, **google_photos.public_status()})
            return

        if path == "/api/google-photos/connect":
            try:
                location = google_photos.oauth_start()
                self.send_response(302)
                self.send_header("Location", location)
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
            except ValueError as exc:
                self.send_error(400, str(exc))
            return

        if path == "/api/google-photos/callback":
            query = __import__("urllib.parse", fromlist=["parse_qs"]).parse_qs(
                urlparse(self.path).query)
            err = (query.get("error") or [""])[0]
            if err:
                message, ok = "Google authorization was not completed: " + err, False
            else:
                try:
                    google_photos.oauth_complete(
                        (query.get("code") or [""])[0],
                        (query.get("state") or [""])[0])
                    message, ok = "Google Photos connected. Return to Studio Assets.", True
                except (ValueError, OSError) as exc:
                    message, ok = str(exc), False
            msg = html.escape(message)
            result = """<!doctype html><meta charset="utf-8"><title>Google Photos connection</title>
<style>body{font:16px system-ui;background:#100d0a;color:#f1e1c5;padding:3rem}
a{color:#d4ae6c}</style><h1>Google Photos</h1><p>""" + msg + """</p>
<p><a href="/art/manage/">Return to ARTS Manager</a></p>"""
            if ok:
                result += """<script>if(window.opener){
window.opener.postMessage({type:"arts-google-photos-connected"},window.location.origin);
window.close();}</script>"""
            content = result.encode("utf-8")
            self.send_response(200 if ok else 400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/api/google-photos/poll":
            try:
                self.send_json(200, {"ok": True, **google_photos.poll_session()})
            except (ValueError, OSError) as exc:
                self.send_json(400, {"ok": False, "error": str(exc)})
            return

        # Deny direct access to local-only material even with percent-encoded
        # hidden path segments. Files can be read only via explicit asset APIs.
        parts = unquote(path).replace("\\", "/").split("/")
        if any(part.startswith(".") and part not in {"", ".well-known"}
               for part in parts):
            self.send_error(404)
            return

        if path == "/api/studio-assets":
            self.send_json(200, {
                "ok": True,
                "assets": [studio_client_asset(a) for a in studio_load_assets()["assets"]],
            })
            return

        if path.startswith("/api/studio-file/"):
            ident = path.rsplit("/", 1)[-1]
            item = studio_find_asset(ident)
            target = studio_file_for_asset(item) if item else None
            if not target:
                self.send_error(404, "Studio asset not found")
                return
            mime = item.get("mime") or "application/octet-stream"
            inline = mime.startswith(("image/", "audio/", "video/")) or mime == "application/pdf"
            data = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Disposition", "inline" if inline else "attachment")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # RELATED_CANONICAL_V1
        if path == "/api/references":
            master = load_master()
            self.send_json(200, {
                "ok": True,
                "references": [client_reference(r) for r in master.get("references", [])],
            })
            return

        if path.startswith("/api/reference-image/"):
            ref_id = path.rsplit("/", 1)[-1]
            target = reference_path(ref_id)
            if not target:
                self.send_error(404, "Reference image not found")
                return

            content_type = {
                ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",
                ".webp":"image/webp",".gif":"image/gif",".avif":"image/avif",
            }.get(target.suffix.lower(),"application/octet-stream")

            payload=target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type",content_type)
            self.send_header("Content-Length",str(len(payload)))
            self.send_header("Cache-Control","no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

        # RELATED_GROUPS_GET_V3
        if path == "/api/related-groups":
            master = load_master()
            groups = master.get("sets", [])

            # One-time recovery fallback from the References-v1 store.
            recovered_path = ROOT / ".art-private" / "related-groups.json"
            if not groups and recovered_path.exists():
                recovered = read_json(
                    recovered_path,
                    {"version": 2, "groups": []},
                )
                recovered_groups = recovered.get("groups", [])
                if recovered_groups:
                    master["sets"] = recovered_groups
                    save_master(master)
                    groups = recovered_groups

            self.send_json(
                200,
                {
                    "ok": True,
                    "related": {
                        "version": 2,
                        "groups": groups,
                    },
                },
            )
            return

        if path == "/api/health":
            self.send_json(200, {"ok": True, "server": "art-manager", "root": str(ROOT)})
            return

        if path.startswith("/.art-private/"):
            self.send_error(404)
            return

        if path == "/api/related-state":
            self.send_json(200, {"ok": True, "state": load_master()})
            return

        if path.startswith("/api/related-reference/"):
            ref_id = path.rsplit("/", 1)[-1]
            target = reference_path(ref_id)
            if not target:
                self.send_error(404, "Reference image not found")
                return

            content_type = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".avif": "image/avif",
            }.get(target.suffix.lower(), "application/octet-stream")

            body = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        try:
            if path in {"/api/art-publish/commit", "/api/art-publish/push"}:
                if not self.publish_same_origin():
                    self.send_json(403, {"ok": False, "error": "Open the local ARTS Manager to publish."})
                    return
                if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                    self.send_json(415, {"ok": False, "error": "JSON request required."})
                    return
                if int(self.headers.get("Content-Length", "0")) > 4096:
                    self.send_json(413, {"ok": False, "error": "Publication request too large."})
                    return
                payload = self.read_payload()
                try:
                    if path.endswith("/commit"):
                        result = art_publish.commit(
                            str(payload.get("reviewToken") or ""),
                            str(payload.get("message") or ""))
                    else:
                        result = art_publish.publish(
                            str(payload.get("reviewToken") or ""),
                            str(payload.get("confirmation") or ""))
                except art_publish.PublishError as exc:
                    self.send_json(409, {"ok": False, "error": str(exc)})
                    return
                self.send_json(200, result)
                return

            if path in {"/api/google-photos/configure", "/api/google-photos/start",
                        "/api/google-photos/import", "/api/google-photos/import-artworks",
                        "/api/google-photos/cancel",
                        "/api/google-photos/disconnect"}:
                if int(self.headers.get("Content-Length", "0")) > 40 * 1024:
                    self.send_json(413, {"ok": False, "error": "Request too large"})
                    return
                payload = self.read_payload()
                try:
                    if path == "/api/google-photos/configure":
                        result = google_photos.configure(payload)
                    elif path == "/api/google-photos/start":
                        result = google_photos.start_session()
                    elif path == "/api/google-photos/cancel":
                        google_photos.stop_session()
                        result = {"message": "Selection cancelled"}
                    elif path == "/api/google-photos/disconnect":
                        google_photos.disconnect(revoke=True)
                        result = {"message": "Google Photos disconnected"}
                    elif path == "/api/google-photos/import-artworks":
                        room = str(payload.get("collection") or "").strip()
                        if room not in COLLECTION_SLUGS:
                            raise ValueError("Choose an existing exhibition Room")
                        result = google_photos.import_picked_artworks(
                            payload, create_artwork_from_upload)
                        imported = result.get("imported") or []
                        if imported:
                            # Existing artwork records and related groups are
                            # preserved, and only new IDs are appended.
                            data = load_artworks_payload(write_back=True)
                            data.setdefault("artworks", []).extend(imported)
                            write_json(ARTWORKS_PATH, data)
                            if len(imported) == 1 and (
                                    payload.get("makeCollectionFeature") or
                                    payload.get("makeHomepageHero")):
                                curation = load_curation()
                                selector = record_selector(imported[0])
                                if payload.get("makeCollectionFeature"):
                                    curation["collections"].setdefault(room, {})["feature"] = selector
                                if payload.get("makeHomepageHero"):
                                    curation["homepageHero"] = selector
                                write_json(CURATION_PATH, curation)
                            self.save_and_rebuild("Google Photos artworks imported",
                                                  {"googlePhotos": result})
                            return
                    else:
                        result = google_photos.import_picked(payload)
                        if result.get("imported"):
                            self.save_and_rebuild("Google Photos media imported",
                                                  {"googlePhotos": result})
                            return
                except (ValueError, OSError) as exc:
                    self.send_json(400, {"ok": False, "error": str(exc)})
                    return
                self.send_json(200, {"ok": True, **result})
                return

            if path == "/api/studio-bulk-link":
                if int(self.headers.get("Content-Length", "0")) > 100 * 1024:
                    self.send_json(413, {"ok": False, "error": "Bulk request too large"})
                    return
                payload = self.read_payload()
                try:
                    outcome = studio_bulk_link_assets(payload)
                except ValueError as exc:
                    self.send_json(400, {"ok": False, "error": str(exc)})
                    return
                self.save_and_rebuild("Studio Asset associations updated",
                                      {"bulk": outcome})
                return

            if path in {"/api/studio-upload", "/api/studio-update", "/api/studio-delete"}:
                if int(self.headers.get("Content-Length", "0")) > 35 * 1024 * 1024:
                    self.send_json(413, {"ok": False, "error": "Studio upload exceeds 25 MB"})
                    return
                payload = self.read_payload()
                try:
                    if path == "/api/studio-upload":
                        item = studio_upload_asset(payload)
                        message = "Studio asset uploaded"
                    elif path == "/api/studio-update":
                        item = studio_update_asset(payload)
                        message = "Studio asset updated"
                    else:
                        studio_delete_asset(str(payload.get("id") or ""))
                        item = None
                        message = "Studio asset deleted"
                except KeyError as exc:
                    self.send_json(404, {"ok": False, "error": str(exc).strip("'")})
                    return
                except ValueError as exc:
                    self.send_json(400, {"ok": False, "error": str(exc)})
                    return
                self.save_and_rebuild(message + " and public projection rebuilt",
                                      {"asset": studio_client_asset(item) if item else None})
                return

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

            if path == "/api/related-state":
                payload = self.read_payload()
                state = payload.get("state")
                if not isinstance(state, dict):
                    self.send_json(400, {"ok": False, "error": "Missing related-work state"})
                    return

                state = save_master(state)
                build_public_related()
                self.save_and_rebuild("Related works saved and gallery rebuilt", {"state": state})
                return

            if path == "/api/add-related-reference":
                payload = self.read_payload()
                state, reference = add_reference_upload(payload)
                build_public_related()
                self.save_and_rebuild(
                    "Reference added and gallery rebuilt",
                    {"state": state, "reference": reference},
                )
                return

            # RELATED_CANONICAL_V1
            if path == "/api/save-reference":
                try:
                    master, reference = save_reference(self.read_payload())
                except KeyError as exc:
                    self.send_json(404, {"ok":False,"error":str(exc).strip("'")})
                    return
                except ValueError as exc:
                    self.send_json(400, {"ok":False,"error":str(exc)})
                    return

                self.send_json(200,{
                    "ok":True,
                    "reference":client_reference(reference),
                    "references":[client_reference(r) for r in master.get("references",[])],
                })
                return

            if path == "/api/delete-reference":
                ref_id=str(self.read_payload().get("id") or "").strip()
                if not ref_id:
                    self.send_json(400,{"ok":False,"error":"Missing reference ID"})
                    return

                try:
                    master, affected = delete_reference_record(ref_id)
                except KeyError as exc:
                    self.send_json(404,{"ok":False,"error":str(exc).strip("'")})
                    return

                self.send_json(200,{
                    "ok":True,
                    "references":[client_reference(r) for r in master.get("references",[])],
                    "related":{"version":2,"groups":master.get("sets",[])},
                    "affectedGroups":affected,
                })
                return

            if path == "/api/related-groups":
                master=load_master()
                self.send_json(200,{
                    "ok":True,
                    "related":{"version":2,"groups":master.get("sets",[])}
                })
                return

            if path == "/api/save-related-group":
                payload=self.read_payload()

                try:
                    master, group, duplicate = save_related_set(
                        str(payload.get("groupId") or "").strip(),
                        str(payload.get("title") or "").strip() or "Related works",
                        payload.get("members") if payload.get("members") is not None else payload.get("orderedIds") or [],
                        bool(payload.get("allowDuplicate")),
                        bool(payload.get("makeStudioPublic")),
                    )
                except KeyError as exc:
                    self.send_json(404,{"ok":False,"error":str(exc).strip("'")})
                    return
                except ValueError as exc:
                    self.send_json(400,{"ok":False,"error":str(exc)})
                    return

                if duplicate and not group:
                    self.send_json(409,{
                        "ok":False,
                        "error":"A related group with the same members already exists",
                        "duplicateGroup":duplicate,
                    })
                    return

                self.save_and_rebuild("Related group saved", {
                    "group":group,
                    "related":{"version":2,"groups":master.get("sets",[])},
                })
                return

            if path == "/api/delete-related-group":
                group_id=str(self.read_payload().get("groupId") or "").strip()
                if not group_id:
                    self.send_json(400,{"ok":False,"error":"Missing groupId"})
                    return

                try:
                    master=delete_related_set(group_id)
                except KeyError as exc:
                    self.send_json(404,{"ok":False,"error":str(exc).strip("'")})
                    return

                self.send_json(200,{
                    "ok":True,
                    "related":{"version":2,"groups":master.get("sets",[])}
                })
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
