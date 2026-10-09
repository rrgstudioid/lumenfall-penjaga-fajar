import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSunkenSave } from './sunken-ruins-save-migration.ts';
import {
  SUNKEN_ENTRY,
  SUNKEN_ID,
  SUNKEN_PREVIEW_ID,
  SUNKEN_LAYOUT_VERSION,
  SUNKEN_PORTALS,
} from './sunken-ruins-layout.ts';
import { freshHero, parseSave } from './rules.ts';

await test('retired Sunken field saves relocate once while retaining items and progression', () => {
  const hero = freshHero();
  Object.assign(hero, {
    currentField: SUNKEN_ID,
    inCity: false,
    level: 40,
    x: 58,
    z: -56,
    gold: 123456,
  });
  delete hero.sunkenLayoutVersion;
  hero.fieldProgress[SUNKEN_ID] = 120;
  hero.defeatedFieldBosses = [SUNKEN_ID];
  hero.completedQuests = ['field-sunken-ruins-easy'];
  hero.activeQuests = [
    'field-sunken-ruins-veteran',
    'field-meteorfall-citadel-easy',
  ];
  hero.acceptedQuests = [...hero.activeQuests];
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.currentField, SUNKEN_ID);
  assert.equal(loaded.inCity, false);
  assert.deepEqual({ x: loaded.x, z: loaded.z }, SUNKEN_ENTRY);
  assert.deepEqual(loaded.lastSafePosition, SUNKEN_ENTRY);
  assert.equal(loaded.sunkenLayoutVersion, SUNKEN_LAYOUT_VERSION);
  for (const key of [
    'gold',
    'level',
    'xp',
    'equipment',
    'pet',
    'fieldProgress',
    'defeatedFieldBosses',
    'completedQuests',
  ] as const)
    assert.deepEqual(loaded[key], hero[key], key);
  assert.deepEqual(
    loaded.inventory.map((i) => i.id),
    hero.inventory.map((i) => i.id),
  );
  assert.deepEqual(loaded.activeQuests, ['field-meteorfall-citadel-easy']);
  Object.assign(loaded, SUNKEN_PORTALS[3]);
  const reloaded = parseSave(JSON.stringify(loaded))!;
  assert.deepEqual(
    { x: reloaded.x, z: reloaded.z },
    { x: loaded.x, z: loaded.z },
  );
});

await test('preview saves migrate identities, merge progress and respawn timers, and keep valid large-map positions', () => {
  const hero = freshHero();
  Object.assign(hero, {
    currentField: SUNKEN_PREVIEW_ID,
    inCity: false,
    level: 42,
    ...SUNKEN_PORTALS[3],
  });
  delete hero.sunkenLayoutVersion;
  hero.unlockedFields = [SUNKEN_PREVIEW_ID, SUNKEN_ID];
  hero.defeatedFieldBosses = [SUNKEN_PREVIEW_ID];
  hero.fieldProgress = { [SUNKEN_ID]: 7, [SUNKEN_PREVIEW_ID]: 90 };
  hero.defeatedBossTimestamp = { [SUNKEN_ID]: 500, [SUNKEN_PREVIEW_ID]: 700 };
  hero.monsterRespawnState = {
    'sunken-ruins-5:spawn:100': 999,
    [`${SUNKEN_PREVIEW_ID}:sunken-ruins-4:spawn:20`]: 3000,
    [`${SUNKEN_ID}:sunken-ruins-4:spawn:20`]: 2000,
    'meteorfall-citadel-1:spawn:2': 4000,
  };
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.currentField, SUNKEN_ID);
  assert.deepEqual({ x: loaded.x, z: loaded.z }, { x: hero.x, z: hero.z });
  assert.ok(Math.abs(loaded.x) > 100);
  assert.ok(!loaded.unlockedFields.includes(SUNKEN_PREVIEW_ID));
  assert.deepEqual(loaded.defeatedFieldBosses, [SUNKEN_ID]);
  assert.deepEqual(loaded.fieldProgress, { [SUNKEN_ID]: 90 });
  assert.deepEqual(loaded.defeatedBossTimestamp, { [SUNKEN_ID]: 700 });
  assert.deepEqual(loaded.monsterRespawnState, {
    [`${SUNKEN_ID}:sunken-ruins-4:spawn:20`]: 3000,
    'meteorfall-citadel-1:spawn:2': 4000,
  });
});

await test('migration leaves unrelated map positions and source objects intact', () => {
  const source = {
    currentField: 'meteorfall-citadel',
    inCity: false,
    x: 18,
    z: 25,
    fieldProgress: { [SUNKEN_PREVIEW_ID]: 12 },
  };
  const before = structuredClone(source);
  const result = migrateSunkenSave(source);
  assert.deepEqual(source, before);
  assert.deepEqual({ x: result.x, z: result.z }, { x: 18, z: 25 });
  assert.deepEqual(migrateSunkenSave(result), result);
});
