import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ??
      'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/sunken-ruins/revision3';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3002/sunken-ruins.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__sunkenQA?.game?.sunken, null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  const checks = await page.evaluate(() => {
    const { game: g, three: T, sunkenLayout: l } = window.__sunkenQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    const reef = l.SUNKEN_REEFS.find((p) => p.name === 'reef_cluster');
    const from = g.sunken.navigation.restore({
      x: reef.x - reef.radius - 2,
      z: reef.z,
    });
    const moved = g.sunken.move(from, reef.x - from.x, reef.z - from.z);
    const physical = l.SUNKEN_REEFS.filter((p) => p.radius > 0);
    const instances = [],
      stats = [];
    for (const quality of ['office', 'light', 'balanced', 'high']) {
      g.setGraphicsQuality(quality, false);
      g.sunken.update(g.followCamera, reef, 0);
      const instance = g.sunken.root.getObjectByName(
        `${Math.floor(reef.x / 64)},${Math.floor(reef.z / 64)}:reef_cluster:coral`,
      );
      instances.push({
        quality,
        count: instance.count,
        total: instance.userData.total,
      });
    }
    g.sunken.root.traverse((o) => {
      if (
        !(o instanceof T.InstancedMesh) ||
        !['reef_cluster', 'pillar'].includes(o.userData.prototype) ||
        stats.some((s) => s.name === o.userData.prototype)
      )
        return;
      const c = o.geometry.getAttribute('color');
      const min = [1, 1, 1],
        max = [0, 0, 0];
      if (c)
        for (let i = 0; i < c.count; i++)
          for (let j = 0; j < 3; j++) {
            const v = c.getComponent(i, j);
            min[j] = Math.min(min[j], v);
            max[j] = Math.max(max[j], v);
          }
      stats.push({
        name: o.userData.prototype,
        imported: o.userData.imported,
        uv: !!o.geometry.getAttribute('uv'),
        albedo: !!o.material.map,
        normal: !!o.material.normalMap,
        roughness: !!o.material.roughnessMap,
        textureSize: o.material.map
          ? [o.material.map.image.width, o.material.map.image.height]
          : null,
        vertices: o.geometry.getAttribute('position').count,
        colors: !!c,
        min,
        max,
      });
    });
    return {
      metrics: g.sunken.metrics(),
      collision:
        l.sunkenWalkable(moved) &&
        Math.hypot(moved.x - reef.x, moved.z - reef.z) >= reef.radius + 0.44,
      instances,
      stats,
      solidCount: physical.length,
      enemies: g.enemies.length,
    };
  });
  assert.ok(checks.collision);
  assert.ok(checks.instances.every((s) => s.count === s.total));
  assert.equal(checks.enemies, 324);
  assert.equal(checks.stats.length, 2);
  assert.ok(
    checks.stats.every(
      (s) => s.imported && s.uv && s.albedo && s.normal && s.roughness,
    ),
  );
  assert.ok(checks.stats.every((s) => s.textureSize.every((n) => n <= 2048)));
  for (const shot of [
    'reef-garden',
    'ruin-column',
    'cleared-ruins',
    'sand-boundary',
    'broad-avenue',
    'layout',
  ]) {
    const data = await page.evaluate((shot) => {
      const { game: g, three: T, sunkenLayout: l } = window.__sunkenQA;
      g.setGraphicsQuality('high', false);
      let target = { x: 45, z: 110 },
        height = 0;
      if (shot === 'reef-garden')
        target = [...l.SUNKEN_REEFS]
          .filter((p) => p.name === 'reef_cluster')
          .sort(
            (a, b) =>
              Math.hypot(a.x - 45, a.z - 225) - Math.hypot(b.x - 45, b.z - 225),
          )[0];
      if (shot === 'ruin-column') {
        target = l.SUNKEN_OBSTACLES.find((p) => p.kind === 'pillar');
        height = 4;
      }
      if (shot === 'cleared-ruins') {
        target = { x: 10, z: -25 };
      }
      if (shot === 'sand-boundary') {
        target = { x: -100, z: 470 };
        while (l.sunkenFloorDistance(target) > 0) target.z -= 0.25;
        height = 4;
      }
      const ground = l.sunkenGroundHeight(target.x, target.z);
      g.sunken.update(g.followCamera, target, 0);
      const camera = new T.PerspectiveCamera(52, 1440 / 900, 0.1, 2000);
      camera.position.set(target.x + 10, ground + height + 5, target.z + 14);
      if (shot === 'sand-boundary')
        camera.position.set(target.x, ground + 3, target.z - 22);
      if (shot === 'broad-avenue') camera.position.set(45, 7, 160);
      camera.lookAt(
        target.x,
        ground + height + (shot === 'reef-garden' ? 1.8 : 0),
        target.z,
      );
      g.renderer.setSize(1440, 900, false);
      if (shot === 'layout') {
        g.scene.fog = null;
        g.sunken.root.traverse((o) => (o.visible = true));
        g.sunken.root.getObjectByName('World water surface').visible = false;
        const overview = new T.OrthographicCamera(
          -540,
          540,
          540,
          -540,
          1,
          2000,
        );
        overview.position.set(0, 1100, 0);
        overview.up.set(0, 0, -1);
        overview.lookAt(0, 0, 0);
        g.renderer.setSize(1200, 1200, false);
        g.renderer.render(g.scene, overview);
      } else g.renderer.render(g.scene, camera);
      return g.renderer.domElement.toDataURL('image/png');
    }, shot);
    await writeFile(
      `${out}/${shot}.png`,
      Buffer.from(data.split(',')[1], 'base64'),
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/validation.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
}
