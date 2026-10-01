import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/global-graphics';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: 1200, height: 800 },
  deviceScaleFactor: 2,
});
const errors = [],
  report = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const ready = async () => {
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started && !window.__wildsQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  assert.equal(
    await page.evaluate(() =>
      String(window.__wildsQA.game.regionLoadError ?? ''),
    ),
    '',
  );
};
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await ready();
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.hero.level = 50;
    g.hurtHero = () => {};
  });
  for (const map of [
    'whispering-wilds-v2',
    'arunika',
    'verdant-plains-v2',
    'averion',
    'frostfire-highlands',
    'jayantara',
    'ironveil-mines',
    'sunken-ruins',
    'meteorfall-citadel',
    'east-gate-arunika',
  ]) {
    if (map !== 'whispering-wilds-v2') {
      await page.evaluate(
        (map) => window.__wildsQA.game.changeRegion(map),
        map,
      );
      await ready();
      assert.equal(
        await page.evaluate(() => window.__wildsQA.game.graphicsQuality),
        'high',
        'selection survives map transition',
      );
    }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByRole('button', { name: 'Graphics', exact: true }).click();
    const presets = page.locator('.graphics-presets');
    await presets.waitFor();
    assert.deepEqual((await presets.innerText()).trim().split(/\s+/), [
      'Low',
      'Medium',
      'High',
      'Ultra',
    ]);
    assert.equal(await presets.getByRole('radio').count(), 4);
    await presets.getByRole('radio', { name: 'Ultra', exact: true }).check();
    for (const [id, label] of [
      ['office', 'Low'],
      ['light', 'Medium'],
      ['balanced', 'High'],
      ['high', 'Ultra'],
    ]) {
      await presets.getByRole('radio', { name: label, exact: true }).check();
      const state = await page.evaluate(() => {
        const { game: g, three: T } = window.__wildsQA;
        let shadowSize = 0;
        g.worldLightRig.traverse((o) => {
          if (o instanceof T.DirectionalLight) shadowSize = o.shadow.mapSize.x;
        });
        return {
          quality: g.graphicsQuality,
          label: g.getPerformanceDiagnostics().qualityLabel,
          shadow: g.renderer.shadowMap.enabled,
          shadowSize,
          ratio: g.renderer.getPixelRatio(),
          native: g.wilds?.quality ?? g.plains?.quality ?? null,
          saved: localStorage.getItem('lumenfall:graphics-quality:v1'),
        };
      });
      assert.equal(state.quality, id);
      assert.equal(state.label, label);
      assert.equal(state.saved, id);
      if (state.native) assert.equal(state.native, id);
      assert.equal(state.shadow, id === 'balanced' || id === 'high');
      assert(
        Math.abs(
          state.ratio -
            {
              office: Math.sqrt((1280 * 720) / (1200 * 800)),
              light: 1,
              balanced: 1.25,
              high: 1.5,
            }[id],
        ) < 0.0001,
      );
      if (state.shadow)
        assert.equal(state.shadowSize, id === 'high' ? 2048 : 1024);
      report.push({ map, ...state });
    }
    if (map === 'whispering-wilds-v2' || map === 'arunika')
      await page.screenshot({ path: `${output}/${map}.png` });
    await page.keyboard.press('Escape');
    console.log(`PASS ${map}: Low / Medium / High / Ultra`);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(
    'PASS all ten maps, four working presets, saved global choice and map transitions',
  );
} finally {
  await browser.close();
}
