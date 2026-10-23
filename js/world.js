import * as THREE from "three";
import { ISLANDS_CONTENT, PROJECTS } from "./content.js";
import { createAudio } from "./audio.js";

const sfx = createAudio("assets/bgm.mp3");

/* =========================================================
   Boypje World: a tiny sky archipelago portfolio.
   Plain three.js, no build step, so it runs on GitHub Pages.
   ========================================================= */

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const coarse = matchMedia("(pointer: coarse)").matches;
const lowPower = coarse || Math.min(screen.width, screen.height) < 700;
let touchUI = coarse;
const setTouchUI = (on) => { touchUI = on; document.body.classList.toggle("touch", on); };
setTouchUI(coarse);
addEventListener("touchstart", () => setTouchUI(true), { passive: true });

/* ---------- Renderer ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance",
    preserveDrawingBuffer: new URLSearchParams(location.search).has("debug") });
} catch (e) {
  const d = document.createElement("div");
  d.id = "err";
  d.innerHTML = 'Your browser can\'t run 3D (WebGL). <a href="classic.html">Open the classic portfolio</a>.';
  document.body.append(d);
  throw e;
}
// Render sharp: phones get up to 2x density (they are 2-3x screens); auto-quality only steps down if really needed.
const DPR_MAX = Math.min(devicePixelRatio, 2);
const DPR_MIN = Math.min(DPR_MAX, coarse ? 1.5 : 1);
renderer.setPixelRatio(DPR_MAX);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = lowPower ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const scene = new THREE.Scene();
const FOG = 0xcfe6f7;
scene.fog = new THREE.Fog(FOG, 90, 330);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);

/* ---------- Helpers ---------- */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20240);
const TAU = Math.PI * 2;
const damp = (k, dt) => 1 - Math.exp(-k * dt);

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 185, 185, 185, 255, 232, 232, 232, 255, 255, 255, 255, 255]), 4, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap, ...opts }));
  return matCache.get(key);
}

// Jitter vertices (shared positions move together) and flat-shade for a low-poly look.
function lowpoly(geo, amt = 0, seed = 1, lockY = null) {
  const pos = geo.attributes.position;
  const r = rng(seed);
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let o = offsets.get(k);
    if (!o) offsets.set(k, (o = [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]));
    const locked = lockY !== null && Math.abs(y - lockY) < 1e-3;
    pos.setXYZ(i, x + o[0], locked ? y : y + o[1], z + o[2]);
  }
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

function mesh(geo, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast && renderer.shadowMap.enabled;
  m.receiveShadow = receive && renderer.shadowMap.enabled;
  return m;
}

const labels = [];
function makeLabel(text, { size = 1, sub = "", bg = "rgba(255,255,255,0.92)", color = "#17191f", far = 260 } = {}) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const fs = 56;
  const font = `${fs}px 'Lilita One', Nunito, sans-serif`;
  const subFont = `700 ${Math.round(fs * 0.55)}px Nunito, sans-serif`;
  ctx.font = font;
  let w = ctx.measureText(text).width;
  if (sub) { ctx.font = subFont; w = Math.max(w, ctx.measureText(sub).width); }
  const W = Math.ceil(w + 70), H = sub ? 150 : 96;
  c.width = W; c.height = H;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(0, 0, W, H, 46) : ctx.rect(0, 0, W, H);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.fillText(text, W / 2, sub ? 54 : H / 2 + 3);
  if (sub) { ctx.font = subFont; ctx.fillStyle = "#5b6270"; ctx.fillText(sub, W / 2, 112); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }));
  const s = size * 0.012;
  sp.scale.set(W * s, H * s, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 5;
  labels.push({ sprite: sp, far });
  return sp;
}

const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}

/* ---------- Sky & light ---------- */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f86d4) },
      mid: { value: new THREE.Color(0xa9d4f5) },
      horizon: { value: new THREE.Color(FOG) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, horizon; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0 ? mix(mix(horizon, mid, smoothstep(0.0, 0.18, h)), top, smoothstep(0.15, 0.8, h)) : horizon;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
sky.renderOrder = -1;
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x8aa274, 1.5));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(40, 60, 25);
scene.add(sun, sun.target);
if (renderer.shadowMap.enabled) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -32; sc.right = sc.top = 32; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
}

/* ---------- Collision world ---------- */
// Every solid is a vertical "column" whose radius can shrink with depth (islands taper into a cone).
const solids = [];
function addSolid(s) { solids.push(s); return s; }
const TERRACE = 4.0;
function islandSolid(x, y, z, r, coneDepth, extra = {}) {
  return addSolid({ x, z, top: y, bottom: y - TERRACE - coneDepth, rTop: r,
    rAt: (d) => (d < TERRACE ? r * 0.96 : r * 0.82 * Math.max(0, 1 - (d - TERRACE) / coneDepth)), ...extra });
}
function column(x, z, r, y0, y1, extra = {}) {
  return addSolid({ x, z, top: y1, bottom: y0, rTop: r, rAt: () => r, kind: "prop", ...extra });
}

/* ---------- Grass (one instanced mesh for the whole world) ---------- */
const grassBlades = [];
function sprinkleGrass(cx, cy, cz, r, density, avoid = [], seed = 1) {
  const rnd = rng(seed);
  const n = Math.round(Math.PI * r * r * density * (lowPower ? 0.65 : 1));
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * (r - 0.4);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
    grassBlades.push([cx + x, cy, cz + z, rnd() * TAU, 0.6 + rnd() * 0.8]);
  }
}
const grassMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0 },
    cBase: { value: new THREE.Color(0x3f8f34) },
    cTip: { value: new THREE.Color(0xc4e98a) },
    fogColor: { value: scene.fog.color },
    fogNear: { value: scene.fog.near },
    fogFar: { value: scene.fog.far },
  },
  vertexShader: `uniform float uTime; varying float vH; varying float vDist; varying float vShade;
    void main(){
      vH = uv.y;
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      float k = vH * vH;
      w.x += sin(uTime * 1.8 + w.x * 0.4 + w.z * 0.3) * 0.22 * k;
      w.z += cos(uTime * 1.4 + w.z * 0.35) * 0.14 * k;
      vShade = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
      vec4 mv = viewMatrix * w;
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform vec3 cBase, cTip, fogColor; uniform float fogNear, fogFar; varying float vH, vDist, vShade;
    void main(){
      vec3 c = mix(cBase, cTip, vH) * (0.85 + vShade * 0.3);
      c = mix(c, fogColor, smoothstep(fogNear, fogFar, vDist));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
function buildGrass() {
  const g = new THREE.PlaneGeometry(0.14, 0.7, 1, 3).translate(0, 0.35, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 0.7;
    p.setX(i, p.getX(i) * (1 - t * 0.9));
    p.setZ(i, t * t * 0.12);
  }
  const im = new THREE.InstancedMesh(g, grassMat, grassBlades.length);
  const o = new THREE.Object3D();
  grassBlades.forEach(([x, y, z, rot, s], i) => {
    o.position.set(x, y - 0.02, z);
    o.rotation.set(0, rot, 0);
    o.scale.set(1, s, 1);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.frustumCulled = false;
  scene.add(im);
}

/* ---------- Water, beams, crystals ---------- */
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, fogColor: { value: scene.fog.color }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } },
  vertexShader: `varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 fogColor; uniform float fogNear, fogFar; varying vec2 vUv; varying float vDist;
    void main(){
      float s = fract(vUv.y * 16.0 + uTime * 2.4 + sin(vUv.x * 9.0) * 0.2);
      float streak = smoothstep(0.0, 0.12, s) * smoothstep(0.55, 0.25, s);
      vec3 c = mix(vec3(0.42, 0.74, 0.95), vec3(1.0), streak * 0.65 + smoothstep(0.93, 1.0, vUv.y) * 0.6);
      float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
      float a = (0.6 + streak * 0.3) * edge * smoothstep(0.0, 0.55, vUv.y);
      c = mix(c, fogColor, smoothstep(fogNear, fogFar, vDist) * 0.8);
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
    }`,
});
function waterfall(I, angleDeg, width = 1.6) {
  const a = (angleDeg * Math.PI) / 180;
  const g = new THREE.Group();
  g.position.set(I.x + Math.cos(a) * (I.r - 0.05), I.y, I.z + Math.sin(a) * (I.r - 0.05));
  g.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
  const h = 90;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(width, h), waterMat);
  fall.position.set(0, -h / 2 + 0.05, 0.12);
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, 4.5).rotateX(-Math.PI / 2).translate(0, 0.04, -2.25),
    new THREE.MeshBasicMaterial({ color: 0x8fd3f5 }));
  g.add(fall, stream);
  scene.add(g);
}

const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).translate(0, 0.5, 0);
const beams = {};
function beam(id, x, y, z, h = 180) {
  const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xbaf1ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.scale.set(0.2, h, 0.2);
  const glow = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x67e0ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(0.75, h, 0.75);
  core.position.set(x, y, z);
  glow.position.copy(core.position);
  scene.add(core, glow);
  (beams[id] ||= []).push(core, glow);
}

const crystals = [];
function station(I, lx, lz) {
  const x = I.x + lx, z = I.z + lz;
  const ped = mesh(lowpoly(new THREE.CylinderGeometry(0.7, 0.9, 1, 6).translate(0, 0.5, 0), 0.08, 3), mat(0x9aa3ad));
  ped.position.set(x, I.y, z);
  const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0).scale(1, 1.7, 1),
    new THREE.MeshToonMaterial({ color: 0x8be8ff, emissive: 0x2aa7d6, emissiveIntensity: 0.9, gradientMap }));
  cr.position.set(x, I.y + 2.3, z);
  cr.userData.baseY = cr.position.y;
  crystals.push(cr);
  scene.add(ped, cr);
  column(x, z, 0.8, I.y, I.y + 1);
  beam(I.id, x, I.y + 2.3, z);
}

/* ---------- Scenery props ---------- */
function tree(parent, I, lx, lz, s = 1, seed = 1, leaf = null) {
  const rnd = rng(seed);
  const g = new THREE.Group();
  g.position.set(lx, 0, lz);
  g.scale.setScalar(s);
  g.add(mesh(lowpoly(new THREE.CylinderGeometry(0.16, 0.28, 1.9, 6).translate(0, 0.95, 0), 0.06, seed), mat(0x8a6b52)));
  const colors = leaf ? [leaf] : rnd() < 0.25 ? [0xe0614f, 0xd24c43] : [0x7cc96f, 0x6cbb5f, 0x92d46e];
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.75 + rnd() * 0.45;
    const p = mesh(lowpoly(new THREE.IcosahedronGeometry(r, 0), 0.15, seed + i), mat(colors[i % colors.length]));
    p.position.set((rnd() - 0.5) * 1.1, 2.1 + rnd() * 0.9, (rnd() - 0.5) * 1.1);
    g.add(p);
  }
  parent.add(g);
  column(I.x + lx, I.z + lz, 0.35 * s, I.y, I.y + 2 * s);
}
function rock(parent, lx, lz, s = 1, seed = 1) {
  const r = mesh(lowpoly(new THREE.DodecahedronGeometry(0.6, 0), 0.25, seed), mat(0x9aa1a8), { receive: true });
  r.position.set(lx, 0.15 * s, lz);
  r.scale.set(s, s * 0.7, s);
  r.rotation.y = seed;
  parent.add(r);
}
function monolith(parent, I, lx, lz, h, rotY = 0) {
  const geo = new THREE.BoxGeometry(2.6, h, 1.4, 1, 3, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) - (p.getX(i) > 0 ? 1.2 : 0));
  const m = mesh(lowpoly(geo.translate(0, h / 2, 0), 0.15, h * 7), mat(0x55606e), { receive: true });
  m.position.set(lx, 0, lz);
  m.rotation.y = rotY;
  parent.add(m);
  column(I.x + lx, I.z + lz, 1.4, I.y, I.y + h - 1.2, { kind: "prop" });
}

/* ---------- Islands ---------- */
const ISLANDS = [
  { id: "spawn", x: 0, y: 0, z: 0, r: 9 },
  { id: "profile", x: 0, y: 4, z: -40, r: 14 },
  { id: "about", x: -38, y: 8, z: -64, r: 8.5 },
  { id: "education", x: 38, y: 9, z: -66, r: 9 },
  { id: "experience", x: -46, y: 13, z: -104, r: 10 },
  { id: "skills", x: 46, y: 15, z: -106, r: 9.5 },
  { id: "projects", x: 0, y: 19, z: -136, r: 13 },
  { id: "contact", x: 0, y: 26, z: -176, r: 8.5 },
];
const byId = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));
const LINKS = [["spawn", "profile"], ["profile", "about"], ["profile", "education"], ["about", "experience"],
  ["education", "skills"], ["experience", "projects"], ["skills", "projects"], ["projects", "contact"]];

function islandBody(x, y, z, r, seed, { grass = 0x86c95c, layers = 3 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const segs = Math.max(7, Math.round(r * 1.3));
  g.add(mesh(lowpoly(new THREE.CylinderGeometry(r, r * 0.985, 0.8, segs, 1).translate(0, -0.4, 0), Math.min(0.3, r * 0.04), seed, 0), mat(grass), { receive: true }));
  const cols = [0xa7b196, 0x8f9a80, 0xa7b196];
  let yy = -0.8;
  for (let i = 0; i < layers; i++) {
    const h = i === 0 ? 1.2 : 1.0;
    const rr = r * (0.97 - i * 0.06);
    g.add(mesh(lowpoly(new THREE.CylinderGeometry(rr, rr * 0.95, h, segs, 1).translate(0, yy - h / 2, 0), Math.min(0.4, r * 0.05), seed + i + 1), mat(cols[i]), { cast: false }));
    yy -= h;
  }
  const coneDepth = r * 1.15;
  g.add(mesh(lowpoly(new THREE.ConeGeometry(r * 0.82, coneDepth, segs, 3).rotateX(Math.PI).translate(0, yy - coneDepth / 2, 0), r * 0.12, seed + 9), mat(0x6f7a68), { cast: false }));
  const rnd = rng(seed * 31);
  for (let i = 0; i < Math.max(1, Math.round(r / 2.5)); i++) {
    const a = rnd() * TAU, rr = r * (0.35 + rnd() * 0.35), h = 2 + rnd() * r * 0.5;
    g.add(mesh(lowpoly(new THREE.ConeGeometry(0.5 + rnd() * r * 0.08, h, 5).rotateX(Math.PI).translate(Math.cos(a) * rr, yy - h / 2 + 0.6, Math.sin(a) * rr), 0.2, seed + 20 + i), mat(0x67725f), { cast: false }));
  }
  scene.add(g);
  return { group: g, coneDepth };
}

function buildIsland(I, seed) {
  const { group, coneDepth } = islandBody(I.x, I.y, I.z, I.r, seed);
  I.group = group;
  I.solid = islandSolid(I.x, I.y, I.z, I.r, coneDepth, { kind: "island", island: I.id });
  const t = makeLabel(`${ISLANDS_CONTENT[I.id].emoji} ${ISLANDS_CONTENT[I.id].title}`, { size: 1.15 });
  t.position.set(I.x, I.y + (I.id === "profile" ? 21 : I.id === "contact" ? 14 : 9.5), I.z);
  scene.add(t);
  return group;
}

function steppingStones(a, b, seed) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const ux = dx / dist, uz = dz / dist;
  const L = dist - a.r - b.r + 1;
  const dy = b.y - a.y;
  const n = Math.max(1, Math.round((L - 2.5) / 5.6), Math.ceil(Math.abs(dy) / 1.5) - 1);
  const rnd = rng(seed);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const along = a.r - 0.5 + L * t;
    const side = (i % 2 ? 1 : -1) * (0.4 + rnd() * 0.5);
    const x = a.x + ux * along - uz * side, z = a.z + uz * along + ux * side;
    const y = a.y + dy * t;
    const r = 2.1 + rnd() * 0.5;
    const { coneDepth } = islandBody(x, y, z, r, seed * 10 + i, { layers: 1 });
    addSolid({ x, z, top: y, bottom: y - 2 - coneDepth, rTop: r, rAt: (d) => (d < 2 ? r * 0.95 : r * 0.8 * Math.max(0, 1 - (d - 2) / coneDepth)), kind: "stone" });
    sprinkleGrass(x, y, z, r * 0.8, 1.2, [], seed + i);
  }
}

// Decide every island's dressing.
let hubTree = null;
function dressIslands() {
  const S = byId.spawn, H = byId.profile, A = byId.about, E = byId.education,
    X = byId.experience, K = byId.skills, P = byId.projects, C = byId.contact;

  // --- Spawn: the Welcome Gate
  monolith(S.group, S, -5.5, -3, 7, 0.3);
  monolith(S.group, S, 6, -5.5, 9, -0.4);
  {
    const sign = new THREE.Group();
    sign.position.set(2.8, 0, 1.8);
    sign.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.2, 6).translate(0, 1.1, 0), mat(0x8a6b52)));
    sign.add(mesh(new THREE.BoxGeometry(2.2, 0.7, 0.14).translate(0, 1.85, 0), mat(0xc8a27a)));
    sign.rotation.y = -0.4;
    S.group.add(sign);
    column(S.x + 2.8, S.z + 1.8, 0.3, 0, 2.2);
    const l = makeLabel("Boypje World ➜", { size: 0.55, far: 60 });
    l.position.set(S.x + 2.8, 2.6, S.z + 1.8);
    scene.add(l);
  }
  station(S, -4.5, 3.5);
  tree(S.group, S, 5.8, 3.5, 1.1, 11); tree(S.group, S, -6.5, -0.5, 0.9, 12); tree(S.group, S, -6.2, 5.2, 0.8, 13, 0x92d46e);
  rock(S.group, 4, -2, 1.2, 3); rock(S.group, 3.5, 6.8, 0.8, 4); rock(S.group, -7, 4, 1, 5);
  sprinkleGrass(S.x, S.y, S.z, S.r, 3.2, [[-5.5, -3, 1.8], [6, -5.5, 1.8], [-4.5, 3.5, 1.1], [0, 4, 1.5], [0, 1, 1.5], [0, -2, 1.5], [0, -5, 1.5]], 101);
  // a dirt path toward the hub
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12).rotateX(-Math.PI / 2), mat(0xc9a77c));
  path.position.set(S.x, S.y + 0.02, S.z - 2.5);
  path.receiveShadow = renderer.shadowMap.enabled;
  scene.add(path);
  waterfall(S, 200); waterfall(S, 20, 1.3);

  // --- Profile: big red tree + framed photo
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -3);
    const bark = mat(0x8f9cab);
    g.add(mesh(lowpoly(new THREE.CylinderGeometry(1.3, 2.4, 13, 8, 3).translate(0, 6.5, 0), 0.35, 77), bark));
    const rnd = rng(78);
    const reds = [0xd9534a, 0xe0614f, 0xc94a40, 0xea7a63];
    const blob = (x, y, z, n, spread) => {
      for (let i = 0; i < n; i++) {
        const p = mesh(lowpoly(new THREE.IcosahedronGeometry(1.5 + rnd() * 1.2, 1), 0.3, 80 + i + Math.round(x * 10)), mat(reds[i % 4]));
        p.position.set(x + (rnd() - 0.5) * spread, y + (rnd() - 0.3) * spread * 0.6, z + (rnd() - 0.5) * spread);
        g.add(p);
      }
    };
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rnd() * 0.4, tilt = 0.75 + rnd() * 0.3, len = 6 + rnd() * 2, yb = 8.5 + rnd() * 2.5;
      const pivot = new THREE.Group();
      pivot.position.y = yb;
      pivot.rotation.y = a;
      const br = mesh(lowpoly(new THREE.CylinderGeometry(0.3, 0.7, len, 6).translate(0, len / 2, 0), 0.1, 90 + i), bark);
      br.rotation.z = -tilt;
      pivot.add(br);
      g.add(pivot);
      const ex = Math.sin(tilt) * len, ey = Math.cos(tilt) * len;
      blob(Math.cos(a) * ex, yb + ey + 0.6, -Math.sin(a) * ex, 4, 3.4);
      if (i % 2 === 0) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0).scale(1, 1.6, 1), new THREE.MeshBasicMaterial({ color: 0x9ff0ff }));
        c.position.set(Math.cos(a) * ex * 0.6, yb + ey * 0.6 - 0.6, -Math.sin(a) * ex * 0.6);
        g.add(c);
      }
    }
    blob(0, 17, 0, 6, 4);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      const root = mesh(lowpoly(new THREE.ConeGeometry(0.9, 3.4, 5).translate(0, 1.7, 0), 0.1, 95 + i), bark);
      root.position.set(Math.cos(a) * 1.9, -0.3, Math.sin(a) * 1.9);
      root.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      g.add(root);
    }
    // a little glowing door, like the tree is someone's home
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ color: 0xffc56b }));
    door.position.set(0, 3.2, 1.62);
    door.rotation.x = -0.1;
    g.add(door);
    H.group.add(g);
    column(H.x, H.z - 3, 2.6, H.y, H.y + 13);
    hubTree = new THREE.Vector3(H.x, H.y, H.z - 3);
  }
  {
    const f = new THREE.Group();
    f.position.set(0, 0, 6);
    const wood = mat(0x8a6b52);
    f.add(mesh(new THREE.CylinderGeometry(0.15, 0.18, 6.4, 6).translate(-2.4, 3.2, -0.1), wood));
    f.add(mesh(new THREE.CylinderGeometry(0.15, 0.18, 6.4, 6).translate(2.4, 3.2, -0.1), wood));
    f.add(mesh(new THREE.BoxGeometry(4.7, 4.7, 0.3).translate(0, 4.2, 0), mat(0xb98b5e)));
    const tex = loadTex("assets/profile_thumb.jpg");
    tex.repeat.set(0.72, 0.72);
    tex.offset.set(0.14, 0.27);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: tex }));
    photo.position.set(0, 4.2, 0.16);
    f.add(photo);
    f.add(mesh(new THREE.ConeGeometry(3.6, 1, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.35).translate(0, 7, 0), mat(0xc94a40)));
    H.group.add(f);
    column(H.x - 2.4, H.z + 6, 0.35, H.y, H.y + 6.4);
    column(H.x + 2.4, H.z + 6, 0.35, H.y, H.y + 6.4);
    const l = makeLabel("Primula Juventauricula", { size: 0.62, sub: "Full-stack dev · Data engineer", far: 90 });
    l.position.set(H.x, H.y + 7.9, H.z + 6.3);
    scene.add(l);
  }
  station(H, -7, 5);
  beam("profile", H.x + 9, H.y, H.z - 8);
  tree(H.group, H, 9, 4, 1.2, 21); tree(H.group, H, -9, -4, 1.1, 22); tree(H.group, H, 7, -8, 0.9, 23, 0xd24c43);
  tree(H.group, H, -10, 3, 0.8, 24); tree(H.group, H, 3, 11, 0.7, 25, 0x92d46e);
  rock(H.group, -4, 9, 1.4, 6); rock(H.group, 11, -2, 1.1, 7); rock(H.group, -6, -9, 1.3, 8); rock(H.group, 5, 8, 0.8, 9);
  sprinkleGrass(H.x, H.y, H.z, H.r, 3.2, [[0, -3, 3.3], [-7, 5, 1.1], [0, 6.5, 1.2], [0, 10, 1.6], [0, 13, 1.6]], 102);
  waterfall(H, 160); waterfall(H, 330, 2); waterfall(H, 25, 1.2);

  // --- About: lectern with a glowing book, bench, lantern
  {
    const g = new THREE.Group();
    g.add(mesh(lowpoly(new THREE.CylinderGeometry(0.35, 0.5, 1.3, 6).translate(0, 0.65, 0), 0.05, 31), mat(0x9aa3ad)));
    const top = mesh(new THREE.BoxGeometry(1.6, 0.18, 1.1).translate(0, 0, 0), mat(0x8a6b52));
    top.position.y = 1.4; top.rotation.x = 0.35;
    g.add(top);
    const book = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.9), new THREE.MeshToonMaterial({ color: 0xfff7e0, emissive: 0xffe2a0, emissiveIntensity: 0.6, gradientMap }));
    book.position.set(0, 1.53, 0.03); book.rotation.x = 0.35;
    g.add(book);
    g.rotation.y = Math.atan2(H.x - A.x, H.z - A.z);
    A.group.add(g);
    column(A.x, A.z, 0.6, A.y, A.y + 1.5);
    const bench = new THREE.Group();
    bench.position.set(-3.2, 0, 2.6);
    bench.add(mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7).translate(0, 0.6, 0), mat(0xb98b5e)));
    bench.add(mesh(new THREE.BoxGeometry(0.18, 0.6, 0.6).translate(-1, 0.3, 0), mat(0x8a6b52)));
    bench.add(mesh(new THREE.BoxGeometry(0.18, 0.6, 0.6).translate(1, 0.3, 0), mat(0x8a6b52)));
    bench.rotation.y = 0.6;
    A.group.add(bench);
    column(A.x - 3.2, A.z + 2.6, 1, A.y, A.y + 0.7);
    const lamp = new THREE.Group();
    lamp.position.set(2.6, 0, 2.4);
    lamp.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6).translate(0, 1.2, 0), mat(0x3e4450)));
    lamp.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42).translate(0, 2.55, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a })));
    A.group.add(lamp);
    column(A.x + 2.6, A.z + 2.4, 0.25, A.y, A.y + 2.6);
  }
  station(A, 3.5, -3.5);
  tree(A.group, A, -5, -3, 1, 31); tree(A.group, A, 1, -6, 0.9, 32, 0xd24c43); tree(A.group, A, -2, 6, 0.8, 33);
  rock(A.group, 5.5, 1, 1, 10); rock(A.group, -6, 1.5, 0.9, 11);
  sprinkleGrass(A.x, A.y, A.z, A.r, 3.2, [[0, 0, 1], [3.5, -3.5, 1.1], [-3.2, 2.6, 1.3]], 103);
  waterfall(A, 190, 1.4);

  // --- Education: graduation cap on a pedestal, books, ruin arch
  {
    const g = new THREE.Group();
    g.add(mesh(lowpoly(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 8).translate(0, 0.6, 0), 0.08, 41), mat(0xd9dde2)));
    const cap = new THREE.Group();
    cap.add(mesh(new THREE.BoxGeometry(2.4, 0.14, 2.4), mat(0x1f2430)));
    cap.add(mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.55, 12).translate(0, -0.33, 0), mat(0x1f2430)));
    cap.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).translate(1.1, -0.38, 1.1), mat(0xffcf5a)));
    cap.add(mesh(new THREE.SphereGeometry(0.1, 6, 4).translate(0, 0.1, 0), mat(0xffcf5a)));
    cap.position.y = 2.5;
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    crystals.push(Object.assign(cap, { userData: { baseY: 2.5, slow: true } }));
    E.group.add(g);
    column(E.x, E.z, 1.3, E.y, E.y + 1.2);
    const books = [[0x3d8fd6, 0.25], [0xe0614f, 0.22], [0xffcf5a, 0.2], [0x6cbb5f, 0.24]];
    let by = 0;
    books.forEach(([c, h], i) => {
      const b = mesh(new THREE.BoxGeometry(1.3, h, 0.95), mat(c));
      b.position.set(3, by + h / 2, 1.8);
      b.rotation.y = i * 0.25;
      E.group.add(b);
      by += h;
    });
    column(E.x + 3, E.z + 1.8, 0.8, E.y, E.y + by);
    const arch = new THREE.Group();
    arch.position.set(-1, 0, 5.2);
    arch.rotation.y = Math.atan2(H.x - E.x, H.z - E.z) - Math.PI * 0.1;
    const stone = mat(0xd5d0c4);
    arch.add(mesh(lowpoly(new THREE.BoxGeometry(0.9, 4.2, 0.9).translate(-2, 2.1, 0), 0.1, 42), stone));
    arch.add(mesh(lowpoly(new THREE.BoxGeometry(0.9, 3.2, 0.9).translate(2, 1.6, 0), 0.1, 43), stone));
    arch.add(mesh(lowpoly(new THREE.BoxGeometry(5.4, 0.7, 1.1).translate(-0.2, 4.4, 0).rotateZ(-0.06), 0.1, 44), stone));
    E.group.add(arch);
    const ax = Math.cos(arch.rotation.y), az = -Math.sin(arch.rotation.y);
    column(E.x - 1 - 2 * ax, E.z + 5.2 - 2 * az, 0.6, E.y, E.y + 4.2);
    column(E.x - 1 + 2 * ax, E.z + 5.2 + 2 * az, 0.6, E.y, E.y + 3.2);
    const l = makeLabel("Brawijaya University", { size: 0.6, sub: "B.Sc. Computer Science · GPA 3.72", far: 80 });
    l.position.set(E.x, E.y + 4.1, E.z);
    scene.add(l);
  }
  station(E, -4, -3.5);
  tree(E.group, E, 5, -4, 1, 41); tree(E.group, E, -6, 1, 0.9, 42, 0x92d46e); tree(E.group, E, 1.5, -6.5, 0.8, 43, 0xd24c43);
  rock(E.group, 6, 3, 1, 12); rock(E.group, -2, -6, 0.8, 13);
  sprinkleGrass(E.x, E.y, E.z, E.r, 3.2, [[0, 0, 1.6], [-4, -3.5, 1.1], [3, 1.8, 1]], 104);
  waterfall(E, 340, 1.6);

  // --- Experience: timeline pillars you can climb, oldest → newest
  {
    const steps = ["2022 · Lecture Assistant", "2022 · Altari POS Lead", "2023 · Software Tester", "2024 · IT Staff", "2025 · System & IT Admin"];
    const rocks = [0xb7bcc2, 0xaab0b8, 0x9ca4ae, 0x8e98a4, 0x7f8b99];
    steps.forEach((t, i) => {
      const a = Math.PI * (0.15 + i * 0.175) + Math.PI;
      const lx = Math.cos(a) * 5.4, lz = Math.sin(a) * 5.4 - 0.5;
      const h = 1.3 + i * 1.25;
      const p = mesh(lowpoly(new THREE.CylinderGeometry(1.15, 1.3, h, 6).translate(0, h / 2, 0), 0.06, 50 + i, h), mat(rocks[i]), { receive: true });
      p.position.set(lx, 0, lz);
      X.group.add(p);
      column(X.x + lx, X.z + lz, 1.2, X.y, X.y + h, { kind: "pillar", rTop: 1.15 });
      const l = makeLabel(t, { size: 0.5, far: 70, bg: i === 4 ? "rgba(255,236,170,0.95)" : "rgba(255,255,255,0.92)" });
      l.position.set(X.x + lx, X.y + h + 2.3, X.z + lz);
      scene.add(l);
    });
  }
  station(X, 3.5, 4);
  tree(X.group, X, -6, 4, 1, 51); tree(X.group, X, 7, -2, 1.1, 52, 0xd24c43); tree(X.group, X, -1, 7.5, 0.8, 53);
  rock(X.group, 5, 6, 1, 14); rock(X.group, -7.5, 0, 1.2, 15);
  sprinkleGrass(X.x, X.y, X.z, X.r, 3.2, [[3.5, 4, 1.1]], 105);
  waterfall(X, 150, 1.8);

  // --- Skills: crystal bars sized by proficiency
  {
    const groups = [["Code", 77, 0x67e0ff], ["Data", 82, 0xa98bff], ["Infra", 82, 0x6ee7a8], ["Automation", 80, 0xffc96b]];
    groups.forEach(([name, pct, col], i) => {
      const a = (i / 4) * TAU + Math.PI / 4;
      const lx = Math.cos(a) * 5, lz = Math.sin(a) * 5;
      const cm = new THREE.MeshToonMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, gradientMap });
      const h = (pct / 100) * 6.5;
      const main = mesh(new THREE.CylinderGeometry(0, 0.75, 1.2, 6).translate(0, h + 0.6, 0), cm);
      main.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, h, 6).translate(0, h / 2, 0), cm));
      main.position.set(lx, 0, lz);
      K.group.add(main);
      for (let j = 0; j < 3; j++) {
        const s = mesh(new THREE.OctahedronGeometry(0.4 + j * 0.1, 0).scale(1, 2.2, 1), cm);
        const b = a + (j - 1) * 0.5;
        s.position.set(lx + Math.cos(b) * 1.2, 0.6, lz + Math.sin(b) * 1.2);
        s.rotation.set((j - 1) * 0.4, 0, (j - 1) * 0.3);
        K.group.add(s);
      }
      column(K.x + lx, K.z + lz, 1.1, K.y, K.y + h + 1.2);
      const l = makeLabel(`${name} ${pct}%`, { size: 0.55, far: 70 });
      l.position.set(K.x + lx, K.y + h + 2, K.z + lz);
      scene.add(l);
    });
  }
  station(K, 0, 0);
  tree(K.group, K, 7, 2, 0.9, 61); tree(K.group, K, -7, -2, 1, 62, 0x92d46e); tree(K.group, K, 0, -7.5, 0.8, 63, 0xd24c43);
  sprinkleGrass(K.x, K.y, K.z, K.r, 3.2, [[0, 0, 1.1]], 106);
  waterfall(K, 30, 1.5);

  // --- Projects: four billboards on stilts (walk underneath)
  PROJECTS.forEach((p, i) => {
    const deg = [-72, -28, 28, 72][i];
    const a = (deg * Math.PI) / 180;
    const lx = Math.sin(a) * 9, lz = -Math.cos(a) * 9;
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = Math.atan2(-lx, -lz);
    const wood = mat(0x8a6b52);
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.8, 6).translate(-2.7, 2.9, -0.12), wood));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.8, 6).translate(2.7, 2.9, -0.12), wood));
    g.add(mesh(new THREE.BoxGeometry(6, 3.6, 0.22).translate(0, 4, -0.12), mat(0xf4f1ea)));
    const img = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.15), new THREE.MeshBasicMaterial({ map: loadTex(p.img) }));
    img.position.set(0, 4, 0.01);
    g.add(img);
    P.group.add(g);
    const c = Math.cos(g.rotation.y), s = -Math.sin(g.rotation.y);
    column(P.x + lx - 2.7 * c, P.z + lz - 2.7 * s, 0.3, P.y, P.y + 5.8);
    column(P.x + lx + 2.7 * c, P.z + lz + 2.7 * s, 0.3, P.y, P.y + 5.8);
    const l = makeLabel(p.title.replace(/ (for|&) .*/, "").replace("Rent Car Operational", "Rent Car System"), { size: 0.5, far: 80 });
    l.position.set(P.x + lx, P.y + 6.2, P.z + lz);
    scene.add(l);
  });
  station(P, 0, 2);
  tree(P.group, P, -9, 6, 1.1, 71); tree(P.group, P, 9.5, 5, 1, 72, 0xd24c43); tree(P.group, P, -4, 10, 0.8, 73); tree(P.group, P, 5, 10.5, 0.8, 74, 0x92d46e);
  rock(P.group, -11, -1, 1.2, 16); rock(P.group, 11, -2, 1, 17);
  sprinkleGrass(P.x, P.y, P.z, P.r, 3.2, [[0, 2, 1.1]], 107);
  waterfall(P, 130, 2); waterfall(P, 50, 1.4);

  // --- Contact: lighthouse + mailbox
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -3.2);
    g.add(mesh(lowpoly(new THREE.CylinderGeometry(2.1, 2.4, 1.2, 8).translate(0, 0.6, 0), 0.1, 81), mat(0x9aa3ad)));
    g.add(mesh(new THREE.CylinderGeometry(1.0, 1.45, 8, 10).translate(0, 5.2, 0), mat(0xf3efe6)));
    g.add(mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.1, 10).translate(0, 4.2, 0), mat(0xd9534a)));
    g.add(mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 10).translate(0, 9.3, 0), mat(0x3e4450)));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 10).translate(0, 10.2, 0), new THREE.MeshBasicMaterial({ color: 0xfff1b0 })));
    g.add(mesh(new THREE.ConeGeometry(1.25, 1.3, 10).translate(0, 11.6, 0), mat(0xd9534a)));
    C.group.add(g);
    column(C.x, C.z - 3.2, 2.3, C.y, C.y + 12.3);
    beam("contact", C.x, C.y + 11, C.z - 3.2);
    const mb = new THREE.Group();
    mb.position.set(3, 0, 2.5);
    mb.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6).translate(0, 0.6, 0), mat(0x8a6b52)));
    mb.add(mesh(new THREE.BoxGeometry(0.55, 0.5, 0.9).translate(0, 1.4, 0), mat(0x3d8fd6)));
    mb.add(mesh(new THREE.BoxGeometry(0.05, 0.45, 0.12).translate(0.3, 1.65, -0.2), mat(0xd9534a)));
    mb.rotation.y = 0.5;
    C.group.add(mb);
    column(C.x + 3, C.z + 2.5, 0.45, C.y, C.y + 1.6);
    const l = makeLabel("primulajuve@gmail.com", { size: 0.5, far: 60 });
    l.position.set(C.x + 3, C.y + 2.2, C.z + 2.5);
    scene.add(l);
  }
  station(C, -3, 2.5);
  tree(C.group, C, -5.5, -2, 0.9, 81); tree(C.group, C, 5.5, -3, 0.8, 82, 0xd24c43);
  sprinkleGrass(C.x, C.y, C.z, C.r, 3.2, [[0, -3.2, 2.6], [-3, 2.5, 1.1]], 108);
  waterfall(C, 90, 1.5);
}

// Far-away decorative islands for depth.
function backdropIslands() {
  const spots = [[-95, 6, -40, 7], [100, 18, -30, 9], [-110, 28, -150, 10], [115, 4, -165, 8], [-50, 42, -235, 11],
    [65, 34, -240, 9], [-70, -6, 40, 6], [80, 0, 45, 7], [0, 46, -270, 8], [-150, 14, -95, 6], [150, 26, -110, 7]];
  spots.forEach(([x, y, z, r], i) => {
    const I = { x, y, z, r };
    const { group } = islandBody(x, y, z, r, 500 + i);
    const n = 1 + (i % 3);
    for (let j = 0; j < n; j++) {
      const a = j * 2.1 + i, d = r * 0.45;
      tree(group, I, Math.cos(a) * d, Math.sin(a) * d, 1 + (j % 2) * 0.4, 600 + i * 5 + j);
    }
    if (i % 2 === 0) waterfall(I, i * 47, 1.2);
    if (i % 3 === 0) {
      const ruin = mesh(lowpoly(new THREE.BoxGeometry(1, 3.5, 1).translate(0, 1.75, 0), 0.1, i), mat(0xd5d0c4));
      ruin.position.set(r * 0.3, 0, -r * 0.3);
      group.add(ruin);
    }
  });
}

/* ---------- Clouds ---------- */
function buildClouds() {
  const puffs = [];
  const rnd = rng(99);
  const cloud = (cx, cy, cz, size) => {
    const n = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const s = size * (0.55 + (1 - Math.abs(t) * 1.4) * 0.6 + rnd() * 0.2);
      puffs.push([cx + t * size * 3.4 + (rnd() - 0.5) * size, cy + (rnd() - 0.2) * size * 0.4, cz + (rnd() - 0.5) * size * 1.2, s]);
    }
  };
  const step = lowPower ? 42 : 30;
  for (let x = -260; x <= 260; x += step)
    for (let z = -360; z <= 160; z += step) cloud(x + (rnd() - 0.5) * step, -38 + (rnd() - 0.5) * 8, z + (rnd() - 0.5) * step, 6 + rnd() * 5);
  for (let i = 0; i < (lowPower ? 18 : 30); i++) {
    const a = rnd() * TAU, d = 70 + rnd() * 190;
    cloud(Math.cos(a) * d, -10 + rnd() * 60, -90 + Math.sin(a) * d * 1.2, 3 + rnd() * 4);
  }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, lowPower ? 1 : 2), mat(0xffffff, { emissive: 0xa9bed3, emissiveIntensity: 0.45 }), puffs.length);
  const o = new THREE.Object3D();
  puffs.forEach(([x, y, z, s], i) => {
    o.position.set(x, y, z);
    o.scale.set(s, s * 0.72, s);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  const field = new THREE.Group();
  field.add(im);
  field.position.set(0, 0, -90);
  im.position.set(0, 0, 90);
  scene.add(field);
  return field;
}

/* ---------- Falling petals ---------- */
const PETALS = lowPower ? 90 : 170;
const petalMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 0.15), new THREE.MeshBasicMaterial({ color: 0xe0574a, side: THREE.DoubleSide }), PETALS);
petalMesh.frustumCulled = false;
const petals = [];
function resetPetal(p, around, spread) {
  p.pos.set(around.x + (R() - 0.5) * spread, around.y + 8 + R() * 10, around.z + (R() - 0.5) * spread);
  p.rot.set(R() * TAU, R() * TAU, R() * TAU);
  p.spin = 1 + R() * 2.5;
  p.fall = 0.9 + R() * 0.9;
  p.floor = around.y - 4;
}

/* ---------- Player: a brick-style minifig in East Java civil-servant (ASN) khaki ---------- */
function patchTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 80;
  const x = c.getContext("2d");
  const shield = (i) => {
    x.beginPath();
    x.moveTo(4 + i, 4 + i); x.lineTo(60 - i, 4 + i); x.lineTo(60 - i, 46);
    x.quadraticCurveTo(60 - i, 70 - i, 32, 78 - i * 1.4);
    x.quadraticCurveTo(4 + i, 70 - i, 4 + i, 46);
    x.closePath();
  };
  x.fillStyle = "#e7c24a"; shield(0); x.fill();
  x.fillStyle = "#2b63c4"; shield(5); x.fill();
  x.fillStyle = "#3f9a4a"; x.fillRect(12, 52, 40, 8);
  x.fillStyle = "#ffffff";
  x.beginPath(); x.moveTo(32, 14); x.lineTo(37, 26); x.lineTo(35, 54); x.lineTo(29, 54); x.lineTo(27, 26); x.closePath(); x.fill();
  x.fillStyle = "#e7c24a"; x.fillRect(18, 60, 28, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.72; // hip pivot
  root.add(body);
  const khaki = mat(0xb9a374), khakiDark = mat(0x9e8a5c), yellow = mat(0xf6c915), black = mat(0x18191d),
    hairM = mat(0x2a2c33), silver = mat(0xc9ced6), gold = mat(0xe3b53a);

  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.15, 0, 0);
    p.add(mesh(new THREE.BoxGeometry(0.28, 0.56, 0.32).translate(0, -0.3, 0), khaki));
    p.add(mesh(new THREE.BoxGeometry(0.29, 0.14, 0.38).translate(0, -0.65, 0.03), black));
    body.add(p);
    return p;
  });
  body.add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.32).translate(0, 0.04, 0), khaki));

  // torso: the classic trapezoid
  const tg = new THREE.BoxGeometry(0.62, 0.6, 0.3);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) tp.setX(i, tp.getX(i) * 0.78);
  tg.translate(0, 0.4, 0);
  tg.computeVertexNormals();
  body.add(mesh(tg, khaki));
  const detail = (geo, m, x, y, z, rz = 0) => { const d = mesh(geo, m, { cast: false }); d.position.set(x, y, z); d.rotation.z = rz; body.add(d); return d; };
  detail(new THREE.BoxGeometry(0.64, 0.075, 0.32), black, 0, 0.14, 0);
  detail(new THREE.BoxGeometry(0.11, 0.06, 0.03), silver, 0, 0.14, 0.16);
  detail(new THREE.BoxGeometry(0.022, 0.46, 0.012), khakiDark, 0, 0.42, 0.153);
  [0.27, 0.37, 0.47, 0.57].forEach((y) => detail(new THREE.BoxGeometry(0.025, 0.025, 0.014), khakiDark, 0, y, 0.158));
  [-1, 1].forEach((s) => {
    detail(new THREE.BoxGeometry(0.15, 0.11, 0.014), khakiDark, s * 0.13, 0.43, 0.155);
    detail(new THREE.BoxGeometry(0.16, 0.035, 0.02), khakiDark, s * 0.13, 0.49, 0.157);
    detail(new THREE.BoxGeometry(0.15, 0.06, 0.05), khakiDark, s * 0.075, 0.685, 0.12, s * 0.55);
    detail(new THREE.BoxGeometry(0.12, 0.035, 0.2), khaki, s * 0.215, 0.705, 0);
  });
  detail(new THREE.BoxGeometry(0.12, 0.03, 0.012), black, -0.13, 0.555, 0.157);
  detail(new THREE.BoxGeometry(0.05, 0.05, 0.012), gold, 0.13, 0.565, 0.157);

  const patch = new THREE.MeshBasicMaterial({ map: patchTexture(), transparent: true });
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.29, 0.6, 0);
    const a = new THREE.Group();
    a.rotation.z = s * 0.12;
    a.add(mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.24, 12).translate(0, -0.1, 0), khaki));
    const fore = mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.2, 10).translate(0, -0.09, 0), yellow);
    fore.position.set(0, -0.2, 0);
    fore.rotation.x = -0.35;
    a.add(fore);
    const hand = mesh(new THREE.TorusGeometry(0.062, 0.03, 8, 14, Math.PI * 1.55), yellow);
    hand.position.set(0, -0.4, 0.09);
    hand.rotation.set(-0.35, s * Math.PI / 2, Math.PI * 1.22);
    a.add(hand);
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.14), patch);
    ph.position.set(s * 0.112, -0.1, 0);
    ph.rotation.y = s * Math.PI / 2;
    a.add(ph);
    p.add(a);
    body.add(p);
    return p;
  });

  body.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10).translate(0, 0.73, 0), yellow));
  const head = new THREE.Group();
  head.position.y = 0.76;
  const prof = [[0, 0], [0.19, 0], [0.214, 0.025], [0.222, 0.07], [0.222, 0.25], [0.214, 0.295], [0.19, 0.32], [0, 0.32]].map(([a, b]) => new THREE.Vector2(a, b));
  head.add(mesh(new THREE.LatheGeometry(prof, 28), yellow));
  const ink = new THREE.MeshBasicMaterial({ color: 0x141414 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8).scale(1, 1.25, 0.45), ink);
    eye.position.set(s * 0.075, 0.165, 0.204);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), white);
    glint.position.set(s * 0.075 + 0.009, 0.177, 0.216);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.013, 0.01), ink);
    brow.position.set(s * 0.078, 0.222, 0.206);
    brow.rotation.z = -s * 0.12;
    head.add(eye, glint, brow);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 18, Math.PI * 0.75), ink);
  smile.position.set(0, 0.125, 0.212);
  smile.rotation.z = Math.PI + Math.PI * 0.125;
  head.add(smile);

  // voluminous, wavy black hair
  const hair = new THREE.Group();
  hair.add(mesh(new THREE.SphereGeometry(0.256, 22, 16).scale(1.04, 0.92, 1.04).translate(0, 0.31, -0.05), hairM));
  hair.add(mesh(new THREE.CylinderGeometry(0.233, 0.236, 0.27, 22, 1, false, Math.PI * 0.55, Math.PI * 0.9).translate(0, 0.19, -0.005), hairM));
  [-1, 1].forEach((s) => {
    const burn = mesh(new THREE.BoxGeometry(0.05, 0.13, 0.1), hairM);
    burn.position.set(s * 0.205, 0.225, 0.04);
    hair.add(burn);
  });
  const rnd = rng(42);
  const lump = (x, y, z, r, rotY = 0) => {
    const b = mesh(new THREE.SphereGeometry(r, 12, 9).scale(1.15, 0.78, 1), hairM);
    b.position.set(x, y, z);
    b.rotation.set((rnd() - 0.5) * 0.5, rotY, (rnd() - 0.5) * 0.5);
    hair.add(b);
  };
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rnd() * 0.25;
    lump(Math.sin(a) * 0.2, 0.4 + rnd() * 0.07, Math.cos(a) * 0.2 - 0.04, 0.09 + rnd() * 0.04, a);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    lump(Math.sin(a) * 0.1, 0.46 + rnd() * 0.03, Math.cos(a) * 0.1 - 0.03, 0.1 + rnd() * 0.02, a);
  }
  // front quiff sweeping up and to one side
  [[-0.09, 0.42, 0.15, 0.1], [0.02, 0.45, 0.16, 0.11], [0.12, 0.43, 0.12, 0.09], [-0.03, 0.49, 0.09, 0.11]].forEach(([x, y, z, r]) => lump(x, y, z, r));
  head.add(hair);
  body.add(head);
  root.scale.setScalar(1.12);
  return { root, body, legs, arms, head };
}

const player = buildPlayer();
scene.add(player.root);
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1b2a3a, transparent: true, opacity: 0.28, depthWrite: false }));
scene.add(blob);
let nameTag = null;
function setNameTag(name) {
  if (nameTag) { player.root.remove(nameTag); const i = labels.findIndex((l) => l.sprite === nameTag); if (i >= 0) labels.splice(i, 1); }
  nameTag = makeLabel(name, { size: 0.3, far: 999, bg: "rgba(23,25,31,0.72)", color: "#ffffff" });
  nameTag.position.y = 2.15;
  player.root.add(nameTag);
}

const SPAWN = new THREE.Vector3(0, 0, 5);
const P = {
  pos: SPAWN.clone(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0,
  grounded: false, flying: false, coyote: 0, buffer: 0, airJumps: 1, gliding: false,
  phase: 0, flip: 0, runT: 0, ground: null, safe: SPAWN.clone(), island: null,
};
const G = 32, JUMP = 12.5, DJUMP = 11, WALK = 8, RUN = 12, FLY = 19, FLY_V = 9;

/* ---------- Input ---------- */
const keys = {};
const joy = { x: 0, y: 0, id: null, bx: 0, by: 0 };
const held = { jump: false, down: false };
let lastCamInput = 0;
// camYaw / camPitch / camDist are what input asks for; the *S versions are smoothed and drive the view.
let camYaw = 0, camPitch = 0.32, camDist = 10;
let yawS = 0, pitchS = 0.32, distS = 10;
const PITCH_LEVEL = 0.32;
const pitchMin = () => (P.flying ? -0.9 : -0.15);
const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

addEventListener("keydown", (e) => {
  if (typing(e)) return;
  if (state !== "play") return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === "Space") P.buffer = 0.14;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyF") toggleFly();
  if (e.code === "KeyE" || e.code === "Enter") { if (P.island) openPanel(P.island); }
  if (e.code === "KeyM") toggleMap();
  if (e.code === "KeyN") toggleSound();
  if (e.code === "Escape") closeTop();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; held.jump = held.down = false; });

const capture = (el, id) => { try { el.setPointerCapture(id); } catch {} };
const ptrs = new Map();
let pinch = 0;
canvas.addEventListener("pointerdown", (e) => {
  capture(canvas, e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  lastCamInput = performance.now();
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p || state !== "play") return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    const s = e.pointerType === "touch" ? 0.008 : 0.005;
    camYaw -= dx * s;
    camPitch = THREE.MathUtils.clamp(camPitch + dy * s * 0.75, pitchMin(), 1.25);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) camDist = THREE.MathUtils.clamp(camDist * (pinch / d), 4, 24);
    pinch = d;
  }
  lastCamInput = performance.now();
});
const endPtr = (e) => { ptrs.delete(e.pointerId); pinch = 0; };
canvas.addEventListener("pointerup", endPtr);
canvas.addEventListener("pointercancel", endPtr);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  camDist = THREE.MathUtils.clamp(camDist * (1 + e.deltaY * 0.001), 4, 24);
}, { passive: false });

// Virtual joystick: it appears wherever the left thumb lands.
const joyEl = $("joy"), knob = $("knob"), joyZone = $("joyZone");
const JOY_R = 50;
function joyHome() {
  joyEl.style.left = "90px";
  joyEl.style.top = `${innerHeight - 120}px`;
}
joyHome();
joyZone.addEventListener("pointerdown", (e) => {
  joy.id = e.pointerId;
  capture(joyZone, e.pointerId);
  joy.bx = e.clientX; joy.by = e.clientY;
  joyEl.style.left = `${e.clientX}px`;
  joyEl.style.top = `${e.clientY}px`;
  joyEl.classList.add("active");
});
joyZone.addEventListener("pointermove", (e) => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / JOY_R; joy.y = -dy / JOY_R;
});
const joyEnd = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0;
  knob.style.transform = "";
  joyEl.classList.remove("active");
  joyHome();
};
joyZone.addEventListener("pointerup", joyEnd);
joyZone.addEventListener("pointercancel", joyEnd);

function holdButton(el, onDown, onUp) {
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); capture(el, e.pointerId); el.classList.add("press"); onDown(); });
  const up = () => { el.classList.remove("press"); onUp?.(); };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}
holdButton($("btnJump"), () => { held.jump = true; P.buffer = 0.14; }, () => { held.jump = false; });
holdButton($("btnDown"), () => { held.down = true; }, () => { held.down = false; });
holdButton($("btnFly"), () => toggleFly());

let flyHinted = false;
function toggleFly() {
  P.flying = !P.flying;
  P.flying ? sfx.flyOn() : sfx.flyOff();
  if (P.flying) {
    P.vel.y = Math.max(P.vel.y, 7);
    P.grounded = false;
    // start level: the camera's current tilt becomes "straight ahead"
    if (camPitch > 0.75) camPitch = PITCH_LEVEL;
    if (!flyHinted) {
      flyHinted = true;
      toast(touchUI ? "☁️ Flying! Swipe up/down to aim, the stick flies where you look." : "☁️ Flying! W flies where the camera looks. Drag the mouse up to climb, down to dive. Shift to land.", 5200);
    }
  } else {
    camPitch = Math.max(camPitch, -0.15);
  }
  document.body.classList.toggle("flying", P.flying);
  $("btnFly").classList.toggle("on", P.flying);
  $("jumpLbl").textContent = P.flying ? "Up" : "Jump";
}

/* ---------- Physics ---------- */
const fwd = new THREE.Vector3();
const inp = { x: 0, z: 0, mag: 0 };
function readInput() {
  let x = joy.x, z = joy.y;
  if (state === "play" && !mapOpen) {
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyW || keys.ArrowUp) z += 1;
    if (keys.KeyS || keys.ArrowDown) z -= 1;
  } else x = z = 0;
  const m = Math.hypot(x, z);
  if (m > 1) { x /= m; z /= m; }
  inp.x = x; inp.z = z; inp.mag = Math.min(1, m);
  const fx = -Math.sin(yawS), fz = -Math.cos(yawS), rx = Math.cos(yawS), rz = -Math.sin(yawS);
  fwd.set(fx * z + rx * x, 0, fz * z + rz * x);
  return inp;
}

function groundBelow(x, z, fromY) {
  let best = null;
  for (const s of solids) {
    if (s.top > fromY + 0.01) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.rTop + 0.15 && (!best || s.top > best.top)) best = s;
  }
  return best;
}

const flyAim = new THREE.Vector3();
function updatePlayer(dt) {
  readInput();
  const up = keys.Space || held.jump;
  const down = keys.KeyC || keys.ControlLeft || keys.KeyQ || held.down;
  const v = P.vel;
  P.prev.copy(P.pos);
  if (P.respawning) { v.set(0, 0, 0); animatePlayer(dt); return; }

  if (P.flying) {
    // fly along the camera's aim: level camera = level flight, tilt up to climb, down to dive
    const e = THREE.MathUtils.clamp((PITCH_LEVEL - pitchS) * 1.5, -1.3, 1.3);
    const ce = Math.cos(e), se = Math.sin(e);
    const fx = -Math.sin(yawS), fz = -Math.cos(yawS), rx = Math.cos(yawS), rz = -Math.sin(yawS);
    flyAim.set(fx * ce * inp.z + rx * inp.x, se * inp.z, fz * ce * inp.z + rz * inp.x);
    if (flyAim.lengthSq() > 1) flyAim.normalize();
    flyAim.multiplyScalar(FLY);
    flyAim.y += ((up ? 1 : 0) - (down ? 1 : 0)) * FLY_V;
    const k = damp(2.6, dt);
    v.x += (flyAim.x - v.x) * k;
    v.y += (flyAim.y - v.y) * k;
    v.z += (flyAim.z - v.z) * k;
    P.buffer = 0; // jump presses while flying mean "go up", never a queued jump
  } else {
    // ease into a run after moving for a moment
    P.runT = inp.mag > 0.3 && P.grounded ? P.runT + dt : inp.mag > 0.3 ? P.runT : 0;
    const sp = WALK + (RUN - WALK) * THREE.MathUtils.smoothstep(P.runT, 0.5, 1.4);
    const accel = P.grounded ? (inp.mag > 0.05 ? 9 : 13) : 3.5;
    const k = damp(accel, dt);
    v.x += (fwd.x * sp - v.x) * k;
    v.z += (fwd.z * sp - v.z) * k;
    P.coyote = P.grounded ? 0.12 : P.coyote - dt;
    P.buffer -= dt;
    if (P.buffer > 0) {
      if (P.coyote > 0) { v.y = JUMP; P.coyote = 0; P.buffer = 0; P.grounded = false; sfx.jump(); }
      else if (P.airJumps > 0) { v.y = DJUMP; P.airJumps--; P.buffer = 0; P.flip = 1; sfx.doubleJump(); }
    }
    v.y -= G * dt;
    P.gliding = !P.grounded && up && v.y < -1;
    if (P.gliding) v.y = Math.max(v.y, -2.6);
    v.y = Math.max(v.y, -45);
  }

  P.pos.addScaledVector(v, dt);

  // Land on whatever is under our feet (with a small step-up allowance).
  const wasGrounded = P.grounded;
  P.grounded = false;
  const g = groundBelow(P.pos.x, P.pos.z, Math.max(P.prev.y, P.pos.y) + 0.55);
  if (g && P.pos.y <= g.top && v.y <= 0.01) {
    const impact = -v.y;
    if (!wasGrounded && impact > 5) sfx.land(impact / 25);
    P.pos.y = g.top;
    v.y = 0;
    if (P.flying && !up) toggleFly();
    if (!P.flying) { P.grounded = true; P.airJumps = 1; }
    P.ground = g;
    if (g.kind === "island" || g.kind === "stone") {
      const k = g.kind === "stone" ? 0 : Math.min(1, (g.rTop * 0.5) / (Math.hypot(P.pos.x - g.x, P.pos.z - g.z) || 1));
      P.safe.set(g.x + (P.pos.x - g.x) * k, g.top, g.z + (P.pos.z - g.z) * k);
    }
  }
  if (P.flying && g && P.pos.y < g.top) P.pos.y = g.top;

  // Push out of walls, island sides and the cone underneath.
  for (const s of solids) {
    if (P.pos.y >= s.top - 0.55 || P.pos.y + 1.7 <= s.bottom) continue;
    const depth = Math.max(0, s.top - (P.pos.y + 1.7));
    const rr = s.rAt(depth) + 0.38;
    let dx = P.pos.x - s.x, dz = P.pos.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d >= rr) continue;
    if (d < 1e-4) { dx = 1; dz = 0; }
    const nx = dx / (d || 1), nz = dz / (d || 1);
    P.pos.x = s.x + nx * rr;
    P.pos.z = s.z + nz * rr;
    const into = v.x * nx + v.z * nz;
    if (into < 0) { v.x -= into * nx; v.z -= into * nz; }
  }

  if (P.pos.y < -48 && !P.respawning) respawn();

  // Which island are we on?
  let on = null;
  for (const I of ISLANDS) {
    const d = Math.hypot(P.pos.x - I.x, P.pos.z - I.z);
    if (d < I.r + 0.5 && P.pos.y > I.y - 0.5 && P.pos.y < I.y + 7) { on = I.id; break; }
  }
  if (on !== P.island) {
    P.island = on;
    updatePrompt();
    if (on && P.grounded) discover(on);
  } else if (on && P.grounded && !visited.has(on)) discover(on);

  // Turn to face the direction of travel
  const hs = Math.hypot(v.x, v.z);
  if (hs > 0.4) turnTo(Math.atan2(v.x, v.z), P.flying ? 5 : 11, dt);
  animatePlayer(dt);
}
function turnTo(target, rate, dt) {
  let d = target - P.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  P.yaw += d * damp(rate, dt);
}

function animatePlayer(dt) {
  const { root, body, legs, arms, head } = player;
  root.position.copy(P.pos);
  root.rotation.y = P.yaw;
  const hs = Math.hypot(P.vel.x, P.vel.z);
  const lerp = (o, k, t, r = 12) => { o[k] += (t - o[k]) * damp(r, dt); };
  P.phase += dt * (hs * 1.25 + 1.2);
  const t = P.phase;
  let pitch = 0, bodyY = 0.72, roll = 0, headY = 0, headX = 0;
  let lL = 0, lR = 0, aL = 0, aR = 0, aLz = 0, aRz = 0;
  if (state === "intro") {
    // say hi to the visitor
    aR = -2.75; aRz = Math.sin(elapsed * 7) * 0.35;
    aL = 0.1;
    headY = Math.sin(elapsed * 0.8) * 0.15;
    bodyY = 0.72 + Math.sin(elapsed * 2) * 0.01;
  } else if (P.flying) {
    const moving = hs > 2 || Math.abs(P.vel.y) > 3;
    pitch = moving ? THREE.MathUtils.clamp(Math.atan2(hs, P.vel.y), 0.25, 2.3) : 0.2;
    bodyY = 0.72 + Math.sin(t * 2) * 0.06;
    lL = 0.12 + Math.sin(t * 3) * 0.06; lR = 0.2 - Math.sin(t * 3) * 0.06;
    if (moving) { aR = -2.95; aL = 0.35; } else { aL = -0.4; aR = -0.4; aLz = 0.5; aRz = -0.5; }
    headX = moving ? -Math.min(1, pitch - 0.3) * 0.6 : 0;
    roll = THREE.MathUtils.clamp(-(P.vel.x * Math.cos(P.yaw) - P.vel.z * Math.sin(P.yaw)) * 0.02, -0.4, 0.4);
  } else if (!P.grounded) {
    if (P.gliding) { aL = aR = -1.5; aLz = 1.1; aRz = -1.1; lL = -0.3; lR = 0.25; pitch = 0.3; }
    else { lL = -0.8; lR = 0.45; aL = aR = -2.5; }
  } else if (hs > 0.5) {
    const amp = Math.min(1, hs / RUN) * 0.95;
    lL = Math.sin(t * 2.1) * amp; lR = -lL;
    const foot = Math.sign(lL);
    if (foot !== P.foot) { P.foot = foot; if (amp > 0.2 && state === "play") sfx.step(); }
    aL = -lL * 0.9; aR = -lR * 0.9;
    bodyY = 0.72 + Math.abs(Math.sin(t * 2.1)) * 0.05 * amp;
    pitch = 0.08 * amp;
  } else {
    bodyY = 0.72 + Math.sin(t * 1.6) * 0.008;
    headY = Math.sin(t * 0.45) * 0.25;
  }
  lerp(body.rotation, "x", pitch, 8);
  lerp(body.rotation, "z", roll, 8);
  lerp(body.position, "y", bodyY);
  lerp(legs[0].rotation, "x", lL); lerp(legs[1].rotation, "x", lR);
  lerp(arms[0].rotation, "x", aL); lerp(arms[1].rotation, "x", aR);
  lerp(arms[0].rotation, "z", aLz); lerp(arms[1].rotation, "z", aRz);
  lerp(head.rotation, "y", headY, 5);
  lerp(head.rotation, "x", headX, 8);
  // double-jump somersault
  if (P.flip > 0) {
    P.flip = Math.max(0, P.flip - dt * 2.6);
    body.rotation.x = (1 - P.flip) * TAU;
    if (P.flip === 0) body.rotation.x = 0;
  }

  const g = groundBelow(P.pos.x, P.pos.z, P.pos.y + 0.05);
  if (g) {
    const h = P.pos.y - g.top;
    blob.visible = h < 30;
    blob.position.set(P.pos.x, g.top + 0.04, P.pos.z);
    const s = Math.max(0.35, 1 - h * 0.04);
    blob.scale.setScalar(s);
    blob.material.opacity = 0.3 * s;
  } else blob.visible = false;
}

function respawn() {
  P.respawning = true;
  sfx.respawn();
  fade(() => {
    P.respawning = false;
    P.pos.copy(P.safe).y += 0.1;
    P.vel.set(0, 0, 0);
    if (P.flying) toggleFly();
    toast("Whoops! Back to solid ground. Try flying with " + (touchUI ? "☁️" : "Shift"));
  });
}

/* ---------- Camera ---------- */
const camTarget = new THREE.Vector3().copy(SPAWN).add(new THREE.Vector3(0, 1.5, 0));
const followPos = new THREE.Vector3();
function snapCamera() {
  yawS = camYaw; pitchS = camPitch; distS = camDist;
  camTarget.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
}
function computeFollow(dt) {
  // horizontal follow is tight, vertical is softer so jumps don't bounce the view
  const kxz = damp(14, dt), ky = damp(P.grounded || P.flying ? 9 : 4, dt);
  camTarget.x += (P.pos.x - camTarget.x) * kxz;
  camTarget.z += (P.pos.z - camTarget.z) * kxz;
  camTarget.y += (P.pos.y + 1.5 - camTarget.y) * ky;
  if (Math.abs(P.pos.y + 1.5 - camTarget.y) > 6) camTarget.y = P.pos.y + 1.5 - Math.sign(P.pos.y + 1.5 - camTarget.y) * 6;

  if (state === "play" && performance.now() - lastCamInput > 1400 && !panelOpen) {
    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (hs > 1.5 && inp.z > 0.2) {
      const want = Math.atan2(P.vel.x, P.vel.z) + Math.PI;
      let d = want - camYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.4) camYaw += d * damp(1.1, dt) * Math.min(1, hs / WALK);
    }
  }
  let dy = camYaw - yawS;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  yawS += dy * damp(16, dt);
  pitchS += (camPitch - pitchS) * damp(16, dt);

  const cp = Math.cos(pitchS);
  // pull the camera in toward the player if it would end up inside rock
  let want = camDist;
  for (let i = 0; i < 24; i++) {
    followPos.set(camTarget.x + Math.sin(yawS) * want * cp, camTarget.y + Math.sin(pitchS) * want, camTarget.z + Math.cos(yawS) * want * cp);
    if (!insideSolid(followPos) || want < 1.5) break;
    want *= 0.85;
  }
  distS += (want - distS) * damp(want < distS ? 18 : 5, dt);
  followPos.set(camTarget.x + Math.sin(yawS) * distS * cp, camTarget.y + Math.sin(pitchS) * distS, camTarget.z + Math.cos(yawS) * distS * cp);
  const g = groundBelow(followPos.x, followPos.z, followPos.y + 2);
  if (g && followPos.y < g.top + 0.8 && Math.hypot(followPos.x - g.x, followPos.z - g.z) < g.rTop) followPos.y = g.top + 0.8;
}
function insideSolid(p) {
  for (const s of solids) {
    if (s.kind === "prop" || p.y > s.top + 0.4 || p.y < s.bottom) continue;
    if (Math.hypot(p.x - s.x, p.z - s.z) < s.rAt(Math.max(0, s.top - p.y)) + 0.6) return true;
  }
  return false;
}

// Title screen: the camera drifts in front of the waving character, world behind.
const introPos = new THREE.Vector3(), introLook = new THREE.Vector3();
function computeIntro(time) {
  const wide = innerWidth > 860;
  const a = Math.sin(time * 0.16) * 0.3 + (wide ? 0.18 : 0);
  const R = wide ? 5.6 : 7.2;
  const c = P.pos;
  introPos.set(c.x + Math.sin(a) * R, c.y + (wide ? 1.9 : 2.3), c.z + Math.cos(a) * R);
  const rx = Math.cos(a), rz = -Math.sin(a);
  const shift = wide ? -Math.min(3.4, innerWidth / innerHeight * 1.6) : 0;
  introLook.set(c.x + rx * shift, c.y + (wide ? 1.55 : -1.6), c.z + rz * shift);
}

/* ---------- UI ---------- */
const visited = new Set();
let panelOpen = false, panelId = null, mapOpen = false, state = "intro";
let toastTimer = 0;
function toast(msg, ms = 3600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function updatePrompt() {
  const p = $("prompt");
  if (P.island && state === "play" && !(panelOpen && panelId === P.island)) {
    const c = ISLANDS_CONTENT[P.island];
    $("promptWhere").textContent = `${c.emoji} ${c.title}`;
    p.classList.add("show");
  } else p.classList.remove("show");
}
function discover(id) {
  if (visited.has(id)) return;
  visited.add(id);
  (beams[id] || []).forEach((b, i) => b.material.color.set(i % 2 ? 0xffc04d : 0xffe9a8));
  if (id !== "spawn") sfx.discover();
  $("progress").textContent = `Islands ${visited.size}/${ISLANDS.length}`;
  if (id !== "spawn") toast(visited.size === ISLANDS.length ? "🎉 You've explored all of Boypje World. Thanks for visiting!" : `✨ Discovered ${ISLANDS_CONTENT[id].title}  (${visited.size}/${ISLANDS.length})`);
  renderMap();
}

function openPanel(id) {
  const c = ISLANDS_CONTENT[id];
  $("pEmoji").textContent = c.emoji;
  $("pTitle").textContent = c.title;
  $("pSub").textContent = c.sub;
  $("pBody").innerHTML = c.html();
  $("pBody").scrollTop = 0;
  panelId = id;
  panelOpen = true;
  sfx.open();
  sfx.duck(true);
  $("panel").classList.remove("open");
  void $("panel").offsetWidth;
  $("panel").classList.add("open");
  updatePrompt();
}
function closePanel() {
  if (panelOpen) sfx.close();
  sfx.duck(false);
  panelOpen = false;
  $("panel").classList.remove("open");
  updatePrompt();
  canvas.focus({ preventScroll: true });
}
function stepIsland(dir) {
  const i = ISLANDS.findIndex((I) => I.id === panelId);
  const next = ISLANDS[(i + dir + ISLANDS.length) % ISLANDS.length];
  travel(next.id, true);
}
$("pClose").onclick = closePanel;
$("pPrev").onclick = () => stepIsland(-1);
$("pNext").onclick = () => stepIsland(1);
$("promptBtn").onclick = () => P.island && openPanel(P.island);
$("pBody").addEventListener("click", (e) => {
  if (e.target.classList?.contains("zoomable")) {
    const lb = $("lightbox");
    lb.querySelector("img").src = e.target.dataset.full || e.target.src;
    lb.classList.remove("hidden");
    sfx.click();
  }
});
$("lightbox").onclick = () => $("lightbox").classList.add("hidden");

function renderMap() {
  $("mapList").innerHTML = ISLANDS.map((I) => {
    const c = ISLANDS_CONTENT[I.id];
    return `<button data-id="${I.id}" class="${visited.has(I.id) ? "seen" : ""}"><span class="e">${c.emoji}</span><span><b>${c.title}</b><small>${c.sub}</small></span></button>`;
  }).join("");
}
$("mapList").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (b) { toggleMap(false); travel(b.dataset.id, true); }
});
function toggleMap(force) {
  const was = mapOpen;
  mapOpen = force ?? !mapOpen;
  if (mapOpen !== was) mapOpen ? sfx.open() : sfx.close();
  $("map").classList.toggle("open", mapOpen);
}
$("btnMap").onclick = () => toggleMap(true);
$("mapClose").onclick = () => toggleMap(false);
$("map").addEventListener("click", (e) => { if (e.target.id === "map") toggleMap(false); });
$("btnHelp").onclick = () => openPanel("spawn");
function toggleSound() {
  sfx.setMuted(!sfx.muted);
  if (!sfx.muted) sfx.click();
  renderSoundBtn();
}
function renderSoundBtn() {
  $("btnSound").innerHTML = (sfx.muted ? "🔇" : "🔊") + '<span class="lbl">' + (sfx.muted ? "Muted" : "Sound") + "</span>";
}
$("btnSound").onclick = toggleSound;
renderSoundBtn();
function closeTop() {
  if (!$("lightbox").classList.contains("hidden")) $("lightbox").classList.add("hidden");
  else if (mapOpen) toggleMap(false);
  else if (panelOpen) closePanel();
}

function fade(mid) {
  const f = $("fade");
  f.classList.add("on");
  setTimeout(() => { mid(); setTimeout(() => f.classList.remove("on"), 60); }, 360);
}
function travel(id, open) {
  const I = byId[id];
  sfx.travel();
  fade(() => {
    // arrive on the side facing the spawn, looking toward the island's heart
    const ax = I.id === "spawn" ? 0 : (0 - I.x), az = I.id === "spawn" ? 1 : (20 - I.z);
    const d = Math.hypot(ax, az) || 1;
    const off = I.id === "spawn" ? 5 : I.r * 0.55;
    P.pos.set(I.x + (ax / d) * off, I.y + 0.05, I.z + (az / d) * off);
    if (I.id === "profile") P.pos.set(I.x - 3.5, I.y + 0.05, I.z + 10.5);
    P.vel.set(0, 0, 0);
    if (P.flying) toggleFly();
    P.safe.copy(P.pos);
    camYaw = Math.atan2(ax, az);
    camPitch = PITCH_LEVEL;
    P.yaw = camYaw + Math.PI;
    snapCamera();
    P.island = id;
    discover(id);
    if (open) openPanel(id); else updatePrompt();
  });
}

/* ---------- Intro → play ---------- */
let joinT = 0;
let guestName = "";
try { guestName = localStorage.getItem("bw-name") || ""; } catch {}
$("guestName").value = guestName;
$("joinForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (state !== "intro") return;
  sfx.start();
  sfx.click();
  guestName = $("guestName").value.trim().slice(0, 16) || "Guest";
  try { localStorage.setItem("bw-name", guestName); } catch {}
  setNameTag(guestName);
  $("guestName").blur();
  document.body.classList.remove("intro");
  state = "joining";
  joinT = 0;
  fromPos.copy(camera.position);
  fromLook.copy(introLook);
  camYaw = 0; camPitch = PITCH_LEVEL; camDist = camera.aspect < 1 ? 13 : 10;
  snapCamera();
});
const fromPos = new THREE.Vector3(), fromLook = new THREE.Vector3();
function finishJoin() {
  state = "play";
  document.body.classList.add("playing");
  discover("spawn");
  P.island = "spawn";
  updatePrompt();
  toast(`Welcome to Boypje World, ${guestName}! 👋  ` + (touchUI ? "Left thumb to move, ☁️ to fly." : "WASD move · Space jump · Shift fly · E open"), 6000);
  canvas.focus({ preventScroll: true });
}

/* ---------- Build & run ---------- */
async function init() {
  await Promise.race([document.fonts.load("56px 'Lilita One'"), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
  ISLANDS.forEach((I, i) => buildIsland(I, 10 + i * 7));
  LINKS.forEach(([a, b], i) => steppingStones(byId[a], byId[b], 300 + i * 13));
  dressIslands();
  backdropIslands();
  buildGrass();
  clouds = buildClouds();
  scene.add(petalMesh);
  for (let i = 0; i < PETALS; i++) {
    const p = { pos: new THREE.Vector3(), rot: new THREE.Euler(), spin: 1, fall: 1, floor: 0, near: i % 3 !== 0 };
    resetPetal(p, p.near ? hubTree : P.pos, p.near ? 26 : 50);
    p.pos.y -= R() * 14;
    petals.push(p);
  }
  setNameTag(guestName || "Guest");
  renderMap();
  player.root.position.copy(P.pos);
  player.root.rotation.y = P.yaw;
  renderer.setAnimationLoop(loop);
  $("joinBtn").disabled = false;
  $("joinLbl").textContent = "Start Adventure";
  document.body.classList.add("ready");
}
let clouds;

// Keep the frame rate up on slower machines, but never trade away sharpness early:
// measure real frame times only once the world is in play, step resolution down gently,
// stop at DPR_MIN on phones, and climb back up when there is headroom.
const perf = { frames: 0, last: 0, start: 0, dpr: DPR_MAX, coolDown: 0, good: 0 };
function adaptQuality() {
  const now = performance.now();
  if (state !== "play") { perf.start = 0; return; }
  if (!perf.start) { perf.start = now; perf.last = now; perf.frames = 0; return; }
  if (now - perf.start < 4000) { perf.last = now; perf.frames = 0; return; } // let shaders and textures warm up
  perf.frames++;
  const span = now - perf.last;
  if (span < 2500) return;
  const fps = (perf.frames * 1000) / span;
  perf.frames = 0; perf.last = now;
  const set = (d) => { perf.dpr = d; renderer.setPixelRatio(d); };
  if (fps < 40 && perf.dpr > DPR_MIN) { set(Math.max(DPR_MIN, perf.dpr - 0.25)); perf.coolDown = now + 10000; perf.good = 0; }
  else if (fps < 30 && sun.castShadow) { sun.castShadow = false; perf.coolDown = now + 10000; }
  else if (fps < 22 && perf.dpr > 1) { set(Math.max(1, perf.dpr - 0.25)); perf.coolDown = now + 10000; }
  else if (fps > 55 && perf.dpr < DPR_MAX && now > perf.coolDown) {
    if (++perf.good >= 2) { set(Math.min(DPR_MAX, perf.dpr + 0.25)); perf.good = 0; }
  } else perf.good = 0;
}

const clock = new THREE.Clock();
const dummy = new THREE.Object3D();
const camLook = new THREE.Vector3();
let elapsed = 0;
function loop(_t, fixedDt) {
  const dt = fixedDt ?? Math.min(clock.getDelta(), 0.05);
  if (fixedDt === undefined && !document.hidden) adaptQuality();
  elapsed += dt;
  grassMat.uniforms.uTime.value = elapsed;
  waterMat.uniforms.uTime.value = elapsed;

  // small fixed-ish substeps keep landings and collisions steady at low frame rates
  const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
  for (let i = 0; i < steps; i++) updatePlayer(dt / steps);
  if (state === "joining") turnTo(Math.PI, 3.5, dt);
  const speed = P.vel.length();
  sfx.wind(P.flying ? 0.25 + 0.75 * Math.min(1, speed / FLY) : P.gliding ? 0.45 : !P.grounded && P.vel.y < -12 ? Math.min(1, -P.vel.y / 40) : 0);

  computeFollow(dt);
  if (state === "intro") {
    computeIntro(elapsed);
    camera.position.copy(introPos);
    camera.lookAt(introLook);
  } else if (state === "joining") {
    joinT = Math.min(1, joinT + dt / 2.2);
    const e = joinT < 0.5 ? 4 * joinT ** 3 : 1 - (-2 * joinT + 2) ** 3 / 2;
    camera.position.lerpVectors(fromPos, followPos, e);
    camLook.lerpVectors(fromLook, camTarget, e);
    camera.lookAt(camLook);
    if (joinT >= 1) finishJoin();
  } else {
    camera.position.copy(followPos);
    camera.lookAt(camTarget);
  }
  sky.position.copy(camera.position);

  if (sun.castShadow) {
    sun.target.position.copy(P.pos);
    sun.position.copy(P.pos).add(new THREE.Vector3(40, 60, 25));
  }

  crystals.forEach((c, i) => {
    c.rotation.y += dt * (c.userData.slow ? 0.5 : 1.2);
    c.position.y = c.userData.baseY + Math.sin(elapsed * 1.6 + i) * (c.userData.slow ? 0.12 : 0.25);
  });
  if (clouds) clouds.rotation.y = elapsed * 0.004;

  for (let i = 0; i < petals.length; i++) {
    const p = petals[i];
    p.pos.y -= p.fall * dt;
    p.pos.x += (Math.sin(elapsed * 0.7 + i) * 0.8 + 0.6) * dt;
    p.pos.z += Math.cos(elapsed * 0.5 + i * 1.3) * 0.5 * dt;
    p.rot.x += p.spin * dt; p.rot.z += p.spin * 0.7 * dt;
    if (p.pos.y < p.floor) resetPetal(p, p.near ? hubTree : P.pos, p.near ? 26 : 50);
    dummy.position.copy(p.pos);
    dummy.rotation.copy(p.rot);
    dummy.updateMatrix();
    petalMesh.setMatrixAt(i, dummy.matrix);
  }
  petalMesh.instanceMatrix.needsUpdate = true;

  for (const l of labels) {
    const d = l.sprite.getWorldPosition(camLook).distanceTo(camera.position);
    l.sprite.material.opacity = THREE.MathUtils.clamp(1 - (d - l.far * 0.7) / (l.far * 0.3), 0, 1);
    l.sprite.visible = l.sprite.material.opacity > 0.01;
  }
  if (nameTag) nameTag.visible = state !== "intro";

  renderer.render(scene, camera);
}

function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  // portrait phones see less sideways, so widen the lens
  camera.fov = camera.aspect < 1 ? 72 : 60;
  camera.updateProjectionMatrix();
}
fitCamera();
addEventListener("resize", () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
  if (joy.id === null) joyHome();
});
document.addEventListener("visibilitychange", () => { clock.getDelta(); sfx.pauseForHidden(document.hidden); });

init();

// ?debug exposes a stepping hook for automated testing (no effect for visitors)
if (new URLSearchParams(location.search).has("debug")) {
  window.__bw = { P, keys, held, solids, ISLANDS, travel, toggleFly, openPanel, sfx,
    get state() { return state; }, get island() { return P.island; },
    get camYaw() { return camYaw; }, set camYaw(v) { camYaw = yawS = v; lastCamInput = performance.now(); },
    get camPitch() { return camPitch; }, set camPitch(v) { camPitch = pitchS = v; lastCamInput = performance.now(); },
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) loop(0, dt); return { pos: P.pos.toArray().map((v) => +v.toFixed(2)), grounded: P.grounded, flying: P.flying, island: P.island }; } };
}
