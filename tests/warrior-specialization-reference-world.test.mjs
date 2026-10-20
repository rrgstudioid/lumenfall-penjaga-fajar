// Actual Game/rules/queue/HP/save consumers. DOM/WebGL/audio are OFFLINE render stubs.
// Forced RNG and enemy stats below are mechanical unit probes, never browser proof.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import * as T from 'three';
const output=process.env.SPECIALIZATION_CHECKPOINT;assert(output);
const oracle=JSON.parse(fs.readFileSync(new URL('./fixtures/warrior-specialization-approved-package.json',import.meta.url)));
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1280,clientHeight:720,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/specialization'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'offline-cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts');
const {Game}=await load('world'),rules=await load('rules'),items=await load('items'),{CITIES}=await load('regions');
const ref=await load('warrior-specialization-reference-v3');
const warrior=await load('warrior-v3'),berserker=await load('berserker-v3'),blade=await load('blade-master-v3');
const definitions={...warrior.WARRIOR_V3_SKILL_MAP,...berserker.BERSERKER_V3_SKILL_MAP,...blade.BLADE_MASTER_V3_SKILL_MAP};
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
let serial=0;const evidence=[];
function game(job,level,ranks={},activate=true) {
  storage.clear();const h=rules.createV3AdventurerHero('spec-'+(++serial));rules.saveCharacter(h,true);
  const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;g.actor.position.set(g.hero.x,0,g.hero.z);
  while(g.hero.level<15)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
  for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
  const npc=CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));assert(g.chooseCoreJob('warrior'));g.closeNpcMenu();
  while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
  // Original specialization transaction API; city travel/UI is tested separately.
  if(job!=='warrior')assert(job==='berserker'?rules.chooseV3Berserker(g.hero):rules.chooseV3BladeMaster(g.hero));
  const buy=(id,count)=>{const d=definitions[id];for(const p of d.prerequisiteSkills??[])buy(p.skillId,p.requiredRank);
    while((g.hero.skillLevels[id]??0)<count)assert(g.learnSkill(id),id+': '+JSON.stringify(rules.canLearnSkill(id,g.hero)));};
  for(const [id,count] of Object.entries(ranks).sort(([a],[b])=>Number(!!definitions[a].jobInvestmentRequirement)-Number(!!definitions[b].jobInvestmentRequirement)))buy(id,count);
  const template=job==='berserker'?'jayantara-two-hand-sword':'field-ironveil-mines-sword';
  const main=items.createItem(template,{id:'main-'+serial,sockets:[]});g.hero.inventory.push(main);assert(g.equipItem(main.id,'mainHand'));
  if(job==='blade_master'&&(g.hero.skillLevels['v3-blade-master-twin-blade-mastery']??0)>0){const off=items.createItem(template,{id:'off-'+serial});g.hero.inventory.push(off);assert(g.equipItem(off.id,'offHand'));}
  g.floats=[];g.float=(_p,text,kind)=>g.floats.push({text,kind});for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};
  if(activate){const r=job==='warrior'?g.enableDevelopmentWarriorReference({lifecycleRenewal:true}):g.enableDevelopmentWarriorSpecializationReference({lifecycleRenewal:true});assert(r.ok,JSON.stringify(r));}
  return g;
}
function target(g,{hp=10000,defense=70,evasion=0,x=0,z=-1}={}) {
  const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));group.position.copy(g.actor.position).add(new T.Vector3(x,0,z));
  const e={id:++serial,group,home:group.position.clone(),hp,max:hp,boss:false,dummy:false,spawnGeneration:0,respawnKey:'MECHANICAL-'+serial,definition:{defense,magicDefense:300},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion,marked:false,weakPoint:false};
  g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));g.faceTarget(e);return e;
}
function observe(g) {const calls=[],original=g.hurtEnemy.bind(g);g.hurtEnemy=(...args)=>{const hp=args[0].hp,r=original(...args);calls.push({raw:args[1],level:args[5],rounding:args[7],delta:hp-args[0].hp});return r;};return calls;}
function rng(g,u=.25,hit=0,crit=.99){let count=0;const draws=[];g.rand=()=>{const v=count++===0?u:count%2===0?hit:crit;draws.push(v);return v;};return draws;}
function advance(g,dt){for(const k of Object.keys(g.hero.activeBuffs)){g.hero.activeBuffs[k]=Math.max(0,g.hero.activeBuffs[k]-dt);if(!g.hero.activeBuffs[k])delete g.hero.activeBuffs[k];}g.stepSkillRuntime(dt);for(const k of Object.keys(g.skillCooldowns))g.skillCooldowns[k]=Math.max(0,g.skillCooldowns[k]-dt);}
function blocked(g){g.blocking=true;g.invincible=0;const original=g.rand;g.rand=()=>.99;g.hurtHero(10,'MECHANICAL_PHYSICAL_DIRECT');g.rand=original;g.blocking=false;assert.equal(g.defenseEvents.lastDefenseEvent.result,'blocked');}
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const family of oracle.families)for(const skill of family.skills)for(const row of skill.currentRows)await test('LEGAL '+skill.name+' R'+row.rank+' Lv'+row.candidateLevel,()=>{
  const ranks={...row.requiredPaidRanks};
  // Dual admission capability is legally purchased, not injected.
  if(family.jobId==='blade_master')ranks['v3-blade-master-twin-blade-mastery']=Math.max(1,ranks['v3-blade-master-twin-blade-mastery']??0);
  const g=game(family.jobId,row.candidateLevel,ranks);
  assert(g.allocateStatPoint('str'));assert(g.allocateStatPoint('dex'));
  const e=skill.hitContract.gameplayImpactsPerTarget?target(g):undefined,calls=observe(g);
  if(skill.id==='v3-berserker-breaker-entry'){const charge=target(g,{z:-5});blocked(g);assert(g.castSkill('v3-warrior-iron-charge'));g.enemies.splice(g.enemies.indexOf(charge),1);g.setCurrentTarget(e);}
  if(skill.id==='v3-blade-master-counterflow')blocked(g);
  if(skill.id==='v3-blade-master-tempo-drive'){
    const t=target(g);rng(g);assert(g.castSkill('v3-blade-master-twin-assault'));advance(g,.2);g.enemies.splice(g.enemies.indexOf(t),1);
  }
  calls.length=0;
  if(e){e.group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));g.setCurrentTarget(e);g.faceTarget(e);}
  const draws=rng(g),mana=g.hero.mana,seed=g.seed,passive=skill.sourceDefinition.skillType==='MASTERY';
  const meta=ref.specializationSkillMetadata(skill.id,row.rank);assert(meta);assert.equal(meta.gate,row.declaredGate);
  if(passive){assert.equal(g.castSkill(skill.id),false);assert.equal(g.hero.mana,mana);assert.equal(draws.length,0);}
  else {
    assert(g.castSkill(skill.id),JSON.stringify(g.getDevelopmentSpecializationResult()));
    const r=g.getDevelopmentSpecializationResult();assert.equal(r.rank,row.rank);assert.equal(r.level,row.candidateLevel);
    const mastery=ranks['v3-berserker-two-hand-mastery']??0;
    const reduced=family.jobId==='berserker'&&['v3-berserker-raging-cleave','v3-berserker-crushing-blow','v3-berserker-earth-splitter','v3-berserker-ruinous-arc','v3-berserker-fury-harvest','v3-berserker-trance'].includes(skill.id)?[0,2,4,6,8,10][mastery]:0;
    const bladeRank=ranks['v3-blade-master-twin-blade-mastery']??0;
    const bmReduced=family.jobId==='blade_master'&&['v3-blade-master-twin-assault','v3-blade-master-cross-sever','v3-blade-master-blade-tempest','v3-blade-master-tempo-drive'].includes(skill.id)?[0,0,2,4,6,8][bladeRank]:0;
    assert.equal(mana-g.hero.mana,Math.ceil(row.baseMana*(1-Math.max(reduced,bmReduced)/100)));
    assert.equal(g.skillCooldowns[skill.id],row.baseCooldown);
    if(e){
      const str=family.jobId==='berserker'?5:1,core=7+Math.floor(1.1*g.hero.level)+str,weapon=family.jobId==='berserker'?198:33;
      const weights=skill.id==='v3-blade-master-blade-tempest'
        ? (row.rank===1?[.25,.25,.25,.25,.75]:row.rank===2?[.28,.28,.28,.28,.88]:[.3,.3,.3,.3,1.05]).map(c=>c/row.coefficient)
        : skill.hitContract.sharedWeights??[1];
      r.sample.hits.forEach((hit,index)=>{const hand=skill.hitContract.hands?.[index]??'MAIN';const rawWeapon=hand==='BOTH'?weapon*1.5:hand==='OFF'?weapon*.5:weapon;close(hit.raw,(core+rawWeapon)*row.coefficient*weights[index]+(str*(row.bonusSTR??0)+(row.bonusDEX??0))*weights[index]);});
      advance(g,1);assert.equal(calls.length,skill.hitContract.gameplayImpactsPerTarget,JSON.stringify(r));
      calls.forEach((call,index)=>{assert.equal(call.rounding,'REFERENCE_B_FINAL');close(call.raw,r.sample.hits[index].raw);assert.equal(call.delta,Math.round(call.raw*(500+10*g.hero.level)/(570+10*g.hero.level)));});
      assert.equal(e.hp,10000-calls.reduce((sum,call)=>sum+call.delta,0));
    }else{assert.equal(draws.length,0);assert.equal(calls.length,0);}
    const paid=mana-g.hero.mana;assert(paid>0);const afterMana=g.hero.mana,afterHP=e?.hp;
    assert.equal(g.castSkill(skill.id),false);assert.equal(g.hero.mana,afterMana);assert.equal(e?.hp,afterHP);
    evidence.push({job:family.jobId,id:skill.id,rank:row.rank,level:g.hero.level,paid,cd:g.skillCooldowns[skill.id],raw:r.sample,impacts:calls,draws});
  }
  assert.equal(g.hero.skillProgressionV3.grantedRanks['v3-adventurer-quick-slash'],1);assert.equal(g.seed,seed);g.dispose();
});
for(const job of ['warrior','berserker','blade_master'])await test('Basic '+job+' equal budget fresh shared u, one impact/Hit/Crit',()=>{
  const g=game(job,job==='warrior'?15:60,job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1}:{}),e=target(g),calls=observe(g);
  let serialExpected=0;
  for(const u of [0,.25,.75]){
    const draws=rng(g,u);const r=g.attack();assert(r?.ok,JSON.stringify(r));assert.equal(draws.length,3);const core=7+Math.floor(g.hero.level*1.1)+(job==='berserker'?4:0);
    close(r.sample.totalRaw,core+(job==='berserker'?196+8*u:(32+4*u)*(job==='blade_master'?1.5:1)));
    assert.equal(r.sample.hits.length,1);assert.equal(r.execution.coefficientBudget,1);
    assert.equal(Number(r.execution.executionId.split(':').at(-1)),++serialExpected);
    const range=g.getDevelopmentAdventurerRange();assert(range.ok);assert.deepEqual(range.value.MAIN,r.execution.hits[0].attack);g.attackTimer=0;
  }
  assert.equal(calls.length,3);assert(e.hp<e.max);g.dispose();
});
for(const job of ['berserker','blade_master'])for(const d of warrior.WARRIOR_V3_SKILLS)await test('inherited '+job+' '+d.name+' paid, MAIN only',()=>{
  const g=game(job,80,{[d.id]:1,...(job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1}:{})});
  const e=d.targeting.targetType!=='self'?target(g):null,calls=observe(g);
  if(d.id==='v3-warrior-counter-slash')blocked(g);
  rng(g);assert(g.castSkill(d.id),JSON.stringify(g.getDevelopmentSpecializationResult()));
  const result=g.getDevelopmentSpecializationResult();
  if(e){assert.equal(result.execution.mode,'SINGLE_MAIN');assert(!result.execution.weaponRanges.OFF);assert(calls.length===1);}
  else{assert.equal(calls.length,0);assert(g.getDevelopmentSpecializationAvailability().ok);}
  g.dispose();
});
for(const family of oracle.families)await test('full '+family.jobId+' specialization plus minimal legal ancestry, not Warrior122+149',()=>{
  const ranks={};for(const s of family.skills)for(const [id,rank] of Object.entries(s.currentRows.at(-1).requiredPaidRanks))ranks[id]=Math.max(ranks[id]??0,rank);
  const g=game(family.jobId,80,ranks);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,199);assert.equal(g.hero.skillPoints,family.jobId==='berserker'?24:16);assert(g.getDevelopmentSpecializationAvailability().ok);g.dispose();
});
await test('Iron Blood added DR, max-resource no refill and original expiry clamp',()=>{
  const g=game('berserker',80,{'v3-berserker-iron-blood':5});g.rand=()=>.99;g.hurtHero(100,'MECHANICAL');
  const hp=g.hero.hp,base=rules.derivedStats(g.hero);assert(g.castSkill('v3-berserker-iron-blood'));const buff=rules.derivedStats(g.hero);
  assert.equal(g.hero.hp,hp);assert.equal(buff.damageReduction,base.damageReduction+5);assert(buff.maxHP>base.maxHP);
  assert(g.getDevelopmentSpecializationAvailability().ok);advance(g,12);assert.equal(rules.derivedStats(g.hero).maxHP,base.maxHP);assert.equal(g.hero.hp,hp);assert(g.getDevelopmentSpecializationAvailability().ok);g.dispose();
});
await test('Trance named scope, own cap, unique-target Frenzy independent incoming group and Fury clamp',()=>{
  const g=game('berserker',80,{'v3-berserker-trance':3,'v3-berserker-raging-cleave':3,'v3-berserker-fury-harvest':1});
  const targets=[target(g,{x:-1}),target(g),target(g,{x:1})];g.rand=()=>.99;g.hurtHero(200,'MECHANICAL');const hp=g.hero.hp,DR=rules.derivedStats(g.hero).damageReduction;
  assert(g.castSkill('v3-berserker-trance'));assert(g.getDevelopmentSpecializationAvailability().ok);
  g.direction.set(0,0,-1);rng(g);assert(g.castSkill('v3-berserker-raging-cleave'));assert.equal(g.transientCombat.frenzyGuard.reductionPercent,6);assert.equal(rules.derivedStats(g.hero).damageReduction,DR);
  const r=g.getDevelopmentSpecializationResult();assert.equal(r.execution.coefficientBudget,1.05);assert(targets.every(t=>t.hp<t.max));
  rng(g);assert(g.castSkill('v3-berserker-fury-harvest'));const expected=Math.round(rules.maxHP(g.hero)*.006*3);assert.equal(g.hero.hp,Math.min(rules.maxHP(g.hero),hp+expected));g.dispose();
});
await test('Earth four independent landings, last-only Major, target reacquisition and immune no Major draw',()=>{
  const g=game('berserker',80,{'v3-berserker-earth-splitter':5}),a=target(g),calls=observe(g);let draws=0;g.rand=()=>{draws++;return .01;};
  assert(g.castSkill('v3-berserker-earth-splitter'));assert.equal(calls.length,1);assert.equal(draws,3);close(a.stunState.expiresAt,.1);
  advance(g,.18);assert.equal(calls.length,2);assert.equal(draws,5);close(a.stunState.expiresAt,.28);
  const b=target(g,{x:1});advance(g,.18);assert.equal(calls.length,4);assert.equal(draws,9);assert(b.hp<b.max);
  b.stunImmune=true;advance(g,.18);assert.equal(calls.length,6);assert.equal(draws,14);close(a.stunState.expiresAt,2.04);assert(!b.stunState||b.stunState.expiresAt<g.combatTime);g.dispose();
});
await test('Flow/Tempo per cast, Drive commit/shared source and expiry',()=>{
  const g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':5,'v3-blade-master-twin-assault':4,'v3-blade-master-tempo-drive':2});
  target(g);rng(g);assert(g.castSkill('v3-blade-master-twin-assault'));advance(g,.18);assert.equal(g.transientCombat.tempoCount(g.combatTime),1);
  const before=rules.derivedStats(g.hero),mana=g.hero.mana;assert(g.castSkill('v3-blade-master-tempo-drive'));assert.equal(g.transientCombat.tempoCount(g.combatTime),0);
  assert.equal(mana-g.hero.mana,Math.ceil(15*.92));assert(g.getDevelopmentSpecializationAvailability().ok);
  assert(rules.derivedStats(g.hero).attackSpeed>before.attackSpeed);advance(g,6);assert(g.getDevelopmentSpecializationAvailability().ok);
  assert.equal(rules.derivedStats(g.hero).attackSpeed,before.attackSpeed);g.dispose();
});
await test('Counterflow private original receipt; consumed on commitment even Evade; forged generic record rejected',()=>{
  const id='v3-blade-master-counterflow',g=game('blade_master',80,{[id]:1,'v3-blade-master-twin-blade-mastery':1}),e=target(g,{evasion:50}),mana=g.hero.mana;
  g.defenseEvents.record(g.hero,true,g.combatTime*1000,'FORGED_GENERIC');assert.equal(g.castSkill(id),false);assert.equal(g.hero.mana,mana);
  blocked(g);g.rand=(()=>{const values=[.25,.99];let i=0;return()=>values[i++];})();assert(g.castSkill(id));assert.equal(e.hp,e.max);assert.equal(g.defenseEvents.lastDefenseEvent.consumed,true);
  advance(g,10);assert.equal(g.castSkill(id),false);g.dispose();
});
for(const job of ['berserker','blade_master'])await test('pure read, legal clone renewal, rejection, stale source and new Game/load OFF '+job,()=>{
  const ranks=job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1,'v3-blade-master-twin-assault':1}:{'v3-berserker-crushing-blow':1};
  const g=game(job,80,ranks);target(g);const before=JSON.stringify(g.hero),seed=g.seed,queue=g.skillHits.size,cd=JSON.stringify(g.skillCooldowns);
  for(let i=0;i<20;i++){assert(g.getDevelopmentAdventurerRange().ok);for(const s of oracle.families.find(f=>f.jobId===job).skills)g.getDevelopmentAdventurerSkillMetadata(s.id);}
  assert.equal(JSON.stringify(g.hero),before);assert.equal(g.seed,seed);assert.equal(g.skillHits.size,queue);assert.equal(JSON.stringify(g.skillCooldowns),cd);
  assert(g.allocateStatPoint('str'));assert(g.getDevelopmentSpecializationAvailability().ok);
  const identity=g.hero;assert.equal(g.learnSkill('not-a-skill'),false);assert.equal(g.hero,identity);assert(g.getDevelopmentSpecializationAvailability().ok);
  const main=g.hero.equipment.mainHand;assert(g.unequipItem('mainHand'));assert(!g.getDevelopmentSpecializationAvailability().ok);assert(g.equipItem(main,'mainHand'));assert(g.getDevelopmentSpecializationAvailability().ok);
  rng(g);assert(g.attack()?.ok);g.save();const slot=g.hero.slotId,stored=JSON.stringify(g.hero.skillProgressionV3);g.dispose();
  const next=new Game(element(),element(),element(),()=>{},()=>{},slot);next.started=true;assert.equal(next.getDevelopmentSpecializationAvailability(),null);assert.equal(JSON.stringify(next.hero.skillProgressionV3),stored);assert.equal(next.hero.equipment.mainHand,main);next.dispose();
});
await test('Jayantara old/new normalization and preserved NPC price',async()=>{
  const services=await load('city-services'),range=await load('jayantara-range-v3');
  const fresh=items.createItem('jayantara-two-hand-sword',{id:'new-version',sockets:[]});assert.equal(fresh.levelRequirement,45);assert(range.jayantaraAuthoredRange(fresh));
  assert.equal(services.shopItemPrice(fresh,'equipment'),140);
  const old={...structuredClone(fresh),id:'old-version',levelRequirement:24,enhancementLevel:6};delete old.authoredAttackVersion;
  const loaded=items.normalizeItem(old);assert.equal(loaded.id,'old-version');assert.equal(loaded.levelRequirement,24);assert.equal(loaded.enhancementLevel,6);assert.equal(loaded.baseStats.attack,46);assert.equal(loaded.baseStats.str,4);assert.equal(range.jayantaraAuthoredRange(loaded),null);
  const missing={...old};delete missing.levelRequirement;assert.equal(items.normalizeItem(missing).levelRequirement,24);
  const roundtrip=items.normalizeItem(JSON.parse(JSON.stringify(fresh)));assert(range.jayantaraAuthoredRange(roundtrip));assert.equal(roundtrip.id,fresh.id);
});
await test('Flow survives first Evade and is consumed once at second landed hit, Tempo once',()=>{
  const g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':1,'v3-blade-master-twin-assault':1,'v3-blade-master-blade-rush':1}),e=target(g,{evasion:50});
  rng(g);assert(g.castSkill('v3-blade-master-blade-rush'));assert(g.transientCombat.bladeFlowActive(g.combatTime));
  const values=[.25,.99,0,.99];let index=0;g.rand=()=>values[index++];assert(g.castSkill('v3-blade-master-twin-assault'));assert(g.transientCombat.bladeFlowActive(g.combatTime));
  advance(g,.18);assert(!g.transientCombat.bladeFlowActive(g.combatTime));assert.equal(g.transientCombat.tempoCount(g.combatTime),1);assert(e.hp<e.max);g.dispose();
});
await test('Tempest coefficient-share weights, own3 Tempo snapshot, last Crit and first-success consume',()=>{
  const g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':3,'v3-blade-master-twin-assault':2,'v3-blade-master-blade-tempest':1}),e=target(g);
  for(let n=0;n<3;n++){rng(g);assert(g.castSkill('v3-blade-master-twin-assault'));advance(g,.18);if(n<2)advance(g,4.4);}
  assert.equal(g.transientCombat.tempoCount(g.combatTime),3);const calls=observe(g),values=[.25,0,.99,0,.99,0,.99,0,.99,0,0];let index=0;g.rand=()=>values[index++];
  assert(g.castSkill('v3-blade-master-blade-tempest'));const r=g.getDevelopmentSpecializationResult();assert.equal(g.transientCombat.tempoCount(g.combatTime),0);
  advance(g,.72);assert.equal(calls.length,5);
  for(let i=0;i<5;i++){close(r.execution.hits[i].weight,[.25,.25,.25,.25,.75][i]/1.75);close(calls[i].raw,r.sample.hits[i].raw*(i===4?1.1*1.5:1));}
  assert(e.hp<e.max);g.dispose();
});
await test('queued frozen attacker budget with live target defense; replaced Hero cancels remaining hits',()=>{
  const ranks={'v3-blade-master-twin-blade-mastery':1,'v3-blade-master-twin-assault':1};
  const g=game('blade_master',80,ranks),e=target(g),calls=observe(g);rng(g);assert(g.castSkill('v3-blade-master-twin-assault'));const r=g.getDevelopmentSpecializationResult();
  e.definition.defense=7000;g.hero.allocatedStats.str=5;g.hero.statPoints-=5;advance(g,.18);
  assert.equal(calls.length,2);close(calls[1].raw,r.sample.hits[1].raw);assert.equal(calls[1].delta,Math.round(r.sample.hits[1].raw*1300/8300));g.dispose();
  const next=game('blade_master',80,ranks),t=target(next),hits=observe(next);rng(next);assert(next.castSkill('v3-blade-master-twin-assault'));assert(next.allocateStatPoint('dex'));advance(next,.18);assert.equal(hits.length,1);assert(t.hp<t.max);next.dispose();
});
for(const outcome of ['Crit','Evade','Lethal'])await test('actual '+outcome+' selected Berserker HP/feedback and lethal once',()=>{
  const id='v3-berserker-crushing-blow',g=game('berserker',80,{[id]:1}),e=target(g,{hp:outcome==='Lethal'?1:10000,evasion:outcome==='Evade'?50:0}),calls=observe(g);
  if(outcome==='Lethal')delete e.definition;
  const values=outcome==='Evade'?[.25,.99]:[.25,0,outcome==='Crit'?0:.99];let n=0;g.rand=()=>values[n++]??.99;
  const mana=g.hero.mana;assert(g.castSkill(id));assert.equal(mana-g.hero.mana,14);
  if(outcome==='Evade'){assert.equal(e.hp,10000);assert.equal(calls.length,0);assert(g.floats.some(f=>f.text==='EVADE'));}
  else{const r=g.getDevelopmentSpecializationResult(),raw=r.sample.totalRaw*(outcome==='Crit'?1.5:1);close(calls[0].raw,raw);assert.equal(e.hp,outcome==='Lethal'?0:10000-Math.round(raw*1300/1370));assert.equal(calls.length,1);}
  g.dispose();
});
for(const job of ['berserker','blade_master'])await test('death/respawn, cooldown safety and legal original travel '+job,async()=>{
  const id=job==='berserker'?'v3-berserker-crushing-blow':'v3-blade-master-twin-assault';
  const g=game(job,80,{[id]:1,...(job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1}:{})});target(g);rng(g);assert(g.castSkill(id));const cd=g.skillCooldowns[id];
  g.invincible=0;g.rand=()=>.99;g.hurtHero(1e9,'MECHANICAL_LETHAL');assert(g.dead);assert(!g.getDevelopmentSpecializationAvailability().ok);assert.equal(g.castSkill(id),false);
  g.respawn();assert(g.getDevelopmentSpecializationAvailability().ok);assert.equal(g.skillCooldowns[id],cd);assert.equal(g.castSkill(id),false);
  g.waitForRegionLoads=async()=>{};assert(g.changeRegion('verdant-plains-v2'));assert(!g.getDevelopmentSpecializationAvailability().ok);await new Promise(r=>setImmediate(r));assert(g.getDevelopmentSpecializationAvailability().ok);
  assert(g.changeRegion('arunika'));await new Promise(r=>setImmediate(r));assert(g.getDevelopmentSpecializationAvailability().ok);assert.equal(g.skillCooldowns[id],cd);g.dispose();
});
for(const kind of ['oldJayantara','oldIron','bonus','primaryBudget','ledger','job','duplicateItem','forgedClone'])await test('negative mechanical admission '+kind+' rejects without RNG/cost/impact',()=>{
  const bm=kind==='oldIron'||kind==='duplicateItem',job=bm?'blade_master':'berserker',id=bm?'v3-blade-master-twin-assault':'v3-berserker-crushing-blow';
  const g=game(job,80,{[id]:1,...(bm?{'v3-blade-master-twin-blade-mastery':1}:{})});target(g);
  if(kind==='oldJayantara'||kind==='oldIron'||kind==='bonus'){
    const main=g.hero.equipment.mainHand;g.hero.inventory=g.hero.inventory.map(i=>i.id!==main?i:{...i,...(kind==='bonus'?{bonusStats:{...i.bonusStats,attack:5}}:{authoredAttackVersion:undefined,levelRequirement:bm?8:24})});
  }
  if(kind==='primaryBudget')g.hero.statPoints++;
  if(kind==='ledger')g.hero.skillPoints++;
  if(kind==='job')g.hero.specialization='rogue';
  if(kind==='duplicateItem')g.hero.inventory.push({...g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand)});
  if(kind==='forgedClone')g.hero=structuredClone(g.hero);
  const before=JSON.stringify(g.hero),cd=JSON.stringify(g.skillCooldowns),queue=g.skillHits.size;let draws=0;g.rand=()=>{draws++;return .25;};
  assert(!g.getDevelopmentSpecializationAvailability().ok);assert.equal(g.castSkill(id),false);assert.equal(draws,0);assert.equal(JSON.stringify(g.hero),before);assert.equal(JSON.stringify(g.skillCooldowns),cd);assert.equal(g.skillHits.size,queue);g.dispose();
});
await test('post-draw same-ID item replacement rejects, consumes attempted sample only and never falls back',()=>{
  const id='v3-berserker-crushing-blow',g=game('berserker',80,{[id]:1});target(g);let draws=0;
  const mana=g.hero.mana;g.rand=()=>{draws++;const main=g.hero.equipment.mainHand;g.hero.inventory=g.hero.inventory.map(i=>i.id===main?{...i}:i);return .25;};
  assert.equal(g.castSkill(id),false);assert.equal(draws,1);assert.equal(g.hero.mana,mana);assert.equal(g.skillHits.size,0);assert.equal(g.skillCooldowns[id]??0,0);g.dispose();
});
for(const job of ['warrior','berserker','blade_master'])await test('Basic retains own Battle Cry once after RAW, and read-only range does not spend execution serial '+job,()=>{
  const g=game(job,job==='warrior'?61:80,{'v3-warrior-battle-cry':1,...(job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1}:{})}),e=target(g),calls=observe(g);
  assert(g.castSkill('v3-warrior-battle-cry'));rng(g);const result=g.attack();assert(result?.ok);assert.equal(result.execution.coefficientBudget,1);close(calls[0].raw,result.sample.totalRaw*1.03);
  assert.equal(calls[0].delta,Math.round(result.sample.totalRaw*1.03*(500+10*g.hero.level)/(570+10*g.hero.level)));assert(e.hp<e.max);g.dispose();
});
await test('Basic rejects target replacement and pause during the single attack sample without impact',()=>{
  for(const change of ['target','pause']){
    const g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':1}),a=target(g),b=target(g,{x:1}),hp=a.hp;let draws=0;g.setCurrentTarget(a);
    g.rand=()=>{draws++;if(change==='target')g.setCurrentTarget(b);else g.paused=true;return .25;};
    const result=g.attack();assert.equal(result.ok,false);assert.equal(draws,1);assert.equal(a.hp,hp);assert.equal(b.hp,b.max);assert.equal(g.attackTimer,0);g.dispose();
  }
});
for(const job of ['warrior','berserker','blade_master'])await test('selected Mana/availability reads never invoke legacy RNG or create an execution '+job,()=>{
  const id=job==='warrior'?'v3-warrior-strike':job==='berserker'?'v3-berserker-crushing-blow':'v3-blade-master-twin-assault';
  const g=game(job,job==='warrior'?61:80,{[id]:1,...(job==='blade_master'?{'v3-blade-master-twin-blade-mastery':1}:{})}),before=JSON.stringify(g.hero),seed=g.seed,original=Math.random;
  try {Math.random=()=>{throw Error('Any RNG is forbidden during selected pure resource read');};for(let n=0;n<20;n++){assert.equal(g.getSkillManaCost(id),job==='warrior'?5:job==='berserker'?14:10);assert(g.canCastSkill(id).ok);assert(g.getDevelopmentAdventurerRange().ok);}}
  finally{Math.random=original;}
  assert.equal(JSON.stringify(g.hero),before);assert.equal(g.seed,seed);target(g);rng(g);const basic=g.attack();assert(basic.ok);assert.equal(Number(basic.execution.executionId.split(':').at(-1)),1);g.dispose();
});
await test('OFF actor travel and canceled/failed original transition cannot create policy',async()=>{
  const g=game('berserker',80,{},false);g.waitForRegionLoads=async()=>{};assert(g.changeRegion('averion'));await new Promise(r=>setImmediate(r));assert.equal(g.getDevelopmentSpecializationAvailability(),null);g.dispose();
  const active=game('berserker',80,{});let release;active.waitForRegionLoads=()=>new Promise(resolve=>release=resolve);assert(active.changeRegion('averion'));assert.equal(active.changeRegion('arunika'),false);assert(!active.getDevelopmentSpecializationAvailability().ok);active.dispose();release();await new Promise(r=>setImmediate(r));assert(!active.getDevelopmentSpecializationAvailability().ok);
  const failed=game('berserker',80,{});failed.waitForRegionLoads=async()=>{throw Error('MECHANICAL_LOAD_FAILURE');};assert(failed.changeRegion('averion'));await new Promise(r=>setImmediate(r));assert(failed.regionLoadError);assert(!failed.getDevelopmentSpecializationAvailability().ok);
  failed.waitForRegionLoads=async()=>{};assert(failed.retryLocationLoad());await new Promise(r=>setImmediate(r));assert(!failed.getDevelopmentSpecializationAvailability().ok);failed.dispose();
});
await test('synthetic ultimate rank cannot self-fund the original 18 SP first-purchase investment gate',()=>{
  const g=game('berserker',80,{'v3-berserker-two-hand-mastery':3},false),id='v3-berserker-trance';
  // Negative imported state only; positive rank proofs above use original purchases.
  g.hero.skillProgressionV3.skillRanks[id]=1;g.hero.skillLevels[id]=1;g.hero.skillPoints-=5;
  const before=JSON.stringify(g.hero),result=g.enableDevelopmentWarriorSpecializationReference({lifecycleRenewal:true});
  assert.equal(result.ok,false);assert.equal(result.code,'JOB_INVESTMENT_REQUIREMENT');assert.equal(JSON.stringify(g.hero),before);g.dispose();
});
await test('original Jayantara NPC purchase/equip 44 rejection then 45 acceptance, mixed old/new real save load',()=>{
  const g=game('warrior',44,{},false),npc=CITIES.arunika.npcList.find(n=>n.service==='equipment');
  g.hero.gold=2000; // Mechanical funding only; original purchase owns the new instance.
  g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
  assert(g.npcBuy('jayantara-two-hand-sword',1));
  const fresh=g.hero.inventory.find(i=>i.templateId==='jayantara-two-hand-sword');assert(fresh);assert.equal(fresh.levelRequirement,45);assert.equal(g.hero.gold,1860);
  const old=items.normalizeItem({...structuredClone(fresh),id:'grandfather-mixed',authoredAttackVersion:undefined,levelRequirement:24,enhancementLevel:6});
  g.hero.inventory.push(old);const before=JSON.stringify(g.hero);assert.equal(g.equipItem(fresh.id,'mainHand'),false);assert.equal(JSON.stringify(g.hero),before);
  assert(g.equipItem(old.id,'mainHand'));assert(g.unequipItem('mainHand'));assert.equal(rules.gainXP(g.hero,rules.xpNeeded(44)),1);assert.equal(g.hero.level,45);assert(g.equipItem(fresh.id,'mainHand'));
  g.save();const slot=g.hero.slotId,paid=g.hero.skillPoints;g.dispose();const next=new Game(element(),element(),element(),()=>{},()=>{},slot);next.started=true;
  const savedOld=next.hero.inventory.find(i=>i.id===old.id),savedNew=next.hero.inventory.find(i=>i.id===fresh.id);
  assert.equal(savedOld.levelRequirement,24);assert.equal(savedOld.enhancementLevel,6);assert.equal(savedOld.authoredAttackVersion,undefined);assert.equal(savedNew.levelRequirement,45);assert.equal(savedNew.authoredAttackVersion,'JAYANTARA_LV45_BASE_V1');assert.equal(next.hero.equipment.mainHand,savedNew.id);assert.equal(next.hero.skillPoints,paid);assert.equal(next.getDevelopmentSpecializationAvailability(),null);next.dispose();
});
for(const owner of ['own','foreign','expired'])await test('Ruinous payoff only own active original Armor Break: '+owner,async()=>{
  const id='v3-berserker-ruinous-arc',g=game('berserker',80,{[id]:1}),e=target(g),calls=observe(g);rng(g);
  if(owner==='own'){assert(g.castSkill('v3-warrior-armor-breaker'));assert(e.sourceOwnedStatuses.defenseDown.some(s=>s.sourceActorId===g.hero.characterId));}
  else {const status=await load('combat-status');status.applySourceOwnedStatus(e,'armor_break',{sourceActorId:owner==='foreign'?'OTHER_ACTOR':g.hero.characterId,sourceSkillId:'v3-warrior-armor-breaker',strength:20,appliedAt:owner==='expired'?-20:g.combatTime,duration:10});}
  calls.length=0;rng(g);g.faceTarget(e);assert(g.castSkill(id));const result=g.getDevelopmentSpecializationResult();close(calls[0].raw,result.sample.totalRaw*(owner==='own'?1.08:1));g.dispose();
});
after(async()=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'rank-results.json'),JSON.stringify(evidence,null,2));await server.close();});
await test('lawful Blade Master OFF removal uses single MAIN Basic, valid re-equip restores combined without CD reset',()=>{
  const id='v3-blade-master-twin-assault',g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':1,[id]:1}),e=target(g),off=g.hero.equipment.offHand;
  rng(g);assert(g.castSkill(id));advance(g,.18);const cd=g.skillCooldowns[id];
  assert(g.unequipItem('offHand'));assert(g.getDevelopmentSpecializationAvailability().ok);rng(g);const single=g.attack();assert(single.ok);close(single.sample.totalRaw,95+33);assert.equal(single.sample.hits.length,1);assert.equal(g.skillCooldowns[id],cd);
  assert(g.equipItem(off,'offHand'));assert(g.getDevelopmentSpecializationAvailability().ok);assert.equal(g.skillCooldowns[id],cd);assert.equal(g.castSkill(id),false);assert(g.getDevelopmentAdventurerRange().ok);assert.equal(g.getDevelopmentAdventurerRange().value.MAIN.min,143);assert(e.hp<e.max);g.dispose();
});
for(const malformed of ['unknownVersion','contradictoryRequirement','enhancement'])await test('fresh admission rejects malformed authored Jayantara '+malformed,()=>{
  const g=game('berserker',80,{},false),item=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);
  if(malformed==='unknownVersion')item.authoredAttackVersion='UNKNOWN';
  if(malformed==='contradictoryRequirement')item.levelRequirement=24;
  if(malformed==='enhancement')item.enhancementLevel=1;
  const before=JSON.stringify(g.hero);let draws=0;g.rand=()=>{draws++;return .25;};
  const result=g.enableDevelopmentWarriorSpecializationReference({lifecycleRenewal:true});assert.equal(result.ok,false);assert.equal(draws,0);assert.equal(JSON.stringify(g.hero),before);assert(!g.getDevelopmentSpecializationAvailability().ok);g.dispose();
});
await test('same-ID OFF object replacement during original travel cannot inherit transaction intent',async()=>{
  const g=game('blade_master',80,{'v3-blade-master-twin-blade-mastery':1});let release;
  g.waitForRegionLoads=()=>new Promise(resolve=>release=resolve);assert(g.changeRegion('verdant-plains-v2'));assert(!g.getDevelopmentSpecializationAvailability().ok);
  const off=g.hero.equipment.offHand;g.hero.inventory=g.hero.inventory.map(i=>i.id===off?{...i}:i);
  release();await new Promise(r=>setImmediate(r));assert(!g.getDevelopmentSpecializationAvailability().ok);g.dispose();
});
