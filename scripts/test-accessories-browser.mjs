// Isolated browser storage; never reads or changes the player's save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createNewCharacter, SAVE_KEY, equipItem } from '../lib/game/rules.ts';
import { createItem } from '../lib/game/items.ts';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = 'work/accessories';
await mkdir(out, { recursive: true });
const hero = createNewCharacter('slot-1', 'Astra');
hero.level = 35;
for (const id of ['arunika-head', 'arunika-gloves', 'arunika-legs', 'arunika-boots', 'arunika-ring1', 'arunika-ring2', 'arunika-earring1', 'arunika-earring2']) {
  const item = createItem(id);
  hero.inventory.push(item);
  equipItem(hero, item.id);
}
// Test-only fixture uses existing artwork; no wings item enters the catalog.
const wings = createItem('fajar-necklace', {
  id: 'qa-wings', name: 'Test Wings', itemType: 'wings', equipmentType: 'accessory',
  equipSlot: 'accessory', levelRequirement: 1, baseStats: {}, bonusStats: {},
  sockets: [], uniqueStatsLocked: false,
});
hero.inventory.push(wings);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ key, hero }) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
    version: 3, activeSlot: 'slot-1', lastPlayedCharacterId: hero.characterId,
    characters: { 'slot-1': hero },
  }));
}, { key: SAVE_KEY, hero });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__accessoryQA = this; this.renderer = new T.WebGLRenderer',
  ) });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const dashboard = page.locator('[data-character-dashboard]');
const current = () => page.evaluate(() => structuredClone(window.__accessoryQA.hero));
async function enter() {
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__accessoryQA?.started, {}, { timeout: 120000 });
  await page.keyboard.press('c');
  await dashboard.waitFor();
  await page.getByText('Memuat karakter...', { exact: true }).waitFor({ state: 'hidden' });
}
try {
  await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000/');
  await enter();
  assert.equal(await dashboard.locator('[data-equipment-slot]').count(), 14);
  for (const [width, height, scale] of [[1440, 900, 1], [1920, 1080, 1], [1366, 768, 1], [1024, 768, 1], [1366, 768, 1.5]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => {
      document.documentElement.style.setProperty('--lumenfall-ui-scale', String(scale));
      window.dispatchEvent(new Event('lumenfall:interface-scale'));
    }, scale);
    await page.waitForTimeout(400);
    const layout = await dashboard.evaluate(el => ({
      slots: [...el.querySelectorAll('.cs-slot-position')].map(e => e.getBoundingClientRect().toJSON()),
      overflow: [...el.querySelectorAll('.cs-columns,.cs-attributes,.cs-combat')].map(e => e.scrollHeight - e.clientHeight),
    }));
    assert(layout.overflow.every(n => n <= 2), JSON.stringify(layout));
    assert(layout.slots.every(s => s.left >= 0 && s.right <= width && s.top >= 0 && s.bottom <= height));
    for (let i = 0; i < layout.slots.length; i++) for (const b of layout.slots.slice(i + 1)) {
      const a = layout.slots[i];
      assert(!(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top), `Overlapping slots at ${width}, scale ${scale}`);
    }
    await page.screenshot({ path: `${out}/equipment-${width}-${scale}.png` });
    check(`14 slots and labels fit without overlap at ${width}x${height}, scale ${scale}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lumenfall-ui-scale', '1');
    window.dispatchEvent(new Event('lumenfall:interface-scale'));
  });
  const popup = page.locator('.cs-equipment-popup');
  await dashboard.locator('[data-equipment-slot="accessory"]').click();
  assert((await popup.innerText()).includes('Untuk wings dan aksesori tambahan'));
  await popup.locator('.cs-candidate').filter({ hasText: 'Test Wings' }).click();
  assert.equal((await current()).equipment.accessory, null);
  await page.screenshot({ path: `${out}/accessory-preview.png` });
  await popup.getByRole('button', { name: 'Equip', exact: true }).click();
  assert.equal((await current()).equipment.accessory, wings.id);
  assert.equal(await dashboard.locator('[data-equipment-slot="accessory"].is-equipped').count(), 1);
  check('Accessories popup previews and equips the compatible item');
  await page.evaluate(() => window.__accessoryQA.save());
  await page.reload();
  await enter();
  assert.equal((await current()).equipment.accessory, wings.id);
  await dashboard.locator('[data-equipment-slot="accessory"]').click();
  await popup.getByRole('button', { name: 'Unequip', exact: true }).click();
  assert.equal((await current()).equipment.accessory, null);
  assert.equal((await current()).inventory.find(i => i.id === wings.id).isEquipped, false);
  check('Accessory survives save/reload and returns to inventory on unequip');
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
