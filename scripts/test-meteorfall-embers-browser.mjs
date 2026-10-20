// Actual app runtime, memory-only fixture and private Chrome profile.
import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'work/meteorfall-citadel/revision4';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  benchmarks = [];
let invariants, motion, disposal;
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const ready = () =>
  page.waitForFunction(
    () =>
      window.__meteorfallQA?.game?.meteorfall &&
      !window.__meteorfallQA.game.transitioning,
    null,
    { timeout: 120000 },
  );
try {
  await page.goto('http://127.0.0.1:3006/meteorfall-citadel.html');
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await ready();
  await page.waitForTimeout(1000);
  invariants = await page.evaluate(() => {
    const { game: g } = window.__meteorfallQA;
    cancelAnimationFrame(g.frame);
    g.frame = 0;
    g.invincible = Infinity;
    g.pause(false);
    g.setGraphicsQuality('light', false);
    const mesh = g.meteorfall.root.getObjectByName(
      'Meteorfall world-space embers',
    );
    g.meteorfall.update(g.camera, g.hero, 1 / 60);
    const pos = mesh.geometry.attributes.position.array,
      opacity = mesh.geometry.attributes.emberOpacity.array;
    const first = pos.slice(),
      priorOpacity = opacity.slice(),
      camera = g.camera.position.clone();
    g.hero.x += 20;
    g.meteorfall.update(g.camera, g.hero, 0);
    const heroAttached = first.some((v, i) => pos[i] !== v);
    g.hero.x -= 20;
    g.camera.position.add({ x: 12, y: 14, z: -6 });
    g.camera.updateMatrixWorld();
    g.meteorfall.update(g.camera, g.hero, 1 / 60);
    let tested = 0,
      maxX = 0,
      maxY = 0,
      maxZ = 0;
    for (let i = 0; i < 512; i++) {
      const k = i * 3;
      if (
        priorOpacity[i] < 0.15 ||
        Math.abs(first[k] - camera.x) > 60 ||
        Math.abs(first[k + 2] - camera.z) > 60
      )
        continue;
      maxX = Math.max(maxX, Math.abs(pos[k] - first[k]));
      maxY = Math.max(maxY, Math.abs(pos[k + 1] - first[k + 1]));
      maxZ = Math.max(maxZ, Math.abs(pos[k + 2] - first[k + 2]));
      tested++;
    }
    const orbit = pos.slice();
    g.camera.rotation.y += 0.6;
    g.camera.updateMatrixWorld();
    g.meteorfall.update(g.camera, g.hero, 0);
    const orbitAttached = orbit.some((v, i) => pos[i] !== v);
    g.camera.position.set(0, 65, -350);
    g.camera.updateMatrixWorld();
    g.meteorfall.update(g.camera, g.hero, 1 / 60);
    let local = true;
    for (let i = 0; i < 512; i++)
      local &&=
        Math.abs(pos[i * 3]) <= 90.001 &&
        Math.abs(pos[i * 3 + 2] + 350) <= 90.001;
    const caps = [];
    for (const quality of ['office', 'light', 'balanced', 'high']) {
      g.meteorfall.setQuality(quality);
      g.meteorfall.update(g.camera, g.hero, 1 / 60);
      caps.push(mesh.geometry.drawRange.count);
    }
    g.setGraphicsQuality('light', false);
    g.placeActor();
    g.cameraFocus.copy(g.actor.position);
    Object.assign(g.followView, {
      distance: 12,
      targetDistance: 12,
      pitch: 0.45,
      targetPitch: 0.45,
      yaw: 0,
      targetYaw: 0,
    });
    g.updateCamera(0);
    g.meteorfall.update(g.camera, g.hero, 1 / 60);
    g.lastTime = performance.now();
    g.tick(performance.now());
    return {
      heroAttached,
      orbitAttached,
      tested,
      maxX,
      maxY,
      maxZ,
      local,
      caps,
      color: mesh.material.color.getHexString(),
      size: mesh.material.size,
      origin: mesh.position.toArray(),
      enemies: g.enemies.length,
    };
  });
  console.log('INVARIANTS', JSON.stringify(invariants));
  assert(!invariants.heroAttached && !invariants.orbitAttached);
  assert(invariants.tested > 100);
  assert(
    invariants.maxX < 0.01 && invariants.maxY < 0.026 && invariants.maxZ === 0,
  );
  assert(invariants.local);
  assert.deepEqual(invariants.caps, [256, 512, 768, 1024]);
  assert.equal(invariants.color, 'ff9b36');
  assert.equal(invariants.size, 0.16);
  assert.deepEqual(invariants.origin, [0, 0, 0]);
  assert.equal(invariants.enemies, 294);
  const before = await page.evaluate(() => {
    const g = window.__meteorfallQA.game,
      m = g.meteorfall.root.getObjectByName('Meteorfall world-space embers');
    return {
      x: g.hero.x,
      z: g.hero.z,
      positions: Array.from(m.geometry.attributes.position.array),
      opacity: Array.from(m.geometry.attributes.emberOpacity.array),
      camera: g.camera.position.toArray(),
    };
  });
  await page.keyboard.down('w');
  await page.waitForTimeout(2200);
  await page.keyboard.up('w');
  motion = await page.evaluate((before) => {
    const g = window.__meteorfallQA.game,
      m = g.meteorfall.root.getObjectByName('Meteorfall world-space embers'),
      p = m.geometry.attributes.position.array;
    let checked = 0,
      stable = 0;
    for (let i = 0; i < 512; i++) {
      const k = i * 3;
      if (
        before.opacity[i] < 0.2 ||
        Math.abs(before.positions[k] - before.camera[0]) > 50 ||
        Math.abs(before.positions[k + 2] - before.camera[2]) > 50
      )
        continue;
      checked++;
      if (
        Math.hypot(
          p[k] - before.positions[k],
          p[k + 2] - before.positions[k + 2],
        ) < 2 &&
        Math.abs(p[k + 1] - before.positions[k + 1]) < 4
      )
        stable++;
    }
    return {
      walkDistance: Math.hypot(g.hero.x - before.x, g.hero.z - before.z),
      checked,
      stable,
    };
  }, before);
  console.log('WALK', JSON.stringify(motion));
  assert(
    motion.walkDistance > 10 &&
      motion.checked > 80 &&
      motion.stable / motion.checked > 0.9,
  );
  await page.screenshot({ path: `${out}/world-space-fire.png` });
  for (const [view, z] of [
    ['arrival', 380],
    ['bridge', -225],
    ['citadel', -350],
  ]) {
    await page.evaluate((z) => {
      const g = window.__meteorfallQA.game;
      Object.assign(g.hero, { x: 0, z });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
    }, z);
    await page.waitForTimeout(1200);
    await page.evaluate(() =>
      window.__meteorfallQA.game.renderPerformance.reset(),
    );
    await page.waitForTimeout(4200);
    const result = await page.evaluate(() =>
      window.__meteorfallQA.game.getPerformanceDiagnostics(),
    );
    benchmarks.push({ view, ...result });
    console.log('BENCH', view, result.fpsMedian, result.frameMs.p95);
    assert(result.frameMs.p95 <= 25);
  }
  await page.evaluate(() => {
    const g = window.__meteorfallQA.game,
      m = g.meteorfall.root.getObjectByName('Meteorfall world-space embers');
    window.emberDisposal = { geometry: false, material: false };
    m.geometry.addEventListener(
      'dispose',
      () => (window.emberDisposal.geometry = true),
    );
    m.material.addEventListener(
      'dispose',
      () => (window.emberDisposal.material = true),
    );
  });
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion('jayantara'),
  );
  await page.waitForFunction(() => !window.__meteorfallQA.game.transitioning);
  disposal = await page.evaluate(() => window.emberDisposal);
  assert(disposal.geometry && disposal.material);
  await page.evaluate(() =>
    window.__meteorfallQA.game.changeRegion('meteorfall-citadel'),
  );
  await ready();
  assert(
    await page.evaluate(
      () =>
        !!window.__meteorfallQA.game.meteorfall.root.getObjectByName(
          'Meteorfall world-space embers',
        ),
    ),
  );
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  throw error;
} finally {
  await writeFile(
    `${out}/browser-report.json`,
    JSON.stringify(
      { invariants, motion, benchmarks, disposal, errors },
      null,
      2,
    ),
  );
  await browser.close();
}
