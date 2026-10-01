import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-hunting';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const ready = async () => {
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started && !window.__wildsQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  assert.equal(
    await page.evaluate(() =>
      String(window.__wildsQA.game.regionLoadError ?? ''),
    ),
    '',
  );
};
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await ready();
  report.population = await page.evaluate(() => {
    const { game: g, layout: l } = window.__wildsQA;
    g.paused = true;
    return {
      total: g.enemies.length,
      normal: g.enemies.filter((e) => e.definition.variant === 'normal').length,
      elite: g.enemies.filter((e) => e.definition.variant === 'elite').length,
      bosses: g.enemies
        .filter((e) => e.boss)
        .map((e) => ({
          name: e.definition.name,
          level: e.definition.level,
          x: e.home.x,
          z: e.home.z,
        })),
      levels: [...new Set(g.enemies.map((e) => e.definition.level))].sort(
        (a, b) => a - b,
      ),
      invalid: g.enemies
        .filter(
          (e) =>
            !g.wilds.navigation.valid(e.home, e.boss ? 1.8 : 0.55) ||
            Math.abs(e.home.y - l.wildsGroundHeight(e.home.x, e.home.z)) >
              0.001,
        )
        .map((e) => e.id),
      period: g.wilds.metrics().mushrooms.breathPeriod,
    };
  });
  assert.equal(report.population.total, 273);
  assert.equal(report.population.normal, 256);
  assert.equal(report.population.elite, 16);
  assert.deepEqual(report.population.levels, [16, 17, 20, 22, 24]);
  assert.deepEqual(report.population.bosses, [
    { name: 'Forest Warden', level: 24, x: 286, z: -99 },
  ]);
  assert.deepEqual(report.population.invalid, []);
  assert.equal(report.population.period, 9);
  report.combat = await page.evaluate(() => {
    const { game: g, layout: l } = window.__wildsQA;
    const results = [];
    for (const boss of [false, true]) {
      const e = g.enemies.find((e) =>
        boss ? e.boss : e.definition.variant === 'normal',
      );
      Object.assign(
        g.hero,
        g.wilds.navigation.restore({ x: e.home.x + 1, z: e.home.z }),
      );
      g.placeActor();
      e.cooldown = 0;
      let damage = 0;
      const originalHurt = g.hurtHero;
      g.hurtHero = (value) => {
        damage += value;
      };
      for (let i = 0; i < 100; i++) g.updateEnemy(e, 0.05);
      g.hurtHero = originalHurt;
      const max = e.max;
      g.hurtEnemy(e, 100, 0);
      const received = e.hp < max;
      g.hurtEnemy(e, 1e8, 0);
      const dead = e.hp === 0,
        saved = g.hero.monsterRespawnState[e.respawnKey] === e.respawnDeadline;
      const seconds = e.respawn;
      e.respawnDeadline = Date.now() - 1;
      g.updateEnemy(e, 0.01);
      results.push({
        boss,
        damage,
        received,
        dead,
        saved,
        seconds,
        respawned: e.hp === max && e.group.position.equals(e.home),
        key: e.respawnKey,
      });
    }
    // Exercise the real enemy movement hook against a river, not only nav helpers.
    const e = g.enemies.find((e) => !e.boss);
    const original = e.home.clone();
    const bridge = l.WILDS_BRIDGES.find((b) => b.id !== 'island');
    const p = g.wilds.navigation.restore({
      x: bridge.x - 35,
      z: bridge.z + 35,
    });
    e.group.position.set(p.x, l.wildsGroundHeight(p.x, p.z), p.z);
    let movementValid = true;
    for (let i = 0; i < 80; i++) {
      const water = l.WILDS_RIVER[Math.floor(l.WILDS_RIVER.length / 2)];
      const dx = water.x - e.group.position.x,
        dz = water.z - e.group.position.z,
        len = Math.hypot(dx, dz);
      g.moveEnemy(e, (dx / len) * 2, (dz / len) * 2);
      movementValid &&=
        g.wilds.navigation.valid(e.group.position, 0.55) &&
        Math.abs(
          e.group.position.y -
            l.wildsGroundHeight(e.group.position.x, e.group.position.z),
        ) < 0.001;
    }
    e.group.position.copy(original);
    return { results, movementValid };
  });
  for (const r of report.combat.results) {
    assert(r.damage > 0 && r.received && r.dead && r.saved && r.respawned);
    assert.equal(r.seconds, r.boss ? 120 : 25);
    assert(r.key.startsWith('whispering-wilds-v2:'));
  }
  assert(report.combat.movementValid);
  report.views = [];
  for (const view of ['boss', 'meadow']) {
    const shot = await page.evaluate((view) => {
      const { game: g, three: T, layout: l } = window.__wildsQA;
      g.updateCamera = () => {};
      g.camera = new T.PerspectiveCamera(60, 1400 / 900, 0.1, 1400);
      const p = view === 'boss' ? l.WILDS_ALTAR : { x: -190, z: 280 };
      Object.assign(
        g.hero,
        g.wilds.navigation.restore({ x: p.x + 9, z: p.z + 9 }),
      );
      g.placeActor();
      const h = l.wildsGroundHeight(p.x, p.z);
      g.camera.position.set(p.x + 20, h + 16, p.z + 30);
      g.camera.lookAt(p.x, h + 2, p.z);
      g.camera.updateMatrixWorld();
      for (let i = 0; i < 100; i++) g.wilds.update(g.camera, g.hero, 0.1, 1);
      for (const e of g.enemies) {
        e.flash = 0; // Capture the resting model after the combat checks.
        g.updateEnemy(e, 0);
      }
      g.renderer.render(g.scene, g.camera);
      return {
        png: g.renderer.domElement.toDataURL().split(',')[1],
        metrics: g.wilds.metrics(),
        render: { ...g.renderer.info.render },
      };
    }, view);
    await writeFile(`${output}/${view}.png`, Buffer.from(shot.png, 'base64'));
    delete shot.png;
    report.views.push({ view, ...shot });
    assert.equal(shot.metrics.grass.color, '#39e8ee');
    assert.equal(shot.metrics.grass.emission, 0.18);
    assert.equal(shot.metrics.particles.renderRange, 250);
    assert.equal(shot.render.points, shot.metrics.particles.gpuFireflies);
    assert(shot.metrics.particles.gpuFireflies > 100);
    assert(
      shot.metrics.particles.gpuFireflies <= shot.metrics.particles.fireflyCap,
    );
  }
  // Dead-spawn restoration through the actual region lifecycle, isolated saves.
  const killed = await page.evaluate(() => {
    const g = window.__wildsQA.game,
      e = g.enemies.find((e) => !e.boss);
    g.hurtEnemy(e, 1e8, 0);
    return { id: e.id, key: e.respawnKey, deadline: e.respawnDeadline };
  });
  await page.evaluate(() => window.__wildsQA.game.changeRegion('arunika'));
  await ready();
  await page.evaluate(() =>
    window.__wildsQA.game.changeRegion('whispering-wilds-v2'),
  );
  await ready();
  report.reentry = await page.evaluate((killed) => {
    const g = window.__wildsQA.game,
      e = g.enemies.find((e) => e.id === killed.id);
    return {
      total: g.enemies.length,
      dead: e.hp === 0,
      deadline: e.respawnDeadline,
      key: e.respawnKey,
    };
  }, killed);
  assert.equal(report.reentry.total, 273);
  assert(report.reentry.dead);
  assert.equal(report.reentry.deadline, killed.deadline);
  assert.equal(report.reentry.key, killed.key);
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ ...report, errors }, null, 2),
  );
  console.log(
    'PASS 273 enemies, Lv16–24, arena boss, combat and respawn, navigation, cyan grass and GPU-only visible fireflies; no browser errors',
  );
} finally {
  await browser.close();
}
