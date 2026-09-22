// Real Home + Padang Arunika, memory save from the existing DEV-only harness.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = 'http://127.0.0.1:3003';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const evidence = [];
try {
  await mkdir('output/global-targeting', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/warrior-world.html?architecture=legacy`);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForFunction(() => window.__warriorQA?.game?.started, { timeout: 60000 });
  // Controlled layout of two REAL map entities for reliable visible clicks.
  // Freeze the loop, not the input/renderer/combat methods. No player persistence.
  await page.evaluate(() => {
    const g = window.__warriorQA.game;
    if (g.hero.progressionArchitecture === 'v2_test') throw Error('Not a legacy hero');
    g.renderer.setAnimationLoop(null);
    cancelAnimationFrame(g.frame);
    const a = g.enemies.find(e => e.hp > 0), b = g.enemies.find(e => e.hp > 0 && e !== a);
    window.__globalTargets = [a, b];
    for (const e of g.enemies) e.group.visible = e === a || e === b;
    const x = g.actor.position.x, z = g.actor.position.z;
    a.group.position.set(x - 1.6, g.groundHeight(x - 1.6, z - 2), z - 2);
    b.group.position.set(x + 1, g.groundHeight(x + 1, z - 1), z - 1);
    a.hp = a.max = b.hp = b.max = 10000;
    g.registerTargetEnemy(a); g.registerTargetEnemy(b);
    g.camera.position.set(x, g.actor.position.y + 10, z + 12);
    g.camera.lookAt(x, g.actor.position.y, z);
    g.camera.updateMatrixWorld(); g.scene.updateMatrixWorld(true);
    g.renderer.render(g.scene, g.camera);
    window.__globalDraw = () => { g.updateTargetPresentation(); g.renderer.render(g.scene, g.camera); };
  });
  const state = () => page.evaluate(() => {
    const g = window.__warriorQA.game, [a, b] = window.__globalTargets;
    return { target: g.getCurrentTarget()?.id ?? null, a: a.id, b: b.id, hpA: a.hp, hpB: b.hp, mana: g.hero.mana, failure: g.lastActionFailure, architecture: g.hero.progressionArchitecture ?? 'legacy', rings: g.enemies.filter(e => e.group.getObjectByName('current-target-ring')).length };
  });
  const point = index => page.evaluate(i => {
    const g = window.__warriorQA.game, e = window.__globalTargets[i];
    const p = e.group.position.clone(); p.y += 1;
    p.project(g.camera);
    const r = g.renderer.domElement.getBoundingClientRect();
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 };
  }, index);
  const click = async index => { const p = await point(index); await page.mouse.click(p.x, p.y); await page.evaluate(() => window.__globalDraw()); };
  await click(0);
  let s = await state(); assert.equal(s.target, s.a); assert.equal(s.hpA, 10000); assert.equal(s.rings, 1);
  evidence.push({ firstClick: s });
  await page.screenshot({ path: 'output/global-targeting/legacy-selected.png' });
  await click(0);
  s = await state(); assert(s.hpA < 10000); assert.equal(s.hpB, 10000);
  evidence.push({ secondClick: s });
  await page.screenshot({ path: 'output/global-targeting/legacy-attacked.png' });
  const frame = page.locator('[data-game-ui="target-frame"]');
  await assert.doesNotReject(() => frame.waitFor({ state: 'visible' }));
  assert.equal(await frame.locator('progress').inputValue().catch(() => frame.locator('progress').getAttribute('value')), String(s.hpA));
  await frame.click(); assert.equal((await state()).target, s.a);
  await click(1);
  s = await state(); assert.equal(s.target, s.b); assert.equal(s.hpB, 10000); assert.equal(s.rings, 1);
  evidence.push({ switchClick: s });
  // Click an actually empty canvas point, not a panel.
  await page.mouse.click(850, 300);
  await page.evaluate(() => window.__globalDraw());
  s = await state(); assert.equal(s.target, null); assert.equal(s.rings, 0);
  const noTarget = await page.evaluate(() => {
    const g = window.__warriorQA.game; g.attackTimer = 0; g.attack(true);
    return g.lastActionFailure;
  });
  assert.equal(noTarget, 'NO_TARGET');
  evidence.push({ emptyClick: s, noTarget });
  await click(0);
  const cast = await page.evaluate(() => {
    const g = window.__warriorQA.game, [a,b] = window.__globalTargets;
    const before = [a.hp, b.hp]; const result = g.castSkill('warrior-breaker');
    window.__globalDraw(); return { result, before, after: [a.hp, b.hp] };
  });
  assert(cast.result); assert(cast.after[0] < cast.before[0]); assert.equal(cast.after[1], cast.before[1]);
  evidence.push({ legacySkill: cast });
  const failure = await page.evaluate(() => {
    const g = window.__warriorQA.game, [a,b] = window.__globalTargets;
    a.group.position.z -= 100; const mana = g.hero.mana, hpB = b.hp;
    g.attackTimer = 0; g.attack(true); const basic = g.lastActionFailure;
    const skill = g.castSkill('fajar-strike');
    return { basic, skill, failure: g.lastActionFailure, mana, afterMana: g.hero.mana, hpB, afterHpB: b.hp, target: g.getCurrentTarget()?.id, a: a.id };
  });
  assert.equal(failure.basic, 'TARGET_OUT_OF_RANGE'); assert(!failure.skill);
  assert.equal(failure.mana, failure.afterMana); assert.equal(failure.hpB, failure.afterHpB); assert.equal(failure.target, failure.a);
  evidence.push({ outOfRange: failure });
  await page.evaluate(() => { const g = window.__warriorQA.game; window.__globalTargets[0].hp = 0; window.__globalDraw(); });
  assert.equal((await state()).target, null);
  assert(await frame.isHidden());
  assert.deepEqual(errors, []);
  assert.deepEqual((await context.storageState()).origins, []);
  await mkdir('output/global-targeting', { recursive: true });
  await page.screenshot({ path: 'output/global-targeting/legacy-world.png' });
  await writeFile('output/global-targeting/browser-evidence.json', JSON.stringify({ map: 'verdant-plains', browser: 'Chrome headed', errors, evidence }, null, 2));
  console.log('PASS: real legacy Home/Padang, first/second/switch/empty clicks, basic and skill target, out-of-range cost, ring/frame, UI isolation, death, memory save only');
} finally { await browser.close(); }
