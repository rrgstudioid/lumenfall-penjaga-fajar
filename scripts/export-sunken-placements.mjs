// Export the authoritative runtime placement, without duplicating its generation algorithm.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__sunkenQA?.game?.sunken);
  const data = await page.evaluate(() => {
    const { game: g, three: T, sunkenLayout } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    const matrix = new T.Matrix4(),
      color = new T.Color(),
      groups = [];
    g.sunken.root.traverse((mesh) => {
      if (!(mesh instanceof T.InstancedMesh) || !mesh.userData.total) return;
      if (mesh.userData.partIndex > 0) return;
      const [sector, prototype, kind] = mesh.name.split(':'),
        transforms = [],
        colors = [];
      for (let i = 0; i < mesh.userData.total; i++) {
        mesh.getMatrixAt(i, matrix);
        mesh.getColorAt(i, color);
        transforms.push(matrix.elements.map((n) => Number(n.toFixed(5))));
        colors.push(color.toArray().map((n) => Number(n.toFixed(5))));
      }
      groups.push({ sector, prototype, kind, transforms, colors });
    });
    return {
      schemaVersion: 2,
      mapId: g.activeLocationId,
      source: 'lib/game/sunken-ruins-map.ts + sunken-ruins-layout.ts',
      matrixConvention:
        'Three.js column-major, world coordinates, Y up; colors in linear RGB',
      groups,
      metrics: g.sunken.metrics(),
      colliders: sunkenLayout.SUNKEN_COLLIDERS,
    };
  });
  assert.equal(
    data.groups.reduce((n, g) => n + g.transforms.length, 0),
    data.metrics.instances,
  );
  const directory = 'dev-assets/sunken-ruins-underwater-v1';
  data.kitSHA256 = createHash('sha256')
    .update(await readFile(`${directory}/kit.glb`))
    .digest('hex');
  data.assetHashes = {};
  for (const asset of [
    'realism/marine-kit.glb',
    'revision3/ruins-reef-kit.glb',
    'revision3/tripo-kit.glb',
    'revision3/limestone-albedo.png',
  ])
    data.assetHashes[asset] = createHash('sha256')
      .update(await readFile(`${directory}/${asset}`))
      .digest('hex');
  const serialized = JSON.stringify(data);
  await writeFile(`${directory}/revision3/placements.json`, serialized);
  console.log(
    JSON.stringify({
      instances: data.metrics.instances,
      groups: data.groups.length,
      bytes: Buffer.byteLength(serialized),
      kitSHA256: data.kitSHA256,
    }),
  );
} finally {
  await browser.close();
}
