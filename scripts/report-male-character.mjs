import {
  readFile,
  readdir,
  stat,
  mkdir,
  writeFile,
  copyFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'public/assets/characters/male-v2',
  out = 'output/character-source-chibi';
const manifest = JSON.parse(await readFile(root + '/manifest.json', 'utf8'));
const source = await readFile(
  process.env.MALE_SOURCE ??
    'C:/Users/GG/Desktop/Lumenfall/anime style chibi boy 3d model.glb',
);
async function inventory(path) {
  const all = [];
  for (const e of await readdir(path, { withFileTypes: true })) {
    const p = path + '/' + e.name;
    if (e.isDirectory()) all.push(...(await inventory(p)));
    else all.push({ path: p, bytes: (await stat(p)).size });
  }
  return all;
}
const files = await inventory(root);
const lods = [0, 1, 2, 3].map((lod) => {
  const a = manifest.assets.filter(
    (a) =>
      a.path === `body/body-lod${lod}.glb` ||
      a.path === `hair/hair_01-lod${lod}.glb`,
  );
  return {
    lod,
    triangles: a.reduce((n, a) => n + a.triangles, 0),
    geometryBytes: a.reduce((n, a) => n + a.bytes, 0),
  };
});
const json = async (p) => JSON.parse(await readFile(p, 'utf8'));
const report = {
  date: new Date().toISOString(),
  source: {
    file: 'anime style chibi boy 3d model.glb',
    bytes: source.length,
    sha256: manifest.sourceSHA256,
    unchanged:
      createHash('sha256').update(source).digest('hex') ===
      manifest.sourceSHA256,
    triangles: 4722,
  },
  geometryPolicy: manifest.geometryPolicy,
  optimized: {
    lods,
    bones: 20,
    maxWeights: 4,
    bodyHairDrawCalls: 2,
    textureSizes: [1024, 2048],
    packageBytes: files.reduce((n, f) => n + f.bytes, 0),
    defaultNearGeometryReductionAgainstPrevious29600:
      100 * (1 - lods[0].triangles / 29600),
  },
  verification: {
    assetAndAppearanceTests: 17,
    build: 'passed',
    targetedLint: 'passed',
    creation: await json('work/modular-male/browser/creation.json'),
    customization: await json(
      'output/character-customization/verification.json',
    ),
    skinIsolation: await json('work/modular-male/browser/skin-isolation.json'),
    lifecycle: await json('work/modular-male/browser/lifecycle.json'),
    browser: await json('work/modular-male/browser/smoke.json'),
  },
  knownBaseline: [
    'character-model.test.ts:136 sword equipment fixture: same failure recorded in work/modular-male/baseline-tests.log',
    'Typecheck: character-ui.test.ts:44,113 and rules.test.ts:420',
  ],
  limitations: [
    'The default near mesh retains source positions/UVs. Lower LODs approximate that geometry.',
    'Hidden scalp is reconstructed for optional hairstyles. The supplied GLB has no complete bald head; optional short hair can reveal remaining texture seams near the forehead/ears.',
    'Original 4K atlases are downsampled; skin/hair dyes intentionally change colors.',
    'Rig/weights are authored for the previously static T-pose; extreme joint deformation is not identical to a hand-retopologized animation model.',
    'Chrome browser validation is not a 60-FPS guarantee on office integrated GPUs. Concurrent QA runs are not used as performance timing evidence.',
  ],
  runtimeFiles: files,
};
await mkdir(out, { recursive: true });
await writeFile(out + '/verification.json', JSON.stringify(report, null, 2));
for (const name of [
  'front.png',
  'back.png',
  'side.png',
  'face.png',
  'run.png',
  'creation-customized.png',
  'world-male-v2.png',
])
  await copyFile('work/modular-male/browser/' + name, out + '/' + name);
console.log(
  JSON.stringify(
    {
      report: out + '/verification.json',
      sourceUnchanged: report.source.unchanged,
      optimized: report.optimized,
    },
    null,
    2,
  ),
);
