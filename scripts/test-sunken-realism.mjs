import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
await mkdir('output/sunken-ruins/realism', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__sunkenQA?.game?.sunken);
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  const checks = await page.evaluate(() => {
    const { game: g, three: T } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.setGraphicsQuality('high', false);
    const capture = () => {
      const result = {};
      g.sunken.root.traverse((o) => {
        if (o.userData.marineIds) {
          const m = new T.Matrix4();
          o.userData.marineIds.forEach((id, i) => {
            o.getMatrixAt(i, m);
            result[id] = m.toArray();
          });
        }
      });
      return result;
    };
    const h = { x: 60, z: 222 };
    g.sunken.update(g.followCamera, h, 0.1);
    const before = capture();
    g.sunken.update(g.followCamera, { x: 80, z: 232 }, 0);
    const after = capture();
    const common = Object.keys(before).filter((id) => after[id]);
    const stable = common.every(
      (id) => JSON.stringify(before[id]) === JSON.stringify(after[id]),
    );
    g.sunken.update(g.followCamera, h, 0.1);
    return {
      sharedMarineActors: common.length,
      stable,
      enemies: g.enemies.length,
      kit: g.sunken.metrics(),
      lighting: {
        background: g.scene.background.getHexString(),
        fogNear: g.scene.fog.near,
        fogFar: g.scene.fog.far,
        exposure: g.renderer.toneMappingExposure,
      },
    };
  });
  assert.ok(checks.stable && checks.sharedMarineActors >= 10);
  assert.equal(checks.enemies, 324);
  for (const shot of ['reef-detail', 'sunlight', 'wildlife', 'overhead']) {
    const data = await page.evaluate((shot) => {
      const { game: g, three: T } = window.__sunkenQA;
      let target;
      if (shot === 'reef-detail') {
        const choices = [],
          m = new T.Matrix4(),
          p = new T.Vector3();
        g.sunken.root.traverse((o) => {
          if (o.userData.prototype === 'coral_plate')
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m);
              p.setFromMatrixPosition(m);
              choices.push({
                x: p.x,
                y: p.y,
                z: p.z,
                d: Math.hypot(p.x - 60, p.z - 222),
              });
            }
        });
        choices.sort((a, b) => a.d - b.d);
        target = choices[0];
      } else if (shot === 'wildlife') {
        const fish = g.sunken.root.getObjectByName('World marine fish'),
          m = new T.Matrix4();
        fish.getMatrixAt(0, m);
        const p = new T.Vector3().setFromMatrixPosition(m);
        target = { x: p.x, y: p.y, z: p.z };
      } else target = { x: 60, y: 15, z: 222 };
      g.sunken.update(g.followCamera, target, 0);
      const camera = new T.PerspectiveCamera(
        shot === 'reef-detail' ? 48 : 60,
        1440 / 900,
        0.1,
        1000,
      );
      camera.position.set(
        target.x + (shot === 'sunlight' ? 7 : 4),
        target.y +
          (shot === 'reef-detail' ? 2.8 : shot === 'sunlight' ? -10 : 1),
        target.z + (shot === 'reef-detail' ? 6 : shot === 'sunlight' ? 20 : 6),
      );
      if (shot === 'overhead') camera.position.set(target.x, 90, target.z + 30);
      camera.lookAt(
        target.x,
        target.y + (shot === 'reef-detail' ? 1 : 0),
        target.z,
      );
      g.renderer.setSize(1440, 900, false);
      g.renderer.render(g.scene, camera);
      return g.renderer.domElement.toDataURL('image/png');
    }, shot);
    await writeFile(
      `output/sunken-ruins/realism/${shot}.png`,
      Buffer.from(data.split(',')[1], 'base64'),
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    'output/sunken-ruins/realism/validation.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
