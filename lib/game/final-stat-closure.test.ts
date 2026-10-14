import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCastReductions,resolveCastTiming} from './cast-timing.ts';
import {derivedStats,createV3AdventurerHero,gainXP,xpNeeded,allocateStatPoint,resolveHeroSkill,characterStatBreakdown,equipItem} from './rules.ts';
import {ADVENTURER_V3_RUNTIME_SKILLS} from './adventurer-v3.ts';
import {characterStatNote} from './character-screen.ts';
import {previewEquipmentChange} from './character-view.ts';
import {createItem} from './items.ts';
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const legal=(level:number)=>{const h=createV3AdventurerHero('CLOSURE MECHANICAL PROFILE');while(h.level<level)gainXP(h,xpNeeded(h.level));return h;};
await test('approved conversion/caps neutral40/large, FCT explicit only and charge/CD unchanged',()=>{
 assert.equal(resolveCastTiming({vct:2,fct:.4,chargeTime:.3},10,0,{castStat:0}).vct,2);
 assert.deepEqual(resolveCastReductions({castStat:40}),{statPercent:10,variablePercent:10,fixedPercent:0});
 const r=resolveCastTiming({vct:2,fct:.4,chargeTime:.3},10,90,{castStat:40});near(r.vct,1.8);near(r.fct,.4);near(r.chargeTime,.3);near(r.cooldown,6);
 assert.equal(resolveCastReductions({castStat:1000}).statPercent,80);
 assert.equal(resolveCastTiming({vct:2,fct:.4},0,0,{castStat:1000,variablePercent:25,fixedPercent:90}).vct,0);
 assert.equal(resolveCastTiming({vct:2,fct:.4},0,0,{castStat:1000,variablePercent:25,fixedPercent:90}).fct,.2);
});
await test('legal allocation -> resolved CastStat -> original action timing once, same UI math; metadata not delay',()=>{
 let h=legal(11);for(let i=0;i<20;i++){const r=allocateStatPoint(h,'dex');assert(r.ok);h=r.hero;}
 const s=derivedStats(h);assert.equal(s.castStat,40);
 const def={...ADVENTURER_V3_RUNTIME_SKILLS[0],baseDamageMinByRank:undefined,baseDamageMaxByRank:undefined,skillPowerFactor:0,castTiming:{vct:2,fct:.4,chargeTime:.3},actionLockDuration:.6};
 const a=resolveHeroSkill(h,def,1,s);assert(a.castTiming);near(a.castTiming.vct,1.8);near(a.castTiming.fct,.4);near(a.castTiming.chargeTime,.3);near(a.hitSequence[0].delay,2.5);assert.equal(a.actionLockDuration,.6);
 assert.match(characterStatNote('castStat',s)!,/stat 10%, total variable 10%, fixed 0%/);
 h.temporaryModifiers=[{remaining:10,modifier:{id:'EXPLICIT TIMING MECHANICAL',stats:{flat:{variableCastReduction:20,fixedCastReduction:25}}}}];
 const timed=resolveHeroSkill(h,def,1,derivedStats(h,h.allocatedStats,{cooldownReduction:90}));assert(timed.castTiming);near(timed.castTiming.vct,1.4);near(timed.castTiming.fct,.3);near(timed.cooldown,3.2*.6);
 const ordinary=resolveHeroSkill(h,ADVENTURER_V3_RUNTIME_SKILLS[0],1);assert.equal(ordinary.hitSequence[0].delay,0);assert.deepEqual(ordinary.castTiming,{vct:0,fct:0,chargeTime:0});
});
await test('shared defense level1/2/14/60/100 and legal primary/source contributions once',()=>{
 for(const level of [1,2,14,60,100]){
  let h=legal(level),s=derivedStats(h);const base=8+1.5*(level-1);near(s.physicalDefense,base+15*.5);near(s.magicDefense,base+15*.6+15*.2);
  if(level>1){for(const stat of ['vit','int'] as const){const r=allocateStatPoint(h,stat);assert(r.ok);h=r.hero;}
   s=derivedStats(h);near(s.physicalDefense,Math.round((base+16*.5)*10)/10);near(s.magicDefense,Math.round((base+16*.6+16*.2)*10)/10);}
 }
 const h=legal(14),s=derivedStats(h,h.allocatedStats,{vit:2,int:3,defense:4,magicDefense:5});near(s.physicalDefense,baseDefense(14)+17*.5+4);near(s.magicDefense,Math.round((baseDefense(14)+17*.6+18*.2+5)*10)/10);
 h.temporaryModifiers=[{remaining:10,modifier:{id:'MECHANICAL DEFENSE',stats:{flat:{physicalDefense:3,magicDefense:4},percent:{physicalDefense:10,magicDefense:20}}}}];
 const initial=derivedStats({...h,temporaryModifiers:[]}),actual=derivedStats(h);near(actual.physicalDefense,(initial.physicalDefense+3)*1.1);near(actual.magicDefense,(initial.magicDefense+4)*1.2);
 assert.deepEqual(characterStatBreakdown(h).final,actual);
});
function baseDefense(level:number){return 8+1.5*(level-1);}
await test('equipment defense preview/UI repeated reads pure; absolute current HP/Mana clamp remains',()=>{
 const h=legal(2);h.hp=40;h.mana=12;const ring=createItem('arunika-ring1');ring.baseStats={defense:4,magicDefense:5};ring.bonusStats={hp:100,maxMana:50};h.inventory.push(ring);
 const before=structuredClone(h);for(let i=0;i<4;i++){const p=previewEquipmentChange(h,ring,'ring1');assert(p.validation.ok);near(p.after.physicalDefense,derivedStats(h).physicalDefense+4);near(p.after.magicDefense,derivedStats(h).magicDefense+5);characterStatNote('castStat',p.after);characterStatBreakdown(h);}
 assert.deepEqual(h,before);const equipped=equipItem(h,ring.id,'ring1');assert(equipped.ok);assert.equal(h.hp,40);assert.equal(h.mana,12);
});
