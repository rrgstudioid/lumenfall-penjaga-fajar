import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UI_SCALE, INTERFACE_STORAGE_KEY, loadUIScale, normalizeUIScale, saveUIScale } from './interface-settings.ts';
import { clampWindowPosition } from './ui-layout.ts';
import { clampPrimaryHotbarLayout } from './hotbar.ts';

await test('interface preference defaults, clamps, steps and survives reload without touching saves', () => {
  const entries = new Map([['character-save', 'unchanged']]);
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  assert.equal(loadUIScale(storage), DEFAULT_UI_SCALE);
  for (const [value, expected] of [[0,50],[200,150],[123,125],[Infinity,100],[NaN,100]]) assert.equal(normalizeUIScale(value), expected);
  for (const percent of [75,80,100,125,150]) { saveUIScale(percent, storage); assert.equal(loadUIScale(storage),percent); }
  saveUIScale(100,storage);
  assert.equal(loadUIScale(storage),100);
  assert.equal(entries.get('character-save'),'unchanged');
  storage.setItem(INTERFACE_STORAGE_KEY,'broken json');
  assert.equal(loadUIScale(storage),100);
  storage.setItem(INTERFACE_STORAGE_KEY,JSON.stringify({version:99,uiScale:150}));
  assert.equal(loadUIScale(storage),100);
  assert.doesNotThrow(()=>saveUIScale(150,{setItem(){throw Error('blocked');}}));
  assert.equal(loadUIScale({getItem(){throw Error('blocked');}}),100);
});

await test('scaled window and hotbar dimensions clamp in visual viewport pixels', () => {
  for (const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:2560,height:1440}]) {
    for (const scale of [.75,1,1.25,1.5]) {
      const size={width:600*scale,height:Math.min(500*scale,viewport.height*.86)};
      const window=clampWindowPosition({x:viewport.width-30,y:viewport.height-30},viewport,size);
      assert.ok(window.x>=12 && window.x+size.width<=viewport.width-11);
      assert.ok(window.y>=12 && window.y+size.height<=viewport.height-11);
      const bar={width:Math.min(880*scale,viewport.width-16),height:146*scale};
      const centered=clampPrimaryHotbarLayout(null,viewport,bar);
      assert.equal(centered.x,(viewport.width-bar.width)/2);
      assert.ok(centered.y+bar.height<=viewport.height-8);
      // Drag delta remains screen-space, never multiplied by UI scale.
      const moved=clampWindowPosition({x:100+80,y:30+40},viewport,size);
      assert.equal(moved.x,180); assert.equal(moved.y,70);
    }
  }
});
