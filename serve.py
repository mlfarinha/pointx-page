"""Preview server: `python3 serve.py [port] [name=folder ...]` in this folder, then http://localhost:8377; a `name=folder` serves
another folder under /name/ (the anonymous build: `anonymous=/mnt/localssd/pointx-supplementary/pointx_supplementary`).
Plain `python3 -m http.server` sends no cache headers, so a browser keeps running the scripts and manifests it loaded before an
edit (seen: the page reloaded, yet the old panels stayed). This one tells the browser to ask on every load; unchanged files
answer 304, so it costs nothing."""
import http.server
import sys


MOUNTS = dict(a.split("=", 1) for a in sys.argv[2:])


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        name, _, rest = path.lstrip("/").partition("/")
        if name in MOUNTS:
            self.directory, path = MOUNTS[name], "/" + rest
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8377), Handler).serve_forever()
