// Actual preview shader, all skin tones, both texture transports, isolated storage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright'),
  sharp = require('sharp');
const out = process.env.LUMENFALL_QA_OUTPUT ?? 'output/messy-skin-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [],
  checks = [];
try {
  for (const transport of ['ktx', 'fallback']) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text()))
        errors.push(m.text());
    });
    await page.route(
      '**/assets/characters/male-v2/textures/*',
      async (route) => {
        const file = basename(new URL(route.request().url()).pathname);
        if (transport === 'fallback' && file.endsWith('.ktx2'))
          return route.abort();
        if (!process.env.LUMENFALL_ASSET_STAGE) return route.continue();
        await route.fulfill({
          contentType: file.endsWith('.ktx2')
            ? 'image/ktx2'
            : file.endsWith('.png')
              ? 'image/png'
              : 'image/webp',
          body: await readFile(
            resolve(process.env.LUMENFALL_ASSET_STAGE, 'textures', file),
          ),
        });
      },
    );
    await page.route(
      '**/components/game/character-preview.tsx*',
      async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
          /const model = buildModel\(createCharacterModel,\s*renderer\);/,
          'const model = buildModel(createCharacterModel, renderer); window.__skinQA = {model, scene, camera, renderer, T};',
        );
        await route.fulfill({ response, body });
      },
    );
    await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000/');
    await page.getByRole('button', { name: 'NEW GAME', exact: true }).click();
    await page
      .getByRole('button', { name: 'CREATE CHARACTER', exact: true })
      .click();
    await page.waitForFunction(
      () => window.__skinQA?.model.actor.userData.modelStatus === 'ready',
      { timeout: 60000 },
    );
    await page.evaluate(() => {
      const q = window.__skinQA;
      q.camera = new q.T.PerspectiveCamera(32, 1, 0.01, 20);
      q.renderer.setSize(700, 700);
      q.renderer.setPixelRatio(1);
      q.model.actor.traverse((o) => {
        if (o.isSkinnedMesh && o.name.startsWith('Hair_')) o.visible = false;
      });
      q.lights = [];
      q.scene.traverse((o) => {
        if (o.isLight) q.lights.push(o);
      });
      q.neutral = new q.T.AmbientLight(0xffffff, 2.5);
      q.neutral.visible = false;
      q.scene.add(q.neutral);
      q.headHeight =
        q.model.actor
          .getObjectByName('head')
          .getWorldPosition(new q.T.Vector3()).y + 0.23;
      let bodyMaterial;
      q.model.actor.traverse((o) => {
        if (o.isSkinnedMesh && o.name.startsWith('MaleBody'))
          bodyMaterial = o.material;
      });
      q.atlasScene = new q.T.Scene();
      q.atlasScene.add(new q.T.AmbientLight(0xffffff, 2.5));
      const plane = new q.T.PlaneGeometry(2, 2);
      for (let i = 0; i < plane.attributes.uv.count; i++)
        plane.attributes.uv.setY(i, 1 - plane.attributes.uv.getY(i));
      q.atlasScene.add(new q.T.Mesh(plane, bodyMaterial));
      q.atlasCamera = new q.T.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
      q.atlasCamera.position.z = 1;
      q.draw = (view, flat) => {
        for (const light of q.lights) light.visible = !flat;
        q.neutral.visible = flat;
        q.model.actor.rotation.y = view === 'back' ? 2 * Math.PI : Math.PI;
        if (view === 'face') {
          q.camera.position.set(0, q.headHeight, 2.1);
          q.camera.lookAt(0, q.headHeight, 0);
        } else {
          q.camera.position.set(0, 1.04, 4.3);
          q.camera.lookAt(0, 1.04, 0);
        }
        if (view === 'atlas') q.renderer.render(q.atlasScene, q.atlasCamera);
        else q.renderer.render(q.scene, q.camera);
        return q.renderer.domElement.toDataURL('image/png');
      };
    });
    for (let tone = 1; tone <= 5; tone++) {
      await page.evaluate(async (tone) => {
        const q = window.__skinQA;
        await q.model.setAppearance({ skinToneId: `skin_0${tone}` });
      }, tone);
      for (const flat of [false, true])
        for (const view of ['front', 'back', 'face']) {
          const data = await page.evaluate(
            ({ view, flat }) => window.__skinQA.draw(view, flat),
            { view, flat },
          );
          await writeFile(
            `${out}/skin-${transport}-${tone}-${view}${flat ? '-neutral' : ''}.png`,
            Buffer.from(data.split(',')[1], 'base64'),
          );
        }
      const atlas = await page.evaluate(() =>
        window.__skinQA.draw('atlas', true),
      );
      await writeFile(
        `${out}/skin-${transport}-${tone}-atlas.png`,
        Buffer.from(atlas.split(',')[1], 'base64'),
      );
    }
    const compressed = await page.evaluate(() => {
      let result;
      window.__skinQA.model.actor.traverse((o) => {
        if (o.isSkinnedMesh && o.name.startsWith('MaleBody'))
          result = !!o.material.map.isCompressedTexture;
      });
      return result;
    });
    assert.equal(compressed, transport === 'ktx');
    checks.push(
      `${transport}: all five tones, front/back/face, runtime and neutral lighting`,
    );
    await page.close();
  }
  // The compressed mask and fallback must give equivalent recoloring, especially
  // for dark skin, where an untinted orange patch is most conspicuous.
  const parity = [];
  for (let tone = 1; tone <= 5; tone++) {
    const a = await sharp(`${out}/skin-ktx-${tone}-face-neutral.png`)
      .removeAlpha()
      .raw()
      .toBuffer();
    const b = await sharp(`${out}/skin-fallback-${tone}-face-neutral.png`)
      .removeAlpha()
      .raw()
      .toBuffer();
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    const mean = sum / a.length;
    assert.ok(mean < 2.5, `Tone ${tone}: KTX/fallback divergence ${mean}`);
    parity.push(mean);
  }
  // Classify reference albedo well inside skin/cloth regions, independently
  // from the generated mask. Exercise the real GPU shader and sampler: a
  // missing chest mask or colored albedo detail must not pass as even skin.
  const source = await sharp(
    'public/assets/characters/male-v2/textures/body-basecolor-2048.webp',
  )
    .resize(700, 700)
    .removeAlpha()
    .raw()
    .toBuffer();
  const skinAt = (i) =>
    source[i * 3] > 170 &&
    source[i * 3] - source[i * 3 + 1] > 60 &&
    source[i * 3 + 1] - source[i * 3 + 2] > 30;
  const clothAt = (i) =>
    source[i * 3] > 60 &&
    source[i * 3] < 170 &&
    source[i * 3] - source[i * 3 + 1] < 25 &&
    source[i * 3 + 1] - source[i * 3 + 2] < 25;
  const skin = [],
    cloth = [];
  for (let y = 4; y < 696; y++)
    for (let x = 4; x < 696; x++) {
      const i = y * 700 + x;
      if (
        [0, -4, 4, -2800, 2800, -2804, 2804, -2796, 2796].every((d) =>
          skinAt(i + d),
        )
      )
        skin.push(i);
      if (
        [0, -4, 4, -2800, 2800, -2804, 2804, -2796, 2796].every((d) =>
          clothAt(i + d),
        )
      )
        cloth.push(i);
    }
  assert.ok(skin.length > 50000 && cloth.length > 10000);
  const uniformity = [];
  for (const transport of ['ktx', 'fallback']) {
    const first = await sharp(`${out}/skin-${transport}-1-atlas.png`)
      .removeAlpha()
      .raw()
      .toBuffer();
    for (let tone = 1; tone <= 5; tone++) {
      const pixels = await sharp(`${out}/skin-${transport}-${tone}-atlas.png`)
        .removeAlpha()
        .raw()
        .toBuffer();
      const med = [0, 1, 2].map(
        (c) =>
          skin.map((i) => pixels[i * 3 + c]).sort((a, b) => a - b)[
            Math.floor(skin.length / 2)
          ],
      );
      const delta = skin
        .map((i) =>
          Math.max(...med.map((m, c) => Math.abs(m - pixels[i * 3 + c]))),
        )
        .sort((a, b) => a - b);
      const p99 = delta[Math.floor(delta.length * 0.99)],
        outliers = delta.filter((d) => d > 15).length / delta.length;
      assert.ok(
        p99 <= 8 && outliers < 0.001,
        `${transport} tone ${tone}: skin patches p99=${p99}, outliers=${outliers}`,
      );
      let clothDelta = 0;
      for (const i of cloth)
        for (let c = 0; c < 3; c++)
          clothDelta += Math.abs(first[i * 3 + c] - pixels[i * 3 + c]);
      clothDelta /= cloth.length * 3;
      assert.ok(
        clothDelta < 0.5,
        `${transport} tone ${tone}: clothing recolored (${clothDelta})`,
      );
      uniformity.push({ transport, tone, p99, outliers, clothDelta });
    }
  }
  checks.push(
    'GPU atlas: coherent skin color and preserved clothing through all five tones',
  );
  assert.deepEqual(errors, []);
  for (const view of ['front', 'back', 'face']) {
    const tiles = [];
    for (const [row, flat] of [false, true].entries())
      for (let tone = 1; tone <= 5; tone++)
        tiles.push({
          input: await sharp(
            `${out}/skin-ktx-${tone}-${view}${flat ? '-neutral' : ''}.png`,
          )
            .resize(350, 350)
            .toBuffer(),
          left: (tone - 1) * 350,
          top: row * 350,
        });
    await sharp({
      create: { width: 1750, height: 700, channels: 4, background: '#17212b' },
    })
      .composite(tiles)
      .png()
      .toFile(`${out}/skin-tones-${view}.png`);
  }
  await writeFile(
    `${out}/skin-verification.json`,
    JSON.stringify({ checks, parity, uniformity, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, parity, uniformity, errors }));
} finally {
  await browser.close();
}
