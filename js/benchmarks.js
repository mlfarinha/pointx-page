// The Benchmarks section, drawn from benchmarks-data.js: an accuracy-against-consistency overview, the more-views curves,
// and per-table bar charts with the full tables. Plain SVG and HTML, no chart library.
import { METHODS, TABLES, TRADEOFF, VIEWS } from "./benchmarks-data.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const arrow = d => (d === "up" ? "↑" : "↓");
const fmt = (v, metric) => v.toFixed(metric.digits);
const kind = id => METHODS[id].kind || "baseline";
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const seg = (items, current, onPick, label) => {
  const g = el("div", "bm-seg"); g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
  items.forEach(it => {
    const b = el("button", "", esc(it.label)); b.type = "button"; b.setAttribute("aria-pressed", String(it.id === current));
    b.addEventListener("click", () => { g.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(it.id); });
    g.append(b);
  });
  return g;
};

/* ------------------------------------------------------------------ accuracy against consistency */
function tradeoff(root) {
  const state = { property: "albedo", dataset: "interiorverse" };
  const head = el("div", "bm-toolbar");
  head.append(seg(TRADEOFF.properties, state.property, id => { state.property = id; draw(); }, "Property"),
    seg(TRADEOFF.datasets, state.dataset, id => { state.dataset = id; draw(); }, "Accuracy measured on"));
  const plot = el("div", "bm-plot"), tip = el("div", "bm-tip"); tip.hidden = true;
  root.append(head, plot);
  function draw() {
    const P = TRADEOFF.properties.find(p => p.id === state.property), pi = state.property === "albedo" ? 0 : 1;
    const pts = TRADEOFF.points.map(([id, images, ax, nx, acc, seen]) => ({ id, images, x: pi ? nx : ax, y: acc[state.dataset][pi], seen: seen === state.dataset }))
      .filter(p => p.x != null && p.y != null);
    const W = 760, H = 450, L = 66, R = 24, T = 26, B = 58;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const nice = (lo, hi) => { const span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / 4))) * (span / Math.pow(10, Math.floor(Math.log10(span / 4))) / 4 > 2.5 ? 5 : span / Math.pow(10, Math.floor(Math.log10(span / 4))) / 4 > 1.2 ? 2 : 1); return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step]; };
    const [x0, x1, xstep] = nice(0, Math.max(...xs) * 1.08), [y0, y1, ystep] = nice(Math.min(...ys) - (Math.max(...ys) - Math.min(...ys)) * 0.1, Math.max(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.08);
    const X = v => W - R - ((v - x0) / (x1 - x0)) * (W - L - R);                                 // disagreement falls to the right: better is up and right
    const Y = v => (P.y.dir === "up" ? H - B - ((v - y0) / (y1 - y0)) * (H - T - B) : T + ((v - y0) / (y1 - y0)) * (H - T - B));   // better is always up
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(P.y.label)} against ${esc(P.x.label)}, one point per method"><title>${esc(P.label)}: accuracy against consistency</title>`;
    for (let v = x0; v <= x1 + 1e-9; v += xstep) s += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}"/><text class="tick" x="${X(v)}" y="${H - B + 20}" text-anchor="middle">${(+v.toFixed(3)).toString()}</text>`;
    for (let v = y0; v <= y1 + 1e-9; v += ystep) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${L - 9}" y="${Y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
    s += `<text class="axis" x="${(L + W - R) / 2}" y="${H - 10}" text-anchor="middle">${esc(P.x.label)}  →  more consistent</text>`;
    s += `<text class="axis" transform="translate(16 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(P.y.label)}${P.y.unit ? " (" + P.y.unit + ")" : ""}  →  more accurate</text>`;
    s += `<text class="better" x="${W - R - 12}" y="${T + 18}" text-anchor="end">better ↗</text>`;
    // labels: the first of right / left / above / below that touches no other label and no other point
    const boxes = pts.map(p => ({ x0: X(p.x) - 9, x1: X(p.x) + 9, y0: Y(p.y) - 9, y1: Y(p.y) + 9 }));
    const hits = b => boxes.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) || b.x0 < L || b.x1 > W - R || b.y0 < T;
    pts.slice().sort((a, b) => (kind(b.id) === "ours") - (kind(a.id) === "ours")).forEach(p => {
      const cx = X(p.x), cy = Y(p.y), ours = kind(p.id) === "ours", label = METHODS[p.id].label + (p.seen ? " †" : ""), w = label.length * (ours ? 8.4 : 7.6), h = 17, r = ours ? 13 : 10;
      const options = [[cx + r, cy - h / 2, "start", cx + r], [cx - r - w, cy - h / 2, "end", cx - r], [cx - w / 2, cy - r - h, "middle", cx], [cx - w / 2, cy + r, "middle", cx],
        [cx + r, cy - h - 2, "start", cx + r], [cx + r, cy + 4, "start", cx + r], [cx - r - w, cy - h - 2, "end", cx - r], [cx - r - w, cy + 4, "end", cx - r]];
      const own = boxes.findIndex(q => q.x0 === cx - 9 && q.y0 === cy - 9), saved = boxes.splice(own, 1)[0];
      const pick = options.find(([x, y]) => !hits({ x0: x, x1: x + w, y0: y, y1: y + h })) || options[0];
      boxes.push(saved, { x0: pick[0], x1: pick[0] + w, y0: pick[1], y1: pick[1] + h });
      s += `<g class="pt ${ours ? "ours" : ""} ${p.seen ? "seen" : ""}" tabindex="0" data-id="${p.id}" data-x="${p.x}" data-y="${p.y}" data-images="${p.images}">` +
        `<circle cx="${cx}" cy="${cy}" r="${ours ? 9 : 6.5}"/><text x="${pick[3]}" y="${pick[1] + 13}" text-anchor="${pick[2]}">${esc(label)}</text></g>`;
    });
    plot.innerHTML = s + "</svg>"; plot.append(tip);
    plot.querySelectorAll(".pt").forEach(g => {
      const show = () => {
        const d = g.dataset, c = g.querySelector("circle"), box = plot.getBoundingClientRect(), r = c.getBoundingClientRect();
        tip.innerHTML = `<b>${esc(METHODS[d.id].label)}</b><span>${METHODS[d.id].group || "Multi-view, per surface point"} · ${d.images === "1" ? "one image" : "several images"}</span>` +
          `<div><i>${esc(P.y.label)}</i>${fmt(+d.y, P.y)}${P.y.unit === "dB" ? " dB" : P.y.unit}</div><div><i>Disagreement</i>${fmt(+d.x, P.x)}${P.x.unit}</div>`;
        tip.hidden = false; tip.style.left = r.left - box.left + r.width / 2 + "px"; tip.style.top = r.top - box.top - 8 + "px";
      };
      g.addEventListener("pointerenter", show); g.addEventListener("focus", show);
      g.addEventListener("pointerleave", () => { tip.hidden = true; }); g.addEventListener("blur", () => { tip.hidden = true; });
    });
  }
  draw();
}

/* ------------------------------------------------------------------ more views */
function views(root) {
  const W = 250, H = 190, L = 36, R = 10, T = 30, B = 30, top = 20;
  const X = i => L + (i / (VIEWS.n.length - 1)) * (W - L - R), Y = v => H - B - (v / top) * (H - T - B);
  const gain = a => a.map(v => ((a[0] - v) / a[0]) * 100);
  const line = (a, cls) => `<path class="ln ${cls}" d="${a.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join("")}"/>` + a.map((v, i) => `<circle class="dot ${cls}" cx="${X(i)}" cy="${Y(v)}" r="3"><title>${v.toFixed(1)} %</title></circle>`).join("");
  root.innerHTML = VIEWS.panels.map(p => {
    let s = `<figure class="bm-mini"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${p.label}: error reduction with 1, 2, 4 and 8 images"><text class="ttl" x="${L}" y="16">${p.label}</text>`;
    for (const v of [0, 10, 20]) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${L - 7}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
    VIEWS.n.forEach((n, i) => { s += `<text class="tick" x="${X(i)}" y="${H - B + 17}" text-anchor="middle">${n}</text>`; });
    s += line(gain(p.mvi), "mvi") + line(gain(p.nopool), "nopool") + line(gain(p.ours), "ours");
    s += `<text class="val ours" x="${X(3) - 4}" y="${Y(gain(p.ours)[3]) - 9}" text-anchor="end">−${gain(p.ours)[3].toFixed(1)} %</text><text class="val" x="${X(3) - 4}" y="${Y(gain(p.mvi)[3]) - 8}" text-anchor="end">−${gain(p.mvi)[3].toFixed(1)} %</text>`;
    return s + "</svg></figure>";
  }).join("") + `<p class="bm-keys"><span><i class="k ours"></i>PointX (Ours)</span><span><i class="k nopool"></i>PointX w/o pooling</span><span><i class="k mvi"></i>MVInverse</span><span class="ax">x: input images · y: error reduction relative to one image (%)</span></p>`;
}

/* ------------------------------------------------------------------ the tables */
function ranks(block, rows) {                               // per column: 1, 2, 3 for the best ranked values (ties share a rank)
  const skip = r => r[2] === "seen" || kind(r[0]) === "ref" || (!block.rankAll && kind(r[0]) === "variant");
  return block.metrics.map((mt, c) => {
    const vals = [...new Set(rows.filter(r => !skip(r) && r[1][c] != null && !(r[2] === "zero" && r[1][c] === 0)).map(r => r[1][c]))].sort((a, b) => (mt.dir === "up" ? b - a : a - b));
    return r => { const i = skip(r) ? -1 : vals.indexOf(r[1][c]); return i >= 0 && i < 3 ? i + 1 : 0; };
  });
}
function bars(block, rows) {
  let off = 0;
  return block.groups.map(([title, count]) => {
    const start = off; off += count;
    const cards = block.metrics.slice(start, start + count).map((mt, k) => {
      const c = start + k;
      const shown = rows.filter(r => r[1][c] != null && METHODS[r[0]].chart !== false).map(r => ({ id: r[0], v: r[1][c], flag: r[2] }))
        .sort((a, b) => (mt.dir === "up" ? b.v - a.v : a.v - b.v));
      const max = Math.max(...shown.map(r => r.v));
      return `<figure class="bm-card"><figcaption>${esc(mt.label)} <span>${arrow(mt.dir)}</span></figcaption><ol>` + shown.map(r => {
        const zero = r.flag === "zero" && r.v === 0, cls = [kind(r.id), r.flag === "seen" ? "seen" : "", zero ? "zero" : ""].join(" ");
        return `<li class="${cls}"><span class="name" title="${esc(METHODS[r.id].label)}">${esc(METHODS[r.id].short || METHODS[r.id].label)}${r.flag === "seen" ? " †" : ""}</span>` +
          `<span class="track"><i style="width:${zero ? 0 : Math.max(1.5, (r.v / max) * 100)}%"></i></span><span class="num">${zero ? "0 by construction" : fmt(r.v, mt)}</span></li>`;
      }).join("") + "</ol></figure>";
    }).join("");
    return `<h4 class="bm-group">${esc(title)}</h4><div class="bm-cards" data-n="${count}">${cards}</div>`;
  }).join("");
}
function table(block, rows) {
  const rk = ranks(block, rows);
  const groupRow = block.groups.map(([t, n]) => `<th colspan="${n}" scope="colgroup">${esc(t)}</th>`).join("");
  const head = block.metrics.map(mt => `<th scope="col">${esc(mt.label)} ${arrow(mt.dir)}</th>`).join("");
  const body = rows.map(r => {
    const k = kind(r[0]), cells = r[1].map((v, c) => {
      if (v == null) return `<td class="na">–</td>`;
      if (r[2] === "zero" && v === 0) return `<td class="zero">0</td>`;
      const rank = rk[c](r);
      return `<td class="${rank ? "r" + rank : ""}">${fmt(v, block.metrics[c])}</td>`;
    }).join("");
    return `<tr class="${k} ${r[2] === "seen" ? "seen" : ""}"><th scope="row">${esc(METHODS[r[0]].label)}${r[2] === "seen" ? " †" : ""}</th>${cells}</tr>`;
  }).join("");
  return `<div class="bm-table-wrap"><table class="bm-table"><thead><tr><th rowspan="2" scope="col">Method</th>${groupRow}</tr><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function tables(root) {
  const state = { table: TABLES[0].id, block: {}, setting: 0 };
  const tabs = el("div", "bm-tabs"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Benchmark");
  const panel = el("div", "bm-panel"); panel.setAttribute("role", "tabpanel");
  TABLES.forEach(t => {
    const b = el("button", "", `${esc(t.tab)}<small>${esc(t.table)}</small>`); b.type = "button"; b.setAttribute("role", "tab"); b.id = "bm-tab-" + t.id;
    b.addEventListener("click", () => { state.table = t.id; draw(); });
    b.addEventListener("keydown", e => {
      const i = TABLES.indexOf(t), j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
      if (j >= 0 && j < TABLES.length) { e.preventDefault(); tabs.children[j].focus(); tabs.children[j].click(); }
    });
    tabs.append(b);
  });
  root.append(tabs, panel);
  function draw() {
    const t = TABLES.find(x => x.id === state.table);
    [...tabs.children].forEach((b, i) => { const on = TABLES[i] === t; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute("aria-labelledby", "bm-tab-" + t.id);
    const bid = state.block[t.id] || t.blocks[0].id, block = t.blocks.find(b => b.id === bid);
    const rows = t.settings ? block.rows[state.setting] : block.rows;
    panel.innerHTML = `<p class="bm-lede">${esc(t.lede)}</p>`;
    const bar = el("div", "bm-toolbar");
    if (t.blocks.length > 1) bar.append(seg(t.blocks, bid, id => { state.block[t.id] = id; draw(); }, "Dataset"));
    if (t.settings) bar.append(seg(t.settings.map((label, id) => ({ id, label })), state.setting, id => { state.setting = id; draw(); }, "Input"));
    if (bar.children.length) panel.append(bar);
    panel.append(el("div", "bm-charts", bars(block, rows)));
    panel.append(el("p", "bm-note", `↑ higher is better, ↓ lower is better. Bars start at zero and are sorted from best to worst; every chart has its own scale. ${esc(t.note)}`));
    const det = el("details", "bm-details", `<summary>${esc(t.table)} in full · ${esc(block.label)}${t.settings ? " · " + esc(t.settings[state.setting]) : ""}</summary>${table(block, rows)}` +
      `<p class="bm-note">Best, second and third best of the ranked methods are shaded. Values as printed in the paper.</p>`);
    panel.append(det);
  }
  draw();
}

const T = document.getElementById("bm-tradeoff"), V = document.getElementById("bm-views"), B = document.getElementById("bm-tables");
if (T) tradeoff(T);
if (V) views(V);
if (B) tables(B);
