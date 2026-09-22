// Disposable browser storage. The QA handle is injected into local responses only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out = resolve('work/camera-modes');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__cameraQA = this; this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const state = () => page.evaluate(() => {
  const g = window.__cameraQA;
  return { mode: g.cameraMode, perspective: Boolean(g.camera.isPerspectiveCamera), fov: g.camera.fov, aspect: g.camera.aspect,
    yaw: g.yaw, free: { ...g.cameraZoom }, follow: { ...g.followView }, position: g.camera.position.toArray(),
    actor: g.actor.position.toArray(), facing: g.actor.rotation.y, shake: g.impactShakeRemaining };
});
const switchMode = () => page.getByRole('button', { name: /^Kamera (Free|Follow) aktif/ }).click();
async function settle() {
  await page.waitForFunction(() => {
    const g = window.__cameraQA, v = g.followView;
    return Math.abs(v.distance - v.targetDistance) < .01 && Math.abs(v.pitch - v.targetPitch) < .001
      && Math.abs(Math.atan2(Math.sin(v.yaw - v.targetYaw), Math.cos(v.yaw - v.targetYaw))) < .00001;
  });
}
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__cameraQA?.started);
  const initialCamera = await state();
  assert.equal(initialCamera.mode, 'follow');
  assert.equal(initialCamera.perspective, true);
  assert.equal(initialCamera.fov, 45);
  assert.ok(Math.abs(initialCamera.follow.yaw - initialCamera.facing) < .01);
  await switchMode();
  assert.equal((await state()).mode, 'free');
  await page.evaluate(() => window.__cameraQA.returnToCharacterSelection());
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__cameraQA?.started);
  assert.equal((await state()).mode, 'follow');
  check('New and returning characters enter gameplay in third-person Follow even after choosing Free');
  await switchMode();
  // City is safe; avoid the invulnerability blink hiding the character in captures.
  await page.evaluate(() => { window.__cameraQA.invincible = 0; });
  await page.mouse.move(820, 420);
  await page.mouse.wheel(0, 50000);
  await page.waitForFunction(() => Math.abs(window.__cameraQA.cameraZoom.distance - 15) < .001);
  const farFree = await state();
  assert.equal(farFree.free.targetFraming, 0);
  assert.ok(farFree.free.halfHeight <= 15.001);
  await page.mouse.wheel(0, -50000);
  await page.waitForFunction(() => Math.abs(window.__cameraQA.cameraZoom.distance - 1.15) < .001);
  await page.mouse.wheel(0, 50000);
  await page.waitForFunction(() => Math.abs(window.__cameraQA.cameraZoom.distance - 15) < .001);
  check('Free zoom-out stops at 15 (previously 30), while face close-up remains 1.15');
  await page.mouse.wheel(0, -100);
  await page.waitForFunction(() => Math.abs(window.__cameraQA.cameraZoom.currentFraming - window.__cameraQA.cameraZoom.targetFraming) < .00001);
  const free = await state();
  assert.equal(free.mode, 'free'); assert.equal(free.perspective, false);
  await page.screenshot({ path: resolve(out, 'free.png') });
  check('Free retains the original orthographic camera and wheel progression');

  await switchMode();
  await page.waitForTimeout(350);
  const follow = await state();
  assert.equal(follow.mode, 'follow'); assert.equal(follow.perspective, true); assert.equal(follow.fov, 45);
  assert.ok(Math.abs(follow.follow.yaw - follow.facing) < .01);
  assert.ok(follow.position[1] > follow.actor[1] + 2);
  assert.equal(follow.free.targetFraming, free.free.targetFraming);
  assert.ok(Math.abs(follow.free.distance - free.free.distance) < .001);
  await page.screenshot({ path: resolve(out, 'follow.png') });
  check('Follow starts behind the character, slightly elevated, at perspective FOV 45');

  await page.mouse.move(820, 420);
  await page.mouse.wheel(0, -100);
  const wheel = await state();
  assert.ok(wheel.follow.targetDistance < follow.follow.distance);
  assert.ok(wheel.follow.distance > wheel.follow.targetDistance);
  assert.equal(wheel.follow.targetPitch, follow.follow.targetPitch);
  await settle();
  const beforeClick = await state();
  await page.mouse.click(820, 420, { button: 'right' });
  const afterClick = await state();
  assert.equal(afterClick.follow.targetPitch, beforeClick.follow.targetPitch);
  assert.equal(afterClick.follow.targetYaw, beforeClick.follow.targetYaw);
  check('Wheel changes real distance smoothly; a plain RMB click does not reset the view');

  await page.mouse.move(820, 420);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(940, 420, { steps: 12 });
  const orbit = await state();
  assert.ok(orbit.follow.targetYaw < afterClick.follow.targetYaw - .5);
  assert.equal(orbit.follow.targetPitch, afterClick.follow.targetPitch);
  await page.mouse.wheel(0, -120);
  await page.mouse.move(940, 490, { steps: 10 });
  await page.mouse.up({ button: 'right' });
  const diagonal = await state();
  assert.ok(diagonal.follow.targetDistance < orbit.follow.targetDistance);
  assert.ok(diagonal.follow.targetPitch > orbit.follow.targetPitch);
  assert.equal(diagonal.follow.targetYaw, orbit.follow.targetYaw);
  assert.deepEqual(diagonal.free, follow.free, 'Free state is frozen while Follow runs');
  await settle();
  check('RMB orbit preserves horizontal inversion; simultaneous wheel and vertical drag stay independent');

  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -50000);
  await settle();
  assert.equal((await state()).follow.targetDistance, 2.2);
  await page.screenshot({ path: resolve(out, 'follow-near.png') });
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 50000);
  await settle();
  assert.equal((await state()).follow.targetDistance, 28);
  const savedFollow = (await state()).follow;
  await switchMode();
  const restored = await state();
  assert.equal(restored.mode, 'free'); assert.equal(restored.yaw, free.yaw);
  assert.equal(restored.free.targetFraming, free.free.targetFraming);
  assert.equal(restored.free.rmbFramingActive, free.free.rmbFramingActive);
  await switchMode();
  assert.equal((await state()).follow.targetDistance, savedFollow.targetDistance);
  check('Zoom limits stay third-person; switching repeatedly restores each mode settings');

  await page.mouse.move(820, 420);
  await page.mouse.wheel(0, -1000); await settle();
  for (const key of ['w', 's', 'a', 'd']) {
    const beforeMove = await state();
    await page.keyboard.down(key); await page.waitForTimeout(2200); await page.keyboard.up(key);
    await page.waitForTimeout(400);
    const afterMove = await state();
    assert.ok(Math.hypot(afterMove.actor[0] - beforeMove.actor[0], afterMove.actor[2] - beforeMove.actor[2]) > 1, `${key}: player moves`);
    assert.ok(Math.hypot(afterMove.position[0] - beforeMove.position[0], afterMove.position[2] - beforeMove.position[2]) > 1, `${key}: camera still follows position`);
    assert.equal(afterMove.follow.targetYaw, beforeMove.follow.targetYaw, `${key}: never recenters behind player`);
    assert.ok(Math.abs(afterMove.follow.yaw - beforeMove.follow.yaw) < .00001, `${key}: angle stays fixed`);
    assert.equal(afterMove.follow.targetPitch, beforeMove.follow.targetPitch);
    assert.equal(afterMove.follow.targetDistance, beforeMove.follow.targetDistance);
    assert.ok(afterMove.position.every(Number.isFinite));
  }
  check('W/S/A/D move character and camera position without changing the manual orbit, pitch or zoom');

  await page.evaluate(() => { const g = window.__cameraQA; g.changeRegion('verdant-plains'); g.invincible = 600; });
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => {
    const g = window.__cameraQA;
    const enemy = g.enemies.find(e => e.hp > 0 && !e.boss);
    g.hero.x = enemy.home.x; g.hero.z = enemy.home.z + 1.1; g.placeActor();
    g.attackTimer = 0; g.impactShakeRemaining = 0;
    const before = enemy.hp;
    g.attack(true);
    return { before, after: enemy.hp, shake: g.impactShakeRemaining };
  });
  assert.ok(hit.after < hit.before); assert.ok(hit.shake > 0);
  await page.waitForTimeout(400);
  assert.equal((await state()).shake, 0);
  check('An actual successful attack triggers a brief shake that settles back to zero');

  await page.evaluate(() => {
    const g = window.__cameraQA;
    g.attackTimer = 0; g.enemies.forEach(e => { e.hp = 0; }); g.attack(true);
  });
  assert.equal((await state()).shake, 0);
  check('A missed attack does not shake the camera');

  await page.evaluate(() => {
    const g = window.__cameraQA;
    g.followView.targetPitch = .08; g.followView.targetDistance = 2.2;
  });
  await settle();
  const ground = await page.evaluate(() => {
    const g = window.__cameraQA;
    return { y: g.camera.position.y, floor: g.groundHeight(g.camera.position.x, g.camera.position.z) };
  });
  assert.ok(ground.y >= ground.floor + 1.19);
  check('Existing field terrain camera clearance remains active in Follow');

  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForTimeout(300);
  assert.ok(Math.abs((await state()).aspect - 960/720) < .001);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const bounds = await page.getByRole('button', { name: /^Kamera (Free|Follow) aktif/ }).boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  check('Resize updates perspective aspect and the camera toggle remains accessible on mobile');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__cameraQA?.started);
  assert.equal((await state()).mode, 'follow');
  assert.equal((await state()).perspective, true);
  check('Reloading the game and continuing a saved character also starts in Follow');
  assert.deepEqual(errors, []);
  check('No browser runtime or console errors');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
