// Disposable browser context: never touches the player's browser profile or saves.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY, socketRune } from '../lib/game/rules.ts';
import { ITEM_CATALOG, createItem, createRuneItem } from '../lib/game/items.ts';
import { CITIES } from '../lib/game/regions.ts';
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const out = resolve('work/forge');
await mkdir(out, { recursive: true });
const hero = freshHero();
hero.characterName = 'Forge QA';
hero.gold = 5000;
hero.level = 30;
const sword = hero.inventory.find((i) => i.id === hero.equipment.mainHand);
sword.sockets = [{ id: 'qa-socket', rune: null }];
sword.bonusStats = {attackPercent:4};
sword.uniqueStatsLocked=false;
const rune = createRuneItem('might', 'rare');
hero.inventory.push(rune);
const qaMaster=CITIES.arunika.npcList.find(n=>n.service==='forge');hero.x=qaMaster.x;hero.z=qaMaster.z;
assert(socketRune(hero, sword.id, rune.id, 0,qaMaster.id).ok);
const armor = createItem(
  Object.values(ITEM_CATALOG).find((i) => i.equipSlot === 'chest').templateId,
);
const locked = createItem('legacy-fajar-blade', { isLocked: true });
const max = createItem('legacy-fajar-blade', { enhancementLevel: 12 });
hero.inventory.push(
  armor,
  locked,
  max,
  ...['iron', 'titanium', 'vibranium', 'meteorite-core'].map((id) =>
    createItem(id, { quantity: 30 }),
  ),
  createItem('fate-rune-fragment'),
  createItem('eternal-seal'),
);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
await context.addInitScript(
  ({ key, hero }) => {
    if (!localStorage.getItem('forge-qa-seeded')) {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 3,
          activeSlot: 'slot-1',
          characters: { 'slot-1': hero },
        }),
      );
      localStorage.setItem('forge-qa-seeded', '1');
    }
  },
  { key: SAVE_KEY, hero },
);
const page = await context.newPage(),
  errors = [],
  failedAssets = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) failedAssets.push(`${r.status()} ${r.url()}`);
});
await page.route('**/lib/game/world.ts*', async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__forgeQA = this; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const check = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
const forge = page.locator('.forge-dialog');
const snapshot = () =>
  page.evaluate(() => structuredClone(window.__forgeQA.hero));
async function resume() {
  await page
    .getByRole('button', {
      name: /^(Lanjutkan perjalanan|Buat karakter & mulai)$/,
    })
    .click();
  await page.waitForFunction(() => window.__forgeQA?.started);
}
async function openNpc(cityId, id, directForge = false) {
  const npc = CITIES[cityId].npcList.find((n) => n.id === id);
  await page.evaluate(
    ({ cityId, npc }) => {
      const g = window.__forgeQA;
      if (g.hero.currentCity !== cityId || !g.hero.inCity)
        g.changeRegion(cityId);
      g.hero.x = npc.x;
      g.hero.z = npc.z + 1.7;
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.zoom = 20;
      g.cameraZoom.halfHeight = 20;
      g.pause(false);
    },
    { cityId, npc },
  );
  await page.waitForTimeout(300);
  const point = await page.evaluate((npc) => {
    const g = window.__forgeQA,
      p = g.actor.position.clone().set(npc.x, 1.1, npc.z).project(g.camera),
      r = g.renderer.domElement.getBoundingClientRect();
    return {
      x: r.x + (p.x * 0.5 + 0.5) * r.width,
      y: r.y + (-p.y * 0.5 + 0.5) * r.height,
    };
  }, npc);
  await page.mouse.click(point.x, point.y);
  if (directForge) {
    await page.locator('[data-forge-choice="enhancement"]').waitFor();
  } else {
    await page
      .getByRole('dialog')
      .getByRole('heading', { name: npc.name, exact: true })
      .waitFor();
  }
}
async function openForge(city = 'arunika', id = 'aruna-3') {
  await openNpc(city, id, true);
  await page.locator('[data-forge-choice="enhancement"]').click();
  await forge.waitFor();
}
async function select(id) {
  await forge.locator(`[data-forge-item="${id}"]`).click();
}
async function attempt(roll = 0) {
  await forge.getByRole('button', { name: /^Tempa \+/ }).click();
  await page.evaluate((roll) => {
    window.__qaRandom = Math.random;
    Math.random = () => roll;
  }, roll);
  try {
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Konfirmasi Tempa', exact: true })
      .click();
    await forge.locator('.forge-working').waitFor();
    await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert(await forge.getByRole('button', { name: /^Tempa \+/ }).isDisabled());
    await forge.locator('.forge-result').waitFor();
  } finally {
    await page.evaluate(() => {
      Math.random = window.__qaRandom;
    });
  }
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
}
async function closeForge() {
  await forge.getByRole('button', { name: 'Close', exact: true }).click();
  await forge.waitFor({ state: 'hidden' });
}
async function snap(name) {
  await page.screenshot({ path: resolve(out, `${name}.png`) });
}
try {
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await resume();
  const noAccess = await page.evaluate((id) => {
    const g = window.__forgeQA,
      before = JSON.stringify(g.hero);
    const result = g.enhanceItem(id);
    return {
      attempted: result.attempted,
      changed: before !== JSON.stringify(g.hero),
      opened: g.openForge(),
    };
  }, sword.id);
  assert.deepEqual(noAccess, {
    attempted: false,
    changed: false,
    opened: false,
  });
  check('no direct enhancement or forge session without clicking Forge Master');
  await page.keyboard.press('i');
  assert.equal(
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Enhance|Tempa/ })
      .count(),
    0,
  );
  await page.keyboard.press('Escape');
  check('Inventory has no direct enhancement button');
  await openForge();
  assert.equal(await forge.getAttribute('data-slot'), 'dialog-content');
  assert.equal(await page.locator('.inventory-dialog').count(), 0);
  assert.equal(
    await forge.locator('[data-forge-item]').count(),
    hero.inventory.filter(
      (i) =>
        i.equipSlot &&
        ['weapon', 'armor', 'accessory'].includes(i.category) &&
        i.maxEnhancementLevel > 0,
    ).length,
  );
  check(
    'Empu Wira opens dedicated panel listing equipped and inventory equipment',
  );
  await select(sword.id);
  assert((await forge.innerText()).includes('Unique Stats'));
  assert((await forge.innerText()).includes('Rune of Might'));
  const original = await snapshot();
  await forge.getByRole('button', { name: /^Tempa \+/ }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Batalkan', exact: true })
    .click();
  assert.deepEqual((await snapshot()).inventory, original.inventory);
  check('preview and Cancel spend nothing and preserve item');
  async function startWaiting() {
    await forge.getByRole('button', { name: /^Tempa \+/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Konfirmasi Tempa', exact: true }).click();
    await forge.locator('.forge-working').waitFor();
    assert(await forge.getByRole('button', { name: /^Tempa \+/ }).isDisabled());
    assert(await forge.locator(`[data-forge-item="${armor.id}"]`).isDisabled());
    assert.deepEqual((await snapshot()).inventory, original.inventory);
  }
  await startWaiting();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await snap('forge-enhancing');
  await forge.getByRole('button', { name: 'Cancel forging' }).click();
  await page.waitForTimeout(2600);
  assert.deepEqual((await snapshot()).inventory, original.inventory);
  assert.equal(await forge.locator('.forge-result').count(), 0);
  check('waiting blocks repeat clicks and item switching; Cancel uses no materials');
  await startWaiting();
  await closeForge();
  await page.waitForTimeout(2600);
  assert.deepEqual((await snapshot()).inventory, original.inventory);
  await openForge();
  await select(sword.id);
  check('closing during animation cancels the pending transaction');
  await startWaiting();
  await forge.getByRole('button', { name: /Back to Forge Master/ }).click();
  await page.locator('[data-forge-choice="rune"]').click();
  await page.waitForTimeout(2600);
  assert.deepEqual((await snapshot()).inventory, original.inventory);
  await forge.getByRole('button', { name: /Back to Forge Master/ }).click();
  await page.locator('[data-forge-choice="enhancement"]').click();
  await select(sword.id);
  check('switching Forge services cancels pending enhancement without consumption');
  await startWaiting();
  await page.evaluate(() => { window.__forgeQA.hero.x += 20; });
  await page.waitForTimeout(2700);
  assert.deepEqual((await snapshot()).inventory, original.inventory);
  assert.equal(await forge.locator('.forge-working').count(), 0);
  await page.evaluate(() => { window.__forgeQA.hero.x -= 20; window.__forgeQA.emit(); });
  check('leaving NPC range during preparation denies transaction without spending');
  await forge.waitFor({ state: 'hidden' });
  await openForge();
  await select(sword.id);
  await attempt(0);
  const enhanced = await snapshot(),
    enhancedSword = enhanced.inventory.find((i) => i.id === sword.id),
    originalSword = original.inventory.find((i) => i.id === sword.id);
  assert.equal(enhancedSword.enhancementLevel, 1);
  assert.equal(enhanced.gold, original.gold);
  assert.equal(
    enhanced.inventory.find((i) => i.templateId === 'iron').quantity,
    original.inventory.find((i) => i.templateId === 'iron').quantity - 1,
  );
  assert(!enhanced.inventory.some((i) => i.itemType === 'fateRune'));
  assert(enhanced.inventory.some((i) => i.itemType === 'eternalSeal'));
  for (const key of [
    'baseStats',
    'affixes',
    'sockets',
    'optimizerHistory',
    'source',
    'rarity',
  ])
    assert.deepEqual(enhancedSword[key], originalSword[key]);
  assert(
    (await forge.getByRole('status').innerText()).includes(
      'berhasil menjadi +1',
    ),
  );
  check(
    'Confirm enhances once, spends correct material/Fate, keeps GOLD, Seal, Rune and optimizer',
  );
  await forge.getByRole('status').scrollIntoViewIfNeeded();
  await snap('forge-success');
  await forge.getByRole('button', { name: 'Enhance Again', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Batalkan', exact: true }).click();
  assert.deepEqual((await snapshot()).inventory, enhanced.inventory);
  check('Enhance Again requires a fresh confirmation and Cancel remains free');
  await select(armor.id);
  await attempt();
  assert.equal(
    (await snapshot()).inventory.find((i) => i.id === armor.id)
      .enhancementLevel,
    1,
  );
  check('unequipped armor can enhance through same transaction');
  await select(locked.id);
  assert(await forge.getByRole('button', { name: /^Tempa \+/ }).isDisabled());
  assert((await forge.innerText()).includes('Equipment terkunci'));
  check('locked equipment explains why enhancement is disabled');
  await select(max.id);
  assert(await forge.getByRole('button', { name: 'Tempa MAX' }).isDisabled());
  check('+12 gear cannot enhance past maximum');
  await select(sword.id);
  await attempt(1);
  let after = await snapshot();
  assert.equal(
    after.inventory.find((i) => i.id === sword.id).enhancementLevel,
    1,
  );
  assert(!after.inventory.some((i) => i.itemType === 'eternalSeal'));
  check('failed attempt consumes Eternal Seal and preserves enhancement');
  await attempt(1);
  assert.equal(
    (await snapshot()).inventory.find((i) => i.id === sword.id)
      .enhancementLevel,
    0,
  );
  check('unprotected failure downgrades and updates panel immediately');
  await snap('forge-failure');
  await page.evaluate(() => {
    const g = window.__forgeQA;
    g.hero.inventory = g.hero.inventory.filter((i) => i.templateId !== 'iron');
    g.emit();
  });
  assert(await forge.getByRole('button', { name: /^Tempa \+/ }).isDisabled());
  assert((await forge.innerText()).includes('Membutuhkan 1 Iron (tersedia 0)'));
  check(
    'insufficient material shows owned/required counts and disables action',
  );
  await snap('forge-material-shortage');
  await closeForge();
  assert.equal(await page.evaluate(() => window.__forgeQA.forgeNpcId), null);
  check('closing panel invalidates NPC forge session');
  await page.reload({ waitUntil: 'networkidle' });
  await resume();
  after = await snapshot();
  assert.equal(
    after.inventory.find((i) => i.id === armor.id).enhancementLevel,
    1,
  );
  assert.equal(
    after.inventory.find((i) => i.id === sword.id).enhancementLevel,
    0,
  );
  assert.deepEqual(
    after.inventory.find((i) => i.id === sword.id).sockets,
    originalSword.sockets,
  );
  assert.equal(await page.evaluate(() => window.__forgeQA.forgeNpcId), null);
  check(
    'reload retains equipment/Rune results but never persists forge access',
  );
  await openNpc('jayantara', 'jaya-3');
  assert.equal(
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Tempa', exact: true })
      .count(),
    0,
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .first()
    .click();
  check(
    'Juru Segel does not expose enhancement despite legacy forge-service alias',
  );
  await openForge('jayantara', 'jaya-2');
  assert((await forge.innerText()).includes('Empu Niskala'));
  check('Kota Jayantara Forge Master also opens dedicated enhancement menu');
  await select(armor.id);
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    for (const scale of [0.75, 1, 1.5]) {
      await page.evaluate((scale) => {
        document.documentElement.style.setProperty(
          '--lumenfall-ui-scale',
          String(scale),
        );
        window.dispatchEvent(new Event('resize'));
      }, scale);
      await page.waitForTimeout(250);
      await forge
        .getByRole('heading', { name: 'Tempa / Enhance', exact: true })
        .scrollIntoViewIfNeeded();
      const box = await forge.boundingBox();
      assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= size.width + 1);
      assert(
        await forge
          .getByRole('button', { name: 'Close', exact: true })
          .isVisible(),
      );
      await snap(`forge-${size.width}-${scale}`);
    }
  }
  check(
    'responsive forge panel stays accessible at 1366/1920 and UI scale 75/100/150%',
  );
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lumenfall-ui-scale', '1');
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(200);
  const header = forge.getByRole('heading', {
    name: 'Tempa / Enhance',
    exact: true,
  });
  const start = await forge.boundingBox(),
    handle = await header.boundingBox();
  await page.mouse.move(handle.x + 50, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 110, handle.y + 35, { steps: 8 });
  await page.mouse.up();
  const end = await forge.boundingBox();
  assert(Math.abs(end.x - start.x - 60) < 3, JSON.stringify({start,handle,end}));
  check('dedicated panel reuses synchronized draggable-window behavior');
  await page.keyboard.press('Escape');
  await forge.waitFor({ state: 'hidden' });
  check('Escape closes forge and returns to game');
  await page.evaluate(() => {
    const g = window.__forgeQA;
    g.changeRegion('verdant-plains');
  });
  const denied = await page.evaluate((id) => {
    const g = window.__forgeQA;
    g.forgeNpcId = 'aruna-3';
    const before = JSON.stringify(g.hero);
    const result = g.enhanceItem(id);
    return {
      attempted: result.attempted,
      unchanged: before === JSON.stringify(g.hero),
    };
  }, armor.id);
  assert.deepEqual(denied, { attempted: false, unchanged: true });
  check('engine rejects enhancement in field even with stale city NPC id');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  check('no runtime/console/hydration errors or failed assets');
  await writeFile(
    resolve(out, 'browser-results.json'),
    JSON.stringify({ checks, errors, failedAssets }, null, 2),
  );
} catch (error) {
  await snap('failure');
  await writeFile(
    resolve(out, 'failure.json'),
    JSON.stringify(
      {
        checks,
        errors,
        failedAssets,
        text: await page.locator('body').innerText(),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
