import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision11';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto(
    'http://127.0.0.1:3002/sunken-ruins.html?map=abysal-trench-underwater-v1',
  );
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
  const result = await page.evaluate(async () => {
    const { game: g, rules, three: T, trenchLayout: l } = window.__sunkenQA;
    const wings = rules.createItem('dragon-veil-wings');
    g.hero.inventory.push(wings);
    if (!rules.equipItem(g.hero, wings.id, 'accessory').ok)
      throw Error('Cannot equip wings');
    g.rebuildHeroAppearance();
    await g.characterModel.ready;
    cancelAnimationFrame(g.frame);
    const render = g.renderer.render.bind(g.renderer),
      moveVector = g.moveVector.bind(g);
    g.renderer.render = () => {};
    const results = [];
    for (const mode of ['follow', 'free'])
      for (const fps of [30, 60]) {
        g.setCameraMode(mode);
        Object.assign(g.hero, { x: 0, z: 320 });
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
        g.followView.yaw = g.followView.targetYaw = 0;
        g.followView.pitch = g.followView.targetPitch = 0.38;
        g.followView.distance = g.followView.targetDistance = 10;
        g.yaw = 0;
        g.pitch = 0.6;
        let time = g.lastTime || performance.now(),
          frames = 0,
          minClearance = Infinity;
        const step = () => {
          time += 1000 / fps;
          g.tick(time);
          cancelAnimationFrame(g.frame);
        };
        g.moveVector = (v = new T.Vector3()) => v.set(0, 0, 0);
        for (let i = 0; i < fps; i++) step();
        for (const p of [
          ...l.ABYSAL_TRENCH_PATH.slice(1),
          l.ABYSAL_TRENCH_ARENA,
        ]) {
          let steps = 0;
          while (
            Math.hypot(g.hero.x - p.x, g.hero.z - p.z) > 1.5 &&
            steps++ < fps * 10
          ) {
            g.moveVector = (v = new T.Vector3()) =>
              v.set(p.x - g.hero.x, 0, p.z - g.hero.z).normalize();
            step();
            frames++;
            if (!g.sunken.navigation.valid(g.hero))
              throw Error('Wings escaped plates');
            minClearance = Math.min(
              minClearance,
              g.camera.position.y -
                g.groundHeight(g.camera.position.x, g.camera.position.z),
            );
          }
          if (steps >= fps * 10) throw Error('Route did not reach waypoint');
        }
        results.push({
          mode,
          fps,
          frames,
          minClearance,
          x: g.hero.x,
          z: g.hero.z,
        });
      }
    g.renderer.render = render;
    g.moveVector = moveVector;
    return { results, speed: rules.derivedStats(g.hero).movementSpeed };
  });
  assert.ok(result.speed >= 600);
  assert.ok(result.results.every((p) => p.minClearance >= 1.19));
  for (const quality of ['office', 'light', 'balanced', 'high']) {
    const png = await page.evaluate((quality) => {
      const { game: g, three: T } = window.__sunkenQA;
      g.sunken.setQuality(quality);
      Object.assign(g.hero, { x: 60, z: -355 });
      g.placeActor();
      const y = g.groundHeight(60, -355),
        c = new T.PerspectiveCamera(58, 1440 / 900, 0.1, 2200);
      c.position.set(105, y + 58, -290);
      c.lookAt(60, y, -355);
      g.sunken.update(c, g.hero, 0);
      g.renderer.render(g.scene, c);
      return g.renderer.domElement.toDataURL();
    }, quality);
    await writeFile(
      `${out}/arena-${quality}.png`,
      Buffer.from(png.split(',')[1], 'base64'),
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/tectonic-camera.json`,
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
