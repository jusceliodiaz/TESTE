/* ============================================================
   PLINTH / 001 — three.js viewer
   Dois LODs reais: chair_low.glb (padrão) e chair_high.glb (sob demanda).
   Se nenhum carregar:
     1) turntable de imagens     (fallback honesto)
     2) proxy em blocos          (só pra ver o viewer vivo)
   ============================================================ */

import * as THREE            from 'three';
import { OrbitControls }     from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }        from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }       from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment }   from 'three/addons/environments/RoomEnvironment.js';

/* ── Config ──────────────────────────────────────────────── */
const CONFIG = {
  models: {
    low:  { url: 'assets/model/chair_low.glb',  label: 'Low'  },
    high: { url: 'assets/model/chair_high.glb', label: 'High' },
  },
  lod:     'low',
  draco:   'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/',
  probe:   'assets/img/turntable/frame-001.webp',
  exposure: 1.05,
  autoRotateSpeed: 0.55,
  /* os GLB vêm sem material — clay, pra forma falar sozinha */
  clay:    { color: 0xd9d4ca, roughness: 0.62, metalness: 0.0 },
};

const stage    = document.getElementById('viewerStage');
const host     = document.getElementById('viewerCanvas');
const fallback = document.getElementById('viewerFallback');
const status   = document.getElementById('viewerStatus');
if (!stage || !host) throw new Error('viewer: stage não encontrado');

const say = (t) => { if (status) status.textContent = t; };

const useTurntable = (msg) => {
  host.style.display = 'none';
  if (fallback) fallback.hidden = false;
  say(msg || 'Turntable preview');
};

/* ── Scene ───────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace   = THREE.SRGBColorSpace;
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.exposure;
renderer.shadowMap.enabled  = true;
renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 100);
camera.position.set(2.1, 1.35, 2.6);

/* IBL sem arquivo HDRI: ambiente procedural */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

/* Key + rim */
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(2.6, 3.4, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far  = 12;
key.shadow.camera.left = key.shadow.camera.bottom = -2.2;
key.shadow.camera.right = key.shadow.camera.top   =  2.2;
key.shadow.bias = -0.0009;
scene.add(key);

const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7);
rim.position.set(-2.4, 1.8, -2.6);
scene.add(rim);

/* Piso só pra receber sombra */
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/* Controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping   = true;
controls.dampingFactor   = 0.06;
controls.enablePan       = false;
controls.minDistance     = 1.1;
controls.maxDistance     = 7;
controls.maxPolarAngle   = Math.PI / 2 - 0.02;
controls.autoRotate      = true;
controls.autoRotateSpeed = CONFIG.autoRotateSpeed;
controls.target.set(0, 0.42, 0);

/* ── Carga do modelo ────────────────────────────────────── */
const root = new THREE.Group();
scene.add(root);

const frameObject = (obj) => {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  /* normaliza: apoia no chão e centraliza */
  obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));

  const radius = Math.max(size.x, size.y, size.z);
  const dist = radius / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.75;
  camera.position.set(dist * 0.62, size.y * 0.78, dist * 0.78);
  controls.target.set(0, size.y * 0.45, 0);
  controls.minDistance = radius * 0.7;
  controls.maxDistance = radius * 4.5;
  controls.update();
};

const countTris = (obj) => {
  let t = 0;
  obj.traverse(o => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      t += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return Math.round(t);
};

const clayMat = new THREE.MeshStandardMaterial(CONFIG.clay);

const prepare = (obj, { clay = false } = {}) => {
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (clay) o.material = clayMat;
    if (o.material) {
      o.material.envMapIntensity = 0.9;
      if ('side' in o.material) o.material.side = THREE.FrontSide;
    }
  });
  /* mantém o wireframe se o botão já estava ligado antes da troca */
  if (document.getElementById('btnWire')?.getAttribute('aria-pressed') === 'true') {
    obj.traverse(o => { if (o.isMesh && o.material) o.material.wireframe = true; });
  }
};

/* Proxy em blocos — placeholder enquanto o .glb não existe */
const buildProxy = () => {
  const mat  = new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.85, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6242, roughness: 0.45, metalness: 0 });
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, m = mat, rx = 0) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    box.position.set(x, y, z);
    box.rotation.x = rx;
    g.add(box);
    return box;
  };
  add(1.06, 0.12, 0.94, 0, 0.10, 0, wood);       // plinth
  add(1.00, 0.06, 0.88, 0, 0.19, 0, wood);       // cap
  add(0.94, 0.14, 0.82, 0, 0.29, 0);             // base cushion
  add(0.90, 0.16, 0.78, 0, 0.44, 0);             // seat cushion
  add(0.94, 0.52, 0.14, 0, 0.62,-0.36, mat, -0.06); // back
  add(0.14, 0.36, 0.80,-0.44, 0.54, 0.02);       // arm L
  add(0.14, 0.44, 0.80, 0.44, 0.58, 0.02);       // arm R
  [-0.42, 0.42].forEach(x => [-0.36, 0.36].forEach(z => add(0.12, 0.05, 0.12, x, 0.025, z, wood)));
  return g;
};

const startProxy = () => {
  const proxy = buildProxy();
  root.add(proxy);
  prepare(proxy);
  frameObject(proxy);
  say('Placeholder — GLB pending');
};

/* Descarta geometria/material do LOD anterior antes de trocar. */
let current = null;
let busy    = false;

const disposeCurrent = () => {
  if (!current) return;
  current.traverse(o => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (!m || m === clayMat) return;            /* clay é compartilhado */
      Object.values(m).forEach(v => v?.isTexture && v.dispose());
      m.dispose();
    });
  });
  root.remove(current);
  current = null;
};

const draco  = new DRACOLoader().setDecoderPath(CONFIG.draco);
const loader = new GLTFLoader().setDRACOLoader(draco);

const setLodUi = (lod, disabled) => {
  document.querySelectorAll('[data-lod]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.lod === lod));
    b.disabled = !!disabled;
  });
};

/* O GLTFLoader chama onError quando o PRÓPRIO onLoad lança — o que fazia
   qualquer erro de montagem virar "arquivo não carregou" e cair no
   turntable calado. Carga e montagem ficam separadas: só falha de rede ou
   de parse aciona o fallback, e o motivo aparece no status. */
const loadLod = async (lod, { first = false } = {}) => {
  const spec = CONFIG.models[lod];
  if (!spec) throw new Error(`unknown lod: ${lod}`);

  busy = true;
  setLodUi(lod, true);
  say(`Loading ${spec.label.toLowerCase()}…`);

  let gltf;
  try {
    gltf = await loader.loadAsync(spec.url, (e) => {
      if (e.total) say(`${spec.label} ${Math.round((e.loaded / e.total) * 100)}%`);
    });
  } catch (err) {
    busy = false;
    setLodUi(CONFIG.lod, false);
    console.error('[viewer] GLB load failed:', spec.url, err);
    /* Troca que falha mantém o modelo atual na tela. */
    if (!first) say(`${spec.label} failed — showing ${CONFIG.models[CONFIG.lod].label}`);
    throw err;
  }

  disposeCurrent();
  /* GLB sem materiais: clay em vez do default metálico do glTF */
  const bare = !gltf.parser?.json?.materials?.length;
  current = gltf.scene;
  root.add(current);
  prepare(current, { clay: bare });
  frameObject(current);
  say(`${spec.label} · ${countTris(current).toLocaleString('en-US')} tris · drag to orbit`);
  CONFIG.lod = lod;
  busy = false;
  setLodUi(lod, false);
};

const reason = (err) => {
  const m = String(err?.message || err || 'unknown').replace(/\s+/g, ' ');
  return m.length > 48 ? m.slice(0, 48) + '…' : m;
};

const boot = async () => {
  try {
    await loadLod(CONFIG.lod, { first: true });
  } catch (err) {
    console.error('[viewer] falling back:', err);
    /* Nenhum GLB: turntable se houver frames, senão proxy. O status diz por quê. */
    try {
      const p = await fetch(CONFIG.probe, { method: 'HEAD' });
      if (p.ok) return useTurntable(`Turntable — ${reason(err)}`);
    } catch { /* segue pro proxy */ }
    startProxy();
  }
};
boot();

document.querySelectorAll('[data-lod]').forEach(btn => {
  btn.addEventListener('click', () => {
    const lod = btn.dataset.lod;
    if (busy || lod === CONFIG.lod) return;
    loadLod(lod).catch(() => {});
  });
});

/* ── UI ──────────────────────────────────────────────────── */
const VIEWS = {
  front: [0.0, 0.9, 3.0],
  three: [2.1, 1.3, 2.5],
  side:  [3.1, 0.9, 0.0],
  top:   [0.1, 3.1, 0.9],
};
let tween = null;

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = VIEWS[btn.dataset.view];
    if (!v) return;
    const d = camera.position.length();
    const to = new THREE.Vector3(...v).normalize().multiplyScalar(d);
    tween = { from: camera.position.clone(), to, t: 0 };
    controls.autoRotate = false;
    document.getElementById('btnSpin')?.setAttribute('aria-pressed', 'false');
  });
});

const btnWire = document.getElementById('btnWire');
btnWire?.addEventListener('click', () => {
  const on = btnWire.getAttribute('aria-pressed') !== 'true';
  btnWire.setAttribute('aria-pressed', String(on));
  root.traverse(o => { if (o.isMesh && o.material) o.material.wireframe = on; });
  clayMat.wireframe = on;
});

const btnSpin = document.getElementById('btnSpin');
btnSpin?.addEventListener('click', () => {
  const on = btnSpin.getAttribute('aria-pressed') !== 'true';
  btnSpin.setAttribute('aria-pressed', String(on));
  controls.autoRotate = on;
});
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  btnSpin?.setAttribute('aria-pressed', 'false');
});

/* ── Resize ──────────────────────────────────────────────── */
const resize = () => {
  const w = host.clientWidth || stage.clientWidth;
  const h = host.clientHeight || stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
};
new ResizeObserver(resize).observe(stage);
resize();

/* ── Loop (pausa fora da tela) ──────────────────────────── */
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }).observe(stage);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (!visible) return;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt * 1.6);
    const e = 1 - Math.pow(1 - tween.t, 3);
    camera.position.lerpVectors(tween.from, tween.to, e);
    if (tween.t >= 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
});

/* Reaplica o tamanho ao entrar/sair de fullscreen */
document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
