"""The ANONYMOUS, self-contained copy of this page for a submission's supplementary material:
    python3 build_supplementary.py [--out DIR] [--scenes id ...] [--surface id ...] [--clips id ...] [--consistency id ...]
-> DIR/pointx_supplementary/index.html (+ assets/), which opens by double-click, and DIR/pointx_supplementary.zip.
With --single: ONE file, DIR/pointx_supplementary.html (+ DIR/pointx_supplementary_single.zip), every asset inside it.

Anonymous: no authors, affiliations, paper / arXiv / code buttons, BibTeX, links out, visitor counter or social-media tags, and no footer naming the
data's sources or Depth Pro 2 (the first panel says "estimated depth"); the build FAILS if a word of LEAKS is found in any text it
ships.

Opens from the disk (file://), where a browser loads neither module files nor fetch() requests, and treats a local picture as
foreign (no pixel readback, no WebGL texture):
  - the stylesheet, the fonts and every script are inside index.html (the imported modules as data: URLs of the import map);
  - the manifests are inside index.html; the files the scripts decode or read back (*.bin.gz, the viewers' frame sheets, the
    two-view maps) ship as <file>.js, base64 inside a call, and a small shim at the top of the page hands them to fetch() and
    to <img>.src. In the zip the base64 costs almost nothing: it deflates back to the file's size.
  - videos and the remaining pictures are plain files.
The "all maps" videos only (the per-property videos of the slider view are four times their size).

Size: CVPR takes ONE zip of at most 200 MB, and the supplementary PDF goes into it beside this folder. --max-mb (default 150, which
leaves 50 MB for the PDF) is the archive's limit: while it is over, the LAST entry of the largest of the three heavy lists (video
clips, 3D scenes, surface comparisons; the manifests' order is the order of preference) is dropped. --scenes / --surface / --clips /
--consistency name what to keep instead. The page's own scripts are not edited: change the site, rebuild.

--single: every file is a block of base64 at the end of the page (an inert <script>, parsed but never run); the shim turns a block
into a blob: URL the first time its address is used -- by fetch(), by an <img> or <video> src, in markup a script writes, in a
background picture. A blob: URL belongs to the page, so nothing is foreign any more. The price: a file of about 190 MB that a
browser reads in full before the panels start (2.5 s on the build machine), and that stays in memory."""
import argparse
import base64
import json
import os
import re
import shutil
import zipfile

SITE = os.path.dirname(os.path.abspath(__file__))
LEAKS = ["farinha", "sartor", "georgiev", "vecchio", "ronald", "fischer", "adobe", "oxford", "internship", "mfischer", "samsartor", "iliyan", "ronnie",
         "github.io", "arxiv", "localssd", "colligo", "phidias", "@gmail", "depth pro", "depthpro"]
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="/mnt/localssd/pointx-supplementary")
for name in ("scenes", "surface", "clips", "consistency"):
    ap.add_argument("--" + name, nargs="*", default=None, help="ids to keep (default: all)")
ap.add_argument("--max-mb", type=float, default=150.0, help="the archive's size limit (0 = none)")
ap.add_argument("--single", action="store_true", help="one HTML file with every asset inside, instead of index.html + assets/")
args = ap.parse_args()
OUT = os.path.join(args.out, "pointx_supplementary")
if not args.single:
    shutil.rmtree(OUT, ignore_errors=True)
read = lambda p, mode="r": open(os.path.join(SITE, p), mode).read()
b64 = lambda data: base64.b64encode(data).decode()


def once(s, pattern, to, flags=re.S):
    out, n = re.subn(pattern, to, s, flags=flags)
    assert n == 1, f"{n} matches of {pattern[:60]!r}: the page changed, update build_supplementary.py"
    return out


embedded = []
def ship(path):                                                    # a plain file (--single: a block of the page)
    if args.single:
        return embedded.append(path)
    os.makedirs(os.path.dirname(os.path.join(OUT, path)), exist_ok=True)
    shutil.copyfile(os.path.join(SITE, path), os.path.join(OUT, path))


# ---------------------------------------------------------------------------------------------- what fits
ids = lambda path, key: [r["id"] for r in (json.loads(read(path)) if key is None else json.loads(read(path))[key])]
folder = lambda d: sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(os.path.join(SITE, d)) for f in fs) / 1e6
heavy = {"clips": [(i, os.path.getsize(os.path.join(SITE, f"assets/videos/{i}/grid.mp4")) / 1e6) for i in args.clips or ids("assets/videos/index.json", "clips")],
         "scenes": [(i, folder(f"assets/scenes/{i}")) for i in args.scenes or ids("assets/scenes/index.json", None)],
         "surface": [(i, folder(f"assets/surface/{i}")) for i in args.surface or ids("assets/surface/index.json", "cases")]}
rest = folder("assets/relight") + folder("assets/apps") + folder("assets/method") + 2.0 + sum(folder(f"assets/consistency/{i}") for i in args.consistency or ids("assets/consistency/index.json", "cases"))
total = lambda: rest + 1.02 * sum(mb for rows in heavy.values() for _, mb in rows)      # in the zip a wrapped file is about its own size
dropped = []
while args.max_mb and total() > args.max_mb:
    name = max((n for n in heavy if len(heavy[n]) > 2), key=lambda n: sum(mb for _, mb in heavy[n]))
    dropped.append(f"{name}:{heavy[name].pop()[0]}")
args.clips, args.scenes, args.surface = ([i for i, _ in heavy[n]] for n in ("clips", "scenes", "surface"))

wrapped = []
def wrap(path):                                                    # a file the scripts read: <file>.js, handed over by the shim
    if args.single:
        return embedded.append(path)
    os.makedirs(os.path.dirname(os.path.join(OUT, path)), exist_ok=True)
    open(os.path.join(OUT, path + ".js"), "w").write(f'__supp({json.dumps(path)},"{b64(read(path, "rb"))}")')
    wrapped.append(path)


# ---------------------------------------------------------------------------------------------- the data
data = {}                                                          # manifests, by the address the scripts ask for
def manifest(path, key, keep):
    m = json.loads(read(path))
    rows = m if key is None else m[key]
    rows = [r for r in rows if keep is None or r["id"] in keep]
    assert rows and (keep is None or len(rows) == len(keep)), f"{path}: unknown id in {keep}"
    data[path] = rows if key is None else {**m, key: rows}
    return rows

for s in manifest("assets/scenes/index.json", None, args.scenes):
    d = f"assets/scenes/{s['id']}/"
    data[d + "scene.json"] = json.loads(read(d + "scene.json")); ship(d + "thumb.jpg"); wrap(d + "points.bin.gz"); wrap(d + data[d + "scene.json"]["sprite"]["file"])
    assert "Depth Pro 2 depth" in data[d + "scene.json"]["geometry"]
    data[d + "scene.json"]["geometry"] = data[d + "scene.json"]["geometry"].replace("Depth Pro 2 depth", "estimated depth")     # the facts line of the first panel
for c in manifest("assets/surface/index.json", "cases", args.surface):
    d = f"assets/surface/{c['id']}/"
    data[d + "scene.json"] = json.loads(read(d + "scene.json")); ship(d + "thumb.jpg"); wrap(d + data[d + "scene.json"]["sprite"]["file"])
    for f in sorted(os.listdir(os.path.join(SITE, d))):
        if f.endswith(".bin.gz"):
            wrap(d + f)
for c in manifest("assets/consistency/index.json", "cases", args.consistency):
    d = f"assets/consistency/{c['id']}/"
    for f in sorted(os.listdir(os.path.join(SITE, d))):
        ship(d + f) if f == "thumb.jpg" else wrap(d + f)             # the page reads the maps' pixels under the pointer
for c in manifest("assets/videos/index.json", "clips", args.clips):
    ship(f"assets/videos/{c['id']}/grid.mp4"); ship(f"assets/videos/{c['id']}/thumb.jpg")
data["assets/videos/index.json"]["slider"] = False
for s in manifest("assets/relight/index.json", "scenes", None):
    for f in os.listdir(os.path.join(SITE, "assets/relight", s["id"])):
        ship(f"assets/relight/{s['id']}/{f}")
for d in ("assets/apps", "assets/method"):
    for root, _, files in os.walk(os.path.join(SITE, d)):
        for f in files:
            ship(os.path.relpath(os.path.join(root, f), SITE))
ship("assets/favicon.svg")

# ---------------------------------------------------------------------------------------------- the page
html = read("index.html")
html = once(html, r'<meta name="description".*?<title>', "<title>")                              # description, social-media tags, the page's address
html = once(html, r'<link rel="preload"[^>]*>\n', "")
html = once(html, r"<!-- \?v=N.*?-->\n", "")
html = once(html, r'<a href="#bibtex">BibTeX</a>', "")
html = once(html, r'  <!-- At release.*?<a class="navpaper"[^>]*>Cite</a>\n', "")
html = once(html, r'<p class="authors">.*?(?=<p class="tldr">)', '<p class="affil"><span>Supplementary material</span></p>\n  ')
html = once(html, r'<section id="bibtex".*?</section>\n', "")
html = once(html, r" Every map of every method plays side by side; switch to the slider to compare PointX with one baseline under a divider\.", " Every map of every method plays side by side.")
html = once(html, r"  <p>Scenes shown on this page come from.*?</p>\n", "")                         # the footer's sources (and the page's only links out)
html = once(html, r"<!-- Visitor counter.*?-->\n[^\n]*data-goatcounter[^\n]*\n", "")                # no counter, switched on or not: a reviewer's visit is not recorded

css = read("css/site.css")
for font in ("Geist-Variable.woff2", "GeistMono-Variable.woff2"):
    css = once(css, re.escape(f'url("../fonts/{font}")'), f'url("data:font/woff2;base64,{b64(read("fonts/" + font, "rb"))}")')
html = once(html, r'<link rel="stylesheet" href="css/site\.css\?v=\d+">', lambda m: "<style>\n" + css + "</style>")

# the scripts: imported modules under bare names (a data: URL has no folder to resolve "./x.js" against), the entries inline
NAMES = {'"./compare.js"': '"pointx/compare"', '"./viewer.js"': '"pointx/viewer"', '"./benchmarks-data.js"': '"pointx/benchmarks-data"', '"../vendor/OrbitControls.js"': '"pointx/OrbitControls"'}
def module(path):
    s = read(path)
    for a, b in NAMES.items():
        s = s.replace("from " + a, "from " + b)
    assert not re.search(r"""from\s*["']\.\.?/""", s) and "</script" not in s, path
    if args.single:                                                # a background picture goes through the shim (it cannot hook the real property in every browser)
        s, n = re.subn(r"\.style\.backgroundImage = ", ".style.suppBackground = ", s)
        backgrounds.append(n)
    return s

backgrounds = []

imports = {"three": "vendor/three.module.min.js", "pointx/OrbitControls": "vendor/OrbitControls.js", "pointx/compare": "js/compare.js", "pointx/viewer": "js/viewer.js",
           "pointx/benchmarks-data": "js/benchmarks-data.js"}
importmap = json.dumps({"imports": {k: "data:text/javascript;base64," + b64(module(p).encode()) for k, p in imports.items()}})
SHIM = """<script>
// The page opened from the disk: fetch() of the manifests and of the wrapped files, and <img>.src of the wrapped pictures, served from the page's own files.
(() => {
  const json = %s, wrapped = new Set(%s), pending = new Map();
  window.__supp = (path, base64) => pending.get(path).got(base64);
  const load = path => {
    if (!pending.has(path)) {
      const p = { }; p.promise = new Promise((res, rej) => { p.got = res; const s = document.createElement("script"); s.src = path + ".js"; s.onerror = () => rej(new Error(path)); s.onload = () => s.remove(); document.head.append(s); });
      p.promise.then(() => pending.delete(path), () => pending.delete(path)); pending.set(path, p);
    }
    return pending.get(path).promise;
  };
  const key = url => String(url).split("?")[0].replace(/^\\.\\//, ""), real = window.fetch.bind(window);
  window.fetch = async (url, options) => {
    const k = key(url);
    if (k in json) return new Response(JSON.stringify(json[k]), { headers: { "Content-Type": "application/json" } });
    if (!wrapped.has(k)) return real(url, options);
    const text = atob(await load(k)), bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return new Response(bytes, { headers: { "Content-Length": String(bytes.length) } });
  };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", { configurable: true, enumerable: true, get() { return src.get.call(this); },
    set(value) {
      const k = key(value); this.__wanted = k;                       // the last address asked for wins, whatever arrives first
      if (!wrapped.has(k)) return src.set.call(this, value);
      load(k).then(b => { if (this.__wanted === k) src.set.call(this, "data:image/" + k.split(".").pop() + ";base64," + b); }, () => this.dispatchEvent(new Event("error")));
    } });
})();
</script>
""" % (json.dumps(data, separators=(",", ":")).replace("</", "<\\/"), json.dumps(wrapped))
if args.single:
    SHIM = """<script>
// One file: every asset is a block of base64 at the end of this page. An address of the page becomes a blob: URL of its block, decoded the first time it is used.
(() => {
  const json = %s, urls = new Map(), TYPES = { mp4: "video/mp4", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", gz: "application/gzip" };
  const key = url => String(url).split("?")[0].replace(/^\\.\\//, "");
  let blocks = null;
  const asset = url => {
    const k = key(url);
    if (urls.has(k)) return urls.get(k);
    blocks ??= new Map([...document.querySelectorAll("script[data-asset]")].map(s => [s.dataset.asset, s]));
    const block = blocks.get(k);
    if (!block) return url;
    const text = atob(block.textContent), bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    block.remove(); blocks.delete(k);
    urls.set(k, URL.createObjectURL(new Blob([bytes], { type: TYPES[k.split(".").pop()] || "" })));
    return urls.get(k);
  };
  const real = window.fetch.bind(window);
  window.fetch = async (url, options) => (key(url) in json ? new Response(JSON.stringify(json[key(url)]), { headers: { "Content-Type": "application/json" } }) : real(asset(url)));
  for (const proto of [HTMLImageElement.prototype, HTMLMediaElement.prototype]) {
    const src = Object.getOwnPropertyDescriptor(proto, "src");
    Object.defineProperty(proto, "src", { configurable: true, enumerable: true, get() { return src.get.call(this); }, set(value) { src.set.call(this, asset(value)); } });
  }
  const inner = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  Object.defineProperty(Element.prototype, "innerHTML", { configurable: true, enumerable: true, get() { return inner.get.call(this); },
    set(value) { inner.set.call(this, String(value).replace(/src="(assets\\/[^"]+)"/g, (m, path) => 'src="' + asset(path) + '"')); } });
  Object.defineProperty(CSSStyleDeclaration.prototype, "suppBackground", { configurable: true, set(value) { this.backgroundImage = String(value).replace(/url\\("(assets\\/[^"]+)"\\)/g, (m, path) => 'url("' + asset(path) + '")'); } });
  addEventListener("DOMContentLoaded", () => {                     // the pictures and links of the page's own markup
    document.querySelectorAll("[data-asset-src]").forEach(e => { e.src = e.dataset.assetSrc; });
    document.querySelectorAll('a[href^="assets/"]').forEach(a => { a.href = asset(a.getAttribute("href")); });
  });
})();
</script>
""" % json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    html, n = re.subn(r' src="(assets/[^"]+)"', r' data-asset-src="\1"', html)
    assert n == 8, n
    html = once(html, r'href="assets/favicon\.svg"', 'href="data:image/svg+xml;base64,' + b64(read("assets/favicon.svg", "rb")) + '"')
html = once(html, r'<script type="importmap">.*?</script>\n', lambda m: SHIM + '<script type="importmap">' + importmap + "</script>\n")
html, n = re.subn(r'<script type="module" src="(js/\w+\.js)\?v=\d+"></script>', lambda m: f'<script type="module">\n{module(m.group(1))}</script>', html)
assert n == 7, n
assert not re.search(r"""(href|src)=["']https?:""", html), "a link out is left"
assert not any(t in html for t in ('id="bibtex"', 'id="citation"', 'class="authors"', 'class="pill', 'class="navpaper"')), "the citation, the authors or the buttons are still in the page"
if args.single:
    assert sum(backgrounds) == 2, backgrounds                      # (each module is read once for the import map or the page)
    PAGE = os.path.join(args.out, "pointx_supplementary.html")
    with open(PAGE, "w") as f:
        head, tail = html.rsplit("</body>", 1)
        f.write(head)
        for p in embedded:
            f.write(f'<script type="application/octet-stream" data-asset="{p}">{b64(read(p, "rb"))}</script>\n')
        f.write("</body>" + tail)
else:
    PAGE = os.path.join(OUT, "index.html")
    open(PAGE, "w").write(html)

# ---------------------------------------------------------------------------------------------- checks, the archive
texts = {p: json.dumps(v).lower() for p, v in data.items()} | {p: read(p).lower() for p in embedded if p.endswith(".svg")}
texts |= {p: module(p).lower() for p in imports.values() if p.startswith("js/")}                  # the page's own modules inside the import map (base64 there)
for dp, _, files in os.walk(OUT if not args.single else os.devnull):
    for f in files:
        if f.endswith((".svg", ".json", ".txt")):
            texts[f] = open(os.path.join(dp, f)).read().lower()
plain = re.sub(r"data:[a-z/+-]+;base64,[a-z0-9+/=]+", "", html.lower())                            # base64 holds any short word by chance
found = sorted({w for w in LEAKS for t in [plain, *texts.values()] if w in t})
assert not found, f"identifying text in the build: {found}"
# ... nor in a picture's or a video's metadata (the point data is left out: megabytes of bytes spell any short word somewhere)
media = [p for p in wrapped + embedded if not p.endswith(".gz")] + ([] if args.single else [os.path.relpath(os.path.join(dp, f), OUT) for dp, _, fs in os.walk(OUT) for f in fs if not f.endswith((".js", ".html"))])
tagged = sorted({(p, w) for p in media for raw in [read(p, "rb").lower()] for w in LEAKS + ["miguel"] if w.encode() in raw})
assert not tagged, f"identifying bytes in {tagged[:5]}"
zpath = os.path.join(args.out, "pointx_supplementary_single.zip" if args.single else "pointx_supplementary.zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    if args.single:
        z.write(PAGE, os.path.basename(PAGE))
    for dp, _, files in sorted(os.walk(OUT if not args.single else os.devnull)):
        for f in sorted(files):
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, args.out), zipfile.ZIP_DEFLATED if f.endswith((".js", ".html", ".svg")) else zipfile.ZIP_STORED)
assert not args.max_mb or os.path.getsize(zpath) / 1e6 <= args.max_mb, "the archive is over --max-mb"
print("kept:", {n: [i for i, _ in rows] for n, rows in heavy.items()}, "| dropped to fit:", dropped or "nothing")
print(f"{PAGE}: {os.path.getsize(PAGE) / 1e6:.1f} MB; {zpath}: {os.path.getsize(zpath) / 1e6:.0f} MB; {len(wrapped) + len(embedded)} wrapped or embedded files, no identifying text in the page or in {len(media)} media files")
