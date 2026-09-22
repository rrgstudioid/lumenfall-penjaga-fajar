import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [];
const out = resolve('work/pause');
await mkdir(out, { recursive: true });

page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__pauseQA = this; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});

const check = name => { checks.push(name); console.log('PASS', name); };
const gameState = () => page.evaluate(() => ({ paused: window.__pauseQA.paused, started: window.__pauseQA.started }));
const closeDialog = dialog => dialog.locator('[data-slot="dialog-close"]').click();

try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__pauseQA?.started);
  assert.deepEqual(await gameState(), { paused: false, started: true });
  check('Adventure starts unpaused');

  await page.getByRole('button', { name: 'Pengaturan dan jeda' }).click();
  const pause = page.locator('[data-window-id="panel-pause"]:visible');
  await pause.waitFor();
  assert.equal((await gameState()).paused, true);
  check('Opening System Menu pauses the world');

  const pausedPosition = await page.evaluate(() => ({ x: window.__pauseQA.hero.x, z: window.__pauseQA.hero.z }));
  await page.evaluate(() => window.__pauseQA.setMove('w', true));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__pauseQA.setMove('w', false));
  const pausedAfterInput = await page.evaluate(() => ({ x: window.__pauseQA.hero.x, z: window.__pauseQA.hero.z }));
  assert.deepEqual(pausedAfterInput, pausedPosition);
  check('Movement stays stopped while paused');

  await pause.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => !window.__pauseQA.paused);
  check('Continue resumes the world');

  const movingPosition = await page.evaluate(() => ({ x: window.__pauseQA.hero.x, z: window.__pauseQA.hero.z }));
  await page.evaluate(() => window.__pauseQA.setMove('w', true));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__pauseQA.setMove('w', false));
  const movedPosition = await page.evaluate(() => ({ x: window.__pauseQA.hero.x, z: window.__pauseQA.hero.z }));
  assert.ok(Math.hypot(movedPosition.x - movingPosition.x, movedPosition.z - movingPosition.z) > 0.01);
  check('Movement resumes after Continue');

  await page.getByRole('button', { name: 'Lihat karakter' }).click();
  const character = page.locator('[data-window-id="panel-character"]:visible');
  await character.waitFor();
  assert.equal((await gameState()).paused, true);
  check('Opening Character Overview pauses the world');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__pauseQA.paused);
  assert.equal(await character.count(), 0);
  check('Escape closes Character Overview and resumes the world');

  await page.evaluate(() => {
    const g = window.__pauseQA;
    const npc = g.npcLabels.find(entry => entry.npc.service === 'consumable')?.npc;
    g.hero.x = npc.x; g.hero.z = npc.z + 0.5; g.placeActor();
    g.openNpc(npc.id);
  });
  const npc = page.locator('[data-window-id="general-merchant"]:visible');
  await npc.waitFor();
  assert.equal((await gameState()).paused, true);
  check('Opening an NPC panel pauses the world');
  await page.mouse.click(30, 30);
  await page.waitForTimeout(120);
  assert.equal(await npc.count(), 1);
  check('NPC panel is not dismissed by an outside click');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__pauseQA.paused);
  assert.equal(await npc.count(), 0);
  assert.equal(await page.locator('[data-window-id="npc-menu"]:visible').count(), 0);
  check('Escape closes the NPC panel and resumes the world');

  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
