import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  results = [];
try {
  for (const map of [
    'deep-ocean-underwater-v1',
    'abysal-trench-underwater-v1',
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    await page.goto(`http://127.0.0.1:3002/sunken-ruins.html?map=${map}`);
    await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await page.waitForFunction(
      () =>
        window.__sunkenQA?.game?.sunken &&
        !window.__sunkenQA.game.transitioning,
      null,
      { timeout: 120000 },
    );
    for (const quality of ['office', 'light', 'balanced', 'high']) {
      await page.evaluate(
        ({ map, quality }) => {
          const { game: g } = window.__sunkenQA;
          g.setGraphicsQuality(quality, false);
          g.setCameraMode('free');
          g.invincible = 99999;
          Object.assign(
            g.hero,
            map.startsWith('deep') ? { x: -220, z: -280 } : { x: 130, z: -130 },
          );
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          g.renderPerformance.reset();
        },
        { map, quality },
      );
      await page.waitForTimeout(1500);
      await page.evaluate(() =>
        window.__sunkenQA.game.renderPerformance.reset(),
      );
      await page.waitForTimeout(6000);
      results.push(
        await page.evaluate(() => {
          const g = window.__sunkenQA.game;
          return {
            ...g.getPerformanceDiagnostics(),
            population: g.enemies.length,
            visibleEnemies: g.enemies.filter((e) => e.group.visible).length,
          };
        }),
      );
    }
    await page.close();
  }
} finally {
  await writeFile(
    'output/sunken-ruins/revision11/performance-smoke.json',
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
