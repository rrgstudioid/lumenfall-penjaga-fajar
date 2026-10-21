import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const output=process.env.EXP_P1_OUTPUT;assert(output);const oracle=JSON.parse(fs.readFileSync('tests/fixtures/exp-p1-approved.json'));
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
Object.assign(globalThis,{localStorage:memory,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/exp-p1'}}});
const server=await createServer({configFile:false,appType:'custom',cacheDir:path.join(output,'tests-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}}});
const load=p=>server.ssrLoadModule('/'+p),p=await load('lib/game/exp-progression-p1.ts'),r=await load('lib/game/rules.ts'),regions=await load('lib/game/regions.ts'),sv=await load('lib/game/save-v2.ts');

await test('literal approved99 transitions +100 monster baselines, integer/monotonic/cap',()=>{
 let previous=0;for(const row of oracle.table){assert.equal(p.expP1NormalBaseline(row.level),row.normalEXP);assert.equal(r.xpNeeded(row.level),row.requiredEXP??0);if(row.requiredEXP!==null){assert(Number.isInteger(row.requiredEXP));assert(row.requiredEXP>previous);previous=row.requiredEXP;}}
 for(const bad of [0,-1,101,1.5,NaN,Infinity]){assert.throws(()=>p.expP1Requirement(bad));assert.throws(()=>p.expP1NormalBaseline(bad));}
 assert.deepEqual([1,15,36,60,80,99].map(r.xpNeeded),[160,11200,130980,823500,2997000,9500000]);
});
const monster=(level,variant='normal')=>({level,variant,rank:variant,exp:775,rewardLevel:1});
await test('normal actual level; no positive gap multiplier; existing penalty and nonnormal base retained',()=>{
 assert.deepEqual([20,22,25].map(M=>regions.monsterXP(monster(M),20)),[210,230,260]);
 assert.deepEqual([210,230,260].map(x=>Math.ceil(23100/x)),[110,101,89]);
 assert.equal(regions.monsterXP(monster(36),36),370);assert.equal(regions.monsterXP(monster(1),100),1);
 assert.equal(regions.monsterXP(monster(20),26),193);assert.equal(regions.monsterXP(monster(20,'elite'),20),775);assert.equal(regions.monsterXP(monster(20,'boss'),20),775);
 assert.throws(()=>regions.monsterXP(monster(101),1));assert.throws(()=>regions.monsterXP(monster(1),NaN));
});
await test('multi-level carry uses original SP/primary/refill; cap100 and no Core freeze',()=>{
 const h=r.createV3AdventurerHero();const before={sp:h.skillPoints,stat:h.statPoints};assert.equal(r.gainXP(h,160+330+560+17),3);assert.equal(h.level,4);assert.equal(h.xp,17);assert.equal(h.statPoints,before.stat+6);assert.equal(h.skillPoints,r.getTotalSkillPointsForLevel(4));assert.equal(h.hp,r.maxHP(h));
 const remaining=oracle.table.filter(x=>x.level>=4&&x.requiredEXP!==null).reduce((n,x)=>n+x.requiredEXP,0)-17; r.gainXP(h,remaining+123);assert.equal(h.level,100);assert.equal(h.xp,0);assert.equal(h.skillPoints,199);assert.equal(h.statPoints,198);assert.equal(r.gainXP(h,1010),0);
 for(const amount of [NaN,Infinity,-1,.5,Number.MAX_SAFE_INTEGER+1]){const snap=JSON.stringify(h);assert.throws(()=>r.gainXP(h,amount));assert.equal(JSON.stringify(h),snap);}
});
await test('old level and absoluteXP retained before normalization; reload idempotent above1million',()=>{
 let h=r.createV3AdventurerHero('slot-1','Old fixture');for(const row of oracle.table.slice(0,79))r.gainXP(h,row.requiredEXP);
 delete h.expProgressionVersion;h.xp=2345678;h.hp=123;h.mana=12;const identity={level:h.level,xp:h.xp,SP:h.skillPoints,stats:h.statPoints,inventory:h.inventory.map(x=>x.id),characterId:h.characterId,ranks:{...h.skillProgressionV3,skillFamilies:undefined}};
 for(let i=0;i<4;i++){h=r.parseSave(JSON.stringify(sv.encodeCharacterV2(h)));assert(h);assert.equal(h.expProgressionVersion,p.EXP_P1_VERSION);assert.equal(h.hp,123);assert.equal(h.mana,12);assert.deepEqual({level:h.level,xp:h.xp,SP:h.skillPoints,stats:h.statPoints,inventory:h.inventory.map(x=>x.id),characterId:h.characterId,ranks:{...h.skillProgressionV3,skillFamilies:undefined}},identity);}
 const surplus=r.createV3AdventurerHero('slot-3');delete surplus.expProgressionVersion;surplus.xp=200;const retained=r.parseSave(JSON.stringify(surplus));assert.equal(retained.level,1);assert.equal(retained.xp,200);r.gainXP(retained,0);assert.equal(retained.level,2);assert.equal(retained.xp,40);
 const raw={...h,xp:NaN};assert.equal(r.parseSave(JSON.stringify(raw)),null);const c=r.parseSaveCollection(JSON.stringify({characters:{'slot-1':raw,'slot-2':r.createV3AdventurerHero('slot-2')}}));assert(c.characters['slot-2']);assert(c.preservedCharacters['slot-1']);
});
await test('UI full numbers/percent, cap100, pure reads without RNG or mutation',async()=>{
 const {ExperienceBar}=await load('components/game/hud/experience-bar.tsx'),h={level:80,xp:2345678,saved:true},before=JSON.stringify(h),old=Math.random;Math.random=()=>{throw Error('RNG read');};
 try{const html=renderToStaticMarkup(React.createElement(ExperienceBar,h));assert(html.includes('2.345.678 / 2.997.000 EXP'));assert(html.includes('%'));assert.equal(JSON.stringify(h),before);const cap=renderToStaticMarkup(React.createElement(ExperienceBar,{...h,level:100}));assert(cap.includes('LEVEL MAKSIMAL'));assert(!cap.includes('/ 0'));assert(!cap.includes('NaN'));assert(!cap.includes('101'));}finally{Math.random=old;}
});
await test('production preserves old curve/rewards and marked raw saves without playing/overwriting them',async()=>{
 await server.close();const prod=await createServer({configFile:false,mode:'production',appType:'custom',define:{'process.env.NODE_ENV':'"production"'},cacheDir:path.join(output,'prod-tests-cache'),optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}}});
 try{const pr=await prod.ssrLoadModule('/lib/game/rules.ts'),pg=await prod.ssrLoadModule('/lib/game/regions.ts');assert.equal(pr.xpNeeded(36),1530);assert.equal(pg.monsterXP({...monster(36),rewardLevel:18},36),38);assert.equal(pr.freshHero().expProgressionVersion,undefined);
  const marked=r.createV3AdventurerHero('slot-1'),raw=JSON.parse(JSON.stringify(sv.encodeCharacterV2(marked))),collection={characters:{'slot-1':raw,'slot-2':pr.createV3AdventurerHero('slot-2')}};storage.set(pr.SAVE_KEY,JSON.stringify(collection));const parsed=pr.parseSaveCollection(JSON.stringify(collection));assert.deepEqual(parsed.preservedCharacters['slot-1'],raw);assert(parsed.characters['slot-2']);assert(pr.listCharacters()[0].unavailableReason);assert.throws(()=>pr.loadCharacter('slot-1'));assert.throws(()=>pr.saveCharacter(pr.createV3AdventurerHero('slot-1'),true));assert.deepEqual(JSON.parse(storage.get(pr.SAVE_KEY)),JSON.parse(JSON.stringify(collection)));const again=pr.parseSaveCollection(sv.serializeSaveCollection(parsed));assert.deepEqual(again.preservedCharacters['slot-1'],raw);
 }finally{await prod.close();}
});

after(()=>server.close());
