// Authoring dependencies already used by the Male V2 pipeline; sources are read-only.
import { NodeIO } from '../work/character-tools/node_modules/@gltf-transform/core/dist/index.js';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '../work/character-tools/node_modules/@gltf-transform/extensions/dist/index.js';
import {
  dedup,
  prune,
  reorder,
} from '../work/character-tools/node_modules/@gltf-transform/functions/dist/index.js';
import {
  MeshoptEncoder,
  MeshoptDecoder,
} from '../work/character-tools/node_modules/meshoptimizer/index.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const sharp = require('sharp');
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
const work = 'work/dragon-veil',
  out = 'public/assets/equipment/dragon-veil';
await mkdir(work, { recursive: true });
if (process.argv.includes('--prepare')) {
  // Decode the actual runtime body, not an older Blender staging file.
  for (let lod = 0; lod < 4; lod++) {
    const doc = await io.read(
      `public/assets/characters/male-v2/body/body-lod${lod}.glb`,
    );
    doc
      .getRoot()
      .listExtensionsUsed()
      .find((e) => e.extensionName === 'EXT_meshopt_compression')
      ?.dispose();
    await io.write(`${work}/body-lod${lod}.glb`, doc);
  }
} else {
  await mkdir(out, { recursive: true });
  const report = JSON.parse(
    await readFile(`${work}/build-report.json`, 'utf8'),
  );
  report.assets = [];
  for (const piece of ['head', 'armor', 'legs', 'boots']) {
    for (let lod = 0; lod < 4; lod++) {
      const doc = await io.read(`${work}/${piece}-lod${lod}.glb`);
      for (const tex of doc.getRoot().listTextures()) {
        tex.setImage(
          await sharp(tex.getImage())
            .resize(lod ? 1024 : 2048, lod ? 1024 : 2048, { fit: 'inside' })
            .jpeg({ quality: 92 })
            .toBuffer(),
        );
        tex.setMimeType('image/jpeg');
      }
      await doc.transform(
        dedup(),
        prune({ keepLeaves: true, keepAttributes: true }),
        reorder({
          encoder: MeshoptEncoder,
          target: 'performance',
          cleanup: false,
        }),
      );
      doc
        .createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({
          method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
        });
      const bytes = await io.writeBinary(doc),
        path = `${piece}-lod${lod}.glb`;
      await writeFile(`${out}/${path}`, bytes);
      const triangles = doc
        .getRoot()
        .listMeshes()
        .reduce(
          (n, m) =>
            n +
            m
              .listPrimitives()
              .reduce(
                (s, p) =>
                  s +
                  (p.getIndices()?.getCount() ??
                    p.getAttribute('POSITION').getCount()) /
                    3,
                0,
              ),
          0,
        );
      report.assets.push({ path, lod, triangles, bytes: bytes.length });
    }
    await sharp(`${work}/icon-${piece}.png`)
      .resize(256, 256)
      .webp({ quality: 94 })
      .toFile(`public/assets/icons/items/dragon-veil-${piece}.webp`);
  }
  await writeFile(`${out}/manifest.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      assets: report.assets.length,
      bytes: report.assets.reduce((n, a) => n + a.bytes, 0),
    }),
  );
}
