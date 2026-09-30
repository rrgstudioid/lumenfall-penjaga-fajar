// Actual Home/Game with a disposable browser save; never touches the owner's profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createV3AdventurerHero, SAVE_KEY } from '../lib/game/rules.ts';
import {
  FROSTFIRE_ID,
  FROSTFIRE_ENTRY,
} from '../lib/game/frostfire-highlands-layout.ts';
const { chromium } = await import(
  pathToFileURL(
    'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs',
  ).href
);
const out = 'output/frostfire-highlands/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  }),
  page = await context.newPage();
const errors = [],
  checks = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    errors.push(m.text());
    console.log('CONSOLE ERROR', m.text().slice(0, 2500));
  }
});
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__frostQA=this;window.__frostThree=T;this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const hero = createV3AdventurerHero('slot-1');
Object.assign(hero, {
  characterId: 'frostfire-test',
  characterName: 'Frostfire Explorer',
  level: 32,
  inCity: false,
  currentCity: 'averion',
  currentField: FROSTFIRE_ID,
  ...FROSTFIRE_ENTRY,
});
// Start from an actual retired-terrain save; migration must choose the new entry.
delete hero.frostfireLayoutVersion;
hero.x = 8; hero.z = -25;
const fixture = {
  version: 3,
  activeSlot: 'slot-1',
  lastPlayedCharacterId: hero.characterId,
  characters: { 'slot-1': hero },
};
await context.addInitScript(
  ({ key, fixture }) => {
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify(fixture));
  },
  { key: SAVE_KEY, fixture },
);
const check = (label, value = true) => {
  assert(value, label);
  checks.push(label);
  console.log('PASS', label);
};
async function ready() {
  await page.waitForFunction(
    () =>
      window.__frostQA?.started &&
      window.__frostQA?.frostfire &&
      !window.__frostQA?.transitioning,
    null,
    { timeout: 120000 },
  );
}
try {
  await page.goto(process.env.FROSTFIRE_URL || 'http://localhost:3000', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await ready();
  check('retired terrain save enters permanent Frostfire safely', await page.evaluate(() => {
    const g = window.__frostQA;
    return g.hero.currentField === 'frostfire-highlands' && g.hero.frostfireLayoutVersion === 1 &&
      g.hero.x === 260 && g.hero.z === 300 && !g.terrain.visible;
  }));
  await page.waitForTimeout(1500);
  check(
    'hunting map loads the area-scaled Lv24-32 population',
    await page.evaluate(async () => {
      const { frostPopulation } =
        await import('/lib/game/frostfire-population.ts');
      const population = frostPopulation();
      return (
        window.__frostQA.enemies.length ===
          population.normalCount + population.eliteCount + 1 &&
        window.__frostQA.enemies.every(
          (e) => e.boss ? e.definition.level === 34 : e.definition.level >= 24 && e.definition.level <= 32,
        )
      );
    }),
  );
  await page.screenshot({ path: out + '/entry.png' });
  const stormFog = await page.evaluate(() => {
    const g = window.__frostQA;
    return {
      type: g.scene.fog?.isFogExp2,
      density: g.scene.fog?.density,
      color: g.scene.fog?.color.getHexString(),
      snow: g.frostfire.metrics().snow,
    };
  });
  check(
    'Frostfire has lighter dawn fog and the approved flake sizes',
    stormFog.type &&
      stormFog.density === 0.006 &&
      stormFog.snow.radius === 32 &&
      stormFog.snow.height === 32 &&
      stormFog.snow.windMultiplier === 5.5 &&
      stormFog.snow.spriteSizeCssPx.min === 2 &&
      stormFog.snow.spriteSizeCssPx.max === 10,
  );
  const before = await page.evaluate(() => ({ ...window.__frostQA.hero }));
  await page.keyboard.down('w');
  await page.waitForTimeout(2300);
  await page.keyboard.up('w');
  check(
    'actual keyboard locomotion works',
    await page.evaluate(
      (p) =>
        Math.hypot(
          window.__frostQA.hero.x - p.x,
          window.__frostQA.hero.z - p.z,
        ) > 3,
      before,
    ),
  );
  check(
    'footprints appear behind player',
    await page.evaluate(
      () => window.__frostQA.frostfire.metrics().footprints > 0,
    ),
  );
  await page.screenshot({ path: out + '/footprints.png' });
  const snowCheck = await page.evaluate(() => {
    const g = window.__frostQA,
      map = g.frostfire;
    const snow = map.root.children.find(
      (x) => x.name === 'Frostfire local wind-driven snow',
    );
    const a = snow.geometry.attributes.position,
      old = Array.from(a.array);
    map.update(g.camera, g.hero, 0.03, false, 1);
    const dx = Array.from({ length: 40 }, (_, i) => a.getX(i) - old[i * 3]);
    const speeds = Array.from(
      { length: a.count },
      (_, i) =>
        Math.hypot(a.getX(i) - old[i * 3], a.getZ(i) - old[i * 3 + 2]) / 0.03,
    )
      .filter((v) => v < 100)
      .sort((a, b) => a - b);
    const radius = map.metrics().snow.radius;
    const bounded = Array.from(
      { length: a.count },
      (_, i) =>
        Math.abs(a.getX(i) - g.camera.position.x) <= radius + 0.1 &&
        Math.abs(a.getZ(i) - g.camera.position.z) <= radius + 0.1,
    ).every(Boolean);
    return {
      count: a.count,
      bounded,
      drift: Math.max(...dx) - Math.min(...dx),
      medianWindSpeed: speeds[Math.floor(speeds.length / 2)],
    };
  });
  check(
    'snow uses bounded local particles with irregular horizontal drift',
    snowCheck.count === 2000 && snowCheck.bounded && snowCheck.drift > 0.01,
  );
  check('snow gusts move visibly faster', snowCheck.medianWindSpeed > 6);
  await page.screenshot({ path: out + '/snowstorm.png' });
  const dawn = await page.evaluate(() => {
    const g = window.__frostQA,
      T = window.__frostThree;
    const sky = g.frostfire.root.children.find(
      (o) => o.name === 'Frostfire UDS winter dawn',
    );
    const light = g.worldLightRig.children.find(
      (o) => o instanceof T.DirectionalLight,
    );
    const actual = light.position
      .clone()
      .sub(light.target.position)
      .normalize();
    const visible = sky.material.uniforms.uSun.value;
    return {
      alignment: actual.dot(visible),
      elevation: (Math.asin(visible.y) * 180) / Math.PI,
      color: light.color.getHexString(),
      intensity: light.intensity,
    };
  });
  check(
    'low warm dawn sun matches actual light direction',
    dawn.alignment > 0.99999 &&
      dawn.elevation > 8 &&
      dawn.elevation < 10 &&
      dawn.color === 'ffd0a0',
  );
  await page.evaluate(() => {
    const g = window.__frostQA,
      T = window.__frostThree;
    const original = g.renderer.render.bind(g.renderer);
    window.__restoreDawnRender = original;
    const camera = new T.PerspectiveCamera(52, 1440 / 900, 1, 1600);
    camera.position.set(215, 108, -260);
    camera.lookAt(215 + 0.72 * 200, 108 + 0.08 * 200, -260 - 0.68 * 200);
    camera.updateMatrixWorld();
    g.paused = true;
    g.renderer.render = (scene) => {
      g.frostfire.update(
        camera,
        g.hero,
        0.016,
        false,
        g.renderer.getPixelRatio(),
      );
      original(scene, camera);
    };
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: out + '/winter-dawn.png' });
  await page.evaluate(() => {
    window.__frostQA.renderer.render = window.__restoreDawnRender;
    window.__frostQA.paused = false;
    delete window.__restoreDawnRender;
  });
  const performance = await page.evaluate(async () => {
    const g = window.__frostQA;
    const frames = [];
    let last = window.performance.now();
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame);
      const now = window.performance.now();
      frames.push(now - last);
      last = now;
    }
    frames.sort((a, b) => a - b);
    return {
      medianFrameMs: frames[45],
      p95FrameMs: frames[85],
      renderer: g.renderer.info.render,
      memory: g.renderer.info.memory,
      metrics: g.frostfire.metrics(),
    };
  });
  await page.evaluate(() => {
    const g = window.__frostQA,
      T = window.__frostThree;
    g.paused = true;
    g.renderer.setAnimationLoop(null);
    const original = g.renderer.render.bind(g.renderer);
    const camera = new T.OrthographicCamera(-760, 760, 475, -475, 1, 2500);
    camera.position.set(160, 1140, 1050);
    camera.lookAt(0, 15, 0);
    camera.updateMatrixWorld();
    g.scene.fog = null;
    g.renderer.domElement.id = 'frostfire-qa-canvas';
    g.frostfire.root.children.find(
      (x) => x.name === 'Frostfire local wind-driven snow',
    ).visible = false;
    g.renderer.render = (scene) => {
      g.frostfire.update(camera, g.hero, 0, false, 1);
      original(scene, camera);
    };
  });
  await page.waitForTimeout(300);
  await page.addStyleTag({
    content:
      'body * {visibility:hidden!important} #frostfire-qa-canvas {visibility:visible!important}',
  });
  await page.screenshot({ path: out + '/overview.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  check('save reload works');
  await page.evaluate(() => window.__frostQA.changeRegion('ironveil-mines'));
  await page.waitForFunction(() => !window.__frostQA.transitioning && window.__frostQA.hero.currentField === 'ironveil-mines');
  await page.keyboard.press('m');
  const card = page.locator('.region-card').filter({
    has: page.getByRole('heading', {
      name: 'Frostfire Highlands',
      exact: true,
    }),
  });
  check('new map card exists', (await card.count()) === 1);
  check(
    'retired map card is removed',
    (await page
      .getByRole('heading', { name: 'Dataran Bara-Beku', exact: true })
      .count()) === 0,
  );
  await page.screenshot({ path: out + '/teleport-menu.png' });
  await card.getByRole('button', { name: 'Teleport field', exact: true }).click();
  await ready();
  check('M menu teleports into the new terrain and all 133 monsters', await page.evaluate(() => {
    const g = window.__frostQA;
    return g.isFrostfire && !g.terrain.visible && g.enemies.length === 133;
  }));
  if (await card.isVisible()) await page.keyboard.press('m');
  const resources = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const g = window.__frostQA;
      g.hero.level = 30;
      g.changeRegion('ironveil-mines');
    });
    await page.waitForFunction(
      () => {
        const g = window.__frostQA;
        return (
          !g.transitioning &&
          !g.frostfire &&
          g.hero.currentField === 'ironveil-mines'
        );
      },
      null,
      { timeout: 60000 },
    );
    check(
      `other map population preserved ${i + 1}`,
      await page.evaluate(() => window.__frostQA.enemies.length > 0),
    );
    check(
      `snow fog cleared on leaving Frostfire ${i + 1}`,
      await page.evaluate(() => !window.__frostQA.scene.fog?.isFogExp2),
    );
    await page.evaluate(() =>
      window.__frostQA.changeRegion('frostfire-highlands'),
    );
    await ready();
    await page.waitForTimeout(100);
    resources.push(
      await page.evaluate(() => ({ ...window.__frostQA.renderer.info.memory })),
    );
  }
  check(
    'resource counts stable after repeated travel',
    resources
      .slice(2)
      .every(
        (r) =>
          r.geometries <= resources[2].geometries + 2 &&
          r.textures <= resources[2].textures + 2,
      ),
  );
  check('no runtime or shader errors', errors.length === 0);
  // A blocked texture must reach the existing Retry UI, then recover cleanly.
  const expectedErrorsStart = errors.length;
  await page.route(
    '**/assets/maps/frostfire-highlands-v2/snow_02-diff.webp',
    (route) => route.abort(),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page
    .getByRole('button', { name: 'Retry', exact: true })
    .waitFor({ timeout: 60000 });
  check('initial asset failure exposes Retry');
  await page.unroute('**/assets/maps/frostfire-highlands-v2/snow_02-diff.webp');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await ready();
  check('Retry reloads complete environment');
  const expectedLoadErrors = errors.splice(expectedErrorsStart);
  await writeFile(
    out + '/report.json',
    JSON.stringify(
      {
        checks,
        errors,
        expectedLoadErrors,
        stormFog,
        dawn,
        snowCheck,
        performance,
        resources,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: out + '/failure.png' }).catch(() => {});
  await writeFile(
    out + '/failure.json',
    JSON.stringify({ checks, errors, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
