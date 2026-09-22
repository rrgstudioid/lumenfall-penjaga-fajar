// Browser regression for the Arunika developer material shop.
// Uses an isolated profile and a temporary QA hook; it never touches the player's save.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CITIES } from '../lib/game/regions.ts';
import { freshHero, SAVE_KEY } from '../lib/game/rules.ts';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const hero = freshHero();
hero.characterName = 'Developer Shop QA';
hero.inCity = true;
hero.currentCity = 'arunika';
hero.level = 50;
hero.gold = 0;
hero.inventoryCapacity = 160;
await context.addInitScript(({ key, seededHero }) => {
  localStorage.setItem(key, JSON.stringify({ version: 3, activeSlot: 'slot-1', characters: { 'slot-1': seededHero } }));
}, { key: SAVE_KEY, seededHero: hero });

const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__developerShopQA = this; this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});

try {
  await page.goto(process.env.GAME_URL ?? 'http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Lanjutkan perjalanan', exact: true }).click();
  await page.waitForFunction(() => window.__developerShopQA?.started);
  const npc = CITIES.arunika.npcList.find(entry => entry.id === 'aruna-developer-materials');
  assert.ok(npc);
  await page.evaluate(npcData => {
    const game = window.__developerShopQA;
    game.hero.x = npcData.x;
    game.hero.z = npcData.z + 1.7;
    game.placeActor();
    game.cameraFocus.copy(game.actor.position);
    game.pause(false);
  }, npc);
  const opened = await page.evaluate(id => window.__developerShopQA.openNpc(id), npc.id);
  assert.equal(opened, true);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Developer Material Lab', exact: true }).waitFor();
  const firstMaterial = await page.evaluate(() => {
    const game = window.__developerShopQA;
    const row = document.querySelector('[data-shop-item]');
    return { id: row?.getAttribute('data-shop-item'), gold: game.hero.gold, text: row?.textContent ?? '' };
  });
  assert.ok(firstMaterial.id);
  assert.match(firstMaterial.text, /0\s*GOLD/);
  await dialog.locator(`[data-shop-item="${firstMaterial.id}"]`).getByRole('button', { name: 'Buy', exact: true }).click();
  const result = await page.evaluate(id => ({ gold: window.__developerShopQA.hero.gold, owned: window.__developerShopQA.hero.inventory.some(item => item.templateId === id) }), firstMaterial.id);
  assert.equal(result.gold, 0);
  assert.equal(result.owned, true);
  await dialog.locator('[data-shop-item="gold-of-midas"]').getByRole('button', { name: 'Buy', exact: true }).click();
  await page.waitForFunction(() => window.__developerShopQA.hero.inventory.some(item => item.templateId === 'gold-of-midas'));
  await dialog.getByRole('button', { name: 'Sell', exact: true }).click();
  await dialog.locator('.sell-row').first().waitFor();
  await dialog.locator('.sell-row').filter({ hasText: 'Gold of Midas' }).click();
  await dialog.getByRole('button', { name: 'Jual', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__developerShopQA.hero.gold), 999999999);
  assert.equal(await page.evaluate(() => window.__developerShopQA.hero.inventory.some(item => item.templateId === 'gold-of-midas')), false);
  assert.deepEqual(errors, []);
  console.log('PASS Developer Material Lab browser flow');
} finally {
  await browser.close();
}
