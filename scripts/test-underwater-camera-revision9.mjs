import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const out = 'output/sunken-ruins/revision9';
await mkdir(out, { recursive: true });
const baseline = process.argv.includes('--baseline');
const mapId = process.env.SUNKEN_CAMERA_MAP ?? 'deep-ocean-underwater-v1';
const suffix = mapId === 'abysal-trench-underwater-v1' ? '-trench' : '';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`http://127.0.0.1:3002/sunken-ruins.html?map=${mapId}`);
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(() => window.__sunkenQA?.game?.sunken && !window.__sunkenQA.game.transitioning, null, { timeout: 120000 });
  await page.evaluate(() => window.__sunkenQA.game.characterModel.ready);
  const result = await page.evaluate(async () => {
    const { game: g, rules, three: T } = window.__sunkenQA;
    const item = rules.createItem('dragon-veil-wings');
    g.hero.inventory.push(item);
    const equipped = rules.equipItem(g.hero, item.id, 'accessory');
    if (!equipped.ok) throw Error(equipped.reason);
    g.rebuildHeroAppearance(); await g.characterModel.ready;
    cancelAnimationFrame(g.frame);
    const render = g.renderer.render.bind(g.renderer), move = g.moveVector.bind(g);
    // Full runtime tick, deterministic frame times; rendering is captured separately.
    g.renderer.render = () => {};
    const results = [];
    for (const mode of ['follow', 'free']) for (const uphill of [true, false]) for (const fps of [30, 60, 120, 0]) {
      g.setCameraMode(mode);
      g.followView.yaw = g.followView.targetYaw = 0;
      g.followView.pitch = g.followView.targetPitch = .38;
      g.followView.distance = g.followView.targetDistance = 10;
      g.yaw = 0; g.pitch = .6;
      g.hero.x = 0; g.hero.z = uphill ? -200 : 200;
      g.placeActor(); g.cameraFocus.copy(g.actor.position);
      g.moveVector = (v = new T.Vector3()) => v.set(0, 0, 0);
      let time = g.lastTime || performance.now(), frameIndex = 0;
      const rate = fps || 60;
      const step = () => { time += fps ? 1000 / fps : [1000/120, 1000/30, 1000/60, 40][frameIndex++ % 4]; g.tick(time); cancelAnimationFrame(g.frame); };
      for (let i = 0; i < rate; i++) step();
      g.moveVector = (v = new T.Vector3()) => v.set(0, 0, uphill ? 1 : -1);
      const samples = [];
      for (let i = 0; i < rate * 4; i++) {
        step();
        const focusGround = g.groundHeight(g.cameraOrbitTarget.x, g.cameraOrbitTarget.z);
        const projection = g.actor.position.clone().add(new T.Vector3(0, 1.35, 0)).project(g.camera);
        samples.push({ d: g.camera.position.distanceTo(g.cameraOrbitTarget), targetClearance: g.cameraOrbitTarget.y - focusGround, cameraClearance: g.camera.position.y - g.groundHeight(g.camera.position.x, g.camera.position.z), screenY: projection.y });
      }
      const steady = samples.slice(rate), range = key => Math.max(...steady.map(p => p[key])) - Math.min(...steady.map(p => p[key]));
      results.push({ mode, uphill, fps, travel: Math.abs(g.hero.z - (uphill ? -200 : 200)), minDistance: Math.min(...steady.map(p => p.d)), distanceRange: range('d'), screenRange: range('screenY'), minTargetClearance: Math.min(...steady.map(p => p.targetClearance)), minCameraClearance: Math.min(...steady.map(p => p.cameraClearance)) });
    }
    g.renderer.render = render; g.moveVector = move;
    return { speed: rules.derivedStats(g.hero).movementSpeed, results };
  });
  await writeFile(`${out}/${baseline ? 'camera-before' : 'camera-after'}${suffix}.json`, JSON.stringify({ mapId, ...result, errors }, null, 2));
  console.log(JSON.stringify(result));
  assert.deepEqual(errors, []);
  assert.ok(result.speed >= 600);
  if (!baseline) for (const r of result.results) {
    assert.ok(r.travel > 170, 'real Wings speed preserved');
    assert.ok(r.minTargetClearance >= 1.04, JSON.stringify(r));
    assert.ok(r.minCameraClearance >= 1.19, JSON.stringify(r));
    assert.ok(r.distanceRange < .15 && r.screenRange < .025, JSON.stringify(r));
  }
} finally { await b.close(); }
