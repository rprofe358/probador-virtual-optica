// Arma la carpeta www/ de la app Android: la misma página del probador, pero con todo
// incluido para funcionar sin internet (Three.js, MediaPipe y sus modelos, fuentes,
// monturas y entorno). Uso: node preparar-www.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const WWW = path.join(AQUI, 'www');
const NM = path.join(AQUI, 'node_modules');
const MODELOS = path.join(AQUI, 'modelos');   // caché de los modelos .task de MediaPipe

const MP_URL = {
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.cpSync(from, to, { recursive: true }); };

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

// 1) Página, monturas y recursos
copy(path.join(RAIZ, 'monturas'), path.join(WWW, 'monturas'));
copy(path.join(RAIZ, 'recursos'), path.join(WWW, 'recursos'));

// 2) Three.js (solo lo que usa la app)
const T = path.join(NM, 'three');
copy(path.join(T, 'build/three.module.js'), path.join(WWW, 'vendor/three/build/three.module.js'));
for (const f of ['environments/RoomEnvironment.js', 'loaders/GLTFLoader.js', 'loaders/RGBELoader.js', 'utils/BufferGeometryUtils.js'])
  copy(path.join(T, 'examples/jsm', f), path.join(WWW, 'vendor/three/examples/jsm', f));

// 3) MediaPipe: librería, wasm y modelos
const MP = path.join(NM, '@mediapipe/tasks-vision');
copy(path.join(MP, 'vision_bundle.mjs'), path.join(WWW, 'vendor/mediapipe/vision_bundle.mjs'));
copy(path.join(MP, 'wasm'), path.join(WWW, 'vendor/mediapipe/wasm'));
fs.mkdirSync(MODELOS, { recursive: true });
for (const [name, url] of Object.entries(MP_URL)){
  const local = path.join(MODELOS, name);
  if (!fs.existsSync(local) || fs.statSync(local).size < 1e5){
    console.log('Descargando', name);
    const r = await fetch(url);
    if (!r.ok) throw new Error('No se pudo descargar ' + url + ' (' + r.status + ')');
    fs.writeFileSync(local, Buffer.from(await r.arrayBuffer()));
  }
  copy(local, path.join(WWW, 'vendor/mediapipe/models', name));
}

// 4) Fuentes (Sora y Manrope, licencia OFL)
const fuentes = [['Manrope', 'manrope', [400, 500, 600, 700]], ['Sora', 'sora', [200, 300, 400, 500, 600, 700]]];
let css = '';
for (const [fam, pkg, pesos] of fuentes) for (const w of pesos){
  for (const sub of ['latin', 'latin-ext']){
    const f = `${pkg}-${sub}-${w}-normal.woff2`;
    const src = path.join(NM, '@fontsource', pkg, 'files', f);
    if (!fs.existsSync(src)) continue;
    copy(src, path.join(WWW, 'vendor/fonts', f));
    const range = sub === 'latin'
      ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
      : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
    css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${f}) format('woff2');unicode-range:${range}}\n`;
  }
}
fs.writeFileSync(path.join(WWW, 'vendor/fonts/fuentes.css'), css);

// 5) index.html con rutas locales
let html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const reemplazos = [
  [/<link rel="preconnect"[^>]*>\s*/g, ''],
  [/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="vendor/fonts/fuentes.css">'],
  ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './vendor/three/build/three.module.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './vendor/three/examples/jsm/'],
  ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs', './vendor/mediapipe/vision_bundle.mjs'],
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@0\.10\.14\/wasm/g, './vendor/mediapipe/wasm'],
  ['https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', './vendor/mediapipe/models/face_landmarker.task'],
  ['https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', './vendor/mediapipe/models/hand_landmarker.task'],
];
for (const [a, b] of reemplazos){
  const antes = html;
  html = typeof a === 'string' ? html.split(a).join(b) : html.replace(a, b);
  if (html === antes && !(a instanceof RegExp && a.source.startsWith('<link rel="preconnect"'))) throw new Error('No encontré en index.html: ' + a);
}
const quedan = html.match(/https?:\/\/(cdn\.jsdelivr|storage\.googleapis|fonts\.g)[^"' )]*/g);
if (quedan) throw new Error('Quedan recursos externos: ' + quedan.join(', '));
fs.writeFileSync(path.join(WWW, 'index.html'), html);

const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log('www listo:', (size(WWW) / 1e6).toFixed(1), 'MB');
