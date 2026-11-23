// Surface points (the paper's first experiment), in 3D: one cloud of ground-truth surface points, coloured by PointX on the left of
// a divider and by another method on the right. Baselines average their per-view maps at each point; PointX answers once.
import { SceneViewer, fetchGz } from "./viewer.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const stage = $("surface-stage");

async function start() {
  const base = "assets/surface/", manifest = await (await fetch(base + "index.json", { cache: "no-cache" })).json();
  const others = manifest.methods.filter(m => m.id !== manifest.ours), oursLabel = manifest.methods.find(m => m.id === manifest.ours).label;
  const state = { item: manifest.cases[0], task: manifest.cases[0].tasks[0], other: "mvinverse_linear", split: 0.5, token: 0 };
  const viewer = new SceneViewer(stage, { path: false, frustum: false });
  window.pointxSurface = viewer;
  viewer.controls.enableZoom = false;
  viewer.controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches; viewer.controls.autoRotateSpeed = 0.5;
  viewer.controls.addEventListener("start", () => { viewer.controls.autoRotate = false; });
  stage.addEventListener("pointerdown", () => { stage.dataset.touched = "true"; viewer.controls.enableZoom = true; });
  stage.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") viewer.controls.enableZoom = false; });
  const cache = new Map(), colours = (item, task, method) => {
    const key = `${item.id}/${task}_${method}`;
    if (!cache.has(key)) cache.set(key, fetchGz(`${base}${key}.bin.gz`).then(b => new Uint8Array(b)));
    return cache.get(key);
  };
  const load = $("surface-load"), bar = $("surface-load-bar"), text = $("surface-load-text");
  const tagOther = $("surface-tag-other"), divider = $("surface-divider"), knob = $("surface-knob"), range = $("surface-range");
  const setSplit = x => { state.split = Math.min(0.98, Math.max(0.02, x)); divider.style.left = state.split * 100 + "%"; range.value = String(state.split * 100); viewer.setSplit(state.split); };

  async function paint() {                                 // the colours of the chosen property: ours left, the other method right
    const token = ++state.token, item = state.item;
    tagOther.textContent = others.find(m => m.id === state.other).label;
    const [a, b] = await Promise.all([colours(item, state.task, manifest.ours), colours(item, state.task, state.other)]);
    if (token !== state.token || viewer.info?.id !== item.id) return;
    viewer.setCompare(a, b); setSplit(state.split);
  }
  async function show(item) {
    state.item = item; if (!item.tasks.includes(state.task)) state.task = item.tasks[0];
    thumbs.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === item.id)));
    taskRow.querySelectorAll("button").forEach(b => { b.hidden = !item.tasks.includes(b.dataset.id); b.setAttribute("aria-pressed", String(b.dataset.id === state.task)); });
    $("surface-poster").style.backgroundImage = `url("${base}${item.id}/thumb.jpg")`;
    stage.dataset.ready = "false"; load.dataset.done = "false"; bar.style.width = "0"; text.textContent = `Loading ${item.title}…`;
    try {
      const info = await viewer.load(`${base}${item.id}/`, p => { bar.style.width = Math.round(p * 100) + "%"; });
      if (!info) return;
      viewer.setReveal(false); viewer.uniforms.uCompare.value = 0;
      await paint();
      stage.dataset.ready = "true"; load.dataset.done = "true";
      $("surface-meta").innerHTML = `<span><b>${info.source}</b> · ${item.title}</span><span><b>${info.frames}</b> input views</span><span><b>${info.points.toLocaleString("en-US")}</b> surface points</span>`;
    } catch (error) { text.textContent = "This scene could not be loaded."; console.error(error); }
  }

  // controls: property and method chips, the divider, the scenes
  const chipRow = (label, items, current, onPick) => {
    const group = el("div", "chip-group"); group.setAttribute("role", "group"); group.setAttribute("aria-label", label); group.append(el("span", "chip-label", label));
    const row = el("div", "chips");
    items.forEach(it => {
      const b = el("button", "chip", it.label); b.type = "button"; b.dataset.id = it.id; b.setAttribute("aria-pressed", String(it.id === current));
      b.addEventListener("click", () => { row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(it.id); });
      row.append(b);
    });
    group.append(row); $("surface-bar").append(group); return row;
  };
  const taskRow = chipRow("Property", manifest.tasks, state.task, id => { state.task = id; paint(); });
  chipRow("Compare with", others, state.other, id => { state.other = id; paint(); });
  const thumbs = $("surface-scenes");
  manifest.cases.forEach(item => {
    const b = el("button", "thumb", `<img src="${base}${item.id}/thumb.jpg" alt="" loading="lazy"><em>${item.tag}</em><span>${item.title}</span>`); b.type = "button"; b.dataset.id = item.id;
    b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", `${item.title}, ${item.tag}`);
    b.addEventListener("click", () => show(item)); thumbs.append(b);
  });
  const drag = e => { const r = stage.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); };
  knob.addEventListener("pointerdown", e => { knob.setPointerCapture(e.pointerId); e.stopPropagation(); viewer.controls.autoRotate = false; });
  knob.addEventListener("pointermove", e => { if (knob.hasPointerCapture(e.pointerId)) drag(e); });
  range.addEventListener("input", () => setSplit(Number(range.value) / 100));
  $("surface-cull").addEventListener("click", e => { const b = e.currentTarget, on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); viewer.setCull(on); });
  $("surface-views").addEventListener("click", e => { const b = e.currentTarget, on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); viewer.setGizmos(on); });
  $("surface-reset").addEventListener("click", () => { viewer.home(); setSplit(0.5); });
  const wanted = new URLSearchParams(location.search).get("surface");
  show(manifest.cases.find(c => c.id === wanted) || manifest.cases[0]);
}

if (stage) {
  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    start().catch(error => { $("surface-load-text").textContent = "The comparison could not be loaded."; console.error(error); });
  }, { rootMargin: "500px" });
  io.observe(stage);
}
