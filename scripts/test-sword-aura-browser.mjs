// Disposable save + test-only inspection handles. Never modifies the player's save.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY, createItem } from '../lib/game/rules.ts';
import { CITIES } from '../lib/game/regions.ts';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const hero = freshHero(), sword = hero.inventory.find(item => item.id === hero.equipment.mainHand);
sword.enhancementLevel = 9; hero.inventory.push(createItem('meteorite-core', { quantity: 20 }));
const npc = CITIES.arunika.npcList.find(npc => npc.service === 'forge');
hero.x = npc.x; hero.z = npc.z + 1;
await context.addInitScript(({ key, hero }) => {
  if (!localStorage.getItem('flame-qa')) {
    localStorage.setItem(key, JSON.stringify({ version: 3, activeSlot: 'slot-1', characters: { 'slot-1': hero } }));
    localStorage.setItem('flame-qa', '1');
  }
}, { key: SAVE_KEY, hero });
const page = await context.newPage(), errors = [], checks = [], requests = [];
const out = resolve('work/sword-aura'); await mkdir(out, { recursive: true });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (r.url().includes('sword-flame-13.webp')) requests.push(r.url()); });
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('this.renderer = new T.WebGLRenderer', 'window.__flameQA = this; this.renderer = new T.WebGLRenderer') });
});
await page.route('**/components/game/character-preview.tsx*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('const model = buildModel(createCharacterModel);', 'const model = buildModel(createCharacterModel); window.__flamePreview = model;') });
});
const check = name => { checks.push(name); console.log('PASS', name); };
const count = () => page.evaluate(() => window.__flameQA.aura.userData.swordFlames.length);
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/ }).click();
  await page.waitForFunction(() => window.__flameQA?.started);
  assert.equal(await count(), 0); assert.equal(requests.length, 0);
  check('+9 sword does not create or download the aura');
  const forged = await page.evaluate(npc => {
    const g = window.__flameQA; g.openNpc(npc.id); g.openForge();
    const original = Math.random; Math.random = () => 0;
    try { return g.enhanceItem(g.hero.equipment.mainHand, 9); }
    finally { Math.random = original; g.closeForge(); g.closeNpcMenu(); }
  }, npc);
  assert.equal(forged.ok, true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__flameQA.actor.getObjectByName('EnhancedSwordFlame13')?.visible);
  assert.equal(await count(), 1);
  await page.evaluate(() => {
    const g = window.__flameQA; g.pause(false); g.hero.x = 0; g.hero.z = -8; g.placeActor();
    g.setCameraMode('follow');
    Object.assign(g.followView, { targetYaw: Math.PI/2+.3, yaw: Math.PI/2+.3, targetPitch: .18, pitch: .18, targetDistance: 5, distance: 5 });
    g.cameraFocus.copy(g.actor.position);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const firstFrame = await page.evaluate(() => window.__flameQA.aura.userData.swordFlames[0].userData.frame);
  await page.waitForTimeout(450);
  assert.notEqual(await page.evaluate(() => window.__flameQA.aura.userData.swordFlames[0].userData.frame), firstFrame);
  assert.equal(await page.evaluate(() => window.__flameQA.aura.visible), false);
  await page.screenshot({ path: resolve(out, 'one-hand-idle.png') });
  check('Successful +9 → +10 forge activates an animated blade aura; body aura stays off');
  await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
  await page.evaluate(() => {
    const g = window.__flameQA; g.attackTimer = 0; g.attack(true); g.paused = true; g.characterModel.animator.update(.1);
  });
  assert.equal(await page.evaluate(() => window.__flameQA.aura.userData.swordFlames[0].parent.name), 'equipment:mainHand');
  await page.screenshot({ path: resolve(out, 'one-hand-attack.png') });
  await page.evaluate(() => { window.__flameQA.paused = false; window.__flameQA.characterModel.animator.reset(); });
  check('Moving and attacking keep the flame on the sword, not the body or camera');
  await page.getByRole('button', { name: 'Lihat karakter' }).click();
  await page.getByRole('tab', { name: 'Equipment', exact: true }).click();
  await page.waitForFunction(() => window.__flamePreview?.aura.userData.swordFlames[0]?.visible);
  await page.screenshot({ path: resolve(out, 'equipment-preview.png') });
  await page.keyboard.press('Escape');
  check('Equipment preview uses the same +10 aura');
  const equippedAgain = await page.evaluate(() => {
    const g = window.__flameQA, id = g.hero.equipment.mainHand;
    g.unequipItem('mainHand'); const removed = g.aura.userData.swordFlames.length === 0;
    g.equipItem(id, 'mainHand'); return { removed, count: g.aura.userData.swordFlames.length };
  });
  assert.deepEqual(equippedAgain, { removed: true, count: 1 });
  check('Unequip removes the aura and re-equip creates only one');
  await page.evaluate(() => {
    const g = window.__flameQA, item = g.hero.inventory.find(i => i.id === g.hero.equipment.mainHand);
    item.equipmentType = 'two_hand_sword'; item.enhancementLevel = 12; g.rebuildHeroAppearance();
  });
  await page.waitForFunction(() => window.__flameQA.aura.userData.swordFlames[0]?.visible);
  await page.screenshot({ path: resolve(out, 'two-hand.png') });
  assert.equal(await count(), 1);
  await page.evaluate(() => {
    const g = window.__flameQA, item = g.hero.inventory.find(i => i.id === g.hero.equipment.mainHand);
    item.equipmentType = 'staff'; g.rebuildHeroAppearance();
  });
  assert.equal(await count(), 0);
  check('+12 two-hand sword receives a length-matched aura; +12 staff does not');
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'browser-results.json'), JSON.stringify({ checks, errors, atlasRequests: requests.length }, null, 2));
} finally { await browser.close(); }
