import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision8';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
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
      g.invincible = 0;
      Object.assign(g.hero, { x, z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
    },
    { x, z },
  );
  await page.waitForTimeout(200);
}
async function shot(name, x, z, offset = [18, 15, 22], lookHeight = 2) {
  await place(x, z);
  const png = await page.evaluate(
    ({ x, z, offset, lookHeight }) => {
      const { game: g, three: T } = window.__sunkenQA;
      const y = g.groundHeight(x, z);
      const c = new T.PerspectiveCamera(52, 1440 / 900, 0.1, 2000);
      c.position.set(x + offset[0], y + offset[1], z + offset[2]);
      c.lookAt(x, y + lookHeight, z);
      g.sunken.update(c, g.hero, 0);
      g.renderer.render(g.scene, c);
      return g.renderer.domElement.toDataURL('image/png');
    },
    { x, z, offset, lookHeight },
  );
  await writeFile(
    `${out}/${name}.png`,
    Buffer.from(png.split(',')[1], 'base64'),
  );
}
async function minimap(name) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    window.__sunkenQA.game.sunken.drawMinimap(canvas.getContext('2d'), 640);
    return canvas.toDataURL();
  });
  await writeFile(
    `${out}/${name}.png`,
    Buffer.from(png.split(',')[1], 'base64'),
  );
}
const report = {};
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  await page.evaluate(() =>
    window.__sunkenQA.game.setGraphicsQuality('high', false),
  );
  report.wall = await page.evaluate(() => {
    const { game: g, sunkenLayout: l } = window.__sunkenQA;
    const wall = l.SUNKEN_WALL.segments.find((s) => s.a.x > 250 && s.a.z > 0);
    let count = 0;
    g.sunken.root.traverse((o) => {
      if (o.name.startsWith('Shelf retaining wall')) count++;
    });
    return {
      count,
      point: wall.a,
      openings: l.SUNKEN_WALL.openings.every((p) =>
        g.sunken.navigation.valid(p),
      ),
      monsters: g.enemies.length,
    };
  });
  assert.ok(report.wall.count > 10 && report.wall.openings);
  assert.equal(report.wall.monsters, 324);
  await minimap('sunken-minimap');
  report.containment = await page.evaluate(() => {
    const { game: g, sunkenLayout: l } = window.__sunkenQA;
    const allInside = g.enemies.every(
      (e) =>
        l.sunkenInsideWall(e.home, 24) && l.sunkenInsideWall(e.group.position),
    );
    const gate = l.SUNKEN_PORTALS.find((p) => p.id === 'deep-ocean-g7');
    const e = g.enemies.find((e) => !e.boss),
      original = e.group.position.clone();
    const samples = [];
    for (const opening of l.SUNKEN_WALL.openings) {
      const len = Math.hypot(opening.x, opening.z + 50),
        dx = opening.x / len,
        dz = (opening.z + 50) / len;
      const from = { x: opening.x - dx * 10, z: opening.z - dz * 10 };
      if (!g.sunken.monsterNavigation.valid(from, 0.55)) continue;
      e.group.position.set(from.x, g.groundHeight(from.x, from.z), from.z);
      g.moveEnemy(e, dx * 60, dz * 60);
      samples.push({
        inside: l.sunkenInsideWall(e.group.position),
        valid: g.sunken.monsterNavigation.valid(e.group.position, 0.55),
      });
    }
    e.group.position.copy(original);
    return {
      allInside,
      gateOutside: !l.sunkenInsideWall(gate),
      gate: [gate.x, gate.z],
      samples,
    };
  });
  assert.ok(report.containment.allInside && report.containment.gateOutside);
  assert.deepEqual(report.containment.gate, [312.5, 312.5]);
  assert.ok(
    report.containment.samples.length >= 4 &&
      report.containment.samples.every((s) => s.inside && s.valid),
  );
  report.artifacts = await page.evaluate(() => {
    const g = window.__sunkenQA.game,
      counts = {};
    g.sunken.root.traverse((o) => {
      const name = o.userData.prototype;
      if (
        name &&
        [
          'sunken-shipwreck',
          'neptune-statue',
          'ancient-amphora',
          'sunken-astrolabe',
        ].includes(name) &&
        o.userData.partIndex === 0
      )
        counts[name] = (counts[name] ?? 0) + o.count;
    });
    return counts;
  });
  assert.deepEqual(report.artifacts, {
    'sunken-shipwreck': 1,
    'ancient-amphora': 6,
    'sunken-astrolabe': 2,
  });
  report.shipCollision = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    const world = (x, z) => ({
      x: -310 + x * Math.cos(0.35) + z * Math.sin(0.35),
      z: 65 - x * Math.sin(0.35) + z * Math.cos(0.35),
    });
    const cross = (z, length = 48) => {
      const from = world(-24, z),
        to = world(-24 + length, z);
      Object.assign(g.hero, from);
      g.placeActor();
      for (let i = 0; i < 480; i++)
        g.move((to.x - from.x) / 480, (to.z - from.z) / 480);
      return {
        distance: Math.hypot(g.hero.x - from.x, g.hero.z - from.z),
        from,
        to: { x: g.hero.x, z: g.hero.z },
      };
    };
    return { throughHull: cross(0, 6), besideHull: cross(-10) };
  });
  assert.ok(report.shipCollision.throughHull.distance < 5);
  assert.ok(Math.abs(report.shipCollision.besideHull.distance - 48) < 0.01);
  await shot('shipwreck', -310, 65, [45, 30, 46], 9);
  await shot('amphora', -341, 99, [5, 4, 6], 1.3);
  await shot('astrolabe', -59, -73, [7, 6, 9], 2.2);
  await shot(
    'retaining-wall',
    report.wall.point.x - 10,
    report.wall.point.z - 4,
    [28, 18, 24],
  );
  await shot('offshore-descent', 495, 160, [-50, 45, 15]);
  report.offshoreFog = await page.evaluate(() => {
    const fog = window.__sunkenQA.game.scene.fog;
    return { near: fog.near, far: fog.far };
  });
  assert.deepEqual(report.offshoreFog, { near: 12, far: 105 });
  await shot('shallow-recovery', 45, 225, [14, 10, 19]);
  report.shallowFog = await page.evaluate(() => {
    const fog = window.__sunkenQA.game.scene.fog;
    return { near: fog.near, far: fog.far };
  });
  assert.deepEqual(report.shallowFog, { near: 22, far: 240 });
  await shot('g7-portal', 312.5, 316, [-30, 28, 28]);
  await place(312.5, 315.5);
  await page
    .getByRole('button', { name: 'Deep Ocean · G7', exact: true })
    .click();
  await ready();
  report.deep = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return {
      field: g.hero.currentField,
      x: g.hero.x,
      z: g.hero.z,
      y: g.actor.position.y,
      monsters: g.enemies.length,
      portals: g.portalLabels.length,
      mode: g.characterModel.rig.root.rotation.x,
      metrics: g.sunken.metrics(),
      prototypes: g.sunken.root.children.map((o) => o.name),
    };
  });
  assert.equal(report.deep.field, 'deep-ocean-underwater-v1');
  assert.equal(report.deep.monsters, 0);
  assert.equal(report.deep.portals, 2);
  assert.ok(report.deep.y < -180);
  assert.equal(report.deep.metrics.instances, 0);
  assert.equal(report.deep.metrics.kitGeometries, 0);
  assert.equal(report.deep.metrics.solidReefColliders, 0);
  assert.deepEqual(report.deep.metrics.ambience, {
    fish: 0,
    jellyfish: 0,
    rays: 0,
    particles: 0,
    shafts: 0,
  });
  assert.equal(report.deep.metrics.pbr.textures, 0);
  await minimap('deep-ocean-minimap');
  report.movement = [];
  for (const mode of ['follow', 'free']) {
    const before = await page.evaluate((mode) => {
      const g = window.__sunkenQA.game;
      g.setCameraMode(mode);
      return { x: g.hero.x, z: g.hero.z };
    }, mode);
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    await page.keyboard.up('w');
    const after = await page.evaluate(() => {
      const g = window.__sunkenQA.game;
      return {
        x: g.hero.x,
        z: g.hero.z,
        groundError: Math.abs(
          g.actor.position.y - g.groundHeight(g.hero.x, g.hero.z),
        ),
      };
    });
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.5);
    assert.ok(after.groundError < 0.01);
    report.movement.push({ mode, before, after });
  }
  await page.evaluate(() => window.__sunkenQA.game.setCameraMode('follow'));
  await shot('deep-ocean-landing', 0, 320, [18, 14, 22]);
  await shot('deep-ocean-trench', 100, -150, [18, 22, 26]);
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
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html?replay=1');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  report.reload = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return { field: g.hero.currentField, x: g.hero.x, z: g.hero.z };
  });
  assert.equal(report.reload.field, 'deep-ocean-underwater-v1');
  assert.equal(report.reload.x, 100);
  assert.equal(report.reload.z, -150);
  await place(0, 347);
  await page
    .getByRole('button', { name: 'Kembali ke Sunken Ruins · G7', exact: true })
    .click();
  await ready();
  report.returned = await page.evaluate(() => {
    const g = window.__sunkenQA.game;
    return {
      field: g.hero.currentField,
      x: g.hero.x,
      z: g.hero.z,
      portals: g.portalLabels.length,
    };
  });
  assert.deepEqual(report.returned, {
    field: 'sunken-ruins',
    x: 312.5,
    z: 322.5,
    portals: 4,
  });
  assert.deepEqual(errors, []);
  report.errors = errors;
  console.log(JSON.stringify(report));
} finally {
  await writeFile(`${out}/deep-ocean.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
