// Isolated actual runtime fixture: no owner saves or browser profile access.
import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'work/meteorfall-citadel/revision3/surfaces';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  benchmarks = [];
let surfaces, order;
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3006/meteorfall-citadel.html');
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await page.waitForFunction(
    () =>
      window.__meteorfallQA?.game?.meteorfall &&
      !window.__meteorfallQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  surfaces = await page.evaluate(() => {
    const { game: g, layout: l, three: T } = window.__meteorfallQA;
    g.invincible = Infinity;
    g.paused = false;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.meteorfall.root.updateMatrixWorld(true);
    const ray = new T.Raycaster(),
      points = [],
      bad = [];
    let maxError = 0,
      decorHits = 0;
    const accents = [];
    g.meteorfall.root.traverse((o) => {
      if (o.name.endsWith('cliff accents')) accents.push(o);
    });
    for (const b of l.METEORFALL_DECKS)
      for (let i = 0; i < 31; i++)
        for (const offset of [
          -b.clearWidth / 2 + 0.7,
          0,
          b.clearWidth / 2 - 0.7,
        ])
          points.push(
            l.meteorBridgePoint(
              b,
              -8 / b.length + ((1 + 16 / b.length) * (i + 0.314159)) / 31,
              offset,
            ),
          );
    for (const p of l.METEORFALL_PLATFORMS)
      for (let x = -p.width / 2 + 5.123; x < p.width / 2; x += 12.17)
        for (let z = -p.depth / 2 + 5.789; z < p.depth / 2; z += 12.37)
          points.push({ x: p.x + x, z: p.z + z });
    let samples = 0;
    for (const p of points) {
      if (!l.meteorWalkable(p, 0.45)) continue;
      const h = l.meteorGroundHeight(p);
      ray.set(new T.Vector3(p.x, h + 10, p.z), new T.Vector3(0, -1, 0));
      ray.far = 12;
      const hits = ray.intersectObject(g.meteorfall.surfaces, true);
      const unique = new Set(hits.map((hit) => hit.object.uuid));
      if (unique.size !== 1)
        bad.push({
          p,
          count: unique.size,
          names: hits.map((hit) => hit.object.name),
        });
      if (hits[0]) maxError = Math.max(maxError, Math.abs(hits[0].point.y - h));
      ray.far = 10.01;
      decorHits += ray.intersectObjects(accents).length;
      samples++;
    }
    return {
      samples,
      bad,
      maxError,
      decorHits,
      total: g.enemies.length,
      central: g.enemies
        .filter((e) => e.id >= 400 && e.id <= 471)
        .map((e) => e.id),
    };
  });
  console.log('SURFACES', JSON.stringify(surfaces));
  assert.equal(surfaces.total, 294);
  assert.equal(surfaces.central.length, 72);
  assert.equal(surfaces.bad.length, 0);
  assert(surfaces.maxError < 0.0001);
  assert.equal(surfaces.decorHits, 0);
  order = await page.evaluate(() => {
    const { game: g, three: T } = window.__meteorfallQA,
      results = [];
    const target = new T.WebGLRenderTarget(640, 400),
      a = new Uint8Array(640 * 400 * 4),
      b = new Uint8Array(a.length);
    const floor = g.meteorfall.surfaces.children;
    for (const z of [190, 30, -150, -238, -264]) {
      const y = g.meteorfall.groundHeight(0, z);
      const cam = new T.PerspectiveCamera(50, 1.6, 0.1, 1800);
      cam.position.set(5, y + 15, z + 22);
      cam.lookAt(0, y, z - 5);
      cam.updateMatrixWorld();
      g.meteorfall.update(cam, g.hero, 0);
      g.renderer.setRenderTarget(target);
      floor.forEach((o, i) => (o.renderOrder = i + 1));
      g.renderer.render(g.scene, cam);
      g.renderer.readRenderTargetPixels(target, 0, 0, 640, 400, a);
      floor.forEach((o, i) => (o.renderOrder = floor.length - i));
      g.renderer.render(g.scene, cam);
      g.renderer.readRenderTargetPixels(target, 0, 0, 640, 400, b);
      let changed = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.max(
            Math.abs(a[i] - b[i]),
            Math.abs(a[i + 1] - b[i + 1]),
            Math.abs(a[i + 2] - b[i + 2]),
          ) > 3
        )
          changed++;
      results.push({ z, changedPixels: changed, totalPixels: 640 * 400 });
    }
    floor.forEach((o) => (o.renderOrder = 0));
    g.renderer.setRenderTarget(null);
    target.dispose();
    return results;
  });
  console.log('ORDER', JSON.stringify(order));
  assert(
    order.every((r) => r.changedPixels < 20),
    'floor draw-order instability',
  );
  // Capture the previously obstructed citadel approach from several nearby camera angles.
  for (const [name, z] of [
    ['crown-approach', -238],
    ['lower-crossing', 190],
    ['crucible', 30],
    ['forecourt', -150],
  ]) {
    await page.evaluate((z) => {
      const g = window.__meteorfallQA.game;
      Object.assign(g.hero, { x: 0, z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      Object.assign(g.followView, {
        distance: 28,
        targetDistance: 28,
        pitch: 0.55,
        targetPitch: 0.55,
        yaw: 0,
        targetYaw: 0,
      });
      g.updateCamera(0);
      g.meteorfall.update(g.camera, g.hero, 0);
      g.renderer.render(g.scene, g.camera);
    }, z);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    g.lastTime = performance.now();
    g.tick(performance.now());
  });
  for (const quality of ['office', 'light'])
    for (const [id, z] of [
      ['L', 190],
      ['C', 30],
      ['A', -150],
    ]) {
      await page.evaluate(
        ({ quality, z }) => {
          const g = window.__meteorfallQA.game;
          g.setGraphicsQuality(quality, false);
          Object.assign(g.hero, { x: 0, z });
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
        },
        { quality, z },
      );
      await page.waitForTimeout(1200);
      await page.evaluate(() =>
        window.__meteorfallQA.game.renderPerformance.reset(),
      );
      await page.waitForTimeout(4200);
      const result = await page.evaluate(() =>
        window.__meteorfallQA.game.getPerformanceDiagnostics(),
      );
      benchmarks.push({ id, ...result });
      console.log('BENCH', quality, id, result.fpsMedian, result.frameMs.p95);
      assert(result.frameMs.p95 <= (quality === 'office' ? 33.3 : 25));
    }
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ surfaces, order, benchmarks, errors }, null, 2),
  );
  await browser.close();
}
