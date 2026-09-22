import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(
  'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const out = path.resolve('dev-prototypes/kingdom-capital-v11/evidence');
fs.mkdirSync(out, { recursive: true });
const structure = process.argv.includes('--structure'),
  craft = process.argv.includes('--craft'),
  smoke = process.argv.includes('--smoke'),
  finalClimb = process.argv.includes('--final-climb'),
  walk = process.argv.includes('--walk'),
  collision = process.argv.includes('--collision');
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
  await page.goto(
    'http://127.0.0.1:3007/tests/browser/kingdom-capital.html' +
      (structure ? '?structure=1' : ''),
    { waitUntil: 'networkidle', timeout: 120000 },
  );
  await page.waitForFunction(() => window.capital?.state().ready, null, {
    timeout: 120000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(
      out,
      structure ? 'structure-overview.png' : '02-overview.png',
    ),
  });
  console.log(
    JSON.stringify({
      load: await page.evaluate(() => window.capital.state()),
      errors,
      failed,
    }),
  );
  if (errors.length || failed.length) throw Error('Render boundary failed');
  if (collision) {
    const checks = await page.evaluate(() => {
      const q = window.capital,
        c = q.city,
        checks = [];
      const record = (name, pass, detail) =>
        checks.push({ name, pass, detail });
      const travel = (points) => {
        let p = { x: points[0][0], z: points[0][1] };
        for (let i = 1; i < points.length; i++) {
          const end = points[i];
          for (let n = 0; n < 10000; n++) {
            const dx = end[0] - p.x,
              dz = end[1] - p.z,
              d = Math.hypot(dx, dz);
            if (d < 0.2) break;
            const next = c.move(p, (dx / d) * 0.15, (dz / d) * 0.15);
            if (Math.hypot(next.x - p.x, next.z - p.z) < 0.001)
              return { pass: false, p, end };
            p = next;
          }
        }
        return { pass: true, p };
      };
      for (const r of q.roads.filter((r) => r.stairs)) {
        const result = travel(r.points);
        record(r.name + ' traversable', result.pass, result);
      }
      for (const tag of ['building', 'outer-wall', 'tree', 'bridge-parapet']) {
        const hit = c.colliders.find((v) => v.tag === tag && v.y < 20);
        if (!hit) {
          record(tag, false, 'missing collider');
          continue;
        }
        const normal = { x: Math.cos(hit.angle), z: -Math.sin(hit.angle) },
          start = {
            x: hit.x + normal.x * (hit.hx + 1),
            z: hit.z + normal.z * (hit.hx + 1),
          },
          end = c.move(start, -normal.x * 3, -normal.z * 3);
        record(
          tag + ' blocks exterior',
          Math.hypot(end.x - start.x, end.z - start.z) < 1,
          { start, end },
        );
      }
      for (const [name, pts] of [
        [
          'Gate passage',
          [
            [0, 350],
            [0, 320],
          ],
        ],
        [
          'Bridge deck',
          [
            [405, 270],
            [505, 270],
          ],
        ],
        [
          'Narrow alley',
          [
            [-250.1, 180.9],
            [-250.1, 170],
          ],
        ],
      ]) {
        const result = travel(pts);
        record(name, result.pass, result);
      }
      record(
        'Actual character',
        q.state().character === 'astra-hunyuan',
        q.state().characterHeight,
      );
      return checks;
    });
    await page.evaluate(() => {
      window.capital.teleport(0, 350);
      window.capital.setView('player');
      window.capital.g.yaw = 0;
    });
    await page.locator('#world').focus();
    const before = await page.evaluate(() => window.capital.state().position);
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    await page.keyboard.up('w');
    const after = await page.evaluate(() => window.capital.state().position);
    checks.push({
      name: 'Real W input',
      pass: Math.hypot(after[0] - before[0], after[2] - before[2]) > 6,
      detail: { before, after },
    });
    await page.screenshot({ path: path.join(out, '16-player-input.png') });
    fs.writeFileSync(
      path.join(out, 'collision-input.json'),
      JSON.stringify({ checks, errors, warnings, failed }, null, 2),
    );
    console.log(JSON.stringify(checks));
    if (checks.some((c) => !c.pass))
      throw Error('Collision/input acceptance failed');
  } else if ((structure || walk || craft) && !smoke) {
    await page.evaluate(({finalClimb,craft}) => {
      const q = window.capital;
      const points = craft ? [[0,40,38],[-20,45,38],[-110,110,38],[50,110,38],[180,60,38],[240,110,38],[260,205,10],[200,214,10],[200,230,10]] : finalClimb ? q.plazaToCastle.slice(4) : q.gateToPlaza;
      q.teleport(points[0][0], points[0][1]);
      q.beginWalk(
        craft ? 'Plaza → Craft via civic loop' : finalClimb ? 'Final climb debug' : 'Main Gate → Plaza',
        points,
      );
    }, {finalClimb,craft});
    for (const part of craft ? ['craft'] : finalClimb ? ['final-climb'] : ['gate', 'castle']) {
      const start = Date.now();
      while (true) {
        await page.waitForTimeout(5000);
        const s = await page.evaluate(() => window.capital.state());
        console.log(
          JSON.stringify({
            part,
            elapsed: (Date.now() - start) / 1000,
            pos: s.position,
            progress: s.traversal?.index,
            done: s.traversal?.done,
            fps: s.fps,
          }),
        );
        if (s.traversal?.done) break;
        if (Date.now() - start > 150000)
          throw Error('Traversal stuck or exceeds budget');
      }
      await page.screenshot({
        path: path.join(
          out,
          (structure ? 'structure' : 'populated') + '-walk-' + part + '.png',
        ),
      });
      if (part === 'gate')
        await page.evaluate(() =>
          window.capital.beginWalk(
            'Plaza → Castle',
            window.capital.plazaToCastle,
          ),
        );
    }
  } else if (!smoke) {
    const views = [
      'top',
      'overview',
      'gate',
      'inside',
      'plaza',
      'craft',
      'lower',
      'upperhome',
      'stairs',
      'terrace',
      'castle',
      'street',
      'alley',
      'wall',
      'silhouette',
    ];
    const performance = [];
    for (const [i, name] of views.entries()) {
      await page.locator(`[data-view="${name}"]`).click();
      await page.waitForTimeout(1800);
      await page.screenshot({
        path: path.join(out, `${String(i + 1).padStart(2, '0')}-${name}.png`),
      });
      performance.push({
        view: name,
        ...(await page.evaluate(() => window.capital.state())),
      });
    }
    fs.writeFileSync(
      path.join(out, 'views.json'),
      JSON.stringify(performance, null, 2),
    );
  }
  const result = {
    headed: true,
    browser: await browser.version(),
    errors,
    warnings,
    failed,
    ...(await page.evaluate(() => window.capital.state())),
  };
  fs.writeFileSync(
    path.join(
      out,
      craft ? 'craft-walk-result.json' : structure
        ? 'structure-result.json'
        : walk
          ? 'populated-walk-result.json'
          : collision
            ? 'input-browser-result.json'
            : 'browser-result.json',
    ),
    JSON.stringify(result, null, 2),
  );
  if (!structure)
    fs.writeFileSync(
      path.join(out, 'layout-runtime.json'),
      JSON.stringify(
        await page.evaluate(() => ({
          buildings: window.capital.city.buildingRecords,
          colliders: window.capital.city.colliders,
          assets: window.capital.city.assetUse,
          roads: window.capital.roads,
          districts: window.capital.districts,
        })),
        null,
        2,
      ),
    );
  console.log(JSON.stringify(result));
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
