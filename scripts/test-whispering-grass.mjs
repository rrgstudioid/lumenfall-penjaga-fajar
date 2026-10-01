import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-grass';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const reports = [];
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started &&
      !window.__wildsQA.game.transitioning &&
      !window.__wildsQA.game.regionLoadError,
  );
  await page.evaluate(() => {
    const { game: g, three: T } = window.__wildsQA;
    // Keep this rendering benchmark independent of the new field's combat.
    g.hurtHero = () => {};
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(60, 1.5, 0.1, 3000);
  });
  for (const quality of ['office', 'balanced']) {
    await page.evaluate(
      (q) => window.__wildsQA.game.setWildsQuality(q, false),
      quality,
    );
    for (const location of [
      { name: 'meadow', x: -190, z: 280 },
      { name: 'bridge', x: -202, z: -55 },
      { name: 'island', x: 42, z: -25 },
    ]) {
      await page.evaluate(({ x, z }) => {
        const { game: g, layout: l } = window.__wildsQA;
        Object.assign(g.hero, { x, z });
        g.placeActor();
        const h = l.wildsGroundHeight(x, z);
        g.camera.position.set(x + 13, h + 12, z + 21);
        g.camera.lookAt(x, h + 1, z);
      }, location);
      await page.waitForTimeout(3500);
      const result = await page.evaluate(() => {
        const g = window.__wildsQA.game;
        g.renderer.render(g.scene, g.camera);
        return {
          png: g.renderer.domElement.toDataURL().split(',')[1],
          metrics: g.wilds.metrics(),
          render: { ...g.renderer.info.render },
        };
      });
      await writeFile(
        `${output}/${quality}-${location.name}.png`,
        Buffer.from(result.png, 'base64'),
      );
      assert(result.metrics.grass.visibleTufts > 500);
      assert(
        result.metrics.grass.cachedCells <= result.metrics.grass.cacheLimit,
      );
      assert.equal(result.metrics.grass.range, 250);
      assert(result.metrics.particles.activeFireflies > 100);
      assert(
        result.metrics.particles.activeFireflies <=
          result.metrics.particles.fireflyCap,
      );
      reports.push({
        quality,
        location: location.name,
        metrics: result.metrics,
        render: result.render,
      });
    }
    const timing = await page.evaluate(async () => {
      const g = window.__wildsQA.game;
      const times = [];
      let previous = performance.now();
      for (let i = 0; i < 180; i++)
        await new Promise((resolve) =>
          requestAnimationFrame((t) => {
            times.push(t - previous);
            previous = t;
            resolve();
          }),
        );
      times.sort((a, b) => a - b);
      return {
        p95: times[Math.floor(times.length * 0.95)],
        diagnostics: g.getPerformanceDiagnostics(),
      };
    });
    reports.push({ quality, timing });
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ reports, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        errors,
        checks: reports
          .filter((r) => r.location)
          .map((r) => ({
            quality: r.quality,
            location: r.location,
            grass: r.metrics.grass,
            particles: r.metrics.particles,
            render: r.render,
          })),
        timings: reports
          .filter((r) => r.timing)
          .map((r) => ({ quality: r.quality, p95: r.timing.p95 })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
