// Isolated test saves only. This never attaches to the player's browser profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { freshHero, SAVE_KEY } from '../lib/game/rules.ts';
import { runtimeFiles } from './prepare-normandy-runtime.mjs';
const modules = process.env.CODEX_NODE_MODULES || 'C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = await import(pathToFileURL(`${modules}/playwright/index.mjs`).href);
const origin = process.env.WORLD_TEST_URL || 'http://localhost:3000/';
const output = resolve('output/world-entry-qa', new URL(origin).hostname);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [];
const check = (label, condition) => { assert.ok(condition, label); checks.push(label); console.log(`PASS ${label}`); };
try {
  for (const mode of ['continue', 'load', 'one-decor-missing', 'all-decor-missing', 'character-missing']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), errors = [], failedAssets = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) failedAssets.push(response.url()); });
    const hero = freshHero('slot-1');
    hero.characterId = 'world-entry-regression'; hero.characterName = 'Uji Dunia';
    hero.level = 12; hero.gold = 6543; hero.playTimeSeconds = 7261;
    const fixture = { version: 3, activeSlot: 'slot-1', lastPlayedCharacterId: hero.characterId, characters: { 'slot-1': hero } };
    await page.goto(origin, { waitUntil: 'networkidle', timeout: 90000 });
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: SAVE_KEY, fixture });
    await page.reload({ waitUntil: 'networkidle' });
    const button = name => page.getByRole('button', { name, exact: true });
    if (mode === 'one-decor-missing') await page.route('**/SM_GrassTall_00A.glb', route => route.fulfill({ status: 404, body: 'Intentional regression test' }));
    if (mode === 'all-decor-missing') await page.route('**/unreal-normandy/meshes/*.glb', route => route.fulfill({ status: 404, body: 'Intentional regression test' }));
    if (mode === 'character-missing') await page.route('**/astra-hunyuan-rigged.glb', route => route.fulfill({ status: 404, body: 'Intentional regression test' }));
    if (mode === 'load') {
      await button('LOAD GAME').click();
      await button('ENTER WORLD').click();
    } else await button('CONTINUE').click();
    if (mode === 'character-missing') {
      await page.locator('.menu-inline-error').waitFor({ timeout: 120000 });
      check('Required character failure prevents entering an incomplete world', await page.locator('.game-shell.in-world').count() === 0);
    } else {
      await page.locator('.game-shell.in-world').waitFor({ timeout: 120000 });
      check(`${mode}: world opens with canvas`, await page.locator('[data-world-surface] canvas').count() === 1);
      await page.screenshot({ path: resolve(output, `${mode}.png`) });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Back to Main Menu/ }).click();
      await button('Confirm').click();
      await page.locator('.menu-main').waitFor();
      check(`${mode}: pause and return to menu work`, true);
    }
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).characters['slot-1'], SAVE_KEY);
    check(`${mode}: character identity/progression retained`, saved.characterId === hero.characterId && saved.level === hero.level && saved.gold === hero.gold && saved.inventory.length === hero.inventory.length);
    check(`${mode}: no uncaught runtime errors`, errors.length === 0);
    if (mode === 'continue' || mode === 'load') check(`${mode}: no missing game assets`, failedAssets.length === 0);
    if (mode === 'continue') {
      for (const file of runtimeFiles) {
        const response = await context.request.head(new URL(file.replace(/^public\//, ''), origin).href);
        check(`Published asset ${file.split('/').at(-1)}`, response.status() === 200);
      }
    }
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ origin, checks }, null, 2));
} finally { await browser.close(); }
