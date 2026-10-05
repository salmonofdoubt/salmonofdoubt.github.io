from __future__ import annotations

import gzip
import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path.cwd()

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = unquote(urlparse(self.path).path).lstrip("/")
        target = (ROOT / path).resolve()

        # Keep requests confined to the checked-out repository.
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            self.send_error(403)
            return

        # Simulate CDN behaviour for the mesh: Content-Length is the compressed
        # transfer size, while browser fetch() exposes decompressed response bytes.
        # This reproduces the GitHub Pages failure that the old loader had.
        if path.endswith("/david-head.dlb") and target.is_file():
            raw = target.read_bytes()
            body = gzip.compress(raw, compresslevel=6)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        super().do_GET()

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("Serving test site on http://127.0.0.1:8000", flush=True)
    server.serve_forever()
