// Real Home + Game, disposable Chromium profile. Never uses the owner's browser saves.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createV3AdventurerHero,
  createItem,
  SAVE_KEY,
} from '../lib/game/rules.ts';
const runtime =
  process.env.CODEX_NODE_MODULES ||
  'C:/Users/GG/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { chromium } = await import(
  pathToFileURL(`${runtime}/playwright/index.mjs`).href
);
const origin = process.env.HUD_TEST_URL || 'http://localhost:3000/';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const out = resolve('output/hud-redesign');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage(),
  checks = [],
  errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const check = (name, condition = true) => {
  assert.ok(condition, name);
  checks.push(name);
  console.log(`PASS ${name}`);
};
await page.route(/\/lib\/game\/world\.ts/, async (route) => {
  const response = await route.fetch();
  const body = (await response.text()).replace(
    'this.renderer = new T.WebGLRenderer',
    'window.__hudQA = this; this.renderer = new T.WebGLRenderer',
  );
  await route.fulfill({ response, body });
});
const hero = createV3AdventurerHero('slot-1');
hero.characterId = 'hud-regression';
hero.characterName = 'Penjaga Fajar';
hero.gold = 5769;
hero.primaryHotbar[0] = 'v3-adventurer-quick-slash';
hero.inventory.push(
  createItem('health-potion-1', { quantity: 25 }),
  createItem('mana-potion-1', { quantity: 4 }),
);
hero.quickHotbars.q.assignment = 'health-potion-1';
hero.quickHotbars.e.assignment = 'mana-potion-1';
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
async function enterWorld() {
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.locator('.game-shell.in-world').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => window.__hudQA?.started);
}
async function scale(value) {
  await page.evaluate((value) => {
    document.documentElement.style.setProperty(
      '--lumenfall-ui-scale',
      String(value),
    );
    window.dispatchEvent(new Event('lumenfall:interface-scale'));
  }, value);
  await page.waitForTimeout(100);
}
async function bounds() {
  return page.locator('[data-hud-id]').evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        id: el.dataset.hudId,
        x: r.x,
        y: r.y,
        right: r.right,
        bottom: r.bottom,
      };
    }),
  );
}
try {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 120000 });
  await enterWorld();
  await page.waitForTimeout(2200);
  if (!process.argv.includes('--bindings-only')) {
    await page.screenshot({ path: resolve(out, '01-default-1920.png') });
    check(
      'No visible drag arrows, strips or instruction labels',
      (await page
        .locator('.hud-drag-handle,.hud-drag-hint,.hud-idle-grip')
        .count()) === 0,
    );
    check(
      'Chat history starts expanded beside the combat cluster',
      await page.locator('.hud-chat-history').isVisible(),
    );
    check(
      'No HUD or hotbar edit-mode controls exist',
      (await page
        .getByRole('button', {
          name: /Edit HUD|Edit Mode|Atur Hotbar|Unlock|Customize/,
        })
        .count()) === 0,
    );
    check(
      'Real runtime mounts one minimap and six HUD clusters',
      (await page.locator('.hud-minimap canvas').count()) === 1 &&
        (await page.locator('[data-hud-id]').count()) === 6,
    );
    check(
      'Gameplay branding removed',
      (await page.locator('.topbar,.journey-note').count()) === 0,
    );
    await page.evaluate(() => {
      window.__hudCanvas = document.querySelector('.hud-minimap canvas');
    });
    await page.keyboard.down('w');
    await page.keyboard.press('Enter');
    await page.keyboard.up('w');
    check(
      'Enter focuses chat and clears held movement',
      (await page
        .getByRole('textbox', { name: 'Pesan chat' })
        .evaluate((el) => document.activeElement === el)) &&
        (await page.evaluate(
          () => window.__hudQA.keys.size === 0 && !window.__hudQA.paused,
        )),
    );
    await page.keyboard.type('wasd 1234567890 qe f ijkm');
    await page.keyboard.press('Enter');
    const chatInput = page.getByRole('textbox', { name: 'Pesan chat' });
    const worldMessages = page.locator('.hud-chat-message.channel-world');
    const speech = page.locator('.player-speech-bubble');
    check(
      'Offline Enter sends actual player text to Dunia and clears the draft',
      (await chatInput.inputValue()) === '' &&
        (await worldMessages.count()) === 1 &&
        (await worldMessages.first().textContent()).includes(
          '[Dunia] [Lokal] Penjaga Fajar: wasd 1234567890 qe f ijkm',
        ),
    );
    check(
      'The same local text appears above the world character',
      (await speech.isVisible()) &&
        (await speech.textContent()) === 'wasd 1234567890 qe f ijkm',
    );
    check(
      'Successful Enter returns to idle with gameplay input unlocked',
      (await chatInput.evaluate((el) => document.activeElement !== el)) &&
        (await page.evaluate(
          () =>
            !window.__hudQA.uiInputBlockers.blocked && !window.__hudQA.paused,
        )),
    );
    await page.keyboard.down('w');
    check(
      'Movement works immediately after sending without Escape',
      await page.evaluate(() => window.__hudQA.keys.has('w')),
    );
    await page.keyboard.up('w');
    await page.keyboard.press('Enter');
    check(
      'A fresh Enter reopens chat after sending',
      await chatInput.evaluate((el) => document.activeElement === el),
    );
    await page.keyboard.press('Enter');
    check('Second Enter with an empty draft returns to idle without sending',
      await chatInput.evaluate(el => document.activeElement !== el) &&
      await page.evaluate(() => !window.__hudQA.uiInputBlockers.blocked && !window.__hudQA.paused) &&
      await worldMessages.count() === 1);
    await page.keyboard.down('w');
    check('Movement resumes immediately after dismissing empty chat',
      await page.evaluate(() => window.__hudQA.keys.has('w')));
    await page.keyboard.up('w');
    await page.keyboard.press('Enter');
    await chatInput.fill('   ');
    await page.keyboard.press('Enter');
    check(
      'Empty or whitespace chat does not create a message',
      (await worldMessages.count()) === 1 &&
        await chatInput.evaluate(el => document.activeElement !== el),
    );
    await chatInput.fill('Halo dunia 👋 <b>teks biasa</b>');
    await chatInput.dispatchEvent('compositionstart');
    await page.keyboard.press('Enter');
    await chatInput.dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      isComposing: true,
    });
    check(
      'IME Enter retains draft without sending',
      (await worldMessages.count()) === 1 &&
        (await chatInput.inputValue()).includes('Halo dunia'),
    );
    await chatInput.dispatchEvent('compositionend');
    await chatInput.dispatchEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      repeat: true,
    });
    check(
      'Holding Enter does not repeat chat delivery',
      (await worldMessages.count()) === 1,
    );
    await page.getByRole('button', { name: /Kirim pesan/ }).click();
    check(
      'Send button handles Unicode and renders markup as literal text in log and bubble',
      (await worldMessages.count()) === 2 &&
        (await speech.textContent()) === 'Halo dunia 👋 <b>teks biasa</b>' &&
        (await page
          .locator('.player-speech-bubble b,.hud-chat-message b')
          .count()) === 0 &&
        (await speech.count()) === 1,
    );
    await page.screenshot({ path: resolve(out, 'chat-local-world.png') });
    await page.getByRole('tab', { name: 'Party', exact: true }).click();
    await chatInput.fill('Pesan Dunia dari tab filter');
    await chatInput.press('Enter');
    check(
      'Composer explicitly sends to Dunia even when another history filter is selected',
      (await page
        .getByRole('tab', { name: 'Dunia', exact: true })
        .getAttribute('aria-selected')) === 'true' &&
        (await worldMessages.count()) === 3 &&
        (await speech.textContent()) === 'Pesan Dunia dari tab filter',
    );
    await page.getByRole('tab', { name: 'Semua', exact: true }).click();
    await chatInput.focus();
    await page.evaluate(() => {
      window.__hudQA.transitioning = true;
    });
    await chatInput.fill('Draft ketika dunia belum siap');
    await chatInput.press('Enter');
    check(
      'An unavailable world preserves the draft without falsely logging delivery',
      (await chatInput.inputValue()) === 'Draft ketika dunia belum siap' &&
        (await worldMessages.count()) === 3 &&
        (await page.locator('.hud-chat-offline').textContent()).includes(
          'belum siap',
        ),
    );
    await page.evaluate(() => {
      window.__hudQA.transitioning = false;
    });
    await chatInput.fill('Balon mengikuti karakter');
    await chatInput.press('Enter');
    const bubbleBeforeMove = await speech.boundingBox();
    await page.keyboard.down('d');
    await page.waitForTimeout(550);
    await page.keyboard.up('d');
    const bubbleAfterMove = await speech.boundingBox();
    check(
      'Speech bubble follows the character while gameplay moves',
      bubbleBeforeMove &&
        bubbleAfterMove &&
        Math.hypot(
          bubbleAfterMove.x - bubbleBeforeMove.x,
          bubbleAfterMove.y - bubbleBeforeMove.y,
        ) > 1,
    );
    await page.waitForFunction(
      () => !document.querySelector('.player-speech-bubble'),
      null,
      { timeout: 10000 },
    );
    check(
      'Speech expires after six seconds while its message remains in session history',
      (await worldMessages.count()) === 4 &&
        (await worldMessages.last().textContent()).includes(
          'Balon mengikuti karakter',
        ),
    );
    await page.keyboard.press('Enter');
    check(
      'Typing does not open menus or run actions',
      (await page.locator('[role="dialog"]').count()) === 0 &&
        (await page.evaluate(
          () => window.__hudQA.keys.size === 0 && !window.__hudQA.blocking,
        )),
    );
    await page.keyboard.press('Escape');
    check(
      'Escape releases chat without opening pause',
      await page.evaluate(
        () => !window.__hudQA.uiInputBlockers.blocked && !window.__hudQA.paused,
      ),
    );
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'w',
          code: 'KeyW',
          repeat: true,
          bubbles: true,
        }),
      ),
    );
    check(
      'Stale held-key repeat cannot resume movement after typing',
      await page.evaluate(() => !window.__hudQA.keys.has('w')),
    );
    await page.keyboard.down('w');
    check(
      'Gameplay keyboard resumes',
      await page.evaluate(() => window.__hudQA.keys.has('w')),
    );
    await page.keyboard.up('w');
    for (const id of ['player', 'quest', 'right', 'chat', 'hotbar']) {
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const frame = page.locator(`[data-hud-id="${id}"]`);
        const before = await frame.boundingBox();
        const handle = frame.locator(
          `.hud-resize-handle[data-corner="${corner}"]`,
        );
        const box = await handle.boundingBox();
        check(
          `${id} ${corner}: diagonal resize cursor`,
          (await handle.evaluate((el) => getComputedStyle(el).cursor)) ===
            (corner === 'nw' || corner === 'se'
              ? 'nwse-resize'
              : 'nesw-resize'),
        );
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x +
            box.width / 2 +
            (corner.includes('w') ? 1 : -1) * before.width * 0.1,
          box.y +
            box.height / 2 +
            (corner.includes('n') ? 1 : -1) * before.height * 0.1,
          { steps: 8 },
        );
        await page.mouse.up();
        const after = await frame.boundingBox();
        check(
          `${id} ${corner}: corner resizes and stays put on release`,
          after.width < before.width - 5 &&
            after.height < before.height - 2 &&
            Math.abs(
              after.x +
                (corner.includes('w') ? after.width : 0) -
                before.x -
                (corner.includes('w') ? before.width : 0),
            ) < 2 &&
            Math.abs(
              after.y +
                (corner.includes('n') ? after.height : 0) -
                before.y -
                (corner.includes('n') ? before.height : 0),
            ) < 2,
        );
        if (id === 'player' && corner === 'se') {
          await page.reload();
          await enterWorld();
          // Reload starts a new engine lifecycle; identity checks below use its canvas.
          await page.evaluate(() => { window.__hudCanvas = document.querySelector('.hud-minimap canvas'); });
          check(
            'Individual HUD size survives reload',
            Math.abs((await frame.boundingBox()).width - after.width) < 2,
          );
        }
        await page
          .getByRole('button', { name: 'Reset HUD', exact: true })
          .click();
      }
    }
    const resizeFrame = page.locator('[data-hud-id="player"]');
    const originalSize = await resizeFrame.boundingBox();
    const resizeCorner = await resizeFrame
      .locator('[data-corner="se"]')
      .boundingBox();
    await page.mouse.move(resizeCorner.x + 8, resizeCorner.y + 8);
    await page.mouse.down();
    await page.mouse.move(resizeCorner.x - 45, resizeCorner.y - 20, {
      steps: 6,
    });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    check(
      'Escape cancels resize and releases gameplay input',
      Math.abs((await resizeFrame.boundingBox()).width - originalSize.width) <
        1 &&
        (await page.evaluate(
          () =>
            !window.__hudQA.uiInputBlockers.blocked &&
            !document.body.hasAttribute('data-hud-resizing'),
        )),
    );

    for (const id of ['player', 'quest', 'right', 'chat', 'hotbar']) {
      const frame = page.locator(`[data-hud-id="${id}"]`);
      const before = await frame.boundingBox();
      const grip = await frame.locator('.hud-grip').boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      const dx = id === 'right' ? -90 : 90;
      const dy = id === 'chat' || id === 'hotbar' ? -60 : 60;
      await page.mouse.move(
        grip.x + grip.width / 2 + dx,
        grip.y + grip.height / 2 + dy,
        { steps: 12 },
      );
      await page.mouse.up();
      const after = await frame.boundingBox();
      check(
        `${id}: direct grip moves without a mode`,
        Math.abs(after.x - before.x - dx) < 2 &&
          Math.abs(after.y - before.y - dy) < 2,
      );
      await page
        .getByRole('button', { name: 'Reset HUD', exact: true })
        .click();
      check(
        `${id}: drag releases gameplay input immediately`,
        (await page.locator('.hud-drag-surface').count()) === 0 &&
          (await page.evaluate(() => !window.__hudQA.uiInputBlockers.blocked)),
      );
    }

    for (const id of ['player', 'quest', 'right', 'hotbar']) {
      const frame = page.locator(`[data-hud-id="${id}"]`);
      const before = await frame.boundingBox();
      const header = await frame.locator('.hud-frame-handle').boundingBox();
      const x = header.x + header.width / 2,
        y = header.y + header.height / 2;
      const dx = id === 'right' || id === 'buff' ? -85 : 85;
      const dy = id === 'hotbar' || id === 'buff' ? -65 : 65;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 12 });
      await page.mouse.up();
      const after = await frame.boundingBox();
      check(
        `${id}: dragging frame/header moves the entire cluster`,
        Math.abs(after.x - before.x - dx) < 2 &&
          Math.abs(after.y - before.y - dy) < 2,
      );
      await page
        .getByRole('button', { name: 'Reset HUD', exact: true })
        .click();
    }
    await page.screenshot({ path: resolve(out, 'direct-hud.png') });
    const handle = page.getByRole('button', {
      name: 'Geser Status karakter',
      exact: true,
    });
    const before = await page.locator('[data-hud-id="player"]').boundingBox(),
      h = await handle.boundingBox();
    await page.mouse.move(h.x + 20, h.y + 10);
    await page.mouse.down();
    await page.mouse.move(h.x + 190, h.y + 130, { steps: 10 });
    await page.mouse.up();
    const after = await page.locator('[data-hud-id="player"]').boundingBox();
    check(
      'Drag commits normalized layout',
      after.x > before.x + 100 &&
        (await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('lumenfall:hud-layout:v1'))
              .positions.player.anchor === 'top-left',
        )),
    );
    await page.getByRole('button', { name: 'Reset HUD', exact: true }).click();
    check(
      'Reset restores default',
      Math.abs(
        (await page.locator('[data-hud-id="player"]').boundingBox()).x - 34,
      ) < 1,
    );
    const resize = await page
      .getByRole('button', { name: 'Ubah ukuran chat', exact: true })
      .boundingBox();
    await page.mouse.move(resize.x + 8, resize.y + 8);
    await page.mouse.down();
    await page.mouse.move(resize.x + 100, resize.y + 40, { steps: 8 });
    await page.mouse.up();
    check(
      'Chat resize persists separately',
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('lumenfall:hud-layout:v1')).chatSize
            .width > 460,
      ),
    );
    await page.getByRole('button', { name: 'Reset HUD', exact: true }).click();
    for (const cancelEvent of [
      'blur',
      'pointercancel',
      'resize',
      'lumenfall:interface-scale',
    ]) {
      const frame = page.locator('[data-hud-id="player"]');
      const start = await frame.boundingBox();
      const grip = await frame.locator('.hud-grip').boundingBox();
      await page.mouse.move(grip.x + 20, grip.y + 15);
      await page.mouse.down();
      await page.mouse.move(grip.x + 100, grip.y + 75, { steps: 5 });
      await page.evaluate((name) => {
        window.dispatchEvent(
          name === 'pointercancel'
            ? new PointerEvent(name, { pointerId: 1 })
            : new Event(name),
        );
      }, cancelEvent);
      await page.mouse.up();
      const end = await frame.boundingBox();
      check(
        `${cancelEvent} cancels drag without stale gesture or saved movement`,
        Math.abs(end.x - start.x) < 1 &&
          Math.abs(end.y - start.y) < 1 &&
          !(await page
            .locator('body')
            .evaluate((el) => el.hasAttribute('data-hud-dragging'))),
      );
      if (cancelEvent === 'blur') {
        // Game's existing blur policy opens pause.
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
      }
    }
    check(
      'HUD gestures release input cleanly',
      (await page.locator('[data-hud-edit]').count()) === 0 &&
        (await page.evaluate(() => !window.__hudQA.uiInputBlockers.blocked)),
    );
    // Exercise every handle repeatedly with visual (scaled) pointer coordinates.
    for (const value of [0.8, 1.2]) {
      await scale(value);
      for (const id of ['player', 'quest', 'right', 'chat', 'hotbar']) {
        await page
          .getByRole('button', { name: 'Reset HUD', exact: true })
          .click();
        const frame = page.locator(`[data-hud-id="${id}"]`);
        for (const direction of [1, -1]) {
          const origin = await frame.boundingBox();
          const grip = await frame.locator('.hud-grip').boundingBox();
          const dx = (id === 'right' || id === 'buff' ? -40 : 40) * direction;
          const dy =
            (id === 'chat' || id === 'hotbar' || id === 'buff' ? -35 : 35) *
            direction;
          await page.mouse.move(grip.x + 15, grip.y + 15);
          await page.mouse.down();
          await page.mouse.move(grip.x + 15 + dx, grip.y + 15 + dy, {
            steps: 6,
          });
          await page.waitForTimeout(80);
          const held = await frame.boundingBox();
          await page.mouse.up();
          await page.waitForTimeout(100);
          const released = await frame.boundingBox();
          check(
            `${id} scale ${value} drag ${direction}: tracks pointer without release jump`,
            Math.abs(held.x - origin.x - dx) < 2 &&
              Math.abs(held.y - origin.y - dy) < 2 &&
              Math.abs(held.x - released.x) < 2 &&
              Math.abs(held.y - released.y) < 2,
          );
        }
      }
      await page
        .getByRole('button', { name: 'Reset HUD', exact: true })
        .click();
    }
    for (const [width, height] of [
      [1672, 941],
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
      [3440, 1440],
    ]) {
      await page.setViewportSize({ width, height });
      for (const value of [0.5, 0.8, 1, 1.2, 1.5]) {
        await scale(value);
        const rects = await bounds();
        check(
          `${width}x${height} scale ${value}: all clusters visible`,
          rects.every(
            (r) =>
              r.x >= -1 &&
              r.y >= -1 &&
              r.right <= width + 1 &&
              r.bottom <= height + 1,
          ),
        );
        if (value === 1)
          await page.screenshot({
            path: resolve(out, `layout-${width}x${height}.png`),
          });
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await scale(1);
    check(
      'Minimap DOM identity survives all layout changes',
      await page.evaluate(
        () =>
          document.querySelector('.hud-minimap canvas') ===
            window.__hudCanvas && window.__hudQA.minimap === window.__hudCanvas,
      ),
    );
    await page
      .getByRole('button', { name: /Kamera (Free|Follow) aktif/ })
      .click();
    check(
      'Camera utility still changes real mode',
      await page.evaluate(() => window.__hudQA.cameraMode === 'free'),
    );
    await page.keyboard.press('i');
    await page.locator('[role="dialog"]').waitFor();
    check(
      'Inventory opens with binding hotbar above its overlay',
      (await page.locator('.hud-binding-layer').count()) === 1,
    );
    await page.keyboard.press('Escape');
    // UI binding still delegates to the real atomic drop implementation.
  }
  const slot = (index) => page.locator(`[data-primary-slot="${index}"]`);
  async function dragBetween(from, to) {
    const a = await from.boundingBox(),
      b = await to.boundingBox();
    await page.evaluate(
      ({ a, b }) => {
        window.__hudDragDebug = {
          source: document
            .elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)
            ?.outerHTML.slice(0, 800),
          target: document
            .elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)
            ?.outerHTML.slice(0, 800),
          paused: window.__hudQA.paused,
          bindings: [...window.__hudQA.hero.primaryHotbar],
        };
      },
      { a, b },
    );
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  const bindingsInventory = await page.evaluate(() =>
    JSON.stringify(window.__hudQA.hero.inventory),
  );
  await slot(9).click();
  await page.locator('.primary-entry-list').waitFor();
  check(
    'Empty plus opens the skill/item picker without an edit mode',
    await page.locator('.primary-entry-list').isVisible(),
  );
  await page.locator('[data-picker-entry="mana-potion-1"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  check(
    'One picker selection assigns immediately and closes the picker',
    (await page.evaluate(() => window.__hudQA.hero.primaryHotbar[9])) ===
      'mana-potion-1' && (await page.locator('[role="dialog"]').count()) === 0,
  );
  await dragBetween(slot(9), slot(8));
  check(
    'Direct binding drag moves into an empty slot',
    await page.evaluate(
      () =>
        window.__hudQA.hero.primaryHotbar[9] === null &&
        window.__hudQA.hero.primaryHotbar[8] === 'mana-potion-1',
    ),
  );
  await dragBetween(slot(0), slot(8));
  check(
    'Occupied destinations swap both bindings safely',
    await page.evaluate(
      () =>
        window.__hudQA.hero.primaryHotbar[0] === 'mana-potion-1' &&
        window.__hudQA.hero.primaryHotbar[8] === 'v3-adventurer-quick-slash',
    ),
  );
  await dragBetween(slot(8), slot(0));
  await slot(8).click({ button: 'right' });
  check(
    'Right click removes only the shortcut and restores plus',
    (await page.evaluate(
      () => window.__hudQA.hero.primaryHotbar[8] === null,
    )) &&
      (await slot(8).locator('svg.lucide-plus').isVisible()) &&
      (await page.evaluate(() =>
        JSON.stringify(window.__hudQA.hero.inventory),
      )) === bindingsInventory,
  );
  await page.locator('[data-quick-slot="q"]').click({ button: 'right' });
  check(
    'Quick Q right click removes its binding',
    await page.evaluate(
      () => window.__hudQA.hero.quickHotbars.q.assignment === null,
    ),
  );
  await page.locator('[data-quick-slot="q"]').click();
  await page.locator('[data-picker-entry="health-potion-1"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  await page.locator('[data-quick-slot="e"]').click();
  await page.locator('[data-picker-entry="mana-potion-1"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  check(
    'Q and E plus pickers assign directly using existing quick-slot validation',
    await page.evaluate(
      () =>
        window.__hudQA.hero.quickHotbars.q.assignment === 'health-potion-1' &&
        window.__hudQA.hero.quickHotbars.e.assignment === 'mana-potion-1',
    ),
  );
  await slot(4).click();
  await page.locator('[data-picker-entry="rest"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  await page.keyboard.press('k');
  const skillSource = page.locator(
    '[data-skill-id="v3-adventurer-quick-slash"]',
  );
  await skillSource.waitFor();
  await dragBetween(skillSource, slot(4));
  check(
    'Learned skill drags from Job Skill and replaces an occupied hotbar slot',
    await page.evaluate(
      () =>
        window.__hudQA.hero.primaryHotbar[4] === 'v3-adventurer-quick-slash',
    ),
  );
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden' });
  await dragBetween(slot(4), slot(0));
  check(
    'Moving back after Job Skill closes preserves both swapped assignments',
    await page.evaluate(
      () =>
        window.__hudQA.hero.primaryHotbar[0] === 'v3-adventurer-quick-slash' &&
        window.__hudQA.hero.primaryHotbar[4] === 'rest',
    ),
  );
  check(
    'Binding gestures never consume an item or cast on release',
    (await page.evaluate(() =>
      JSON.stringify(window.__hudQA.hero.inventory),
    )) === bindingsInventory &&
      (await page.evaluate(() => window.__hudQA.hotbarUseSequence)) === 0,
  );
  const inventoryBefore = await page.evaluate(() =>
    JSON.stringify(window.__hudQA.hero.inventory),
  );
  const clickSequence = await page.evaluate(
    () => window.__hudQA.hotbarUseSequence,
  );
  const rest = await slot(4).boundingBox();
  await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rest.x + rest.width / 2 + 2,
    rest.y + rest.height / 2 + 1,
  );
  await page.mouse.up();
  check(
    'Small pointer movement remains a normal action click, never an accidental binding drag',
    await page.evaluate(
      (sequence) =>
        window.__hudQA.hotbarUseSequence === sequence + 1 &&
        window.__hudQA.hero.primaryHotbar[4] === 'rest',
      clickSequence,
    ),
  );
  const q = await page.locator('[data-quick-slot="q"]').boundingBox(),
    destination = await page.locator('[data-primary-slot="2"]').boundingBox();
  await page.mouse.move(q.x + 30, q.y + 30);
  await page.mouse.down();
  await page.mouse.move(destination.x + 30, destination.y + 30, { steps: 15 });
  await page.mouse.up();
  check(
    'Binding drag moves Q reference into primary without changing inventory',
    (await page.evaluate(
      () =>
        window.__hudQA.hero.primaryHotbar[2] === 'health-potion-1' &&
        window.__hudQA.hero.quickHotbars.q.assignment === null,
    )) &&
      (await page.evaluate(() =>
        JSON.stringify(window.__hudQA.hero.inventory),
      )) === inventoryBefore,
  );
  await page.evaluate(() => {
    window.__hudQA.hero.hp = Math.max(1, window.__hudQA.hero.hp - 50);
    window.__hudQA.emit();
  });
  const potionsBefore = await page.evaluate(() =>
    window.__hudQA.hero.inventory
      .filter((i) => i.templateId === 'health-potion-1')
      .reduce((n, i) => n + i.quantity, 0),
  );
  await page.keyboard.press('3');
  check(
    'Number hotkey consumes one real potion and presents cooldown',
    (await page.evaluate(() =>
      window.__hudQA.hero.inventory
        .filter((i) => i.templateId === 'health-potion-1')
        .reduce((n, i) => n + i.quantity, 0),
    )) ===
      potionsBefore - 1 &&
      (await page
        .locator('[data-primary-slot="2"] .primary-cooldown')
        .count()) === 1,
  );
  const muteBefore = await page.evaluate(
    () => window.__hudQA.bgm.settings.muted,
  );
  await page
    .getByRole('button', { name: /^(Aktifkan suara|Matikan suara)$/ })
    .click();
  check(
    'Volume utility delegates to existing audio settings',
    (await page.evaluate(() => window.__hudQA.bgm.settings.muted)) !==
      muteBefore,
  );
  await page
    .getByRole('button', { name: 'Aktifkan fullscreen', exact: true })
    .click();
  check(
    'Fullscreen utility enters browser fullscreen',
    await page.evaluate(() => !!document.fullscreenElement),
  );
  await page
    .getByRole('button', { name: 'Keluar dari fullscreen', exact: true })
    .click();
  // Real local notices populate history; no remote player fixture or transport.
  for (let i = 0; i < 35; i++) {
    await page.evaluate((i) => window.__hudQA.message(`Audit System ${i}`), i);
    await page.waitForTimeout(25);
  }
  await page.locator('.hud-chat-history').evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  const scrollBefore = await page
    .locator('.hud-chat-history')
    .evaluate((el) => el.scrollTop);
  await page.evaluate(() =>
    window.__hudQA.message('Audit unread after scroll'),
  );
  await page.getByRole('button', { name: /pesan baru/ }).waitFor();
  check(
    'Reading older messages does not force scroll',
    (await page.locator('.hud-chat-history').evaluate((el) => el.scrollTop)) ===
      scrollBefore,
  );
  await page.getByRole('button', { name: /pesan baru/ }).click();
  check(
    'Unread action returns to bottom',
    await page
      .locator('.hud-chat-history')
      .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight <= 24),
  );
  await page.getByRole('tab', { name: 'Dunia', exact: true }).click();
  await page.evaluate(() =>
    window.__hudQA.message('System while Dunia selected'),
  );
  await page.waitForTimeout(100);
  check(
    'Inactive channel exposes unread badge',
    (await page.locator('#chat-tab-system small').count()) === 1,
  );
  await page.getByRole('tab', { name: /System/ }).click();
  check(
    'Reading System clears only its unread indicator',
    (await page.locator('#chat-tab-system small').count()) === 0,
  );
  // Cancellation must preserve the last committed rectangle.
  const cancelBefore = await page
      .locator('[data-hud-id="right"]')
      .boundingBox(),
    cancelHandle = await page
      .getByRole('button', { name: 'Geser Minimap', exact: true })
      .boundingBox();
  await page.mouse.move(cancelHandle.x + 20, cancelHandle.y + 10);
  await page.mouse.down();
  await page.mouse.move(cancelHandle.x - 120, cancelHandle.y + 100, {
    steps: 8,
  });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  check(
    'Escape cancels panel movement without opening pause',
    Math.abs(
      (await page.locator('[data-hud-id="right"]').boundingBox()).x -
        cancelBefore.x,
    ) < 1 && (await page.locator('.hud-grip').count()) === 6,
  );
  const persistHandle = await page
    .getByRole('button', { name: 'Geser Status karakter', exact: true })
    .boundingBox();
  await page.mouse.move(persistHandle.x + 20, persistHandle.y + 10);
  await page.mouse.down();
  await page.mouse.move(persistHandle.x + 150, persistHandle.y + 100, {
    steps: 8,
  });
  await page.mouse.up();
  const persistedPosition = await page
    .locator('[data-hud-id="player"]')
    .boundingBox();
  await page.keyboard.press('Escape');
  const savedIdentity = await page.evaluate(() => ({
    gold: window.__hudQA.hero.gold,
    bindings: window.__hudQA.hero.primaryHotbar,
    quick: window.__hudQA.hero.quickHotbars,
  }));
  await page.reload({ waitUntil: 'networkidle' });
  await enterWorld();
  check(
    'Reload restores the direct-drag layout',
    Math.abs(
      (await page.locator('[data-hud-id="player"]').boundingBox()).x -
        persistedPosition.x,
    ) < 1 && (await page.locator('[data-hud-edit]').count()) === 0,
  );
  check(
    'Reload preserves gameplay save and bindings',
    JSON.stringify(
      await page.evaluate(() => ({
        gold: window.__hudQA.hero.gold,
        bindings: window.__hudQA.hero.primaryHotbar,
        quick: window.__hudQA.hero.quickHotbars,
      })),
    ) === JSON.stringify(savedIdentity),
  );
  await page.evaluate(() => {
    window.__hudQA.changeRegion('verdant-plains');
    window.__hudQA.invincible = 600;
  });
  await page.waitForFunction(
    () =>
      !window.__hudQA.transitioning &&
      !window.__hudQA.hero.inCity &&
      window.__hudQA.enemies.length > 0,
  );
  await page.locator('.game-shell.in-world').waitFor();
  const castBefore = await page.evaluate(() => {
    const g = window.__hudQA,
      e = g.enemies.find((e) => e.hp > 0 && !e.boss);
    g.hero.x = e.group.position.x;
    g.hero.z = e.group.position.z + 1;
    g.placeActor();
    g.setCurrentTarget(e);
    g.attackTimer = 0;
    window.__hudEnemy = e;
    return { hp: e.hp, sequence: g.hotbarUseSequence };
  });
  await page.keyboard.press('1');
  await page.waitForTimeout(800);
  check(
    'Skill hotkey damages a real selected enemy after map transition',
    (await page.evaluate(() => window.__hudEnemy.hp)) < castBefore.hp &&
      (await page.evaluate(() => window.__hudQA.hotbarUseSequence)) >
        castBefore.sequence,
  );
  check(
    'Minimap stays owned by engine across map loading',
    await page.evaluate(
      () =>
        window.__hudQA.minimap ===
        document.querySelector('.hud-minimap canvas'),
    ),
  );
  await page.screenshot({ path: resolve(out, 'combat-field.png') });
  await page.evaluate(() => {
    const g = window.__hudQA;
    g.hero.activeBuffs['v2-warrior-battle-cry'] = 30;
    g.hero.activeBuffs['v2-warrior-battle-focus'] = 30;
    g.hero.activeBuffs['v2-warrior-unbroken-stance'] = 30;
    g.hero.activeBuffs['v2-warrior-awakening'] = 30;
    g.hero.activeBuffs['v2-thief-instinct'] = 30;
    g.emit();
  });
  await page.locator('.hud-buff').first().waitFor();
  check(
    'Multiple existing buff indicators wrap in bottom-right tray',
    (await page.locator('.hud-buff').count()) >= 5,
  );
  await page.screenshot({ path: resolve(out, 'buff-tray.png') });
  const checkBuffBounds = async (label) =>
    check(
      label,
      await page.locator('.hud-buffs').evaluate((el) => {
        const frame = el.parentElement.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          style.overflowX === 'visible' &&
          style.overflowY === 'visible' &&
          Array.from(el.children).every((card) => {
            const box = card.getBoundingClientRect();
            const icon = card
              .querySelector('.hud-buff-icon')
              .getBoundingClientRect();
            const title = card
              .querySelector('.hud-buff-name')
              .getBoundingClientRect();
            return (
              box.left >= frame.left - 1 &&
              box.right <= frame.right + 1 &&
              box.top >= frame.top - 1 &&
              box.bottom <= frame.bottom + 1 &&
              title.bottom <= icon.top + 1 &&
              icon.bottom < box.bottom
            );
          })
        );
      }),
    );
  await checkBuffBounds(
    'Multiple buffs fit their tray with readable icons and no scroll container',
  );
  // A real Tempo indicator from the disposable Blade Master fixture, not an empty tray.
  await page.evaluate(() => {
    const g = window.__hudQA;
    g.hero.specialization = 'blade_master';
    g.hero.skillProgressionV3.skillRanks['v3-blade-master-twin-blade-mastery'] =
      1;
    g.hero.activeBuffs = {};
    g.emit();
  });
  await page.locator('.hud-buff').filter({ hasText: 'TEMPO' }).waitFor();
  await checkBuffBounds('Single Tempo has no scrollbar or clipped icon');
  check(
    'Tempo has a dedicated emblem and three unfilled stack segments',
    (await page.locator('.hud-tempo-emblem').count()) === 1 &&
      (await page.locator('.hud-buff-pips i').count()) === 3 &&
      (await page.locator('.hud-buff-pips i[data-filled="true"]').count()) ===
        0,
  );
  const tempoFrame = page.locator('[data-hud-id="buff"]');
  const tempoSize = await tempoFrame.boundingBox();
  const buffCorner = await tempoFrame
    .locator('[data-corner="nw"]')
    .boundingBox();
  await page.mouse.move(buffCorner.x + 8, buffCorner.y + 8);
  await page.mouse.down();
  await page.mouse.move(buffCorner.x - 30, buffCorner.y - 15, { steps: 8 });
  await page.mouse.up();
  check(
    'Live Tempo icon and card resize proportionally without scroll',
    (await tempoFrame.boundingBox()).width > tempoSize.width + 10,
  );
  await checkBuffBounds('Resized Tempo stays inside its tray');
  await page.getByRole('button', { name: 'Reset HUD', exact: true }).click();
  const tempoBefore = await tempoFrame.boundingBox();
  const tempoGrip = await tempoFrame.locator('.hud-grip').boundingBox();
  await page.mouse.move(tempoGrip.x + 10, tempoGrip.y + 10);
  await page.mouse.down();
  await page.mouse.move(tempoGrip.x - 110, tempoGrip.y - 70, { steps: 12 });
  await page.mouse.up();
  const tempoAfter = await tempoFrame.boundingBox();
  check(
    'Live Tempo card can be dragged directly',
    Math.abs(tempoBefore.x - tempoAfter.x - 120) < 2 &&
      Math.abs(tempoBefore.y - tempoAfter.y - 80) < 2,
  );
  check(
    'Tempo position survives subsequent engine snapshots',
    (await tempoFrame.locator('.hud-drag-surface').count()) === 0 &&
      Math.abs((await tempoFrame.boundingBox()).x - tempoAfter.x) < 2,
  );
  await page.screenshot({ path: resolve(out, 'tempo-dragged.png') });
  await page.getByRole('button', { name: 'Reset HUD', exact: true }).click();
  await page.setViewportSize({ width: 1672, height: 941 });
  await scale(1);
  // Isolated visual fixture: stress the currency width and use real Blade Master artwork.
  await page.evaluate(() => {
    const g = window.__hudQA;
    g.hero.gold = 999975572;
    g.hero.coreJob = 'warrior';
    g.hero.level = 76;
    g.hero.skillProgressionV3.skillRanks['v3-blade-master-twin-assault'] = 8;
    g.hero.skillProgressionV3.skillRanks['v3-blade-master-blade-rush'] = 5;
    g.hero.skillLevels['v3-blade-master-twin-assault'] = 8;
    g.hero.skillLevels['v3-blade-master-blade-rush'] = 5;
    g.hero.primaryHotbar = Array(10).fill(null);
    g.hero.primaryHotbar[0] = 'v3-blade-master-twin-assault';
    g.hero.primaryHotbar[1] = 'v3-blade-master-blade-rush';
    g.hero.quickHotbars.q.assignment = 'mana-potion-1';
    g.hero.quickHotbars.e.assignment = 'health-potion-1';
    g.clearCurrentTarget();
    g.notice = '';
    g.emit();
  });
  await page.waitForTimeout(600);
  check(
    'Large currency amount fits the compact gold frame',
    await page.locator('.hud-gold').evaluate((el) => {
      const frame = el.getBoundingClientRect();
      return Array.from(el.children).every((child) => {
        const bounds = child.getBoundingClientRect();
        return bounds.left >= frame.left && bounds.right <= frame.right;
      });
    }),
  );
  await page.screenshot({ path: resolve(out, 'reference-field-1672.png') });
  await page.evaluate(() => {
    window.__hudQA.dead = true;
    window.__hudQA.emit();
  });
  check(
    'Death leaves HUD repositioning unavailable',
    await page
      .getByRole('button', { name: 'Reset HUD', exact: true })
      .isDisabled(),
  );
  check('No browser runtime errors', errors.length === 0);
  await writeFile(
    resolve(out, 'validation.json'),
    JSON.stringify({ checks, errors }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  await writeFile(
    resolve(out, 'failure.json'),
    JSON.stringify(
      {
        error: String(error),
        checks,
        errors,
        url: page.url(),
        debug: await page.evaluate(() => ({
          drag: window.__hudDragDebug,
          bindings: window.__hudQA?.hero.primaryHotbar,
          blocked: window.__hudQA?.uiInputBlockers.blocked,
          paused: window.__hudQA?.paused,
          notice: window.__hudQA?.notice,
        })),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
