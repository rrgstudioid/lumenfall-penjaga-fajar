import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  errors = [],
  report = [];
const out = process.env.SUNKEN_ZONES_OUTPUT ?? 'output/sunken-ruins';
await mkdir(out, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__sunkenQA?.game?.sunken);
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  for (const quality of ['office', 'light', 'balanced', 'high'])
    for (const [zone, x, z] of [
      [1, 60, 222],
      [2, -102, 113],
      [3, 95, -110],
      [4, -243, -248],
      [5, 40, -405],
    ]) {
      await page.evaluate(
        ({ quality, x, z }) => {
          const g = window.__sunkenQA.game;
          g.setGraphicsQuality(quality, false);
          Object.assign(g.hero, g.sunken.navigation.restore({ x, z }));
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
          g.invincible = 0;
          g.setCameraMode('follow');
          Object.assign(g.followView, {
            distance: 22,
            targetDistance: 22,
            pitch: 0.55,
            targetPitch: 0.55,
            yaw: -0.4,
            targetYaw: -0.4,
          });
        },
        { quality, x, z },
      );
      await page.waitForTimeout(350);
      await page.screenshot({
        path: `${out}/zone-${zone}-${quality}.png`,
      });
      report.push(
        await page.evaluate(() => {
          const g = window.__sunkenQA.game;
          return {
            position: [g.hero.x, g.hero.z],
            quality: g.graphicsQuality,
            shadow: g.renderer.shadowMap.enabled,
            actors: g.enemies.length,
            mode: g.actor.userData.movementMode,
            ...g.getPerformanceDiagnostics().render,
          };
        }),
      );
    }
  assert.deepEqual(errors, []);
  assert.ok(report.every((r) => r.actors === 324 && r.mode === 'underwater'));
  assert.ok(
    report.filter((r) => r.quality === 'office').every((r) => !r.shadow),
  );
  // Diagram evidence uses the exact runtime geometry with culling disabled for this one render.
  const overview = await page.evaluate(() => {
    const { game: g, three: T } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.scene.fog = null;
    g.sunken.root.traverse((o) => (o.visible = true));
    g.sunken.root.getObjectByName('World water surface').visible = false;
    const camera = new T.OrthographicCamera(-560, 560, 560, -560, 1, 2000);
    camera.position.set(0, 1100, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    g.renderer.setSize(1200, 1200, false);
    g.renderer.render(g.scene, camera);
    return g.renderer.domElement.toDataURL('image/png');
  });
  await writeFile(
    `${out}/layout-overview.png`,
    Buffer.from(overview.split(',')[1], 'base64'),
  );
  await writeFile(
    `${out}/zones.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify({ screenshots: report.length, errors }));
} finally {
  await browser.close();
}
