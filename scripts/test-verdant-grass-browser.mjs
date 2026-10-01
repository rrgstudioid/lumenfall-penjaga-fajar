// Isolated save and browser: compare culling against drawing EVERY spatial batch.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import { PLAINS_ENTRY, PLAINS_ID } from '../lib/game/verdant-plains-layout.ts';

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ||
  'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out = process.env.GRASS_QA_OUTPUT || 'output/grass-opt/acceptance';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route(/\/lib\/game\/world\.ts/, async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace('this.renderer = new T.WebGLRenderer',
    'window.__plainsQA = this; window.__plainsThree = T; this.renderer = new T.WebGLRenderer');
  await route.fulfill({ response, body });
});
const hero = createV3AdventurerHero('slot-1');
Object.assign(hero, { characterId: 'grass-culling-qa', characterName: 'Grass QA',
  inCity: false, currentField: PLAINS_ID, currentCity: 'averion', ...PLAINS_ENTRY });
await context.addInitScript(({ key, hero }) => localStorage.setItem(key, JSON.stringify({
  version: 3, activeSlot: 'slot-1', lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
})), { key: SAVE_KEY, hero });

try {
  await page.goto(process.env.GAME_URL || 'http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click({ timeout: 60000 });
  await page.waitForFunction(() => window.__plainsQA?.started && window.__plainsQA?.plains,
    null, { timeout: 120000 });
  await page.locator('.game-shell.in-world').waitFor({ timeout: 120000 });
  await page.screenshot({ path: out + '/gameplay-low.png' });
  await page.evaluate(() => {
    const g = window.__plainsQA, T = window.__plainsThree;
    cancelAnimationFrame(g.frame); g.frame = 0; g.paused = true;
    g.__grassFollowCamera = g.camera;
    const root = g.plains.root.getObjectByName('Grass dense field');
    const grass = new Set(root.children);
    g.scene.traverse(o => {
      if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && !grass.has(o)) o.visible = false;
    });
    g.scene.background = new T.Color('#334455');
    g.renderer.info.autoReset = false;
  });
  const checks = [];
  for (const quality of ['office', 'light', 'balanced', 'high']) {
    for (const [x, z, yaw, ortho] of [
      [-380, -20, -2.958, false], [-375, -31.25, 0, false],
      [-160, -100, 1.5, false], [-120, 120, 2.6, false],
      [-160, -100, 0, true],
    ]) {
      const result = await page.evaluate(({ quality, x, z, yaw, ortho }) => {
        const g = window.__plainsQA, T = window.__plainsThree;
        g.setPlainsQuality(quality, false);
        Object.assign(g.hero, { x, z }); g.placeActor(); g.cameraFocus.copy(g.actor.position);
        if (ortho) {
          g.camera = new T.OrthographicCamera(-32, 32, 18, -18, .1, 1500);
          g.camera.position.set(x + 25, g.actor.position.y + 32, z + 25);
          g.camera.lookAt(g.actor.position);
        } else {
          g.camera = g.__grassFollowCamera;
          g.followView.yaw = g.followView.targetYaw = yaw;
          g.followView.pitch = g.followView.targetPitch = .22;
          g.updateCamera(1);
        }
        g.camera.updateMatrixWorld();
        // A real map update advances wind, trail/contact, and culling together.
        g.plains.update(g.camera, { x: x - .7, z }, 3.1);
        g.plains.update(g.camera, g.hero, 3.2);
        const root = g.plains.root.getObjectByName('Grass dense field');
        const grass = new Set(root.children);
        g.scene.traverse(o => {
          if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && !grass.has(o)) o.visible = false;
        });
        const render = () => {
          g.renderer.info.reset(); g.renderer.render(g.scene, g.camera);
          const gl = g.renderer.getContext();
          const bytes = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          return bytes;
        };
        const visible = root.children.map(mesh => mesh.visible);
        const culled = render(), triangles = g.renderer.info.render.triangles;
        const reported = g.plains.metrics().grassField.submittedTriangles;
        root.children.forEach(mesh => { mesh.visible = true; });
        const unculled = render();
        let changed = 0;
        for (let i = 0; i < culled.length; i += 4)
          if (culled[i] !== unculled[i] || culled[i + 1] !== unculled[i + 1] || culled[i + 2] !== unculled[i + 2]) changed++;
        // Also render rejected batches alone: depth ties between overlapping
        // accepted blades must not hide a genuine culling error in a pixel diff.
        root.children.forEach(mesh => { mesh.visible = false; });
        const empty = render();
        root.children.forEach((mesh, i) => { mesh.visible = !visible[i]; });
        const rejected = render();
        let rejectedPixels = 0;
        for (let i = 0; i < empty.length; i += 4)
          if (empty[i] !== rejected[i] || empty[i + 1] !== rejected[i + 1] || empty[i + 2] !== rejected[i + 2]) rejectedPixels++;
        root.children.forEach((mesh, i) => { mesh.visible = visible[i]; });
        g.plains.update(g.camera, g.hero, 4.2);
        const wind = render();
        let animatedPixels = 0;
        for (let i = 0; i < culled.length; i += 4)
          if (culled[i] !== wind[i] || culled[i + 1] !== wind[i + 1] || culled[i + 2] !== wind[i + 2]) animatedPixels++;
        return { changed, rejectedPixels, animatedPixels, triangles, reported, visible: visible.filter(Boolean).length,
          memory: { ...g.renderer.info.memory } };
      }, { quality, x, z, yaw, ortho });
      assert.equal(result.rejectedPixels, 0, 'rejected batches must contribute no visible pixels');
      assert.equal(result.triangles, result.reported, 'diagnostic triangle count must match renderer');
      assert.ok(result.animatedPixels > 0, 'grass still animates through real map updates');
      checks.push({ quality, x, z, ortho, ...result });
      console.log('PASS', quality, x, z, ortho ? 'ortho' : 'follow', result.triangles);
    }
  }
  const resources = await page.evaluate(() => {
    const g = window.__plainsQA;
    const cycle = () => {
      for (const q of ['office', 'light', 'balanced', 'high']) {
        g.setPlainsQuality(q, false); g.plains.update(g.camera, g.hero, 5);
        g.plains.root.getObjectByName('Grass dense field').children.forEach(mesh => { mesh.visible = true; });
        g.renderer.render(g.scene, g.camera);
      }
      return { ...g.renderer.info.memory };
    };
    const before = cycle();
    for (let i = 0; i < 3; i++) cycle();
    return { before, after: cycle(), patchBytes: g.plains.metrics().grassField.sharedPatchBytes };
  });
  assert.deepEqual(resources.before, resources.after);
  assert.equal(resources.patchBytes, 1757824);
  const travel = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => {
      const g = window.__plainsQA;
      g.camera = g.__grassFollowCamera;
      g.setPlainsQuality('office', false);
      await g.changeRegion('east-gate-arunika');
    });
    await page.waitForFunction(() => !window.__plainsQA.transitioning && !window.__plainsQA.plains);
    await page.evaluate(() => window.__plainsQA.changeRegion('verdant-plains-v2'));
    await page.waitForFunction(() => window.__plainsQA.plains && !window.__plainsQA.transitioning,
      null, { timeout: 120000 });
    await page.waitForTimeout(250);
    travel.push(await page.evaluate(() => {
      const g = window.__plainsQA;
      g.cameraFocus.copy(g.actor.position); g.updateCamera(1); g.camera.updateMatrixWorld();
      g.plains.update(g.camera, g.hero, 6); g.renderer.render(g.scene, g.camera);
      return { ...g.renderer.info.memory, enemies: g.enemies.length,
        batches: g.plains.root.getObjectByName('Grass dense field').children.length };
    }));
    assert.equal(travel.at(-1).enemies, 497);
    assert.equal(travel.at(-1).batches, 872);
  }
  assert.deepEqual(travel.at(-1), travel[1], 'map disposal/reload must not accumulate resources');
  assert.deepEqual(errors, []);
  await writeFile(out + '/report.json', JSON.stringify({ checks, resources, travel, errors }, null, 2));
  console.log('PASS stable resources across quality changes and three map roundtrips');
} finally {
  await browser.close();
}
