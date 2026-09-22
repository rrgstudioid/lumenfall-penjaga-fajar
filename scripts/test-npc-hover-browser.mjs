// Isolated browser save; this never touches the player's production character.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [];
const out = resolve('work/npc-hover');
await mkdir(out, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__npcHoverQA = this; this.renderer = new T.WebGLRenderer') });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const tooltip = page.locator('.npc-item-tooltip');
async function openNpc(service) {
  assert.ok(await page.evaluate(service => {
    const game = window.__npcHoverQA;
    const npc = game.npcLabels.find(entry => entry.npc.service === service)?.npc;
    if (!npc) return false;
    game.hero.x = npc.x; game.hero.z = npc.z + 0.5; game.placeActor();
    return game.openNpc(npc.id);
  }, service));
  await page.locator(service === 'forge' ? '[data-window-id="panel-forge"]' : '.npc-menu-dialog').waitFor();
}
async function hover(target, text) {
  await target.scrollIntoViewIfNeeded();
  const anchor = await target.boundingBox();
  assert.ok(anchor);
  // Artwork intentionally has pointer-events:none; the containing item row handles hover.
  await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2);
  await tooltip.waitFor();
  assert.equal(await tooltip.count(), 1, 'one tooltip at a time');
  assert.ok((await tooltip.innerText()).includes(text));
  const rect = await tooltip.boundingBox(), viewport = page.viewportSize();
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, 'tooltip stays on screen');
  const foreground = await tooltip.evaluate(element => {
    const dialog = [...document.querySelectorAll('[data-slot="dialog-content"]')].filter(node => node.getBoundingClientRect().width > 0);
    return element.parentElement === (document.fullscreenElement ?? document.body) && dialog.every(node => Number(getComputedStyle(node).zIndex) < Number(getComputedStyle(element).zIndex));
  });
  assert.ok(foreground, 'tooltip is in front of the NPC window');
}
async function close() {
  await page.keyboard.press('Escape');
  await tooltip.waitFor({ state: 'detached' });
  await page.waitForFunction(() => !window.__npcHoverQA.paused);
  assert.equal(await page.locator('.npc-menu-dialog:visible').count(), 0);
}
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__npcHoverQA?.started);
  await page.evaluate(async () => {
    const { createItem, createRuneItem } = await import('/lib/game/items.ts');
    const game = window.__npcHoverQA;
    game.hero.gold = 100000;
    game.hero.inventory.push(createRuneItem('might', 'rare'), createItem('titanium', { quantity: 4 }));
    game.emit();
  });
  for (const service of ['consumable', 'equipment', 'developer-materials']) {
    await openNpc(service);
    const row = page.locator('[data-shop-item]').first();
    const name = await row.locator('strong').first().innerText();
    const before = await page.evaluate(() => JSON.stringify(window.__npcHoverQA.hero));
    await hover(row.locator('[data-item-icon]'), name);
    assert.ok((await tooltip.innerText()).includes('Harga beli:'));
    assert.equal(await page.evaluate(() => JSON.stringify(window.__npcHoverQA.hero)), before, 'hover does not trade or mutate items');
    if (service === 'equipment') {
      assert.match(await tooltip.innerText(), /Syarat:.*Level:.*Harga jual:/s);
      await page.screenshot({ path: resolve(out, 'equipment-hover.png') });
    }
    await close();
    check(`${service}: item details, correct layer, screen bounds, read-only hover, Escape cleanup`);
  }
  await openNpc('consumable');
  await page.getByRole('button', { name: 'Sell', exact: true }).click();
  const sell = page.locator('.sell-row:not(:disabled)').first();
  await hover(sell, await sell.locator('strong').innerText());
  assert.equal(await page.locator('.sell-quantity').count(), 0, 'hover must not select an item for sale');
  const blocked = page.locator('.sell-row:disabled').first();
  await hover(blocked, await blocked.locator('strong').innerText());
  await sell.click();
  await page.locator('.sell-quantity').waitFor();
  assert.ok(await tooltip.count() <= 1);
  await close();
  check('Sell: hover works on sellable and blocked items; click still selects without selling');

  await openNpc('storage');
  const deposit = page.locator('.storage-item').filter({ has: page.getByRole('button', { name: 'Simpan', exact: true }) }).filter({ has: page.locator('[data-item-icon="health-potion-1"]') });
  await hover(deposit, 'Jumlah: 3');
  await deposit.locator('input').fill('1');
  await deposit.getByRole('button', { name: 'Simpan', exact: true }).click();
  const stored = page.locator('.storage-item').filter({ has: page.getByRole('button', { name: 'Ambil', exact: true }) }).first();
  await hover(stored, 'Jumlah: 1');
  await page.screenshot({ path: resolve(out, 'storage-hover.png') });
  await stored.getByRole('button', { name: 'Ambil', exact: true }).click();
  await stored.waitFor({ state: 'detached' });
  await tooltip.waitFor({ state: 'detached' });
  await close();
  check('Storage: inventory and stored instances show correct quantities; deposit/withdraw still work');

  await openNpc('forge');
  await page.locator('[data-forge-choice="enhancement"]').click();
  const equipment = page.locator('[data-forge-item]').first();
  await hover(equipment, 'Level:');
  await hover(page.locator('.forge-material'), 'Bahan');
  await page.locator('.forge-back-button').first().click();
  await page.locator('[data-forge-choice="rune"]').click();
  await page.locator('[data-forge-choice="rune-service"]').click();
  await hover(page.locator('[data-rune-equipment]').first(), 'Level:');
  await hover(page.locator('.rune-inventory-list [data-item-hover]').first(), 'Rune');
  await close();
  check('Forge: equipment, enhancement material and owned Rune show details');

  await openNpc('forge');
  await page.locator('[data-forge-choice="rune"]').click();
  await page.locator('[data-forge-choice="crafting"]').click();
  const recipe = page.locator('[data-forge-recipe]').first();
  await hover(recipe.locator('[data-item-icon]'), 'Optimizer');
  await hover(recipe.locator('small [data-item-hover]'), 'Bahan');
  await close();
  check('Crafting: output and nested ingredient have separate, non-overlapping tooltips');
  assert.deepEqual(errors, []);
  check('No browser runtime or console errors');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
