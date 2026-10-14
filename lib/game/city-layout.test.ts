import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, FIELDS, FIELD_NPCS, getNpcServiceLabel, NPC_SERVICE_LABELS } from './regions.ts';
import { CITY_SCALE, regionScale, regionHalfExtent } from './field-layout.ts';
import { freshHero, parseSave } from './rules.ts';

await test('city dimensions and per-city NPC rosters preserve approved spacing and interaction range', () => {
  assert.equal(CITY_SCALE, 1.5);
  assert.equal(regionScale(true), 1.5);
  assert.equal(regionHalfExtent(true), 67.5);
  // Owner ACC A14: Averion intentionally has no NPCs or NPC services.
  const rosterCounts: Record<string, number> = { averion: 0, arunika: 12, jayantara: 11 };
  assert.deepEqual(Object.keys(CITIES).sort(), Object.keys(rosterCounts).sort());
  for (const city of Object.values(CITIES)) {
    assert.equal(city.npcList.length, rosterCounts[city.id], city.id);
    for (const [index, npc] of city.npcList.entries()) {
      assert.equal(npc.x, (index % 4 - 1.5) * 8 * 1.5);
      assert.equal(npc.z, (-5 - Math.floor(index / 4) * 9) * 1.5);
      assert.equal(npc.interactionRange, 2.5);
      assert.ok(Math.abs(npc.x) < regionHalfExtent(true));
      assert.ok(Math.abs(npc.z) < regionHalfExtent(true));
    }
  }
});

await test('A14 Averion intentionally exposes no NPC roster or NPC services', () => {
  assert.deepEqual(CITIES.averion.npcList.flatMap(npc => npc.services), []);
  assert.deepEqual(CITIES.averion.npcList.flatMap(npc => npc.shopInventory), []);
  assert.deepEqual(CITIES.averion.npcList, []);
});

await test('every city and field NPC has an explicit English service label', () => {
  const npcs = [...Object.values(CITIES).flatMap(city => city.npcList), ...Object.values(FIELD_NPCS)];
  // Verdant Plains v2 has no field NPC (docs/maps/verdant-plains-v2.md).
  // A field registration is not a service/camp registration.
  assert.equal(FIELD_NPCS['verdant-plains-v2'], undefined);
  assert.deepEqual(Object.keys(FIELD_NPCS).sort((a,b)=>a.localeCompare(b)),
    Object.keys(FIELDS).filter(id=>id!=='verdant-plains-v2').sort((a,b)=>a.localeCompare(b)));
  assert.equal(new Set(npcs.map(npc=>npc.id)).size, npcs.length);
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
