import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision7';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
async function ready() {
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
  });
}
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const report = await page.evaluate(() => {
    const { game: g, sunkenLayout: l } = window.__sunkenQA;
    const prototypes = {};
    g.sunken.root.traverse((o) => {
      if (o.userData.prototype)
        prototypes[o.userData.prototype] =
          (prototypes[o.userData.prototype] ?? 0) + o.userData.total;
    });
    function cross(from, dx, dz) {
      Object.assign(g.hero, from);
      g.placeActor();
      const steps = Math.ceil(Math.hypot(dx, dz) / 0.1);
      for (let i = 0; i < steps; i++) g.move(dx / steps, dz / steps);
      return {
        from,
        to: { x: g.hero.x, z: g.hero.z },
        groundError: Math.abs(
          g.actor.position.y - l.sunkenGroundHeight(g.hero.x, g.hero.z),
        ),
      };
    }
    const clearings = l.SUNKEN_CLEARINGS.map((p) =>
      cross({ x: p.x - 2, z: p.z }, 4, 0),
    );
    const slopes = l.SUNKEN_WALL.openings.map((p) => {
      const length = Math.hypot(p.x, p.z + 50),
        dx = p.x / length,
        dz = (p.z + 50) / length;
      return {
        ...cross({ x: p.x - dx * 6, z: p.z - dz * 6 }, dx * 12, dz * 12),
        dx: dx * 12,
        dz: dz * 12,
      };
    });
    const edges = [
      cross({ x: 495, z: 495 }, 10, 0),
      cross({ x: -495, z: -495 }, -10, 0),
      cross({ x: 495, z: 495 }, 0, 10),
      cross({ x: -495, z: -495 }, 0, -10),
    ];
    const reef = l.SUNKEN_REEFS.find(
      (p) =>
        p.radius > 0 &&
        g.sunken.navigation.valid({ x: p.x - p.radius - 2, z: p.z }),
    );
    const solid = cross(
      { x: reef.x - reef.radius - 2, z: reef.z },
      reef.radius * 2 + 4,
      0,
    );
    Object.assign(g.hero, slopes[1].to);
    g.placeActor();
    g.save();
    window.name =
      'sunken-review:' +
      JSON.stringify(
        Array.from({ length: localStorage.length }, (_, i) => {
          const k = localStorage.key(i);
          return [k, localStorage.getItem(k)];
        }),
      );
    return {
      prototypes,
      clearings,
      slopes,
      edges,
      solid: { ...solid, center: reef.x },
      saved: { x: g.hero.x, z: g.hero.z },
      population: g.enemies.length,
      portals: l.SUNKEN_PORTALS.length,
    };
  });
  for (const name of ['ocean_statue', 'broken_wall', 'slab'])
    assert.equal(report.prototypes[name], undefined, name);
  assert.ok(report.prototypes.pillar > 0 && report.prototypes.reef_cluster > 0);
  for (const row of report.clearings)
    assert.ok(Math.abs(row.to.x - row.from.x - 4) < 1e-5);
  for (const row of report.slopes) {
    assert.ok(
      Math.hypot(
        row.to.x - row.from.x - row.dx,
        row.to.z - row.from.z - row.dz,
      ) < 1e-5,
    );
    assert.ok(row.groundError < 0.3, JSON.stringify(row));
  }
  for (const row of report.edges)
    assert.ok(Math.abs(row.to.x) <= 499.55 && Math.abs(row.to.z) <= 499.55);
  assert.ok(report.solid.to.x < report.solid.center);
  assert.equal(report.population, 324);
  assert.equal(report.portals, 4);
  for (const shot of ['central-clearing', 'throne', 'traversable-slope']) {
    const png = await page.evaluate(
      ({ shot, saved }) => {
        const { game: g, three: T, sunkenLayout: l } = window.__sunkenQA;
        let target = shot === 'throne' ? { x: 45, z: -370 } : { x: 10, z: -25 };
        if (shot === 'traversable-slope') target = saved;
        Object.assign(g.hero, target);
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
        g.lastTime = performance.now();
        for (let i = 0; i < 30; i++) {
          g.tick(g.lastTime + 1000 / 60);
          cancelAnimationFrame(g.frame);
          g.frame = 0;
        }
        const ground = l.sunkenGroundHeight(target.x, target.z);
        const camera = new T.PerspectiveCamera(52, 1440 / 900, 0.1, 2000);
        camera.position.set(target.x + 16, ground + 14, target.z + 22);
        camera.lookAt(target.x, ground + 1, target.z);
        g.setGraphicsQuality('high', false);
        g.sunken.update(camera, target, 0);
        g.renderer.render(g.scene, camera);
        return g.renderer.domElement.toDataURL('image/png');
      },
      { shot, saved: report.saved },
    );
    await writeFile(
      `${out}/${shot}.png`,
      Buffer.from(png.split(',')[1], 'base64'),
    );
  }
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html?replay=1');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  report.reloaded = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return { x: g.hero.x, z: g.hero.z };
  });
  assert.deepEqual(report.reloaded, report.saved);
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/clearings.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  console.log(JSON.stringify({ ...report, errors }));
} finally {
  await browser.close();
}
