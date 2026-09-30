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
const out = 'output/fps-hud';
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
      !window.__frostQA?.regionLoadError &&
      !window.__frostQA?.transitioning,
    null,
    { timeout: 120000 },
  );
}
try {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  const fps = page.locator('[data-hud-id="fps"]');
  await page.waitForFunction(() =>
    /FPS: [1-9][0-9]*/.test(
      document.querySelector('.hud-fps-text')?.textContent || '',
    ),
  );
  const initial = await fps.boundingBox(),
    chat = await page.locator('[data-hud-id="chat"]').boundingBox();
  check(
    'FPS text starts above chat',
    initial.y + initial.height < chat.y && Math.abs(initial.x - chat.x) < 1,
  );
  check(
    'no decorative panel or resize controls',
    (await fps
      .locator('.hud-grip,.hud-frame-handle,.hud-resize-handle')
      .count()) === 0,
  );
  check(
    'text has transparent background',
    await fps
      .locator('button')
      .evaluate(
        (el) => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)',
      ),
  );
  await page.screenshot({ path: out + '/default.png' });
  const before = await page.evaluate(() => ({
    x: window.__frostQA.hero.x,
    z: window.__frostQA.hero.z,
    yaw: window.__frostQA.yaw,
  }));
  await page.mouse.move(
    initial.x + initial.width / 2,
    initial.y + initial.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    initial.x + initial.width / 2 + 260,
    initial.y + initial.height / 2 - 110,
    { steps: 14 },
  );
  await page.mouse.up();
  const moved = await fps.boundingBox();
  check(
    'drag text moves FPS',
    Math.abs(moved.x - initial.x - 260) < 3 &&
      Math.abs(moved.y - initial.y + 110) < 3,
  );
  check(
    'HUD dragging does not move or attack with the character',
    await page.evaluate((p) => {
      const g = window.__frostQA;
      return (
        g.hero.x === p.x && g.hero.z === p.z && g.yaw === p.yaw && !g.attacking
      );
    }, before),
  );
  const placement = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('lumenfall:hud-layout:v1')).positions.fps,
  );
  check('FPS placement saved', !!placement);
  await page.screenshot({ path: out + '/dragged.png' });
  // Every currently registered map, including cities and development previews.
  const mapIds = await page.evaluate(async () => {
    const { FIELDS, CITIES } = await import('/lib/game/regions.ts');
    return [...Object.keys(CITIES), ...Object.keys(FIELDS)];
  });
  for (const id of mapIds) {
    await page.evaluate((id) => {
      const g = window.__frostQA;
      g.hero.level = 50;
      g.changeRegion(id);
    }, id);
    await page.waitForFunction(
      (id) => {
        const g = window.__frostQA;
        return (
          !g.transitioning &&
          !g.regionLoadError &&
          (g.hero.inCity ? g.hero.currentCity : g.hero.currentField) === id
        );
      },
      id,
      { timeout: 120000 },
    );
    await page.waitForFunction(
      () =>
        /FPS: [1-9][0-9]*/.test(
          document.querySelector('.hud-fps-text')?.textContent || '',
        ),
      null,
      { timeout: 15000 },
    );
    check('live FPS on ' + id, await fps.isVisible());
    const current = await fps.boundingBox();
    check(
      'position retained on ' + id,
      Math.abs(current.x - moved.x) < 1 && Math.abs(current.y - moved.y) < 1,
    );
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await ready();
  await fps.waitFor({ state: 'visible' });
  const restored = await fps.boundingBox();
  check(
    'FPS position survives reload',
    Math.abs(restored.x - moved.x) < 1 && Math.abs(restored.y - moved.y) < 1,
  );
  await page.setViewportSize({ width: 760, height: 600 });
  await page.waitForTimeout(300);
  const small = await fps.boundingBox();
  check(
    'FPS stays within smaller viewport',
    small.x >= 0 &&
      small.y >= 0 &&
      small.x + small.width <= 761 &&
      small.y + small.height <= 601,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event('lumenfall:hud-reset')),
  );
  await page.waitForTimeout(300);
  const reset = await fps.boundingBox(),
    resetChat = await page.locator('[data-hud-id="chat"]').boundingBox();
  check(
    'Reset HUD restores FPS above chat',
    reset.y + reset.height < resetChat.y,
  );
  check('no runtime errors', errors.length === 0);
  await writeFile(
    out + '/report.json',
    JSON.stringify({ checks, errors, mapIds, placement }, null, 2),
  );
} finally {
  await browser.close();
}
