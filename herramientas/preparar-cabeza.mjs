// Alinea un modelo de cabeza con la cara canónica de MediaPipe y lo deja listo como oclusor invisible:
// - transforma la cabeza a centímetros de la cara canónica (misma orientación y escala)
// - quita la zona de la cara (esa la pone el rostro detectado en vivo)
// - guarda solo posiciones e índices
// Uso: node preparar-cabeza.mjs cabeza.glb puntos.json salida.glb
import fs from 'fs';
import { NodeIO, Document } from '@gltf-transform/core';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const [IN, PTS, OUT] = process.argv.slice(2);

const canonSrc = fs.readFileSync('/tmp/chk/canon.js', 'utf8');
const CANON_V = new Float32Array(JSON.parse('[' + canonSrc.match(/CANON_V = new Float32Array\(\[(.*?)\]\)/)[1] + ']'));
const { fitPose } = require('/tmp/chk/posecore.js');

const pts = JSON.parse(fs.readFileSync(PTS, 'utf8')).pts;
const idx = Object.keys(pts).map(Number);
const model = new Float32Array(468 * 3);
for (const i of idx) model.set(pts[i], i * 3);
// canon ≈ s·R·model + t
let f = fitPose(CANON_V, model, idx);
// segunda pasada sin los puntos con más error (orejas mal detectadas, etc.)
const err = i => { const R = f.R, m = model.subarray(i * 3, i * 3 + 3); let e = 0; for (let r = 0; r < 3; r++){ const v = f.s * (R[r*3]*m[0] + R[r*3+1]*m[1] + R[r*3+2]*m[2]) + f.t[r] - CANON_V[i*3+r]; e += v * v; } return Math.sqrt(e); };
const sorted = idx.map(i => [i, err(i)]).sort((a, b) => a[1] - b[1]);
const keep = sorted.slice(0, Math.floor(sorted.length * 0.85)).map(x => x[0]);
f = fitPose(CANON_V, model, keep);
const mean = keep.reduce((a, i) => a + err(i), 0) / keep.length;
console.log(`ajuste: escala ${f.s.toFixed(3)} · error medio ${mean.toFixed(2)} cm en ${keep.length} puntos`);

const io = new NodeIO();
const doc = await io.read(IN);
const out = [], tri = [];
for (const node of doc.getRoot().listNodes()){
  const mesh = node.getMesh(); if (!mesh) continue;
  const W = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()){
    const pos = prim.getAttribute('POSITION'), ind = prim.getIndices().getArray();
    const base = out.length / 3, v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++){
      pos.getElement(i, v);
      const w = [0, 1, 2].map(r => W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]);
      const c = [0, 1, 2].map(r => f.s * (f.R[r*3]*w[0] + f.R[r*3+1]*w[1] + f.R[r*3+2]*w[2]) + f.t[r]);
      out.push(...c);
    }
    for (const k of ind) tri.push(base + k);
  }
}
// quitar la cara: triángulos al frente dentro de la zona que cubre la malla en vivo
const kept = [];
let removed = 0;
for (let t = 0; t < tri.length; t += 3){
  let cx = 0, cy = 0, cz = 0;
  for (let k = 0; k < 3; k++){ cx += out[tri[t+k]*3] / 3; cy += out[tri[t+k]*3+1] / 3; cz += out[tri[t+k]*3+2] / 3; }
  if (Math.abs(cx) < 5.6 && cy > -10 && cy < 8.0 && cz > 0.5){ removed++; continue; }
  kept.push(tri[t], tri[t+1], tri[t+2]);
}
const P = new Float32Array(out);
let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++){ mn[k] = Math.min(mn[k], P[i+k]); mx[k] = Math.max(mx[k], P[i+k]); }
console.log('cabeza (cm) min', mn.map(v => v.toFixed(1)).join(','), 'max', mx.map(v => v.toFixed(1)).join(','));
console.log(`triángulos: ${kept.length / 3} (se quitaron ${removed} de la cara)`);

const d2 = new Document(); const buf = d2.createBuffer();
const prim = d2.createPrimitive()
  .setAttribute('POSITION', d2.createAccessor().setType('VEC3').setArray(P).setBuffer(buf))
  .setIndices(d2.createAccessor().setType('SCALAR').setArray(new Uint16Array(kept)).setBuffer(buf));
const node = d2.createNode('cabeza').setMesh(d2.createMesh('cabeza').addPrimitive(prim));
d2.createScene('Scene').addChild(node);
d2.getRoot().getAsset().extras = { title: 'Male Head (oclusor)', author: 'Alexander Antipov (https://sketchfab.com/Dessen)', license: 'CC-BY-4.0', source: 'https://sketchfab.com/3d-models/male-head-0247a25a04ba46b99629130277fe39b7', cambios: 'Alineada a la cara canónica de MediaPipe, sin la zona de la cara, sin materiales' };
await new NodeIO().write(OUT, d2);
console.log('guardado', OUT, fs.statSync(OUT).size, 'bytes');
