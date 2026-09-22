// Regression for the actual Phase 3B bug: a foreground K dialog covered its drop destination.
// Start warrior-world.config.ts first. No normal player storage or live app route is used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? require(process.env.PLAYWRIGHT_MODULE)
  : require('playwright');
const origin = process.env.WARRIOR_TEST_URL || 'http://127.0.0.1:3003';
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Local development only',
);
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: 'chrome' }),
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/warrior-world.html?level=59&build=general`);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForFunction(() => window.__warriorQA?.game?.started);
  await page.evaluate(() => window.__warriorQA.game.pause(true));
  await page.keyboard.press('k');
  await page.getByRole('button', { name: 'Edit Mode hotbar' }).click();
  const source = page.locator('[data-skill-id="v2-warrior-strike"]');
  const destination = page.locator('[data-primary-slot="0"]');
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(),
    b = await destination.boundingBox();
  assert.ok(a && b);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  // This used to return the dialog instead of the hotbar while the pointer was dragging.
  assert.equal(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[data-primary-slot]')
          ?.getAttribute('data-primary-slot'),
      { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    ),
    '0',
  );
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__warriorQA.game.hero.primaryHotbar[0] === 'v2-warrior-strike',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    (await context.storageState()).origins,
    [],
    'Native player storage remains untouched',
  );
  await mkdir('output/warrior-phase3b', { recursive: true });
  await page.screenshot({ path: 'output/warrior-phase3b/drag-regression.png' });
  console.log(
    'PASS: real Home/K → hotbar pointer drag; no native save writes; no runtime errors',
  );
} finally {
  await browser.close();
}
