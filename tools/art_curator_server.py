#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ARTWORKS_PATH = ROOT / "art" / "data" / "artworks.json"
CURATION_PATH = ROOT / "art" / "data" / "art-curation.json"
BUILD_SCRIPT = ROOT / "tools" / "build_art_gallery_static.py"


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


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


def prune_curation_for_hidden(record: dict) -> None:
    curation = read_json(CURATION_PATH, {"homepageHero": {}, "collections": {}})
    record_id = record.get("id")
    record_image = record.get("image")

    hero = curation.get("homepageHero", {})
    if hero.get("id") == record_id or hero.get("image") == record_image:
        curation["homepageHero"] = {}

    for item in curation.get("collections", {}).values():
        feature = item.get("feature", {})
        if feature.get("id") == record_id or feature.get("image") == record_image:
            item.pop("feature", None)

    write_json(CURATION_PATH, curation)


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

        payload = {"ok": True, "message": message, "build": build}
        if extra:
            payload.update(extra)
        self.send_json(200, payload)

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

                data = read_json(ARTWORKS_PATH, {"artworks": []})
                records = data.setdefault("artworks", [])

                editable_fields = [
                    "title",
                    "collection",
                    "medium",
                    "subgroup",
                    "alt",
                    "text",
                    "reading",
                    "status",
                ]

                for record in records:
                    if record.get("id") == record_id:
                        for field in editable_fields:
                            if field in payload:
                                record[field] = payload[field]
                        record["updatedAt"] = time.strftime("%Y-%m-%d")
                        write_json(ARTWORKS_PATH, data)

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

                data = read_json(ARTWORKS_PATH, {"artworks": []})
                records = data.setdefault("artworks", [])

                for record in records:
                    if record.get("id") == record_id:
                        record["status"] = "hidden"
                        record["updatedAt"] = time.strftime("%Y-%m-%d")
                        write_json(ARTWORKS_PATH, data)
                        prune_curation_for_hidden(record)
                        self.save_and_rebuild("Artwork hidden and gallery rebuilt", {"record": record})
                        return

                self.send_json(404, {"ok": False, "error": f"No artwork found with id {record_id}"})
                return

            self.send_json(404, {"ok": False, "error": "Unknown endpoint"})

        except subprocess.TimeoutExpired:
            self.send_json(504, {"ok": False, "error": "Build timed out"})
        except Exception as exc:
            self.send_json(500, {"ok": False, "error": str(exc)})


def main() -> None:
    port = int(os.environ.get("ART_CURATOR_PORT", "8000"))
    print(f"Serving DiAndré curator from {ROOT}")
    print(f"Feature curator: http://localhost:{port}/art/curate/")
    print(f"Edit and hide:    http://localhost:{port}/art/manage/")
    print(f"Preview:          http://localhost:{port}/art/")
    print("Use Ctrl+C to stop.")
    ThreadingHTTPServer(("127.0.0.1", port), CuratorHandler).serve_forever()


if __name__ == "__main__":
    main()
