// Install only runtime derivatives. Source and Blender staging stay untouched.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const baseline = JSON.parse(
  await readFile('tests/fixtures/oak/legacy-layout.json', 'utf8'),
);
const placements = JSON.parse(
  await readFile('output/oak/placements.json', 'utf8'),
);
await writeFile(
  'lib/game/verdant-plains-oaks.ts',
  `// Authored offline with seed 71943100. Do not regenerate at runtime.\nexport type OakPlacement = { id: string; zone: string; group: string; landmark: boolean; x: number; z: number; scale: number; yaw: number; variant: number; tint: number; hue: number; windPhase: number; radius: number; canopyRadius: number };\nexport const PLAINS_OAKS: readonly OakPlacement[] = ${JSON.stringify(placements, null, 2)};\n`,
);
await writeFile(
  'lib/game/verdant-plains-spawn-layout.ts',
  `// Frozen before replacing the legacy vegetation. Species and IDs are unchanged.\nexport const PLAINS_SPAWN_LAYOUT = ${JSON.stringify(baseline.spawns, null, 2)} as const;\n`,
);
if (process.argv.includes('--layout-only')) process.exit(0);
const folder = 'public/assets/maps/verdant-plains-v2/oak';
await mkdir(folder, { recursive: true });
const manifest = JSON.parse(
  await readFile('output/oak/assets/manifest.json', 'utf8'),
);
for (const file of ['oak.gltf', 'oak.bin', 'manifest.json', ...manifest.maps])
  await copyFile('output/oak/assets/' + file, folder + '/' + file);
execFileSync('powershell', [
  '-NoProfile',
  '-File',
  'scripts/pack-oak-textures.ps1',
]);
const gltf = JSON.parse(await readFile(folder + '/oak.gltf', 'utf8'));
for (const im of gltf.images)
  if (im.uri === 'bark-normal.png') {
    im.uri = 'bark-normal.jpg';
    im.mimeType = 'image/jpeg';
  }
await writeFile(folder + '/oak.gltf', JSON.stringify(gltf));
manifest.maps = manifest.maps.map((n) =>
  n === 'bark-normal.png' ? 'bark-normal.jpg' : n,
);
await writeFile(folder + '/manifest.json', JSON.stringify(manifest, null, 2));
