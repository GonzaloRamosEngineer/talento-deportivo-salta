// Regenera los íconos rasterizados de la marca desde app/icon.svg:
//   app/favicon.ico     (16 + 32 + 48, PNGs empaquetados en ICO)
//   app/apple-icon.png  (180x180, fondo pleno: iOS redondea solo)
//   public/logo-512.png (para compartir / perfiles / manifest futuro)
// Correr con: node scripts/generar-iconos.mjs

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));

// Variante full-bleed para el ícono de iOS: sin esquinas propias
// (las pone el sistema) y con la curva con un poco más de aire.
const svgFullBleed = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#15803D"/>
  <g transform="translate(32 32) scale(0.82) translate(-32 -32)">
    <path d="M13.5 45.5 29 36.5 50 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="13.5" cy="45.5" r="5" fill="#fff" stroke="#15803D" stroke-width="2.6"/>
    <circle cx="29" cy="36.5" r="5" fill="#fff" stroke="#15803D" stroke-width="2.6"/>
    <circle cx="50" cy="18" r="6.8" fill="#fff" stroke="#15803D" stroke-width="2.6"/>
  </g>
</svg>`;

const png = (input, tam) =>
  sharp(input, { density: 300 }).resize(tam, tam).png().toBuffer();

// ICO moderno: directorio + PNGs embebidos.
function empaquetarIco(pngs) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: ícono
  cabecera.writeUInt16LE(pngs.length, 4);

  const entradas = [];
  let offset = 6 + 16 * pngs.length;
  for (const { tam, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(tam === 256 ? 0 : tam, 0); // ancho
    e.writeUInt8(tam === 256 ? 0 : tam, 1); // alto
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entradas.push(e);
  }
  return Buffer.concat([cabecera, ...entradas, ...pngs.map((p) => p.buf)]);
}

const tamanosIco = [16, 32, 48];
const pngsIco = await Promise.all(
  tamanosIco.map(async (tam) => ({ tam, buf: await png(svg, tam) })),
);

await writeFile(
  new URL("../app/favicon.ico", import.meta.url),
  empaquetarIco(pngsIco),
);
await writeFile(
  new URL("../app/apple-icon.png", import.meta.url),
  await png(Buffer.from(svgFullBleed), 180),
);
await writeFile(
  new URL("../public/logo-512.png", import.meta.url),
  await png(svg, 512),
);

console.log("✓ app/favicon.ico (16/32/48), app/apple-icon.png, public/logo-512.png");
