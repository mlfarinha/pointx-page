// Applications: ETH3D photographs relit in Blender by a bulb placed in the scene (a wipe between the photograph and its relit
// version, for several lights and views of each scene), and the paper's relit / edited photographs.
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

/* ------------------------------------------------------------------ the three photographs: input / relit / edited */
const kicker = $("kicker-mode");
if (kicker) kicker.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  kicker.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  $("kicker-trio").querySelectorAll("img").forEach((im, i) => { im.src = `assets/apps/kicker/${b.dataset.v}_${i + 1}.webp`; });
});
["relit", "edit"].forEach(v => [1, 2, 3].forEach(i => { new Image().src = `assets/apps/kicker/${v}_${i}.webp`; }));   // no flash on the first switch

/* ------------------------------------------------------------------ relit in Blender: photograph | relit, per scene, light and view */
function mountRelit(root, manifest, base) {
  const state = { scene: manifest.scenes[0], light: manifest.scenes[0].lights[0].id, view: 1, split: 0.4, visible: false, touched: false };
  const pane = el("figure", "cmp-pane split image relit-pane"); pane.style.setProperty("--ar", manifest.size[0] / manifest.size[1]);
  const relit = el("img"), photo = el("img", "under"); photo.alt = "";
  const range = el("input", "split-range"); range.type = "range"; range.min = "0"; range.max = "100"; range.step = "0.5"; range.value = "40";
  range.setAttribute("aria-label", "Position of the divider between the photograph and its relit version");
  pane.append(relit, photo, el("span", "tag", "Input photograph"), el("span", "tag right", "Relit"), el("div", "handle", "<i></i>"), range);
  const bar = el("div", "cmp-bar"), controls = el("div", "cmp-controls"); controls.append(bar);
  const group = (label, items, pick) => {
    const g = el("div", "chip-group"), row = el("div", "chips"); g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
    items.forEach(([id, text]) => { const b = el("button", "chip", text); b.type = "button"; b.dataset.id = id; b.addEventListener("click", () => { pick(id); show(); }); row.append(b); });
    g.append(el("span", "chip-label", label), row); bar.append(g);
    return row;
  };
  let lights, views;
  const thumbs = el("div", "scene-row"); thumbs.setAttribute("role", "group"); thumbs.setAttribute("aria-label", "Scenes");
  manifest.scenes.forEach(scene => {
    const b = el("button", "thumb", `<img src="${base}${scene.id}/thumb.jpg" alt="" loading="lazy"><span>${scene.title}</span>`); b.type = "button"; b.setAttribute("aria-label", scene.title);
    b.addEventListener("click", () => { state.scene = scene; state.view = 1; if (!scene.lights.some(l => l.id === state.light)) state.light = scene.lights[0].id; menus(); show(); });
    thumbs.append(b);
  });
  root.append(pane, controls, thumbs);
  function menus() {                                                      // the scene's own lights and views
    bar.replaceChildren();
    lights = group("Light", state.scene.lights.map(l => [l.id, l.label]), id => { state.light = id; });
    views = group("View", Array.from({ length: state.scene.views }, (_, i) => [String(i + 1), String(i + 1)]), id => { state.view = Number(id); });
    state.scene.lights.forEach(l => { for (let v = 1; v <= state.scene.views; v++) new Image().src = `${base}${state.scene.id}/${l.id}_${v}.webp`; });   // no flash on a switch
  }
  function show() {
    const d = `${base}${state.scene.id}/`, light = state.scene.lights.find(l => l.id === state.light);
    photo.src = `${d}photo_${state.view}.webp`; relit.src = `${d}${state.light}_${state.view}.webp`;
    relit.alt = `${state.scene.title}, view ${state.view}: the photograph left of the divider, right of it the same photograph relit by a ${light.label.toLowerCase()} bulb`;
    lights.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === state.light)));
    views.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.id) === state.view)));
    thumbs.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-pressed", String(manifest.scenes[i] === state.scene)));
  }
  const setSplit = (x, user) => { state.split = Math.min(1, Math.max(0, x)); if (user) state.touched = true; pane.style.setProperty("--split", state.split * 100 + "%"); range.value = String(state.split * 100); };
  const at = e => { const r = pane.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width, true); };
  pane.addEventListener("pointerdown", e => { pane.setPointerCapture(e.pointerId); at(e); });
  pane.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "touch") at(e); });
  range.addEventListener("input", () => setSplit(Number(range.value) / 100, true));
  // a slow sweep of the divider until it is touched
  let t0 = null;
  const loop = now => { if (state.visible && !state.touched) { t0 ??= now; setSplit(0.4 + 0.28 * Math.sin((now - t0) / 2100)); } if (!state.touched) requestAnimationFrame(loop); };
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(loop);
  new IntersectionObserver(es => { state.visible = es[es.length - 1].isIntersecting; }, { rootMargin: "100px" }).observe(pane);
  setSplit(0.4); menus(); show();
  return { state };
}
const relit = $("relit-compare");
if (relit) fetch("assets/relight/index.json", { cache: "no-cache" }).then(r => r.json()).then(m => { window.pointxRelit = mountRelit(relit, m, "assets/relight/"); })
  .catch(() => { relit.textContent = "The relit photographs could not be loaded."; });
