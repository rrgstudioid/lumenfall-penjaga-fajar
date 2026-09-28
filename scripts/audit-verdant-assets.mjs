import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL(
  '../public/assets/maps/verdant-plains-v2/',
  import.meta.url,
);
const models = [];
for (const file of (await readdir(root)).filter((f) => f.endsWith('.glb'))) {
  const data = await readFile(new URL(file, root)),
    json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  const triangles = json.meshes.reduce(
    (sum, m) =>
      sum +
      m.primitives.reduce(
        (n, p) =>
          n + json.accessors[p.indices ?? p.attributes.POSITION].count / 3,
        0,
      ),
    0,
  );
  models.push({ file, triangles, bytes: data.byteLength });
}
await writeFile(
  new URL('model-report.json', root),
  JSON.stringify(models, null, 2) + '\n',
);
const assets = [];
for (const file of (await readdir(root)).filter(
  (f) => f !== 'asset-budget.json',
)) {
  const bytes = await readFile(new URL(file, root));
  assets.push({
    file,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const report = {
  mapId: 'verdant-plains-v2',
  limitBytes: 20 * 1024 * 1024,
  bytesExcludingThisReport: assets.reduce((n, a) => n + a.bytes, 0),
  assets,
};
await writeFile(
  new URL('asset-budget.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
const bytes =
  report.bytesExcludingThisReport +
  (await stat(new URL('asset-budget.json', root))).size;
if (bytes > report.limitBytes)
  throw Error('Verdant Plains asset budget exceeded');
console.log(
  JSON.stringify(
    {
      bytes,
      MiB: bytes / 1024 / 1024,
      files: assets.length + 1,
      limitMiB: 20,
      models,
    },
    null,
    2,
  ),
);
