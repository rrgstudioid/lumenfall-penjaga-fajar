// Offline ACTUAL Game.castSkill / applySkill / SkillHitQueue / HP/death consumer.
// Synthetic DOM/WebGL/audio and monster numbers are MECHANICAL FIXTURE, not balance.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const output = process.env.RANK_GATE_CHECKPOINT;
const storage = new Map();
const memory = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), remove() {},
  getContext: () => ({ clearRect() {}, fillRect() {} }) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: { localStorage: memory, location: { hostname: 'localhost', pathname: '/tests/offline-basic' }, addEventListener() {}, removeEventListener() {} },
  document: { createElement: element, addEventListener() {}, removeEventListener() {} },
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {}, requestAnimationFrame: () => 0 });
const server = await createServer({ configFile: false, appType: 'custom',
  cacheDir: path.resolve(output ?? 'outputs/gameplay-migration/q2-q4-basic-world-integration/offline', 'power-strike-vite-cache'),
  server: { middlewareMode: true, hmr: false }, resolve: { alias: { '@': process.cwd() } },
  plugins: [{ name: 'offline-basic-renderer-only', enforce: 'pre',
    resolveId(id) { if (id === 'virtual:basic-test-three') return '\0basic-test-three'; },
    load(id) { if (id === '\0basic-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      setPixelRatio(){} setSize(){} render(){} dispose(){} forceContextLoss(){} }`; },
    transform(source, id) {
      if (id.replaceAll('\\', '/').endsWith('/lib/game/world.ts'))
        return source.replace("import * as T from 'three';", "import * as T from 'virtual:basic-test-three';");
    },
  }] });
const evidence = [];
after(async () => { await server.close(); if (output) fs.writeFileSync(path.join(output, 'world-evidence.json'), JSON.stringify(evidence, null, 2)); });
const load = name => server.ssrLoadModule('/lib/game/' + name + '.ts');
const { Game } = await load('world');
const rules = await load('rules');
for (const name of ['buildTerrain', 'buildShrine', 'buildEnemies', 'buildRegionDecor', 'placeActor', 'createPlayerStatusLabel', 'updateTargetPresentation', 'rebuildHeroAppearance'])
  Game.prototype[name] = function() {};
Game.prototype.buildHero = function() {
  this.characterModel = { animator: { play: (...args) => this.testAnimations.push(args), update() {} }, ready: Promise.resolve(true), dispose() {} };
  this.testAnimations = [];
};

const progression=await load('skill-progression-v3');
const family=await load('skill-family-runtime');
const presentation=await load('skill-family-presentation');
let serial=0;
const ids=['v3-adventurer-quick-slash','v3-adventurer-power-strike','v3-adventurer-minor-heal'];
function fresh(){
 storage.clear();const h=rules.createV3AdventurerHero('rank-gate-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;return g;
}
function levelTo(g,level){while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);}
function semantic(g){return {hero:structuredClone(g.hero),cd:{...g.skillCooldowns},timer:g.attackTimer,queue:g.skillHits.size,combo:g.combo};}
function ctx(g){return family.heroFamilyContext(g.hero);}
function buyPrior(g,id,next){
 const d=family.skillFamilyDefinitions[id];
 while((g.hero.skillLevels[id]??0)<next-1){
  const n=(g.hero.skillLevels[id]??0)+1;levelTo(g,Math.max(2,d.rankLevelRequirements[n-1]));
  assert.equal(g.learnSkill(id),true);
 }
}
function ledger(g){return {earned:g.hero.skillProgressionV3.totalEarnedSP,spent:progression.spentSkillPointsV3(g.hero.skillProgressionV3,family.skillFamilyDefinitions),
 available:g.hero.skillPoints,ranks:{...g.hero.skillProgressionV3.skillRanks},grants:{...g.hero.skillProgressionV3.grantedRanks},mirror:{...g.hero.skillLevels},level:g.hero.level};}
// Pure contexts deliberately synthetic; not browser or legal-world progression evidence.
for(const id of ids){
 const d=family.skillFamilyDefinitions[id];
 for(let rank=1;rank<=d.maxRank;rank++)await test('PURE declared gate matrix '+d.name+' R'+rank,()=>{
  for(const delta of [-1,0,1]){
   const state=progression.createSkillProgressionV3(199);state.skillRanks[id]=rank-1;
   const c={state,level:d.rankLevelRequirements[rank-1]+delta,skills:family.skillFamilyDefinitions,jobs:{}};
   const before=structuredClone(state),spent=progression.spentSkillPointsV3(state,c.skills),result=progression.purchaseSkillRankV3(c,id);
   if(delta<0){assert.equal(result.reason,'REQUIRES_LEVEL');assert.equal(result.requiredLevel,d.rankLevelRequirements[rank-1]);assert.deepEqual(state,before);}
   else {assert(result.ok);assert.equal(state.skillRanks[id],rank);assert.equal(progression.spentSkillPointsV3(state,c.skills)-spent,1);}
   evidence.push({scope:'PURE_SYNTHETIC_CONTEXT',id,rank,level:c.level,result});
  }
 });
 for(let rank=(id===ids[0]?2:1);rank<=d.maxRank;rank++)await test('ACTUAL Game legal purchase and reject '+d.name+' R'+rank,()=>{
  const g=fresh();buyPrior(g,id,rank);const gate=d.rankLevelRequirements[rank-1];
  if(gate>1){
   levelTo(g,gate-1);const before=semantic(g),oldHero=g.hero;
   const result=progression.canPurchaseSkillRank(ctx(g),id);
   assert.equal(result.reason,'REQUIRES_LEVEL');assert.equal(result.requiredLevel,gate);
   assert.equal(rules.canLearnSkill(id,g.hero).ok,false);assert.equal(rules.canLearnSkill(id,g.hero).reason,'Membutuhkan Level '+gate+'.');
   const view=presentation.skillNodePresentation(g.hero,id);
   assert.equal(view.purchase.requiredLevel,gate);
   if(rank>1){assert(view.labels.includes('LEARNED'));assert(view.active);assert.equal(rules.getSkillStatus(id,g.hero),'learned');assert(rules.activeSkills(g.hero).some(s=>s.id===id));}
   assert.equal(g.learnSkill(id),false);assert.notEqual(g.hero,oldHero);assert.deepEqual(semantic(g),before);
  }
  levelTo(g,Math.max(gate,2));const before=ledger(g);
  assert.equal(rules.canLearnSkill(id,g.hero).ok,true);assert.equal(presentation.skillNodePresentation(g.hero,id).purchase.ok,true);
  assert.equal(g.learnSkill(id),true);const afterLedger=ledger(g);
  assert.equal(afterLedger.ranks[id],rank);assert.equal(afterLedger.mirror[id],rank);
  assert.equal(afterLedger.available,before.available-1);assert.equal(afterLedger.spent,before.spent+1);
  assert.deepEqual(afterLedger.grants,before.grants);
  if(rank===d.maxRank){const b=semantic(g);assert.equal(progression.canPurchaseSkillRank(ctx(g),id).reason,'MAX_RANK');assert.equal(g.learnSkill(id),false);assert.deepEqual(semantic(g),b);assert(presentation.skillNodePresentation(g.hero,id).labels.includes('MAX RANK'));}
  else if(d.rankLevelRequirements[rank]>g.hero.level){const b=semantic(g);assert.equal(g.learnSkill(id),false);assert.deepEqual(semantic(g),b);}
  evidence.push({scope:'ACTUAL_GAME_OFFLINE_RENDER_STUBS',id,rank,before,after:afterLedger,next:progression.canPurchaseSkillRank(ctx(g),id)});
 });
}
await test('fresh free Quick grant and paid R1 insufficient SP; no fake grants',()=>{
 const g=fresh(),before=semantic(g);assert.equal(g.hero.skillLevels[ids[0]],1);assert.equal(g.hero.skillProgressionV3.grantedRanks[ids[0]],1);
 for(const id of ids.slice(1)){assert.equal(progression.canPurchaseSkillRank(ctx(g),id).reason,'INSUFFICIENT_SP');assert.equal(g.learnSkill(id),false);assert.deepEqual(semantic(g),before);}
});
await test('other-job variable gate and wrong-job/prerequisite priority',()=>{
 const d=family.skillFamilyDefinitions['v3-warrior-strike'],state=progression.createSkillProgressionV3(199);
 const c={state,level:17,skills:family.skillFamilyDefinitions,jobs:{}};assert.equal(progression.canPurchaseSkillRank(c,d.id).reason,'WRONG_JOB');
 state.chosenCoreJob='warrior';state.skillRanks[d.id]=1;
 assert.equal(progression.canPurchaseSkillRank(c,d.id).requiredLevel,18);c.level=18;assert(progression.purchaseSkillRankV3(c,d.id).ok);
 const sweep='v3-warrior-sweeping-slash';state.skillRanks[d.id]=0;
 assert.equal(progression.canPurchaseSkillRank(c,sweep).reason,'REQUIRES_SKILL');
});
await test('family variable gate, constant gate and missing rank fallback remain metadata driven',()=>{
 for(const spec of [
  {familyId:'mechanical-family',familyStage:'ROOT',familyRole:'ACTIVE',rankLevelRequirements:[1,3,6]},
  {rankLevelRequirements:[4,4,4]},
  {unlockLevel:5},
  {unlockLevel:5,rankLevelRequirements:[1]},
  {}
 ]){
  const d={id:'mechanical',name:'MECHANICAL FIXTURE',jobId:'adventurer',jobTier:'adventurer',skillType:'ACTIVE_DAMAGE',maxRank:3,spCostPerRank:1,...spec};
  for(let n=1;n<=3;n++){
   const state=progression.createSkillProgressionV3(199);state.skillRanks[d.id]=n-1;
   const gate=d.rankLevelRequirements?.[n-1]??d.unlockLevel??1,c={state,level:gate-1,skills:{[d.id]:d},jobs:{}};
   assert.equal(progression.canPurchaseSkillRank(c,d.id).reason,'REQUIRES_LEVEL');assert.equal(progression.canPurchaseSkillRank(c,d.id).requiredLevel,gate);
   c.level=gate;assert(progression.purchaseSkillRankV3(c,d.id).ok);
  }
 }
});
await test('actual passive family purchase through Game.learnPassive keeps cost and constant gate',()=>{
 const g=fresh();levelTo(g,15);for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])rules.unequipItem(g.hero,slot);
 assert(rules.chooseV3Thief(g.hero));const id='v3-thief-dagger-training',d=family.skillFamilyDefinitions[id];assert(d&&d.familyRole==='PASSIVE');
 const before=ledger(g);assert(g.learnPassive(id));assert(g.learnPassive(id));assert.equal(g.hero.skillProgressionV3.skillRanks[id],2);
 assert.equal(g.hero.skillPoints,before.available-2*d.spCostPerRank);
 evidence.push({scope:'ACTUAL_GAME_PASSIVE',id,before,after:ledger(g)});
});
await test('canonical mastery normal purchase respects its variable rank gate',()=>{
 const d=Object.values(family.skillFamilyDefinitions).find(d=>d.skillType==='MASTERY'&&d.rankLevelRequirements?.some(v=>v!==d.rankLevelRequirements[0]));
 assert(d,'existing variable mastery');
 const state=progression.createSkillProgressionV3(199);state.chosenCoreJob='warrior';state.chosenSpecialization=d.jobId;state.skillRanks[d.id]=1;
 const c={state,level:d.rankLevelRequirements[1]-1,skills:family.skillFamilyDefinitions,jobs:{}};
 assert.equal(progression.canPurchaseSkillRank(c,d.id).requiredLevel,d.rankLevelRequirements[1]);
 c.level++;assert(progression.purchaseSkillRankV3(c,d.id).ok);
 evidence.push({scope:'PURE_CANONICAL_MASTERY',id:d.id,gate:d.rankLevelRequirements[1]});
});
await test('actual Game mastery purchase rejects below R2 level without altering ownership',()=>{
 const g=fresh();levelTo(g,63);
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])rules.unequipItem(g.hero,slot);
 // Existing development promotion consumers; this is purchase proof, not trainer/quest UI proof.
 assert(rules.chooseV3Warrior(g.hero));assert(rules.chooseV3Berserker(g.hero));
 const id='v3-berserker-two-hand-mastery';assert(g.learnSkill(id));const before=semantic(g);
 assert.equal(progression.canPurchaseSkillRank(ctx(g),id).requiredLevel,64);
 assert.equal(g.learnSkill(id),false);assert.deepEqual(semantic(g),before);
 levelTo(g,64);const paid=ledger(g);assert(g.learnSkill(id));
 assert.equal(g.hero.skillProgressionV3.skillRanks[id],2);assert.equal(g.hero.skillPoints,paid.available-4);
 evidence.push({scope:'ACTUAL_GAME_MASTERY_PURCHASE',id,before:paid,after:ledger(g)});
});
await test('affected registry inventory is sourced from actual definitions; no catalog mutation',()=>{
 const definitions=Object.values(family.skillFamilyDefinitions);
 const affected=definitions.filter(d=>!d.familyId&&d.rankLevelRequirements?.some(v=>v!==d.rankLevelRequirements[0]))
  .map(d=>({id:d.id,name:d.name,job:d.jobId,type:d.skillType,gates:d.rankLevelRequirements}));
 const unchangedFamilies=definitions.filter(d=>d.familyId).length;
 assert(affected.some(d=>d.id===ids[0]));assert(affected.some(d=>d.job==='warrior'));
 fs.writeFileSync(path.join(output,'affected-definitions.json'),JSON.stringify({affected,unchangedFamilies,total:definitions.length},null,2),{flag:'wx'});
});

