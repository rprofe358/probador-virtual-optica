/* =========================================================
   INTERFAZ
   Dos pantallas: la entrada (estudio con los lentes flotando) y el probador (cámara completa con vidrio líquido).
   ========================================================= */
let screen = 'intro';
let lastActivity = performance.now();
const $ = id => document.getElementById(id);
const framesEl = $('frames'), swatchesEl = $('swatches');

/* ---------- Vidrio líquido: mapa de desplazamiento para la refracción en los bordes (Chromium) ---------- */
(function liquidGlass(){
  const ua = navigator.userAgent;
  const chromium = /Chrome\/|Chromium\//.test(ua) && !/iPhone|iPad|iPod/.test(ua);
  if (!chromium) return;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), r = 0.22, band = 0.16;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const u = (x + 0.5) / N, v = (y + 0.5) / N;
    // distancia al borde de un rectángulo redondeado y dirección hacia afuera
    const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
    const inside = Math.min(Math.max(Math.abs(u - 0.5) - (0.5 - r), Math.abs(v - 0.5) - (0.5 - r)), 0);
    const d = r - (Math.hypot(qx, qy) + inside);          // 0 en el borde, crece hacia el centro
    let nx = Math.sign(u - 0.5) * (qx > 0 ? qx : (Math.abs(u - 0.5) > Math.abs(v - 0.5) ? 1 : 0));
    let ny = Math.sign(v - 0.5) * (qy > 0 ? qy : (Math.abs(v - 0.5) >= Math.abs(u - 0.5) ? 1 : 0));
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const k = Math.max(0, 1 - d / band) ** 2;              // solo cerca del borde
    const i = (y * N + x) * 4;
    img.data[i] = 128 - nx * k * 127; img.data[i + 1] = 128 - ny * k * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  $('liquidMap').setAttribute('href', c.toDataURL());
  document.body.classList.add('refract');
})();

/* ---------- Miniaturas de las monturas generadas por código ---------- */
function drawThumb(cv, def, col){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 240, H = 90; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const P = framePaths(def);
  const k = (W - 16) / (P.halfWidth * 2);
  const tx = x => W / 2 + x * k, ty = y => H / 2 - y * k;
  const path = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))); g.closePath(); };
  let fill = col.hex;
  if (col.hex === 'carey'){ const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#7a4418'); gr.addColorStop(.5, '#c98a3d'); gr.addColorStop(1, '#3a1d0a'); fill = gr; }
  g.fillStyle = fill;
  if (col.clear) g.globalAlpha = 0.6;
  path(P.rOuter); g.fill(); path(P.lOuter); g.fill();
  g.globalCompositeOperation = 'destination-out';
  path(P.rInner); g.fill(); path(P.lInner); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = typeof fill === 'string' ? fill : '#a8692c';
  g.lineWidth = def.metal ? 2.5 : 6; g.lineCap = 'round';
  const by = P.topY * (def.metal ? 0.42 : 0.5);
  g.beginPath(); g.moveTo(tx(def.bridge / 2), ty(by)); g.quadraticCurveTo(tx(0), ty(by + 0.04), tx(-def.bridge / 2), ty(by)); g.stroke();
  g.globalAlpha = 1;
}

/* ---------- Monturas y colores (probador) ---------- */
function buildFramesUI(){
  framesEl.innerHTML = '';
  FRAMES.forEach((def, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'frame-card'; b.id = 'frame-' + def.id;
    const name = document.createElement('b'); name.textContent = def.nombre;
    const meta = document.createElement('small'); meta.textContent = def.medidas;
    b.addEventListener('click', () => setFrame(i, 0));
    framesEl.append(b);
    if (isGLB(def)){
      const ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = 'Cargando…';
      b.append(ph, name, meta);
      renderGLBThumb(def, b);
    } else {
      const cv = document.createElement('canvas');
      b.append(cv, name, meta);
      drawThumb(cv, def, def.colores[0]);
    }
  });
  $('frameCount').textContent = FRAMES.length + ' modelos';
  buildIntroIndex();
}
function swatchBg(col){
  if (col.hex === 'carey') return 'radial-gradient(circle at 30% 30%, #c98a3d, #6b3a14 55%, #2a1608)';
  return col.muestra || col.hex || '#888';
}
function renderFrameUI(){
  const def = FRAMES[state.frame], col = def.colores[state.color];
  FRAMES.forEach((f, i) => $('frame-' + f.id)?.setAttribute('aria-pressed', String(i === state.frame)));
  swatchesEl.innerHTML = '';
  def.colores.forEach((c, i) => {
    const s = document.createElement('button');
    s.type = 'button'; s.className = 'swatch'; s.style.background = swatchBg(c);
    s.setAttribute('aria-label', c.n); s.setAttribute('aria-pressed', String(i === state.color));
    s.addEventListener('click', () => setFrame(state.frame, i));
    swatchesEl.append(s);
  });
  $('colorName').textContent = col.n;
  $('nowName').textContent = def.nombre + ' · ' + col.n;
  $('nowInfo').textContent = def.estilo + ' · ' + def.medidas;
  if (screen === 'app') $('frame-' + def.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  dialRefresh();
}

/* ---------- Transitions ---------- */
function chip(label, pressed, onClick, dotHex){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip small';
  if (dotHex){ const d = document.createElement('span'); d.className = 'dot'; d.style.background = dotHex; b.append(d); }
  b.append(label);
  b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', onClick);
  return b;
}
function buildTintUI(){
  const tr = TR_BY[state.trType];
  const types = $('trTypes'); types.innerHTML = '';
  for (const t of TR) types.append(chip(t.n, t.id === state.trType, () => {
    state.trType = t.id; state.trColor = 0; state.mirror = 0;
    if (t.id !== 'claro' && state.tintTarget < 0.5) state.tintTarget = 1;
    buildTintUI(); updateLens();
  }));
  $('trDesc').textContent = tr.desc;
  const cols = $('trColors'); cols.innerHTML = '';
  if (tr.colores.length > 1) tr.colores.forEach((c, i) => cols.append(chip(c.n, i === state.trColor, () => {
    state.trColor = i; if (state.tintTarget < 0.5) state.tintTarget = 1; buildTintUI(); updateLens();
  }, c.hex)));
  const extra = $('trExtra'); extra.innerHTML = '';
  if (tr.acabados){
    extra.append(chip('Degradado', state.degradado, () => { state.degradado = true; buildTintUI(); updateLens(); }));
    extra.append(chip('Uniforme', !state.degradado, () => { state.degradado = false; buildTintUI(); updateLens(); }));
  }
  if (tr.espejos) tr.espejos.forEach((e, i) => extra.append(chip(e.n, i === state.mirror, () => { state.mirror = i; buildTintUI(); updateLens(); }, e.hex)));
  const none = tr.id === 'claro';
  $('trLight').hidden = none; $('tint').hidden = none; document.querySelector('.range-ends').hidden = none;
}
document.querySelectorAll('#trLight .chip').forEach(c => c.addEventListener('click', () => { state.tintTarget = +c.dataset.l; updateLens(); }));
$('tint').addEventListener('input', e => { state.tint = state.tintTarget = e.target.value / 100; updateLens(); });
function bindToggle(id, key){
  const el = $(id);
  el.addEventListener('click', () => { state[key] = !state[key]; el.setAttribute('aria-pressed', String(state[key])); updateLens(); });
}
bindToggle('tgAR', 'ar');
bindToggle('tgBlue', 'blue');

/* ---------- Pestañas del probador ---------- */
const rail = $('rail'), sheet = $('sheet');
let tabOpen = 'monturas';
function openTab(name, toggle = true){
  if (toggle && tabOpen === name && !sheet.classList.contains('closed')){
    sheet.classList.add('closed'); tabOpen = null;
  } else {
    tabOpen = name; sheet.classList.remove('closed');
    sheet.querySelectorAll('.tab').forEach(t => t.hidden = t.dataset.tab !== name);
    sheet.scrollTop = 0;
  }
  rail.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tabOpen)));
}
rail.querySelectorAll('button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));

/* ---------- Foto ---------- */
const modal = $('modal');
$('btnPhoto').addEventListener('click', () => {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const g = out.getContext('2d');
  g.save(); g.translate(out.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); g.restore();
  const def = FRAMES[state.frame], col = def.colores[state.color];
  const pad = Math.round(out.width * 0.04), fs = Math.max(16, Math.round(Math.min(out.width, out.height) * 0.035));
  const band = fs * 3.4;
  const grd = g.createLinearGradient(0, out.height - band * 1.6, 0, out.height);
  grd.addColorStop(0, 'rgba(10,12,16,0)'); grd.addColorStop(1, 'rgba(10,12,16,.72)');
  g.fillStyle = grd; g.fillRect(0, out.height - band * 1.6, out.width, band * 1.6);
  g.fillStyle = '#ffffff'; g.font = `600 ${fs}px Sora, sans-serif`;
  g.fillText(`${def.nombre} · ${col.n}`, pad, out.height - fs * 1.9);
  g.fillStyle = 'rgba(255,255,255,.78)'; g.font = `500 ${Math.round(fs * 0.62)}px Manrope, sans-serif`;
  const trd = TR_BY[state.trType], trc = trd.colores[state.trColor] || trd.colores[0];
  const mirN = trd.espejos && state.mirror ? ' espejo ' + trd.espejos[state.mirror].n.toLowerCase() : '';
  const lens = [trd.id !== 'claro' ? `Transitions ${trd.n}${trc.n !== trd.n ? ' ' + trc.n : ''}${mirN}` : null, state.ar ? 'Antirreflejo' : null, state.blue ? 'Luz azul' : null].filter(Boolean).join(' · ');
  g.fillText(`${def.medidas} · ${def.ref}${lens ? ' · ' + lens : ''}`, pad, out.height - fs * 0.85);
  g.fillStyle = '#e5484d'; g.beginPath(); g.arc(out.width - pad - fs * 0.3, out.height - fs * 1.5, fs * 0.22, 0, Math.PI * 2); g.fill();
  const url = out.toDataURL('image/png');
  $('photoImg').src = url;
  const save = $('btnSave');
  save.href = url; save.download = `probador-${def.id}.png`;
  const fl = $('flash');
  fl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on')));
  setTimeout(() => { modal.hidden = false; }, 250);
});
$('btnClose').addEventListener('click', () => { modal.hidden = true; });

/* =========================================================
   ENTRADA: lentes flotando en un estudio
   ========================================================= */
const introEl = $('intro'), introCanvas = $('introGl');
const introR = new THREE.WebGLRenderer({ canvas: introCanvas, antialias: true, alpha: true });
introR.setPixelRatio(Math.min(window.devicePixelRatio, 2));
introR.toneMapping = THREE.ACESFilmicToneMapping; introR.toneMappingExposure = 1.05;
const introScene = new THREE.Scene();
introScene.environment = new THREE.PMREMGenerator(introR).fromScene(new RoomEnvironment(), 0.03).texture;
introScene.add(new THREE.AmbientLight(0xffffff, 0.45));
{ const k = new THREE.DirectionalLight(0xffffff, 1.6); k.position.set(-0.6, 1.2, 1.4); introScene.add(k); }
const introCam = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
const introPivot = new THREE.Group(); introScene.add(introPivot);
// lente de exhibición: vidrio iridiscente, como el prisma de la referencia
const introLensMat = new THREE.MeshPhysicalMaterial({
  color: '#eef3ff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.38,
  iridescence: 1, iridescenceIOR: 1.32, iridescenceThicknessRange: [180, 640],
  clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.9, side: THREE.DoubleSide, depthWrite: false,
});
let introIdx = 0, introObj = null, introOld = null, introSwapT = 1, introDir = 1, introDrag = 0, introDragV = 0;
let introLoad = 0;

function fitIntro(){
  const w = introCanvas.clientWidth, h = introCanvas.clientHeight;
  if (!w || !h) return;
  introR.setSize(w, h, false);
  introCam.aspect = w / h;
  const portrait = h >= w;
  // vertical: los lentes entre el encabezado y el panel de abajo; horizontal: a la izquierda del panel
  const panelTop = $('introPanel').getBoundingClientRect().top || h * 0.6;
  const fx = portrait ? 0.5 : 0.33;
  const fy = portrait ? Math.min(0.42, ((70 + panelTop) / 2) / h) : 0.47;
  const share = portrait ? (w < 500 ? 0.78 : 0.68) : 0.4;    // fracción del ancho que ocupa la montura
  const visW = 1.2 / share;                                   // la montura mide ~1.2 unidades con bisagras
  const t = Math.tan(THREE.MathUtils.degToRad(introCam.fov / 2));
  const dist = visW / (2 * t * introCam.aspect);
  introCam.position.set(0, 0, dist); introCam.lookAt(0, 0, 0); introCam.updateProjectionMatrix();
  introPivot.position.y = (1 - 2 * fy) * dist * t;
  introPivot.position.x = (2 * fx - 1) * dist * t * introCam.aspect;
  introEl.style.setProperty('--glasses-y', (fy * 100) + '%');
  introEl.style.setProperty('--glasses-x', (fx * 100) + '%');
  introEl.style.setProperty('--shadow-off', (portrait ? 0.11 * w : 0.12 * h) + 'px');
  introEl.style.setProperty('--num-top', portrait ? Math.max(8, fy * 100 - 22) + '%' : '12%');
}
new ResizeObserver(fitIntro).observe(introCanvas);

function disposeIntroObj(o){
  o.traverse(m => {
    if (m.geometry && (!o.userData.compartida || m.userData.geoPropia)) m.geometry.dispose();
    if (m.material && m.material !== introLensMat && m.material.map !== _carey) m.material.dispose?.();
  });
}
async function buildIntroObj(def){
  const saveL = lensMats, saveG = glareMats;
  let obj;
  if (isGLB(def)) obj = instantiateGLB(def, await loadTemplate(def), def.colores[0]);
  else { obj = buildFrame(def, def.colores[0]); splayTemples(obj); }
  lensMats = saveL; glareMats = saveG;
  obj.traverse(o => {
    if (o.isMesh && o.userData.esLente){ if (o.material !== introLensMat) o.material.dispose?.(); o.material = introLensMat; o.renderOrder = 2; }
    if (o.isMesh) o.frustumCulled = false;
  });
  obj.rotation.x = 0;
  const holder = new THREE.Group(); holder.add(obj);
  holder.position.y = -(def.offY || 0);
  return holder;
}
async function showIntroFrame(i, dir = 1){
  introIdx = (i + FRAMES.length) % FRAMES.length;
  const def = FRAMES[introIdx];
  $('introName').textContent = def.nombre + '.';
  $('introMeta').textContent = `${def.estilo} · ${def.medidas}`;
  $('introDesc').textContent = def.desc || '';
  $('introNum').textContent = String(introIdx + 1).padStart(2, '0');
  [...$('introIndex').children].forEach((b, k) => b.setAttribute('aria-current', String(k === introIdx)));
  const token = ++introLoad;
  let obj;
  try { obj = await buildIntroObj(def); } catch (e){ console.error(e); return; }
  if (token !== introLoad){ disposeIntroObj(obj); return; }
  if (introOld){ introPivot.remove(introOld); disposeIntroObj(introOld); }
  introOld = introObj; introObj = obj; introDir = dir; introSwapT = introOld ? 0 : 1;
  introPivot.add(obj);
}
function buildIntroIndex(){
  const box = $('introIndex'); box.innerHTML = '';
  FRAMES.forEach((def, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.setAttribute('aria-label', def.nombre); b.setAttribute('aria-current', String(i === introIdx));
    b.addEventListener('click', () => showIntroFrame(i, i > introIdx ? 1 : -1));
    box.append(b);
  });
}
$('introPrev').addEventListener('click', () => showIntroFrame(introIdx - 1, -1));
$('introNext').addEventListener('click', () => showIntroFrame(introIdx + 1, 1));

// arrastrar para girar, deslizar rápido para cambiar
let drag = null;
introCanvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, x0: e.clientX, t: performance.now() }; introCanvas.setPointerCapture(e.pointerId); });
introCanvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; introDragV = dx * 0.012; introDrag += introDragV; });
introCanvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x0, dt = performance.now() - drag.t;
  if (Math.abs(dx) > 70 && dt < 450) showIntroFrame(introIdx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  drag = null;
});

const ease = t => 1 - Math.pow(1 - t, 3);
let introRunning = false, introT0 = performance.now(), introPrevT = performance.now();
function introLoop(now){
  if (screen !== 'intro'){ introRunning = false; return; }
  requestAnimationFrame(introLoop);
  const t = (now - introT0) / 1000, dt = Math.min(0.05, (now - introPrevT) / 1000); introPrevT = now;
  if (!drag){ introDragV *= 0.92; introDrag += introDragV; introDrag *= 0.985; }
  introSwapT = Math.min(1, introSwapT + dt / 0.75);
  const s = ease(introSwapT);
  const floatY = Math.sin(t * 0.9) * 0.018;
  if (introObj){
    introObj.position.set((1 - s) * 0.9 * introDir, floatY, 0);
    introObj.rotation.set(0.1 + Math.sin(t * 0.6) * 0.04, Math.sin(t * 0.32) * 0.42 + introDrag + (1 - s) * -1.2 * introDir, Math.sin(t * 0.5) * 0.02);
    introObj.scale.setScalar(0.85 + 0.15 * s);
  }
  if (introOld){
    introOld.position.set(-s * 0.9 * introDir, floatY, 0);
    introOld.rotation.y += dt * 1.6 * introDir;
    introOld.scale.setScalar(Math.max(0.001, 1 - 0.6 * s));
    if (s >= 1){ introPivot.remove(introOld); disposeIntroObj(introOld); introOld = null; }
  }
  $('introShadow').style.opacity = String(0.7 + floatY * 8);
  introR.render(introScene, introCam);
}
function startIntroLoop(){ if (!introRunning){ introRunning = true; introPrevT = performance.now(); requestAnimationFrame(introLoop); } }

/* =========================================================
   PANTALLAS
   ========================================================= */
let camReady = false, starting = false;
async function startCamera(){
  const btn = $('btnTry'), label = $('btnTryLabel'), statusEl = $('status');
  btn.disabled = true; statusEl.className = 'status'; statusEl.textContent = '';
  try {
    label.textContent = 'Encendiendo la cámara…';
    await initCamera();
    label.textContent = 'Preparando el seguimiento…';
    await initLandmarker();
    camReady = true;
    initHands();   // en segundo plano
    return true;
  } catch (e){
    console.error(e);
    statusEl.className = 'status err';
    const msgs = {
      NotAllowedError: 'La cámara está bloqueada. Permite el acceso a la cámara en el navegador y vuelve a intentarlo.',
      NotFoundError: 'No se encontró ninguna cámara conectada.',
      NotReadableError: 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.',
      Insecure: 'El navegador no permite usar la cámara aquí. Abre la página con https o en Chrome/Edge.',
    };
    statusEl.textContent = msgs[e.name] || ('No se pudo iniciar: ' + (e.message || e));
    return false;
  } finally {
    btn.disabled = false; label.textContent = 'Probármelos';
  }
}
async function goApp(tab = 'monturas'){
  if (starting) return;
  starting = true;
  try {
    if (!camReady && !(await startCamera())) return;
    if (state.frame !== introIdx) setFrame(introIdx, 0);
    const app = $('app');
    app.hidden = false; app.classList.add('entering');
    introEl.classList.add('leaving');
    screen = 'app';
    requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('entering')));
    setTimeout(() => { introEl.hidden = true; introEl.classList.remove('leaving'); }, 650);
    openTab(tab, false);
    fitCamera();
    lastActivity = performance.now();
  } finally { starting = false; }
}
function goHome(){
  if (screen === 'intro') return;
  screen = 'intro';
  releaseGrab(); $('handCursor').classList.remove('on');
  introEl.hidden = false; introEl.classList.add('entering');
  requestAnimationFrame(() => requestAnimationFrame(() => introEl.classList.remove('entering')));
  $('app').hidden = true;
  modal.hidden = true;
  if (introIdx !== state.frame || !introObj) showIntroFrame(state.frame, 1);
  fitIntro(); startIntroLoop();
}
$('btnTry').addEventListener('click', () => goApp('monturas'));
$('btnTransitions').addEventListener('click', () => {
  if (state.trType === 'claro'){ state.trType = 'gens'; state.trColor = 0; }
  state.tintTarget = 1; buildTintUI(); updateLens();
  goApp('transitions');
});
$('btnGestures').addEventListener('click', () => { $('gestureHelp').hidden = false; });
$('btnHelpClose').addEventListener('click', () => { $('gestureHelp').hidden = true; });
$('btnHome').addEventListener('click', goHome);

// Volver solo a la entrada si nadie usa el probador
const IDLE_MS = 75000;
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { lastActivity = performance.now(); }, { passive: true }));
setInterval(() => { if (screen === 'app' && modal.hidden && performance.now() - lastActivity > IDLE_MS) goHome(); }, 2000);

/* =========================================================
   DIAL CON GESTOS DE LA MANO
   Pellizco (pulgar + índice) = tomar la perilla. Girar la mano = cambiar el valor. Mano abierta 1 s = cambiar qué controla.
   ========================================================= */
let handLm = null, handFrame = 0;
const G = { on: true, ready: false, param: 0, pinch: false, pinchT: 0, grabbed: false, grabAng: 0, grabVal: 0, palmT: 0, lastHand: 0,
            ang: 0, rawPrev: null, angF: new OneEuro(1.6, 0.6), pos: { x: 0, y: 0 }, shownUntil: 0 };
const LENS_OPTS = TR.flatMap(t => t.colores.map((c, ci) => ({ type: t.id, color: ci, n: t.id === 'claro' ? 'Sin Transitions' : (c.n === t.n ? t.n : `${t.n} · ${c.n}`) })));
const DIAL = [
  { id: 'luz', n: 'Oscuridad del lente', kind: 'cont', short: 'Oscuridad',
    get: () => state.tintTarget, set: v => { state.tint = state.tintTarget = v; updateLens(); },
    label: () => TR_BY[state.trType].id === 'claro' ? 'Lente claro' : lightName(state.tint) },
  { id: 'color', n: 'Color de la montura', kind: 'disc', short: 'Color',
    count: () => FRAMES[state.frame].colores.length, get: () => state.color, set: i => setFrame(state.frame, i),
    label: () => FRAMES[state.frame].colores[state.color].n },
  { id: 'montura', n: 'Montura', kind: 'disc', short: 'Montura',
    count: () => FRAMES.length, get: () => state.frame, set: i => setFrame(i, 0), label: () => FRAMES[state.frame].nombre },
  { id: 'lente', n: 'Color del lente', kind: 'disc', short: 'Lente',
    count: () => LENS_OPTS.length,
    get: () => Math.max(0, LENS_OPTS.findIndex(o => o.type === state.trType && o.color === state.trColor)),
    set: i => { const o = LENS_OPTS[i]; state.trType = o.type; state.trColor = o.color; state.mirror = 0;
                if (o.type !== 'claro' && state.tintTarget < 0.5) state.tintTarget = 1; buildTintUI(); updateLens(); },
    label: () => LENS_OPTS[Math.max(0, LENS_OPTS.findIndex(o => o.type === state.trType && o.color === state.trColor))].n },
];
const STEP = THREE.MathUtils.degToRad(24);   // un paso del dial cada 24° de giro

async function initHands(){
  try {
    const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    const opts = delegate => ({
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate },
      runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
    });
    try { handLm = await HandLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch (e){ handLm = await HandLandmarker.createFromOptions(fileset, opts('CPU')); }
    G.ready = true; updateDialPill();
  } catch (e){
    console.warn('Gestos no disponibles', e);
    G.ready = false; $('dialLabel').textContent = 'Gestos no disponibles';
  }
}
function updateDialPill(){
  $('dialLabel').textContent = !G.ready ? 'Cargando…' : G.on ? DIAL[G.param].short : 'Apagados';
  $('btnDial').setAttribute('aria-pressed', String(G.on && G.ready));
}
$('btnDial').addEventListener('click', () => {
  if (state.debug){ G.on = !G.on; updateDialPill(); toast(G.on ? 'Gestos activados' : 'Gestos desactivados', 1600); return; }
  nextParam(true);
});
function nextParam(fromTap){
  G.param = (G.param + 1) % DIAL.length;
  updateDialPill();
  const r = $('app').getBoundingClientRect();
  showDial(fromTap ? r.width / 2 : G.pos.x, fromTap ? r.height * 0.5 : G.pos.y, 1400);
}

// coordenadas normalizadas del video → píxeles de pantalla (con el espejo)
function videoToScreen(nx, ny){
  const W = stage.clientWidth, H = stage.clientHeight;
  const vx = nx * vw, vy = (1 - ny) * vh;
  const sx = (vx - camera.left) / (camera.right - camera.left) * W;
  const sy = (camera.top - vy) / (camera.top - camera.bottom) * H;
  return { x: W - sx, y: sy };
}
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function isOpenPalm(lm){
  const w = lm[0], d = i => Math.hypot(lm[i].x - w.x, lm[i].y - w.y);
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]].every(([tip, pip]) => d(tip) > d(pip) * 1.12);
  const size = d(9);
  const thumbOut = Math.hypot(lm[4].x - lm[5].x, lm[4].y - lm[5].y) > size * 0.55;
  const spread = Math.hypot(lm[8].x - lm[20].x, lm[8].y - lm[20].y) > size * 0.75;
  return fingers && thumbOut && spread;
}
function gestureTick(now){
  if (!G.on || !handLm || screen !== 'app' || !vw) return;
  if (++handFrame % 2) return;                  // la mano se analiza un cuadro sí y uno no
  let res;
  try { res = handLm.detectForVideo(video, now); } catch (e){ return; }
  handStep(res, now);
}
function handStep(res, now){
  const lm = res && res.landmarks && res.landmarks[0];
  const cursor = $('handCursor');
  if (!lm){
    if (now - G.lastHand > 350){ releaseGrab(); cursor.classList.remove('on'); }
    if (now > G.shownUntil && !G.grabbed) $('dial').classList.remove('on');
    return;
  }
  G.lastHand = now; lastActivity = now;
  const P = i => videoToScreen(lm[i].x, lm[i].y);
  const p0 = P(0), p4 = P(4), p8 = P(8), p9 = P(9);
  const size = Math.max(1, dist2(p0, p9));
  const pd = dist2(p4, p8) / size;
  const pinching = G.pinch ? pd < 0.5 : pd < 0.3;
  const mid = { x: (p4.x + p8.x) / 2, y: (p4.y + p8.y) / 2 };
  // ángulo de la mano (muñeca → nudillo del medio), continuo y suavizado
  const raw = Math.atan2(p9.y - p0.y, p9.x - p0.x);
  if (G.rawPrev == null) G.ang = raw;
  else { let d = raw - G.rawPrev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; G.ang += d; }
  G.rawPrev = raw;
  const ang = G.angF.filter(G.ang, now / 1000);

  cursor.classList.add('on'); cursor.classList.toggle('pinch', pinching);
  const cp = pinching ? mid : p8;
  cursor.style.left = cp.x + 'px'; cursor.style.top = cp.y + 'px';
  G.pos = mid;

  if (pinching && !G.pinch){ G.pinch = true; G.pinchT = now; }
  if (!pinching && G.pinch){ G.pinch = false; releaseGrab(); }
  if (G.pinch && !G.grabbed && now - G.pinchT > 160){
    const p = DIAL[G.param];
    G.grabbed = true; G.grabAng = ang; G.grabVal = p.get();
    showDial(mid.x, mid.y);
  }
  if (G.grabbed){
    const p = DIAL[G.param], delta = ang - G.grabAng;
    if (p.kind === 'cont'){
      const v = THREE.MathUtils.clamp(G.grabVal + delta / (Math.PI * 0.7), 0, 1);
      if (Math.abs(v - p.get()) > 0.004) p.set(v);
    } else {
      const n = p.count(), idx = (((G.grabVal + Math.round(delta / STEP)) % n) + n) % n;
      if (idx !== p.get()){ p.set(idx); pulseDial(); }
    }
    dialRefresh(delta);
  }
  // mano abierta un momento: cambiar lo que controla el dial
  if (!G.pinch && isOpenPalm(lm)){
    if (!G.palmT) G.palmT = now;
    else if (now - G.palmT > 900){ G.palmT = now + 1e6; nextParam(false); }
  } else if (G.palmT && G.palmT < now + 1e5) G.palmT = 0;
  else if (!isOpenPalm(lm)) G.palmT = 0;
}
function releaseGrab(){
  if (G.grabbed){ G.grabbed = false; G.shownUntil = performance.now() + 900; setTimeout(() => { if (!G.grabbed && performance.now() >= G.shownUntil) $('dial').classList.remove('on'); }, 950); }
}
function showDial(x, y, ms){
  const d = $('dial'), app = $('app'), r = d.offsetWidth / 2 || 140;
  const W = app.clientWidth, H = app.clientHeight;
  const railW = $('rail').offsetWidth + 28;   // sin tapar el riel de la derecha
  d.style.left = THREE.MathUtils.clamp(x, r + 12, W - r - railW) + 'px';
  d.style.top = THREE.MathUtils.clamp(y, r + 80, H - r - 12) + 'px';
  d.classList.add('on');
  dialRefresh(0);
  if (ms){ G.shownUntil = performance.now() + ms; setTimeout(() => { if (!G.grabbed && performance.now() >= G.shownUntil) d.classList.remove('on'); }, ms + 50); }
}
function pulseDial(){ const d = $('dial'); d.animate([{ transform: 'translate(-50%,-50%) scale(1.06)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 180 }); }
function dialRefresh(delta = 0){
  const p = DIAL[G.param], svg = $('dialSvg');
  if (!svg) return;
  $('dialParam').textContent = p.n;
  $('dialValue').textContent = p.label();
  $('dialHint').textContent = G.grabbed ? 'Suelta para dejarlo así' : 'Pellizca y gira la mano';
  const R = 86, parts = [];
  parts.push(`<circle r="${R}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="10"/>`);
  if (p.kind === 'cont'){
    // arco de -135° a +135°
    const a0 = -225, a1 = 45, v = p.get(), av = a0 + (a1 - a0) * v;
    const pt = a => [R * Math.cos(a * Math.PI / 180), R * Math.sin(a * Math.PI / 180)];
    const [x0, y0] = pt(a0), [x1, y1] = pt(av), [xe, ye] = pt(a1);
    parts.push(`<path d="M${x0} ${y0} A${R} ${R} 0 1 1 ${xe} ${ye}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="10" stroke-linecap="round"/>`);
    parts.push(`<path d="M${x0} ${y0} A${R} ${R} 0 ${av - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}" fill="none" stroke="url(#dialGrad)" stroke-width="10" stroke-linecap="round"/>`);
    parts.push(`<circle cx="${x1}" cy="${y1}" r="9" fill="#fff"/>`);
  } else {
    const n = p.count(), cur = p.get();
    for (let i = 0; i < n; i++){
      const a = (-90 + (i - cur) * (360 / Math.max(n, 12))) * Math.PI / 180;
      const on = i === cur, r0 = on ? R - 14 : R - 8, r1 = on ? R + 8 : R + 2;
      parts.push(`<line x1="${r0 * Math.cos(a)}" y1="${r0 * Math.sin(a)}" x2="${r1 * Math.cos(a)}" y2="${r1 * Math.sin(a)}" stroke="${on ? '#fff' : 'rgba(255,255,255,.55)'}" stroke-width="${on ? 5 : 2.5}" stroke-linecap="round"/>`);
    }
  }
  // indicador del giro de la mano
  if (G.grabbed){   // marca del giro de la mano, sobre el borde exterior
    const a = -90 * Math.PI / 180 + delta;
    parts.push(`<circle cx="${(R + 16) * Math.cos(a)}" cy="${(R + 16) * Math.sin(a)}" r="6" fill="#fff" stroke="rgba(0,0,0,.25)"/>`);
  }
  svg.innerHTML = `<defs><linearGradient id="dialGrad" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9fb8ff"/><stop offset="1" stop-color="#3a3f4a"/></linearGradient></defs>${parts.join('')}`;
}

/* ---------- Teclado (para la demo en laptop) ---------- */
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight'){ screen === 'intro' ? showIntroFrame(introIdx + 1, 1) : setFrame(state.frame + 1); }
  else if (e.key === 'ArrowLeft'){ screen === 'intro' ? showIntroFrame(introIdx - 1, -1) : setFrame(state.frame - 1); }
  else if (e.key === 'Enter' && screen === 'intro') goApp();
  else if (e.key === 'Escape') goHome();
  else if (e.key === 'd' || e.key === 'D') setAdmin(!state.debug);
  else if (!state.debug) return;
  else if (e.key === '+' || e.key === '=') { state.fitScale += 0.02; if (current) updateSkull(current); }
  else if (e.key === '-') { state.fitScale -= 0.02; if (current) updateSkull(current); }
  else if (e.key === 'w' || e.key === 'W') state.fitOffY += 0.1;
  else if (e.key === 's' || e.key === 'S') state.fitOffY -= 0.1;
  else if (e.key === 'q' || e.key === 'Q') state.fitOffZ += 0.1;
  else if (e.key === 'e' || e.key === 'E') state.fitOffZ -= 0.1;
  else if (e.key === 'o' || e.key === 'O'){ state.showOcc = !state.showOcc; setOccluderDebug(state.showOcc); }
  else if (e.key === 'r' || e.key === 'R'){
    const def = FRAMES[state.frame];
    if (!isGLB(def)) return;
    def.giroExtra = ((def.giroExtra || 0) + 90) % 360;
    def._tpl = null;
    setFrame(state.frame, state.color);
    renderGLBThumb(def, $('frame-' + def.id));
  }
});

/* ---------- Modo ajuste (solo para el personal de la óptica) ----------
   Teclado: D. Pantalla táctil: 5 toques seguidos sobre el nombre de la óptica o sobre la montura actual. */
function setAdmin(on){
  state.debug = on;
  debugEl.hidden = !on;
  $('uploadChip').hidden = !on;
  if (!on && state.showOcc){ state.showOcc = false; setOccluderDebug(false); }
  toast(on ? 'Modo ajuste activado' : 'Modo ajuste desactivado', 1800);
}
let taps = [];
function tapAdmin(){
  const t = performance.now();
  taps = taps.filter(x => t - x < 2500); taps.push(t);
  if (taps.length >= 5){ taps = []; setAdmin(!state.debug); }
}
$('brand').addEventListener('click', tapAdmin);
$('nowPill').addEventListener('click', tapAdmin);
function modelInfo(){
  const def = FRAMES[state.frame];
  if (!isGLB(def) || !def._info) return '';
  return `\nmodelo: giro ${def._info.rotY}° (R)\nancho ${def._info.anchoMm} mm · lentes ${def._info.lentes}`;
}

/* ---------- Cargar un modelo propio (modo ajuste) ---------- */
let propios = 0;
$('fileGlb').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/\.glb$/i.test(file.name)){ toast('Ese archivo no es .glb. Exporta desde Blender como «glTF Binary (.glb)».'); return; }
  const def = {
    id: 'propio-' + (++propios), nombre: file.name.replace(/\.glb$/i, ''), estilo: 'Modelo cargado', ref: '—',
    medidas: 'Medidas del archivo', colores: [{ n: 'Original', muestra: '#7d868c' }], _buf: await file.arrayBuffer(),
  };
  FRAMES.push(def);
  buildFramesUI();
  await setFrame(FRAMES.length - 1, 0);
  if (def._info && def._info.lentes === 0) toast('Modelo cargado, pero no encontré lentes. Nombra el objeto de los lentes «lente» para que funcionen Transitions y los tratamientos.', 7000);
});

/* ---------- Arranque ---------- */
buildFramesUI();
buildTintUI();
loadHead();
loadEnvironment();
setFrame(0, 0);
fitCamera();
fitIntro();
document.fonts?.ready.then(fitIntro);
showIntroFrame(0, 1);
startIntroLoop();
updateDialPill();

// Acceso para pruebas desde la consola del navegador
window.__probador = { loadEnvironment, personal, updateLens, buildTintUI, FILT, fPos, fRot, fScale, THREE, renderer, camera, scene, videoMesh, state, anchor, skull, faceOcc, glasses, fit, HEAD,
  goApp, goHome, openTab, showIntroFrame, handStep, G, DIAL, videoToScreen,
  get screen(){ return screen; }, get headOcc(){ return headOcc; }, get current(){ return current; } };

requestAnimationFrame(loop);
