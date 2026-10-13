// Regression for the reported legacy "Dragon Veil Pants" identity. Private save only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createNewCharacter, equipItem, SAVE_KEY } from '../lib/game/rules.ts';
import { createItem } from '../lib/game/items.ts';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const out = 'work/dragon-veil-pants/after';
await mkdir(out, { recursive: true });
const hero = createNewCharacter('slot-1', 'Pants regression');
for (const part of ['head', 'armor', 'boots']) {
  const item = createItem(`dragon-veil-${part}`);
  hero.inventory.push(item);
  assert(equipItem(hero, item.id).ok);
}
const pants = createItem('dragon-veil-legs', { id: 'owned-pants-regression' });
pants.templateId = 'dragon-veil-pants';
pants.name = 'Dragon Veil Pants';
hero.inventory.push(pants);
assert(equipItem(hero, pants.id, 'legs').ok);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
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
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  report = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/lib/game/world.ts*', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__pantsGame=this; this.renderer = new T.WebGLRenderer',
    ),
  });
});
await page.route('**/components/game/character-preview.tsx*', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'const model = buildModel(createCharacterModel, renderer);',
      'const model = buildModel(createCharacterModel, renderer); window.__pantsPreview=model; window.__pantsPreviewEquipment={...hero.equipment};',
    ),
  });
});
const dashboard = page.locator('[data-character-dashboard]');
const popup = page.locator('.cs-equipment-popup');
async function enter() {
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__pantsGame?.started &&
      window.__pantsGame.actor.userData.equipmentStatus === 'ready',
    null,
    { timeout: 120000 },
  );
  await page.keyboard.press('c');
  await dashboard.waitFor();
}
async function capture(label, equipped) {
  await page.waitForFunction(
    () => window.__pantsGame.actor.userData.modelStatus === 'ready',
  );
  await page.waitForFunction(
    () =>
      window.__pantsPreview?.actor.userData.modelStatus === 'ready' &&
      !window.__pantsPreview.actor.userData.disposed &&
      window.__pantsPreviewEquipment.legs ===
        window.__pantsGame.hero.equipment.legs,
  );
  const state = await page.evaluate(() => {
    const game = window.__pantsGame,
      pieces = [];
    game.actor.traverse((o) => {
      if (o.userData.dragonVeil) pieces.push(o.userData.templateId);
    });
    const previewPieces = [];
    window.__pantsPreview.actor.traverse((o) => {
      if (o.userData.dragonVeil) previewPieces.push(o.userData.templateId);
    });
    return {
      equipped: game.hero.equipment.legs,
      pieces,
      previewPieces,
      item: game.hero.inventory.find((i) => i.id === 'owned-pants-regression'),
    };
  });
  assert.equal(Boolean(state.equipped), equipped);
  assert.equal(state.pieces.includes('dragon-veil-legs'), equipped);
  assert.equal(state.previewPieces.includes('dragon-veil-legs'), equipped);
  if (equipped) {
    const img = dashboard.locator('[data-equipment-slot="legs"] img');
    await img.evaluate((i) => i.decode());
    state.icon = await img.getAttribute('src');
    assert.match(state.icon, /dragon-veil-legs\.webp/);
  }
  await page.screenshot({ path: `${out}/${label}.png` });
  report.push({ label, ...state });
}
try {
  await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000');
  await enter();
  await capture('equipped', true);
  await dashboard.locator('[data-equipment-slot="legs"]').click();
  await popup.getByRole('button', { name: 'Unequip', exact: true }).click();
  await capture('unequipped', false);
  await page.keyboard.press('c');
  await page.keyboard.press('i');
  await page
    .locator('[data-inventory-index] img')
    .evaluateAll((images) => Promise.all(images.map((i) => i.decode())));
  const itemIcon = page
    .locator('[data-inventory-index] [data-item-icon]')
    .filter({ has: page.locator('img') });
  const inventoryIcons = await itemIcon.evaluateAll((nodes) =>
    nodes.map((n) => ({
      id: n.getAttribute('data-item-icon'),
      src: n.querySelector('img').getAttribute('src'),
    })),
  );
  assert(inventoryIcons.some((i) => i.src.includes('dragon-veil-legs.webp')));
  await page.screenshot({ path: `${out}/inventory.png` });
  report.push({ inventoryIcons });
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await dashboard.locator('[data-equipment-slot="legs"]').click();
  await popup
    .locator('.cs-candidate')
    .filter({ hasText: 'Dragon Veil Pants' })
    .click();
  await page.screenshot({ path: `${out}/candidate-preview.png` });
  await popup.getByRole('button', { name: 'Equip', exact: true }).click();
  await capture('reequipped', true);
  await page.evaluate(() => window.__pantsGame.save());
  await page.reload();
  await enter();
  await capture('reloaded', true);
  for (const slot of ['head', 'chest', 'legs', 'boots', 'mainHand']) {
    await dashboard.locator(`[data-equipment-slot="${slot}"]`).click();
    await popup.getByRole('button', { name: 'Unequip', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__pantsGame.actor.userData.modelStatus === 'ready' &&
        window.__pantsPreview?.actor.userData.modelStatus === 'ready' &&
        JSON.stringify(window.__pantsPreviewEquipment) ===
          JSON.stringify(window.__pantsGame.hero.equipment),
    );
  }
  await capture('all-unequipped-base-clothes', false);
  const base = await page.evaluate(() => {
    const pieces = [],
      hair = [];
    window.__pantsGame.actor.traverse((o) => {
      if (o.userData.dragonVeil) pieces.push(o.userData.templateId);
      if (o.visible && o.userData.assetPath?.startsWith('hair/'))
        hair.push(o.userData.assetPath);
    });
    return { equipment: window.__pantsGame.hero.equipment, pieces, hair };
  });
  assert(Object.values(base.equipment).every((id) => id === null));
  assert.deepEqual(base.pieces, []);
  assert(base.hair.length > 0);
  report.push({ base });
  await page.keyboard.press('c');
  await page.locator('.game-dialog').waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    const g = window.__pantsGame;
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
      yaw: Math.PI,
      targetYaw: Math.PI,
    });
    g.updateCamera(0);
  });
  await page.screenshot({ path: `${out}/all-unequipped-world.png` });
  await page.evaluate(() => window.__pantsGame.save());
  await page.reload();
  await enter();
  await capture('all-unequipped-reloaded', false);
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  `Pants regression passed, including base clothes after unequip/save-load: ${out}`,
);
