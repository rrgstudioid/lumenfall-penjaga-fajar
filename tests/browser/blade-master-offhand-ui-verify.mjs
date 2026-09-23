import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const url = process.env.FIXTURE_URL ?? 'http://127.0.0.1:3002/blade-master-offhand-ui.html';
const outDir = path.resolve('tests/browser/blade-master-offhand-ui-evidence');
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: process.env.HEADLESS === '1',
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const consoleWarnings = [];
const pageErrors = [];
const failedRequests = [];
const httpFailures = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`${message.text()} @ ${message.location().url}`);
  if (message.type() === 'warning') consoleWarnings.push(`${message.text()} @ ${message.location().url}`);
});
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('requestfailed', (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', (response) => {
  if (response.status() >= 400) httpFailures.push(`${response.status()} ${response.url()}`);
});

const evidence = { cases: {}, browser: '', boot: '', saveIsolation: false, consoleErrors, consoleWarnings, pageErrors, failedRequests, httpFailures };
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-boot-stage="ready"]').waitFor({ timeout: 30000 });
  evidence.boot = await page.locator('[data-boot-stage]').getAttribute('data-boot-stage');
  const originalSaves = await page.evaluate(() => [
    localStorage.getItem('lumenfall-saves-v3'),
    localStorage.getItem('lumenfall-saves-v2'),
    localStorage.getItem('lumenfall-save-v1'),
  ]);
  const state = page.getByTestId('fixture-state');
  const mainId = await state.getAttribute('data-main-id');
  assert.ok(mainId);
  assert.equal(await state.getAttribute('data-off-id'), '');
  assert.equal(await state.getAttribute('data-mastery-rank'), '1');

  await page.getByRole('button', { name: 'Off Hand: Empty' }).click();
  const picker = page.getByRole('dialog', { name: 'Off Hand' });
  await picker.waitFor();
  assert.equal(await picker.locator('.cs-candidate').count(), 2);
  assert.equal(await picker.getByRole('button', { name: /Dawnblade Legacy/ }).count(), 1);
  assert.equal(await picker.getByRole('button', { name: /Ironveil Shield Rare/ }).count(), 1);
  assert.equal(await picker.getByText('Available equipment').count(), 1);
  await page.screenshot({ path: path.join(outDir, '01-offhand-picker.png'), fullPage: true });
  evidence.cases.picker = { candidates: ['Dawnblade Sword B', 'Ironveil Shield'], mainId, mainExcluded: true };

  await picker.getByRole('button', { name: /Dawnblade Legacy/ }).click();
  await picker.getByRole('button', { name: 'Equip', exact: true }).click();
  await page.getByRole('button', { name: 'Off Hand: Dawnblade' }).waitFor();
  const offId = await state.getAttribute('data-off-id');
  assert.ok(offId);
  assert.notEqual(mainId, offId);
  assert.equal(await state.getAttribute('data-main-id'), mainId);
  assert.equal(await state.getAttribute('data-weapon-style'), 'dual_sword');
  assert.equal(await state.getAttribute('data-twin-weapon-valid'), 'true');
  const itemBeforeReload = await page.evaluate((id) => {
    const raw = sessionStorage.getItem('lumenfall:dev-fixture:blade-master-offhand-ui:v1');
    return raw ? JSON.parse(raw).inventory.find((item) => item.id === id) : null;
  }, offId);
  assert.ok(itemBeforeReload);
  await page.screenshot({ path: path.join(outDir, '02-sword-b-equipped.png'), fullPage: true });
  await page.getByRole('button', { name: 'Main Weapon: Dawnblade' }).waitFor();
  await page.screenshot({ path: path.join(outDir, '03-both-hands-overview.png'), fullPage: true });
  evidence.cases.dualEquip = { mainId, offId, weaponStyle: 'dual_sword', twinWeaponValid: true };

  await page.getByRole('button', { name: 'Job Skill K' }).click();
  await page.locator('[data-skill-id="v3-blade-master-twin-assault"]').click();
  await page.getByText('Dual One-Hand Swords', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(outDir, '04-twin-assault-requirement.png'), fullPage: true });
  evidence.cases.skillRequirement = { label: 'Dual One-Hand Swords', weaponValid: true };

  await page.getByRole('button', { name: 'Save & Reload Fixture' }).click();
  await page.locator('[data-boot-stage="ready"][data-fixture-source="isolated-storage"]').waitFor({ timeout: 30000 });
  const reloaded = page.getByTestId('fixture-state');
  assert.equal(await reloaded.getAttribute('data-main-id'), mainId);
  assert.equal(await reloaded.getAttribute('data-off-id'), offId);
  assert.equal(await reloaded.getAttribute('data-weapon-style'), 'dual_sword');
  await page.getByRole('button', { name: 'Off Hand: Dawnblade' }).waitFor();
  const itemAfterReload = await page.evaluate((id) => {
    const raw = sessionStorage.getItem('lumenfall:dev-fixture:blade-master-offhand-ui:v1');
    return raw ? JSON.parse(raw).inventory.find((item) => item.id === id) : null;
  }, offId);
  assert.deepEqual(itemAfterReload, itemBeforeReload);
  await page.locator('.character-preview-canvas canvas').waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, '05-after-isolated-reload.png'), fullPage: true });
  evidence.cases.reload = { mainId, offId, source: 'isolated-storage', itemDataPreserved: true };

  await page.getByRole('button', { name: 'Refund Twin Blade Mastery R1' }).click();
  await page.getByRole('button', { name: 'Off Hand: Empty' }).waitFor();
  assert.equal(await reloaded.getAttribute('data-main-id'), mainId);
  assert.equal(await reloaded.getAttribute('data-off-id'), '');
  assert.equal(await reloaded.getAttribute('data-mastery-rank'), '0');
  const stored = await page.evaluate(() => {
    const raw = sessionStorage.getItem('lumenfall:dev-fixture:blade-master-offhand-ui:v1');
    return raw ? JSON.parse(raw) : null;
  });
  const unequippedItem = stored.inventory.find((item) => item.id === offId);
  assert.ok(unequippedItem && !unequippedItem.isEquipped);
  assert.deepEqual({ ...unequippedItem, isEquipped: true }, itemBeforeReload);
  assert.equal(stored.equipment.mainHand, mainId);
  assert.equal(stored.equipment.offHand, null);
  await page.screenshot({ path: path.join(outDir, '06-mastery-loss-safe-unequip.png'), fullPage: true });
  evidence.cases.masteryLoss = { mainId, offIdInInventory: true, offHandCleared: true };

  const finalSaves = await page.evaluate(() => [
    localStorage.getItem('lumenfall-saves-v3'),
    localStorage.getItem('lumenfall-saves-v2'),
    localStorage.getItem('lumenfall-save-v1'),
  ]);
  evidence.saveIsolation = JSON.stringify(originalSaves) === JSON.stringify(finalSaves);
  assert.equal(evidence.saveIsolation, true);
  evidence.browser = await browser.version();
  evidence.status = consoleErrors.length || consoleWarnings.length || pageErrors.length || failedRequests.length || httpFailures.length ? 'FAIL' : 'PASS';
} catch (error) {
  evidence.status = 'FAIL';
  evidence.failure = String(error);
} finally {
  await fs.writeFile(path.join(outDir, 'validation.json'), JSON.stringify(evidence, null, 2));
  await browser.close();
}
console.log(JSON.stringify(evidence, null, 2));
if (evidence.status !== 'PASS') process.exitCode = 1;
