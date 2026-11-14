// Genera el ícono, el banner de Android TV y la pantalla de carga de la app.
// Uso: node iconos.mjs   (requiere sharp, instalado en ../herramientas)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../herramientas/', import.meta.url));
const sharp = require('sharp');

const RES = 'android/app/src/main/res';
const INK = '#14161a', STUDIO = '#eceef1', ACCENT = '#e5484d';

// gafas centradas en una caja de 100 × 100
const gafas = (stroke, lens, w = 6) => `
  <g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">
    <rect x="9" y="36" width="35" height="27" rx="11" fill="${lens}"/>
    <rect x="56" y="36" width="35" height="27" rx="11" fill="${lens}"/>
    <path d="M44 44 q6 -6 12 0"/>
    <path d="M9 42 l-5 -3"/><path d="M91 42 l5 -3"/>
  </g>
  <circle cx="81" cy="45" r="3.2" fill="${ACCENT}"/>`;

const svg = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);
const glassesAt = (cx, cy, size, stroke, lens, sw) => `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 100})">${gafas(stroke, lens, sw)}</g>`;
const write = async (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); await sharp(buf).png().toFile(file); };

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)){
  const s = Math.round(48 * k), f = Math.round(108 * k);
  // ícono clásico (cuadrado redondeado) y redondo
  await write(`${RES}/mipmap-${d}/ic_launcher.png`, svg(s, s, `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${INK}"/>${glassesAt(s / 2, s / 2, s * 0.78, STUDIO, 'rgba(255,255,255,0.10)', 6.5)}`));
  await write(`${RES}/mipmap-${d}/ic_launcher_round.png`, svg(s, s, `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${INK}"/>${glassesAt(s / 2, s / 2, s * 0.74, STUDIO, 'rgba(255,255,255,0.10)', 6.5)}`));
  // primer plano del ícono adaptable (zona segura: 66 de 108)
  await write(`${RES}/mipmap-${d}/ic_launcher_foreground.png`, svg(f, f, glassesAt(f / 2, f / 2, f * 0.6, STUDIO, 'rgba(255,255,255,0.10)', 6.5)));
}
fs.writeFileSync(`${RES}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${INK}</color>\n</resources>\n`);
fs.rmSync(`${RES}/drawable-v24/ic_launcher_foreground.xml`, { force: true });

// banner de Android TV (320 × 180 dp → xhdpi 640 × 360)
const banner = (w, h) => svg(w, h, `<rect width="${w}" height="${h}" fill="${INK}"/>
  ${glassesAt(w * 0.25, h / 2, h * 0.75, STUDIO, 'rgba(255,255,255,0.10)', 6)}
  <text x="${w * 0.47}" y="${h * 0.47}" font-family="DejaVu Sans, sans-serif" font-size="${h * 0.15}" font-weight="600" fill="${STUDIO}">Probador</text>
  <text x="${w * 0.47}" y="${h * 0.67}" font-family="DejaVu Sans, sans-serif" font-size="${h * 0.15}" font-weight="300" fill="${STUDIO}">virtual</text>`);
await write(`${RES}/drawable-xhdpi/banner.png`, banner(640, 360));

// pantalla de carga: reemplaza la de Capacitor con el mismo tamaño
const splashes = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })){ const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'splash.png') splashes.push(p); } };
walk(RES);
for (const p of splashes){
  const { width: w, height: h } = await sharp(p).metadata();
  const s = Math.min(w, h) * 0.42;
  await write(p, svg(w, h, `<rect width="${w}" height="${h}" fill="${INK}"/>${glassesAt(w / 2, h / 2 - s * 0.12, s, STUDIO, 'rgba(255,255,255,0.08)', 4)}
    <text x="${w / 2}" y="${h / 2 + s * 0.42}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="${s * 0.11}" font-weight="300" letter-spacing="${s * 0.01}" fill="${STUDIO}">Probador virtual</text>`));
}
console.log('íconos, banner y', splashes.length, 'pantallas de carga listos');
