import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-interactions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [],
  reports = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started &&
      !window.__wildsQA.game.transitioning &&
      !window.__wildsQA.game.regionLoadError,
  );
  await page.evaluate(() => {
    const { game: g, three: T, layout: l } = window.__wildsQA;
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(60, 1.5, 0.1, 3000);
    Object.assign(g.hero, { x: -190, z: 280 });
    g.placeActor();
    const h = l.wildsGroundHeight(g.hero.x, g.hero.z);
    g.camera.position.set(g.hero.x + 4, h + 5, g.hero.z + 7);
    g.camera.lookAt(g.hero.x, h + 0.4, g.hero.z);
  });
  for (const quality of ['office', 'balanced']) {
    await page.evaluate(
      (q) => window.__wildsQA.game.setWildsQuality(q, false),
      quality,
    );
    await page.waitForTimeout(3000);
    const grass = await page.evaluate(() => {
      const { game: g, three: T } = window.__wildsQA;
      const root = g.scene.getObjectByName('Dense meadow grass');
      const material = root.children.find(
        (c) => c.visible && c.count > 0,
      ).material;
      const uniforms = material.userData.grassUniforms;
      const player = uniforms.uGrassPlayer.value.clone(),
        trail = uniforms.uGrassTrail.value.clone();
      // Isolate grass so animated water/particles and shadow updates cannot
      // contaminate the contact/recovery pixel comparison.
      const testScene = new T.Scene(),
        copy = root.clone(true);
      testScene.background = new T.Color('#020408');
      testScene.add(copy);
      const canvas = document.createElement('canvas');
      canvas.width = g.renderer.domElement.width;
      canvas.height = g.renderer.domElement.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const capture = () => {
        g.renderer.render(testScene, g.camera);
        ctx.drawImage(g.renderer.domElement, 0, 0);
        return {
          png: canvas.toDataURL().split(',')[1],
          pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        };
      };
      uniforms.uGrassPlayer.value.set(10000, 0, 10000);
      uniforms.uGrassTrail.value.set(10000, 10000);
      const before = capture();
      uniforms.uGrassPlayer.value.copy(player);
      uniforms.uGrassTrail.value.set(player.x, player.z);
      const during = capture();
      uniforms.uGrassPlayer.value.set(10000, 0, 10000);
      uniforms.uGrassTrail.value.set(10000, 10000);
      const after = capture();
      let changedPixels = 0,
        recoveryDifference = 0,
        brightPixels = 0,
        litPixels = 0,
        brightnessSum = 0;
      for (let i = 0; i < before.pixels.length; i += 4) {
        const peak = Math.max(
          before.pixels[i],
          before.pixels[i + 1],
          before.pixels[i + 2],
        );
        if (peak > 10) {
          litPixels++;
          brightnessSum += peak;
        }
        if (
          Math.max(
            ...[0, 1, 2].map((c) =>
              Math.abs(before.pixels[i + c] - during.pixels[i + c]),
            ),
          ) > 20
        )
          changedPixels++;
        if (
          Math.max(
            ...[0, 1, 2].map((c) =>
              Math.abs(before.pixels[i + c] - after.pixels[i + c]),
            ),
          ) > 3
        )
          recoveryDifference++;
        if (
          Math.max(
            before.pixels[i],
            before.pixels[i + 1],
            before.pixels[i + 2],
          ) > 180
        )
          brightPixels++;
      }
      uniforms.uGrassPlayer.value.copy(player);
      uniforms.uGrassTrail.value.copy(trail);
      copy.traverse((o) => {
        if (o instanceof T.InstancedMesh) o.dispose();
      });
      testScene.clear();
      return {
        before: before.png,
        during: during.png,
        changedPixels,
        recoveryDifference,
        brightPixels,
        meanLitBrightness: brightnessSum / Math.max(1, litPixels),
      };
    });
    await writeFile(
      `${output}/${quality}-grass-standing.png`,
      Buffer.from(grass.before, 'base64'),
    );
    await writeFile(
      `${output}/${quality}-grass-pressed.png`,
      Buffer.from(grass.during, 'base64'),
    );
    assert(
      grass.changedPixels > 30,
      'footstep must deform visible grass in the GPU render',
    );
    assert.equal(
      grass.recoveryDifference,
      0,
      'grass returns to its undeformed render after leaving',
    );
    assert(
      grass.meanLitBrightness > 20 && grass.meanLitBrightness < 150,
      'cyan grass stays readable at night',
    );
    delete grass.before;
    delete grass.during;
    const particles = await page.evaluate(() => {
      const { game: g } = window.__wildsQA;
      const points = g.scene.getObjectByName('Local rainbow fireflies')
        .children[0];
      const p = points.geometry.attributes.position,
        fade = points.geometry.attributes.fade,
        reaction = points.geometry.attributes.reaction;
      const original = { x: g.hero.x, z: g.hero.z };
      let index = -1;
      for (let i = 0; i < points.geometry.drawRange.count; i++) {
        const d = Math.hypot(p.getX(i) - original.x, p.getZ(i) - original.z);
        if (
          fade.getX(i) > 0.5 &&
          d > 5 &&
          d < 16 &&
          g.wilds.navigation.valid({ x: p.getX(i), z: p.getZ(i) })
        ) {
          index = i;
          break;
        }
      }
      if (index < 0) throw Error('No nearby firefly for contact check');
      const oldContacts = g.wilds.metrics().particles.playerContacts;
      Object.assign(g.hero, { x: p.getX(index), z: p.getZ(index) });
      g.placeActor();
      for (let i = 0; i < 15; i++)
        g.wilds.update(
          g.camera,
          g.hero,
          1 / 60,
          g.renderer.getPixelRatio(),
          true,
        );
      const displacement = Math.hypot(
        reaction.getX(index),
        reaction.getY(index),
        reaction.getZ(index),
      );
      const contacts = g.wilds.metrics().particles.playerContacts - oldContacts;
      Object.assign(g.hero, original);
      g.placeActor();
      for (let i = 0; i < 80; i++)
        g.wilds.update(
          g.camera,
          g.hero,
          0.05,
          g.renderer.getPixelRatio(),
          true,
        );
      const returned = Math.hypot(
        reaction.getX(index),
        reaction.getY(index),
        reaction.getZ(index),
      );
      return { contacts, displacement, returned };
    });
    assert(particles.contacts > 0 && particles.displacement > 0.15);
    assert(particles.returned < 0.08);
    reports.push({ quality, grass, particles });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ reports, errors }, null, 2),
  );
  console.log(JSON.stringify({ reports, errors }, null, 2));
} finally {
  await browser.close();
}
