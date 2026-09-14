/* ============================================================
   PLINTH / 001 — three.js viewer
   Dois painéis lado a lado: chair_low.glb e chair_high.glb.

   As câmeras são espelhadas de propósito. Comparar dois LOD só diz
   alguma coisa se o ângulo for idêntico nos dois: quem você arrasta
   lidera, o outro copia na mesma órbita. Sem isso a comparação vira
   "duas cadeiras em poses diferentes" e não se vê o que muda.

   Cada painel falha sozinho: se um GLB não carregar, só aquele cai pro
   proxy em blocos e o vizinho continua de pé. Se o próprio three.js não
   carregar (CDN fora), o watchdog do main.js cobre os dois com o
   turntable.
   ============================================================ */

import * as THREE            from 'three';
import { OrbitControls }     from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }        from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }       from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment }   from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass }          from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass }        from 'three/addons/postprocessing/OutputPass.js';

/* ── Config ──────────────────────────────────────────────── */
const CONFIG = {
  panes: [
    { host: 'viewerCanvas',     status: 'statusLow',  url: 'assets/model/chair_low.glb',  label: 'Bassa' },
    { host: 'viewerCanvasHigh', status: 'statusHigh', url: 'assets/model/chair_high.glb', label: 'Alta'  },
  ],
  draco:   'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/',
  exposure: 1.05,
  autoRotateSpeed: 0.55,
  /* os GLB vêm sem material — clay, pra forma falar sozinha. Cinza escuro e
     não o quase-branco original: em superfície clara demais a oclusão de
     contato quase não aparece, é tudo estourado perto do branco. Tem um
     piso, porém: a página é quase preta (--bg #0b0b0c), então abaixo disso
     a silhueta começa a se perder no fundo. */
  clay:    { color: 0x757169, roughness: 0.62, metalness: 0.0 },

  /* GTAO — os mesmos valores do exemplo oficial do three; `radius` é em
     unidades de mundo, então acompanha a escala do modelo (a cadeira tem
     ~1 unidade de altura). */
  ao: {
    radius: 0.25, distanceExponent: 1, thickness: 1,
    scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false,
  },
};

const stage = document.getElementById('viewerStage');
if (!stage) throw new Error('viewer: stage não encontrado');

/* loader é caro de montar e não depende de contexto WebGL: um só serve
   os dois painéis */
const draco  = new DRACOLoader().setDecoderPath(CONFIG.draco);
const loader = new GLTFLoader().setDRACOLoader(draco);

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

const reason = (err) => {
  const m = String(err?.message || err || 'unknown').replace(/\s+/g, ' ');
  return m.length > 40 ? m.slice(0, 40) + '…' : m;
};

/* Proxy em blocos — só aparece se o GLB daquele painel falhar */
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
  add(1.06, 0.12, 0.94, 0, 0.10, 0, wood);          // plinth
  add(1.00, 0.06, 0.88, 0, 0.19, 0, wood);          // cap
  add(0.94, 0.14, 0.82, 0, 0.29, 0);                // base cushion
  add(0.90, 0.16, 0.78, 0, 0.44, 0);                // seat cushion
  add(0.94, 0.52, 0.14, 0, 0.62,-0.36, mat, -0.06); // back
  add(0.14, 0.36, 0.80,-0.44, 0.54, 0.02);          // arm L
  add(0.14, 0.44, 0.80, 0.44, 0.58, 0.02);          // arm R
  [-0.42, 0.42].forEach(x => [-0.36, 0.36].forEach(z => add(0.12, 0.05, 0.12, x, 0.025, z, wood)));
  return g;
};

/* ── Um painel ───────────────────────────────────────────── */
/* Tudo aqui dentro é por instância: renderer, cena, câmera, controls e
   material clay. Textura de ambiente (PMREM) é presa ao contexto WebGL
   que a gerou, então não dá pra compartilhar entre os dois renderers. */
const createPane = ({ host: hostId, status: statusId, url, label }) => {
  const host   = document.getElementById(hostId);
  const statEl = document.getElementById(statusId);
  if (!host) return null;

  const say = (t) => { if (statEl) statEl.textContent = t; };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace    = THREE.SRGBColorSpace;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 100);
  camera.position.set(2.1, 1.35, 2.6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  /* 1024 e não 2048: cada painel agora ocupa metade da largura de antes,
     e são dois shadow maps em vez de um — 2048² aqui é textura paga sem
     nada em troca na tela */
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2.6, 3.4, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 12;
  key.shadow.camera.left = key.shadow.camera.bottom = -2.2;
  key.shadow.camera.right = key.shadow.camera.top   =  2.2;
  key.shadow.bias = -0.0009;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7);
  rim.position.set(-2.4, 1.8, -2.6);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping   = true;
  controls.dampingFactor   = 0.06;
  controls.enablePan       = false;
  controls.minDistance     = 1.1;
  controls.maxDistance     = 7;
  controls.maxPolarAngle   = Math.PI / 2 - 0.02;
  controls.autoRotate      = false;
  controls.autoRotateSpeed = CONFIG.autoRotateSpeed;
  controls.target.set(0, 0.42, 0);

  const root = new THREE.Group();
  scene.add(root);

  /* AO de contato (GTAO) num composer: RenderPass → GTAO → OutputPass.
     O OutputPass é obrigatório aqui — renderizando via composer, é ELE que
     aplica tone mapping e conversão de color space, coisa que o renderer só
     faz quando desenha direto na tela. Sem ele a imagem sai crua e clara.

     Tudo dentro de try: o GTAO depende de render target HalfFloat e do
     G-buffer de profundidade/normais, e é melhor cair pro render direto num
     equipamento que não suporte do que deixar o painel preto. */
  let composer = null, gtao = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial(CONFIG.ao);
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  } catch (err) {
    console.warn('[viewer] AO indisponível, render direto:', err);
    composer = gtao = null;
  }

  const render = () => (composer ? composer.render() : renderer.render(scene, camera));

  const clayMat = new THREE.MeshStandardMaterial(CONFIG.clay);
  let wire = false;

  const frameObject = (obj) => {
    const box    = new THREE.Box3().setFromObject(obj);
    const size   = box.getSize(new THREE.Vector3());
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

    /* limita o AO ao volume do modelo: fora dele só existe o plano de sombra,
       e calcular oclusão no vazio é amostra gasta à toa */
    if (gtao) gtao.setSceneClipBox(new THREE.Box3().setFromObject(obj));
  };

  const prepare = (obj, { clay = false } = {}) => {
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (clay) o.material = clayMat;
      if (o.material) {
        o.material.envMapIntensity = 0.9;
        if ('side' in o.material) o.material.side = THREE.FrontSide;
        o.material.wireframe = wire;   /* painel que chega depois entra no estado atual */
      }
    });
  };

  const setWire = (on) => {
    wire = on;
    root.traverse(o => { if (o.isMesh && o.material) o.material.wireframe = on; });
    clayMat.wireframe = on;
  };

  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    /* EffectComposer.setSize já repassa pros passes, inclusive os três render
       targets do GTAO — não precisa chamar gtao.setSize na mão */
    composer?.setSize(w, h);
  };
  new ResizeObserver(resize).observe(host);
  resize();

  /* Carga e montagem ficam separadas: o GLTFLoader chama onError quando o
     PRÓPRIO onLoad lança, o que fazia qualquer erro de montagem virar
     "arquivo não carregou". Só falha de rede/parse cai no proxy. */
  const load = async () => {
    say(`Caricamento ${label.toLowerCase()}…`);
    let gltf;
    try {
      gltf = await loader.loadAsync(url, (e) => {
        if (e.total) say(`${label} ${Math.round((e.loaded / e.total) * 100)}%`);
      });
    } catch (err) {
      console.error('[viewer] GLB load failed:', url, err);
      const proxy = buildProxy();
      root.add(proxy);
      prepare(proxy);
      frameObject(proxy);
      say(`Placeholder — ${reason(err)}`);
      return;
    }

    /* GLB sem materiais: clay em vez do default metálico do glTF */
    const bare = !gltf.parser?.json?.materials?.length;
    root.add(gltf.scene);
    prepare(gltf.scene, { clay: bare });
    frameObject(gltf.scene);
    say(`${label} · ${countTris(gltf.scene).toLocaleString('it-IT')} tris`);
  };

  return { host, camera, controls, scene, renderer, setWire, render, resize, load };
};

const panes = CONFIG.panes.map(createPane).filter(Boolean);
if (!panes.length) throw new Error('viewer: nenhum painel');

/* ── Câmeras espelhadas ──────────────────────────────────── */
/* Quem o usuário mexe lidera; o outro copia. A trava `syncing` existe
   porque controls.update() dispara 'change' de novo — sem ela os dois
   painéis ficariam se re-sincronizando em loop. */
let syncing = false;
const mirror = (from, to) => {
  if (syncing) return;
  syncing = true;
  to.camera.position.copy(from.camera.position);
  to.camera.quaternion.copy(from.camera.quaternion);
  to.controls.target.copy(from.controls.target);
  /* update() com autoRotate ligado ADIANTA o giro. Aqui só se quer aplicar a
     cópia, então desliga durante a chamada: sem isso o painel que gira ganha
     um passo extra por frame (o do loop + o que volta pelo espelhamento) e
     roda mais rápido que o autoRotateSpeed configurado. */
  const ar = to.controls.autoRotate;
  to.controls.autoRotate = false;
  to.controls.update();
  to.controls.autoRotate = ar;
  syncing = false;
};

panes.forEach((p) => {
  p.controls.addEventListener('change', () => {
    panes.forEach(other => { if (other !== p) mirror(p, other); });
  });
});

/* ── UI ──────────────────────────────────────────────────── */
const btnWire = document.getElementById('btnWire');
btnWire?.addEventListener('click', () => {
  const on = btnWire.getAttribute('aria-pressed') !== 'true';
  btnWire.setAttribute('aria-pressed', String(on));
  panes.forEach(p => p.setWire(on));
});

/* autoRotate mora num painel só. Ligado nos dois, cada um escreveria a
   própria posição de câmera a cada frame e o espelhamento ficaria
   brigando — o giro do primeiro já leva o segundo junto. */
const primary = panes[0];
const btnSpin = document.getElementById('btnSpin');

/* Dois estados separados, não um só:
     spinWanted — a vontade explícita do usuário (o botão)
     dragging   — estado momentâneo, enquanto o ponteiro está pressionado
   Antes existia só um: o 'start' do OrbitControls chamava setSpin(false) e
   desligava DE VEZ. Bastava um toque em qualquer painel pra cena ficar
   parada pelo resto da visita, sem nada indicando que dava pra religar.
   Agora arrastar apenas pausa, e o giro volta ao soltar; o botão segue
   sendo a única forma de desligar de verdade. */
let spinWanted = true;
let dragging   = false;
const applySpin = () => { primary.controls.autoRotate = spinWanted && !dragging; };

btnSpin?.addEventListener('click', () => {
  spinWanted = btnSpin.getAttribute('aria-pressed') !== 'true';
  btnSpin.setAttribute('aria-pressed', String(spinWanted));
  applySpin();
});

panes.forEach(p => {
  p.controls.addEventListener('start', () => { dragging = true;  applySpin(); });
  p.controls.addEventListener('end',   () => { dragging = false; applySpin(); });
});

applySpin();

/* ── Loop (pausa fora da tela) ──────────────────────────── */
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }).observe(stage);

const tick = () => {
  requestAnimationFrame(tick);
  if (!visible) return;
  panes.forEach(p => { p.controls.update(); p.render(); });
};
requestAnimationFrame(tick);

/* Reaplica o tamanho ao entrar/sair de fullscreen */
document.addEventListener('fullscreenchange', () => setTimeout(() => panes.forEach(p => p.resize()), 60));

panes.forEach(p => p.load());
