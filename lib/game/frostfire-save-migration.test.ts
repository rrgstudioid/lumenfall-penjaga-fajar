import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { FROSTFIRE_ID, FROSTFIRE_PREVIEW_ID, FROSTFIRE_ENTRY, FROSTFIRE_LAYOUT_VERSION, FrostNavigation } from './frostfire-highlands-layout.ts';
import { createV3AdventurerHero, parseSave } from './rules.ts';
import { FIELDS, CITIES, travel } from './regions.ts';
import { frostPopulation } from './frostfire-population.ts';
import { migrateFrostfireSave } from './frostfire-save-migration.ts';

await test('old terrain saves relocate once, preserve ownership/progress and retire incompatible spawn timers', () => {
  const hero = createV3AdventurerHero();
  hero.level = 32; hero.inCity = false; hero.currentField = FROSTFIRE_ID;
  hero.x = 8; hero.z = -25; delete hero.frostfireLayoutVersion;
  hero.fieldProgress[FROSTFIRE_ID] = 12;
  hero.completedQuests = ['field-frostfire-highlands-easy'];
  hero.acceptedQuests = hero.activeQuests = ['field-frostfire-highlands-veteran'];
  hero.monsterRespawnState = {'frostfire-highlands-0:spawn:0':12345,'frostfire-highlands-5':67890,'ironveil-mines-0:spawn:0':111};
  const raw = JSON.stringify(hero), loaded = parseSave(raw)!;
  assert(loaded);
  assert.equal(JSON.stringify(hero), raw);
  assert.equal(loaded.currentField, FROSTFIRE_ID);
  assert.equal(loaded.currentCity, 'jayantara');
  assert.deepEqual({x:loaded.x,z:loaded.z},FROSTFIRE_ENTRY);
  assert.deepEqual(loaded.lastSafePosition,FROSTFIRE_ENTRY);
  assert.equal(loaded.frostfireLayoutVersion,FROSTFIRE_LAYOUT_VERSION);
  assert.deepEqual(loaded.inventory.map(i=>i.id),hero.inventory.map(i=>i.id));
  assert.deepEqual(loaded.equipment,hero.equipment);
  assert.equal(loaded.gold,hero.gold);
  assert.equal(loaded.fieldProgress[FROSTFIRE_ID],12);
  assert.deepEqual(loaded.completedQuests,hero.completedQuests);
  assert.deepEqual(loaded.acceptedQuests,[]);
  assert.deepEqual(loaded.monsterRespawnState,{'ironveil-mines-0:spawn:0':111});
  const p = frostPopulation().homes[0];
  Object.assign(loaded,p);
  const again = parseSave(JSON.stringify(loaded))!;
  assert.equal(again.x,p.x); assert.equal(again.z,p.z);
});

await test('preview saves keep snowfield coordinates and respawns while IDs merge idempotently', () => {
  const hero = createV3AdventurerHero(), p = frostPopulation().bossHome;
  Object.assign(hero,{level:34,inCity:false,currentField:FROSTFIRE_PREVIEW_ID,...p});
  delete hero.frostfireLayoutVersion;
  hero.unlockedFields = [FROSTFIRE_PREVIEW_ID,FROSTFIRE_ID];
  hero.defeatedFieldBosses = [FROSTFIRE_PREVIEW_ID];
  hero.fieldProgress = {[FROSTFIRE_ID]:3,[FROSTFIRE_PREVIEW_ID]:15};
  hero.defeatedBossTimestamp = {[FROSTFIRE_PREVIEW_ID]:123456};
  const key = 'frostfire-highlands-5:spawn:20000';
  hero.monsterRespawnState = {[`${FROSTFIRE_PREVIEW_ID}:${key}`]:99999};
  const migrated = migrateFrostfireSave({...hero});
  assert.deepEqual(migrateFrostfireSave(migrated),migrated);
  const loaded = parseSave(JSON.stringify(hero))!;
  assert.equal(loaded.currentField,FROSTFIRE_ID);
  assert.equal(loaded.x,p.x); assert.equal(loaded.z,p.z);
  assert(new FrostNavigation().valid(loaded));
  assert(!loaded.unlockedFields.includes(FROSTFIRE_PREVIEW_ID));
  assert.equal(loaded.unlockedFields.filter(id=>id===FROSTFIRE_ID).length,1);
  assert.deepEqual(loaded.defeatedFieldBosses,[FROSTFIRE_ID]);
  assert.deepEqual(loaded.fieldProgress,{[FROSTFIRE_ID]:15});
  assert.deepEqual(loaded.defeatedBossTimestamp,{[FROSTFIRE_ID]:123456});
  assert.deepEqual(loaded.monsterRespawnState,{[`${FROSTFIRE_ID}:${key}`]:99999});
});

await test('production registry contains exactly one permanent Frostfire map with 133 spawns', () => {
  const result = execFileSync(process.execPath, ['--experimental-transform-types','--input-type=module','-e',
    "import {FIELDS} from './lib/game/regions.ts'; import {fieldSpawns} from './lib/game/field-layout.ts'; console.log(JSON.stringify(Object.values(FIELDS).filter(f=>f.id.startsWith('frostfire')).map(f=>({id:f.id,name:f.displayName,count:fieldSpawns(f).length}))));"],
    {cwd:process.cwd(),env:{...process.env,NODE_ENV:'production'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(result),[{id:FROSTFIRE_ID,name:'Frostfire Highlands',count:133}]);
  assert(CITIES.jayantara.connectedFields.includes(FROSTFIRE_ID));
  assert.equal(FIELDS['whispering-wilds-v2'].nextMap,FROSTFIRE_ID);
  assert.equal(FIELDS['sunken-ruins'].previousField,FROSTFIRE_ID);
  const hero=createV3AdventurerHero();hero.level=34;
  assert.equal(travel(hero,FROSTFIRE_PREVIEW_ID).ok,false);
  assert.equal(travel(hero,FROSTFIRE_ID).ok,true);
});
