// Authoring-only dependencies: same isolated toolchain as pack-modular-male-character.
import { NodeIO } from '../work/character-tools/node_modules/@gltf-transform/core/dist/index.js';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from '../work/character-tools/node_modules/@gltf-transform/extensions/dist/index.js';
import {
  dedup,
  prune,
  reorder,
  quantize,
} from '../work/character-tools/node_modules/@gltf-transform/functions/dist/index.js';
import {
  MeshoptEncoder,
  MeshoptDecoder,
} from '../work/character-tools/node_modules/meshoptimizer/index.js';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(
    new URL('../work/character-tools/package.json', import.meta.url),
  ),
  sharp = require('sharp');
const work = resolve('work/owner-male'),
  root = resolve(work, 'assets');
const report = JSON.parse(
  await readFile(resolve(work, 'build-report.json'), 'utf8'),
);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
report.version = 2;
report.assets = [];
await mkdir(resolve(work, 'blender-runtime'), { recursive: true });
for (const folder of ['body', 'hair'])
  for (const name of await readdir(resolve(root, folder))) {
    if (!name.endsWith('.glb')) continue;
    const path = resolve(root, folder, name),
      doc = await io.read(path);
    if (
      !doc
        .getRoot()
        .listExtensionsUsed()
        .some((e) => e.extensionName === 'EXT_meshopt_compression')
    ) {
      await doc.transform(
        dedup(),
        prune({ keepLeaves: true, keepAttributes: true }),
        reorder({
          encoder: MeshoptEncoder,
          target: 'performance',
          cleanup: false,
        }),
        quantize({
          pattern: /^(NORMAL|TEXCOORD|WEIGHTS)/,
          quantizeNormal: 10,
          quantizeTexcoord: 16,
          cleanup: false,
        }),
      );
      doc
        .createExtension(EXTMeshoptCompression)
        .setRequired(true)
        .setEncoderOptions({
          method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
        });
      await writeFile(path, await io.writeBinary(doc));
    }
    let triangles = 0,
      vertices = 0;
    for (const mesh of doc.getRoot().listMeshes())
      for (const p of mesh.listPrimitives()) {
        vertices += p.getAttribute('POSITION').getCount();
        triangles += p.getIndices().getCount() / 3;
      }
    report.assets.push({
      path: `${folder}/${name}`,
      triangles,
      vertices,
      bytes: (await stat(path)).size,
      lod: Number(name.match(/lod(\d)/)[1]),
    });
    // Blender's importer does not decode EXT_meshopt_compression. This review copy
    // has identical exported attributes/weights, with only transport compression removed.
    doc
      .getRoot()
      .listExtensionsUsed()
      .find((e) => e.extensionName === 'EXT_meshopt_compression')
      ?.dispose();
    await writeFile(
      resolve(work, 'blender-runtime', name),
      await io.writeBinary(doc),
    );
  }
async function embedded(path, index) {
  const b = await readFile(path),
    length = b.readUInt32LE(12),
    j = JSON.parse(b.subarray(20, 20 + length)),
    v = j.bufferViews[j.images[index].bufferView];
  return b.subarray(
    28 + length + (v.byteOffset ?? 0),
    28 + length + (v.byteOffset ?? 0) + v.byteLength,
  );
}
const body = report.sources[0].path,
  hair = report.sources[1].path;
const base = await embedded(body, 0),
  normal = await embedded(body, 2),
  hairBase = await embedded(hair, 0);
await sharp(base).png().toFile(resolve(work, 'body-basecolor-master.png'));
for (const size of [1024, 2048]) {
  await sharp(base)
    .resize(size, size)
    .webp({ quality: 94 })
    .toFile(resolve(root, `textures/body-basecolor-${size}.webp`));
  await sharp(normal)
    .resize(size, size)
    .png()
    .toFile(resolve(root, `textures/body-normal-${size}.png`));
}
// Neutral albedo keeps the owner's strand shading without tinting every dye brown.
await sharp(hairBase)
  .resize(2048, 2048)
  .greyscale()
  .webp({ quality: 94 })
  .toFile(resolve(root, 'textures/hair-detail.webp'));
const tex = await sharp(base).resize(1024, 1024).removeAlpha().raw().toBuffer();
const mask = await sharp(resolve(root, 'textures/body-skin-mask.png'))
  .removeAlpha()
  .raw()
  .toBuffer();
const samples = [[], [], []];
for (let i = 0; i < 1024 * 1024; i++)
  if (mask[i * 3] > 230)
    for (let c = 0; c < 3; c++) samples[c].push(tex[i * 3 + c] / 255);
report.skinReference = samples.map((a) => {
  a.sort((a, b) => a - b);
  const x = a[Math.floor(a.length * 0.5)];
  return x < 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
});
if (!process.argv.includes('--skip-ktx')) {
  const bin =
    process.env.TOKTX_PATH ?? resolve('work/character-tools/ktx/bin/toktx.exe');
  const encode = (args) => {
    const r = spawnSync(bin, args, { stdio: 'inherit', windowsHide: true });
    if (r.status !== 0) throw Error('KTX encoding failed');
  };
  for (const size of [1024, 2048]) {
    encode([
      '--encode',
      'etc1s',
      '--qlevel',
      '220',
      '--genmipmap',
      '--assign_oetf',
      'srgb',
      '--resize',
      `${size}x${size}`,
      resolve(root, `textures/body-basecolor-${size}.ktx2`),
      resolve(work, 'body-basecolor-master.png'),
    ]);
    encode([
      '--encode',
      'uastc',
      '--uastc_quality',
      '2',
      '--zcmp',
      '18',
      '--genmipmap',
      '--assign_oetf',
      'linear',
      resolve(root, `textures/body-normal-${size}.ktx2`),
      resolve(root, `textures/body-normal-${size}.png`),
    ]);
  }
  encode([
    '--encode',
    'uastc',
    '--uastc_quality',
    '2',
    '--zcmp',
    '18',
    '--genmipmap',
    '--assign_oetf',
    'linear',
    resolve(root, 'textures/body-skin-mask.ktx2'),
    resolve(root, 'textures/body-skin-mask.png'),
  ]);
}
report.geometryBytes = report.assets.reduce((n, a) => n + a.bytes, 0);
report.sources = report.sources.map(({ path, sha256 }) => ({
  file: path.split(/[\\/]/).pop(),
  sha256,
}));
await writeFile(
  resolve(root, 'manifest.json'),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    assets: report.assets.length,
    geometryBytes: report.geometryBytes,
    skinReference: report.skinReference,
  }),
);
