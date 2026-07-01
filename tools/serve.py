#!/usr/bin/env python3
"""Local preview server that mirrors Vercel's cleanUrls behaviour so the local
preview matches production: serves both /lunch and /lunch.html, / -> index.html,
and falls back to .html for extensionless paths. This avoids the 404s the plain
`python -m http.server` gives when the page navigates to clean URLs.

Usage:  python tools/serve.py [port]   (default 8080)
Then open http://127.0.0.1:<port>/
"""
import http.server, socketserver, os, sys
from urllib.parse import urlparse

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=SITE, **k)

    def translate_path(self, path):
        path = urlparse(path).path                 # drop ?query / #hash
        full = super().translate_path(path)
        if os.path.isdir(full):
            idx = os.path.join(full, "index.html")
            if os.path.exists(idx):
                return idx
        if not os.path.exists(full) and not path.endswith(".html"):
            if os.path.exists(full + ".html"):      # cleanUrls: /lunch -> lunch.html
                return full + ".html"
        return full

    def log_message(self, *a):
        pass

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"La Lasagna preview (clean URLs) -> http://127.0.0.1:{PORT}/")
    httpd.serve_forever()
