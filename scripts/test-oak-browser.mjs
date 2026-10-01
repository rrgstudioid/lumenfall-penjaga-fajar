// Real Home + Game in an isolated Chrome profile. No owner saves are touched.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import { PLAINS_OAKS } from '../lib/game/verdant-plains-oaks.ts';
import {
  PLAINS_ID,
  PLAINS_ENTRY,
  PLAINS_EXIT,
  PLAINS_POCKETS,
  PLAINS_BRIDGE,
} from '../lib/game/verdant-plains-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = process.env.VERDANT_QA_OUTPUT || 'output/oak/runtime';
const legacyBaseline = process.env.OAK_LEGACY_BASELINE === '1';
const baselineRef =
  process.env.OAK_BASELINE_REF || '674146c0d29ae78c99ed1380268a63698f51cf56';
if (legacyBaseline && !process.env.OAK_PROFILE_ONLY)
  throw Error('Legacy comparison is profile-only');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  }),
  page = await context.newPage();
const errors = [],
  checks = [],
  performance = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
    console.log('CONSOLE', m.text());
  }
});
page.on('requestfailed', (r) =>
  console.log('REQUEST FAILED', r.url(), r.failure()),
);
const check = (name, value = true) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__plainsQA = this; window.__plainsThree = T; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
if (legacyBaseline) {
  // Read-only comparison: serve the pre-oak map/layout into this isolated browser.
  // No checkout, working-file replacement, or owner-save changes.
  for (const name of ['verdant-plains-map', 'verdant-plains-layout']) {
    const source = execFileSync(
      'git',
      ['show', baselineRef + ':lib/game/' + name + '.ts'],
      { encoding: 'utf8' },
    );
    await page.route(
      new RegExp('/lib/game/' + name + '\\.ts(?:\\?|$)'),
      async (route) => {
        const response = await route.fetch(),
          current = await response.text();
        let body = ts.transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText;
        for (const moduleName of [
          'three',
          'three/examples/jsm/loaders/GLTFLoader.js',
        ]) {
          const marker = moduleName === 'three' ? 'three.js' : 'GLTFLoader';
          const resolved = [...current.matchAll(/from ["']([^"']+)["']/g)]
            .map((m) => m[1])
            .find((p) => p.includes(marker));
          if (resolved)
            body = body
              .replaceAll("'" + moduleName + "'", JSON.stringify(resolved))
              .replaceAll('"' + moduleName + '"', JSON.stringify(resolved));
        }
        body = body.replace(
          /from ["']\.\/([^"']+)["']/g,
          (_, p) =>
            'from ' +
            JSON.stringify('/lib/game/' + p.replace(/\.ts$/, '') + '.ts'),
        );
        if (name === 'verdant-plains-layout')
          body +=
            '\nPlainsNavigation.prototype.restore=function(p){return this.valid(p)?{x:p.x,z:p.z}:{...PLAINS_ENTRY};};';
        await writeFile(out + '/' + name + '.baseline.js', body);
        await route.fulfill({ response, body });
      },
    );
  }
}
const hero = createV3AdventurerHero('slot-1');
hero.characterId = 'verdant-regression';
hero.characterName = 'Verdant Explorer';
hero.inCity = false;
hero.currentField = PLAINS_ID;
hero.currentCity = 'averion';
hero.x = PLAINS_ENTRY.x;
hero.z = PLAINS_ENTRY.z;
if (process.env.VERDANT_RETIREMENT_ONLY === '1') {
  Object.assign(hero, {
    currentField: process.env.VERDANT_RETIRED_ID || 'verdant-plains',
    currentCity: 'arunika',
    x: 28,
    z: 39,
  });
}
const fixture = {
  version: 3,
  activeSlot: 'slot-1',
  lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
};
await context.addInitScript(
  ({ key, fixture }) => {
    performance.setResourceTimingBufferSize(10000);
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(fixture));
  },
  { key: SAVE_KEY, fixture },
);
try {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await page.waitForFunction(
    () => window.__plainsQA?.started && window.__plainsQA?.plains,
    null,
    { timeout: 120000 },
  );
  await page.locator('.game-shell.in-world').waitFor({ timeout: 120000 });
  if (process.env.OFFICE_PROFILE === '1') {
    check('new browser starts with Office quality', await page.evaluate(() => window.__plainsQA.plains.quality === 'office'));
  }
  await page.evaluate(() => window.__plainsQA.setPlainsQuality('balanced', false));
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__plainsQA,
      render = g.renderer.render.bind(g.renderer);
    g.renderer.info.autoReset = false;
    g.renderer.render = (scene, camera) => {
      g.renderer.info.reset();
      return render(scene, camera);
    };
    g.__oakOriginalCamera = g.camera;
    g.__oakOriginalUpdate = g.updateCamera;
  });
  if (!legacyBaseline) {
    check(
      'no legacy tree downloads',
      await page.evaluate(
        () =>
          !performance
            .getEntriesByType('resource')
            .some((r) => /\/(fir|tree)(\.glb|-far\.png)/.test(r.name)),
      ),
    );
    check(
      '30 enlarged oak, 497 enemies, original close-up grass density across 250m',
      await page.evaluate(() => {
        const g = window.__plainsQA,
          m = g.plains.metrics();
        return (
          m.oaks.count === 30 && g.enemies.length === 497 &&
          m.grassField.radius===250 && m.grassField.density===90000/6400 && !m.grassField.lod &&
          m.grassField.visibleTiles<m.grassField.tiles && m.grassField.visibleTiles>0
        );
      }),
    );
    await page.screenshot({ path: out + '/camp.png' });
  } else
    check(
      'legacy fixture has 345 trees and 497 unchanged enemies',
      await page.evaluate(() => {
        const g = window.__plainsQA;
        return g.plains.metrics().props === 854 && g.enemies.length === 497;
      }),
    );
  check('uniform dense grass shares buffers and keeps the same blade detail in all tiles',await page.evaluate(()=>{
    const g=window.__plainsQA, tiles=g.plains.root.getObjectByName('Grass dense field').children;
    const attributes=new Map();
    for(const mesh of tiles){
      const geometry=mesh.geometry, attribute=geometry.getAttribute('aGrassPatch');
      if(geometry.getAttribute('position').count!==18 || mesh.frustumCulled) return false;
      if(attributes.has(attribute) && attributes.get(attribute)!==geometry.instanceCount) return false;
      attributes.set(attribute,geometry.instanceCount);
    }
    return attributes.size===4 && [...attributes.values()].reduce((n,c)=>n+c,0)===54932 &&
      [...attributes.keys()].reduce((n,a)=>n+a.array.byteLength,0)===1757824;
  }));
  // Authoring views under the actual map's sun, sky, fog and tone mapping.
  let orbit;
  if (!process.env.OAK_PROFILE_ONLY) {
    await page.evaluate(() => {
      const g = window.__plainsQA;
      g.paused = true;
      g.updateCamera = () => {};
    });
    for (const [name, yaw, elevation, distance] of [
      ['front', 0, 8, 38],
      ['back', Math.PI, 8, 38],
      ['left', -Math.PI / 2, 8, 38],
      ['right', Math.PI / 2, 8, 38],
      ['quarter', Math.PI / 4, 12, 42],
      ['high', Math.PI / 4, 45, 45],
      ['far', 0, 25, 430],
    ]) {
      await page.evaluate(
        ({ yaw, elevation, distance }) => {
          const g = window.__plainsQA,
            T = window.__plainsThree;
          const camera = new T.PerspectiveCamera(45, 1920 / 1080, 0.1, 2000);
          const x = -330,
            z = -150,
            y = g.plains.groundHeight(x, z);
          camera.position.set(
            x + Math.sin(yaw) * distance,
            y + 10 + elevation,
            z + Math.cos(yaw) * distance,
          );
          camera.lookAt(x, y + 10, z);
          camera.updateMatrixWorld();
          g.camera = camera;
          g.plains.update(camera, g.hero, 5);
        },
        { yaw, elevation, distance },
      );
      await page.waitForTimeout(300);
      await page.screenshot({ path: out + '/oak-' + name + '.png' });
    }
    orbit = await page.evaluate(() => {
      const g = window.__plainsQA,
        before = g.plains.metrics().oaks;
      g.camera.rotateY(Math.PI);
      g.camera.updateMatrixWorld();
      g.plains.update(g.camera, g.hero, 10);
      return { before, after: g.plains.metrics().oaks };
    });
    check(
      'camera rotation updates visibility without player movement',
      orbit.before.visible !== orbit.after.visible,
    );
    await page.evaluate(() => {
      const g = window.__plainsQA,
        T = window.__plainsThree;
      const c = new T.OrthographicCamera(-600, 600, 337.5, -337.5, 0.1, 3000);
      c.position.set(250, 900, 650);
      c.lookAt(0, 0, -50);
      c.updateMatrixWorld();
      g.camera = c;
      g.__oakFog = g.scene.fog;
      g.scene.fog = null;
      g.plains.update(c, g.hero, 10);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out + '/overview.png' });
    check(
      'orthographic camera LOD keeps visible placements',
      await page.evaluate(
        () => window.__plainsQA.plains.metrics().oaks.visible > 15,
      ),
    );
    await page.evaluate(() => {
      const g = window.__plainsQA;
      g.scene.fog = g.__oakFog;
    });
    for (const tree of PLAINS_OAKS.filter((p) => p.landmark)) {
      await page.evaluate((p) => {
        const g = window.__plainsQA;
        g.camera = g.__oakOriginalCamera;
        g.updateCamera = g.__oakOriginalUpdate;
        Object.assign(
          g.hero,
          g.plains.navigation.restore({ x: p.x, z: p.z + 25 }),
        );
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
        g.followView.yaw = g.followView.targetYaw = 0;
        g.followView.pitch = g.followView.targetPitch = 0.22;
        g.updateCamera(1);
      }, tree);
      await page.waitForTimeout(200);
      await page.screenshot({ path: out + '/zone-' + tree.zone + '.png' });
    }
    await page.evaluate(() => {
      const g = window.__plainsQA;
      g.paused = false;
      g.followView.yaw = g.followView.targetYaw = Math.atan2(
        40 - 120,
        -440 + 10,
      );
      g.followView.pitch = g.followView.targetPitch = 0.38;
    });
  }
  await page.evaluate(() => {
    const g = window.__plainsQA;
    g.followView.yaw = g.followView.targetYaw = Math.atan2(40 - 120, -440 + 10);
    g.followView.pitch = g.followView.targetPitch = 0.38;
  });
  // Same fixed route and camera as baseline. Headless values are not a hardware FPS claim.
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    for (const quality of (process.env.OFFICE_ONLY === '1' ? ['office'] : process.env.OFFICE_PROFILE === '1' ? ['office', 'light', 'balanced', 'high'] : ['light', 'balanced', 'high'])) {
      await page.evaluate(
        (q) => window.__plainsQA.setPlainsQuality(q),
        quality,
      );
      const route =
        quality === 'balanced' || quality === 'office'
          ? [
              PLAINS_ENTRY,
              ...PLAINS_POCKETS,
              PLAINS_EXIT,
              {
                x: PLAINS_BRIDGE.x - PLAINS_BRIDGE.dx * 42,
                z: PLAINS_BRIDGE.z - PLAINS_BRIDGE.dz * 42,
              },
            ]
          : [PLAINS_ENTRY, PLAINS_OAKS.find((p) => p.zone === 'southeast')];
      for (const point of route) {
        await page.evaluate((p) => {
          const g = window.__plainsQA;
          Object.assign(g.hero, g.plains.navigation.restore(p));
          g.placeActor();
          g.cameraFocus.copy(g.actor.position);
        }, point);
        await page.waitForTimeout(250);
        await page.keyboard.down('w');
        const sample = await page.evaluate(async () => {
          const g = window.__plainsQA,
            times = [],
            cpu = [],
            calls = [],
            tri = [],
            oakTri = [],
            oakCalls = [];
          let last = performance.now();
          for (let i = 0; i < 90; i++) {
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            times.push(now - last);
            last = now;
            const m = g.plains.metrics().oaks ?? {
              cpuMs: 0,
              triangles: 0,
              drawCalls: 0,
            };
            cpu.push(m.cpuMs);
            calls.push(g.renderer.info.render.calls);
            tri.push(g.renderer.info.render.triangles);
            oakTri.push(m.triangles);
            oakCalls.push(m.drawCalls);
          }
          times.sort((a, b) => a - b);
          cpu.sort((a, b) => a - b);
          return {
            p50: times[45],
            p95: times[85],
            p99: times[89],
            cpuP95: cpu[85],
            calls: Math.max(...calls),
            triangles: Math.max(...tri),
            oakTriangles: Math.max(...oakTri),
            oakCalls: Math.max(...oakCalls),
            map: g.plains.metrics(),
            memory: g.renderer.info.memory,
            diagnostics: g.getPerformanceDiagnostics?.(),
          };
        });
        await page.keyboard.up('w');
        performance.push({ viewport, quality, point, ...sample });
        check(
          `${quality} oak render budget ${viewport.width} ${point.x}`,
          sample.oakTriangles <=
            { office: 40000, light: 80000, balanced: 180000, high: 300000 }[quality] &&
            sample.oakCalls <= 40,
        );
        if (quality === 'office') {
          const buffer = sample.diagnostics.drawingBuffer;
          check('Office 3D pixel budget and grass range', buffer.width * buffer.height <= 1280 * 720 && sample.map.grassField.radius === 100);
          check('Office preserves all oak and population', sample.map.oaks.count === 30 && await page.evaluate(() => window.__plainsQA.enemies.length === 497));
          await page.screenshot({ path: out + `/office-${viewport.width}-${point.x}.png` });
        }
      }
    }
  }
  await writeFile(
    out + '/performance.json',
    JSON.stringify(performance, null, 2),
  );
  const cpu95 = Math.max(...performance.map((p) => p.cpuP95));
  check('oak CPU p95 below 0.5ms', cpu95 <= 0.5);
  if (process.env.OAK_PROFILE_ONLY) {
    if (process.env.OFFICE_PROFILE === '1') {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Options', exact: true }).click();
      await page.getByRole('button', { name: 'Graphics', exact: true }).click();
      assert.equal(await page.getByRole('radio').count(), 4);
      await page.getByRole('radio', { name: 'Low', exact: true }).check();
      await page.getByText('Diagnostik performa', { exact: true }).click();
      await page.getByRole('button', { name: 'Ambil laporan performa', exact: true }).click();
      const report = JSON.parse(await page.getByLabel('Laporan performa').inputValue());
      check('graphics menu exposes local diagnostics and Office choice', report.quality === 'office' && report.gpu && !report.gpuTimeMeasured);
      await page.screenshot({ path: out + '/graphics-diagnostics.png' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
      await page.waitForFunction(() => window.__plainsQA?.plains && !window.__plainsQA.transitioning, null, { timeout: 120000 });
      check('Office setting survives reload', await page.evaluate(() => window.__plainsQA.plains.quality === 'office'));
      const resources = [];
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.__plainsQA.setPlainsQuality('high', false));
        await page.waitForTimeout(80);
        await page.evaluate(() => window.__plainsQA.setPlainsQuality('office', false));
        await page.waitForTimeout(80);
        resources.push(await page.evaluate(() => ({ ...window.__plainsQA.renderer.info.memory })));
      }
      check('ten quality switches do not accumulate geometry or textures', resources.at(-1).geometries === resources[1].geometries && resources.at(-1).textures === resources[1].textures);
      await writeFile(out + '/quality-resources.json', JSON.stringify(resources, null, 2));
    }
    check('profile has no runtime errors', errors.length === 0);
    await writeFile(
      out + '/profile-checks.json',
      JSON.stringify({ checks, errors, cpu95 }, null, 2),
    );
    await browser.close();
    process.exit(0);
  }
  await page.evaluate((p) => {
    const g = window.__plainsQA;
    Object.assign(g.hero, { x: p.x, z: p.z });
    g.save();
  }, PLAINS_OAKS[0]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__plainsQA?.started &&
      window.__plainsQA?.plains &&
      !window.__plainsQA.transitioning,
    null,
    { timeout: 120000 },
  );
  check(
    'reload inside trunk finds valid nearby point',
    await page.evaluate((p) => {
      const g = window.__plainsQA;
      return (
        g.plains.navigation.valid(g.hero) &&
        Math.hypot(g.hero.x - p.x, g.hero.z - p.z) <= 10
      );
    }, PLAINS_OAKS[0]),
  );
  const resources = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() =>
      window.__plainsQA.changeRegion('east-gate-arunika'),
    );
    await page.waitForFunction(
      () =>
        !window.__plainsQA.transitioning &&
        window.__plainsQA.hero.currentField === 'east-gate-arunika',
      null,
      { timeout: 120000 },
    );
    check(
      'East Gate population ' + i,
      await page.evaluate(() => window.__plainsQA.enemies.length === 42),
    );
    await page.evaluate(() =>
      window.__plainsQA.changeRegion('verdant-plains-v2'),
    );
    await page.waitForFunction(
      () => window.__plainsQA.plains && !window.__plainsQA.transitioning,
      null,
      { timeout: 120000 },
    );
    await page.waitForTimeout(250);
    resources.push(
      await page.evaluate(() => ({
        ...window.__plainsQA.renderer.info.memory,
      })),
    );
  }
  check(
    'ten map roundtrips keep GPU resources stable',
    resources[9].textures <= resources[1].textures &&
      resources[9].geometries <= resources[1].geometries,
  );
  await page.evaluate(() => window.__plainsQA.changeRegion('averion'));
  await page.waitForFunction(
    () => window.__plainsQA.averion && !window.__plainsQA.transitioning,
    null,
    { timeout: 120000 },
  );
  check('Averion travel still works');
  await page.evaluate(() =>
    window.__plainsQA.changeRegion('verdant-plains-v2'),
  );
  await page.waitForFunction(
    () => window.__plainsQA.plains && !window.__plainsQA.transitioning,
    null,
    { timeout: 120000 },
  );
  check('no unexpected runtime errors', errors.length === 0);
  // A new page clears GLTF/texture loader caches before forcing an oak failure.
  await page.route('**/oak/oak.gltf', (r) =>
    r.fulfill({ status: 503, body: 'Oak regression failure' }),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'Map gagal dimuat' })
    .waitFor({ timeout: 120000 });
  check(
    'failed oak blocks play and exposes retry',
    await page.evaluate(() => {
      const g = window.__plainsQA,
        x = g.hero.x;
      g.move(8, 0);
      return !g.plains && g.hero.x === x && !!g.regionLoadError;
    }),
  );
  const expectedFailureErrors = errors.splice(0);
  await page.unroute('**/oak/oak.gltf');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__plainsQA?.plains &&
      !window.__plainsQA.regionLoadError &&
      !window.__plainsQA.transitioning,
    null,
    { timeout: 120000 },
  );
  check(
    'retry restores all 30 oak',
    await page.evaluate(
      () => window.__plainsQA.plains.metrics().oaks.count === 30,
    ),
  );
  const transfer = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => r.name.includes('/oak/'))
      .map((r) => ({
        url: r.name,
        bytes: r.encodedBodySize,
        transfer: r.transferSize,
      })),
  );
  await writeFile(
    out + '/acceptance.json',
    JSON.stringify(
      {
        checks,
        errors,
        expectedFailureErrors,
        resources,
        transfer,
        orbit,
        cpu95,
      },
      null,
      2,
    ),
  );
  check('no errors after retry', errors.length === 0);
} finally {
  await browser.close();
}
