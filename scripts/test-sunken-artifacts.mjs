import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { SUNKEN_ARTIFACTS } from '../lib/game/sunken-ruins-artifact-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision12';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  requests = [],
  shots = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('request', (r) => {
  if (r.url().endsWith('.glb')) requests.push(r.url());
});
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  await page.waitForTimeout(400); // Let the normal animator finish its underwater blend.
  await page.evaluate(() => cancelAnimationFrame(window.__sunkenQA.game.frame));
  const landmarks = SUNKEN_ARTIFACTS.filter((a) =>
    ['neptune-statue', 'sunken-shipwreck'].includes(a.name),
  );
  assert.equal(
    landmarks.filter((a) => a.name === 'sunken-shipwreck').length,
    3,
  );
  assert.equal(landmarks.filter((a) => a.name === 'neptune-statue').length, 1);
  for (const a of landmarks)
    for (const quality of a.name === 'neptune-statue'
      ? ['office', 'light', 'balanced', 'high']
      : ['high'])
      for (const view of a.name === 'neptune-statue' && quality === 'high'
        ? [0, 1, 2, 3]
        : [0]) {
        const result = await page.evaluate(
          ({ a, quality, view }) => {
            const { game: g, three: T } = window.__sunkenQA;
            g.setGraphicsQuality(quality, false);
            Object.assign(
              g.hero,
              g.sunken.navigation.restore({ x: a.x + 9, z: a.z + 9 }),
            );
            g.placeActor();
            g.actor.visible = true;
            const y = g.groundHeight(a.x, a.z),
              ship = a.name === 'sunken-shipwreck';
            const camera = new T.PerspectiveCamera(48, 1440 / 900, 0.1, 2200);
            camera.position.set(
              a.x + (ship ? 40 : 17),
              y + (ship ? 29 : 12),
              a.z + (ship ? 47 : 29),
            );
            if (view) {
              const angle = Math.atan2(17, 29) + (view * Math.PI) / 2;
              camera.position.set(
                a.x + Math.sin(angle) * 34,
                y + 12,
                a.z + Math.cos(angle) * 34,
              );
            }
            camera.lookAt(a.x, y + (ship ? 6 : 8), a.z);
            g.worldLightRig.traverse((o) => {
              if (o instanceof T.DirectionalLight) {
                o.position.set(a.x - 25, y + 60, a.z + 20);
                o.target.position.set(a.x, y, a.z);
                o.target.updateMatrixWorld();
              }
            });
            for (const e of g.enemies) g.updateEnemy(e, 0);
            g.sunken.update(camera, g.hero, 0);
            g.renderer.render(g.scene, camera);
            const instances = [];
            g.sunken.root.traverse((o) => {
              if (
                o instanceof T.InstancedMesh &&
                o.userData.prototype === a.name
              )
                instances.push({
                  name: o.name,
                  count: o.count,
                  total: o.userData.total,
                  geometry: o.geometry.uuid,
                  material: o.material.uuid,
                });
            });
            return {
              image: g.renderer.domElement.toDataURL(),
              collision: !g.sunken.navigation.valid(a),
              instances,
              enemies: g.enemies.length,
              render: g.getPerformanceDiagnostics().render,
            };
          },
          { a, quality, view },
        );
        await writeFile(
          `${out}/${a.label.toLowerCase().replaceAll(' ', '-')}-${quality}${view ? `-view${view}` : ''}.png`,
          Buffer.from(result.image.split(',')[1], 'base64'),
        );
        delete result.image;
        assert.ok(result.collision, `${a.name} has no collider`);
        assert.ok(result.instances.length > 0, `${a.name} missing in runtime`);
        assert.equal(result.enemies, 324);
        shots.push({ label: a.label, quality, ...result });
      }
  const minimap = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 768;
    window.__sunkenQA.game.sunken.drawMinimap(c.getContext('2d'), 768);
    return c.toDataURL();
  });
  await writeFile(
    `${out}/minimap.png`,
    Buffer.from(minimap.split(',')[1], 'base64'),
  );
  assert.equal(
    requests.filter((u) => u.endsWith('/sunken-shipwreck.glb')).length,
    1,
    'ship clones must share one asset load',
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ shots: shots.length, errors }));
} finally {
  await writeFile(
    `${out}/artifacts.json`,
    JSON.stringify({ shots, requests, errors }, null, 2),
  );
  await browser.close();
}
