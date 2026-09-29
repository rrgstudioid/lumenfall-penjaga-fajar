import assert from 'node:assert/strict';
// Same bundled browser runner as the existing isolated UI acceptance fixtures.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const sidebar = page.locator('.js-sidebar > button');
const title = page.locator('.js-tree-scroll h2');
const stages = async () => sidebar.locator('b').allTextContents();
let scenarios = 0;
try {
  await page.goto(process.env.FIXTURE_URL ?? 'http://127.0.0.1:3002/job-skill-lineage.html');
  await page.locator('[data-ready="true"]').waitFor();
  assert.deepEqual(await stages(), ['Adventurer']);
  assert.equal(await title.textContent(), 'Adventurer');
  assert.equal(await page.locator('[data-skill-id^="v3-adventurer-"]').count(), 3);
  scenarios++;
  await page.getByRole('button', { name: 'Warrior Lv30', exact: true }).click();
  assert.deepEqual(await stages(), ['Adventurer', 'Warrior', 'Berserker / Blade Master']);
  assert.equal(await title.textContent(), 'Warrior');
  assert.match(await sidebar.nth(2).textContent(), /Locked/);
  assert.equal(await page.locator('[data-skill-id^="v3-warrior-"]').count(), 11);
  scenarios++;
  await page.getByRole('button', { name: 'Thief Lv30', exact: true }).click();
  assert.deepEqual(await stages(), ['Adventurer', 'Thief', 'Rogue / Assasin']);
  assert.equal(await title.textContent(), 'Thief');
  assert.match(await sidebar.nth(2).textContent(), /Locked/);
  assert.equal(await page.locator('.js-family-card').count(), 9);
  assert.equal(await page.locator('[data-skill-id^="v3-thief-"]').count(), 4);
  assert.equal(await page.locator('[data-skill-id^="v3-warrior-"]').count(), 0);
  // Clicking ancestry and then loadout must select the right family and details.
  await sidebar.nth(0).click();
  assert.equal(await title.textContent(), 'Adventurer');
  await page.locator('[data-loadout-skill="v3-thief-quick-stab"]').click();
  assert.equal(await title.textContent(), 'Thief');
  assert.equal(await page.locator('.js-detail h3').textContent(), 'Quick Stab');
  assert.equal(await page.locator('[data-skill-id="v3-thief-quick-stab"]').getAttribute('aria-pressed'), 'true');
  scenarios++;
  await sidebar.nth(2).click();
  assert.equal(await page.locator('.js-stage-empty').count(), 1);
  assert.equal(await page.locator('[data-skill-id]').count(), 0);
  await page.getByRole('button', { name: 'Thief Lv60', exact: true }).click();
  assert.match(await sidebar.nth(2).textContent(), /Available/);
  scenarios++;
  for (const [id, name] of [['berserker','Berserker'], ['blade_master','Blade Master'], ['rogue','Rogue'], ['assasin','Assasin']]) {
    await page.getByRole('button', { name: id, exact: true }).click();
    assert.equal(await title.textContent(), name);
    assert.match(await sidebar.nth(2).textContent(), /Current/);
    assert.match(await sidebar.nth(1).textContent(), /Completed/);
    assert.equal(await page.locator(`[data-skill-id^="v3-${id.replaceAll('_','-')}-"]`).count(), 9);
    await sidebar.nth(1).click();
    assert.equal(await title.textContent(), id === 'rogue' || id === 'assasin' ? 'Thief' : 'Warrior');
    scenarios++;
  }
  // Reset while a family is selected: no stale Thief selection or detail.
  await page.getByRole('button', { name: 'Adventurer Lv1', exact: true }).click();
  assert.deepEqual(await stages(), ['Adventurer']);
  assert.equal(await title.textContent(), 'Adventurer');
  assert.equal(await page.locator('.js-family-card').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  scenarios++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', scenarios, browserErrors: errors, saveUntouched: true }));
} finally { await browser.close(); }
