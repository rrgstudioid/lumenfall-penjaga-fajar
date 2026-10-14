import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-mushrooms';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.regionLoadError ||
      (window.__wildsQA?.game?.started && !window.__wildsQA.game.transitioning),
  );
  const loadError = await page.evaluate(() =>
    String(window.__wildsQA.game.regionLoadError ?? ''),
  );
  assert.equal(loadError, '', JSON.stringify({ loadError, errors }));
  const state = await page.evaluate(() => {
    const { game: g, three: T, layout: l } = window.__wildsQA;
    g.setWildsQuality('balanced', false);
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(55, 1400 / 900, 0.1, 3000);
    const group = g.scene.getObjectByName('Thirty scattered mushroom trees'),
      matrix = new T.Matrix4(),
      position = new T.Vector3(),
      scale = new T.Vector3(),
      quaternion = new T.Quaternion();
    const placements = [];
    for (const batch of group.children)
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        placements.push({
          variant: batch.userData.mushroomVariant,
          index: i,
          x: position.x,
          y: position.y,
          z: position.z,
          height: scale.y,
          waterDistance: l.wildsWater(position).distance,
          blocked: !g.wilds.navigation.valid(position),
        });
      }
    let trunkPoints = 0;
    g.scene.getObjectByName('Spirit Lake elder tree').traverse((o) => {
      if (o instanceof T.Points) trunkPoints++;
    });
    return {
      placements,
      batches: group.children.length,
      metrics: g.wilds.metrics(),
      trunkPoints,
    };
  });
  assert.equal(state.placements.length, 30);
  assert.equal(state.batches, 5);
  assert.equal(state.trunkPoints, 0);
  assert(state.metrics.iconTree.rainbowBark);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(
      (v) => state.placements.filter((p) => p.variant === v).length,
    ),
    [6, 6, 6, 6, 6],
  );
  let spacing = Infinity;
  state.placements.forEach((p, i) => {
    assert(
      p.waterDistance >= 18 && p.blocked && p.height >= 12 && p.height <= 14.5,
    );
    state.placements
      .slice(i + 1)
      .forEach(
        (q) => (spacing = Math.min(spacing, Math.hypot(p.x - q.x, p.z - q.z))),
      );
  });
  assert(spacing >= 70);
  for (let variant = 0; variant < 5; variant++) {
    await page.evaluate((variant) => {
      const { game: g, three: T } = window.__wildsQA;
      g.paused = false;
      const batch = g.scene.getObjectByName('Thirty scattered mushroom trees')
        .children[variant];
      const matrix = new T.Matrix4(),
        p = new T.Vector3(),
        q = new T.Quaternion(),
        scale = new T.Vector3();
      batch.getMatrixAt(0, matrix);
      matrix.decompose(p, q, scale);
      Object.assign(
        g.hero,
        g.wilds.navigation.restore({ x: p.x + 9, z: p.z + 7 }),
      );
      g.placeActor();
      const offset = new T.Vector3(16, 10, 22).applyQuaternion(q);
      g.camera.position.copy(p).add(offset);
      g.camera.lookAt(p.x, p.y + scale.y * 0.43, p.z);
      g.camera.updateMatrixWorld();
    }, variant);
    await page.waitForTimeout(1800);
    const samples = [];
    for (const phase of [0, 4.5]) {
      const sample = await page.evaluate((phase) => {
        const g = window.__wildsQA.game;
        g.paused = true;
        let remaining =
          (phase - g.wilds.metrics().mushrooms.breathPhase + 9) % 9;
        while (remaining > 0.000001) {
          const step = Math.min(0.1, remaining);
          g.wilds.update(g.camera, g.hero, step, g.renderer.getPixelRatio());
          remaining -= step;
        }
        g.renderer.render(g.scene, g.camera);
        const canvas = document.createElement('canvas');
        canvas.width = g.renderer.domElement.width;
        canvas.height = g.renderer.domElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(g.renderer.domElement, 0, 0);
        const pixels = ctx.getImageData(
          canvas.width * 0.35,
          canvas.height * 0.2,
          canvas.width * 0.3,
          canvas.height * 0.6,
        ).data;
        let brightness = 0;
        for (let i = 0; i < pixels.length; i += 4)
          brightness += Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        return {
          png: canvas.toDataURL().split(',')[1],
          brightness: brightness / (pixels.length / 4),
          intensity: g.wilds.metrics().mushrooms.emissiveIntensity,
        };
      }, phase);
      await writeFile(
        `${output}/in-map-variant-${variant + 1}${phase === 0 ? '-off' : ''}.png`,
        Buffer.from(sample.png, 'base64'),
      );
      delete sample.png;
      samples.push(sample);
    }
    assert(samples[0].intensity < 0.001 && samples[1].intensity > 5.99);
    assert(
      samples[1].brightness > samples[0].brightness * 1.3,
      'mushroom breath must visibly brighten its textured surface',
    );
    state.pulses ??= [];
    state.pulses.push({ variant, off: samples[0], bright: samples[1] });
  }
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.paused = false;
    Object.assign(g.hero, { x: 42, z: -25 });
    g.placeActor();
    g.camera.position.set(62, 45, 18);
    g.camera.lookAt(15, 49, -55);
    g.camera.updateMatrixWorld();
  });
  await page.waitForTimeout(2000);
  const png = await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.renderer.render(g.scene, g.camera);
    return g.renderer.domElement.toDataURL().split(',')[1];
  });
  await writeFile(
    `${output}/rainbow-bark-dim-grass.png`,
    Buffer.from(png, 'base64'),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ ...state, minSpacing: spacing, errors }, null, 2),
  );
  console.log(
    `PASS 30 mushrooms, five variants x six, min spacing ${spacing.toFixed(2)}, dry ground and stem collision, zero trunk particles, rainbow bark; no runtime errors`,
  );
} finally {
  await browser.close();
}
