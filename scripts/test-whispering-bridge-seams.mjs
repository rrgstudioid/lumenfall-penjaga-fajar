import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'output/whispering-bridge-seams';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
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
      window.__wildsQA?.game?.started &&
      !window.__wildsQA.game.transitioning &&
      !window.__wildsQA.game.regionLoadError,
  );
  await page.evaluate(() => {
    const { game: g, three: T } = window.__wildsQA;
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(60, 1.5, 0.1, 3000);
  });
  for (const quality of ['office', 'balanced']) {
    await page.evaluate(
      (q) => window.__wildsQA.game.setWildsQuality(q, false),
      quality,
    );
    for (let id = 0; id < 4; id++)
      for (const side of [-1, 1]) {
        await page.evaluate(
          ({ id, side }) => {
            const { game: g, layout: l } = window.__wildsQA,
              b = l.WILDS_BRIDGES[id];
            const at = side * (b.length / 2 - 3),
              behind = side * (b.length / 2 + 8);
            Object.assign(g.hero, {
              x: b.x + b.axis.x * at,
              z: b.z + b.axis.z * at,
            });
            g.placeActor();
            g.camera.position.set(
              b.x + b.axis.x * behind - b.axis.z * 9,
              b.height + 11,
              b.z + b.axis.z * behind + b.axis.x * 9,
            );
            g.camera.lookAt(
              b.x + b.axis.x * at,
              b.height + 0.3,
              b.z + b.axis.z * at,
            );
          },
          { id, side },
        );
        await page.waitForTimeout(250);
        const png = await page.evaluate(() => {
          const g = window.__wildsQA.game;
          g.renderer.render(g.scene, g.camera);
          return g.renderer.domElement.toDataURL().split(',')[1];
        });
        await writeFile(
          `${output}/${quality}-bridge-${id + 1}-${side < 0 ? 'west' : 'east'}.png`,
          Buffer.from(png, 'base64'),
        );
      }
  }
  // GPU regression: cyan is the actual bridge model, magenta is the actual terrain
  // shader (including its deck cutout). Probe the full width of all eight joints.
  const raster = await page.evaluate(() => {
    const { game: g, layout: l, three: T } = window.__wildsQA;
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-12, 12, 12, -12, 0.1, 200);
    const target = new T.WebGLRenderTarget(256, 256),
      cyan = new T.MeshBasicMaterial({ color: 0x00ffff, toneMapped: false });
    const source = g.wilds.surfaces.children.find((o) =>
      o.name.includes('Forest terrain'),
    );
    const ground = source.material.clone();
    ground.toneMapped = false;
    ground.fog = false;
    ground.onBeforeCompile = function (shader, renderer) {
      source.material.onBeforeCompile.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'outgoingLight=vec3(1.,0.,1.);\n#include <opaque_fragment>',
      );
    };
    ground.customProgramCacheKey = () =>
      source.material.customProgramCacheKey() + '/joint-regression';
    const terrain = g.wilds.surfaces.children
      .filter((o) => o.name.includes('Forest terrain'))
      .map((o) => {
        const m = o.clone();
        m.material = ground;
        scene.add(m);
        return m;
      });
    const bridges = g.wilds.root
      .getObjectByName('Crafted Wilds bridges')
      .clone(true);
    bridges.traverse((o) => {
      if (o.isMesh) o.material = cyan;
    });
    scene.add(bridges);
    const pixel = new Uint8Array(4),
      failures = [];
    let samples = 0;
    const sample = (x, y, z) => {
      const p = new T.Vector3(x, y, z).project(camera);
      g.renderer.readRenderTargetPixels(
        target,
        Math.round((p.x * 0.5 + 0.5) * 255),
        Math.round((p.y * 0.5 + 0.5) * 255),
        1,
        1,
        pixel,
      );
      return [...pixel];
    };
    const previous = g.renderer.getRenderTarget();
    for (const lod of [1, 2, 4]) {
      terrain.forEach((m) => (m.visible = m.name.endsWith('LOD ' + lod)));
      for (const [id, b] of l.WILDS_BRIDGES.entries())
        for (const side of [-1, 1]) {
          const along = side * (b.length / 2 - 2),
            x = b.x + b.axis.x * along,
            z = b.z + b.axis.z * along;
          camera.position.set(x, b.height + 60, z);
          camera.up.set(-b.axis.z, 0, b.axis.x);
          camera.lookAt(x, b.height, z);
          camera.updateMatrixWorld();
          g.renderer.setRenderTarget(target);
          g.renderer.render(scene, camera);
          for (const inset of [0.15, 0.75, 2, 4, 7])
            for (const across of [-4.8, -4, -2, 0, 2, 4, 4.8]) {
              const a = side * (b.length / 2 - inset),
                xx = b.x + b.axis.x * a - b.axis.z * across,
                zz = b.z + b.axis.z * a + b.axis.x * across;
              const color = sample(xx, b.height, zz);
              samples++;
              if (!(color[0] < 25 && color[1] > 200 && color[2] > 200))
                failures.push({ id, side, lod, inset, across, color });
            }
          const a = side * (b.length / 2 + 1),
            color = sample(b.x + b.axis.x * a, b.height, b.z + b.axis.z * a);
          samples++;
          if (!(color[0] > 200 && color[1] < 25 && color[2] > 200))
            failures.push({ id, side, lod, outside: true, color });
        }
    }
    g.renderer.setRenderTarget(previous);
    target.dispose();
    ground.dispose();
    cyan.dispose();
    return { samples, failures };
  });
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ raster, errors }, null, 2),
  );
  assert.deepEqual(
    raster.failures,
    [],
    'terrain must never draw through bridge floors or leave a hole outside their ends',
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${raster.samples} rendered surface probes across all 8 joints and 3 terrain LODs; Low/High screenshots; no runtime errors`,
  );
} finally {
  await browser.close();
}
