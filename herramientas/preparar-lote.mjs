// Prepara un lote de monturas descargadas para el probador.
// Uso: node preparar-lote.mjs <carpeta-crudos> <carpeta-salida> [solo-id]
// Por cada montura (ver CONFIG):
//  - renombra los lentes a "lente" (o los genera si el modelo no trae)
//  - evita que plaquetas o terminales transparentes se confundan con lentes
//  - unifica materiales (para que el color se cambie en toda la montura)
//  - simplifica la geometría, quita tangentes, cuantiza y pasa texturas a WebP
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, textureCompress, simplify, flatten } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const LENS_RE = /^(lente|lentes|lens|lenses|glass|cristal|cristales|vidrio|mica)(?![a-z])/i;

// lentes: regex sobre nombre de nodo o de material. generarLentes: el modelo no trae lentes.
// unificar: { materialOrigen: materialDestino }. giro: grados en Y antes de todo.
// tris: triángulos objetivo aproximados. tex: tamaño de textura.
export const CONFIG = {
  A1: { archivo: 'monturaA1', salida: 'aviador-clasico', lentes: /Glass tinted/i, tris: 30000, tex: 512 },
  A2: { archivo: 'monturaA2', salida: 'aviador-titanio', lentes: /black_lens/i, tris: 30000, tex: 512 },
  A3: { archivo: 'monturaA3', salida: 'aviador-geometrico', lentes: /^lens$/i, tris: 40000, tex: 512,
        unificar: { black: 'metalFrame', brown: 'metalFrame', white: 'metalFrame', material: 'metalFrame', 'Material.001': 'metalFrame' } },
  M1: { archivo: 'monturaM1', salida: 'moscot-zev', lentes: /MOSCOT_ZEV_TT_SE_MOSCOT/i, tris: 30000, tex: 1024 },
  M2: { archivo: 'monturaM2', salida: 'mustang-mu1683', lentes: /^Plane_Mustang/i, tris: 30000, tex: 1024 },
  O1: { archivo: 'monturaO1', salida: 'urbana-acetato-metal', lentes: /glass_mat/i, tris: 40000, tex: 1024, opacos: /glasses_mat/i },
  O2: { archivo: 'monturaO2', salida: 'ejecutiva-rectangular', generarLentes: true, giroAuto: true, tris: 20000, tex: 512 },
  O3: { archivo: 'monturaO3', salida: 'clasica-acetato', generarLentes: true, tris: 20000, tex: 512 },
  O4: { archivo: 'monturaO4', salida: 'cuadrada-fina', lentes: /lenses/i, tris: 20000, tex: 512 },
  O6: { archivo: 'monturaO6', salida: 'semi-al-aire-fina', lentes: /^Lens$/i, tris: 30000, tex: 512 },
  O7: { archivo: 'monturaO7', salida: 'geometrica-metal', lentes: /^glass$/i, tris: 20000, tex: 512 },
  R1: { archivo: 'monturaR1', salida: 'wayfarer-sol', lentes: /Glass_dark/i, tris: 30000, tex: 512,
        unificar: { Material: 'Car_plastic_dark', 'Material.003': 'Car_plastic_dark' } },
  R2: { archivo: 'monturaR2', salida: 'wayfarer-optico', generarLentes: true, tris: 40000, tex: 1024 },
  R3: { archivo: 'monturaR3', salida: 'clubmaster', generarLentes: true, tris: 45000, tex: 1024 },
  R4: { archivo: 'monturaR4', salida: 'redonda-metal-cobre', lentes: /BoxGlass/i, tris: 30000, tex: 1024 },
  V1: { archivo: 'monturaV1', salida: 'aviador-optico', lentes: /Material\.004/i, tris: 30000, tex: 1024 },
  V2: { archivo: 'monturaV2', salida: 'navegador-metal', lentes: /Glass02/i, tris: 30000, tex: 512 },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptSimplifier });

function worldTris(doc, filter = () => true){
  const out = [];
  for (const node of doc.getRoot().listNodes()){
    const mesh = node.getMesh(); if (!mesh || !filter(node)) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()){
      const pos = p.getAttribute('POSITION'), idx = p.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const v = [0, 0, 0];
      const tr = i => { pos.getElement(i, v); const [x, y, z] = v;
        return [M[0]*x + M[4]*y + M[8]*z + M[12], M[1]*x + M[5]*y + M[9]*z + M[13], M[2]*x + M[6]*y + M[10]*z + M[14]]; };
      for (let t = 0; t < n; t += 3){
        const a = idx ? idx.getScalar(t) : t, b = idx ? idx.getScalar(t + 1) : t + 1, c = idx ? idx.getScalar(t + 2) : t + 2;
        out.push([tr(a), tr(b), tr(c)]);
      }
    }
  }
  return out;
}

// Gira la escena en Y
function rotateScene(doc, deg){
  const a = deg * Math.PI / 180, s = Math.sin(a / 2), c = Math.cos(a / 2);
  const scene = doc.getRoot().listScenes()[0];
  const wrap = doc.createNode('giro').setRotation([0, s, 0, c]);
  for (const ch of scene.listChildren()){ scene.removeChild(ch); wrap.addChild(ch); }
  scene.addChild(wrap);
}

// Ángulo en Y que deja la montura simétrica respecto al plano x = centro
function autoAngle(doc){
  const pts = [];
  for (const t of worldTris(doc)) for (const p of t) pts.push(p);
  const step = Math.max(1, Math.floor(pts.length / 3000)); const P = pts.filter((_, i) => i % step === 0);
  let best = [Infinity, 0];
  for (let d = 0; d < 180; d += 1){
    const a = d * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const Q = P.map(([x, y, z]) => [x * cs + z * sn, y, -x * sn + z * cs]);
    let mn = Infinity, mx = -Infinity; for (const q of Q){ mn = Math.min(mn, q[0]); mx = Math.max(mx, q[0]); }
    const cx = (mn + mx) / 2, w = mx - mn;
    // histograma 2D de (|x-cx|, z) para cada lado
    const G = 40, H = new Map();
    let mz = Infinity, Mz = -Infinity; for (const q of Q){ mz = Math.min(mz, q[2]); Mz = Math.max(Mz, q[2]); }
    for (const q of Q){ const side = q[0] > cx ? 1 : -1; const k = Math.floor(Math.abs(q[0] - cx) / (w / 2) * G) + ',' + Math.floor((q[2] - mz) / (Mz - mz + 1e-9) * G) + ',' + Math.floor(q[1] * 0);
      const e = H.get(k) || [0, 0]; e[side > 0 ? 0 : 1]++; H.set(k, e); }
    let diff = 0; for (const [l, r] of H.values()) diff += Math.abs(l - r);
    // preferir que el eje largo (patillas) quede en z: ancho pequeño entre las simétricas
    const score = diff / Q.length + 0.0 * w;
    if (score < best[0]) best = [score, d];
  }
  return best[1];
}

// Genera lentes planos rellenando los huecos del frente de la montura
function generateLenses(doc){
  const tris = worldTris(doc);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++){ mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
  // el frente es el lado de z con más geometría ancha en x
  const depth = mx[2] - mn[2], width = mx[0] - mn[0];
  const band = (lo, hi) => tris.filter(t => { const z = (t[0][2] + t[1][2] + t[2][2]) / 3; return z >= lo && z <= hi; });
  const nearMax = band(mx[2] - 0.2 * depth, mx[2]), nearMin = band(mn[2], mn[2] + 0.2 * depth);
  const xSpan = T => { let a = Infinity, b = -Infinity; for (const t of T) for (const p of t){ a = Math.min(a, p[0]); b = Math.max(b, p[0]); } return b - a; };
  const frontIsMax = xSpan(nearMax) >= xSpan(nearMin);
  const front = frontIsMax ? nearMax : nearMin;
  // rasterizar el frente
  const RES = 700, sc = RES / width, Wd = RES + 4, Ht = Math.ceil((mx[1] - mn[1]) * sc) + 4;
  const grid = new Uint8Array(Wd * Ht), zsum = new Float32Array(Wd * Ht), zcnt = new Uint16Array(Wd * Ht);
  const X = x => (x - mn[0]) * sc + 2, Y = y => (y - mn[1]) * sc + 2;
  for (const t of front){
    const p = t.map(q => [X(q[0]), Y(q[1]), q[2]]);
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(Ht - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    const ar = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    const zc = (p[0][2] + p[1][2] + p[2][2]) / 3;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
      let inside;
      if (Math.abs(ar) < 1e-9) inside = false;
      else {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[2][0] - px) * (p[1][1] - py)) / ar;
        const w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[0][0] - px) * (p[2][1] - py)) / ar;
        inside = w0 >= -0.02 && w1 >= -0.02 && 1 - w0 - w1 >= -0.02;
      }
      if (inside || (x === Math.round(p[0][0]) && y === Math.round(p[0][1]))){ const i = y * Wd + x; grid[i] = 1; zsum[i] += zc; zcnt[i]++; }
    }
  }
  // cerrar huequitos de 1 px en la montura
  const g2 = grid.slice();
  for (let y = 1; y < Ht - 1; y++) for (let x = 1; x < Wd - 1; x++){ const i = y * Wd + x; if (!grid[i] && ((grid[i - 1] && grid[i + 1]) || (grid[i - Wd] && grid[i + Wd]))) g2[i] = 1; }
  // inundar desde el borde: lo que queda vacío y encerrado son los huecos
  const lab = new Int32Array(Wd * Ht).fill(0); const OUT = -1;
  const flood = (s, v) => { const st = [s]; lab[s] = v; let n = 0; const cells = [];
    while (st.length){ const i = st.pop(); n++; cells.push(i); const x = i % Wd, y = (i / Wd) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= Ht) continue; const j = yy * Wd + xx; if (!g2[j] && !lab[j]){ lab[j] = v; st.push(j); } } }
    return cells; };
  flood(0, OUT);
  const holes = [];
  let id = 1;
  for (let i = 0; i < Wd * Ht; i++) if (!g2[i] && !lab[i]) holes.push(flood(i, ++id));
  holes.sort((a, b) => b.length - a.length);
  const big = holes.filter(h => h.length > holes[0].length * 0.5).slice(0, 2);
  if (big.length < 2) throw new Error('No encontré dos huecos para los lentes (' + holes.slice(0, 4).map(h => h.length).join(',') + ')');
  // z del aro: promedio de la montura alrededor de cada hueco
  const positions = [], indices = [];
  for (const cells of big){
    let cx = 0, cy = 0; for (const i of cells){ cx += i % Wd; cy += (i / Wd) | 0; } cx /= cells.length; cy /= cells.length;
    const BINS = 180, rad = new Float32Array(BINS);
    for (const i of cells){ const x = i % Wd + 0.5 - cx, y = ((i / Wd) | 0) + 0.5 - cy; const b = Math.floor((Math.atan2(y, x) + Math.PI) / (2 * Math.PI) * BINS) % BINS; rad[b] = Math.max(rad[b], Math.hypot(x, y)); }
    for (let k = 0; k < BINS; k++) if (!rad[k]) rad[k] = rad[(k + BINS - 1) % BINS] || rad[(k + 1) % BINS];
    // z del aro: celdas de montura justo afuera del hueco
    let zs = 0, zn = 0;
    for (let k = 0; k < BINS; k++){ const ang = -Math.PI + (k + 0.5) / BINS * 2 * Math.PI;
      for (let d = 1; d < 12; d++){ const x = Math.round(cx + (rad[k] + d) * Math.cos(ang)), y = Math.round(cy + (rad[k] + d) * Math.sin(ang)); const i = y * Wd + x; if (i >= 0 && i < grid.length && zcnt[i]){ zs += zsum[i] / zcnt[i]; zn++; break; } } }
    const z = zn ? zs / zn : (frontIsMax ? mx[2] : mn[2]);
    const base = positions.length / 3;
    const ux = x => (x - 2) / sc + mn[0], uy = y => (y - 2) / sc + mn[1];
    positions.push(ux(cx), uy(cy), z);
    const margin = 2.5; // px: el lente entra un poco en la ranura del aro
    for (let k = 0; k < BINS; k++){ const ang = -Math.PI + (k + 0.5) / BINS * 2 * Math.PI; const r = rad[k] + margin;
      positions.push(ux(cx + r * Math.cos(ang)), uy(cy + r * Math.sin(ang)), z); }
    for (let k = 0; k < BINS; k++) indices.push(base, base + 1 + k, base + 1 + (k + 1) % BINS);
  }
  const buf = doc.getRoot().listBuffers()[0] || doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buf))
    .setMaterial(doc.createMaterial('lente').setAlphaMode('BLEND').setBaseColorFactor([1, 1, 1, 0.15]).setDoubleSided(true));
  const node = doc.createNode('lente').setMesh(doc.createMesh('lente').addPrimitive(prim));
  doc.getRoot().listScenes()[0].addChild(node);
  return { frente: frontIsMax ? '+z' : '-z', huecos: big.map(h => h.length) };
}

async function prepare(id, cfg, IN, OUTDIR){
  const file = fs.readdirSync(IN).find(f => f.startsWith(cfg.archivo + '-'));
  const doc = await io.read(path.join(IN, file));
  const root = doc.getRoot();
  const log = [];
  await doc.transform(flatten());
  if (cfg.giroAuto){ const d = autoAngle(doc); rotateScene(doc, d); log.push('giro ' + d + '°'); await doc.transform(flatten()); }
  if (cfg.giro){ rotateScene(doc, cfg.giro); await doc.transform(flatten()); }

  // unificar materiales
  if (cfg.unificar){
    const byName = new Map(root.listMaterials().map(m => [m.getName(), m]));
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()){
      const t = cfg.unificar[p.getMaterial()?.getName()]; if (t && byName.get(t)) p.setMaterial(byName.get(t));
    }
  }
  // lentes existentes
  let nLens = 0;
  if (cfg.lentes){
    for (const node of root.listNodes()){
      const mesh = node.getMesh(); if (!mesh) continue;
      const isL = cfg.lentes.test(node.getName()) || mesh.listPrimitives().some(p => cfg.lentes.test(p.getMaterial()?.getName() || ''));
      if (isL){ node.setName('lente'); mesh.setName('lente'); nLens++; }
    }
  }
  // materiales que no son lente: que no parezcan lente
  const lensMats = new Set();
  for (const node of root.listNodes()) if (node.getName() === 'lente') node.getMesh().listPrimitives().forEach(p => p.getMaterial() && lensMats.add(p.getMaterial()));
  for (const m of root.listMaterials()){
    if (lensMats.has(m)) continue;
    if (LENS_RE.test(m.getName())) m.setName('m-' + m.getName());
    m.setExtension('KHR_materials_transmission', null);
    if (m.getAlphaMode() === 'BLEND' && m.getAlpha() < 0.5) m.setAlpha(0.6);
    if (cfg.opacos && cfg.opacos.test(m.getName().replace(/^m-/, ''))) m.setAlphaMode('OPAQUE');
  }
  for (const node of root.listNodes()) if (node.getName() !== 'lente' && LENS_RE.test(node.getName())) node.setName('n-' + node.getName());
  for (const m of root.listMeshes()) if (m.getName() !== 'lente' && LENS_RE.test(m.getName())) m.setName('m-' + m.getName());

  if (cfg.generarLentes){ const r = generateLenses(doc); log.push('lentes generados ' + r.frente + ' huecos ' + r.huecos.join('/')); nLens++; }
  if (!nLens) throw new Error('sin lentes');

  for (const m of root.listMeshes()) for (const p of m.listPrimitives()){
    p.setAttribute('TANGENT', null);
    const mat = p.getMaterial(), used = new Set([0]);
    if (mat) for (const ti of [mat.getBaseColorTextureInfo(), mat.getNormalTextureInfo(), mat.getMetallicRoughnessTextureInfo(), mat.getOcclusionTextureInfo(), mat.getEmissiveTextureInfo()]) if (ti) used.add(ti.getTexCoord());
    for (const s of p.listSemantics()){ const m = /^TEXCOORD_(\d)/.exec(s); if (m && !used.has(+m[1])) p.setAttribute(s, null); }
    if (!p.getMaterial()?.getBaseColorTexture() && !p.getMaterial()?.getNormalTexture() && !p.getMaterial()?.getMetallicRoughnessTexture()) p.setAttribute('TEXCOORD_0', null);
  }
  const trisOf = () => root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((q, p) => q + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const t0 = trisOf();
  await doc.transform(prune({ keepLeaves: false, keepAttributes: false }), dedup(), weld());
  await MeshoptSimplifier.ready;
  if (trisOf() > cfg.tris){
    const ratio = Math.max(0.05, cfg.tris / trisOf());
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008, lockBorder: true }));
  }
  await doc.transform(
    quantize({ quantizePosition: 16, quantizeNormal: 10 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex, cfg.tex], quality: 86 }),
    prune({ keepLeaves: false }),
  );
  const out = path.join(OUTDIR, cfg.salida + '.glb');
  await io.write(out, doc);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${id} → ${cfg.salida}.glb  ${t0} → ${trisOf()} tri · ${kb} KB · ${log.join(' · ')} · nodos: ${[...new Set(root.listNodes().filter(n => n.getMesh()).map(n => n.getName()))].slice(0, 8).join(' | ')}`);
}

const [IN, OUTDIR, only] = process.argv.slice(2);
fs.mkdirSync(OUTDIR, { recursive: true });
for (const [id, cfg] of Object.entries(CONFIG)){
  if (only && !only.split(',').includes(id)) continue;
  try { await prepare(id, cfg, IN, OUTDIR); } catch (e){ console.log(id, 'ERROR', e.message); }
}
