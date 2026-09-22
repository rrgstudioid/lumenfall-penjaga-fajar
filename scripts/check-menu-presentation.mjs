// Fresh isolated browser; never reads or alters the player's actual browser profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY } from '../lib/game/rules.ts';
const runtime = process.env.CODEX_NODE_MODULES || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = await import(pathToFileURL(`${runtime}/playwright/index.mjs`).href);
const output = resolve('output/menu-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [], requests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => requests.push(request.url()));
await page.route('**/lib/game/world.ts*', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer', '(window.__menuWorlds ??= []).push(this); this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});
const shot = name => page.screenshot({ path: resolve(output, `${name}.png`) });
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log(`PASS ${name}`); };
try {
  await page.goto(process.env.MENU_TEST_URL || 'http://localhost:3000/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).waitFor();
  await shot('main-desktop');
  check('Main menu renders without errors', errors.length === 0);
  check('No world canvas on launch', await page.locator('[data-world-surface] canvas').count() === 0);
  check('No world or character asset loaded on main menu', !requests.some(url => /\.glb(?:\?|$)|\/lib\/game\/world\.ts/.test(url)));
  check('Continue disabled without saves', await page.getByRole('button', { name: 'CONTINUE', exact: true }).isDisabled());
  check('Load disabled without saves', await page.getByRole('button', { name: 'LOAD GAME', exact: true }).isDisabled());
  check('No framework error overlay', await page.locator('vite-error-overlay, [data-nextjs-dialog]').count() === 0);
  if (process.argv.includes('--smoke')) {
    console.log(JSON.stringify({ checks, errors }));
  } else {
    const button = name => page.getByRole('button', { name, exact: true });
    const main = () => page.locator('.menu-main').waitFor();
    const loadedPreview = () => page.waitForFunction(() => {
      const preview = document.querySelector('.menu-model-stage .character-preview');
      return preview && !preview.querySelector('p') && preview.querySelector('canvas');
    }, null, { timeout: 90000 });
    const world = () => page.waitForFunction(() => window.__menuWorlds?.at(-1)?.started && document.querySelector('.game-shell.in-world'), null, { timeout: 120000 });
    const readSave = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    const returnMain = async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Back to Main Menu/ }).click();
      await button('Confirm').click();
      await main();
      await page.waitForFunction(() => window.__menuWorlds.at(-1).disposed);
    };
    await button('OPTIONS').click();
    await page.getByRole('button', { name: /AUDIO/ }).click();
    await button('BACK').click();
    await page.reload({ waitUntil: 'networkidle' });
    await button('OPTIONS').click();
    check('Audio option persists independently', await page.getByRole('button', { name: /AUDIO · ON/ }).count() === 1);
    await page.getByRole('button', { name: /AUDIO/ }).click();
    await button('BACK').click();
    await button('QUIT GAME').click();
    await page.getByRole('alertdialog').waitFor();
    check('Quit uses existing confirmation', true);
    await page.keyboard.press('Escape');
    const old = freshHero('slot-1');
    old.characterId = 'qa-existing-hero'; old.characterName = 'Penjaga Lama'; old.level = 12; old.gold = 6543;
    old.playTimeSeconds = 7261; old.lastPlayedAt = 1700000000000;
    old.x = 2; old.z = 8; old.lastSafePosition = { x: 2, z: 8 };
    const fixture = { version: 3, activeSlot: 'slot-1', lastPlayedCharacterId: old.characterId, characters: { 'slot-1': old } };
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: SAVE_KEY, fixture });
    await page.reload({ waitUntil: 'networkidle' });
    check('Continue enabled for valid last played save', await button('CONTINUE').isEnabled());
    await button('LOAD GAME').click();
    await loadedPreview();
    await shot('selection-desktop');
    check('Three slots and real metadata', await page.locator('.menu-slot').count() === 3 && await page.locator('.menu-slot').first().innerText().then(text => text.includes('Penjaga Lama') && text.includes('Lv. 12') && text.includes('2h 1m')));
    check('Load mode locks empty slots', await page.locator('.menu-slot.is-empty:disabled').count() === 2);
    check('Preview does not instantiate world', await page.locator('[data-world-surface] canvas').count() === 0);
    await button('DELETE CHARACTER').click();
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    check('Delete cancel preserves save', (await readSave()).characters['slot-1'].characterId === old.characterId);
    await button('BACK').click();
    await button('NEW GAME').click();
    await page.locator('.menu-slot.is-empty').first().click();
    await loadedPreview();
    await shot('creation-desktop');
    check('Create disabled for empty/invalid name', await button('CREATE CHARACTER').isDisabled());
    await page.getByLabel('CHARACTER NAME', { exact: true }).fill('ab');
    check('Short name invalid', await button('CREATE CHARACTER').isDisabled());
    await page.getByLabel('CHARACTER NAME', { exact: true }).fill('Penjaga Baru');
    await button('Female').click();
    await loadedPreview();
    await button('FACE STYLE: Sharp').count();
    const face = page.locator('.menu-presets').first().locator('button').last();
    await face.click();
    await page.locator('.menu-presets').nth(1).locator('button').last().click();
    await page.locator('.menu-swatches').first().locator('button').last().click();
    await page.locator('.menu-swatches').nth(1).locator('button').last().click();
    await loadedPreview();
    await button('Putar karakter ke kanan').click();
    await button('Perbesar karakter').click();
    await shot('creation-female-desktop');
    for (const viewport of [{ width: 1024, height: 768 }, { width: 800, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await shot(`creation-${viewport.width}`);
      check(`Creation no horizontal overflow ${viewport.width}`, await page.locator('.menu-presentation').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const draftStorage = await readSave();
    check('Preview choices never modify an old character or create a draft save', !draftStorage.characters['slot-2'] && draftStorage.characters['slot-1'].gold === 6543);
    await button('CREATE CHARACTER').click();
    await page.locator('.menu-loading').waitFor();
    await shot('loading');
    await world();
    await shot('world-created');
    check('World starts only after model and colliders are ready', await page.evaluate(() => { const g = window.__menuWorlds.at(-1); return g.actor.userData.modelStatus === 'ready' && g.treeColliders.length > 0 && g.frame > 0; }));
    check('Female created with appearance and unique ID', await page.evaluate(() => { const h = window.__menuWorlds.at(-1).hero; return h.gender === 'female' && h.characterId !== 'qa-existing-hero' && h.appearance.faceStyleId === 'face_sharp' && h.appearance.hairStyleId === 'hair_swept' && h.appearance.hairColorId === 'dark_red' && h.appearance.skinToneId === 'tone_04'; }));
    for (const [key, heading] of [['c', 'Character'], ['k', 'Job Skill'], ['j', 'Jurnal petualangan']]) {
      await page.keyboard.press(key);
      await page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).waitFor();
      check(`Gameplay hotkey ${key.toUpperCase()} preserved`, true);
      await page.keyboard.press(key);
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await page.evaluate(() => {
      const g = window.__menuWorlds.at(-1), original = g.useHotbarSlot.bind(g);
      window.__menuHotkeys = [];
      g.useHotbarSlot = slot => { window.__menuHotkeys.push(slot); return original(slot); };
    });
    for (const key of ['1','2','3','4','5','6','7','8','9','0','q','e']) await page.keyboard.press(key);
    check('1–0/Q/E still reach the existing hotbar handler', await page.evaluate(() => JSON.stringify(window.__menuHotkeys) === JSON.stringify([0,1,2,3,4,5,6,7,8,9,'q','e'])));
    await returnMain();
    const savedAfter = await readSave();
    check('New and existing saves isolated', savedAfter.characters['slot-1'].gold === 6543 && savedAfter.characters['slot-1'].level === 12 && savedAfter.characters['slot-2'].characterName === 'Penjaga Baru');
    check('World disposed when returning to main menu', await page.evaluate(() => { const g = window.__menuWorlds.at(-1); return g.disposed && g.frame === 0 && !document.querySelector('[data-world-surface] canvas'); }));
    await page.waitForTimeout(800);
    check('No simulation/playtime while menu is open', await page.evaluate(() => { const g = window.__menuWorlds.at(-1); return !g.started && g.frame === 0; }));
    await page.reload({ waitUntil: 'networkidle' });
    await button('CONTINUE').click();
    await world();
    check('Continue reloads last played character with saved appearance', await page.evaluate(() => { const h = window.__menuWorlds.at(-1).hero; return h.characterName === 'Penjaga Baru' && h.gender === 'female' && h.appearance.faceStyleId === 'face_sharp'; }));
    await returnMain();
    await button('LOAD GAME').click();
    await page.locator('.menu-slot').filter({ hasText: 'Penjaga Lama' }).click();
    await button('ENTER WORLD').click();
    await world();
    check('Existing save keeps progression, inventory, identity and position', await page.evaluate(({ old }) => {
      const h = window.__menuWorlds.at(-1).hero;
      return h.characterId === old.characterId && h.level === old.level && h.gold === old.gold && h.inventory.length === old.inventory.length && Math.hypot(h.x - old.x, h.z - old.z) < .1;
    }, { old }));
    await returnMain();
    await button('LOAD GAME').click();
    await page.locator('.menu-slot').filter({ hasText: 'Penjaga Baru' }).click();
    await button('DELETE CHARACTER').click();
    await page.getByRole('button', { name: /Hapus permanen/ }).click();
    check('Confirmed delete affects only selected save', !(await readSave()).characters['slot-2'] && !!(await readSave()).characters['slot-1']);
    await button('BACK').click();
    await page.evaluate(key => localStorage.setItem(key, '{broken'), SAVE_KEY);
    await page.reload({ waitUntil: 'networkidle' });
    check('Corrupt save does not crash menu or enable Continue', await button('CONTINUE').isDisabled());
    check('No runtime or hydration errors throughout flows', errors.length === 0);
    // Hold an actual character request, not a simulated loading timer.
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: SAVE_KEY, fixture });
    await page.reload({ waitUntil: 'networkidle' });
    let releaseAsset;
    const assetGate = new Promise(resolve => { releaseAsset = resolve; });
    await page.route('**/astra-hunyuan-rigged.glb', async route => { await assetGate; await route.abort(); });
    await button('CONTINUE').click();
    await page.locator('.menu-loading').waitFor();
    await page.waitForFunction(() => window.__menuWorlds?.length > 0);
    await page.keyboard.press('Escape');
    check('Loading waits for real asset without simulation or pause dialog', await page.evaluate(() => {
      const g = window.__menuWorlds.at(-1);
      return !g.started && g.frame === 0 && g.hero.playTimeSeconds === 7261 && !document.querySelector('[role="dialog"]');
    }));
    releaseAsset();
    await main();
    check('Failed asset returns safely to menu with save intact', await page.locator('.menu-inline-error').isVisible() && (await readSave()).characters['slot-1'].characterId === old.characterId);
    await page.unroute('**/astra-hunyuan-rigged.glb');
    errors.length = 0; // The deliberately aborted request above is the expected negative test.
    await button('CONTINUE').click();
    await world();
    check('Retry succeeds after asset failure', errors.length === 0);
    await returnMain();
    console.log(JSON.stringify({ checks, errors }));
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await shot('failure');
  console.error(await page.locator('body').innerText(), errors);
  throw error;
} finally { await browser.close(); }
