// Authoring-only dependencies live in work/character-tools; no runtime dependency added.
import { NodeIO } from '../work/character-tools/node_modules/@gltf-transform/core/dist/index.js';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '../work/character-tools/node_modules/@gltf-transform/extensions/dist/index.js';
import {
  reorder,
  quantize,
  prune,
  dedup,
} from '../work/character-tools/node_modules/@gltf-transform/functions/dist/index.js';
import {
  MeshoptEncoder,
  MeshoptDecoder,
} from '../work/character-tools/node_modules/meshoptimizer/index.js';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const sharp = require('sharp');
import {
  readdir,
  readFile,
  writeFile,
  stat,
  mkdir,
  rename,
} from 'node:fs/promises';
import { resolve } from 'node:path';
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const root = resolve('public/assets/characters/male-v2');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
const build = JSON.parse(
  await readFile('work/chibi-source/build-report.json', 'utf8'),
);
const report = {
  version: 2,
  sourceSHA256: build.sourceSHA256,
  sourceTriangles: build.sourceTriangles,
  geometryPolicy: build.geometryPolicy,
  assets: [],
};
await mkdir('work/modular-male/uncompressed', { recursive: true });
for (const folder of ['body', 'hair'])
  for (const name of await readdir(resolve(root, folder))) {
    if (!name.endsWith('.glb')) continue;
    const path = resolve(root, folder, name),
      bytes = await readFile(path);
    const original = resolve('work/modular-male/uncompressed', name);
    const header = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    if (!header.extensionsUsed?.includes('EXT_meshopt_compression'))
      await writeFile(original, bytes);
    const doc = await io.read(original);
    // Hair is one uniformly dyed sculpt; remeshed source UV/color attributes are
    // neither meaningful nor sampled by MAT_Hair. Do not ship that stale data.
    if (folder === 'hair')
      for (const mesh of doc.getRoot().listMeshes())
        for (const p of mesh.listPrimitives()) {
          for (const attribute of name.startsWith('hair_01-')
            ? ['COLOR_0', 'TANGENT']
            : ['TEXCOORD_0', 'COLOR_0', 'TANGENT'])
            p.setAttribute(attribute, null);
        }
    for (const mat of doc.getRoot().listMaterials()) {
      mat
        .setBaseColorTexture(null)
        .setNormalTexture(null)
        .setMetallicRoughnessTexture(null)
        .setOcclusionTexture(null)
        .setEmissiveTexture(null);
      mat.setDoubleSided(false);
    }
    for (const texture of doc.getRoot().listTextures()) texture.dispose();
    // Keep UVs and sockets used by runtime, and keep identical bind matrices across
    // separately packaged body/hair. Position quantization per mesh would change them.
    await doc.transform(
      dedup(),
      prune({ keepLeaves: true, keepAttributes: true }),
      reorder({
        encoder: MeshoptEncoder,
        target: 'performance',
        cleanup: false,
      }),
      quantize({
        pattern: /^(NORMAL|TEXCOORD|WEIGHTS|COLOR)/,
        quantizeNormal: 10,
        quantizeTexcoord: 14,
        cleanup: false,
      }),
      prune({ keepLeaves: true, keepAttributes: true }),
    );
    doc
      .createExtension(EXTMeshoptCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
      });
    // Publish each completed derivative atomically. Vite/Windows may briefly hold
    // the old file while it is being served; retry that bounded sharing conflict.
    const temp = path + '.tmp';
    await writeFile(temp, await io.writeBinary(doc));
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temp, path);
        break;
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    let triangles = 0,
      vertices = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        vertices += p.getAttribute('POSITION').getCount();
        triangles +=
          (p.getIndices()?.getCount() ??
            p.getAttribute('POSITION').getCount()) / 3;
      }
    const lod = Number(name.match(/lod(\d)/)[1]);
    const limit =
      folder === 'body'
        ? [7500, 3700, 1900, 900][lod]
        : [3100, 1900, 1050, 450][lod];
    if (triangles > limit) throw Error(name + ' exceeds triangle budget');
    report.assets.push({
      path: `${folder}/${name}`,
      triangles,
      vertices,
      bytes: (await stat(path)).size,
      lod,
    });
  }
const bake = await stat(resolve(root, 'textures/body-basecolor.png'))
  .then(() => resolve(root, 'textures/body-basecolor.png'))
  .catch(() => resolve('work/modular-male/body-basecolor-master.png'));
for (const size of [1024, 2048])
  await sharp(bake)
    .resize(size, size)
    .webp({ quality: 92 })
    .toFile(resolve(root, `textures/body-basecolor-${size}.webp`));
const normalBake = await stat(resolve(root, 'textures/body-normal.png'))
  .then(() => resolve(root, 'textures/body-normal.png'))
  .catch(() => resolve('work/modular-male/body-normal-master.png'));
for (const size of [1024, 2048])
  await sharp(normalBake)
    .resize(size, size)
    .png()
    .toFile(resolve(root, `textures/body-normal-${size}.png`));
// Keep the uncompressed bake in staging, not in the public runtime package.
if (bake !== resolve('work/modular-male/body-basecolor-master.png'))
  await rename(bake, resolve('work/modular-male/body-basecolor-master.png'));
if (normalBake !== resolve('work/modular-male/body-normal-master.png'))
  await rename(normalBake, resolve('work/modular-male/body-normal-master.png'));
report.geometryBytes = report.assets.reduce((n, a) => n + a.bytes, 0);
await writeFile(
  resolve(root, 'manifest.json'),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    {
      assets: report.assets.length,
      geometryBytes: report.geometryBytes,
      body: report.assets.filter((a) => a.path.startsWith('body')),
    },
    null,
    2,
  ),
);
