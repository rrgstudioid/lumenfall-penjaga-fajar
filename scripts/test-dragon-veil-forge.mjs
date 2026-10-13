// Regression for saved Dragon Veil hidden from the Forge list. Private save only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createNewCharacter, equipItem, SAVE_KEY } from '../lib/game/rules.ts';
import { createItem } from '../lib/game/items.ts';
import { buyShopItem } from '../lib/game/city-services.ts';
import { DRAGON_VEIL_PIECES } from '../lib/game/dragon-veil.ts';
import { CITIES } from '../lib/game/regions.ts';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const out = 'work/dragon-veil-forge/after';
await mkdir(out, { recursive: true });
const hero = createNewCharacter('slot-1', 'Dragon Veil Forge QA');
const npc = CITIES.arunika.npcList.find((n) => n.service === 'forge');
hero.inCity = true;
hero.currentCity = 'arunika';
hero.x = npc.x;
hero.z = npc.z + 1;
const ids = [];
for (const piece of DRAGON_VEIL_PIECES) {
  assert(buyShopItem(hero, piece.id, 'developer-materials').ok);
  const ownedId = hero.inventory.find((i) => i.templateId === piece.id).id;
  if (ids.length < 2) assert(equipItem(hero, ownedId).ok);
  const item = hero.inventory.find((i) => i.id === ownedId);
  ids.push(item.id);
}
const wings = createItem('dragon-veil-wings');
hero.inventory.push(createItem('iron', { quantity: 20 }), wings);
assert(equipItem(hero, wings.id).ok);
ids.push(wings.id);
// Inventory operations replace records, so apply the legacy fields last.
for (const id of ids) {
  const item = hero.inventory.find((i) => i.id === id);
  item.maxEnhancementLevel = 0;
  if (item.equipSlot === 'legs') {
    item.templateId = 'dragon-veil-pants';
    item.name = 'Dragon Veil Pants';
  }
}
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
page.setDefaultTimeout(45000);
const errors = [],
  report = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/lib/game/world.ts*', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      'this.renderer = new T.WebGLRenderer',
      'window.__forgeQA=this; this.renderer = new T.WebGLRenderer',
    ),
  });
});
await page.route('**/components/game/character-preview.tsx*', async (route) => {
  const response = await route.fetch();
  await route.fulfill({
    response,
    body: (await response.text()).replace(
      /const model = buildModel\(createCharacterModel,\s*renderer\);/,
      'const model = buildModel(createCharacterModel, renderer); window.__forgePreview=model;',
    ),
  });
});
const forge = page.locator('.forge-panel');
async function enterForge() {
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__forgeQA?.started);
  assert(await page.evaluate((id) => window.__forgeQA.openNpc(id), npc.id));
  await page.locator('[data-forge-choice="enhancement"]').click();
  await forge.waitFor();
}
try {
  await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000/', {
    waitUntil: 'domcontentloaded',
  });
  await enterForge();
  const before = await page.evaluate(() =>
    window.__forgeQA.hero.inventory
      .filter((i) => i.templateId.startsWith('dragon-veil'))
      .map((i) => ({
        id: i.id,
        templateId: i.templateId,
        max: i.maxEnhancementLevel,
        level: i.enhancementLevel,
        category: i.category,
        slot: i.equipSlot,
      })),
  );
  report.push({ before });
  const visible = await forge
    .locator('[data-forge-item]')
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute('data-forge-item')),
    );
  report.push({ visible, missing: ids.filter((id) => !visible.includes(id)) });
  await page.screenshot({ path: `${out}/list.png` });
  assert(
    ids.every((id) => visible.includes(id)),
    'All five saved pieces including Wings must be listed',
  );
  assert(before.filter((i) => ids.includes(i.id)).every((i) => i.max === 12));
  assert(
    visible.includes(
      before.find((i) => i.templateId === 'dragon-veil-wings').id,
    ),
  );
  for (const id of ids) {
    await forge.locator(`[data-forge-item="${id}"]`).click();
    await forge.getByRole('button', { name: /^Tempa \+/ }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Konfirmasi Tempa', exact: true })
      .click();
    await forge.locator('.forge-result.is-success').waitFor();
    const item = await page.evaluate(
      (id) => window.__forgeQA.hero.inventory.find((i) => i.id === id),
      id,
    );
    assert.equal(item.enhancementLevel, 1);
    const original = hero.inventory.find((i) => i.id === id);
    assert.deepEqual(item.baseStats, original.baseStats);
    assert.deepEqual(item.sockets, original.sockets);
    report.push({ enhanced: item.templateId, level: item.enhancementLevel });
  }
  await page.screenshot({ path: `${out}/enhanced.png` });
  await page.waitForFunction(
    () => window.__forgeQA.actor.userData.accessoryStatus === 'ready',
  );
  const worldGlow = await page.evaluate(() => {
    const values = [];
    window.__forgeQA.actor.getObjectByName('DragonVeilWings').traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          values.push(m.userData.equipmentEmissive?.level ?? 0);
    });
    return values;
  });
  assert(worldGlow.length > 0 && worldGlow.every((level) => level === 1));
  await forge.getByRole('button', { name: 'Close Forge', exact: true }).click();
  await page.keyboard.press('c');
  await page.locator('[data-character-dashboard]').waitFor();
  await page.waitForFunction(
    () =>
      window.__forgePreview?.actor.userData.accessoryStatus === 'ready' &&
      window.__forgePreview.actor.userData.modelStatus === 'ready',
  );
  const previewGlow = await page.evaluate(() => {
    const values = [];
    window.__forgePreview.actor
      .getObjectByName('DragonVeilWings')
      .traverse((o) => {
        if (o.isMesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            values.push(m.userData.equipmentEmissive?.level ?? 0);
      });
    return values;
  });
  assert.deepEqual(previewGlow, worldGlow);
  await page.screenshot({ path: `${out}/preview-enhanced.png` });
  report.push({ worldGlow, previewGlow });
  await page.reload();
  await enterForge();
  const saved = await page.evaluate(
    (ids) =>
      window.__forgeQA.hero.inventory
        .filter((i) => ids.includes(i.id))
        .map((i) => ({ id: i.id, level: i.enhancementLevel })),
    ids,
  );
  assert.equal(saved.length, 5);
  assert(saved.every((i) => i.level === 1));
  report.push({ saved });
  const resources = await page.evaluate(() => ({
    equipment: window.__forgeQA.hero.equipment,
    gold: window.__forgeQA.hero.gold,
    iron: window.__forgeQA.hero.inventory
      .filter((i) => i.templateId === 'iron')
      .reduce((sum, i) => sum + i.quantity, 0),
  }));
  assert.deepEqual(resources.equipment, hero.equipment);
  assert.equal(resources.gold, hero.gold);
  assert.equal(resources.iron, 15);
  report.push({ resources });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  `Dragon Veil Forge regression passed: five saved pieces enhanced and persisted, world/preview Wings glow match. Evidence: ${out}`,
);
