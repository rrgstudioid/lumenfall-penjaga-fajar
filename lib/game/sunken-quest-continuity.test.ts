import test from 'node:test';
import assert from 'node:assert/strict';
import {freshHero,gainXP,xpNeeded,parseSave,parseSaveCollection} from './rules.ts';
import {FIELDS,FIELD_NPCS,travel,acceptRegionQuest,completeRegionQuest,regionQuestProgress,regionQuestReward,getQuestRegistry} from './regions.ts';
import {SUNKEN_ID,SUNKEN_ENTRY,SUNKEN_LAYOUT_VERSION,sunkenSafe,sunkenWalkable} from './sunken-ruins-layout.ts';
import {migrateSunkenSave} from './sunken-ruins-save-migration.ts';
const cohort=()=>{const h=freshHero();while(h.level<40)gainXP(h,xpNeeded(h.level));assert(travel(h,SUNKEN_ID).ok);return h;};
for(const [suffix,target,xp,gold,quantity] of [['easy',5,1120,515,2],['veteran',10,2016,927,3],['elite',15,3360,1545,5]] as const){
 await test(`Sunken ${suffix}: old/new save preserves partial progress and reward is once-only`,()=>{
  const h=cohort(),id=`field-sunken-ruins-${suffix}`;
  h.fieldProgress[SUNKEN_ID]=12;assert(acceptRegionQuest(h,id));h.fieldProgress[SUNKEN_ID]+=3;
  delete h.sunkenLayoutVersion;h.x=58;h.z=-56;
  const raw=JSON.stringify(h),loaded=parseSave(raw)!;assert(loaded);assert.equal(JSON.stringify(h),raw);
  assert.deepEqual({x:loaded.x,z:loaded.z},SUNKEN_ENTRY);assert.equal(loaded.sunkenLayoutVersion,SUNKEN_LAYOUT_VERSION);
  assert.deepEqual(regionQuestProgress(loaded,id),{current:3,target});assert.equal(loaded.cityProgress[`baseline-${id}`],12);
  assert.deepEqual(regionQuestReward(id),{xp,gold,items:[{templateId:'vibranium',quantity}]});
  assert.equal(completeRegionQuest(loaded,id).ok,false);
  loaded.fieldProgress[SUNKEN_ID]+=target-3; // mechanical kill counter; actual Game covered separately
  assert.equal(completeRegionQuest(loaded,id).ok,true);const after=JSON.stringify(loaded);
  assert.equal(completeRegionQuest(loaded,id).ok,false);assert.equal(acceptRegionQuest(loaded,id),false);assert.equal(JSON.stringify(loaded),after);
  loaded.x=SUNKEN_ENTRY.x+4;const again=parseSave(JSON.stringify(loaded))!;
  assert.equal(again.x,loaded.x);assert.equal(completeRegionQuest(again,id).ok,false);assert.equal(acceptRegionQuest(again,id),false);
  for(const key of ['level','xp','equipment','allocatedStats','statPoints','skillProgressionV3','primaryHotbar'] as const)assert.deepEqual(again[key],h[key]);
  // Existing parser materializes isEquipped=false; all persisted item fields stay.
  assert.deepEqual(again.inventory.map(i=>({...i,isEquipped:undefined})),h.inventory.map(i=>({...i,isEquipped:undefined})));
  for(const item of again.inventory)assert.equal(item.isEquipped,Object.values(again.equipment).includes(item.id));
 });
}
await test('old quest alias keeps its acceptance baseline and completed alias cannot pay twice',()=>{
 const h=cohort();h.activeQuests=h.acceptedQuests=['story-sunken-ruins'];h.fieldProgress[SUNKEN_ID]=103;h.cityProgress['baseline-story-sunken-ruins']=100;
 const loaded=parseSave(JSON.stringify(h))!;assert.deepEqual(regionQuestProgress(loaded,'field-sunken-ruins-easy'),{current:3,target:5});
 h.completedQuests=['story-sunken-ruins'];const done=parseSave(JSON.stringify(h))!;assert(done.completedQuests.includes('field-sunken-ruins-easy'));assert.equal(completeRegionQuest(done,'field-sunken-ruins-easy').ok,false);
});
await test('conflicting alias counters hold only affected quest and retain original evidence',()=>{
 const h=cohort();h.activeQuests=h.acceptedQuests=['story-sunken-ruins','field-sunken-ruins-easy'];h.cityProgress={'baseline-story-sunken-ruins':10,'baseline-field-sunken-ruins-easy':20};
 const before=JSON.stringify(h);const migrated=migrateSunkenSave(h as unknown as Record<string,unknown>);assert((migrated.questProgressHolds as Record<string,unknown>)['field-sunken-ruins-easy']);assert.equal(JSON.stringify(h),before);
 const other=freshHero(),collection=parseSaveCollection(JSON.stringify({characters:{held:h,other},activeSlot:'other'}))!;
 assert(collection.characters.other);assert(collection.characters.held);assert(collection.characters.held.questProgressHolds?.['field-sunken-ruins-easy']);assert.equal(collection.characters.held.cityProgress['baseline-story-sunken-ruins'],10);assert.equal(collection.characters.held.cityProgress['baseline-field-sunken-ruins-easy'],20);assert(!completeRegionQuest(collection.characters.held,'field-sunken-ruins-easy').ok);assert(acceptRegionQuest(collection.characters.held,'field-sunken-ruins-veteran'));
});
await test('same NPC identity is safe and three quest definitions/rewards remain available',()=>{
 const camp=FIELD_NPCS[SUNKEN_ID];assert.equal(camp.id,'field-npc-sunken');assert(sunkenSafe(camp));assert(sunkenWalkable(camp));assert(Math.hypot(camp.x-SUNKEN_ENTRY.x,camp.z-SUNKEN_ENTRY.z)<10);
 const q=getQuestRegistry().filter(q=>q.giverNpcId===camp.id);assert.equal(q.length,3);assert.deepEqual(q.map(q=>q.requiredLevel),[32,35,39]);assert(q.every(q=>!q.repeatable));assert.equal(FIELDS[SUNKEN_ID].questList.length,3);
});
