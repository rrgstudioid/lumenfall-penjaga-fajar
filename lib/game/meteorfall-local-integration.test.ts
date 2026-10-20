import test from 'node:test';
import assert from 'node:assert/strict';
import {freshHero, gainXP, xpNeeded, parseSave} from './rules.ts';
import {FIELDS, FIELD_NPCS, acceptRegionQuest, completeRegionQuest, regionQuestProgress, travel} from './regions.ts';
import {createItem} from './items.ts';
import {METEORFALL_ID, METEORFALL_ENTRY} from './meteorfall-citadel-layout.ts';
import {SUNKEN_ENTRY} from './sunken-ruins-layout.ts';

// Own mechanical save fixtures. Objective counters represent recorded historical
// progress, not native kill proof or new reward/balance approval.
for(const quest of FIELDS['sunken-ruins'].questList) await test(`Meteorfall migration preserves Sunken ${quest} and once-only reward`,()=>{
 let h=freshHero();while(h.level<42)gainXP(h,xpNeeded(h.level));
 assert(travel(h,'sunken-ruins').ok);assert(acceptRegionQuest(h,quest));
 const info=regionQuestProgress(h,quest);assert(info);
 h.fieldProgress['sunken-ruins']=100;
 const expected=structuredClone({active:h.activeQuests,accepted:h.acceptedQuests,completed:h.completedQuests,field:h.fieldProgress,city:h.cityProgress});
 assert(travel(h,METEORFALL_ID).ok);delete h.meteorfallLayoutVersion;h.x=12;h.z=30;
 const serialized=JSON.stringify(h);h=parseSave(serialized)!;assert(h);assert.deepEqual({x:h.x,z:h.z},METEORFALL_ENTRY);
 assert.deepEqual({active:h.activeQuests,accepted:h.acceptedQuests,completed:h.completedQuests,field:h.fieldProgress,city:h.cityProgress},expected);
 assert(travel(h,'sunken-ruins').ok);const first=completeRegionQuest(h,quest);assert(first.ok);assert(first.reward.xp>0);assert(first.reward.items.length>0);
 h=parseSave(JSON.stringify(h))!;const before=JSON.stringify(h);const duplicate=completeRegionQuest(h,quest);assert(!duplicate.ok);assert.equal(JSON.stringify(h),before);assert.equal(h.completedQuests.filter(x=>x===quest).length,1);
 assert.equal(FIELD_NPCS['sunken-ruins'].x,SUNKEN_ENTRY.x+3);assert.equal(FIELD_NPCS['sunken-ruins'].z,SUNKEN_ENTRY.z);
});
await test('Meteorfall save migration does not retire locally retained Gloves or drop equipment identity',()=>{
 const h=freshHero(),gloves=createItem('arunika-gloves',{id:'MECHANICAL_OLD_GLOVES',enhancementLevel:6,sockets:[]});
 h.inventory.push(gloves);h.equipment.gloves=gloves.id;h.inCity=false;h.currentField=METEORFALL_ID;delete h.meteorfallLayoutVersion;
 const parsed=parseSave(JSON.stringify(h))!;assert(parsed);assert.equal(parsed.equipment.gloves,gloves.id);assert.equal(parsed.inventory.find(x=>x.id===gloves.id)?.enhancementLevel,6);assert.equal(parsed.pendingLoot.length,h.pendingLoot.length);
});
