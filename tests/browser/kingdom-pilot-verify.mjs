import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(
  'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const out = path.resolve('dev-assets/kingdom-city-pilot-a3/evidence');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--window-size=1600,1000'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } }),
  errors = [],
  warnings = [],
  failed = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
});
try {
  await page.goto('http://127.0.0.1:3006/tests/browser/kingdom-pilot.html', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page.waitForFunction(() => window.kingdomPilot?.state().ready, null, {
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  const initial = await page.evaluate(() => window.kingdomPilot.state());
  for (const [spot, file] of [
    ['gate', '01-player-gate'],
    ['house', '02-player-house'],
    ['wall', '03-wall-tower'],
    ['street', '04-street'],
    ['nature', '05-tree-rock'],
    ['overview', '08-overview'],
  ]) {
    await page.locator(`[data-spot="${spot}"]`).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, file + '.png') });
  }
  await page.locator('#collision').check();
  await page.screenshot({ path: path.join(out, '06-collision.png') });
  await page.locator('#collision').uncheck();
  await page.locator('#remap').check();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, '07-material-remap.png') });
  await page.locator('[data-spot="street"]').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, '07b-fabric-metal-remap.png') });
  await page.locator('#remap').uncheck();
  const audit = await page.evaluate(() => ({
    models: window.kingdomPilot.pilot.audit,
    aperture: window.kingdomPilot.pilot.aperture,
    boxes: window.kingdomPilot.pilot.boxes,
    trunk: window.kingdomPilot.pilot.trunk,
    materialBindings: window.kingdomPilot.pilot.remapBindings,
    stairs: window.kingdomPilot.pilot.stairsMeasurement,
  }));
  fs.writeFileSync(
    path.join(out, 'model-audit.json'),
    JSON.stringify(audit, null, 2),
  );
  if (process.argv.includes('--smoke')) {
    console.log(JSON.stringify({ initial, errors, failed }));
  } else {
    const walks = [];
    for (const [name, x, z, yaw, ms] of [
      ['wall', 3, 3, 0, 1800],
      ['gate', 0, 3, 0, 2000],
      ['house', 10.5, -4, 0, 2000],
      ['tree', audit.trunk.x, 12, 0, 1700],
      ['rock', 11, 12, 0, 1700],
      [
        'stairs',
        -6,
        audit.stairs.lowZ + (audit.stairs.direction < 0 ? 0.3 : -0.3),
        audit.stairs.direction < 0 ? 0 : Math.PI,
        620,
      ],
    ]) {
      await page.evaluate(
        ([x, z, yaw]) => {
          window.kingdomPilot.setView('player');
          window.kingdomPilot.teleport(x, z, yaw);
        },
        [x, z, yaw],
      );
      await page.locator('#world canvas').focus();
      await page.keyboard.down('w');
      await page.waitForTimeout(ms);
      await page.keyboard.up('w');
      const state = await page.evaluate(() => window.kingdomPilot.state());
      walks.push({ name, start: { x, z }, ...state });
      await page.screenshot({ path: path.join(out, 'walk-' + name + '.png') });
    }
    await page.locator('[data-spot="wall"]').click();
    const cameraBefore = await page.evaluate(() => window.kingdomPilot.g.camera.position.toArray());
    await page.mouse.move(850, 500);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(1100, 560, { steps: 12 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(350);
    const camera = await page.evaluate(() => {
      const q = window.kingdomPilot,
        g = q.g;
      return {
        position: g.camera.position.toArray(),
        actor: g.actor.position.toArray(),
        finite: g.camera.position.toArray().every(Number.isFinite),
      };
    });
    camera.changedByPointer = camera.position.some((n, i) => Math.abs(n - cameraBefore[i]) > 0.05);
    await page.screenshot({ path: path.join(out, 'camera-near-wall.png') });
    const benchmarks = [];
    for (const lod of ['0', '1']) {
      await page.locator('#lod').selectOption(lod);
      for (const mode of ['individual', 'instanced']) {
        benchmarks.push(
          await page.evaluate(
            (mode) => window.kingdomPilot.benchmark(mode),
            mode,
          ),
        );
        await page.screenshot({
          path: path.join(out, 'performance-lod' + lod + '-' + mode + '.png'),
        });
      }
    }
    await page.locator('#pilot').click();
    const lods = [];
    for (const level of ['0', '1', '2']) {
      await page.locator('#lod').selectOption(level);
      await page.locator('[data-spot="nature"]').click();
      await page.waitForTimeout(700);
      await page.screenshot({
        path: path.join(out, 'tree-lod' + level + '.png'),
      });
      lods.push(await page.evaluate(() => window.kingdomPilot.state()));
    }
    const result = {
      headed: true,
      browser: await browser.version(),
      initial,
      walks,
      camera,
      benchmarks,
      lods,
      errors,
      warnings,
      failed,
      checks: {
        wallBlocked: walks[0].position.z > 0.5,
        gatePasses: walks[1].position.z < -0.5,
        houseEntered: walks[2].position.z < -7.5 && walks[2].position.z > -13,
        treeBlocked:
          Math.hypot(
            walks[3].position.x - audit.trunk.x,
            walks[3].position.z - audit.trunk.z,
          ) >=
          audit.trunk.radius + 0.43,
        rockBlocked: walks[4].position.z > 10,
        stairsClimbed: walks[5].position.y > 1.1,
        cameraUsable: camera.finite && camera.changedByPointer,
      },
    };
    fs.writeFileSync(
      path.join(out, 'browser-result.json'),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result, null, 2));
    if (Object.values(result.checks).some((v) => !v)) process.exitCode = 1;
  }
  if (errors.length || failed.length) process.exitCode = 1;
} catch (e) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  fs.writeFileSync(
    path.join(out, 'failure.json'),
    JSON.stringify({ error: String(e), errors, warnings, failed }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
