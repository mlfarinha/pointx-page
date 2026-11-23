// Consistency between two views (the paper's Fig. 4, live): two photographs of an ETH3D scene, a divider that wipes both from the
// photograph to a method's map, and a surface point marked in both views through the laser scan's correspondences, with the value
// every method gives it in each view. See assets/consistency/index.json (rgbxt/web/consistency.py).
import { fetchGz } from "./viewer.js";

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const root = document.getElementById("consistency-compare");
const SW = 384;                                           // the width at which the maps are read for the point's values
const FILL = 8;                                           // a point without a match takes its place from matches at most this many grid cells away

async function start() {
  const base = "assets/consistency/", manifest = await (await fetch(base + "index.json", { cache: "no-cache" })).json();
  const state = { item: manifest.cases[0], task: "albedo", method: manifest.ours, split: 0.5, at: null, fill: true, touched: false, token: 0, data: null, flow: null };
  const label = id => manifest.methods.find(m => m.id === id).label;

  // the two views
  const stage = el("div", "cons-stage");
  const panes = ["a", "b"].map((v, i) => {
    const f = el("figure", "cons-pane"); f.dataset.v = v;
    const photo = el("img", "photo"), map = el("img", "map"); photo.alt = `View ${i + 1}, the photograph`; map.alt = ""; photo.draggable = map.draggable = false;
    const mark = el("i", "mark"); mark.hidden = true;
    f.append(photo, map, el("span", "tag", `View ${i + 1}`), el("span", "tag right"), el("div", "handle", "<i></i>"), mark);
    stage.append(f);
    return { v, f, photo, map, mark, tag: f.querySelector(".tag.right") };
  });
  const readout = el("div", "cons-readout"); readout.setAttribute("aria-live", "polite");
  const note = el("p", "cons-note");
  const bar = el("div", "cmp-bar"), controls = el("div", "cmp-controls"); controls.append(bar);
  const chips = (title, items, current, onPick) => {
    const g = el("div", "chip-group"); g.setAttribute("role", "group"); g.setAttribute("aria-label", title); g.append(el("span", "chip-label", title));
    const row = el("div", "chips");
    items.forEach(it => {
      const b = el("button", "chip", it.label); b.type = "button"; b.setAttribute("aria-pressed", String(it.id === current));
      b.addEventListener("click", () => { row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(it.id); });
      row.append(b);
    });
    g.append(row); bar.append(g);
  };
  chips("Property", manifest.tasks, state.task, id => { state.task = id; show(); });
  chips("Maps of", manifest.methods, state.method, id => { state.method = id; paint(); });
  const fill = el("label", "check", '<input type="checkbox" checked>Fill small gaps between matches');
  fill.firstChild.addEventListener("change", e => { state.fill = e.target.checked; if (state.at) probe("a", ...state.at); });
  bar.append(fill);
  const thumbs = el("div", "scene-row"); thumbs.setAttribute("role", "group"); thumbs.setAttribute("aria-label", "Scenes");
  manifest.cases.forEach(item => {
    const b = el("button", "thumb", `<img src="${base}${item.id}/thumb.jpg" alt="" loading="lazy"><span>${item.title}</span>`); b.type = "button";
    b.setAttribute("aria-pressed", String(item === state.item)); b.setAttribute("aria-label", item.title);
    b.addEventListener("click", () => { state.item = item; state.at = null; thumbs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); show(); });
    thumbs.append(b);
  });
  root.append(stage, readout, note, controls, thumbs);

  // the maps of every method at a reading size, and the correspondences
  const pixels = url => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement("canvas"); c.width = SW; c.height = Math.round((SW * im.naturalHeight) / im.naturalWidth); const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, c.width, c.height); res(g.getImageData(0, 0, c.width, c.height)); };
    im.onerror = () => rej(new Error(url)); im.src = url;
  });
  const cache = new Map(), once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  async function show() {
    const token = ++state.token, item = state.item, dir = base + item.id + "/";
    stage.style.setProperty("--ar", item.aspect); stage.dataset.loading = "true";
    panes.forEach(p => { p.photo.src = `${dir}photo_${p.v}.webp`; });
    paint();
    const [flow, data] = await Promise.all([
      once(item.id, () => Promise.all(["ab", "ba"].map(n => fetchGz(`${dir}${n}.bin.gz`).then(b => new Uint16Array(b))))),
      once(item.id + state.task, () => Promise.all(manifest.methods.map(m => Promise.all(["a", "b"].map(v => pixels(`${dir}${state.task}_${m.id}_${v}.webp`)))))),
    ]);
    if (token !== state.token) return;
    state.flow = flow; state.data = data; delete stage.dataset.loading;
    probe("a", ...(state.at || item.point));
  }
  function paint() {
    const dir = base + state.item.id + "/", t = manifest.tasks.find(x => x.id === state.task);
    panes.forEach((p, i) => {
      p.map.src = `${dir}${state.task}_${state.method}_${p.v}.webp`; p.tag.textContent = `${label(state.method)} · ${t.label}`;
      p.map.alt = `${t.label} of view ${i + 1} by ${label(state.method)}, right of the divider`;
    });
  }

  // a surface point: where it is in the other view, and what every method says of it in both
  const read = (image, x, y) => {                          // the mean over a 5 x 5 window, as the paper's insets
    const w = image.width, h = image.height, cx = Math.round(x * w - 0.5), cy = Math.round(y * h - 0.5), s = [0, 0, 0]; let n = 0;
    for (let j = Math.max(0, cy - 2); j <= Math.min(h - 1, cy + 2); j++) for (let i = Math.max(0, cx - 2); i <= Math.min(w - 1, cx + 2); i++) { const k = 4 * (j * w + i); s[0] += image.data[k]; s[1] += image.data[k + 1]; s[2] += image.data[k + 2]; n++; }
    return s.map(v => v / n);
  };
  function probe(v, x, y) {
    if (!state.flow) return;
    const [gw, gh] = state.item.grid, f = state.flow[v === "a" ? 0 : 1];
    const gx = Math.min(gw - 1, Math.floor(x * gw)), gy = Math.min(gh - 1, Math.floor(y * gh)), k = 2 * (gy * gw + gx);
    let other = f[k] === 65535 ? null : [f[k] / 65534, f[k + 1] / 65534];
    if (!other && state.fill) {
      // The scan has no match in this cell (it has holes): the matches within FILL cells say where the point is. Each one's
      // displacement between the views, those that agree with the nearest one (a neighbour on another surface does not), nearer ones
      // counting more. Far from every match, or carried out of the other frame, the point has no place there.
      const near = [];
      for (let j = Math.max(0, gy - FILL); j <= Math.min(gh - 1, gy + FILL); j++) for (let i = Math.max(0, gx - FILL); i <= Math.min(gw - 1, gx + FILL); i++) {
        const q = 2 * (j * gw + i); if (f[q] === 65535) continue;
        const cx = (i + 0.5) / gw, cy = (j + 0.5) / gh, d = Math.hypot((cx - x) * gw, (cy - y) * gh);
        if (d <= FILL) near.push([d, f[q] / 65534 - cx, f[q + 1] / 65534 - cy]);
      }
      if (near.length) {
        const first = near.reduce((a, b) => (b[0] < a[0] ? b : a)); let sw = 0, sx = 0, sy = 0;
        near.forEach(([d, dx, dy]) => { if (Math.hypot(dx - first[1], dy - first[2]) < 0.03) { const w = 1 / (d * d + 0.25); sw += w; sx += w * dx; sy += w * dy; } });
        const p = [x + sx / sw, y + sy / sw];
        if (p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1) other = p;
      }
    }
    const pa = v === "a" ? [x, y] : other, pb = v === "a" ? other : [x, y];
    if (v === "a") state.at = [x, y];
    [pa, pb].forEach((p, i) => { const m = panes[i].mark; m.hidden = !p; if (p) { m.style.left = p[0] * 100 + "%"; m.style.top = p[1] * 100 + "%"; } });
    if (!pa || !pb) {
      note.textContent = `This point is not visible in view ${pa ? 2 : 1}: the laser scan finds no match for it there.`;
      readout.replaceChildren(); return;
    }
    const normal = state.task === "normal";
    readout.replaceChildren(...manifest.methods.map((m, i) => {
      const a = read(state.data[i][0], ...pa), b = read(state.data[i][1], ...pb);
      let diff;
      if (normal) {                                        // the colours are unit vectors: their angle
        const u = a.map(c => c / 127.5 - 1), w = b.map(c => c / 127.5 - 1), dot = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w));
        diff = ((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI).toFixed(1) + "°";
      } else diff = ((Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 765).toFixed(3);
      const rgb = c => `rgb(${c.map(Math.round).join(",")})`;
      return el("div", "cons-card" + (m.id === manifest.ours ? " ours" : ""),
        `<b>${m.label}</b><span class="pair"><i style="background:${rgb(a)}" title="view 1"></i><i style="background:${rgb(b)}" title="view 2"></i></span><span class="delta"><em>Δ</em>${diff}</span>`);
    }));
    note.innerHTML = `The marked surface point in both views: the value each method gives it in view 1 and in view 2, and their difference <span>(${normal ? "angle between the two normals" : "mean absolute difference of the displayed colours"})</span>.`;
  }

  // the divider wipes both views together; anywhere else the pointer moves the point
  const setSplit = x => { state.split = Math.min(1, Math.max(0, x)); stage.style.setProperty("--split", state.split * 100 + "%"); };
  panes.forEach(p => {
    let mode = null;
    const where = e => { const r = p.f.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
    p.f.addEventListener("pointerdown", e => {
      const [x, y] = where(e); state.touched = true;
      mode = Math.abs(x - state.split) < 0.05 ? "split" : "point"; p.f.setPointerCapture(e.pointerId);
      if (mode === "point") probe(p.v, x, y);
    });
    p.f.addEventListener("pointermove", e => {
      const [x, y] = where(e);
      if (mode === "split") setSplit(x);
      else if (mode === "point" || (e.pointerType === "mouse" && !e.buttons)) probe(p.v, x, y);
      p.f.style.cursor = Math.abs(x - state.split) < 0.05 ? "ew-resize" : "crosshair";
    });
    const end = () => { mode = null; };
    p.f.addEventListener("pointerup", end); p.f.addEventListener("pointercancel", end);
  });
  let visible = false, t0 = null;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sweep = now => {                                   // until it is touched, the divider travels: photographs in, maps out
    if (visible && !state.touched && !still) { t0 ??= now; setSplit(0.5 + 0.38 * Math.sin((now - t0) / 1700)); }
    if (!state.touched) requestAnimationFrame(sweep);
  };
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }).observe(stage);
  setSplit(0.5); requestAnimationFrame(sweep); show();
}

if (root) start().catch(error => { root.textContent = "The comparison could not be loaded."; console.error(error); });
