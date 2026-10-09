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
  await frames(page);
}
async function frames(activePage) {
  await activePage.waitForFunction(
    () =>
      /FPS:\s*\d/.test(
        document.querySelector('.hud-fps-text')?.textContent ?? '',
      ),
    null,
    { timeout: 120000 },
  );
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
  if (process.env.MENU_UNDERWATER === '1') {
    await mkdir('output/localhost-menu', { recursive: true });
    report.underwater = [];
    for (const [mapId, saveId, retired] of [
      ['sunken-ruins', 'sunken-ruins', false],
      ['deep-ocean-underwater-v1', 'deep-ocean-underwater-v1', false],
      ['abysal-trench-underwater-v1', 'abysal-trench-underwater-v1', false],
      ['sunken-ruins', 'sunken-ruins', true],
      ['sunken-ruins', 'sunken-ruins-underwater-v1', false],
    ]) {
      const underwaterPage = await browser.newPage();
      underwaterPage.on('pageerror', (e) => errors.push(e.message));
      underwaterPage.on('response', (r) => {
        if (r.status() >= 400)
          failedRequests.push({ url: r.url(), status: r.status() });
      });
      try {
        await underwaterPage.addInitScript(
          ({ collection, mapId, saveId, retired }) => {
            const hero = collection.characters[collection.activeSlot];
            Object.assign(hero, {
              level: 60,
              inCity: false,
              currentCity: 'jayantara',
              currentField: saveId,
              x: mapId === 'sunken-ruins' ? 45 : 0,
              z: mapId === 'sunken-ruins' ? 225 : 320,
            });
            if (retired) {
              delete hero.sunkenLayoutVersion;
              hero.x = 58;
              hero.z = -56;
            }
            hero.lastSafePosition = { x: hero.x, z: hero.z };
            hero.unlockedFields = [
              ...new Set([...hero.unlockedFields, saveId]),
            ];
            localStorage.setItem(
              'lumenfall-saves-v3',
              JSON.stringify(collection),
            );
          },
          { collection: savedId, mapId, saveId, retired },
        );
        await underwaterPage.goto(
          process.env.MENU_BASE_URL ?? 'http://localhost:3000',
        );
        const continueButton = underwaterPage.getByRole('button', {
          name: 'CONTINUE',
          exact: true,
        });
        await continueButton.waitFor();
        await underwaterPage.waitForFunction(
          () =>
            [...document.querySelectorAll('button')].some(
              (b) => b.textContent === 'CONTINUE' && !b.disabled,
            ),
          null,
          { timeout: 90000 },
        );
        await continueButton.click();
        await underwaterPage
          .locator(`main.game-shell.flow-world[data-map-id="${mapId}"]`)
          .waitFor({ timeout: 120000 });
        await frames(underwaterPage);
        if (mapId === 'sunken-ruins') {
          await underwaterPage.keyboard.press('m');
          const cards = underwaterPage.locator('.region-card');
          assert.equal(
            await cards
              .filter({
                has: underwaterPage.getByRole('heading', {
                  name: 'Sunken Ruins',
                  exact: true,
                }),
              })
              .count(),
            1,
          );
          assert.equal(
            await cards
              .filter({
                has: underwaterPage.getByRole('heading', {
                  name: 'Reruntuhan Tenggelam',
                  exact: true,
                }),
              })
              .count(),
            0,
          );
          assert.equal(
            await cards
              .filter({
                has: underwaterPage.getByRole('heading', {
                  name: 'Deep Ocean',
                  exact: true,
                }),
              })
              .count(),
            0,
          );
          assert.equal(
            await cards
              .filter({
                has: underwaterPage.getByRole('heading', {
                  name: 'Abysal Trench',
                  exact: true,
                }),
              })
              .count(),
            0,
          );
          await underwaterPage.keyboard.press('m');
        }
        await underwaterPage.screenshot({
          path: `output/localhost-menu/${mapId}${retired ? '-retired' : saveId !== mapId ? '-preview-save' : ''}.png`,
        });
        report.underwater.push({ mapId, saveId, retired, continued: true });
      } finally {
        await underwaterPage.close();
      }
    }
  }
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
