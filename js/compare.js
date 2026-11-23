// Side-by-side comparisons with a slider: the input on the left, PointX against a chosen baseline on the right.
// Used for the DL3DV videos (one grid video per clip and property, see assets/videos/index.json) and for still renders.
// The videos have a second view, "all maps": every method's every map at once, from one video per clip (<clip>/grid.mp4).

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const ICON = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.6v10.8a.6.6 0 0 0 .92.5l8.3-5.4a.6.6 0 0 0 0-1L5.42 2.1a.6.6 0 0 0-.92.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.4" y="2.4" width="3.2" height="11.2" rx=".9"/><rect x="9.4" y="2.4" width="3.2" height="11.2" rx=".9"/></svg>',
};

function chips(parent, label, items, onPick, initial) {
  const group = el("div", "chip-group"); group.setAttribute("role", "group"); group.setAttribute("aria-label", label);
  group.append(el("span", "chip-label", label));
  const row = el("div", "chips");
  items.forEach(item => {
    const b = el("button", "chip", item.label); b.type = "button"; b.dataset.id = item.id; b.setAttribute("aria-pressed", String(item.id === initial));
    b.addEventListener("click", () => { row.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(item.id); });
    row.append(b);
  });
  group.append(row); parent.append(group);
  return row;
}

/** The DL3DV clips. root: an empty element; manifest: assets/videos/index.json */
export function mountVideoCompare(root, manifest, base) {
  const [TW, TH] = manifest.tile, tileOf = id => { const i = manifest.tiles.indexOf(id); return [(i % manifest.columns) * TW, Math.floor(i / manifest.columns) * TH]; };
  const baselines = manifest.methods.filter(m => m.id !== manifest.ours), oursLabel = manifest.methods.find(m => m.id === manifest.ours).label;
  const state = { mode: "grid", clip: manifest.clips[0], task: "albedo", baseline: baselines[baselines.length - 1].id, split: 0.5, wanted: !matchMedia("(prefers-reduced-motion: reduce)").matches, visible: false, touched: false };

  const stage = el("div", "cmp-stage");
  const left = el("figure", "cmp-pane"), right = el("figure", "cmp-pane split");
  const src = el("canvas"), cmp = el("canvas"); src.width = cmp.width = TW; src.height = cmp.height = TH;
  src.setAttribute("role", "img"); src.setAttribute("aria-label", "Input video");
  cmp.setAttribute("role", "img");
  const tagOurs = el("span", "tag", oursLabel), tagBase = el("span", "tag right"), handle = el("div", "handle", "<i></i>");
  const range = el("input", "split-range"); range.type = "range"; range.min = "0"; range.max = "100"; range.step = "0.5"; range.value = "50";
  range.setAttribute("aria-label", "Position of the divider between PointX and the baseline");
  left.append(src, el("span", "tag", "Input video"));
  right.append(cmp, tagOurs, tagBase, handle, range);
  stage.append(left, right);

  // all maps: the input, then a column per method and a row per property; every tile is cut from the one video
  const [GW, GH] = manifest.grid.tile, cols = manifest.grid.columns.map(id => manifest.methods.find(m => m.id === id));
  const tileCanvas = () => { const c = el("canvas"); c.width = GW; c.height = GH; c.setAttribute("role", "img"); return c; };
  const all = el("div", "cmp-grid"), side = el("div", "grid-side"), maps = el("div", "grid-maps"), gin = el("figure", "cmp-pane"), ginC = tileCanvas();
  ginC.setAttribute("aria-label", "Input video");
  gin.append(ginC, el("span", "tag", "Input video"));
  side.append(gin, el("p", "grid-note", "The number on a tile is the map's change between consecutive frames at matched pixels (RMSE<sub>r</sub>; normals: mean angle). Lower is steadier; the steadiest of a row is marked."));
  maps.append(el("span"));
  cols.forEach(m => maps.append(el("span", "grid-col" + (m.id === manifest.ours ? " ours" : ""), m.label)));
  const cells = [{ g: ginC.getContext("2d"), x: 0, y: 0 }];
  manifest.tasks.forEach((t, j) => {
    maps.append(el("span", "grid-row", t.label));
    cols.forEach((m, i) => {
      const f = el("figure", "cmp-pane"), c = tileCanvas(), tag = el("span", "tag right score"); c.setAttribute("aria-label", `${t.label}, ${m.label}`);
      f.append(c, tag); maps.append(f); cells.push({ g: c.getContext("2d"), x: (i + 1) * GW, y: j * GH, tag, method: m.id, task: t.id });
    });
  });
  all.append(side, maps);

  const top = el("div", "cmp-top"), seg = el("div", "bm-seg view-switch"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "View");
  [["grid", "All maps"], ["split", "Slider"]].forEach(([id, label]) => {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", String(id === state.mode));
    b.addEventListener("click", () => {
      if (state.mode === id) return;
      state.mode = id; seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      shown(); load();
    });
    seg.append(b);
  });
  top.append(seg); top.hidden = manifest.slider === false;      // a build without the per-property videos (build_supplementary.py) has the one view

  const controls = el("div", "cmp-controls");
  const play = el("button", "iconbtn light"); play.type = "button";
  const bar = el("div", "cmp-bar"), pick = el("div", "cmp-bar"); bar.append(play, pick);
  chips(pick, "Property", manifest.tasks, id => { state.task = id; load(); }, state.task);
  chips(pick, "Compare with", baselines, id => { state.baseline = id; labels(); draw(); }, state.baseline);
  controls.append(bar);
  const score = el("p", "cmp-score"); score.setAttribute("aria-live", "polite");
  const thumbs = el("div", "scene-row"); thumbs.setAttribute("role", "group"); thumbs.setAttribute("aria-label", "Clips");
  manifest.clips.forEach(clip => {
    const b = el("button", "thumb", `<img src="${base}${clip.id}/thumb.jpg" alt="" loading="lazy"><span>${clip.title}</span>`); b.type = "button";
    b.setAttribute("aria-pressed", String(clip === state.clip)); b.setAttribute("aria-label", clip.title);
    b.addEventListener("click", () => { state.clip = clip; thumbs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); load(); });
    thumbs.append(b);
  });
  root.append(top, stage, all, controls, score, thumbs);

  const video = document.createElement("video");
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
  const a = src.getContext("2d"), b = cmp.getContext("2d");
  function draw() {
    if (video.readyState < 2 || video.videoWidth !== (state.mode === "grid" ? 5 * GW : manifest.columns * TW)) return;   // the other view's video is still loading
    if (state.mode === "grid") { cells.forEach(c => c.g.drawImage(video, c.x, c.y, GW, GH, 0, 0, GW, GH)); return; }
    const [ix, iy] = tileOf("input"), [ox, oy] = tileOf(manifest.ours), [bx, by] = tileOf(state.baseline), cut = Math.round(state.split * TW);
    a.drawImage(video, ix, iy, TW, TH, 0, 0, TW, TH);
    if (cut > 0) b.drawImage(video, ox, oy, cut, TH, 0, 0, cut, TH);
    if (cut < TW) b.drawImage(video, bx + cut, by, TW - cut, TH, cut, 0, TW - cut, TH);
  }
  function labels() {
    const s = state.clip.scores || {}, fmt = (v, task) => (task === "normal" ? v.toFixed(1) + "°" : v.toFixed(3));
    cells.forEach(c => {
      if (!c.tag) return;
      const v = s[c.method] && s[c.method][c.task], row = cols.map(m => s[m.id] && s[m.id][c.task]).filter(x => x != null);
      c.tag.hidden = v == null; c.tag.textContent = v == null ? "" : fmt(v, c.task); c.tag.classList.toggle("best", v != null && v === Math.min(...row));
    });
    const m = baselines.find(x => x.id === state.baseline), t = manifest.tasks.find(x => x.id === state.task);
    tagBase.textContent = m.label;
    cmp.setAttribute("aria-label", `${t.label}: ${oursLabel} left of the divider, ${m.label} right of it`);
    const mine = s[manifest.ours] && s[manifest.ours][state.task], theirs = s[state.baseline] && s[state.baseline][state.task];
    score.innerHTML = mine != null && theirs != null
      ? `Change between consecutive frames at matched pixels <span class="unit">(${state.task === "normal" ? "mean angle" : "RMSE<sub>r</sub>"}, lower is steadier)</span>` +
        `<span class="vs"><b class="ours">${oursLabel} ${fmt(mine, state.task)}</b><span>${m.label} ${fmt(theirs, state.task)}</span></span>` : "";
  }
  function setSplit(x, user) {
    state.split = Math.min(1, Math.max(0, x)); if (user) state.touched = true;
    right.style.setProperty("--split", state.split * 100 + "%"); range.value = String(state.split * 100); draw();
  }
  function load() {
    const t = video.currentTime || 0;
    root.dataset.loading = "true";
    video.src = `${base}${state.clip.id}/${state.mode === "grid" ? "grid" : state.task}.mp4`;
    video.addEventListener("loadeddata", () => {
      if (t < (video.duration || 0)) video.currentTime = t;
      delete root.dataset.loading; draw(); resume();
    }, { once: true });
    video.load(); labels();
  }
  function resume() { if (state.visible && state.wanted) video.play().catch(() => {}); else video.pause(); icon(); }
  function icon() { const on = state.wanted; play.innerHTML = on ? ICON.pause : ICON.play; play.setAttribute("aria-label", on ? "Pause" : "Play"); }
  play.addEventListener("click", () => { state.wanted = !state.wanted; resume(); });
  video.addEventListener("seeked", draw);

  // the divider: drag anywhere on the pane, or the arrow keys on its (invisible) range input
  const fromEvent = e => { const r = right.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width, true); };
  right.addEventListener("pointerdown", e => { right.setPointerCapture(e.pointerId); fromEvent(e); });
  right.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "touch") fromEvent(e); });
  range.addEventListener("input", () => setSplit(Number(range.value) / 100, true));

  // the frames: on every decoded frame where the browser says so, else on every repaint; a slow sweep of the divider until it is touched
  let t0 = null;
  const loop = now => {
    if (state.visible) {
      if (state.mode === "split" && !state.touched && state.wanted) { t0 ??= now; setSplit(0.5 + 0.22 * Math.sin((now - t0) / 1900)); } else if (!video.requestVideoFrameCallback) draw();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (video.requestVideoFrameCallback) { const onFrame = () => { draw(); video.requestVideoFrameCallback(onFrame); }; video.requestVideoFrameCallback(onFrame); }
  new IntersectionObserver(es => { state.visible = es[es.length - 1].isIntersecting; resume(); }, { rootMargin: "100px" }).observe(root);
  document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); else resume(); });
  const shown = () => { stage.hidden = score.hidden = pick.hidden = state.mode !== "split"; all.hidden = state.mode !== "grid"; };   // what the chosen view shows
  setSplit(0.5); icon(); shown(); load();
  return { state, video };
}

/** Still renders: for every case a reference image and one image per (property, method). manifest: { cases, tasks, methods, ours } */
export function mountImageCompare(root, manifest, base) {
  const others = manifest.methods.filter(m => m.id !== manifest.ours), oursLabel = manifest.methods.find(m => m.id === manifest.ours).label;
  const state = { item: manifest.cases[0], task: manifest.cases[0].tasks[0], other: others[others.length - 1].id, split: 0.5 };
  const stage = el("div", "cmp-stage");
  const left = el("figure", "cmp-pane"), right = el("figure", "cmp-pane split image");
  const ref = el("img"), mine = el("img", "under"), theirs = el("img", "over");
  ref.alt = "The scene's surface points with the colours of the input images"; mine.alt = ""; theirs.alt = "";
  const tagOurs = el("span", "tag", oursLabel), tagBase = el("span", "tag right"), handle = el("div", "handle", "<i></i>");
  const range = el("input", "split-range"); range.type = "range"; range.min = "0"; range.max = "100"; range.step = "0.5"; range.value = "50";
  range.setAttribute("aria-label", "Position of the divider between PointX and the other method");
  left.append(ref, el("span", "tag", "Input images on the points"));
  right.append(theirs, mine, tagOurs, tagBase, handle, range);
  stage.append(left, right);
  const bar = el("div", "cmp-bar"), controls = el("div", "cmp-controls"); controls.append(bar);
  let taskRow;
  const tasks = () => {
    taskRow && taskRow.parentElement.remove();
    taskRow = chips(bar, "Property", manifest.tasks.filter(t => state.item.tasks.includes(t.id)), id => { state.task = id; show(); }, state.task);
    bar.prepend(taskRow.parentElement);
  };
  chips(bar, "Compare with", others, id => { state.other = id; show(); }, state.other);
  const thumbs = el("div", "scene-row"); thumbs.setAttribute("role", "group"); thumbs.setAttribute("aria-label", "Scenes");
  manifest.cases.forEach(item => {
    const b = el("button", "thumb", `<img src="${base}${item.id}/thumb.jpg" alt="" loading="lazy"><em>${item.tag}</em><span>${item.title}</span>`); b.type = "button";
    b.setAttribute("aria-pressed", String(item === state.item)); b.setAttribute("aria-label", `${item.title}, ${item.tag}`);
    b.addEventListener("click", () => {
      state.item = item; if (!item.tasks.includes(state.task)) state.task = item.tasks[0];
      thumbs.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); tasks(); show();
    });
    thumbs.append(b);
  });
  root.append(stage, controls, thumbs);
  function show() {
    const m = others.find(x => x.id === state.other), t = manifest.tasks.find(x => x.id === state.task);
    stage.style.setProperty("--ar", state.item.aspect);
    ref.src = `${base}${state.item.id}/photo.webp`;
    mine.src = `${base}${state.item.id}/${state.task}_${manifest.ours}.webp`;
    theirs.src = `${base}${state.item.id}/${state.task}_${state.other}.webp`;
    tagBase.textContent = m.label;
    mine.alt = `${t.label} of the surface points: ${oursLabel} left of the divider, ${m.label} right of it`;
  }
  const setSplit = x => { state.split = Math.min(1, Math.max(0, x)); right.style.setProperty("--split", state.split * 100 + "%"); range.value = String(state.split * 100); };
  const fromEvent = e => { const r = right.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); };
  right.addEventListener("pointerdown", e => { right.setPointerCapture(e.pointerId); fromEvent(e); });
  right.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "touch") fromEvent(e); });
  range.addEventListener("input", () => setSplit(Number(range.value) / 100));
  setSplit(0.5); tasks(); show();
  return { state };
}
