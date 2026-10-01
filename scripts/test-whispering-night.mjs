import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-night';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  reports = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const ready = () =>
  page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started &&
      !window.__wildsQA.game.transitioning &&
      !window.__wildsQA.game.regionLoadError,
  );
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  await page.evaluate(() => {
    const { game: g, three: T } = window.__wildsQA;
    window.__nightCamera = { camera: g.camera, update: g.updateCamera };
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(60, 1.6, 0.1, 3000);
  });
  for (const quality of ['office', 'balanced']) {
    await page.evaluate(
      (q) => window.__wildsQA.game.setWildsQuality(q, false),
      quality,
    );
    for (const view of ['grass', 'trunk', 'overview']) {
      await page.evaluate((view) => {
        const { game: g } = window.__wildsQA;
        Object.assign(g.hero, { x: 42, z: -25 });
        g.placeActor();
        if (view === 'grass') {
          g.camera.position.set(55, 34, -4);
          g.camera.lookAt(42, 23, -25);
        }
        if (view === 'trunk') {
          g.camera.position.set(62, 45, 18);
          g.camera.lookAt(15, 49, -55);
        }
        if (view === 'overview') {
          g.camera.position.set(-110, 103, 126);
          g.camera.lookAt(15, 74, -55);
        }
        g.camera.updateMatrixWorld();
      }, view);
      await page.waitForTimeout(2600);
      const result = await page.evaluate(() => {
        const { game: g, three: T } = window.__wildsQA;
        g.renderer.render(g.scene, g.camera);
        const lights = [];
        g.worldLightRig.traverse((o) => {
          if (o instanceof T.Light)
            lights.push({
              type: o.type,
              color: o.color.getHexString(),
              intensity: o.intensity,
            });
        });
        return {
          png: g.renderer.domElement.toDataURL().split(',')[1],
          metrics: g.wilds.metrics(),
          exposure: g.renderer.toneMappingExposure,
          lights,
          render: { ...g.renderer.info.render },
        };
      });
      await writeFile(
        `${output}/${quality}-${view}.png`,
        Buffer.from(result.png, 'base64'),
      );
      assert.equal(result.metrics.iconTree.trunkParticles, 0);
      assert.equal(result.metrics.iconTree.rainbowBark, true);
      assert.equal(result.metrics.iconTree.drawCalls, 3);
      assert.match(result.metrics.sky, /night/);
      assert.equal(result.exposure, 0.95);
      assert(result.lights.every((l) => l.intensity < 1));
      delete result.png;
      reports.push({ quality, view, ...result });
    }
  }
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.camera = window.__nightCamera.camera;
    g.updateCamera = window.__nightCamera.update;
  });
  await page.evaluate(() => window.__wildsQA.game.changeRegion('arunika'));
  await ready();
  const city = await page.evaluate(() => {
    const { game: g, three: T } = window.__wildsQA;
    let ambient = 0;
    g.worldLightRig.traverse((o) => {
      if (o instanceof T.HemisphereLight) ambient = o.intensity;
    });
    return {
      exposure: g.renderer.toneMappingExposure,
      ambient,
      elder: g.scene.getObjectByName('Warm white trunk motes')?.name ?? null,
    };
  });
  assert.equal(city.exposure, 1.1);
  assert(city.ambient > 1);
  assert.equal(city.elder, null);
  await page.evaluate(() =>
    window.__wildsQA.game.changeRegion('whispering-wilds-v2'),
  );
  await ready();
  const returned = await page.evaluate(() => ({
    exposure: window.__wildsQA.game.renderer.toneMappingExposure,
    leds: window.__wildsQA.game.wilds.metrics().iconTree.trunkParticles,
  }));
  assert.equal(returned.exposure, 0.95);
  assert.equal(returned.leds, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ reports, city, returned, errors }, null, 2),
  );
  console.log(
    'PASS night lighting, rainbow bark without trunk particles, six Low/High views, city lighting restoration and night re-entry; no runtime errors',
  );
} finally {
  await browser.close();
}
