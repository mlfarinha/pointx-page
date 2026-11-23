// The first panel: choose a scene, play its input video, look at the intrinsic point cloud PointX predicts for it.
import { SceneViewer, CHANNELS } from "./viewer.js";

const $ = id => document.getElementById(id);
const ICON = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.6v10.8a.6.6 0 0 0 .92.5l8.3-5.4a.6.6 0 0 0 0-1L5.42 2.1a.6.6 0 0 0-.92.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.4" y="2.4" width="3.2" height="11.2" rx=".9"/><rect x="9.4" y="2.4" width="3.2" height="11.2" rx=".9"/></svg>',
};
const stage = $("hero-stage"), play = $("hero-play"), scrub = $("hero-scrub"), count = $("hero-count"), inset = $("hero-frame");
const load = $("hero-load"), loadText = $("hero-load-text"), loadBar = $("hero-load-bar"), meta = $("hero-meta");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const viewer = new SceneViewer(stage, {
  onFrame(frame, info, canvas) {
    inset.getContext("2d").drawImage(canvas, 0, 0, inset.width, inset.height);
    count.textContent = `${String(frame + 1).padStart(String(info.frames).length, "0")} / ${info.frames}`;
  },
  onPlay(on) { play.innerHTML = on ? ICON.pause : ICON.play; play.setAttribute("aria-label", on ? "Pause" : "Play"); },
  onFollow(on) { $("hero-follow").setAttribute("aria-pressed", String(on)); },
});
window.pointxHero = viewer;                                // for the console, and for the page's own checks

// the properties
const channels = $("hero-channels");
CHANNELS.forEach((c, i) => {
  if (i === 1) channels.append(Object.assign(document.createElement("span"), { className: "sep" }));
  const b = Object.assign(document.createElement("button"), { type: "button", textContent: c.label });
  b.dataset.channel = c.id; b.setAttribute("aria-pressed", String(c.id === "albedo"));
  b.addEventListener("click", () => {
    viewer.setChannel(c.id);
    channels.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  });
  channels.append(b);
});

// the timeline
const sync = () => {
  requestAnimationFrame(sync);
  if (!viewer.info) return;
  const f = Math.min(viewer.frame, viewer.info.frames - 1);
  if (document.activeElement !== scrub || viewer.playing) scrub.value = String(f);
  scrub.style.setProperty("--fill", (f / (viewer.info.frames - 1)) * 100 + "%");
};
play.addEventListener("click", () => {
  if (!viewer.playing && viewer.frame >= viewer.info.frames - 1) viewer.setFrame(0);
  viewer.setPlaying(!viewer.playing);
});
scrub.addEventListener("input", () => { viewer.setPlaying(false); viewer.setFrame(Number(scrub.value)); });
const toggle = (id, fn, initial) => {
  const b = $(id); let on = initial;
  b.addEventListener("click", () => { on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on)); fn(on); });
};
toggle("hero-follow", on => viewer.setFollow(on), false);
toggle("hero-reveal", on => viewer.setReveal(on), true);
toggle("hero-cull", on => { viewer.cullWanted = on; if (!viewer.follow) viewer.setCull(on); }, true);
$("hero-reset").addEventListener("click", () => { if (viewer.follow) viewer.setFollow(false); else viewer.home(); });

// Scrolling the page must not zoom the scene: the wheel belongs to the stage only after a press inside it, until the pointer leaves.
viewer.controls.enableZoom = false;
stage.addEventListener("pointerdown", e => { stage.dataset.touched = "true"; if (e.pointerType === "mouse") stage.dataset.active = "true"; viewer.controls.enableZoom = true; });
stage.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { viewer.controls.enableZoom = false; delete stage.dataset.active; } });
stage.addEventListener("keydown", e => {
  if (e.target.closest("button, input")) return;
  if (e.key === " ") { e.preventDefault(); play.click(); }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); viewer.setPlaying(false); viewer.setFrame(Math.round(viewer.frame) + (e.key === "ArrowRight" ? 1 : -1)); }
});

// A click on the cloud queries that point: the views that see it (its track), and the one answer decoded from their pooled tokens.
const probe = $("hero-probe"), probeViews = $("hero-probe-views");
let down = null;
function inspect(hit) {
  viewer.showTrack(hit);
  probe.hidden = !hit;
  if (!hit) return;
  const info = viewer.info, s = info.sprite, k = s.width / info.camera.width;
  $("hero-probe-count").textContent = `appears in ${hit.views.length} of ${info.keyframes.length} input frames, queried once`;
  const shown = hit.views.length <= 5 ? hit.views : [0, 1, 2, 3, 4].map(i => hit.views[Math.round((i * (hit.views.length - 1)) / 4)]);
  probeViews.replaceChildren(...shown.map(frame => {
    const uv = viewer.project(hit.position, frame), fig = document.createElement("figure"), c = document.createElement("canvas"), g = c.getContext("2d");
    c.width = c.height = 144;
    const half = Math.round(s.width * 0.11), x = uv.u * k, y = uv.v * k;      // a window of 22 % of the frame's width around the projection
    g.fillStyle = "#000"; g.fillRect(0, 0, 144, 144);
    const sx = Math.max(0, x - half), sy = Math.max(0, y - half), ex = Math.min(s.width, x + half), ey = Math.min(s.height, y + half);
    g.drawImage(viewer.sprite, (frame % s.columns) * s.width + sx, Math.floor(frame / s.columns) * s.height + sy, ex - sx, ey - sy,
      ((sx - (x - half)) / (2 * half)) * 144, ((sy - (y - half)) / (2 * half)) * 144, ((ex - sx) / (2 * half)) * 144, ((ey - sy) / (2 * half)) * 144);
    g.beginPath(); g.arc(72, 72, 9, 0, 7); g.lineWidth = 5; g.strokeStyle = "#fff"; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = "#2a6fdb"; g.stroke();
    const cap = document.createElement("figcaption"); cap.textContent = "frame " + (frame + 1);
    fig.append(c, cap); return fig;
  }));
  const sw = (label, rgb) => `<span><i style="background:rgb(${rgb.join(",")})"></i>${label}</span>`;
  const g8 = v => { const x = Math.round(v * 255); return [x, x, x]; };
  $("hero-probe-values").innerHTML = sw("Albedo", hit.albedo) + sw("Irradiance", hit.irradiance) + sw("Normal", hit.normal) +
    sw("Roughness", g8(hit.roughness)) + sw("Metallicity", g8(hit.metallic));
}
viewer.canvas.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY, performance.now()]; });
viewer.canvas.addEventListener("pointerup", e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || performance.now() - down[2] > 500) return;
  const hit = viewer.pick(e.clientX, e.clientY);
  if (hit && hit.views.length) inspect(hit);
});
$("hero-probe-close").addEventListener("click", () => inspect(null));
stage.addEventListener("keydown", e => { if (e.key === "Escape") inspect(null); });

// the scenes
const row = $("hero-scenes");
async function show(scene, button) {
  row.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  $("hero-poster").style.backgroundImage = `url("assets/scenes/${scene.id}/thumb.jpg")`;
  stage.dataset.ready = "false"; load.dataset.done = "false"; loadBar.style.width = "0"; loadText.textContent = `Loading ${scene.title}…`;
  const was = viewer.info ? viewer.playing : !reduced;
  inspect(null);
  viewer.setPlaying(false);
  try {
    viewer.tweak = scene.tweak || null;
    const info = await viewer.load(`assets/scenes/${scene.id}/`, p => { loadBar.style.width = Math.round(p * 100) + "%"; });
    if (!info) return;                                    // superseded by a later choice
    inset.width = info.sprite.width; inset.height = info.sprite.height; viewer.shownFrame = -1; viewer.setFrame(0);
    scrub.max = String(info.frames - 1); scrub.value = "0";
    meta.innerHTML = `<span><b>${info.source}</b> · ${scene.title}</span><span><b>${info.keyframes.length}</b> of <b>${info.frames}</b> frames as input</span>` +
      `<span><b>${info.points.toLocaleString("en-US")}</b> points</span><span>${info.geometry}</span>`;
    stage.dataset.ready = "true"; load.dataset.done = "true";
    viewer.setPlaying(was);
  } catch (error) {
    loadText.textContent = "This scene could not be loaded."; console.error(error);
  }
}
const scenes = await (await fetch("assets/scenes/index.json", { cache: "no-cache" })).json();
scenes.forEach(scene => {
  const b = Object.assign(document.createElement("button"), { type: "button", className: "thumb" });
  b.setAttribute("aria-pressed", "false"); b.setAttribute("aria-label", `${scene.title}, ${scene.source}`);
  b.innerHTML = `<img src="assets/scenes/${scene.id}/thumb.jpg" alt="" loading="lazy"><em>${scene.tag}</em><span>${scene.title}</span>`;
  b.addEventListener("click", () => show(scene, b));
  row.append(b);
});
const wanted = new URLSearchParams(location.search).get("scene");
const first = Math.max(0, scenes.findIndex(s => s.id === wanted));
show(scenes[first], row.children[first]);
requestAnimationFrame(sync);
