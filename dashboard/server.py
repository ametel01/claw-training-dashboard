#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import subprocess
import os

ROOT = Path(__file__).resolve().parents[1]
PORT = 8080

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/api/refresh":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            subprocess.run([
                "node", str(ROOT / "dashboard" / "export-data.mjs")
            ], check=True, cwd=str(ROOT), capture_output=True, text=True)
            self._send_json(200, {"ok": True})
        except subprocess.CalledProcessError as e:
            self._send_json(500, {
                "ok": False,
                "error": (e.stderr or e.stdout or str(e)).strip()
            })

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving dashboard with refresh API on http://127.0.0.1:{PORT}")
    server.serve_forever()
