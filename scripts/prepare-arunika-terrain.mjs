// Reproducible numeric PBR conversion. Reads the supplied archive; leaves it untouched.
// EXRLoader returns bottom-up data. Encode top-down rows for normal image loaders.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { unzipSync } from '../node_modules/three/examples/jsm/libs/fflate.module.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { DataUtils } from 'three';
import { buildArunikaTerrainMask } from '../lib/game/arunika-terrain-mask.ts';
import { VERDANT_TERRAIN } from '../lib/game/field-terrain.ts';
const { default: sharp } = await import(pathToFileURL(process.env.SHARP_MODULE).href);
const maskOnly = process.argv.includes('--mask-only');
const archive = maskOnly ? {} : unzipSync(await readFile(process.argv[2]), { filter: f => /_(nor_gl|rough)_4k\.exr$/.test(f.name) });
const root = 'public/assets/materials/terrain/arunika/rocky-terrain-02/';
for (const kind of maskOnly ? [] : ['nor_gl', 'rough']) {
  const filename = `rocky_terrain_02_${kind}`, bytes = archive[`textures/${filename}_4k.exr`];
  const exr = new EXRLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const size = 2048, channels = kind === 'nor_gl' ? 3 : 1;
  const output = Buffer.alloc(size * size * channels);
  const value = index => exr.data instanceof Uint16Array ? DataUtils.fromHalfFloat(exr.data[index]) : exr.data[index];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const rgb = [0, 0, 0];
    // Average four source pixels, then renormalize the tangent-space normal.
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const index = ((exr.height - 1 - (y*2+dy)) * exr.width + x*2+dx) * 4;
      for (let c = 0; c < channels; c++) rgb[c] += value(index+c) * .25;
    }
    if (channels === 3) {
      const n = rgb.map(v => v*2-1), length = Math.hypot(...n) || 1;
      for (let c = 0; c < 3; c++) rgb[c] = n[c] / length * .5 + .5;
    }
    for (let c = 0; c < channels; c++) output[(y*size+x)*channels+c] = Math.round(Math.max(0, Math.min(1, rgb[c])) * 255);
  }
  const encoded = await sharp(output, { raw: { width: size, height: size, channels } }).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeFile(`${root}${filename}_2k_v2.webp`, encoded);
  console.log(`${kind}: ${size}x${size}, ${encoded.length} bytes, top-down, linear data, lossless`);
}
const mask = buildArunikaTerrainMask(VERDANT_TERRAIN);
// CPU generation is an authoring step, never a 700ms stall on the game's main thread.
const maskImage = await sharp(mask.data, { raw: { width: mask.size, height: mask.size, channels: 4 } })
  .flip().webp({ lossless: true, effort: 6 }).toBuffer();
await writeFile(`${root}arunika_surface_mask_v2.webp`, maskImage);
console.log(JSON.stringify({ maskBytes: maskImage.length, bounds: mask.bounds, coverage: mask.coverage }));
