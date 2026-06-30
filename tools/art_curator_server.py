#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CURATION_PATH = ROOT / "art" / "data" / "art-curation.json"
BUILD_SCRIPT = ROOT / "tools" / "build_art_gallery_static.py"


class CuratorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/save-art-curation":
            self._send_json(404, {"ok": False, "error": "Unknown endpoint"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            payload = json.loads(raw)

            if not isinstance(payload, dict):
                raise ValueError("Curation payload must be a JSON object")

            payload.setdefault("homepageHero", {})
            payload.setdefault("collections", {})

            CURATION_PATH.parent.mkdir(parents=True, exist_ok=True)
            CURATION_PATH.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8"
            )

            result = subprocess.run(
                [sys.executable, str(BUILD_SCRIPT)],
                cwd=str(ROOT),
                text=True,
                capture_output=True,
                timeout=20,
                check=False,
            )

            if result.returncode != 0:
                self._send_json(500, {
                    "ok": False,
                    "error": "Curation saved, but build failed.",
                    "stdout": result.stdout,
                    "stderr": result.stderr
                })
                return

            self._send_json(200, {
                "ok": True,
                "message": "Curation saved and gallery rebuilt.",
                "stdout": result.stdout
            })

        except subprocess.TimeoutExpired as exc:
            self._send_json(504, {
                "ok": False,
                "error": "Curation saved, but build timed out after 20 seconds.",
                "stdout": exc.stdout or "",
                "stderr": exc.stderr or ""
            })
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})


def main() -> None:
    host = "127.0.0.1"
    port = int(os.environ.get("ART_CURATOR_PORT", "8000"))
    print(f"Serving curator from {ROOT}")
    print(f"Open: http://localhost:{port}/art/curate/")
    print("Use Ctrl+C to stop.")
    ThreadingHTTPServer((host, port), CuratorHandler).serve_forever()


if __name__ == "__main__":
    main()
