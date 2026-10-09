import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision10';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
async function ready() {
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken &&
      !window.__sunkenQA.game.transitioning &&
      !window.__sunkenQA.game.regionLoadError,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  await page.waitForTimeout(500);
}
async function place(x, z) {
  await page.evaluate(
    ({ x, z }) => {
      const g = window.__sunkenQA.game;
      Object.assign(g.hero, { x, z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.invincible = 0;
    },
    { x, z },
  );
  await page.waitForTimeout(300);
}
async function minimap(name) {
  const result = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 640;
    const ctx = c.getContext('2d'),
      labels = [],
      draw = ctx.fillText.bind(ctx);
    ctx.fillText = (text, x, y) => {
      labels.push({ text, x, y });
      draw(text, x, y);
    };
    window.__sunkenQA.game.sunken.drawMinimap(ctx, 640);
    return { labels, png: c.toDataURL() };
  });
  const numbers = result.labels.filter((p) => /^\d+$/.test(p.text));
  assert.equal(numbers.length, 8);
  assert.ok(
    numbers.every((p) => p.x === 2),
    'only coordinate row numbers remain',
  );
  await writeFile(
    `${out}/${name}.png`,
    Buffer.from(result.png.split(',')[1], 'base64'),
  );
  return result.labels;
}
async function shot(name, x, z, offset = [18, 18, 28], target = [0, 0, 0]) {
  await place(x, z);
  const png = await page.evaluate(
    ({ x, z, offset, target }) => {
      const { game: g, three: T } = window.__sunkenQA;
      const y = g.groundHeight(x, z),
        c = new T.PerspectiveCamera(58, 1440 / 900, 0.1, 2200);
      c.position.set(x + offset[0], y + offset[1], z + offset[2]);
      c.lookAt(x + target[0], y + target[1], z + target[2]);
      g.sunken.update(c, g.hero, 0);
      g.renderer.render(g.scene, c);
      return g.renderer.domElement.toDataURL();
    },
    { x, z, offset, target },
  );
  await writeFile(
    `${out}/${name}.png`,
    Buffer.from(png.split(',')[1], 'base64'),
  );
}
const state = () =>
  page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return {
      id: g.hero.currentField,
      x: g.hero.x,
      z: g.hero.z,
      y: g.actor.position.y,
      mode: g.actor.userData.movementMode,
      portals: g.portalLabels.length,
      monsters: g.enemies.length,
      metrics: g.sunken.metrics(),
    };
  });
async function checkMenu() {
  await page.keyboard.press('m');
  assert.equal(
    await page
      .locator('.region-card')
      .getByRole('heading', { name: 'Deep Ocean', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator('.region-card')
      .getByRole('heading', { name: 'Abysal Trench', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator('.region-card')
      .getByRole('heading', { name: 'Sunken Ruins', exact: true })
      .count(),
    1,
  );
  await page.screenshot({ path: `${out}/world-map.png` });
  await page.keyboard.press('m');
}
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html?replay=1');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  await checkMenu();
  report.sunkenLabels = await minimap('sunken-minimap');
  report.directTravel = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return [
      g.changeRegion('deep-ocean-underwater-v1'),
      g.changeRegion('abysal-trench-underwater-v1'),
    ];
  });
  assert.deepEqual(report.directTravel, [false, false]);
  await place(312.5, 315.5);
  await page
    .getByRole('button', { name: 'Deep Ocean · G7', exact: true })
    .click();
  await ready();
  report.deep = await state();
  assert.equal(report.deep.id, 'deep-ocean-underwater-v1');
  assert.deepEqual([report.deep.x, report.deep.z], [0, 320]);
  assert.ok(report.deep.y < -766 && report.deep.y > -769);
  assert.equal(report.deep.portals, 2);
  assert.equal(report.deep.monsters, 0);
  assert.equal(report.deep.metrics.instances, 0);
  report.deepLabels = await minimap('deep-ocean-minimap');
  assert.ok(report.deepLabels.some((p) => p.text === 'F1'));
  await checkMenu();
  report.depths = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return [400, 200, 0, -200, -437.5].map((z) => ({
      z,
      y: g.groundHeight(187.5, z),
    }));
  });
  assert.ok(report.depths.every((p) => p.y < -765));
  assert.ok(report.depths.slice(2).every((p) => Math.abs(p.y + 780) < 0.26));
  await shot('deep-south', 0, 320);
  await shot('deep-north', 187.5, -430);
  await shot(
    'offshore-trench',
    187.5,
    -485,
    [112.5, 133, 35],
    [-67.5, -327, -155],
  );
  report.northFog = await page.evaluate(() => ({
    far: window.__sunkenQA.game.scene.fog.far,
    color: window.__sunkenQA.game.scene.fog.color.getHexString(),
  }));
  assert.equal(report.northFog.far, 650);
  await shot('f1-portal', 187.5, -437.5, [22, 18, 28]);
  report.movement = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    const results = [];
    for (const mode of ['follow', 'free']) {
      g.setCameraMode(mode);
      Object.assign(g.hero, { x: 100, z: 100 });
      g.placeActor();
      const start = g.actor.position.y;
      for (let i = 0; i < 200; i++) g.move(0, -0.5);
      g.placeActor();
      results.push({
        mode,
        z: g.hero.z,
        drop: start - g.actor.position.y,
        error: Math.abs(
          g.actor.position.y - g.groundHeight(g.hero.x, g.hero.z),
        ),
      });
    }
    Object.assign(g.hero, { x: 187.5, z: -495 });
    g.placeActor();
    for (let i = 0; i < 100; i++) g.move(0, -0.5);
    return { results, northLimit: g.hero.z };
  });
  assert.ok(
    report.movement.results.every(
      (p) => Math.abs(p.z) < 0.01 && Math.abs(p.drop) < 0.3 && p.error < 0.001,
    ),
  );
  assert.ok(report.movement.northLimit >= -499.56);
  await place(187.5, -434.5);
  await page
    .getByRole('button', { name: 'Abysal Trench · F1', exact: true })
    .click();
  await ready();
  report.trench = await state();
  assert.equal(report.trench.id, 'abysal-trench-underwater-v1');
  assert.deepEqual([report.trench.x, report.trench.z], [0, 320]);
  assert.ok(report.trench.y < -1786 && report.trench.mode === 'underwater');
  assert.equal(report.trench.metrics.instances, 0);
  assert.equal(report.trench.monsters, 0);
  assert.equal(report.trench.portals, 1);
  await minimap('abysal-trench-minimap');
  await shot('abysal-trench-landing', 0, 320, [20, 24, 32]);
  report.corridor = await page.evaluate(() => {
    const { game: g, trenchLayout: l } = window.__sunkenQA;
    const results = [];
    for (const mode of ['follow', 'free']) {
      g.setCameraMode(mode);
      Object.assign(g.hero, { x: 0, z: 320 });
      g.placeActor();
      const waypoints = [
        ...l.ABYSAL_TRENCH_PATH.slice(1),
        l.ABYSAL_TRENCH_ARENA,
      ];
      let steps = 0,
        maxError = 0;
      for (const p of waypoints) {
        const dx = p.x - g.hero.x,
          dz = p.z - g.hero.z,
          n = Math.ceil(Math.hypot(dx, dz) / 2);
        for (let i = 0; i < n; i++) {
          g.move(dx / n, dz / n);
          steps++;
          if (!g.sunken.navigation.valid(g.hero))
            throw Error('Escaped corridor');
        }
        maxError = Math.max(
          maxError,
          Math.hypot(g.hero.x - p.x, g.hero.z - p.z),
        );
      }
      results.push({ mode, steps, maxError, x: g.hero.x, z: g.hero.z });
    }
    Object.assign(g.hero, { x: 0, z: 300 });
    g.placeActor();
    g.move(400, 0);
    const blocked = {
      x: g.hero.x,
      z: g.hero.z,
      valid: g.sunken.navigation.valid(g.hero),
    };
    const arena = l.ABYSAL_TRENCH_ARENA;
    return {
      results,
      blocked,
      arena,
      boss: window.__sunkenQA.FIELDS[g.hero.currentField].fieldBoss,
    };
  });
  assert.ok(
    report.corridor.results.every((p) => p.maxError < 0.001 && p.steps > 400),
  );
  assert.ok(report.corridor.blocked.valid && report.corridor.blocked.x < 30);
  assert.equal(report.corridor.boss, null);
  await shot('tectonic-bend', -95, 80, [28, 34, 45], [0, 4, -28]);
  await shot(
    'tectonic-northern-passage',
    100,
    -155,
    [28, 34, 45],
    [-8, 5, -28],
  );
  await shot('reserved-boss-basin', 60, -355, [95, 100, 120], [0, 0, 0]);
  await shot('trench-overview', 0, 0, [350, 550, 360], [0, 0, -45]);
  await place(90, -180);
  await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    g.save();
    window.name =
      'sunken-review:' +
      JSON.stringify(
        Array.from({ length: localStorage.length }, (_, i) => {
          const k = localStorage.key(i);
          return [k, localStorage.getItem(k)];
        }),
      );
  });
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  report.reload = await state();
  assert.equal(report.reload.id, 'abysal-trench-underwater-v1');
  assert.deepEqual([report.reload.x, report.reload.z], [90, -180]);
  await place(0, 347);
  await page
    .getByRole('button', { name: 'Kembali ke Deep Ocean · F1', exact: true })
    .click();
  await ready();
  report.returnDeep = await state();
  assert.equal(report.returnDeep.id, 'deep-ocean-underwater-v1');
  assert.deepEqual([report.returnDeep.x, report.returnDeep.z], [187.5, -427.5]);
  await page.waitForTimeout(1000);
  assert.equal((await state()).id, 'deep-ocean-underwater-v1');
  await place(0, 347);
  await page
    .getByRole('button', { name: 'Kembali ke Sunken Ruins · G7', exact: true })
    .click();
  await ready();
  report.returnSunken = await state();
  assert.deepEqual(
    [report.returnSunken.x, report.returnSunken.z],
    [312.5, 322.5],
  );
  assert.equal(report.returnSunken.monsters, 324);
  report.errors = errors;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(report));
} finally {
  await writeFile(`${out}/browser.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
