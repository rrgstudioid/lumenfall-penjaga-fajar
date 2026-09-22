import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [];
const out = resolve('work/stamina');
await mkdir(out, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer',
    'window.__staminaQA = this; this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const sample = () => page.evaluate(() => {
  const g = window.__staminaQA;
  return { x: g.hero.x, z: g.hero.z, t: g.elapsed, stamina: g.stamina, animation: window.__motionQA };
});
const speed = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) / (b.t - a.t);

try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__staminaQA?.started && !window.__staminaQA.paused);
  await page.evaluate(() => {
    const g = window.__staminaQA;
    g.stamina = g.hero.stamina = 0;
    g.hero.x = g.hero.z = 0; g.placeActor();
    const animator = g.characterModel.animator;
    const update = animator.update.bind(animator);
    animator.update = (dt, motion) => { window.__motionQA = motion; return update(dt, motion); };
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  assert.equal(await page.locator('.stamina-line, .player-resource-bar.stamina').count(), 0);
  assert.equal(await page.locator('.player-resource-bar.hp, .player-resource-bar.mana').count(), 2);
  check('Only HP and Mana bars remain; no stamina HUD');

  await page.keyboard.down('w');
  await page.waitForFunction(() => window.__motionQA?.moving);
  const walkStart = await sample();
  await page.waitForTimeout(650);
  const walkEnd = await sample();
  assert.equal(walkEnd.animation.sprinting, false);
  const walkSpeed = speed(walkStart, walkEnd);
  assert.ok(walkSpeed > 0);
  check('WASD walking and walk animation work at zero stamina');

  await page.keyboard.down('Shift');
  await page.waitForFunction(() => window.__motionQA?.sprinting);
  const runStart = await sample();
  await page.waitForTimeout(900);
  const runEnd = await sample();
  assert.equal(runEnd.stamina, 0);
  assert.ok(Math.abs(speed(runStart, runEnd) / walkSpeed - 1.58) < 0.025);
  assert.equal(runEnd.animation.sprinting, true);
  check('Shift sprint works at zero stamina with the unchanged 1.58 speed multiplier');

  await page.evaluate(() => { window.__staminaQA.stamina = window.__staminaQA.hero.stamina = 5; });
  const heldStart = await sample();
  await page.waitForFunction(t => window.__staminaQA.elapsed - t > 2, heldStart.t);
  const heldEnd = await sample();
  assert.equal(heldEnd.stamina, 5);
  assert.equal(heldEnd.animation.sprinting, true);
  assert.ok(Math.abs(speed(heldStart, heldEnd) / walkSpeed - 1.58) < 0.025);
  check('Holding sprint never drains stamina or triggers exhaustion');

  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__motionQA?.moving && !window.__motionQA.sprinting);
  const releasedStart = await sample();
  await page.waitForTimeout(650);
  const releasedEnd = await sample();
  assert.ok(Math.abs(speed(releasedStart, releasedEnd) / walkSpeed - 1) < 0.025);
  assert.equal(releasedEnd.stamina, 5);
  await page.keyboard.up('w');
  check('Releasing Shift restores the original walk speed; stamina recovery is also inactive');

  await page.getByRole('button', { name: 'Lihat karakter' }).click();
  const character = page.locator('[data-window-id="panel-character"]:visible');
  await character.waitFor();
  assert.equal(await character.locator('.co-vitals > div').count(), 2);
  assert.doesNotMatch(await character.locator('.co-vitals').innerText(), /stamina/i);
  assert.equal(await page.evaluate(() => window.__staminaQA.paused), true);
  await page.screenshot({ path: resolve(out, 'character-without-stamina.png') });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__staminaQA.paused);
  check('Character panel shows HP/Mana; pause and Escape resume still work');

  await page.evaluate(() => window.__staminaQA.save());
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__staminaQA?.started);
  assert.equal((await sample()).stamina, 5);
  check('Reload preserves the existing character and legacy stamina value');
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors, walkSpeed }, null, 2));
} finally {
  await browser.close();
}
