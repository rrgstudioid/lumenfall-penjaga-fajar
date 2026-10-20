// Actual creation renderer, isolated browser storage, response-only QA handle.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright'),
  sharp = require('sharp');
const out = process.env.LUMENFALL_QA_OUTPUT ?? 'output/owner-male';
const motionStyle = process.env.LUMENFALL_QA_MOTION_HAIR ?? 'hair_09';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
  errors = [],
  checks = [];
// Review staged geometry in the actual renderer before promoting local assets.
if (process.env.LUMENFALL_ASSET_STAGE)
  await page.route(
    '**/assets/characters/male-v2/{hair,textures}/*',
    async (route) => {
      const file = basename(new URL(route.request().url()).pathname);
      const folder = new URL(route.request().url()).pathname.includes('/hair/')
        ? 'hair'
        : 'textures';
      await route.fulfill({
        contentType: file.endsWith('.glb')
          ? 'model/gltf-binary'
          : file.endsWith('.ktx2')
            ? 'image/ktx2'
            : file.endsWith('.png')
              ? 'image/png'
              : 'image/webp',
        body: await readFile(
          resolve(process.env.LUMENFALL_ASSET_STAGE, folder, file),
        ),
      });
    },
  );
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text()))
    errors.push(m.text());
});
await page.route('**/components/game/character-preview.tsx*', async (route) => {
  const response = await route.fetch();
  const text = (await response.text()).replace(
    /const model = buildModel\(createCharacterModel,\s*renderer\);/,
    'const model = buildModel(createCharacterModel, renderer); window.__maleQA = {model, scene, camera, renderer, T, hero, createCharacterModel, disposeCharacterModel};',
  );
  await route.fulfill({ response, body: text });
});
const check = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
async function capture(path) {
  const data = await page.evaluate(() => {
    const q = window.__maleQA;
    q.renderer.render(q.scene, q.camera);
    return q.renderer.domElement.toDataURL('image/png');
  });
  await writeFile(path, Buffer.from(data.split(',')[1], 'base64'));
}
try {
  await page.goto(process.env.LUMENFALL_TEST_URL ?? 'http://localhost:3000/');
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).click();
  await page
    .getByRole('button', { name: 'CREATE CHARACTER', exact: true })
    .click();
  await page.waitForFunction(
    () => window.__maleQA?.model.actor.userData.modelStatus === 'ready',
    { timeout: 60000 },
  );
  await page
    .getByText('Memuat karakter...', { exact: true })
    .waitFor({ state: 'hidden' });
  // Create a dedicated camera from the production renderer; keep its actual materials,
  // skeleton, animation binding and loader. This does not alter app or player data.
  await page.evaluate(() => {
    const q = window.__maleQA;
    q.camera = new q.T.PerspectiveCamera(32, 1, 0.01, 20);
    q.renderer.setSize(700, 700);
    q.renderer.setPixelRatio(1);
    q.renderer.domElement.style.cssText =
      'width:700px;height:700px;position:fixed;inset:0;z-index:99999;background:#273340';
    const head = q.model.actor
      .getObjectByName('head')
      .getWorldPosition(new q.T.Vector3());
    q.camera.position.set(0, head.y + 0.23, 2.1);
    q.camera.lookAt(0, head.y + 0.23, 0);
    q.draw = (angle = 0) => {
      q.model.actor.rotation.y = Math.PI + angle;
      q.renderer.render(q.scene, q.camera);
    };
  });
  for (let lod = 0; lod < 4; lod++)
    for (let style = 1; style <= 10; style++) {
      const result = await page.evaluate(
        async ({ lod, style }) => {
          const q = window.__maleQA,
            a = {
              hairStyleId: `hair_${String(style).padStart(2, '0')}`,
              hairColor: '#704434',
              skinToneId: 'skin_03',
            };
          await q.model.setAppearance(a);
          await q.model.setVisualLOD(lod);
          q.camera.position.z = style === 3 ? 2.6 : 2.1;
          q.draw();
          const skins = [];
          q.model.actor.traverse((o) => {
            if (o.isSkinnedMesh) skins.push(o);
          });
          const hair = skins.filter((o) => o.name.startsWith('Hair_'));
          return {
            count: hair.length,
            lod: hair[0]?.userData.assetPath,
            shared:
              hair[0]?.skeleton ===
              skins.find((o) => o.name.startsWith('MaleBody'))?.skeleton,
          };
        },
        { lod, style },
      );
      assert.equal(result.count, 1);
      assert.equal(result.shared, true);
      assert.match(
        result.lod,
        new RegExp(`hair_${String(style).padStart(2, '0')}-lod${lod}`),
      );
      for (const [view, angle] of [
        ['front', 0],
        ['right', Math.PI / 2],
        ['back', Math.PI],
        ['left', -Math.PI / 2],
      ]) {
        await page.evaluate((a) => window.__maleQA.draw(a), angle);
        await capture(`${out}/hair-${style}-lod${lod}-${view}.png`);
      }
      if (style === 10)
        for (const [view, angle] of [
          ['rear-right', Math.PI * 0.75],
          ['rear-left', Math.PI * 1.25],
        ]) {
          await page.evaluate((a) => window.__maleQA.draw(a), angle);
          await capture(`${out}/hair-${style}-lod${lod}-${view}.png`);
        }
    }
  check(
    '40 style/LOD combinations: one hair mesh, shared body skeleton, four-angle screenshots at all four LODs',
  );
  await page.evaluate(async () => {
    const q = window.__maleQA;
    await q.model.setVisualLOD(0);
    q.model.actor.traverse((o) => {
      if (o.isSkinnedMesh && o.name.startsWith('Hair_')) o.visible = false;
    });
    q.draw();
  });
  await capture(`${out}/bald-front.png`);
  await page.evaluate(() => window.__maleQA.draw(Math.PI));
  await capture(`${out}/bald-back.png`);
  await page.evaluate(() => {
    window.__maleQA.model.actor.traverse((o) => {
      if (o.isSkinnedMesh && o.name.startsWith('Hair_')) o.visible = true;
    });
  });
  const race = await page.evaluate(async () => {
    const q = window.__maleQA;
    await Promise.all(
      Array.from({ length: 35 }, (_, i) =>
        q.model.setAppearance({
          hairStyleId: `hair_${String((i % 10) + 1).padStart(2, '0')}`,
          hairColor: '#33aacc',
        }),
      ),
    );
    let root;
    q.model.actor.traverse((o) => {
      if (o.userData.setAppearance) root = o;
    });
    const hair = [];
    root.traverse((o) => {
      if (o.isSkinnedMesh && o.name.startsWith('Hair_')) hair.push(o.name);
    });
    return { style: root.userData.appearance.hairStyleId, hair };
  });
  assert.equal(race.style, 'hair_05');
  assert.equal(race.hair.length, 1);
  check(
    '35 concurrent appearance requests leave only the latest selected hair',
  );
  for (const { name, state, action } of [
    { name: 'idle', state: {}, action: null },
    { name: 'run', state: { moving: true, sprinting: true }, action: null },
    { name: 'attack', state: {}, action: 'basic_attack' },
    { name: 'cast', state: {}, action: 'magic_cast' },
    { name: 'hit', state: {}, action: 'hit' },
    { name: 'death', state: { dead: true }, action: null },
  ]) {
    await page.evaluate(
      async ({ state, action, motionStyle }) => {
        const q = window.__maleQA;
        await q.model.setAppearance({
          hairStyleId: motionStyle,
          hairColor: '#704434',
        });
        await q.model.setVisualLOD(0);
        q.model.animator.reset();
        if (action) q.model.animator.play(action, 0.6);
        for (let i = 0; i < 12; i++) q.model.animator.update(1 / 60, state);
        q.camera.position.set(0, 1.2, 5);
        q.camera.lookAt(0, 1.1, 0);
        q.draw(0.3);
        q.model.actor.traverse((o) => {
          if (o.isSkinnedMesh) {
            o.skeleton.update();
            for (let i = 0; i < o.geometry.attributes.position.count; i += 31) {
              const p = o.getVertexPosition(i, new q.T.Vector3());
              if (!Number.isFinite(p.length()) || p.length() > 6)
                throw Error('Deformed mesh bounds invalid');
            }
          }
        });
      },
      { state, action, motionStyle },
    );
    await capture(`${out}/motion-${String(name)}.png`);
  }
  check(
    'Idle/run/attack/cast/hit/death: finite deformations and animation screenshots',
  );
  const equipped = await page.evaluate(async (motionStyle) => {
    const q = window.__maleQA;
    const { createItem } = await import('/lib/game/items.ts');
    const { DRAGON_VEIL_PIECES } = await import('/lib/game/dragon-veil.ts');
    const hero = structuredClone(q.hero);
    hero.appearance = {
      ...hero.appearance,
      hairStyleId: motionStyle,
      hairColor: '#704434',
    };
    for (const piece of DRAGON_VEIL_PIECES) {
      const item = createItem(piece.id, { id: 'qa-' + piece.id });
      hero.inventory.push(item);
      hero.equipment[piece.slot] = item.id;
    }
    const model = q.createCharacterModel(hero, {
      renderer: q.renderer,
      quality: 'light',
    });
    if (!(await model.ready) || !(await model.equipmentReady))
      throw Error('Equipped/native character failed to load');
    q.scene.remove(q.model.actor);
    q.disposeCharacterModel(q.model.actor);
    q.model = model;
    q.scene.add(model.actor);
    for (let i = 0; i < 24; i++)
      model.animator.update(1 / 60, { moving: true, sprinting: true });
    q.draw(0.3);
    let hair = 0,
      pieces = 0;
    model.actor.traverse((o) => {
      if (o.isSkinnedMesh && o.name.startsWith('Hair_') && o.visible) hair++;
      if (o.userData.dragonVeil) pieces++;
    });
    return {
      hair,
      pieces,
      clips: model.actor.userData.nativeAnimations.length,
    };
  }, motionStyle);
  assert.equal(equipped.hair, 1);
  assert.ok(equipped.pieces >= 4);
  assert.ok(equipped.clips > 0);
  await capture(`${out}/native-run-dragon-veil.png`);
  await page.evaluate(() => window.__maleQA.draw(Math.PI));
  await capture(`${out}/native-run-dragon-veil-back.png`);
  check(
    'Native motion loads with full Dragon Veil; selected long hair remains attached under open crown',
  );
  assert.deepEqual(errors, []);
  const tiles = [];
  for (let i = 1; i <= 10; i++)
    tiles.push({
      input: await sharp(`${out}/hair-${i}-lod0-front.png`)
        .resize(240, 240)
        .toBuffer(),
      left: ((i - 1) % 5) * 240,
      top: Math.floor((i - 1) / 5) * 240,
    });
  await sharp({
    create: { width: 1200, height: 480, channels: 3, background: '#273340' },
  })
    .composite(tiles)
    .png()
    .toFile(`${out}/hairstyles.png`);
  for (let lod = 0; lod < 4; lod++)
    for (let batch = 0; batch < 2; batch++) {
      const angles = [];
      for (let row = 0; row < 5; row++)
        for (const [column, view] of [
          'front',
          'right',
          'back',
          'left',
        ].entries()) {
          const style = batch * 5 + row + 1;
          angles.push({
            input: await sharp(`${out}/hair-${style}-lod${lod}-${view}.png`)
              .resize(260, 260)
              .toBuffer(),
            left: column * 260,
            top: row * 285 + 25,
          });
          angles.push({
            input: Buffer.from(
              `<svg width="260" height="25"><text x="8" y="18" fill="white" font-size="16">${style} - ${view} - LOD${lod}</text></svg>`,
            ),
            left: column * 260,
            top: row * 285,
          });
        }
      await sharp({
        create: {
          width: 1040,
          height: 1425,
          channels: 3,
          background: '#273340',
        },
      })
        .composite(angles)
        .png()
        .toFile(`${out}/audit-lod${lod}-${batch}.png`);
    }
  await writeFile(
    `${out}/verification.json`,
    JSON.stringify({ checks, errors, race, motionStyle }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await browser.close();
}
