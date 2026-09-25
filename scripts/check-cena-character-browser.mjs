// Prebuilt, world-free visual fixture; isolated browser storage and local server.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw Error('Set PLAYWRIGHT_MODULE to installed playwright/index.mjs');
const { chromium } = await import(pathToFileURL(modulePath).href);
const out = resolve('work/cena-character/browser'); await mkdir(out, { recursive: true });
const built = resolve(out, 'build');
await build({ configFile: false, publicDir: false, logLevel: 'warn', build: {
  outDir: built, emptyOutDir: false, minify: false, chunkSizeWarningLimit: 5000,
  rolldownOptions: { input: resolve('tests/browser/cena-character-fixture.html') },
} });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
  const root = url.pathname.startsWith('/assets/characters/') ? resolve('public') : built;
  const file = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + '\\')) { res.writeHead(403).end(); return; }
  try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(bytes); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed'), args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const diagnostics = { consoleErrors: [], warnings: [], pageErrors: [], requestFailures: [] }, cases = [];
page.on('console', m => { if (m.type() === 'error') diagnostics.consoleErrors.push(m.text()); if (m.type() === 'warning') diagnostics.warnings.push(m.text()); });
page.on('pageerror', e => diagnostics.pageErrors.push(e.message));
page.on('requestfailed', r => diagnostics.requestFailures.push(r.url()));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/browser/cena-character-fixture.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__cenaReview), { timeout: 60000 });
  for (const mode of ['unarmed', 'one', 'dual', 'two', 'female']) {
    const result = await page.evaluate(mode => window.__cenaReview.equip(mode), mode);
    assert.equal(result.asset, mode === 'female' ? 'female-rpg' : 'cena');
    if (mode !== 'female') { assert.equal(result.mixer, false); assert.deepEqual(result.nativeAnimations, []); }
    assert.ok(result.rightGripError < 1e-5 && result.leftGripError < 1e-5);
    cases.push({ mode, ...result });
    await page.screenshot({ path: resolve(out, `${mode}-front.png`) });
    if (mode === 'dual') {
      for (const view of ['threeQuarter', 'side', 'back', 'hands']) {
        await page.evaluate(v => window.__cenaReview.render(v), view);
        await page.screenshot({ path: resolve(out, `dual-${view}.png`) });
      }
      for (const motion of ['run', 'attack']) {
        const state = await page.evaluate(m => { window.__cenaReview.pose(m); return window.__cenaReview.snapshot(); }, motion);
        assert.ok(state.rightGripError < 1e-5 && state.leftGripError < 1e-5);
        assert.equal(state.mixer, false);
        await page.screenshot({ path: resolve(out, `dual-${motion}.png`) });
        cases.push({ mode: motion, ...state });
      }
    }
  }
  assert.deepEqual(diagnostics, { consoleErrors: [], warnings: [], pageErrors: [], requestFailures: [] });
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ status: 'PASS', cases, diagnostics }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', cases, diagnostics }, null, 2));
} finally { await browser.close(); await new Promise(r => server.close(r)); }
