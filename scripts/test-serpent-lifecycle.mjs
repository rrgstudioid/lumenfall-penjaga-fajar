import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [],
  report = { visits: [], quality: [] };
page.on('pageerror', (e) => errors.push(e.message));
const ready = async () => {
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.started &&
      !window.__sunkenQA.game.transitioning &&
      !window.__sunkenQA.game.regionLoadError,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
};
try {
  await page.goto(
    'http://127.0.0.1:3002/sunken-ruins.html?map=abysal-trench-underwater-v1&level=60',
  );
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  report.ai = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    cancelAnimationFrame(g.frame);
    const e = g.enemies.find((e) => !e.boss);
    e.home.set(-390, g.groundHeight(-390, 260), 260);
    e.group.position.copy(e.home);
    e.cooldown = 0;
    Object.assign(g.hero, { x: -390, z: 242 });
    g.placeActor();
    g.invincible = 999;
    const home = e.home.clone();
    const step = () => {
      g.elapsed += 1 / 30;
      g.combatTime += 1 / 30;
      g.updateEnemy(e, 1 / 30);
    };
    for (let i = 0; i < 120; i++) step();
    const chase = e.group.position.distanceTo(home) > 1;
    Object.assign(g.hero, { x: 0, z: 320 });
    g.placeActor();
    for (let i = 0; i < 600; i++) step();
    return {
      chase,
      returned: e.group.position.distanceTo(home) < 1.1,
      tellCleared: !e.serpentTell,
    };
  });
  assert.ok(report.ai.chase && report.ai.returned && report.ai.tellCleared);
  for (const scene of ['boss', 'maze'])
    for (const q of ['office', 'light', 'balanced', 'high']) {
      const result = await page.evaluate(
        async ({ q, scene }) => {
          const { game: g, three: T } = window.__sunkenQA,
            e = g.enemies.find((e) => e.boss),
            body = e.group.children[0];
          g.setGraphicsQuality(q, false);
          const cluster = g.enemies
            .filter((e) => !e.boss)
            .map((e) => ({
              p: e.home,
              n: g.enemies.filter(
                (a) => !a.boss && a.home.distanceTo(e.home) < 110,
              ).length,
            }))
            .sort((a, b) => b.n - a.n)[0];
          Object.assign(
            g.hero,
            scene === 'boss'
              ? { x: e.home.x + 12, z: e.home.z - 25 }
              : { x: cluster.p.x, z: cluster.p.z },
          );
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          g.invincible = 999;
          g.setCameraMode('follow');
          Object.assign(g.followView, {
            distance: 40,
            targetDistance: 40,
            pitch: 0.45,
            targetPitch: 0.45,
            yaw: 0.9,
            targetYaw: 0.9,
          });
          g.tick(performance.now());
          await new Promise((r) => setTimeout(r, 1200));
          const samples = [];
          let last = performance.now();
          await new Promise((resolve) => {
            const frame = (t) => {
              samples.push(t - last);
              last = t;
              if (samples.length < 120) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
          cancelAnimationFrame(g.frame);
          samples.sort((a, b) => a - b);
          const lods = [];
          for (const d of [10, 60, 110]) {
            body.userData.serpentVisual.update(0, 'idle', undefined, d);
            const visible = [];
            body.traverse((o) => {
              if (o instanceof T.SkinnedMesh && o.visible) visible.push(o.name);
            });
            lods.push({ distance: d, visible });
          }
          body.userData.serpentVisual.update(0, 'idle', undefined, 10);
          return {
            scene,
            quality: q,
            p50: samples[Math.floor(samples.length * 0.5)],
            p95: samples[Math.floor(samples.length * 0.95)],
            calls: g.renderer.info.render.calls,
            triangles: g.renderer.info.render.triangles,
            visible: g.enemies.filter((e) => e.group.visible).length,
            lods,
          };
        },
        { q, scene },
      );
      report.quality.push(result);
      assert.ok(result.lods.every((p) => p.visible.length === 1));
      assert.equal(new Set(result.lods.map((p) => p.visible[0])).size, 3);
      if (scene === 'maze') assert.ok(result.visible >= 10);
    }
  async function travel(toTrench) {
    await page.evaluate((toTrench) => {
      const g = window.__sunkenQA.game;
      Object.assign(
        g.hero,
        toTrench ? { x: 187.5, z: -437.5 } : { x: 0, z: 350 },
      );
      g.placeActor();
      g.changeRegion(
        toTrench ? 'abysal-trench-underwater-v1' : 'deep-ocean-underwater-v1',
        toTrench ? 'abysal-trench-f1' : 'return-deep-ocean-f1',
      );
    }, toTrench);
    await ready();
  }
  for (let i = 0; i < 3; i++) {
    await travel(false);
    await travel(true);
    const stats = await page.evaluate(() => {
      const g = window.__sunkenQA.game;
      g.tick(performance.now());
      cancelAnimationFrame(g.frame);
      return {
        count: g.enemies.length,
        models: g.enemies.filter(
          (e) => e.group.children[0].userData.serpentVisual,
        ).length,
        ...g.renderer.info.memory,
      };
    });
    report.visits.push(stats);
    assert.equal(stats.count, 201);
    assert.equal(stats.models, 201);
  }
  assert.ok(report.visits.at(-1).textures <= report.visits[0].textures + 2);
  assert.ok(report.visits.at(-1).geometries <= report.visits[0].geometries + 2);
  await travel(false);
  await page.route('**/__sunken-dev/revision13/serpent-guardian.glb', (r) =>
    r.abort(),
  );
  await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    Object.assign(g.hero, { x: 187.5, z: -437.5 });
    g.placeActor();
    g.changeRegion('abysal-trench-underwater-v1', 'abysal-trench-f1');
  });
  await page.waitForFunction(() => !!window.__sunkenQA.game.regionLoadError);
  report.loadingLocked = await page.evaluate(() => {
    const g = window.__sunkenQA.game,
      p = g.actor.position.clone();
    g.move(3, 0);
    return p.equals(g.actor.position);
  });
  assert.ok(report.loadingLocked);
  await page.unroute('**/__sunken-dev/revision13/serpent-guardian.glb');
  await page.evaluate(() => window.__sunkenQA.game.retryLocationLoad());
  await ready();
  report.retry = await page.evaluate(() =>
    window.__sunkenQA.game.enemies.every(
      (e) => !!e.group.children[0].userData.serpentVisual,
    ),
  );
  assert.ok(report.retry);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await writeFile(
    'output/sunken-ruins/revision13/lifecycle-performance.json',
    JSON.stringify({ ...report, errors }, null, 2),
  );
  await browser.close();
}
