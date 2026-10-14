// Disposable browser context and a memory-only application fixture; no owner saves.
import { chromium } from '../output/whispering-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output = 'output/whispering-wilds';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const check = (name, value) => {
  assert(value, name);
  checks.push(name);
  console.log('PASS', name);
};
async function ready() {
  await page.waitForFunction(
    () =>
      window.__wildsQA?.game?.started &&
      !window.__wildsQA.game.transitioning &&
      !window.__wildsQA.game.regionLoadError,
    null,
    { timeout: 120000 },
  );
}
try {
  await page.goto('http://127.0.0.1:3004/whispering-wilds.html', {
    waitUntil: 'domcontentloaded',
  });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 120000 });
  await ready();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${output}/entry.png` });
  const state = await page.evaluate(() => {
    const g = window.__wildsQA.game;
    return {
      map: g.hero.currentField,
      level: g.hero.level,
      enemies: g.enemies.length,
      npcs: g.npcLabels.length,
      shrine: g.shrine.visible,
      metrics: g.getPerformanceDiagnostics(),
    };
  });
  check(
    'level-sixteen entry supports the hunting population without NPCs or shrine',
    state.map === 'whispering-wilds-v2' &&
      state.level === 16 &&
      state.enemies === 273 &&
      state.npcs === 0 &&
      !state.shrine,
  );
  check(
    'continuous rivers have no waterfall meshes or mist',
    state.metrics.whisperingWilds.waterfalls === 0 &&
      state.metrics.whisperingWilds.particles.mistCap === 0 &&
      (await page.evaluate(
        () =>
          !window.__wildsQA.game.wilds.root.getObjectByName(
            'Curved waterfall sheets and impact foam',
          ),
      )),
  );
  check(
    'one elder tree marks the island and its trunk blocks movement',
    state.metrics.whisperingWilds.trees === 1 &&
      state.metrics.whisperingWilds.iconTree.height > 115 &&
      (await page.evaluate(
        () =>
          !window.__wildsQA.game.wilds.navigation.valid(
            window.__wildsQA.layout.WILDS_LAKE_ISLAND,
          ),
      )),
  );
  const bridgePixels = await page.evaluate(() => {
    const { game: g, layout: l } = window.__wildsQA;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 240;
    const ctx = canvas.getContext('2d');
    g.wilds.drawMinimap(ctx, 240);
    return l.WILDS_BRIDGES.flatMap((b) =>
      [-0.3, 0, 0.3].map((t) => {
        const x = Math.round((b.x + b.axis.x * b.length * t + 500) * 0.24),
          z = Math.round((b.z + b.axis.z * b.length * t + 500) * 0.24);
        return [...ctx.getImageData(x, z, 1, 1).data];
      }),
    );
  });
  check(
    'all four minimap bridge symbols follow their real crossings',
    bridgePixels.every(([r, g, b]) => r > b + 15 && g > b),
  );
  const riverArea = await page.evaluate(() => {
    const g = window.__wildsQA.game,
      river = g.wilds.root.getObjectByName('Moonlit river').geometry;
    const p = river.getAttribute('position'),
      index = river.index;
    let area = 0;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const a = index ? index.getX(i) : i,
        b = index ? index.getX(i + 1) : i + 1,
        c = index ? index.getX(i + 2) : i + 2;
      area +=
        Math.abs(
          (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) -
            (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)),
        ) / 2;
    }
    return area;
  });
  check(
    'river mesh has a real surface instead of collapsed zero-width triangles',
    riverArea > 20000,
  );
  await page.keyboard.press('m');
  await page
    .getByRole('button', { name: 'Enter Whispering Wilds', exact: true })
    .waitFor();
  check(
    'M menu exposes new field',
    await page
      .getByRole('button', { name: 'Enter Whispering Wilds', exact: true })
      .isVisible(),
  );
  await page.screenshot({ path: `${output}/map-menu.png` });
  await page.keyboard.press('Escape');
  const points = [
    ['grove', 245, 285],
    ['lake', 400, 460],
    ['falls', 850, 210],
    ['sanctuary', 795, 440],
    ['twilight', 240, 700],
    ['hollow', 775, 735],
  ];
  for (const [name, u, v] of points) {
    await page.evaluate(
      ({ u, v }) => {
        const g = window.__wildsQA.game;
        Object.assign(
          g.hero,
          g.wilds.navigation.restore({ x: u - 500, z: v - 500 }),
        );
        g.placeActor();
        g.cameraFocus.copy(g.actor.position);
        g.followView.distance = g.followView.targetDistance = 22;
        g.followView.pitch = g.followView.targetPitch = 0.18;
        g.followView.yaw = g.followView.targetYaw = 0;
      },
      { u, v },
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.followView.pitch = g.followView.targetPitch = -0.12;
    g.followView.yaw = g.followView.targetYaw = 1;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${output}/night-sky.png` });
  const traversals = await page.evaluate(() => {
    const { game: g, layout: l } = window.__wildsQA;
    const errors = [];
    for (const [id, path] of [...l.WILDS_PATHS.entries()].filter(
      ([i]) => i === 0 || i >= 6,
    ))
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          b = path.points[i],
          steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5);
        let p = { ...a };
        for (let j = 0; j < steps; j++)
          p = g.wilds.move(p, (b.x - a.x) / steps, (b.z - a.z) / steps);
        if (Math.hypot(p.x - b.x, p.z - b.z) > 0.2)
          errors.push({ id, i, p, b });
      }
    const bridge = l.WILDS_BRIDGES.at(-1),
      start = { x: bridge.x - bridge.length / 2 - 8, z: bridge.z };
    const end = g.wilds.move(start, bridge.length + 16, 0);
    if (Math.abs(end.x - (bridge.x + bridge.length / 2 + 8)) > 0.2)
      errors.push({ islandBridge: end });
    return errors;
  });
  check(
    'main loop, city approaches and the island bridge remain traversable',
    traversals.length === 0,
  );
  const portalChecks = [];
  for (const destination of ['jayantara', 'arunika', 'averion']) {
    const result = await page.evaluate((destination) => {
      const { game: g, layout: l, three: T } = window.__wildsQA,
        p = l.WILDS_PORTALS.find((p) => p.destination === destination);
      Object.assign(g.hero, { x: p.x, z: p.z + 3 });
      g.placeActor();
      g.cameraFocus.copy(g.actor.position);
      g.updateCamera(0);
      g.camera.updateMatrixWorld();
      const screen = new T.Vector3(
        p.x,
        g.groundHeight(p.x, p.z) + 2.6,
        p.z,
      ).project(g.camera);
      g.pointer.set(screen.x, screen.y);
      const interacted = g.tryNpcInteraction();
      return {
        interacted,
        notice: g.notice,
        field: g.hero.currentField,
        city: g.hero.currentCity,
        inCity: g.hero.inCity,
      };
    }, destination);
    portalChecks.push({ destination, ...result });
    check(
      `${destination} portal uses city access checks`,
      result.interacted &&
        (destination === 'jayantara'
          ? !result.inCity && result.notice.includes('24')
          : result.inCity && result.city === destination),
    );
    if (destination !== 'jayantara') {
      await ready();
      await page.evaluate(() =>
        window.__wildsQA.game.changeRegion('whispering-wilds-v2'),
      );
      await ready();
    }
  }
  const perf = [];
  for (const quality of ['office', 'balanced']) {
    await page.setViewportSize(
      quality === 'office'
        ? { width: 1280, height: 720 }
        : { width: 1920, height: 1080 },
    );
    await page.evaluate((q) => {
      const g = window.__wildsQA.game;
      g.setWildsQuality(q, false);
      g.followView.pitch = g.followView.targetPitch = 0.18;
    }, quality);
    await page.waitForTimeout(5000);
    perf.push(
      await page.evaluate(() =>
        window.__wildsQA.game.getPerformanceDiagnostics(),
      ),
    );
  }
  const vfxComparison = [];
  for (const enabled of [false, true]) {
    await page.evaluate((enabled) => {
      const g = window.__wildsQA.game;
      g.wilds.setVfxEnabled(enabled);
      g.setWildsQuality('balanced', false);
    }, enabled);
    await page.waitForTimeout(4500);
    vfxComparison.push({
      enabled,
      ...(await page.evaluate(() =>
        window.__wildsQA.game.getPerformanceDiagnostics(),
      )),
    });
  }
  const iconPerf = [];
  await page.evaluate(() => {
    const { game: g, three: T } = window.__wildsQA;
    window.__iconCameraState = {
      camera: g.camera,
      updateCamera: g.updateCamera,
    };
    g.updateCamera = () => {};
    g.camera = new T.PerspectiveCamera(60, 16 / 9, 0.1, 3000);
    g.camera.position.set(-150, 115, 190);
    g.camera.lookAt(15, 60, -55);
  });
  for (const quality of ['office', 'light', 'balanced', 'high']) {
    await page.setViewportSize(
      quality === 'office'
        ? { width: 1280, height: 720 }
        : { width: 1920, height: 1080 },
    );
    await page.evaluate(
      (q) => window.__wildsQA.game.setWildsQuality(q, false),
      quality,
    );
    await page.waitForTimeout(5000);
    iconPerf.push(
      await page.evaluate(() =>
        window.__wildsQA.game.getPerformanceDiagnostics(),
      ),
    );
    if (quality === 'balanced')
      await page.screenshot({ path: `${output}/elder-and-bridges-high.png` });
  }
  await page.evaluate(() => {
    const g = window.__wildsQA.game;
    g.camera = window.__iconCameraState.camera;
    g.updateCamera = window.__iconCameraState.updateCamera;
    delete window.__iconCameraState;
  });
  const memory = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__wildsQA.game.changeRegion('arunika'));
    await ready();
    await page.evaluate(() =>
      window.__wildsQA.game.changeRegion('whispering-wilds-v2'),
    );
    await ready();
    await page.waitForTimeout(150);
    memory.push(
      await page.evaluate(() => ({
        ...window.__wildsQA.game.renderer.info.memory,
      })),
    );
  }
  check(
    'map resource counts settle across repeated travel',
    memory
      .slice(3)
      .every(
        (m) =>
          m.geometries <= memory[3].geometries + 2 &&
          m.textures <= memory[3].textures + 2,
      ),
  );
  check('no runtime or shader errors', errors.length === 0);
  await writeFile(
    `${output}/browser-report.json`,
    JSON.stringify(
      {
        checks,
        state,
        portalChecks,
        perf,
        iconPerf,
        vfxComparison,
        memory,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  await writeFile(
    `${output}/browser-failure.json`,
    JSON.stringify(
      {
        checks,
        errors,
        failure: String(error),
        body: await page
          .locator('body')
          .innerText()
          .catch(() => ''),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
