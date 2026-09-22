import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampWindowPosition,
  readUILayout,
  resetUILayout,
  resetUILayoutEntries,
  saveWindowPosition,
  saveWindowScale,
  saveWindowSize,
  UI_LAYOUT_STORAGE_KEY,
  WindowFocusManager,
} from './ui-layout.ts';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    values,
  };
}

await test('window position is clamped without losing its header', () => {
  assert.deepEqual(
    clampWindowPosition(
      { x: -100, y: 900 },
      { width: 1280, height: 720 },
      { width: 480, height: 500 },
    ),
    { x: 12, y: 208 },
  );
  assert.deepEqual(
    clampWindowPosition(
      { x: 700, y: 500 },
      { width: 420, height: 300 },
      { width: 700, height: 500 },
    ),
    { x: 288, y: 240 },
  );
});

await test('UI layout persists separately and ignores malformed data', () => {
  const storage = createStorage({
    'lumenfall:characters:v2': JSON.stringify({ gold: 500 }),
  });
  saveWindowPosition('panel-jobSkill', { x: 240.4, y: 80.6 }, storage);
  saveWindowPosition('panel-bag', { x: 40, y: 60 }, storage);
  assert.deepEqual(readUILayout(storage), {
    'panel-jobSkill': { x: 240, y: 81 },
    'panel-bag': { x: 40, y: 60 },
  });
  assert.equal(
    storage.values.get('lumenfall:characters:v2'),
    JSON.stringify({ gold: 500 }),
  );
  storage.setItem(UI_LAYOUT_STORAGE_KEY, '{broken');
  assert.deepEqual(readUILayout(storage), {});
});

await test('window dimensions share UI layout storage without touching progression saves', () => {
  const storage = createStorage({
    'lumenfall:characters:v2': JSON.stringify({ gold: 999 }),
  });
  saveWindowPosition('general-merchant', { x: 80, y: 60 }, storage);
  saveWindowSize('general-merchant', { width: 520, height: 680 }, storage);
  assert.deepEqual(readUILayout(storage), {
    'general-merchant': { x: 80, y: 60, width: 520, height: 680 },
  });
  assert.equal(
    storage.values.get('lumenfall:characters:v2'),
    JSON.stringify({ gold: 999 }),
  );
});

await test('hotbar position and local scale share UI layout storage independently', () => {
  const storage = createStorage({
    'lumenfall:characters:v2': JSON.stringify({ gold: 321 }),
  });
  saveWindowPosition('primary-hotbar', { x: 120, y: 640 }, storage);
  saveWindowScale('primary-hotbar', 1.25, storage);
  saveWindowPosition('quick-hotbar-q', { x: 480, y: 520 }, storage);
  saveWindowScale('quick-hotbar-q', 0.5, storage);
  assert.deepEqual(readUILayout(storage), {
    'primary-hotbar': { x: 120, y: 640, scale: 1.25 },
    'quick-hotbar-q': { x: 480, y: 520, scale: 0.5 },
  });
  resetUILayoutEntries(['primary-hotbar', 'quick-hotbar-q'], storage);
  assert.deepEqual(readUILayout(storage), {});
  assert.equal(
    storage.values.get('lumenfall:characters:v2'),
    JSON.stringify({ gold: 321 }),
  );
});

await test('reset removes only UI layout preferences', () => {
  const storage = createStorage({
    [UI_LAYOUT_STORAGE_KEY]: JSON.stringify({ version: 2, windows: {} }),
    game: 'preserved',
  });
  resetUILayout(storage);
  assert.equal(storage.values.has(UI_LAYOUT_STORAGE_KEY), false);
  assert.equal(storage.values.get('game'), 'preserved');
});

await test('focus manager centralizes frontmost window ordering', () => {
  const updates = new Map<string, number>();
  const manager = new WindowFocusManager(60);
  const unregisterInventory = manager.register('inventory', (value) =>
    updates.set('inventory', value),
  );
  const unregisterSkills = manager.register('skills', (value) =>
    updates.set('skills', value),
  );
  assert.equal(updates.get('inventory'), 60);
  assert.equal(updates.get('skills'), 62);
  manager.focus('inventory');
  assert.equal(updates.get('skills'), 60);
  assert.equal(updates.get('inventory'), 62);
  unregisterInventory();
  unregisterSkills();
});

await test('3B binding destination layer follows the real foreground stack, not stale z-61', () => {
  const manager = new WindowFocusManager();
  const visible = new Map<string, number>();
  const closeA = manager.register('skills', z => visible.set('skills', z));
  const closeB = manager.register('inventory', z => visible.set('inventory', z));
  assert.equal(manager.topZIndex, 1002);
  manager.focus('skills');
  assert.equal(manager.topZIndex, visible.get('skills'));
  assert.ok(manager.topZIndex + 2 > Math.max(...visible.values()));
  closeB();
  assert.equal(manager.topZIndex, 1000);
  closeA();
  assert.equal(manager.topZIndex, 1000);
});
