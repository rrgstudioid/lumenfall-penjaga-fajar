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
const out = `output/frostfire-highlands/seams-${process.env.FROST_SEAMS_PHASE || 'after'}`;
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
  inCity: false,
  currentCity: 'averion',
  currentField: FROSTFIRE_ID,
  ...FROSTFIRE_ENTRY,
});
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
  const geometry = await page.evaluate(async () => {
    const g = window.__frostQA,
      T = window.__frostThree;
    const layout = await import('/lib/game/frostfire-highlands-layout.ts');
    const ray = new T.Raycaster(),
      down = new T.Vector3(0, -1, 0);
    let samples = 0,
      maxError = 0,
      missing = 0;
    g.frostfire.surfaces.updateMatrixWorld(true);
    const areas = [
      { x: 200, z: -356, w: 124 }, // Former tall fall, now the northern ice basin.
      ...layout.FROSTFIRE_GLACIERS,
    ];
    for (const f of areas)
      for (let iz = 0; iz <= 10; iz++)
        for (let ix = 0; ix <= 10; ix++) {
          const x = f.x - f.w / 2 - 15 + (ix * (f.w + 30)) / 10;
          const z = f.z - 70 + iz * 10;
          ray.set(new T.Vector3(x, 500, z), down);
          const hit = ray.intersectObjects(
            g.frostfire.surfaces.children,
            false,
          )[0];
          if (!hit) missing++;
          else
            maxError = Math.max(
              maxError,
              Math.abs(hit.point.y - layout.frostHeight(x, z)),
            );
          samples++;
        }
    // Check duplicated boundary vertices across terrain chunks, including their
    // normals and material weights: matching height alone can hide a shading seam.
    const borders = new Map();
    let joins = 0,
      mismatches = 0;
    for (const mesh of g.frostfire.surfaces.children) {
      const p = mesh.geometry.attributes.position,
        n = mesh.geometry.attributes.normal;
      const mask = mesh.geometry.attributes.frostMask;
      for (let i = 0; i < p.count; i++) {
        if (i % 65 !== 0 && i % 65 !== 64 && i >= 65 && i < p.count - 65)
          continue;
        const key = `${p.getX(i)},${p.getZ(i)}`;
        const values = [
          p.getY(i),
          n.getX(i),
          n.getY(i),
          n.getZ(i),
          mask.getX(i),
          mask.getY(i),
          mask.getZ(i),
        ];
        const prior = borders.get(key);
        if (prior) {
          joins++;
          if (prior.some((v, j) => Math.abs(v - values[j]) > 0.00001))
            mismatches++;
        } else borders.set(key, values);
      }
    }
    return {
      samples,
      maxError,
      missing,
      joins,
      mismatches,
      detachedFalls: g.frostfire.root.children.filter(
        (o) => o.name === 'Sculpted frozen waterfall and glacier shelf',
      ).length,
    };
  });
  if (process.env.FROST_SEAMS_PHASE !== 'before') {
    check(
      'northern ice basin and remaining falls share the collision heightfield',
      geometry.samples === 363 &&
        geometry.missing === 0 &&
        geometry.maxError < 0.001 &&
        geometry.detachedFalls === 0,
    );
    check(
      'terrain chunk joins have identical heights, normals and material weights',
      geometry.joins > 0 && geometry.mismatches === 0,
    );
  }
  await page.evaluate(() => {
    const g = window.__frostQA,
      T = window.__frostThree;
    g.paused = true;
    const original = g.renderer.render.bind(g.renderer);
    window.__seamCamera = new T.PerspectiveCamera(48, 1440 / 900, 1, 2500);
    g.scene.fog = null;
    g.renderer.domElement.id = 'frostfire-qa-canvas';
    g.frostfire.root.children.find(
      (x) => x.name === 'Frostfire local wind-driven snow',
    ).visible = false;
    g.renderer.render = (scene) => {
      g.frostfire.update(window.__seamCamera, g.hero, 0, false, 1);
      original(scene, window.__seamCamera);
    };
  });
  await page.addStyleTag({
    content:
      'body * {visibility:hidden!important} #frostfire-qa-canvas {visibility:visible!important}',
  });
  for (const view of [
    { name: 'northern-front', eye: [265, 116, -170], target: [200, 77, -359] },
    { name: 'northern-side', eye: [350, 128, -360], target: [200, 78, -373] },
    { name: 'central-fall', eye: [95, 74, 110], target: [30, 28, -25] },
    { name: 'eastern-fall', eye: [425, 85, 98], target: [342, 38, -31] },
    { name: 'mountain-foot', eye: [-48, 89, 154], target: [-141, 40, 84] },
    { name: 'open-interior', eye: [170, 160, 370], target: [0, 25, 0] },
    { name: 'mountain-rim', eye: [250, 110, 270], target: [405, 70, 250] },
    { name: 'overview', eye: [80, 950, 940], target: [0, 25, 0] },
  ]) {
    await page.evaluate(({ eye, target }) => {
      const c = window.__seamCamera;
      c.position.set(...eye);
      c.lookAt(...target);
      c.updateMatrixWorld();
    }, view);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/${view.name}.png` });
    console.log('CAPTURE', view.name);
  }
  check('no runtime or shader errors', errors.length === 0);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors, geometry }, null, 2),
  );
} finally {
  await browser.close();
}
