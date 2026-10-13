import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const out = resolve('work/equipment-emissive/browser'),
  built = resolve(out, 'build');
await mkdir(out, { recursive: true });
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir: built,
    emptyOutDir: false,
    minify: false,
    chunkSizeWarningLimit: 5000,
    rolldownOptions: {
      input: resolve('tests/browser/dragon-veil-fixture.html'),
    },
  },
});
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') return void res.writeHead(204).end();
  const root = /^\/assets\/(characters|equipment|icons|decoders|vfx)\//.test(
    path,
  )
    ? resolve('public')
    : built;
  const file = resolve(root, '.' + decodeURIComponent(path));
  if (!file.startsWith(root + sep)) return void res.writeHead(403).end();
  try {
    res
      .writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      })
      .end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.setDefaultTimeout(60000);
const errors = [],
  report = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
const expected = [
  'dragon-veil-head',
  'dragon-veil-armor',
  'dragon-veil-legs',
  'dragon-veil-boots',
  'dragon-veil-wings',
  'legacy-fajar-blade',
].sort((a, b) => a.localeCompare(b));
const assertEmission = (state, level) => {
  assert.equal(state.status, 'ready');
  assert.deepEqual(
    [...new Set(state.emission.map((m) => m.id))].sort((a, b) => a.localeCompare(b)),
    expected,
  );
  for (const material of state.emission) {
    const wanted =
      typeof level === 'number' ? level : (level[material.id] ?? 0);
    assert.equal(material.level, wanted, material.id);
    assert.equal(material.intensity > 0, wanted > 0, material.id);
  }
};
try {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tests/browser/dragon-veil-fixture.html`,
  );
  await page.waitForFunction(
    () => window.dragonVeilQA?.snapshot().status === 'ready',
  );
  let previous = 0;
  for (let level = 0; level <= 12; level++) {
    const state = await page.evaluate(
      (level) => window.dragonVeilQA.build(15, true, 'hair_01', false, level),
      level,
    );
    assertEmission(state, level);
    const strength = state.emission.find(
      (m) => m.id === 'dragon-veil-wings',
    ).intensity;
    if (level) assert(strength > previous);
    previous = strength;
    report.push({ level, ...state });
    if ([0, 1, 6, 12].includes(level))
      for (const view of ['front', 'back']) {
        await page.evaluate((view) => window.dragonVeilQA.render(view), view);
        await page.locator('#label').evaluate((el, level) => {
          el.textContent += ` · Enhancement +${level}`;
        }, level);
        await page.screenshot({ path: `${out}/plus-${level}-${view}.png` });
      }
  }
  for (const lod of [1, 2, 3, 0]) {
    const state = await page.evaluate((n) => window.dragonVeilQA.lod(n), lod);
    assertEmission(state, 12);
    assert(state.pieces.every((p) => p.lod === lod));
    report.push({ lod, ...state });
  }
  for (const pose of ['walk', 'run', 'basic_attack', 'swim', 'dead']) {
    const state = await page.evaluate(
      (pose) => window.dragonVeilQA.pose(pose, 0.35, 'quarter'),
      pose,
    );
    assertEmission(state, 12);
    report.push({ pose, ...state });
  }
  // Reuse the still-cached +12 assets before trimming them; +0 must stay unlit.
  const cachedZero = await page.evaluate(() => window.dragonVeilQA.build(15, true, 'hair_01', true, 0));
  assertEmission(cachedZero, 0);
  report.push({ cachedZero });
  const levels = {
    'dragon-veil-head': 1,
    'dragon-veil-armor': 3,
    'dragon-veil-legs': 6,
    'dragon-veil-boots': 9,
    'dragon-veil-wings': 12,
  };
  const mixed = await page.evaluate(
    (levels) => window.dragonVeilQA.build(15, true, 'hair_01', true, levels),
    levels,
  );
  assertEmission(mixed, levels);
  report.push({ mixed });
  const disposed = await page.evaluate(() => window.dragonVeilQA.dispose());
  assert.equal(disposed.cache.users, 0);
  assert(disposed.disposedEmission.length >= 5);
  assert(disposed.disposedEmission.every((count) => count === 1));
  report.push({ disposed });
  const clean = await page.evaluate(() =>
    window.dragonVeilQA.build(15, true, 'hair_01', true, 0),
  );
  assertEmission(clean, 0);
  report.push({ clean });
  await page.evaluate(() => window.dragonVeilQA.dispose());
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
  await new Promise((r) => server.close(r));
}
console.log(
  `Emissive browser passed: +0 through +12, mixed levels, four LODs, poses and disposal. Evidence: ${out}`,
);
