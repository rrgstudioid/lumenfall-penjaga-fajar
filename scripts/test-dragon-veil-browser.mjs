import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(
  new URL('../work/character-tools/package.json', import.meta.url),
);
const { chromium } = require('playwright');
const out = resolve('work/dragon-veil/browser'),
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
  if (path === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const root = /^\/assets\/(characters|equipment|icons|decoders)\//.test(path)
    ? resolve('public')
    : built;
  const file = resolve(root, '.' + decodeURIComponent(path));
  if (!file.startsWith(root + '\\')) {
    res.writeHead(403).end();
    return;
  }
  try {
    const bytes = await readFile(file);
    res
      .writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      })
      .end(bytes);
  } catch {
    console.log('404', path);
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } }),
  errors = [],
  report = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (['error', 'warning'].includes(m.type())) errors.push(m.text());
});
try {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/tests/browser/dragon-veil-fixture.html`,
  );
  await page.waitForFunction(
    () =>
      window.dragonVeilQA?.model() &&
      window.dragonVeilQA.model().actor.userData.modelStatus !== 'loading',
    null,
    { timeout: 60000 },
  );
  const initial = await page.evaluate(() => window.dragonVeilQA.snapshot());
  console.log(JSON.stringify(initial));
  for (const view of ['front', 'back', 'side', 'quarter', 'close']) {
    await page.evaluate((v) => window.dragonVeilQA.render(v), view);
    await page.screenshot({ path: resolve(out, `full-${view}.png`) });
  }
  assert.equal(initial.status, 'ready');
  assert.equal(initial.pieces.length, 4);
  if (!process.argv.includes('--quick') && !process.argv.includes('--legs')) {
    // An older body request arriving last must not replace the newest equipment LOD.
    let resumeLOD, requestedLOD;
    const blockedLOD = new Promise((r) => (resumeLOD = r)),
      startedLOD = new Promise((r) => (requestedLOD = r));
    await page.route('**/body/body-lod1.glb*', async (r) => {
      requestedLOD();
      await blockedLOD;
      await r.continue();
    });
    await page.evaluate(() => {
      window.oldDVLOD = window.dragonVeilQA.lod(1);
    });
    await startedLOD;
    await page.evaluate(() => window.dragonVeilQA.lod(2));
    resumeLOD();
    await page.evaluate(() => window.oldDVLOD);
    const newest = await page.evaluate(() => window.dragonVeilQA.snapshot());
    assert(newest.pieces.every((p) => p.lod === 2));
    await page.unroute('**/body/body-lod1.glb*');
    report.push({ lodRace: newest });
    for (let mask = 0; mask < 16; mask++) {
      const state = await page.evaluate(
        (m) => window.dragonVeilQA.build(m),
        mask,
      );
      assert(state.ready);
      assert.equal(
        state.pieces.length,
        mask.toString(2).replaceAll('0', '').length,
      );
      for (const view of ['front', 'back', 'side', 'close']) {
        await page.evaluate((v) => window.dragonVeilQA.render(v), view);
        await page.screenshot({
          path: resolve(out, `mask-${mask}-${view}.png`),
        });
      }
      report.push({ mask, ...state });
      assert.equal(state.hair.length, 1);
      const preview = await page.evaluate(
        (m) => window.dragonVeilQA.build(m, false, 'hair_01', true),
        mask,
      );
      assert(preview.ready);
      assert.equal(preview.pieces.length, state.pieces.length);
      for (const view of ['front', 'back', 'side', 'close']) {
        await page.evaluate((v) => window.dragonVeilQA.render(v), view);
        await page.screenshot({
          path: resolve(out, `preview-${mask}-${view}.png`),
        });
      }
    }
    for (let n = 1; n <= 10; n++) {
      const hair = `hair_${String(n).padStart(2, '0')}`;
      const wearing = await page.evaluate(
        (h) => window.dragonVeilQA.build(1, false, h),
        hair,
      );
      assert(wearing.hair[0].includes(hair));
      await page.evaluate(() => window.dragonVeilQA.render('quarter'));
      await page.screenshot({ path: resolve(out, `helmet-${hair}.png`) });
      const restored = await page.evaluate(
        (h) => window.dragonVeilQA.build(0, false, h),
        hair,
      );
      assert(restored.hair[0].includes(hair));
    }
    await page.evaluate(() => window.dragonVeilQA.build(1));
    const changedHair = await page.evaluate(() =>
      window.dragonVeilQA.appearance({
        hairStyleId: 'hair_09',
        hairColor: '#1f538e',
      }),
    );
    assert(changedHair.hair[0].includes('hair_09'));
    for (let lod = 0; lod < 4; lod++) {
      const changedLOD = await page.evaluate(
        (l) => window.dragonVeilQA.lod(l),
        lod,
      );
      assert.equal(changedLOD.hair[0], `hair/hair_09-lod${lod}.glb`);
    }
    for (const wings of [false, true]) {
      await page.evaluate((w) => window.dragonVeilQA.build(15, w), wings);
      for (const pose of [
        'idle',
        'walk',
        'run',
        'basic_attack',
        'ranged_attack',
        'magic_cast',
        'dash',
        'hit',
        'dead',
        'swim',
      ])
        for (const time of [0.12, 0.35, 0.7]) {
          const state = await page.evaluate(
            ({ pose, time }) => window.dragonVeilQA.pose(pose, time, 'quarter'),
            { pose, time },
          );
          assert(
            state.pieces.every((p) =>
              [...p.min, ...p.max].every(Number.isFinite),
            ),
          );
          await page.screenshot({
            path: resolve(
              out,
              `${wings ? 'wings' : 'body'}-${pose}-${time}.png`,
            ),
          });
          report.push({ wings, pose, time, ...state });
        }
      for (const [name, moving, sprinting] of [
        ['walk', true, false],
        ['sprint', true, true],
        ['slow', true, false],
        ['stop', false, false],
      ]) {
        await page.evaluate(
          ({ moving, sprinting }) => {
            for (let n = 0; n < 15; n++)
              window.dragonVeilQA
                .model()
                .animator.update(1 / 60, { moving, sprinting });
            window.dragonVeilQA.render('quarter');
          },
          { moving, sprinting },
        );
        await page.screenshot({ path: resolve(out, `transition-${name}.png`) });
      }
    }
    await page.evaluate(() => window.dragonVeilQA.pose('idle', 0.1));
    for (let lod = 0; lod < 4; lod++) {
      report.push(await page.evaluate((l) => window.dragonVeilQA.lod(l), lod));
      await page.screenshot({ path: resolve(out, `lod-${lod}.png`) });
    }
    const disposed = await page.evaluate(() => window.dragonVeilQA.dispose());
    assert.equal(disposed.cache.users, 0);
    assert.equal(disposed.cache.entries, 0);
    assert.deepEqual(errors, []);
    // A failed required piece is visible in readiness, is retryable, and leaks no leases.
    await page.route('**/head-lod0.glb*', (r) =>
      r.fulfill({ status: 503, body: 'Injected QA failure' }),
    );
    const failure = await page.evaluate(() => window.dragonVeilQA.build(1));
    assert.equal(failure.ready, false);
    assert.equal(failure.status, 'error');
    assert(errors.some((e) => e.includes('503')));
    errors.length = 0;
    await page.unroute('**/head-lod0.glb*');
    const retry = await page.evaluate(() => window.dragonVeilQA.build(1));
    assert(retry.ready);
    await page.evaluate(() => window.dragonVeilQA.dispose());
    // Destruction while a fetch is pending must never attach the late model.
    let release, started;
    const blocked = new Promise((r) => (release = r)),
      requested = new Promise((r) => (started = r));
    await page.route('**/head-lod0.glb*', async (r) => {
      started();
      await blocked;
      await r.continue();
    });
    await page.evaluate(() => {
      window.pendingDV = window.dragonVeilQA.build(15);
    });
    await requested;
    await page.evaluate(() => window.dragonVeilQA.dispose());
    release();
    const late = await page.evaluate(() => window.pendingDV);
    assert.equal(late.ready, false);
    assert.equal(late.disposed, true);
    const released = await page.evaluate(() => window.dragonVeilQA.dispose());
    assert.equal(released.cache.users, 0);
    assert.equal(released.cache.entries, 0);
    await page.unroute('**/head-lod0.glb*');
    report.push({ failure, retry, late, released });
  }
  if (process.argv.includes('--legs')) {
    for (const mask of [4, 12]) {
      await page.evaluate((m) => window.dragonVeilQA.build(m), mask);
      for (const pose of ['idle', 'walk', 'run', 'basic_attack', 'swim'])
        for (const time of [0.35, 0.7]) {
          for (const view of ['legs-front', 'legs-side', 'legs-back']) {
            const state = await page.evaluate(
              ({ pose, time, view }) =>
                window.dragonVeilQA.pose(pose, time, view),
              { pose, time, view },
            );
            assert.equal(state.status, 'ready');
            await page.screenshot({
              path: resolve(out, `legs-${mask}-${pose}-${time}-${view}.png`),
            });
            report.push({ mask, pose, time, view, ...state });
          }
        }
    }
    const disposed = await page.evaluate(() => window.dragonVeilQA.dispose());
    assert.equal(disposed.cache.users, 0);
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    resolve(
      out,
      process.argv.includes('--legs') ? 'legs-report.json' : 'report.json',
    ),
    JSON.stringify({ report, errors }, null, 2),
  );
  await browser.close();
  server.close();
}
