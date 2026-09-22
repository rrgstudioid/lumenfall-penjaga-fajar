// Only the assets actually used by getUnrealNormandyDecorLayout are published.
// Original Unreal export library remains local and untouched.
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
export const meshes = ['SM_GrassTall_00A', 'SM_LS_Rock_01A', 'SM_PlantTypeA_00A', 'SM_PlantTypeB_00A', 'SM_PlantTypeC_00A', 'SM_HW_Plank_00A', 'SM_Props_Lantern_02A'];
export const textures = ['T_LS_GrassTall_00A_BaseColor', 'T_StoneSurface_00A_BaseColor', 'T_PlantTypeA_BaseColor', 'T_PlantTypeB_BaseColor', 'T_PlantTypeC_BaseColor', 'T_WoodSurface_00A_BaseColor', 'T_Props_Lantern_00A_BaseColor'];
export const base = 'public/assets/maps/unreal-normandy/';
export const runtimeFiles = [...meshes.map(name => `${base}meshes/${name}.glb`), ...textures.map(name => `${base}textures/${name}.webp`)];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--check')) {
    const modules = process.env.CODEX_NODE_MODULES || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
    const sharp = createRequire(pathToFileURL(`${modules}/runtime.cjs`))('sharp');
    for (const name of textures) {
      // Lossless format conversion only: no resize, recoloring or material change.
      await sharp(`${base}textures/${name}.png`).webp({ lossless: true, effort: 6 }).toFile(`${base}textures/${name}.webp`);
      if ((await stat(`${base}textures/${name}.webp`)).size >= 25 * 1024 * 1024) {
        // The rock's lossless output exceeds the host's per-file ceiling.
        // Near-lossless retains full resolution; the source PNG stays untouched.
        await sharp(`${base}textures/${name}.png`).webp({ nearLossless: true, quality: 90, effort: 6 }).toFile(`${base}textures/${name}.webp`);
      }
    }
  }
  let total = 0;
  for (const file of runtimeFiles) {
    const { size } = await stat(file);
    if (size >= 25 * 1024 * 1024) throw new Error(`Asset exceeds hosting file limit: ${file}`);
    if (process.argv.includes('--check')) execFileSync('git', ['ls-files', '--error-unmatch', file], { stdio: 'pipe' });
    if (file.endsWith('.glb')) {
      const bytes = await readFile(file);
      const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
      if ([...(json.images || []), ...(json.buffers || [])].some(part => part.uri && !part.uri.startsWith('data:'))) throw new Error(`External GLB dependency: ${file}`);
    }
    total += size;
    console.log(`${file}: ${size} bytes`);
  }
  console.log(`Verified ${runtimeFiles.length} runtime assets, ${total} bytes${process.argv.includes('--check') ? ', all tracked for publication' : ''}.`);
}
