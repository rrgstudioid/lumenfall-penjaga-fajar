import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(
    new URL('../work/character-tools/package.json', import.meta.url),
  ),
  sharp = require('sharp');
import { createHash } from 'node:crypto';
const b = await readFile(
    process.argv[2] ??
      'C:/Users/GG/Desktop/Lumenfall/anime style chibi boy 3d model.glb',
  ),
  length = b.readUInt32LE(12),
  j = JSON.parse(b.subarray(20, 20 + length)),
  bin = 28 + length;
for (const [index, name] of [
  [0, 'basecolor'],
  [2, 'normal'],
]) {
  const v = j.bufferViews[j.images[index].bufferView],
    image = b.subarray(
      bin + (v.byteOffset ?? 0),
      bin + (v.byteOffset ?? 0) + v.byteLength,
    );
  await sharp(image)
    .resize(2048, 2048)
    .png()
    .toFile('public/assets/characters/male-v2/textures/body-' + name + '.png');
}
await writeFile(
  'work/chibi-source/texture-policy.json',
  JSON.stringify(
    {
      source: 4096,
      runtime: [1024, 2048],
      rebaked: false,
      description:
        'Directly downsampled original texture atlases; original UVs retained',
    },
    null,
    2,
  ),
);
// Independent reference from the supplied GLB, not from an exported derivative.
const primitive = j.meshes[0].primitives[0];
function accessor(id) {
  const a = j.accessors[id],
    v = j.bufferViews[a.bufferView],
    n = a.type === 'VEC3' ? 3 : 2;
  if (a.componentType !== 5126)
    throw Error('Expected float source positions/UVs');
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: n }, (_, k) =>
      b.readFloatLE(
        bin +
          (v.byteOffset ?? 0) +
          (a.byteOffset ?? 0) +
          i * (v.byteStride ?? n * 4) +
          k * 4,
      ),
    ),
  );
}
const p = accessor(primitive.attributes.POSITION),
  uv = accessor(primitive.attributes.TEXCOORD_0),
  lo = [0, 1, 2].map((a) => Math.min(...p.map((v) => v[a]))),
  hi = [0, 1, 2].map((a) => Math.max(...p.map((v) => v[a]))),
  scale = 2.08 / (hi[1] - lo[1]);
await writeFile(
  'tests/fixtures/chibi-source-reference.json',
  JSON.stringify({
    sourceSHA256: createHash('sha256').update(b).digest('hex'),
    triangles: j.accessors[primitive.indices].count / 3,
    vertices: p.map((v, i) => [
      (v[0] - (lo[0] + hi[0]) / 2) * scale,
      (v[1] - lo[1]) * scale,
      (v[2] - (lo[2] + hi[2]) / 2) * scale,
      ...uv[i],
    ]),
  }),
);
