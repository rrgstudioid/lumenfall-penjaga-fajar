// Test-only world/preview handles in a disposable browser; player saves are untouched.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), errors = [], checks = [];
const out = resolve('work/sword-grip'); await mkdir(out, { recursive: true });
page.on('pageerror', error => errors.push(error.message));
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__swordQA = this; this.renderer = new T.WebGLRenderer') });
});
await page.route('**/components/game/character-preview.tsx*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('const model = buildModel(createCharacterModel);', 'const model = buildModel(createCharacterModel); window.__swordPreview = model;') });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const gripState = preview => page.evaluate(preview => {
  const m = preview ? window.__swordPreview : window.__swordQA.characterModel;
  const grip = m.actor.getObjectByName('SwordGrip').getWorldPosition(m.actor.position.clone());
  const tip = m.actor.getObjectByName('SwordTip').getWorldPosition(grip.clone());
  const hand = m.rig.rightHand.getWorldPosition(grip.clone());
  const forward = grip.clone().set(0, 0, -1).applyQuaternion(m.actor.quaternion);
  return { gap: grip.distanceTo(hand), forward: tip.sub(grip).normalize().dot(forward) };
}, preview);
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__swordQA?.started);
  await page.evaluate(() => {
    const g = window.__swordQA;
    g.setCameraMode('follow');
    Object.assign(g.followView, { targetYaw: Math.PI / 2 + .3, yaw: Math.PI / 2 + .3, targetPitch: .18, pitch: .18, targetDistance: 5, distance: 5 });
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(250);
  assert.ok((await gripState(false)).forward > .98);
  assert.ok((await gripState(false)).gap < 1e-6);
  await page.screenshot({ path: resolve(out, 'idle-side.png') });
  check('Equipped sword points forward with its handle centred in the palm');
  for (const sprint of [false, true]) {
    if (sprint) await page.keyboard.down('Shift');
    await page.keyboard.down('w'); await page.waitForTimeout(350);
    const pose = await gripState(false);
    assert.ok(pose.gap < 1e-6 && pose.forward > .45);
    await page.keyboard.up('w'); if (sprint) await page.keyboard.up('Shift');
  }
  check('Walking and running keep the sword attached and ahead of the character');
  await page.evaluate(() => {
    const g = window.__swordQA; g.attackTimer = 0; g.attack(true);
    g.paused = true; g.characterModel.animator.update(.15);
  });
  assert.ok((await gripState(false)).gap < 1e-6);
  await page.screenshot({ path: resolve(out, 'attack.png') });
  await page.evaluate(() => { const g = window.__swordQA; g.paused = false; g.characterModel.animator.reset(); });
  check('The actual attack keeps the handle in the moving hand');
  await page.getByRole('button', { name: 'Lihat karakter' }).click();
  await page.getByRole('tab', { name: 'Equipment', exact: true }).click();
  await page.waitForFunction(() => window.__swordPreview?.animator);
  await page.waitForTimeout(200);
  const preview = await gripState(true);
  assert.ok(preview.gap < 1e-6 && preview.forward > .98);
  await page.screenshot({ path: resolve(out, 'equipment-preview.png') });
  check('Equipment preview uses the same forward-facing sword grip');
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
