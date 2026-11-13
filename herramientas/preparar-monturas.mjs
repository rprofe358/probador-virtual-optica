// Limpia y optimiza los GLB descargados para el probador:
// - nombra el objeto de los lentes "lente" y el resto "montura"
// - separa los lentes cuando vienen pegados a la montura (usando la textura de transmisión)
// - quita luces, cámaras, firmas de texto y atributos que no se usan
// - comprime geometría (cuantización) y texturas (WebP 512 px)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const IN = process.argv[2], OUT = process.argv[3];
const opts = JSON.parse(process.argv[4] || '{}');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(IN);
const root = doc.getRoot();

// 1) Quitar nodos que no queremos (firma de texto, luces, cámaras)
for (const n of root.listNodes()) {
  if ((opts.quitar || []).some(q => n.getName() === q)) n.dispose();
}

// 2) Renombrar lentes existentes
for (const n of root.listNodes()) {
  if ((opts.lentes || []).includes(n.getName())) {
    n.setName('lente');
    for (const c of n.listChildren()) if (c.getMesh()) c.setName('lente');
    if (n.getMesh()) n.getMesh().setName('lente');
  }
}

// 3) Separar lentes pegados a la montura usando la textura de transmisión
if (opts.separarPorTransmision) {
  await weld(  )(doc);
  for (const node of root.listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      const tr = mat?.getExtension('KHR_materials_transmission');
      const tex = tr?.getTransmissionTexture(); if (!tex) continue;
      const { data, info } = await sharp(tex.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const uv = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices().getArray();
      const lensT = [], frameT = [];
      const a = [], b = [], c = [];
      for (let t = 0; t < idx.length; t += 3) {
        uv.getElement(idx[t], a); uv.getElement(idx[t + 1], b); uv.getElement(idx[t + 2], c);
        let u = (a[0] + b[0] + c[0]) / 3, v = (a[1] + b[1] + c[1]) / 3;
        u -= Math.floor(u); v -= Math.floor(v);
        const px = Math.min(info.width - 1, Math.floor(u * info.width)), py = Math.min(info.height - 1, Math.floor(v * info.height));
        const R = data[(py * info.width + px) * info.channels];
        (R > opts.umbral ? lensT : frameT).push(idx[t], idx[t + 1], idx[t + 2]);
      }
      // Componentes conectados: solo las piezas grandes son lentes (las plaquetas vuelven a la montura)
      const parent = new Map();
      const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
      const uni = (x, y) => { x = find(x); y = find(y); if (x !== y) parent.set(x, y); };
      for (const i of lensT) if (!parent.has(i)) parent.set(i, i);
      for (let t = 0; t < lensT.length; t += 3) { uni(lensT[t], lensT[t + 1]); uni(lensT[t], lensT[t + 2]); }
      const size = new Map();
      for (let t = 0; t < lensT.length; t += 3) { const r = find(lensT[t]); size.set(r, (size.get(r) || 0) + 1); }
      const sorted = [...size.entries()].sort((x, y) => y[1] - x[1]);
      console.log('  componentes de lente (triángulos):', sorted.slice(0, 8).map(s => s[1]).join(', '));
      const keep = new Set(sorted.filter(s => s[1] >= sorted[0][1] * 0.3).map(s => s[0]));
      const lensF = [];
      for (let t = 0; t < lensT.length; t += 3) (keep.has(find(lensT[t])) ? lensF : frameT).push(lensT[t], lensT[t + 1], lensT[t + 2]);
      console.log(`  lente: ${lensF.length / 3} triángulos · montura: ${frameT.length / 3}`);

      const IdxType = idx.constructor;
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new IdxType(frameT)).setBuffer(prim.getIndices().getBuffer()));
      mat.setExtension('KHR_materials_transmission', null).setAlphaMode('OPAQUE').setName('montura');
      const lensMat = doc.createMaterial('lente').setAlphaMode('BLEND').setBaseColorFactor([1, 1, 1, 0.12]).setRoughnessFactor(0.05).setDoubleSided(true);
      const lp = doc.createPrimitive().setMaterial(lensMat)
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(new IdxType(lensF)).setBuffer(prim.getIndices().getBuffer()));
      for (const sem of prim.listSemantics()) lp.setAttribute(sem, prim.getAttribute(sem));
      const lensNode = doc.createNode('lente').setMesh(doc.createMesh('lente').addPrimitive(lp))
        .setMatrix(node.getMatrix());
      const par = node.getParentNode();
      if (par) par.addChild(lensNode); else root.listScenes()[0].addChild(lensNode);
      node.setName('montura'); mesh.setName('montura');
    }
  }
}

// 4) Las tangentes no hacen falta (Three.js las resuelve en el shader) y pesan mucho
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('TANGENT', null);

// 5) Optimizar
await doc.transform(
  prune({ keepLeaves: false, keepAttributes: false }),
  dedup(),
  weld(),
  quantize(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 88 }),
  prune({ keepLeaves: false }),
);
await io.write(OUT, doc);
const tris = root.listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((q, p) => q + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
console.log('  nodos:', root.listNodes().map(n => n.getName()).join(' | '));
console.log('  triángulos:', tris);
