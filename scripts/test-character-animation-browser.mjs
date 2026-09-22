// Uses disposable storage and response-only QA handles, never the player's save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), errors = [], warnings = [], checks = [];
const out = resolve('work/character-animation'); await mkdir(out, { recursive: true });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning' && /THREE|WebGL/.test(m.text())) warnings.push(m.text()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__characterQA = this; this.renderer = new T.WebGLRenderer') });
});
await page.route('**/components/game/character-preview.tsx*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('const model = buildModel(createCharacterModel);', 'const model = buildModel(createCharacterModel); window.__previewCharacter = model;') });
});
const check = name => { checks.push(name); console.log('PASS', name); };
async function screenshot(name) { await page.screenshot({ path: resolve(out, `${name}.png`) }); }
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__characterQA?.started);
  await page.evaluate(() => {
    const g = window.__characterQA;
    g.invincible = 0; g.setCameraMode('follow');
    Object.assign(g.followView, { targetYaw: Math.PI + .3, yaw: Math.PI + .3, targetPitch: .24, pitch: .24, targetDistance: 6.5, distance: 6.5 });
    g.aura.userData.enabled = false; g.aura.visible = false;
  });
  await page.waitForTimeout(300); await screenshot('idle');
  const anatomy = await page.evaluate(() => {
    const g = window.__characterQA, m = g.characterModel;
    let meshes = 0, bones = 0, skinned = 0, triangles = 0;
    m.actor.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count)/3; } if (o.isBone) bones++; if (o.isSkinnedMesh) skinned++; });
    return { meshes, bones, skinned, triangles, legParent: m.rig.rightLowerLeg.parent.name, handParent: m.sockets.rightHand.parent.name };
  });
  assert.equal(anatomy.bones, 0); assert.equal(anatomy.skinned, 0); assert.ok(anatomy.triangles < 12000);
  assert.equal(anatomy.legParent, 'RightUpperLeg'); assert.equal(anatomy.handParent, 'RightHand');
  check('Low-poly body uses separate rigid meshes, linked joints and hand sockets');

  await page.keyboard.down('w'); await page.waitForTimeout(300);
  const walk = await page.evaluate(() => {
    const g = window.__characterQA, m = g.characterModel;
    g.keys.clear(); g.paused = true;
    return { left: m.rig.leftUpperLeg.rotation.x, right: m.rig.rightUpperLeg.rotation.x, knee: Math.abs(m.rig.leftLowerLeg.rotation.x) + Math.abs(m.rig.rightLowerLeg.rotation.x), weight: m.animator.snapshot().walk };
  });
  await page.keyboard.up('w');
  assert.ok(walk.left * walk.right < 0); assert.ok(walk.knee > .01 && walk.weight > .5);
  await screenshot('walk');
  check('Actual walking swings both complete legs in opposite directions with knee bend');
  await page.evaluate(() => { const g = window.__characterQA; g.paused = false; });
  await page.keyboard.down('Shift'); await page.keyboard.down('w'); await page.waitForTimeout(350);
  assert.ok(await page.evaluate(() => window.__characterQA.characterModel.animator.snapshot().run > .5));
  await page.keyboard.up('w'); await page.keyboard.up('Shift');
  check('Sprint adds a faster, stronger gait through the existing movement controls');

  await page.evaluate(() => { const g = window.__characterQA; g.attackTimer = 0; g.attack(true); g.paused = true; g.characterModel.animator.update(.15); });
  const attack = await page.evaluate(() => {
    const m = window.__characterQA.characterModel, weapon = m.actor.getObjectByName('equipment:mainHand');
    const hand = m.rig.rightHand.getWorldPosition(m.actor.position.clone());
    return { shoulder: m.rig.rightUpperArm.rotation.x, elbow: m.rig.rightLowerArm.rotation.x, distance: weapon.getWorldPosition(hand.clone()).distanceTo(hand), action: m.animator.snapshot().action };
  });
  assert.equal(attack.action, 'basic_attack'); assert.ok(attack.shoulder > 1 && attack.elbow > .3); assert.ok(attack.distance < .00001);
  await screenshot('attack');
  check('A real attack drives shoulder/elbow motion and the equipped sword follows the hand');

  const cast = await page.evaluate(() => {
    const g = window.__characterQA; g.paused = false;
    const before = g.hero.mana, used = g.castSkill('guard-stance');
    g.paused = true; g.characterModel.animator.update(.18);
    return { used, mana: g.hero.mana, before, action: g.characterModel.animator.snapshot().action };
  });
  assert.equal(cast.used, true); assert.ok(cast.mana < cast.before); assert.equal(cast.action, 'magic_cast');
  await screenshot('cast');
  check('An unlocked skill starts the timed casting pose and retains normal mana/cooldown rules');

  const equipment = await page.evaluate(() => {
    const g = window.__characterQA, id = g.hero.equipment.mainHand, phase = g.characterModel.animator.snapshot().actionTime;
    g.unequipItem('mainHand');
    const empty = !g.actor.getObjectByName('equipment:mainHand');
    const preserved = g.characterModel.animator.snapshot().actionTime === phase;
    const equipped = g.equipItem(id, 'mainHand');
    let count = 0; g.actor.traverse(o => { if (o.name === 'equipment:mainHand') count++; });
    return { empty, preserved, equipped, count };
  });
  assert.deepEqual(equipment, { empty: true, preserved: true, equipped: true, count: 1 });
  check('Unequip/re-equip restores one weapon and preserves the current animation phase');

  await page.evaluate(() => { const g = window.__characterQA; g.paused = false; g.characterModel.animator.reset(); });
  await page.keyboard.press('c');
  await page.getByRole('tab', { name: 'Equipment', exact: true }).click();
  await page.waitForFunction(() => window.__previewCharacter?.animator);
  await page.waitForTimeout(300);
  const beforePreview = await page.evaluate(() => window.__previewCharacter.animator.snapshot().time);
  await page.waitForTimeout(400);
  const preview = await page.evaluate(() => {
    const world = window.__characterQA.characterModel, m = window.__previewCharacter;
    return { time: m.animator.snapshot().time, worldType: world.actor.userData.animationType, previewType: m.actor.userData.animationType,
      weapon: m.actor.getObjectByName('equipment:mainHand')?.userData.templateId, expected: world.actor.getObjectByName('equipment:mainHand')?.userData.templateId, paused: window.__characterQA.paused };
  });
  assert.ok(preview.time > beforePreview); assert.equal(preview.worldType, preview.previewType); assert.equal(preview.weapon, preview.expected); assert.equal(preview.paused, false);
  await screenshot('equipment-preview');
  check('Equipment preview shares the same model/equipment and animates while the world stays real-time');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__previewCharacter.actor.userData.disposed === true);
  check('Closing the preview stops its animation and disposes its model');

  await page.getByRole('button', { name: /^Kamera Follow aktif/ }).click();
  assert.equal(await page.evaluate(() => window.__characterQA.cameraMode), 'free');
  await page.getByRole('button', { name: /^Kamera Free aktif/ }).click();
  assert.equal(await page.evaluate(() => window.__characterQA.cameraMode), 'follow');
  check('Both Free and Follow cameras remain usable with the procedural character');
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  check('No browser runtime or Three.js texture warnings');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ anatomy, checks, errors, warnings }, null, 2));
} finally { await browser.close(); }
