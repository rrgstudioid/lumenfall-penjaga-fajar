import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, FIELD_NPCS, fieldQuestInfo, getAllQuestJournalEntries, acceptRegionQuest, travel, unlockReason, migrateFieldQuestId } from './regions.ts';
import { freshHero, parseSave } from './rules.ts';

await test('all Chapter 1 maps travel by level without former quest or boss unlocks',()=>{
  const hero=freshHero(); hero.level=50; hero.completedQuests=[]; hero.defeatedFieldBosses=[]; hero.unlockedFields=[]; hero.unlockedCities=[];
  for(const field of Object.values(FIELDS)){ assert.equal(unlockReason(hero,field.id),''); assert.equal(travel(hero,field.id).ok,!field.warpOnly); if(!field.warpOnly)assert.ok(hero.unlockedFields.includes(field.id)); }
  for(const cityId of ['arunika','jayantara'])assert.equal(travel(hero,cityId).ok,true);
});

await test('quest-enabled fields retain difficulty quests; hunting-only fields have no quest or giver',()=>{
  const hero=freshHero(); hero.level=1; const entries=getAllQuestJournalEntries(hero);
  for(const field of Object.values(FIELDS)){
    if(!field.questList.length){assert.deepEqual(field.questList,[]);assert.equal(FIELD_NPCS[field.id],undefined);assert.equal(entries.filter(entry=>entry.targetMapId===field.id&&entry.category==='side').length,0);continue;}
    assert.deepEqual(field.questList,[`field-${field.id}-easy`,`field-${field.id}-veteran`,`field-${field.id}-elite`]);
    const fieldEntries=entries.filter(entry=>entry.giverNpcId===FIELD_NPCS[field.id].id);
    assert.equal(fieldEntries.length,3);
    assert.ok(fieldEntries.every(entry=>entry.giverMapId===field.id&&entry.targetMapId===field.id&&entry.repeatable===false));
    const levels=fieldEntries.map(entry=>entry.requiredLevel);
    assert.deepEqual(levels,[field.minLevel,fieldQuestInfo(field,field.questList[1]).requiredLevel,fieldQuestInfo(field,field.questList[2]).requiredLevel]);
    assert.deepEqual(fieldEntries.map(entry=>entry.objectives[0].required),[5,10,15]);
    assert.ok(fieldEntries.every(entry=>entry.description.includes(field.displayName)));
  }
});

await test('field quests can only be accepted from the camp in their own field',()=>{
  const hero=freshHero(); hero.level=50; hero.inCity=true; hero.currentField='east-gate-arunika';
  assert.equal(acceptRegionQuest(hero,'field-east-gate-arunika-easy'),false); assert.deepEqual(hero.activeQuests,[]);
  hero.inCity=false; hero.currentField='ironveil-mines';
  assert.equal(acceptRegionQuest(hero,'field-east-gate-arunika-easy'),false); assert.deepEqual(hero.activeQuests,[]);
  hero.currentField='east-gate-arunika';
  assert.equal(acceptRegionQuest(hero,'field-east-gate-arunika-easy'),true); assert.deepEqual(hero.activeQuests,['field-east-gate-arunika-easy']);
  assert.equal(acceptRegionQuest(hero,'field-east-gate-arunika-easy'),true); assert.deepEqual(hero.activeQuests,['field-east-gate-arunika-easy']);
});

await test('field quest journal progress increases after every monster kill',()=>{
  const hero=freshHero();
  hero.level=50;
  hero.inCity=false;
  hero.currentField='sunken-ruins';
  hero.fieldProgress['sunken-ruins']=12;
  assert.equal(acceptRegionQuest(hero,'field-sunken-ruins-easy'),true);

  let entry=getAllQuestJournalEntries(hero).find(quest=>quest.id==='field-sunken-ruins-easy')!;
  assert.deepEqual(entry.progress,[{current:0,required:5}]);
  assert.equal(entry.status,'active');

  hero.fieldProgress['sunken-ruins']+=1;
  entry=getAllQuestJournalEntries(hero).find(quest=>quest.id==='field-sunken-ruins-easy')!;
  assert.deepEqual(entry.progress,[{current:1,required:5}]);
  assert.equal(entry.status,'active');

  hero.fieldProgress['sunken-ruins']+=4;
  entry=getAllQuestJournalEntries(hero).find(quest=>quest.id==='field-sunken-ruins-easy')!;
  assert.deepEqual(entry.progress,[{current:5,required:5}]);
  assert.equal(entry.status,'ready_to_complete');
});

await test('legacy field opening quests migrate to the new local Easy quest',()=>{
  assert.equal(migrateFieldQuestId('story-sunken-ruins'),'field-sunken-ruins-easy');
  const hero=freshHero();hero.activeQuests=['story-sunken-ruins'];hero.acceptedQuests=['story-sunken-ruins'];hero.completedQuests=['story-verdant-plains'];
  const loaded=parseSave(JSON.stringify(hero))!;
  assert.deepEqual(loaded.activeQuests,['field-sunken-ruins-easy']);
  assert.deepEqual(loaded.acceptedQuests,['field-sunken-ruins-easy']);
  assert.deepEqual(loaded.completedQuests,['field-verdant-plains-easy']);
});
