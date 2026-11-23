// The 3D panel: an intrinsic point cloud (one PointX query per point), the camera trajectory of its input video, and a timeline.
// A scene is assets/scenes/<id>/{scene.json, points.bin.gz, frames.webp}; see the README for the layout.
import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";

export const CHANNELS = [
  { id: "photo", label: "RGB" },
  { id: "albedo", label: "Albedo" },
  { id: "irradiance", label: "Irradiance" },
  { id: "normal", label: "Normal" },
  { id: "roughness", label: "Roughness" },
  { id: "metallic", label: "Metallicity" },
];

const SPLAT = 2.3;                                        // a splat's diameter in voxels: neighbours overlap, no pinholes
const FOV = 38;                                           // a long lens: rooms read as cut-away models, not fisheye interiors

const VERT = /* glsl */ `
attribute vec3 aPhoto; attribute vec3 aAlbedo; attribute vec3 aIrr; attribute vec3 aNormal; attribute vec2 aRM; attribute float aFirst;
attribute vec3 aCmpA; attribute vec3 aCmpB; uniform float uCompare; varying vec3 vAlt;
uniform vec3 uMin; uniform vec3 uSize;
uniform float uPoint; uniform float uPx; uniform float uFrame; uniform float uReveal; uniform float uMix; uniform float uCull;
uniform int uFrom; uniform int uTo;
varying vec3 vColor; varying float vAlpha; varying vec3 vAxis; varying float vDz;
uniform float uNear; uniform float uFar;
vec3 chan(int c) {
  if (c == 0) return aPhoto;
  if (c == 1) return aAlbedo;
  if (c == 2) return aIrr;
  if (c == 3) return aNormal;
  if (c == 4) return vec3(aRM.x);
  return vec3(aRM.y);
}
void main() {
  vec3 p = uMin + position * uSize;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float zv = max(-mv.z, 1e-3);
  gl_PointSize = clamp(uPoint * uPx / zv, 1.5, 64.0);
  // a surfel: a disc on the surface (the predicted normal) is an ellipse on screen, squashed along the projected normal
  vec3 nv = normalize(mat3(modelViewMatrix) * (aNormal * 2.0 - 1.0));
  float c = abs(dot(nv, normalize(mv.xyz)));
  float l = length(nv.xy);
  vAxis = vec3(l > 1e-3 ? nv.xy / l : vec2(1.0, 0.0), clamp(c, 0.4, 1.0));
  vDz = 0.5 * uPoint * uFar * uNear / ((uFar - uNear) * zv * zv);          // the splat's radius in depth-buffer units
  float born = aFirst * 255.0;
  vAlpha = uReveal > 0.5 ? smoothstep(born - 0.5, born + 1.0, uFrame) : 1.0;
  // a cut-away: surfaces that face away from the viewer (a room's near walls, its ceiling from above) are not drawn
  if (uCull > 0.5 && dot(aNormal * 2.0 - 1.0, cameraPosition - p) < 0.0) vAlpha = 0.0;
  if (vAlpha <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vColor = mix(chan(uFrom), chan(uTo), uMix);
  if (uCompare > 0.5) { vColor = aCmpA; vAlt = aCmpB; }          // two methods on the same points, split on screen
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor; varying float vAlpha; varying vec3 vAxis; varying float vDz; varying vec3 vAlt;
uniform float uCompare; uniform float uSplitPx;
void main() {
  vec2 d = vec2(gl_PointCoord.x * 2.0 - 1.0, 1.0 - gl_PointCoord.y * 2.0);
  float along = dot(d, vAxis.xy);
  vec2 across = d - along * vAxis.xy;
  float r2 = dot(across, across) + (along / vAxis.z) * (along / vAxis.z);
  if (r2 > 1.0 || vAlpha < 0.02) discard;
  gl_FragDepth = gl_FragCoord.z + r2 * vDz;              // a paraboloid: where splats overlap the nearer centre wins (no speckle)
  gl_FragColor = vec4(uCompare > 0.5 && gl_FragCoord.x > uSplitPx ? vAlt : vColor, 1.0);
}`;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// A gzip file read with progress (0..1), then inflated by the browser.
export async function fetchGz(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + " unavailable");
  const total = Number(response.headers.get("Content-Length")) || 0, reader = response.body.getReader(), chunks = [];
  for (let got = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total && onProgress) onProgress(Math.min(1, got / total));
  }
  return new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

export class SceneViewer {
  /** stage: the element the canvas fills. opts: { dark, onFrame(frame, scene), onLoad(scene), onProgress(text) } */
  constructor(stage, opts = {}) {
    this.stage = stage; this.opts = opts;
    this.scene3 = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = "viewer-canvas"; this.canvas.tabIndex = 0;
    stage.prepend(this.canvas);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08; this.controls.rotateSpeed = 0.7; this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("start", () => { this.userMoved = true; if (this.follow) this.setFollow(false); this.dirty = true; });
    this.controls.addEventListener("change", () => { this.dirty = true; });
    this.uniforms = {
      uMin: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(1, 1, 1) },
      uPoint: { value: 0.01 }, uPx: { value: 500 }, uFrame: { value: 0 }, uReveal: { value: 1 }, uMix: { value: 1 },
      uFrom: { value: 1 }, uTo: { value: 1 }, uCull: { value: 1 }, uNear: { value: 0.01 }, uFar: { value: 500 }, uCompare: { value: 0 }, uSplitPx: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms });
    this.channel = 1; this.frame = 0; this.playing = false; this.speed = 1; this.reveal = true; this.follow = false; this.pointScale = 1;
    this.visible = true; this.dirty = true; this.last = null; this.mixStart = 0;
    this.maxBudget = Math.min(1, Number(new URLSearchParams(location.search).get("detail")) || 1);   // ?detail=0.2 caps the share of points drawn
    this.resize = this.resize.bind(this); this.tick = this.tick.bind(this);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(stage);
    this.io = new IntersectionObserver(es => { this.visible = es[es.length - 1].isIntersecting; if (this.visible) { this.last = null; this.dirty = true; } });
    this.io.observe(stage);
    this.raf = requestAnimationFrame(this.tick);
  }

  async load(base, onProgress) {
    const token = (this.token = (this.token || 0) + 1);
    const info = await (await fetch(base + "scene.json", { cache: "no-cache" })).json();
    const [buffer, sprite] = await Promise.all([fetchGz(base + "points.bin.gz", onProgress), new Promise((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("frames unavailable")); im.src = base + info.sprite.file;
    })]);
    if (token !== this.token) return null;                 // another scene was asked for meanwhile
    this.clear();
    this.info = info; this.sprite = sprite;
    this.rate = info.frames / Math.min(15, Math.max(9, info.frames / info.fps));   // frames per second of playback: the whole video in 9 to 15 s
    const n = info.points, block = name => info.layout.find(b => b.name === name);
    const u8 = name => new Uint8Array(buffer, block(name).offset, n * block(name).size);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Uint16Array(buffer, block("position").offset, n * 3), 3, true));
    geometry.setAttribute("aPhoto", new THREE.BufferAttribute(u8("photo"), 3, true));
    geometry.setAttribute("aAlbedo", new THREE.BufferAttribute(u8("albedo"), 3, true));
    geometry.setAttribute("aIrr", new THREE.BufferAttribute(u8("irradiance"), 3, true));
    geometry.setAttribute("aNormal", new THREE.BufferAttribute(u8("normal"), 3, true));
    const rm = new Uint8Array(n * 2), r = u8("roughness"), m = u8("metallic");
    for (let i = 0; i < n; i++) { rm[2 * i] = r[i]; rm[2 * i + 1] = m[i]; }
    geometry.setAttribute("aRM", new THREE.BufferAttribute(rm, 2, true));
    geometry.setAttribute("aFirst", new THREE.BufferAttribute(u8("first"), 1, true));
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = n - 1, seed = 12345; i > 0; i--) {         // Fisher-Yates with a fixed generator: any prefix of the draw order is a uniform sample
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1), t = order[i]; order[i] = order[j]; order[j] = t;
    }
    geometry.setIndex(new THREE.BufferAttribute(order, 1));
    this.budget = this.maxBudget; this.ema = 16; this.lastRender = 0; this.refined = true;
    this.buffers = { position: geometry.attributes.position.array, albedo: u8("albedo"), normal: u8("normal"), roughness: r, metallic: m, photo: u8("photo"), irradiance: u8("irradiance"),
      seen: block("seen") ? u8("seen") : null, seenBytes: block("seen") ? block("seen").size : 0 };
    const lo = new THREE.Vector3(...info.box.min), hi = new THREE.Vector3(...info.box.max);
    this.uniforms.uMin.value.copy(lo); this.uniforms.uSize.value.copy(hi).sub(lo);
    this.uniforms.uPoint.value = info.voxel * SPLAT * this.pointScale;
    this.points = new THREE.Points(geometry, this.material); this.points.frustumCulled = false;
    this.scene3.add(this.points);

    // the cameras of the video: matrices (OpenCV axes: x right, y down, z forward), centres, quaternions for interpolation
    this.poses = info.c2w.map(m => {
      const M = new THREE.Matrix4().set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); M.decompose(p, q, s);
      return { p, q };
    });
    const r0 = info.radius;
    this.buildTrajectory(r0);
    this.camera.near = r0 * 0.004; this.camera.far = r0 * 60; this.camera.updateProjectionMatrix();
    this.uniforms.uNear.value = this.camera.near; this.uniforms.uFar.value = this.camera.far;
    this.controls.minDistance = r0 * 0.05; this.controls.maxDistance = r0 * 6;
    this.home();
    this.frame = 0; this.last = null; this.dirty = true;
    this.setFrame(0);
    this.opts.onLoad && this.opts.onLoad(info);
    return info;
  }

  buildTrajectory(r0) {
    const g = (this.gizmos = new THREE.Group()); this.scene3.add(g);
    const pts = this.poses.map(c => c.p);
    const path = new THREE.BufferGeometry().setFromPoints(pts);
    this.pathAhead = new THREE.Line(path, new THREE.LineBasicMaterial({ color: 0x8b93a1, transparent: true, opacity: 0.55 }));
    this.pathDone = new THREE.Line(path.clone(), new THREE.LineBasicMaterial({ color: 0xffb020 }));
    g.add(this.pathAhead, this.pathDone);
    this.pathAhead.visible = this.pathDone.visible = this.opts.path !== false;
    // the keyframes the model saw: small frusta along the path
    const info = this.info, cam = info.camera, s = r0 * 0.035;
    const corners = [[0, 0], [cam.width, 0], [cam.width, cam.height], [0, cam.height]].map(([u, v]) => new THREE.Vector3((u - cam.cx) / cam.fx, (v - cam.cy) / cam.fy, 1));
    this.corners = corners;
    const kv = [];
    for (const k of info.keyframes) {
      const { p, q } = this.poses[k];
      const c = corners.map(v => v.clone().multiplyScalar(s).applyQuaternion(q).add(p));
      for (let i = 0; i < 4; i++) { kv.push(p, c[i], c[i], c[(i + 1) % 4]); }
    }
    this.keyFrusta = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(kv), new THREE.LineBasicMaterial({ color: 0x9aa3b2, transparent: true, opacity: 0.35 }));
    g.add(this.keyFrusta);
    // the current camera: a frustum with the video frame on its image plane
    const S = (this.frustumScale = r0 * 0.11);
    const c = corners.map(v => v.clone().multiplyScalar(S));
    const o = new THREE.Vector3();
    const lines = [];
    for (let i = 0; i < 4; i++) lines.push(o, c[i], c[i], c[(i + 1) % 4]);
    this.frustum = new THREE.Group();
    this.frustum.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0xffb020 })));
    const quad = new THREE.BufferGeometry();
    quad.setAttribute("position", new THREE.Float32BufferAttribute([c[0], c[1], c[2], c[3]].flatMap(v => [v.x, v.y, v.z]), 3));
    quad.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    this.frameCanvas = document.createElement("canvas");
    this.frameCanvas.width = info.sprite.width; this.frameCanvas.height = info.sprite.height;
    this.frameTexture = new THREE.CanvasTexture(this.frameCanvas); this.frameTexture.colorSpace = THREE.SRGBColorSpace;
    this.plane = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: this.frameTexture, side: THREE.DoubleSide, transparent: true, opacity: 0.92, toneMapped: false }));
    this.frustum.add(this.plane);
    g.add(this.frustum);
    this.frustum.visible = this.opts.frustum !== false;
  }

  clear() {
    for (const o of [this.points, this.gizmos]) if (o) {
      this.scene3.remove(o);
      o.traverse(c => { c.geometry && c.geometry.dispose(); if (c.material && c.material !== this.material) { c.material.map && c.material.map.dispose(); c.material.dispose(); } });
    }
    this.showTrack(null);
    this.points = this.gizmos = this.info = null; this.buffers = null; this.shownFrame = -1;
  }

  /** The opening view: the scene's own direction, from as far as it takes to hold the cloud's core in this stage. */
  home() {
    if (!this.info) return;
    const v = this.info.view, w = this.stage.clientWidth || 16, h = this.stage.clientHeight || 9;
    const target = new THREE.Vector3(...v.target), dir = new THREE.Vector3(...v.position).sub(target).normalize();
    const [yaw, lift, zoom] = this.tweak || [0, 0, 1];     // a scene's adjustment of its opening view: degrees about the up axis, degrees upwards, distance
    if (yaw || lift) {
      const sph = new THREE.Spherical().setFromVector3(dir);
      sph.theta += THREE.MathUtils.degToRad(yaw); sph.phi = Math.min(Math.PI / 2 - 0.05, Math.max(0.15, sph.phi - THREE.MathUtils.degToRad(lift)));
      dir.setFromSpherical(sph).normalize();
    }
    const half = THREE.MathUtils.degToRad(FOV) / 2, fit = Math.min(Math.tan(half), Math.tan(half) * (w / h));
    this.camera.up.set(0, 1, 0);
    if (v.exact) this.camera.position.set(...v.position);  // a chosen viewpoint (the paper's figures)
    else this.camera.position.copy(target).addScaledVector(dir, (this.info.radius * (v.zoom || 1.2) * zoom) / fit);
    this.controls.target.copy(target);
    this.camera.fov = FOV; this.fit(); this.controls.update(); this.userMoved = false; this.dirty = true;
  }

  fit() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight; if (!w || !h) return;
    this.camera.aspect = w / h;
    if (this.follow && this.info) {                        // the video camera's field of view, the whole frame in the stage
      const cam = this.info.camera, vf = 2 * Math.atan(cam.height / 2 / cam.fy), hf = 2 * Math.atan(cam.width / 2 / cam.fx);
      this.camera.fov = THREE.MathUtils.radToDeg(Math.max(vf, 2 * Math.atan(Math.tan(hf / 2) / this.camera.aspect)));
    }
    this.camera.updateProjectionMatrix();
    this.uniforms.uPx.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.fit(); if (this.split != null) this.setSplit(this.split); this.dirty = true;
  }

  setChannel(id) {
    const i = CHANNELS.findIndex(c => c.id === id); if (i < 0 || i === this.channel) return;
    this.uniforms.uFrom.value = this.channel; this.uniforms.uTo.value = i; this.uniforms.uMix.value = 0;
    this.channel = i; this.mixStart = performance.now(); this.dirty = true;
  }
  /** two colour sets (Uint8Array, three bytes per point, in the file's order) shown left and right of a split at `fraction` of the width */
  setCompare(a, b) {
    const g = this.points.geometry;
    g.setAttribute("aCmpA", new THREE.BufferAttribute(a, 3, true)); g.setAttribute("aCmpB", new THREE.BufferAttribute(b, 3, true));
    this.uniforms.uCompare.value = 1; this.dirty = true;
  }
  setSplit(fraction) { this.split = fraction; this.uniforms.uSplitPx.value = fraction * this.canvas.width; this.dirty = true; }
  setCull(on) { this.uniforms.uCull.value = on ? 1 : 0; this.dirty = true; }
  setReveal(on) { this.reveal = on; this.uniforms.uReveal.value = on ? 1 : 0; this.dirty = true; }
  setPointScale(s) { this.pointScale = s; if (this.info) this.uniforms.uPoint.value = this.info.voxel * SPLAT * s; this.dirty = true; }
  setGizmos(on) { if (this.gizmos) this.gizmos.visible = on; this.gizmosOn = on; this.dirty = true; }
  setPlaying(on) { this.playing = on; this.last = null; this.opts.onPlay && this.opts.onPlay(on); }
  setFollow(on) {
    this.follow = on; this.controls.enabled = !on; this.uniforms.uCull.value = on ? 0 : (this.cullWanted === false ? 0 : 1);
    if (this.gizmos) this.gizmos.visible = !on && this.gizmosOn !== false;
    if (!on && this.info) { this.camera.fov = FOV; this.home(); }
    this.fit(); this.setFrame(this.frame); this.opts.onFollow && this.opts.onFollow(on);
  }

  /** the pose at a fractional frame: positions lerped, rotations slerped */
  poseAt(f, p, q) {
    const n = this.poses.length, i = Math.max(0, Math.min(n - 1, Math.floor(f))), j = Math.min(n - 1, i + 1), t = Math.min(1, Math.max(0, f - i));
    p.copy(this.poses[i].p).lerp(this.poses[j].p, t); q.copy(this.poses[i].q).slerp(this.poses[j].q, t);
  }

  setFrame(f) {
    if (!this.info) return;
    const n = this.info.frames; this.frame = Math.max(0, Math.min(n - 1, f));
    this.uniforms.uFrame.value = this.frame;
    const p = (this._p ||= new THREE.Vector3()), q = (this._q ||= new THREE.Quaternion());
    this.poseAt(this.frame, p, q);
    this.frustum.position.copy(p); this.frustum.quaternion.copy(q);
    this.pathDone.geometry.setDrawRange(0, Math.floor(this.frame) + 1);
    const shown = Math.round(this.frame);
    if (shown !== this.shownFrame) {
      this.shownFrame = shown;
      const s = this.info.sprite, ctx = this.frameCanvas.getContext("2d");
      ctx.drawImage(this.sprite, (shown % s.columns) * s.width, Math.floor(shown / s.columns) * s.height, s.width, s.height, 0, 0, s.width, s.height);
      this.frameTexture.needsUpdate = true;
      this.opts.onFrame && this.opts.onFrame(shown, this.info, this.frameCanvas);
    }
    if (this.follow) {                                     // look through the video's camera (OpenCV -> three: turn about x)
      this.camera.position.copy(p);
      this.camera.quaternion.copy(q).multiply((this._flip ||= new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)));
    }
    this.dirty = true;
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.visible || document.hidden || !this.info) { this.last = null; return; }
    if (this.playing) {
      if (this.last != null) {
        let f = this.frame + ((now - this.last) / 1000) * this.rate * this.speed;
        const end = this.info.frames - 1;
        if (f >= end + this.rate * 1.6) f = 0;             // hold the complete scene for a moment, then loop
        this.setFrame(Math.min(f, end)); this.frame = f;
      }
      this.last = now;
    }
    if (this.uniforms.uMix.value < 1) { this.uniforms.uMix.value = Math.min(1, (now - this.mixStart) / 350); this.dirty = true; }
    if (!this.follow && this.controls.update()) this.dirty = true;
    // Level of detail: while the picture changes, draw as many points as keep it fluid (fewer, larger ones on a slow GPU);
    // once it rests, one frame with all of them.
    if (this.dirty) {
      if (this.lastRender && now - this.lastRender < 300) {
        this.ema = this.ema * 0.8 + (now - this.lastRender) * 0.2;
        if (this.ema > 42) this.budget = Math.max(0.06, this.budget * 0.8); else if (this.ema < 24) this.budget = Math.min(this.maxBudget, this.budget * 1.1);
      }
      this.draw(this.budget); this.lastRender = now; this.refined = this.budget >= this.maxBudget; this.dirty = false;
    } else if (!this.refined && now - this.lastRender > 400) { this.draw(this.maxBudget); this.refined = true; }
  }

  draw(share) {
    const n = this.info.points;
    this.points.geometry.setDrawRange(0, Math.max(1, Math.floor(n * share)));
    this.uniforms.uPoint.value = this.info.voxel * SPLAT * this.pointScale * Math.min(3.5, 1 / Math.sqrt(share));
    this.renderer.render(this.scene3, this.camera);
  }

  /** the point under a client position (nearest to the ray among the visible points) -> { index, position, albedo, ... } or null */
  pick(clientX, clientY) {
    if (!this.info) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin, d = ray.ray.direction, lo = this.uniforms.uMin.value, sz = this.uniforms.uSize.value;
    const P = this.buffers.position, N = this.buffers.normal, F = this.points.geometry.attributes.aFirst.array, n = this.info.points, tol = (this.info.voxel * 2.2) ** 2;
    const cull = this.uniforms.uCull.value > 0.5, born = this.uniforms.uReveal.value > 0.5 ? this.frame : Infinity;
    let best = -1, bestT = Infinity;
    for (let i = 0; i < n; i++) {
      const x = lo.x + (P[3 * i] / 65535) * sz.x - o.x, y = lo.y + (P[3 * i + 1] / 65535) * sz.y - o.y, z = lo.z + (P[3 * i + 2] / 65535) * sz.z - o.z;
      const t = x * d.x + y * d.y + z * d.z; if (t <= 0 || t >= bestT) continue;
      const dx = x - t * d.x, dy = y - t * d.y, dz = z - t * d.z;
      if (dx * dx + dy * dy + dz * dz >= tol * Math.max(1, (t / this.info.radius) ** 2 * 4)) continue;
      if (F[i] > born) continue;                           // not drawn yet
      if (cull && (N[3 * i] - 127.5) * x + (N[3 * i + 1] - 127.5) * y + (N[3 * i + 2] - 127.5) * z > 0) continue;   // faces away: not drawn
      best = i; bestT = t;
    }
    if (best < 0) return null;
    const b = this.buffers, i = best, views = [];
    for (let k = 0; b.seen && k < this.info.keyframes.length; k++) if (b.seen[i * b.seenBytes + (k >> 3)] & (1 << (k & 7))) views.push(this.info.keyframes[k]);
    const rgb = a => [a[3 * i], a[3 * i + 1], a[3 * i + 2]];
    return {
      index: i, views,
      position: new THREE.Vector3(lo.x + (P[3 * i] / 65535) * sz.x, lo.y + (P[3 * i + 1] / 65535) * sz.y, lo.z + (P[3 * i + 2] / 65535) * sz.z),
      albedo: rgb(b.albedo), normal: rgb(b.normal), photo: rgb(b.photo), irradiance: rgb(b.irradiance), roughness: b.roughness[i] / 255, metallic: b.metallic[i] / 255,
    };
  }

  /** where a world point lands in a frame of the video: pixels of the original frame, or null behind the camera */
  project(position, frame) {
    const { p, q } = this.poses[frame], cam = this.info.camera;
    const x = position.clone().sub(p).applyQuaternion(q.clone().invert());
    return x.z > 1e-6 ? { u: (cam.fx * x.x) / x.z + cam.cx, v: (cam.fy * x.y) / x.z + cam.cy } : null;
  }

  /** the track of a picked point: a marker on it and a line to every keyframe that sees it (null clears) */
  showTrack(hit) {
    if (this.track) { this.scene3.remove(this.track); this.track.traverse(c => { c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }); this.track = null; }
    this.dirty = true;
    if (!hit) return;
    const g = (this.track = new THREE.Group());
    const pts = hit.views.flatMap(k => [hit.position, this.poses[k].p]);
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4f97ff, transparent: true, opacity: 0.9, depthTest: false })));
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"); x.beginPath(); x.arc(32, 32, 20, 0, 7); x.fillStyle = "#2a6fdb"; x.fill(); x.lineWidth = 7; x.strokeStyle = "#fff"; x.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
    dot.scale.setScalar(0.035); dot.position.copy(hit.position); dot.renderOrder = 10;
    g.add(dot); g.renderOrder = 9;
    this.scene3.add(g);
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.observer.disconnect(); this.io.disconnect(); this.clear();
    this.controls.dispose(); this.material.dispose(); this.renderer.dispose(); this.canvas.remove();
  }
}
