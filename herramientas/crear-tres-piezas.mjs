// Genera una montura de tres piezas (lente al aire perforado) como GLB.
// Unidades en metros. Y arriba, frente hacia +Z, patillas hacia -Z.
// Partes: lentes ("lente"), canto visible del lente ("canto"), puente, plaquetas,
// terminales y patillas de titanio, y terminales de las patillas en acetato.
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, quantize } from '@gltf-transform/functions';

const OUT = process.argv[2] || '../monturas/tres-piezas.glb';
const mm = v => v / 1000;

// ---- medidas (mm)
const LW = 52, LH = 33, BRIDGE = 18, TEMPLE = 140;
const CX = BRIDGE / 2 + LW / 2;            // centro de cada lente en x
const N = 3.6;                              // superelipse: rectangular de esquinas suaves

// contorno del lente derecho (x > 0), con el canto inferior interno algo más redondeado
function outline(side = 1, n = 160){
  const pts = [];
  for (let i = 0; i < n; i++){
    const t = i / n * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    let x = (LW / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / N);
    let y = (LH / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / N);
    // la parte de abajo un poco más angosta (forma de lente de oficina)
    if (y < 0) x *= 1 - 0.08 * (-y / (LH / 2)) ** 2;
    // el lado de la nariz baja un poco más redondeado
    if (y < 0 && x < 0) { const k = (-y / (LH / 2)) * (-x / (LW / 2)); x *= 1 - 0.06 * k; y *= 1 - 0.06 * k; }
    pts.push([side * (CX + x * side), y]);   // side=1: lente derecho; el lado nasal es x pequeña
  }
  return pts;
}
// convierte el contorno para que el lado nasal quede hacia el centro
function lensOutline(side){
  return outline(1).map(([x, y]) => [side * x, y]);
}

const meshes = [];   // { name, geo, mat }
const addGeo = (name, geo, mat) => meshes.push({ name, geo, mat });

// ---- lentes (planos en z = 0) y canto
for (const side of [1, -1]){
  const P = lensOutline(side);
  let cx = 0, cy = 0; for (const p of P){ cx += p[0] / P.length; cy += p[1] / P.length; }
  const pos = [mm(cx), mm(cy), 0], idx = [];
  P.forEach(p => pos.push(mm(p[0]), mm(p[1]), 0));
  for (let i = 0; i < P.length; i++) idx.push(0, 1 + i, 1 + (i + 1) % P.length);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  addGeo('lente', g, 'lente');

  // canto: pared lateral del lente (1,8 mm) y un bisel fino adelante
  const T = 1.8, B = 0.6, cpos = [], cidx = [];
  const ring = (k, z) => P.forEach(p => { const dx = p[0] - cx, dy = p[1] - cy, r = Math.hypot(dx, dy); cpos.push(mm(p[0] - dx / r * k), mm(p[1] - dy / r * k), mm(z)); });
  ring(0, -T / 2); ring(0, T / 2); ring(B, T / 2 + 0.05); ring(B, -T / 2 - 0.05);
  const n = P.length;
  for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++){ const a = r * n + i, b = r * n + (i + 1) % n, c = (r + 1) * n + i, d = (r + 1) * n + (i + 1) % n; cidx.push(a, c, b, b, c, d); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3)); cg.setIndex(cidx); cg.computeVertexNormals();
  addGeo('canto', cg, 'canto');
}

// ---- piezas de metal
const tube = (pts, r, seg = 64, rad = 10) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(mm(p[0]), mm(p[1]), mm(p[2]))), false, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, mm(r), rad, false);
};
const capped = (pts, r, seg, rad) => {
  const g = tube(pts, r, seg, rad);
  const caps = [pts[0], pts[pts.length - 1]].map(p => { const s = new THREE.SphereGeometry(mm(r), rad, 6); s.translate(mm(p[0]), mm(p[1]), mm(p[2])); return s; });
  return [g, ...caps];
};
const TOPY = 7.5;                                     // altura de los puntos de sujeción
const innerX = BRIDGE / 2 + 2.2, outerX = BRIDGE / 2 + LW - 1.5;
// puente: arco desde la perforación de un lente a la del otro
const bridgePts = [[-innerX, TOPY, -1.2], [-6, TOPY + 2.6, 0.3], [0, TOPY + 3.6, 0.8], [6, TOPY + 2.6, 0.3], [innerX, TOPY, -1.2]];
for (const g of capped(bridgePts, 0.85, 64, 10)) addGeo('puente', g, 'metal');
for (const side of [1, -1]){
  // tornillo y tuerca en la perforación nasal y en la de la sien
  for (const x of [innerX, outerX]){
    const s = new THREE.CylinderGeometry(mm(1.1), mm(1.1), mm(3.2), 14); s.rotateX(Math.PI / 2); s.translate(mm(side * x), mm(TOPY), 0);
    addGeo('tornillo', s, 'metal');
  }
  // brazo de la plaqueta y plaqueta
  const armPts = [[side * (innerX - 0.4), TOPY - 0.5, -1.6], [side * 7.2, TOPY - 6, -4.5], [side * 6.2, TOPY - 11, -6.5]];
  for (const g of capped(armPts, 0.55, 24, 8)) addGeo('brazo', g, 'metal');
  const pad = new THREE.SphereGeometry(mm(1), 16, 12); pad.scale(3.6, 6.2, 1.2);
  pad.rotateY(side * 0.5); pad.rotateZ(side * -0.15); pad.translate(mm(side * 5.3), mm(TOPY - 12.5), mm(-7));
  addGeo('plaqueta', pad, 'plaqueta');
  // terminal: de la perforación externa hacia atrás hasta la bisagra
  const hingeX = BRIDGE / 2 + LW + 3.5, hingeZ = -7;
  const endPts = [[side * outerX, TOPY, -1.2], [side * (outerX + 3.2), TOPY + 0.6, -2.2], [side * hingeX, TOPY + 0.6, hingeZ + 1.5], [side * hingeX, TOPY + 0.6, hingeZ]];
  for (const g of capped(endPts, 0.95, 32, 10)) addGeo('terminal', g, 'metal');
  const hinge = new THREE.CylinderGeometry(mm(1.3), mm(1.3), mm(3.4), 14); hinge.translate(mm(side * hingeX), mm(TOPY + 0.6), mm(hingeZ));
  addGeo('bisagra', hinge, 'metal');
  // patilla: recta hacia atrás y curva detrás de la oreja
  const straight = TEMPLE - 38;
  const tPts = [[side * hingeX, TOPY + 0.6, hingeZ]];
  for (let k = 1; k <= 6; k++) tPts.push([side * (hingeX + 1.2 * k / 6), TOPY + 0.6 - 2.5 * (k / 6) ** 2, hingeZ - straight * k / 6]);
  const zE = hingeZ - straight;
  const curvePts = [[side * (hingeX + 1.4), TOPY - 2.8, zE - 10], [side * (hingeX + 1.2), TOPY - 8, zE - 20], [side * (hingeX + 0.6), TOPY - 15, zE - 27], [side * hingeX, TOPY - 22, zE - 30]];
  const all = [...tPts, ...curvePts];
  for (const g of capped(all.slice(0, 8), 0.8, 90, 10)) addGeo('patilla', g, 'metal');
  // terminal de acetato sobre la parte curva
  const tip = capped(all.slice(6), 1.55, 40, 12);
  for (const g of tip) addGeo('puntera', g, 'puntera');
}

// ---- documento glTF
const doc = new Document();
const buf = doc.createBuffer();
const mats = {
  lente: doc.createMaterial('lente').setBaseColorFactor([1, 1, 1, 0.15]).setAlphaMode('BLEND').setDoubleSided(true).setRoughnessFactor(0.05).setMetallicFactor(0),
  canto: doc.createMaterial('canto').setBaseColorFactor([0.93, 0.96, 0.98, 0.55]).setAlphaMode('BLEND').setDoubleSided(true).setRoughnessFactor(0.12).setMetallicFactor(0),
  metal: doc.createMaterial('titanio').setBaseColorFactor([0.78, 0.80, 0.82, 1]).setMetallicFactor(1).setRoughnessFactor(0.28),
  plaqueta: doc.createMaterial('plaqueta').setBaseColorFactor([0.95, 0.95, 0.95, 0.6]).setAlphaMode('BLEND').setRoughnessFactor(0.35).setMetallicFactor(0),
  puntera: doc.createMaterial('puntera').setBaseColorFactor([0.16, 0.17, 0.19, 1]).setRoughnessFactor(0.45).setMetallicFactor(0),
};
const scene = doc.createScene('tres-piezas');
for (const { name, geo, mat } of meshes){
  const g = geo.index ? geo : geo;
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const index = g.index ? g.index.array : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buf))
    .setMaterial(mats[mat]);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}
await doc.transform(weld(), dedup(), quantize({ quantizePosition: 16, quantizeNormal: 10 }));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await io.write(OUT, doc);
let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
console.log(OUT, tris, 'triángulos');
