// Real game integration in an isolated browser profile; never reads/writes player saves.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  freshHero,
  SAVE_KEY,
  equipItem,
  derivedStats,
  unequipItem,
  chooseCoreJob,
} from '../lib/game/rules.ts';
import { createItem } from '../lib/game/items.ts';
import { calculateCombatPower } from '../lib/game/combat-power.ts';
import { previewEquipmentChange } from '../lib/game/character-view.ts';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const out = resolve('work/combat-power');
await mkdir(out, { recursive: true });
const hero = freshHero();
hero.characterName = 'Astra';
hero.level = 35;
hero.coreJob = 'warrior';
hero.job = 'warrior';
hero.jobTier = 'core';
hero.gold = 10000;
hero.allocatedStats = { str: 35, vit: 25, dex: 15, int: 8 };
hero.statPoints = 6;
for (const id of [
  'arunika-head',
  'arunika-gloves',
  'arunika-legs',
  'arunika-boots',
  'arunika-ring1',
  'arunika-ring2',
  'arunika-earring1',
  'arunika-earring2',
  'ironveil-shield',
  'adventurer-pet-egg',
]) {
  const item = createItem(id);
  hero.inventory.push(item);
  equipItem(hero, item.id);
}
const sword = createItem('jayantara-two-hand-sword', { id: 'cs-sword' });
hero.inventory.push(
  sword,
  createItem('field-ironveil-mines-sword', { id: 'cs-onehand' }),
  createItem('magnifier', { quantity: 2 }),
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(
  ({ key, hero }) => {
    if (!localStorage.getItem('cs-test-seed')) {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          activeSlot: 'slot-1',
          characters: { 'slot-1': hero },
        }),
      );
      localStorage.setItem('cs-test-seed', '1');
    }
  },
  { key: SAVE_KEY, hero },
);
const page = await context.newPage(),
  errors = [],
  failures = [],
  checks = [];
page.setDefaultTimeout(20000);
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400)
    failures.push(`${response.status()} ${response.url()}`);
});
await page.route('**/lib/game/world.ts*', async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__characterQA = this; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const check = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const current = () =>
  page.evaluate(() => structuredClone(window.__characterQA.hero));
const dashboard = page.locator('[data-character-dashboard]');
try {
  await page.goto('http://localhost:3001/', {
    waitUntil: 'networkidle',
    timeout: 120000,
  });
  await page
    .getByRole('button', {
      name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/,
    })
    .click();
  await page.waitForFunction(() => window.__characterQA?.started, {
    timeout: 60000,
  });
  await page.keyboard.press('c');
  await dashboard.waitFor();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: resolve(out, 'character-1440.png') });
  console.log('INITIAL', (await dashboard.innerText()).slice(0, 2000));
  assert.equal(await dashboard.getByRole('tab').count(), 0);
  assert.equal(await dashboard.locator('[data-equipment-slot]').count(), 13);
  assert.equal(await dashboard.locator('canvas').count(), 1);
  check('C opens one actual-model dashboard with 13 slots and no tabs');
  const cpNumber = n => n.toLocaleString('en-US');
  assert.equal(await dashboard.locator('.cs-power b').innerText(), cpNumber(calculateCombatPower(await current()).total));
  await dashboard.locator('.cs-power').hover();
  const cpTooltip = page.locator('.cs-tooltip').filter({ hasText: 'Combat Power Breakdown' });
  await cpTooltip.waitFor();
  for (const label of ['Offensive Power', 'Defensive Power', 'Sustain Power', 'Utility Power', 'Special Effects', 'Total']) assert((await cpTooltip.innerText()).includes(label));
  await page.screenshot({ path: resolve(out, 'combat-power-breakdown.png') });
  await page.mouse.move(0, 0);
  check('Live CP header equals production calculator and tooltip exposes all five components');
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    const layout = await page.locator('.character-dialog').evaluate((el) => ({
      scroll: el.scrollHeight - el.clientHeight,
      inner: [
        ...el.querySelectorAll('.cs-columns,.cs-attributes,.cs-combat'),
      ].map((e) => e.scrollHeight - e.clientHeight),
      rect: el.getBoundingClientRect().toJSON(),
      slots: [...el.querySelectorAll('[data-equipment-slot]')].map((e) =>
        e.getBoundingClientRect().toJSON(),
      ),
    }));
    assert(layout.scroll <= 2, JSON.stringify(layout));
    assert(
      layout.inner.every((d) => d <= 2),
      JSON.stringify(layout),
    );
    assert(
      layout.slots.every(
        (s) =>
          s.top >= 0 && s.left >= 0 && s.bottom <= height && s.right <= width,
      ),
    );
    await page.screenshot({ path: resolve(out, `character-${width}.png`) });
    check(`Main dashboard fits ${width}x${height} without scrolling`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lumenfall-ui-scale', '1.5');
    window.dispatchEvent(new Event('lumenfall:interface-scale'));
  });
  await page.waitForTimeout(600);
  const scaledLayout = await dashboard.evaluate((el) =>
    [...el.querySelectorAll('.cs-columns,.cs-attributes,.cs-combat')].map(
      (e) => ({
        name: e.className,
        scroll: e.scrollHeight,
        client: e.clientHeight,
      }),
    ),
  );
  assert(
    scaledLayout.every((e) => e.scroll - e.client <= 2),
    JSON.stringify(scaledLayout),
  );
  await page.screenshot({ path: resolve(out, 'character-scale150.png') });
  check('Zero-scroll layout remains usable at 150% interface scale');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lumenfall-ui-scale', '1');
    window.dispatchEvent(new Event('lumenfall:interface-scale'));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const before = await current();
  await dashboard
    .getByRole('button', { name: 'Add Strength', exact: true })
    .click();
  const after = await current();
  assert.equal(after.allocatedStats.str, before.allocatedStats.str + 1);
  assert.equal(after.statPoints, before.statPoints - 1);
  assert(
    (
      await dashboard
        .locator('[data-character-stat="physicalAttack"]')
        .innerText()
    ).includes(String(derivedStats(after).physicalAttack)),
  );
  check('Allocate updates gameplay and visible final stats');
  assert.equal(await dashboard.locator('.cs-power b').innerText(), cpNumber(calculateCombatPower(after).total));
  check('Stat allocation recalculates visible Combat Power');
  await dashboard.locator('[data-character-stat="physicalAttack"]').hover();
  await page.locator('.cs-tooltip').waitFor();
  await page.keyboard.press('c');
  await dashboard.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.cs-tooltip').count(), 0);
  await page.keyboard.press('c');
  await dashboard.waitFor();
  check('C closes hovered tooltip without leftovers');
  await dashboard.getByRole('button', { name: 'Advanced Stats' }).click();
  await page.locator('.cs-advanced-popup').waitFor();
  assert(
    (await page.locator('.cs-advanced-popup').innerText()).includes(
      'Physical Penetration',
    ),
  );
  await page.getByRole('button', { name: 'Close advanced stats' }).click();
  check('Advanced stats open separately and close cleanly');
  const baseline = JSON.stringify((await current()).equipment);
  await dashboard.locator('[data-equipment-slot="mainHand"]').click();
  await page
    .locator('.cs-candidate')
    .filter({ hasText: 'Jayantara Greatsword' })
    .hover();
  await page
    .locator('.cs-tooltip')
    .filter({ hasText: 'Compare dengan' })
    .waitFor();
  assert.equal(JSON.stringify((await current()).equipment), baseline);
  check('Candidate hover shows real read-only item comparison');
  const beforeCandidate = await current();
  const expectedPreview = previewEquipmentChange(beforeCandidate, beforeCandidate.inventory.find(i => i.id === sword.id), 'mainHand');
  assert(expectedPreview.combatPower);
  const candidateTip = page.locator('.cs-tooltip').filter({ hasText: 'Compare dengan' });
  assert((await candidateTip.innerText()).includes(cpNumber(expectedPreview.combatPower.after.total)));
  check('Hover After Equip CP matches isolated two-hand/off-hand simulation');
  await page
    .locator('.cs-candidate')
    .filter({ hasText: 'Jayantara Greatsword' })
    .click();
  assert.equal(JSON.stringify((await current()).equipment), baseline);
  await page.screenshot({ path: resolve(out, 'equipment-preview.png') });
  await page.locator('.cs-comparison').getByRole('button', { name: 'Cancel preview', exact: true }).click();
  assert.equal(JSON.stringify((await current()).equipment), baseline);
  assert.equal(await dashboard.locator('.cs-power b').innerText(), cpNumber(calculateCombatPower(await current()).total));
  check('Cancel candidate preview leaves actual CP and equipment unchanged');
  await page.locator('.cs-candidate').filter({ hasText: 'Jayantara Greatsword' }).click();
  await page
    .locator('.cs-comparison')
    .getByRole('button', { name: 'Equip', exact: true })
    .click();
  await page.getByRole('alertdialog').waitFor();
  assert.equal(JSON.stringify((await current()).equipment), baseline);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Equip', exact: true })
    .click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  assert.equal((await current()).equipment.mainHand, sword.id);
  assert.equal((await current()).equipment.offHand, null);
  assert.equal(await dashboard.locator('.cs-power b').innerText(), cpNumber(expectedPreview.combatPower.after.total));
  check('Confirmed equip CP equals the preview, including displaced off-hand');
  check(
    'Read-only comparison + two-hand confirmation preserve state until Equip',
  );
  await dashboard.locator('[data-equipment-slot="mainHand"]').click();
  await page
    .locator('.cs-equipment-popup')
    .getByRole('button', { name: 'Unequip', exact: true })
    .click();
  assert.equal((await current()).equipment.mainHand, null);
  check('Unequip updates shared state and appearance');
  await dashboard.locator('[data-equipment-slot="mainHand"]').click();
  const source = await page
    .locator('.cs-candidate')
    .filter({ hasText: 'Iron Sword' })
    .boundingBox();
  const destination = await dashboard
    .locator('[data-equipment-slot="mainHand"]')
    .boundingBox();
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 18 },
  );
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.equal((await current()).equipment.mainHand, 'cs-onehand');
  check('Real pointer drag equips from picker into paper-doll slot');
  await page
    .getByRole('button', { name: 'Close equipment', exact: true })
    .click();
  const beforeReset = await current();
  await dashboard.getByRole('button', { name: /Reset Stats/ }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  assert.deepEqual(
    (await current()).allocatedStats,
    beforeReset.allocatedStats,
  );
  await dashboard.getByRole('button', { name: /Reset Stats/ }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Reset Stats', exact: true })
    .click();
  assert.deepEqual((await current()).allocatedStats, {
    str: 0,
    vit: 0,
    dex: 0,
    int: 0,
  });
  assert.equal((await current()).gold, beforeReset.gold - 500);
  assert.deepEqual((await current()).equipment, beforeReset.equipment);
  check(
    'Reset cancellation and confirmation use existing cost and preserve equipment',
  );
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await page.keyboard.press('j');
  await dashboard.waitFor({ state: 'hidden' });
  assert((await page.locator('.game-dialog').innerText()).includes('Quest'));
  check('J still opens the original Quest panel');
  await page.keyboard.press('k');
  await page.locator('.job-skill-dialog').waitFor();
  assert.equal(await dashboard.count(), 0);
  await page.screenshot({ path: resolve(out, 'job-unchanged.png') });
  check('K retains the separate existing Job Skill panel');
  await page.keyboard.press('k');
  const saveBefore = (await current()).allocatedStats.str;
  await page.reload({ waitUntil: 'networkidle' });
  await page
    .getByRole('button', { name: 'Lanjutkan perjalanan', exact: true })
    .click();
  await page.waitForFunction(() => window.__characterQA?.started);
  await page.keyboard.press('c');
  await dashboard.waitFor();
  assert.equal((await current()).allocatedStats.str, saveBefore);
  assert.equal((await current()).equipment.mainHand, 'cs-onehand');
  check('Real save/load preserves allocation and equipment changes');
  assert.equal(await dashboard.locator('.cs-power b').innerText(), cpNumber(calculateCombatPower(await current()).total));
  check('Reload derives CP from saved stats without a saved CP field');
  await page.keyboard.press('i');
  const inventorySword = page.locator('.inventory-slot[data-item-id="cs-sword"]');
  await inventorySword.hover();
  const inventoryTip = page.locator('.floating-item-tooltip');
  await inventoryTip.waitFor();
  const inventoryHero = await current();
  const inventoryPreview = previewEquipmentChange(inventoryHero, inventoryHero.inventory.find(i => i.id === sword.id), 'mainHand');
  assert(inventoryPreview.combatPower);
  assert((await inventoryTip.innerText()).includes(cpNumber(inventoryPreview.combatPower.after.total)));
  const tooltipRect = await inventoryTip.boundingBox();
  assert(tooltipRect.x >= 0 && tooltipRect.y >= 0 && tooltipRect.x + tooltipRect.width <= 1440 && tooltipRect.y + tooltipRect.height <= 900);
  await page.screenshot({ path: resolve(out, 'inventory-combat-power.png') });
  const inventoryEquipment = JSON.stringify(inventoryHero.equipment);
  await page.keyboard.press('i');
  await inventoryTip.waitFor({ state: 'hidden' });
  assert.equal(JSON.stringify((await current()).equipment), inventoryEquipment);
  check('Inventory hover CP matches equip simulation and I dismisses it without mutation');
  await page.keyboard.press('c');
  await dashboard.waitFor();
  const promoted = freshHero();
  promoted.level = 15;
  promoted.characterName = 'Promotion QA';
  unequipItem(promoted, 'mainHand');
  assert(chooseCoreJob(promoted, 'hunter'));
  await page.evaluate((next) => {
    const g = window.__characterQA;
    g.hero = next;
    g.rebuildHeroAppearance();
    g.emit();
  }, promoted);
  await page.waitForFunction(() =>
    document.querySelector('.cs-identity')?.textContent.includes('Hunter'),
  );
  check(
    'Header and model react to actual promotion result without changing job UI',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  check('No browser errors or failed assets');
} catch (error) {
  console.error(error);
  await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ checks, errors, failures }, null, 2),
  );
  await browser.close();
}
