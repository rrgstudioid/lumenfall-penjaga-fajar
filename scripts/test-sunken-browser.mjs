import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
await mkdir('output/sunken-ruins', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 2000));
});
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken ||
      window.__sunkenQA?.game?.regionLoadError,
    null,
    { timeout: 120000 },
  );
  const status = await page.evaluate(async () => {
    const g = window.__sunkenQA.game;
    await g.characterModel.ready;
    return {
      error: String(g.regionLoadError ?? ''),
      map: g.activeLocationId,
      model: g.actor.userData.modelStatus,
      mode: g.actor.userData.movementMode,
      metrics: g.sunken?.metrics(),
    };
  });
  console.log(JSON.stringify(status));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'output/sunken-ruins/slice-idle.png' });
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'output/sunken-ruins/slice-swim.png' });
  await page.keyboard.up('w');
  const combat = await page.evaluate(() =>
    window.__sunkenQA.combat.runParity(window.__sunkenQA.game),
  );
  const lifecycle = await page.evaluate(() =>
    window.__sunkenQA.combat.runMonsterLifecycle(window.__sunkenQA.game),
  );
  const defense = await page.evaluate(() =>
    window.__sunkenQA.combat.runDefenseParity(window.__sunkenQA.game),
  );
  await writeFile(
    'output/sunken-ruins/combat-parity.json',
    JSON.stringify({ combat, lifecycle, defense }, null, 2),
  );
  console.log(
    JSON.stringify({
      combat: combat.length,
      accepted: combat.filter((r) => r.ground.accepted).length,
      failed: combat.filter((r) => !r.equal),
      lifecycle,
    }),
  );
  assert.ok(
    combat.every((r) => r.equal),
    'combat parity',
  );
  assert.ok(
    defense.every((r) => r.equal),
    'defense parity',
  );
  assert.ok(
    lifecycle.valid &&
      lifecycle.attacked &&
      lifecycle.returned &&
      lifecycle.died &&
      lifecycle.respawned &&
      lifecycle.rootOnFloor &&
      lifecycle.noRewards,
    'monster lifecycle',
  );
  console.log(JSON.stringify({ errors }));
  await writeFile(
    'output/sunken-ruins/slice-smoke.json',
    JSON.stringify({ status, errors }, null, 2),
  );
  assert.equal(status.error, '');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
