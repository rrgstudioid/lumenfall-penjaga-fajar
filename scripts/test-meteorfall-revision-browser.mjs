// Actual app UI, memory-only fixture, private browser: no owner save access.
import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'work/meteorfall-citadel/revision3/ui';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(60000);
const errors = [],
  checks = [],
  hunting = [];
let state;
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const check = (name, condition = true) => {
  assert(condition, name);
  checks.push(name);
  console.log('PASS', name);
};
const ready = () =>
  page.waitForFunction(
    () =>
      window.__meteorfallQA?.game?.started &&
      !window.__meteorfallQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
const pieces = [
  ['legs', 'Dragon Veil Legs'],
  ['boots', 'Dragon Veil Boots'],
  ['head', 'Dragon Veil Head'],
  ['chest', 'Dragon Veil Armor'],
];
async function icon(scope, id) {
  const img = scope
    .locator(`[data-item-icon="${id}"] img, img[data-item-icon="${id}"]`)
    .first();
  await img.waitFor();
  await img.evaluate((i) => i.decode());
  assert.equal(
    await img.getAttribute('src'),
    `/assets/icons/items/${id}.webp?v=2`,
  );
  assert.equal(await img.evaluate((i) => i.naturalWidth), 256);
}
try {
  await page.goto('http://127.0.0.1:3006/meteorfall-citadel.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  await page.evaluate(() => window.__meteorfallQA.game.changeRegion('arunika'));
  await ready();
  assert(
    await page.evaluate(() => {
      const g = window.__meteorfallQA.game;
      Object.assign(g.hero, { x: 18, z: -33, gold: 0 });
      g.placeActor();
      g.pause(false);
      return g.openNpc('aruna-developer-materials');
    }),
  );
  for (const [slot] of pieces) {
    const id = `dragon-veil-${slot === 'chest' ? 'armor' : slot}`,
      row = page.locator(`[data-shop-item="${id}"]`);
    await row.scrollIntoViewIfNeeded();
    await icon(row, id);
    assert.match(await row.innerText(), /0\s*GOLD/);
    await row.getByRole('button', { name: /^Buy/ }).click();
    await page.waitForFunction(
      (id) =>
        window.__meteorfallQA.game.hero.inventory.some(
          (i) => i.templateId === id,
        ),
      id,
    );
  }
  check('Four restored Dragon Veil pieces and real icons bought for 0 GOLD');
  await page.screenshot({ path: `${out}/developer-shop.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  const dashboard = page.locator('[data-character-dashboard]'),
    popup = page.locator('.cs-equipment-popup');
  await dashboard.waitFor();
  assert.equal(
    await dashboard.locator('[data-equipment-slot="gloves"]').count(),
    0,
  );
  assert.equal(await dashboard.locator('[data-equipment-slot]').count(), 13);
  for (const [slot, name] of pieces) {
    await dashboard.locator(`[data-equipment-slot="${slot}"]`).click();
    await popup.locator('.cs-candidate').filter({ hasText: name }).click();
    await popup.getByRole('button', { name: 'Equip', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__meteorfallQA.game.actor.userData.equipmentStatus === 'ready',
    );
    await icon(
      dashboard.locator(`[data-equipment-slot="${slot}"]`),
      `dragon-veil-${slot === 'chest' ? 'armor' : slot}`,
    );
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/character-four-pieces-no-gloves.png` });
  check(
    'Character UI has 13 slots, no Gloves, and equips all four pieces independently',
  );
  const saved = await page.evaluate(() => {
    const { game: g, rules } = window.__meteorfallQA;
    g.save();
    const loaded = rules.parseSave(JSON.stringify(g.hero));
    return {
      equipped: g.hero.equipment,
      parsed: loaded.equipment,
      gold: g.hero.gold,
      wings: rules.createItem('dragon-veil-wings'),
    };
  });
  assert.deepEqual(saved.parsed, saved.equipped);
  assert.equal(saved.gold, 0);
  assert.equal(saved.wings.enhancementLevel, 0);
  check(
    'Equipment save parsing retains four owned items; fresh Wings stays +0',
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await page
    .getByRole('button', { name: 'Enter Meteorfall Citadel', exact: true })
    .click();
  await ready();
  await page.waitForFunction(
    () =>
      window.__meteorfallQA.game.meteorfall &&
      window.__meteorfallQA.game.actor.userData.equipmentStatus === 'ready',
  );
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    g.invincible = Infinity;
    g.pause(false);
    Object.assign(g.hero, { x: 0, z: 380 });
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    Object.assign(g.followView, {
      distance: 10,
      targetDistance: 10,
      pitch: 0.6,
      targetPitch: 0.6,
      yaw: 0,
      targetYaw: 0,
    });
  });
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({
    x: window.__meteorfallQA.game.hero.x,
    z: window.__meteorfallQA.game.hero.z,
  }));
  await page.keyboard.down('w');
  await page.waitForTimeout(2200);
  await page.keyboard.up('w');
  state = await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    return {
      x: g.hero.x,
      z: g.hero.z,
      enemies: g.enemies.length,
      metrics: g.meteorfall.metrics(),
      status: g.actor.userData.equipmentStatus,
    };
  });
  console.log(JSON.stringify(state));
  check(
    'WASD with Dragon Veil leaves pooled magma footprints in the 294-enemy map',
    state.enemies === 294 &&
      state.metrics.footprints > 4 &&
      state.metrics.footprints <= 128 &&
      Math.hypot(state.x - before.x, state.z - before.z) > 4 &&
      state.status === 'ready',
  );
  await page.screenshot({ path: `${out}/magma-road-and-footsteps.png` });
  // Freeze simulation and show the newest prints without the actor occluding them.
  await page.evaluate(() => {
    const { game: g, three: T } = window.__meteorfallQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    const camera = new T.PerspectiveCamera(50, 1440 / 1000, 0.1, 3000);
    camera.position.set(g.hero.x + 4, g.actor.position.y + 7, g.hero.z + 9);
    camera.lookAt(g.hero.x, g.actor.position.y, g.hero.z + 3);
    camera.updateMatrixWorld();
    g.meteorfall.update(camera, g.hero, 0, false);
    g.renderer.render(g.scene, camera);
  });
  await page.screenshot({ path: `${out}/footprints-close.png` });
  const faded = await page.evaluate(() => {
    const g = window.__meteorfallQA.game;
    for (let i = 0; i < 400; i++)
      g.meteorfall.update(g.camera, g.hero, 1 / 60, false);
    const count = g.meteorfall.metrics().footprints;
    g.lastTime = performance.now();
    g.tick(performance.now());
    return count;
  });
  check(
    'Stationary footprints cool and fully expire without spawning more',
    faded === 0,
  );
  for (const quality of ['office', 'light']) {
    await page.evaluate((quality) => {
      const g = window.__meteorfallQA.game;
      g.setGraphicsQuality(quality, false);
      Object.assign(g.hero, { x: 0, z: 50 });
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
    }, quality);
    await page.waitForTimeout(1200);
    await page.evaluate(() =>
      window.__meteorfallQA.game.renderPerformance.reset(),
    );
    await page.keyboard.down('w');
    await page.waitForTimeout(4200);
    await page.keyboard.up('w');
    const sample = await page.evaluate(() => {
      const g = window.__meteorfallQA.game;
      return {
        ...g.getPerformanceDiagnostics(),
        nearbyMonsters: g.enemies.filter(
          (e) =>
            e.hp > 0 &&
            Math.hypot(
              e.group.position.x - g.hero.x,
              e.group.position.z - g.hero.z,
            ) < 100,
        ).length,
        centralVisible: g.enemies.filter(e => e.id >= 424 && e.id < 448 && e.hp > 0 && e.group.visible).length,
      };
    });
    hunting.push(sample);
    console.log('HUNT', JSON.stringify(sample));
    check(
      `${sample.qualityLabel} central hunting + Dragon Veil + moving footprints frame target`,
      sample.nearbyMonsters >= 20 &&
        sample.centralVisible > 0 &&
        sample.frameMs.p95 <= (quality === 'office' ? 33.3 : 25),
    );
    await page.screenshot({ path: `${out}/hunting-${quality}.png` });
  }
  assert.deepEqual(errors, []);
  check('No unexpected runtime or shader errors');
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors, state, hunting }, null, 2),
  );
  await browser.close();
}
