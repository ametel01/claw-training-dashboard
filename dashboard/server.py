#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import subprocess
import os
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
PORT = 8080
NODE_BIN = "/Users/brunoclaw/.nvm/versions/node/v24.13.1/bin/node"

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/refresh":
            try:
                subprocess.run([
                    NODE_BIN, str(ROOT / "dashboard" / "export-data.mjs")
                ], check=True, cwd=str(ROOT), capture_output=True, text=True)
                self._send_json(200, {"ok": True})
            except subprocess.CalledProcessError as e:
                self._send_json(500, {
                    "ok": False,
                    "error": (e.stderr or e.stdout or str(e)).strip()
                })
            return

        if parsed.path == "/api/set-status":
            q = parse_qs(parsed.query)
            date = (q.get("date") or [None])[0]
            status = (q.get("status") or [None])[0]

            if not date or not status or status not in {"green", "yellow", "red"}:
                self._send_json(400, {"ok": False, "error": "date and valid status required"})
                return

            db = ROOT / "gym531.db"
            sql = (
                "INSERT INTO recovery_status(session_date,pain_level,note) "
                f"VALUES('{date}','{status}','Set from dashboard') "
                "ON CONFLICT(session_date) DO UPDATE SET pain_level=excluded.pain_level;"
            )

            try:
                subprocess.run(["sqlite3", str(db), sql], check=True, cwd=str(ROOT), capture_output=True, text=True)
                subprocess.run([
                    NODE_BIN, str(ROOT / "dashboard" / "export-data.mjs")
                ], check=True, cwd=str(ROOT), capture_output=True, text=True)
                self._send_json(200, {"ok": True})
            except subprocess.CalledProcessError as e:
                self._send_json(500, {"ok": False, "error": (e.stderr or e.stdout or str(e)).strip()})
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving dashboard with refresh API on http://127.0.0.1:{PORT}")
    server.serve_forever()
