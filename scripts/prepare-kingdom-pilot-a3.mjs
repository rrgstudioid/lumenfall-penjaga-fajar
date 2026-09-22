import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const runtime = createRequire(
  'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json',
);
const JSZip = runtime('jszip'),
  sharp = runtime('sharp');
const root = path.resolve('dev-assets/kingdom-city-pilot-a3');
const read = (p) =>
  JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const catalog = read('data/assets/master-model-catalog.json').records;
const materials = read('data/assets/master-material-catalog.json').records;
const ids = [
  'wall_plaster_straight',
  'wall_plaster_door_round',
  'doorframe_round_brick',
  'roof_tower_roundtiles',
  'floor_brick',
  'corner_exterior_brick',
  'stairs_exterior_platform',
  'stairs_exterior_nofirststep',
  'barrel',
  'crate_wooden',
  'bench',
  'lantern_wall',
  'banner_1',
].map((x) => 'env_model_' + x);
const nature = ['env_package_tree_small_02_2k', 'env_package_boulder_01_2k'];
const remap = {
  stone_architecture: 'mat_castle_brick_01_2k',
  wood: 'mat_medieval_wood_2k',
  plaster_brick: 'mat_plastered_wall_02_2k',
  roof_tile: 'mat_clay_roof_tiles_2k',
  metal: 'mat_metal_plate_02_2k',
  fabric_banner: 'mat_fabric_pattern_05_2k',
};
const archives = new Map(),
  hashes = [],
  textureRecords = [],
  licenseRecords = [];
function write(p, data) {
  const target = path.resolve(root, p);
  if (!target.startsWith(root + path.sep)) throw Error('Unsafe staged path');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}
async function archive(p) {
  if (archives.has(p)) return archives.get(p);
  const data = fs.readFileSync(p);
  hashes.push({
    path: p,
    bytes: data.length,
    sha256Before: crypto.createHash('sha256').update(data).digest('hex'),
  });
  const zip = await JSZip.loadAsync(data);
  archives.set(p, zip);
  for (const [name, e] of Object.entries(zip.files))
    if (/license|readme|credits/i.test(name) && /\.(txt|md)$/i.test(name)) {
      const text = await e.async('string');
      licenseRecords.push({ archive: p, entry: name, text });
      write('provenance/' + path.basename(p) + '/' + path.basename(name), text);
    }
  return zip;
}
async function image(zip, entry, out, limit = 1024) {
  const data = await zip.file(entry).async('nodebuffer'),
    meta = await sharp(data).metadata();
  const target = path.join(root, out);
  if (!fs.existsSync(target))
    write(
      out,
      await sharp(data)
        .resize({
          width: limit,
          height: limit,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer(),
    );
  if (!textureRecords.some((x) => x.output === out))
    textureRecords.push({
      sourceEntry: entry,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      output: out,
      maxDimension: limit,
    });
}
const assets = [];
for (const id of ids) {
  const r = catalog.find((x) => x.assetId === id);
  if (!r) throw Error(id);
  const zip = await archive(r.sourceArchive),
    doc = JSON.parse(await zip.file(r.archiveEntry).async('string'));
  const pack = r.sourceArchive.includes('Medieval') ? 'medieval' : 'props';
  const resolve = (u) =>
    path.posix.normalize(
      path.posix.join(
        path.posix.dirname(r.archiveEntry),
        decodeURIComponent(u),
      ),
    );
  for (const b of doc.buffers ?? []) {
    if (b.uri?.startsWith('data:')) continue;
    const e = resolve(b.uri);
    const out = 'models/' + id + '/' + path.posix.basename(e);
    write(out, await zip.file(e).async('nodebuffer'));
    b.uri = path.posix.basename(e);
  }
  for (const im of doc.images ?? []) {
    if (!im.uri || im.uri.startsWith('data:')) continue;
    const e = resolve(im.uri),
      out =
        'textures/' +
        pack +
        '/' +
        path.posix.basename(e).replace(/\.[^.]+$/, '.png');
    await image(zip, e, out);
    im.uri = '../../' + out;
  }
  write('models/' + id + '/model.gltf', JSON.stringify(doc));
  assets.push({
    id,
    sourceArchive: r.sourceArchive,
    sourceEntry: r.archiveEntry,
    pack,
    scale: 1.5,
    url: '/dev-assets/kingdom-city-pilot-a3/models/' + id + '/model.gltf',
    licenseStatus: 'LICENSE_OK',
    licenseEvidence: licenseRecords
      .filter((x) => x.archive === r.sourceArchive)
      .map((x) => x.entry),
    status: 'STAGED_PENDING_TEST',
  });
}
for (const id of nature) {
  const r = catalog.find((x) => x.assetId === id),
    zip = await archive(r.sourceArchive);
  for (const [name, e] of Object.entries(zip.files)) {
    if (e.dir) continue;
    const out = 'source-copy/' + id + '/' + name;
    if (/\.blend$|textures\//i.test(name)) {
      const bytes = await e.async('nodebuffer');
      write(out, bytes);
      if (/\.png$/i.test(name)) {
        const meta = await sharp(bytes).metadata();
        if (meta.channels < 3)
          write(
            'decoded-textures/' + id + '/' + path.basename(name),
            await sharp(bytes).toColourspace('srgb').png().toBuffer(),
          );
      }
    }
  }
  assets.push({
    id,
    sourceArchive: r.sourceArchive,
    sourceEntry: r.archiveEntry,
    pack: id,
    scale: 1,
    url: '/dev-assets/kingdom-city-pilot-a3/models/' + id + '/model.glb',
    licenseStatus: 'LICENSE_UNKNOWN',
    status: 'CONVERSION_PENDING',
  });
}
const materialExamples = [];
for (const [family, id] of Object.entries(remap)) {
  const r = materials.find((x) => x.assetId === id),
    zip = await archive(r.sourceArchive);
  const files = Object.keys(zip.files);
  const maps = {};
  for (const [role, pattern] of [
    ['color', /_(diff|albedo|color|col)_.*\.(jpg|png)$/i],
    ['normal', /_nor_gl_.*\.(jpg|png|exr)$/i],
    ['roughness', /_rough_.*\.(jpg|png|exr)$/i],
    ['metalness', /_metal_.*\.(jpg|png|exr)$/i],
  ]) {
    const entry = files.find((x) => pattern.test(x));
    if (entry) {
      const out = 'materials/' + family + '/' + role + '.png';
      if (entry.endsWith('.exr'))
        write(
          'material-source/' + family + '/' + role + '.exr',
          await zip.file(entry).async('nodebuffer'),
        );
      else await image(zip, entry, out);
      maps[role] = '/dev-assets/kingdom-city-pilot-a3/' + out;
    }
  }
  materialExamples.push({
    family,
    id,
    sourceArchive: r.sourceArchive,
    maps,
    licenseStatus: 'LICENSE_UNKNOWN',
    mapping: 'CONTROLLED_DEVELOPMENT_EXAMPLE',
  });
}
for (const h of hashes) {
  h.sha256After = crypto
    .createHash('sha256')
    .update(fs.readFileSync(h.path))
    .digest('hex');
  h.unchanged = h.sha256Before === h.sha256After;
}
const result = {
  schemaVersion: 1,
  devOnly: true,
  sourceRoot: 'D:/Model_Asset_Lumenfall',
  character: {
    source: 'lib/game/character-model.ts',
    asset: '/assets/characters/astra-hunyuan/astra-hunyuan-rigged.glb',
    runtimeHeight: 2.4,
  },
  assets,
  materialExamples,
  textureRecords,
  licenseRecords,
  sourceHashes: hashes,
};
write('manifest.json', JSON.stringify(result, null, 2));
console.log(
  JSON.stringify(
    {
      assets: assets.length,
      textures: textureRecords.length,
      allSourcesUnchanged: hashes.every((x) => x.unchanged),
      materials: materialExamples,
    },
    null,
    2,
  ),
);
