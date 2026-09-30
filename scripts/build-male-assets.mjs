/** Reproducible, isolated authoring pipeline. Never opens the user's Blender session.
 * Prerequisites (authoring only, not application dependencies):
 *   Blender 4.5.3 portable in work/character-tools/blender-4.5.3-windows-x64/
 *   KTX-Software 4.4.2 in work/character-tools/ktx/ (or set TOKTX_PATH)
 *   npm install --prefix work/character-tools --no-save @gltf-transform/core@4.5.1
 *     @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1
 *     meshoptimizer@1.3.0 sharp@0.35.5 playwright@1.63.0
 * Existing optional hairstyle masters are required in work/chibi-source/legacy-hair/.
 * Run: node scripts/build-male-assets.mjs "C:/path/to/anime style chibi boy 3d model.glb"
 * BLENDER_PATH overrides the portable path. This rewrites only the generated
 * male-v2 runtime package and character staging, never the source GLB.
 */
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const source = resolve(
  process.argv[2] ??
    'C:/Users/GG/Desktop/Lumenfall/anime style chibi boy 3d model.glb',
);
const blender =
  process.env.BLENDER_PATH ??
  resolve('work/character-tools/blender-4.5.3-windows-x64/blender.exe');
const hash = async () =>
  createHash('sha256')
    .update(await readFile(source))
    .digest('hex');
const before = await hash();
await mkdir('work/chibi-source', { recursive: true });
for (let style = 2; style <= 10; style++)
  for (let lod = 0; lod < 4; lod++) {
    const path = `work/chibi-source/legacy-hair/hair_${String(style).padStart(2, '0')}-lod${lod}.glb`;
    await readFile(path).catch(() => {
      throw Error(
        `Missing authoring input: ${path}. Restore the existing optional hairstyle masters before rebuilding.`,
      );
    });
  }
async function run(binary, args, label) {
  console.log(label);
  let output = '';
  const child = spawn(binary, args, { windowsHide: true });
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  await writeFile(`work/chibi-source/${label}.log`, output);
  if (code !== 0)
    throw Error(`${label} failed; see work/chibi-source/${label}.log`);
}
for (const name of [
  'prepare-source-chibi-character',
  'export-source-chibi-character',
])
  await run(
    blender,
    [
      '--background',
      '--factory-startup',
      '--python-exit-code',
      '1',
      '--python',
      `scripts/${name}.py`,
      '--',
      source,
    ],
    name,
  );
for (const name of [
  'prepare-source-chibi-textures',
  'pack-modular-male-character',
  'compress-male-textures',
  'retarget-modular-male-motion',
])
  await run(
    process.execPath,
    ['--experimental-transform-types', `scripts/${name}.mjs`, source],
    name,
  );
await run(
  process.execPath,
  [
    '--experimental-transform-types',
    '--test',
    'lib/game/modular-male-character.test.ts',
  ],
  'asset-tests',
);
await run(
  process.execPath,
  ['scripts/test-modular-character-browser.mjs'],
  'asset-browser',
);
if ((await hash()) !== before) throw Error('Source hash changed');
console.log('Source unchanged:', before);
