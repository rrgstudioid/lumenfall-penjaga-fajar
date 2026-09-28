import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHUDLayoutPersistence,
  defaultHUDLayout,
  resolveHUDLayout,
  normalizeHUDPosition,
  HUD_LAYOUT_KEY,
  HUD_IDS,
  hudOverlaps,
  resizeHUDRect,
} from './hud-layout.ts';

void test('corner resize preserves aspect ratio and opposite corner, and clamps to safe viewport', () => {
  const origin = { x: 600, y: 300, width: 400, height: 120, scale: 1 };
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    const west = corner.includes('w'),
      north = corner.includes('n');
    const resized = resizeHUDRect(
      origin,
      { x: west ? -80 : 80, y: north ? -24 : 24 },
      corner,
      { width: 1920, height: 1080 },
      1,
    );
    assert.equal(resized.width, 480);
    assert.equal(resized.height, 144);
    assert.equal(
      resized.x + (west ? resized.width : 0),
      origin.x + (west ? origin.width : 0),
    );
    assert.equal(
      resized.y + (north ? resized.height : 0),
      origin.y + (north ? origin.height : 0),
    );
    const clamped = resizeHUDRect(
      origin,
      { x: west ? -9999 : 9999, y: north ? -9999 : 9999 },
      corner,
      { width: 1920, height: 1080 },
      1,
    );
    assert(clamped.x >= 34 && clamped.y >= 34);
    assert(
      clamped.x + clamped.width <= 1886 && clamped.y + clamped.height <= 1036,
    );
  }
});
void test('individual panel sizes restore independently of global UI scale and legacy layouts', () => {
  const values = new Map<string, string>();
  const persistence = createHUDLayoutPersistence({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  });
  values.set(
    HUD_LAYOUT_KEY,
    JSON.stringify({
      version: 1,
      positions: {},
      chatSize: { width: 454, height: 226 },
    }),
  );
  assert.deepEqual(persistence.load().scales, {});
  const layout = defaultHUDLayout();
  layout.scales.player = 0.75;
  persistence.save(layout);
  assert.equal(persistence.load().scales.player, 0.75);
  const rect = resolveHUDLayout(
    { width: 1920, height: 1080 },
    1.2,
    persistence.load(),
  ).player;
  assert(Math.abs(rect.width - 396 * 0.75 * 1.2) < 0.01);
  persistence.reset();
  assert.deepEqual(persistence.load().scales, {});
});

void test('all six HUD clusters fit supported resolutions and full existing scale range', () => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
    [3440, 1440],
    [1366, 768],
    [760, 600],
  ])
    for (const scale of [0.5, 0.8, 1, 1.2, 1.5]) {
      const rects = resolveHUDLayout(
        { width, height },
        scale,
        defaultHUDLayout(),
        11,
      );
      for (const id of HUD_IDS) {
        const r = rects[id];
        assert(
          r.x >= 0 &&
            r.y >= 0 &&
            r.x + r.width <= width + 1 &&
            r.y + r.height <= height + 1,
          `${id}: ${width}x${height}/${scale}`,
        );
      }
    }
});
void test('reference defaults reserve chat/hotbar space and dock chat upward when scaled', () => {
  for (const scale of [1, 1.2, 1.5]) {
    const r = resolveHUDLayout(
      { width: 1920, height: 1080 },
      scale,
      defaultHUDLayout(),
    );
    assert(!hudOverlaps(r.chat, r.hotbar, 0));
    assert(!hudOverlaps(r.quest, r.chat, 0));
  }
  const r = resolveHUDLayout(
    { width: 1920, height: 1080 },
    1,
    defaultHUDLayout(),
  );
  assert.deepEqual(
    [r.player.x, r.player.y, r.player.width, r.player.height],
    [34, 34, 396, 120],
  );
  assert.equal(r.hotbar.x, r.chat.x + r.chat.width + 26);
});
void test('buff tray grows beyond three rows without hiding effects and still fits the viewport', () => {
  for (const count of [1, 4, 5, 12, 13, 20]) {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 760, height: 600 },
    ]) {
      const r = resolveHUDLayout(viewport, 1.5, defaultHUDLayout(), count).buff;
      const rows = Math.ceil(count / 4);
      assert.equal(Math.round(r.height / r.scale), rows * 96 + (rows - 1) * 8);
      assert(r.x >= 0 && r.y >= 0);
      assert(r.x + r.width <= viewport.width + 1);
      assert(r.y + r.height <= viewport.height + 1);
    }
  }
});
void test('reference-sized viewport keeps expanded chat alongside the reference hotbar', () => {
  const r = resolveHUDLayout(
    { width: 1672, height: 941 },
    1,
    defaultHUDLayout(),
    1,
    false,
  );
  assert(!hudOverlaps(r.chat, r.hotbar, 0));
  assert(r.chat.y + r.chat.height > r.hotbar.y);
  assert(r.hotbar.width < 1000 && r.hotbar.width > 980);
  assert(r.right.width < 200 && r.right.width > 190);
});
void test('anchor-relative positions round trip without writing viewport-clamped results', () => {
  const viewport = { width: 1920, height: 1080 },
    layout = defaultHUDLayout();
  const rect = resolveHUDLayout(viewport, 1, layout).right;
  layout.positions.right = normalizeHUDPosition(
    'right',
    { x: 1300, y: 180 },
    viewport,
    rect,
  );
  const saved = structuredClone(layout);
  assert.equal(resolveHUDLayout(viewport, 1, layout).right.x, 1300);
  const wide = resolveHUDLayout({ width: 3440, height: 1440 }, 1, layout).right;
  assert(wide.x > 1300);
  resolveHUDLayout({ width: 760, height: 600 }, 1.5, layout);
  assert.deepEqual(layout, saved);
});
void test('HUD storage ignores malformed data, retains legacy settings and resets only its own scope', () => {
  const values = new Map<string, string>([
    ['save', 'unchanged'],
    ['lumenfall:ui-layout:v2', 'legacy'],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const adapter = createHUDLayoutPersistence(storage);
  values.set(HUD_LAYOUT_KEY, 'broken');
  assert.deepEqual(adapter.load(), defaultHUDLayout());
  values.set(
    HUD_LAYOUT_KEY,
    JSON.stringify({
      version: 1,
      positions: { player: { anchor: 'top-left', dx: 'bad', dy: 0 } },
      chatSize: { width: 2000, height: 2 },
    }),
  );
  assert.deepEqual(adapter.load().positions, {});
  assert.deepEqual(adapter.load().chatSize, { width: 640, height: 180 });
  const layout = defaultHUDLayout();
  layout.positions.chat = { anchor: 'bottom-left', dx: 0.2, dy: -0.1 };
  adapter.save(layout);
  adapter.save(layout, 'future-account');
  assert.deepEqual(adapter.load(), layout);
  adapter.reset();
  assert.deepEqual(adapter.load(), defaultHUDLayout());
  assert.deepEqual(adapter.load('future-account'), layout);
  assert.equal(values.get('save'), 'unchanged');
  assert.equal(values.get('lumenfall:ui-layout:v2'), 'legacy');
});
void test('unavailable browser storage never prevents HUD use', () => {
  const fail = () => {
    throw Error('blocked');
  };
  const adapter = createHUDLayoutPersistence({
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  });
  assert.deepEqual(adapter.load(), defaultHUDLayout());
  assert.doesNotThrow(() => adapter.save(defaultHUDLayout()));
  assert.doesNotThrow(() => adapter.reset());
});
