// Disposable browser storage; no interaction with the player's production save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [], checks = [];
const out = resolve('work/npc-resize'); await mkdir(out, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__npcQA = this; this.renderer = new T.WebGLRenderer') });
});
const ids = { consumable: 'general-merchant', storage: 'storage-keeper', equipment: 'equipment-merchant' };
const check = name => { checks.push(name); console.log('PASS', name); };
async function open(service) {
  assert.ok(await page.evaluate(service => {
    const g = window.__npcQA, npc = g.npcLabels.find(entry => entry.npc.service === service)?.npc;
    if (!npc) return false;
    g.hero.x = npc.x; g.hero.z = npc.z + .5; g.placeActor();
    const result = g.openNpc(npc.id); g.emit(); return result;
  }, service));
  const dialog = page.locator(`[data-window-id="${ids[service] ?? 'npc-menu'}"]:visible`);
  await dialog.waitFor(); await page.waitForTimeout(250); return dialog;
}
async function drag(dialog, edge, dx, dy) {
  const handle = dialog.locator(`[data-window-resize-edge="${edge}"]`);
  const b = await handle.boundingBox(); assert.ok(b);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 });
  await page.mouse.up(); await page.waitForTimeout(150);
}
const layout = () => page.evaluate(() => JSON.parse(localStorage.getItem('lumenfall:ui-layout:v2') ?? '{}').windows ?? {});
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__npcQA?.started);
  await page.evaluate(() => { const g = window.__npcQA; g.hero.gold = 100000; g.emit(); });
  const saved = {};
  for (const [service, id] of Object.entries(ids)) {
    let dialog = await open(service);
    assert.equal(await dialog.locator('[data-window-resize-edge]').count(), 4);
    const initial = await dialog.boundingBox();
    await drag(dialog, 'right', -100, 0);
    assert.ok((await dialog.boundingBox()).width < initial.width - 50);
    await drag(dialog, 'left', -40, 0);
    await drag(dialog, 'bottom', 0, -70);
    await drag(dialog, 'top', 0, 25);
    const resized = await dialog.boundingBox();
    assert.ok(resized.height < initial.height - 50);
    saved[id] = (await layout())[id];
    assert.ok(saved[id].width > 0 && saved[id].height > 0);
    await page.screenshot({ path: resolve(out, `${service}.png`) });
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    dialog = await open(service);
    const reopened = await dialog.boundingBox();
    assert.ok(Math.abs(reopened.width - resized.width) < 2 && Math.abs(reopened.height - resized.height) < 2);
    for (const [otherId, value] of Object.entries(saved)) assert.deepEqual((await layout())[otherId], value);
    check(`${service}: all four resize handles work, and dimensions restore independently`);
    if (service === 'storage') {
      const deposit = dialog.locator('.storage-item').filter({ has: page.locator('button:not(:disabled)').filter({ hasText: /^Simpan$/ }) }).first();
      await deposit.locator('input').fill('1');
      const before = await page.evaluate(() => window.__npcQA.hero.storage.reduce((n, i) => n + i.quantity, 0));
      await deposit.getByRole('button', { name: 'Simpan', exact: true }).click();
      await page.waitForFunction(before => window.__npcQA.hero.storage.reduce((n, i) => n + i.quantity, 0) === before + 1, before);
      const withdraw = dialog.locator('.storage-item').filter({ has: page.getByRole('button', { name: 'Ambil', exact: true }) }).first();
      await withdraw.locator('input').fill('1'); await withdraw.getByRole('button', { name: 'Ambil', exact: true }).click();
      await page.waitForFunction(before => window.__npcQA.hero.storage.reduce((n, i) => n + i.quantity, 0) === before, before);
      check('Storage quantity input, deposit and withdrawal still work after resizing');
    } else {
      const gold = await page.evaluate(() => window.__npcQA.hero.gold);
      await dialog.locator('[data-shop-item]').first().getByRole('button', { name: /^Buy ×/ }).click();
      await page.waitForFunction(gold => window.__npcQA.hero.gold < gold, gold);
      await dialog.getByRole('button', { name: 'Sell', exact: true }).click();
      await dialog.locator('.npc-sell-layout').waitFor();
      check(`${service}: Buy remains functional and Sell is accessible after resizing`);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  }
  const other = await open('healer');
  assert.equal(await other.locator('[data-window-resize-edge]').count(), 0);
  await other.getByRole('button', { name: 'Close', exact: true }).first().click();
  check('Other NPC services keep their previous window behavior');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__npcQA?.started);
  for (const [service, id] of Object.entries(ids)) {
    const dialog = await open(service);
    assert.ok(Math.abs(parseFloat(await dialog.evaluate(el => el.style.width)) - saved[id].width) < 1);
    if (service !== 'consumable') {
      await drag(dialog, 'right', -2000, 0);
      await page.screenshot({ path: resolve(out, `${service}-minimum.png`) });
      const selector = service === 'storage' ? '.storage-item' : '.shop-row';
      assert.ok(await dialog.locator(selector).evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1)), `${service}: item controls must fit the minimum window width`);
      if (service === 'equipment') {
        await dialog.getByRole('button', { name: 'Sell', exact: true }).click();
        await page.screenshot({ path: resolve(out, 'equipment-sell-minimum.png') });
        assert.ok(await dialog.locator('.npc-sell-layout').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Sell columns must fit a narrow window');
      }
      check(`${service}: content remains usable at minimum window width`);
    }
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  }
  check('All three service window sizes survive reload');
  assert.deepEqual(errors, []); check('No browser runtime or console errors');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
