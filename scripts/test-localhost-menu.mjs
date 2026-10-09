import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
// A fresh isolated context never reads or changes the owner's character saves.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  failedRequests = [],
  report = {};
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400)
    failedRequests.push({ url: r.url(), status: r.status() });
});
const button = (name) => page.getByRole('button', { name, exact: true });
async function ready() {
  await button('NEW GAME').waitFor();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some(
        (b) => b.textContent === 'NEW GAME' && !b.disabled,
      ),
    null,
    { timeout: 90000 },
  );
}
async function world() {
  await page.locator('main.game-shell.flow-world').waitFor({ timeout: 120000 });
}
try {
  await page.goto(process.env.MENU_BASE_URL ?? 'http://localhost:3000');
  await ready();
  assert.equal(await button('CONTINUE').isDisabled(), true);
  await button('NEW GAME').click();
  await button('CREATE CHARACTER').click();
  await page
    .getByLabel('CHARACTER NAME', { exact: true })
    .fill('Menu Regression');
  await button('CREATE CHARACTER').click();
  await world();
  report.newGame = true;
  const savedId = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lumenfall-saves-v3')),
  );
  assert.ok(JSON.stringify(savedId).includes('Menu Regression'));
  await page.reload();
  await ready();
  assert.equal(await button('CONTINUE').isDisabled(), false);
  await button('CONTINUE').click();
  await world();
  report.continue = true;
  await page.reload();
  await ready();
  await button('LOAD GAME').click();
  await button('ENTER WORLD').click();
  await world();
  report.loadGame = true;
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  console.log(JSON.stringify({ ...report, errors, failedRequests }));
} finally {
  await mkdir('output/localhost-menu', { recursive: true });
  await writeFile(
    'output/localhost-menu/browser.json',
    JSON.stringify({ ...report, errors, failedRequests }, null, 2),
  );
  await page.screenshot({ path: 'output/localhost-menu/final.png' });
  await browser.close();
}
