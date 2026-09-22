import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, FIELDS, FIELD_NPCS, getNpcServiceLabel, NPC_SERVICE_LABELS } from './regions.ts';
import { CITY_SCALE, regionScale, regionHalfExtent } from './field-layout.ts';
import { freshHero, parseSave } from './rules.ts';

await test('both city dimensions and NPC spacing grow 50%, without changing interaction range', () => {
  assert.equal(CITY_SCALE, 1.5);
  assert.equal(regionScale(true), 1.5);
  assert.equal(regionHalfExtent(true), 67.5);
  for (const city of Object.values(CITIES)) {
    assert.equal(city.npcList.length, city.id === 'arunika' ? 12 : 11);
    for (const [index, npc] of city.npcList.entries()) {
      assert.equal(npc.x, (index % 4 - 1.5) * 8 * 1.5);
      assert.equal(npc.z, (-5 - Math.floor(index / 4) * 9) * 1.5);
      assert.equal(npc.interactionRange, 2.5);
      assert.ok(Math.abs(npc.x) < regionHalfExtent(true));
      assert.ok(Math.abs(npc.z) < regionHalfExtent(true));
    }
  }
});

await test('every city and field NPC has an explicit English service label', () => {
  const npcs = [...Object.values(CITIES).flatMap(city => city.npcList), ...Object.values(FIELD_NPCS)];
  assert.equal(npcs.length, Object.values(CITIES).reduce((n,c)=>n+c.npcList.length,0)+Object.keys(FIELDS).length);
  for (const npc of npcs) {
    assert.ok(NPC_SERVICE_LABELS[npc.service], npc.id);
    assert.notEqual(getNpcServiceLabel(npc), 'NPC Services');
  }
  assert.equal(getNpcServiceLabel(CITIES.arunika.npcList[3]), 'Forge Master');
  assert.equal(getNpcServiceLabel(CITIES.jayantara.npcList[1]), 'Specialization & Mastery');
  assert.equal(getNpcServiceLabel(CITIES.arunika.npcList.find(n => n.id === 'aruna-developer-materials')!), 'Developer Materials');
});

await test('save loading retains old city positions and positions in the expanded city', () => {
  for (const city of Object.keys(CITIES)) {
    for (const x of [12, 60, -60]) {
      const hero = freshHero(); hero.currentCity = city; hero.inCity = true; hero.x = x; hero.z = 60;
      const loaded = parseSave(JSON.stringify(hero));
      assert.ok(loaded);
      assert.equal(loaded.x, x);
      assert.equal(loaded.z, 60);
      assert.equal(loaded.currentCity, city);
    }
  }
});
