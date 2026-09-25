// Prebuilt, world-free visual fixture; isolated browser storage and local server.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE;
const serveOnly = process.argv.includes('--serve');
if (!serveOnly && !modulePath) throw Error('Set PLAYWRIGHT_MODULE to installed playwright/index.mjs');
const out = resolve('work/cena-character/browser'); await mkdir(out, { recursive: true });
const built = resolve(out, 'build');
await build({ configFile: false, publicDir: false, logLevel: 'warn', build: {
  outDir: built, emptyOutDir: false, minify: false, chunkSizeWarningLimit: 5000,
  rolldownOptions: { input: resolve('tests/browser/cena-character-fixture.html') },
} });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const root = /^\/assets\/(characters|equipment|vfx)\//.test(url.pathname) ? resolve('public') : built;
  const file = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + '\\')) { res.writeHead(403).end(); return; }
  try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(bytes); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const previewUrl = `http://127.0.0.1:${server.address().port}/tests/browser/cena-character-fixture.html`;
if (serveOnly) {
  console.log(`Cena isolated preview: ${previewUrl}`);
  await new Promise(r => { process.once('SIGINT', r); process.once('SIGTERM', r); });
  await new Promise(r => server.close(r));
  process.exit(0);
}
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const diagnostics = { consoleErrors: [], warnings: [], pageErrors: [], requestFailures: [] }, cases = [];
const requestedAssets = [];
page.on('request', request => { if (request.url().includes('/assets/')) requestedAssets.push(request.url()); });
page.on('console', m => { if (m.type() === 'error') diagnostics.consoleErrors.push(m.text()); if (m.type() === 'warning') diagnostics.warnings.push(m.text()); });
page.on('pageerror', e => diagnostics.pageErrors.push(e.message));
page.on('requestfailed', r => diagnostics.requestFailures.push(r.url()));
try {
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__cenaReview), { timeout: 60000 });
  for (const mode of ['unarmed', 'one', 'dual', 'meteor', 'two', 'female']) {
    let result = await page.evaluate(mode => window.__cenaReview.equip(mode), mode);
    if (mode === 'meteor') {
      await page.waitForFunction(() => window.__cenaReview.snapshot().meteorModels === 2);
      result = await page.evaluate(() => window.__cenaReview.snapshot());
    }
    assert.equal(result.asset, mode === 'female' ? 'female-rpg' : 'cena');
    if (mode !== 'female') { assert.equal(result.mixer, true); assert.deepEqual(new Set(result.nativeAnimations), new Set(['Walk', 'Run', 'Run_Start', 'Run_Stop', 'DualSword_Attack_01', 'DualSword_Attack_02', 'DualSword_Attack_03'])); }
    assert.ok(result.rightGripError < 1e-5 && result.leftGripError < 1e-5);
    for (const value of Object.values(result.anatomyAlignment)) assert.ok(value > .96, 'hilt follows finger grip, not only socket');
    for (const value of Object.values(result.bladeWidthUp)) assert.ok(value > .9, 'idle blade width is upright, not a horizontal tray');
    cases.push({ mode, ...result });
    await page.screenshot({ path: resolve(out, `${mode}-front.png`) });
    if (mode === 'unarmed') for (const view of ['face', 'faceSide', 'faceThreeQuarter']) {
      await page.evaluate(v => window.__cenaReview.render(v), view);
      await page.screenshot({ path: resolve(out, `${view}.png`) });
    }
    if (mode === 'dual' || mode === 'meteor') {
      for (const view of ['threeQuarter', 'side', 'back', 'hands', 'handsReverse']) {
        await page.evaluate(v => window.__cenaReview.render(v), view);
        await page.screenshot({ path: resolve(out, `${mode}-${view}.png`) });
      }
      for (const motion of ['walk', 'run', 'attack']) {
        const state = await page.evaluate(m => { window.__cenaReview.pose(m); return window.__cenaReview.snapshot(); }, motion);
        assert.ok(state.rightGripError < 1e-5 && state.leftGripError < 1e-5);
        assert.equal(state.mixer, true);
        for (const value of Object.values(state.anatomyAlignment)) assert.ok(value > .96);
        await page.screenshot({ path: resolve(out, `${mode}-${motion}.png`) });
        cases.push({ mode: `${mode}-${motion}`, ...state });
      }
    }
  }
  await page.evaluate(() => window.__cenaReview.equip('meteor'));
  await page.waitForFunction(() => window.__cenaReview.snapshot().meteorModels === 2);
  await page.evaluate(() => window.__cenaReview.render('threeQuarter'));
  for (const [button, expected] of [['run', 'Run_Start'], [null, 'Run'], ['idle', 'Run_Stop'], [null, '']]) {
    if (button) await page.locator(`[data-pose="${button}"]`).click();
    await page.waitForFunction(clip => window.__cenaReview.snapshot().activeClip === clip, expected);
    const start = await page.evaluate(() => window.__cenaReview.snapshot());
    await page.waitForFunction(frame => window.__cenaReview.snapshot().playbackFrames > frame + 12, start.playbackFrames);
    const state = await page.evaluate(() => window.__cenaReview.snapshot());
    assert.equal(state.activeClip, expected);
    assert.equal(state.runSource, 'cena-run-f0');
    assert.deepEqual(state.actorPosition, [0, 0, 0], 'no root-motion displacement of gameplay actor');
    assert.ok(state.rightGripError < 1e-5 && state.leftGripError < 1e-5);
    for (const value of Object.values(state.anatomyAlignment)) assert.ok(value > .96);
    await page.screenshot({ path: resolve(out, `run-f0-${expected || 'recovered'}.png`) });
    cases.push({ mode: `run-f0-${expected || 'recovered'}`, ...state });
  }
  for (const [button, expected] of [['walk', 'Walk'], ['run', 'Run'], ['attack', 'DualSword_Attack_01']]) {
    await page.locator(`[data-pose="${button}"]`).click();
    await page.waitForFunction(clip => window.__cenaReview.snapshot().activeClip === clip, expected);
    const first = await page.evaluate(() => window.__cenaReview.snapshot());
    await page.waitForFunction(start => window.__cenaReview.snapshot().playbackFrames > start + 12, first.playbackFrames);
    const next = await page.evaluate(() => window.__cenaReview.snapshot());
    assert.notDeepEqual(first.poseSample, next.poseSample, 'RAF playback changes real bone positions');
    assert.ok(next.rightGripError < 1e-5 && next.leftGripError < 1e-5);
    await page.screenshot({ path: resolve(out, `live-${button}.png`) });
    cases.push({ mode: `live-${button}`, ...next });
  }
  for (const clip of ['DualSword_Attack_02', 'DualSword_Attack_03']) {
    await page.waitForFunction(name => window.__cenaReview.snapshot().activeClip === name, clip);
    const start = await page.evaluate(() => window.__cenaReview.snapshot());
    await page.waitForFunction(frame => window.__cenaReview.snapshot().playbackFrames > frame + 12, start.playbackFrames);
    const state = await page.evaluate(() => window.__cenaReview.snapshot());
    assert.equal(state.activeClip, clip);
    assert.ok(state.rightGripError < 1e-5 && state.leftGripError < 1e-5);
    await page.screenshot({ path: resolve(out, `live-${clip}.png`) });
    cases.push({ mode: clip, ...state });
  }
  await page.locator('[data-pose="idle"]').click();
  await page.waitForFunction(() => window.__cenaReview.snapshot().activeClip === '');
  // Deterministic close-up review of the real animator throughout the run cycle.
  await page.evaluate(() => window.__cenaReview.equip('unarmed'));
  for (const [phase, seconds, stopSeconds] of [['start', .3, null], ['loop', 1.1, null], ['loop2', 1.4, null], ['stop', 1.4, .4], ['stopEnd', 1.4, 1.4]]) {
    await page.evaluate(([time, stop]) => window.__cenaReview.sampleRun(time, stop ?? undefined), [seconds, stopSeconds]);
    for (const view of ['neckSide', 'neckFront', 'side', 'front']) {
      await page.evaluate(v => window.__cenaReview.render(v), view);
      await page.screenshot({ path: resolve(out, `neck-final-${phase}-${view}.png`) });
    }
    const state = await page.evaluate(() => window.__cenaReview.snapshot());
    assert.ok(state.rightGripError < 1e-5 && state.leftGripError < 1e-5);
    assert.deepEqual(state.actorPosition, [0, 0, 0]);
    cases.push({ mode: `neck-${phase}`, ...state });
  }
  assert.ok(!requestedAssets.some(url => url.includes('astra-hunyuan') || url.includes('army-running')), 'no old character mesh downloaded at runtime');
  assert.deepEqual(diagnostics, { consoleErrors: [], warnings: [], pageErrors: [], requestFailures: [] });
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ status: 'PASS', cases, diagnostics }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', cases, diagnostics }, null, 2));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
