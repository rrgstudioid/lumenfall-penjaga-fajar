// Runs in a private browser context; never writes to the player's browser save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createNewCharacter, SAVE_KEY } from '../lib/game/rules.ts';
import { DRAGON_VEIL_PIECES } from '../lib/game/dragon-veil.ts';
import { CITIES } from '../lib/game/regions.ts';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const out = 'work/dragon-veil/ui';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const hero = createNewCharacter('slot-1', 'Dragon Veil');
hero.gold = 0;
await context.addInitScript(
  ({ key, hero }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          activeSlot: 'slot-1',
          lastPlayedCharacterId: hero.characterId,
          characters: { 'slot-1': hero },
        }),
      );
  },
  { key: SAVE_KEY, hero },
);
const page = await context.newPage(),
  errors = [],
  failures = [],
  checks = [];
page.setDefaultTimeout(60000);
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
});
await page.route('**/lib/game/world.ts*', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__dvGame=this; this.renderer = new T.WebGLRenderer',
    ),
  });
});
const check = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const current = () =>
  page.evaluate(() => structuredClone(window.__dvGame.hero));
const dashboard = page.locator('[data-character-dashboard]'),
  popup = page.locator('.cs-equipment-popup');
async function enter() {
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__dvGame?.started, null, {
    timeout: 120000,
  });
}
async function icon(scope, id) {
  const img = scope
    .locator(`[data-item-icon="${id}"] img, img[data-item-icon="${id}"]`)
    .first();
  await img.waitFor();
  await img.evaluate((img) => img.decode());
  assert.equal(
    await img.getAttribute('src'),
    `/assets/icons/items/${id}.webp?v=2`,
  );
  assert(
    await img.evaluate(
      (img) => img.naturalWidth === 256 && img.naturalHeight === 256,
    ),
  );
}
try {
  await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000');
  await enter();
  const npc = CITIES.arunika.npcList.find(
    (n) => n.id === 'aruna-developer-materials',
  );
  assert(
    await page.evaluate((n) => {
      const g = window.__dvGame;
      g.hero.x = n.x;
      g.hero.z = n.z + 1.7;
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.pause(false);
      return g.openNpc(n.id);
    }, npc),
  );
  for (const p of DRAGON_VEIL_PIECES) {
    const row = page.locator(`[data-shop-item="${p.id}"]`);
    await row.scrollIntoViewIfNeeded();
    assert.match(await row.innerText(), /0\s*GOLD/);
    await icon(row, p.id);
    await row.getByRole('button', { name: /^Buy/ }).click();
    await page.waitForFunction(
      (id) => window.__dvGame.hero.inventory.some((i) => i.templateId === id),
      p.id,
    );
  }
  await page.screenshot({ path: `${out}/developer-shop.png` });
  assert.equal((await current()).gold, 0);
  check('Four real GLB icons and free purchases in Developer Material Lab');
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  for (const p of DRAGON_VEIL_PIECES)
    await icon(
      page
        .locator(`[data-inventory-index]`)
        .filter({ has: page.locator(`[data-item-icon="${p.id}"]`) }),
      p.id,
    );
  await page.screenshot({ path: `${out}/inventory.png` });
  check('All four inventory slot images load at their real display size');
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await dashboard.waitFor();
  assert.equal(
    await dashboard.locator('[data-equipment-slot="gloves"]').count(),
    0,
  );
  for (const p of [
    DRAGON_VEIL_PIECES[2],
    DRAGON_VEIL_PIECES[3],
    DRAGON_VEIL_PIECES[0],
    DRAGON_VEIL_PIECES[1],
  ]) {
    await dashboard.locator(`[data-equipment-slot="${p.slot}"]`).click();
    await popup.locator('.cs-candidate').filter({ hasText: p.name }).click();
    await popup.getByRole('button', { name: 'Equip', exact: true }).click();
    await page.waitForFunction(
      () => window.__dvGame.actor.userData.equipmentStatus === 'ready',
    );
    if (p.slot === 'legs' || p.slot === 'boots') {
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${out}/${p.slot === 'legs' ? 'legs-only' : 'legs-and-boots'}.png`,
      });
    }
  }
  const visibleHair = await page.evaluate(() => {
    const g = window.__dvGame,
      paths = [];
    g.actor.traverse((o) => {
      if (o.visible && o.userData.assetPath?.startsWith('hair/'))
        paths.push(o.userData.assetPath);
    });
    return { paths, selected: g.hero.appearance.hairStyleId };
  });
  assert(visibleHair.paths.some((p) => p.includes(visibleHair.selected)));
  for (const p of DRAGON_VEIL_PIECES)
    await icon(dashboard.locator(`[data-equipment-slot="${p.slot}"]`), p.id);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/character-equipped.png` });
  check(
    'Four independent equipment slots, Male V2 preview, and no Gloves slot',
  );
  await page.keyboard.press('c');
  await page.evaluate(() => {
    const g = window.__dvGame;
    g.hero.x = 0;
    g.hero.z = 7;
    g.placeActor();
    g.actor.rotation.y = 0;
    g.cameraFocus.copy(g.actor.position);
    Object.assign(g.followView, {
      distance: 5.8,
      targetDistance: 5.8,
      pitch: 0.15,
      targetPitch: 0.15,
    });
  });
  for (const [view, yaw] of [
    ['front', Math.PI],
    ['back', 0],
    ['side', Math.PI / 2],
    ['quarter', 2.4],
  ]) {
    await page.evaluate((yaw) => {
      const g = window.__dvGame;
      g.followView.yaw = yaw;
      g.followView.targetYaw = yaw;
      g.updateCamera(0);
    }, yaw);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/world-${view}.png` });
  }
  const equipped = (await current()).equipment;
  await page.evaluate(() => window.__dvGame.save());
  await page.reload();
  await enter();
  await page.waitForFunction(
    () => window.__dvGame.actor.userData.equipmentStatus === 'ready',
  );
  assert.deepEqual((await current()).equipment, equipped);
  await page.keyboard.press('c');
  await dashboard.waitFor();
  for (const p of DRAGON_VEIL_PIECES) {
    await icon(dashboard.locator(`[data-equipment-slot="${p.slot}"]`), p.id);
    await dashboard.locator(`[data-equipment-slot="${p.slot}"]`).click();
    await popup.getByRole('button', { name: 'Unequip', exact: true }).click();
    await page.waitForFunction(
      () => window.__dvGame.actor.userData.equipmentStatus === 'ready',
    );
    assert.equal((await current()).equipment[p.slot], null);
  }
  await page.screenshot({ path: `${out}/character-unequipped.png` });
  check(
    'Save/reload preserves models/icons; individual unequip restores base body and hair',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  await dashboard.locator('[data-equipment-slot="head"]').click();
  await popup
    .locator('.cs-candidate')
    .filter({ hasText: 'Dragon Veil Head' })
    .click();
  await popup.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.evaluate(() => window.__dvGame.save());
  await page.route('**/equipment/dragon-veil/head-lod*.glb*', (r) =>
    r.fulfill({ status: 503, body: 'Injected UI QA failure' }),
  );
  await page.reload();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page
    .getByText('Model Dragon Veil gagal dimuat.', { exact: false })
    .waitFor();
  await page.screenshot({ path: `${out}/startup-error.png` });
  assert(
    failures.length > 0 &&
      failures.every(
        (f) => f.startsWith('503 ') && f.includes('/dragon-veil/head-lod'),
      ),
  );
  failures.length = 0;
  await page.unroute('**/equipment/dragon-veil/head-lod*.glb*');
  await enter();
  await page.waitForFunction(
    () => window.__dvGame.actor.userData.equipmentStatus === 'ready',
  );
  await page.route('**/equipment/dragon-veil/armor-lod*.glb*', (r) =>
    r.fulfill({ status: 503, body: 'Injected preview QA failure' }),
  );
  await page.keyboard.press('c');
  await dashboard.waitFor();
  await dashboard.locator('[data-equipment-slot="chest"]').click();
  await popup
    .locator('.cs-candidate')
    .filter({ hasText: 'Dragon Veil Armor' })
    .click();
  await popup.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.waitForFunction(
    () => window.__dvGame.actor.userData.equipmentStatus === 'error',
  );
  const retryButton = dashboard.getByRole('button', {
    name: 'Coba lagi',
    exact: true,
  });
  await retryButton.waitFor();
  await page.screenshot({ path: `${out}/load-error.png` });
  assert(
    failures.length > 0 &&
      failures.every(
        (f) => f.startsWith('503 ') && f.includes('/dragon-veil/armor-lod'),
      ),
  );
  failures.length = 0;
  await page.unroute('**/equipment/dragon-veil/armor-lod*.glb*');
  await retryButton.click();
  await retryButton.waitFor({ state: 'hidden' });
  await dashboard.locator('[data-equipment-slot="chest"]').click();
  await popup.getByRole('button', { name: 'Unequip', exact: true }).click();
  await dashboard.locator('[data-equipment-slot="chest"]').click();
  await popup
    .locator('.cs-candidate')
    .filter({ hasText: 'Dragon Veil Armor' })
    .click();
  await popup.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.waitForFunction(
    () => window.__dvGame.actor.userData.equipmentStatus === 'ready',
  );
  check(
    'Injected 503 shows a world message and preview retry; both recover without losing equipment',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.error(e);
  process.exitCode = 1;
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors, failures }, null, 2),
  );
  await browser.close();
}
