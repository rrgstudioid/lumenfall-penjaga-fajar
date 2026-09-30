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
const out = 'output/frostfire-highlands/imported-props';
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
  await page.goto('http://localhost:3000', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await page
    .getByRole('button', { name: 'CONTINUE', exact: true })
    .click({ timeout: 60000 });
  await ready();
  await page.waitForTimeout(800);
  const report = await page.evaluate(async () => {
    const g = window.__frostQA,
      T = window.__frostThree;
    const layout = await import('/lib/game/frostfire-highlands-layout.ts');
    const batches = g.frostfire.root.children.filter(
      (o) => o.userData.frostAsset,
    );
    const matrices = new T.Matrix4(),
      p = new T.Vector3();
    const result = [];
    for (const batch of batches) {
      let maxBaseExposure = -Infinity;
      const attribute = batch.geometry.attributes.position;
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrices);
        for (let j = 0; j < attribute.count; j++) {
          if (attribute.getY(j) > batch.userData.frostAsset.bury) continue;
          p.fromBufferAttribute(attribute, j).applyMatrix4(matrices);
          maxBaseExposure = Math.max(
            maxBaseExposure,
            p.y - layout.frostHeight(p.x, p.z),
          );
        }
      }
      result.push({
        name: batch.name,
        count: batch.count,
        triangles: batch.geometry.index.count / 3,
        texture: batch.material.map.image.width,
        maxBaseExposure,
        ...batch.userData.frostAsset,
      });
    }
    window.__assetViews = [];
    for (const batch of batches) {
      let closest = Infinity,
        index = 0;
      for (let i = 0; i < batch.count; i++) {
        batch.getMatrixAt(i, matrices);
        p.setFromMatrixPosition(matrices);
        const distance = p.distanceTo(g.actor.position);
        if (distance < closest) {
          closest = distance;
          index = i;
        }
      }
      batch.getMatrixAt(index, matrices);
      p.setFromMatrixPosition(matrices);
      const scale = new T.Vector3().setFromMatrixScale(matrices).x;
      const h = batch.userData.frostAsset.height * scale;
      window.__assetViews.push({
        name: batch.userData.frostAsset.file,
        eye: [p.x + h * 1.05, p.y + h * 0.65, p.z + h * 1.6],
        target: [p.x, p.y + h * 0.45, p.z],
      });
      if (batch.userData.frostAsset.file.includes('pine'))
        window.__assetViews.push({
          name: 'pine-base',
          eye: [p.x + 3, p.y + 1.4, p.z + 4],
          target: [p.x, p.y + 0.45, p.z],
        });
    }
    window.__assetViews.push(
      { name: 'snowfield-spread', eye: [210, 135, 390], target: [90, 20, 150] },
      { name: 'distribution-overview', eye: [0, 980, 760], target: [0, 25, 0] },
    );
    g.paused = true;
    const original = g.renderer.render.bind(g.renderer);
    window.__assetCamera = new T.PerspectiveCamera(45, 1440 / 900, 0.1, 1600);
    g.frostfire.root.children.find(
      (o) => o.name === 'Frostfire local wind-driven snow',
    ).visible = false;
    g.renderer.domElement.id = 'asset-qa-canvas';
    g.renderer.render = (scene) => {
      g.frostfire.update(window.__assetCamera, g.hero, 0, false, 1);
      original(scene, window.__assetCamera);
    };
    return result;
  });
  check(
    'both supplied assets replace the old props',
    report.length === 2 &&
      report.every((r) => r.count > 0 && r.texture === 4096),
  );
  check(
    'pine ground pad is buried across all placements',
    report.find((r) => r.file.includes('pine')).maxBaseExposure < 0.025,
  );
  await page.addStyleTag({
    content:
      'body *{visibility:hidden!important} #asset-qa-canvas{visibility:visible!important}',
  });
  const views = await page.evaluate(() => window.__assetViews);
  for (const view of views) {
    await page.evaluate(({ eye, target, name }) => {
      if (name === 'distribution-overview') window.__frostQA.scene.fog = null;
      const c = window.__assetCamera;
      c.position.set(...eye);
      c.lookAt(...target);
      c.updateMatrixWorld();
    }, view);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${view.name}.png` });
  }
  check('no runtime or shader errors', errors.length === 0);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors, report }, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
