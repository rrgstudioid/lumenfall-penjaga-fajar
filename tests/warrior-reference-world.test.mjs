// Actual Game combat/progression/lifecycle; only rendering/audio/DOM are OFFLINE stubs.
// Enemy numeric and forced RNG probes are MECHANICAL; they are not balance approval.
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createServer} from 'vite';import * as T from 'three';
const output=process.env.WARRIOR_REFERENCE_CHECKPOINT;assert(output);
// Exact historical oracle copy; provenance and SHA256: docs/gameplay-authority/PROVENANCE.json.
const packageInput=JSON.parse(fs.readFileSync(new URL('./fixtures/warrior-final-input-package.json',import.meta.url),'utf8'));
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/warrior-reference'},addEventListener(){},removeEventListener(){},dispatchEvent(){}},CustomEvent:class{},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:core-three')return '\0core-three';},load(id){if(id==='\0core-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:core-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items'),{CITIES}=await load('regions'),reference=await load('warrior-reference-v3'),status=await load('combat-status'),{WARRIOR_V3_RUNTIME_MAP}=await load('warrior-v3'),presentation=await load('skill-presentation-v3');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const {WARRIOR_V3_SKILL_MAP:definitionMap}=await load('warrior-v3');
const evidence=[];let serial=0;
function game(level=15,ranks={},optIn=true) {
 storage.clear();const h=rules.createV3AdventurerHero('warrior-approved-'+(++serial));rules.saveCharacter(h,true);
 const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;g.actor.position.set(g.hero.x,0,g.hero.z);
 while(g.hero.level<15)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(const slot of Object.keys(g.hero.equipment))if(g.hero.equipment[slot])assert(g.unequipItem(slot));
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core');g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));assert(g.chooseCoreJob('warrior'));g.closeNpcMenu();
 while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 const buy=(id,count)=>{for(const p of definitionMap[id]?.prerequisiteSkills??[])buy(p.skillId,p.requiredRank);while((g.hero.skillLevels[id]??0)<count)assert(g.learnSkill(id),id+': '+JSON.stringify(rules.canLearnSkill(id,g.hero)));};
 for(const [id,count] of Object.entries(ranks))buy(id,count);
 const sword=items.createItem('field-ironveil-mines-sword',{id:g.hero.slotId+'-iron'});g.hero.inventory.push(sword);assert(g.equipItem(sword.id,'mainHand'));assert.notEqual(g.hero.inventory.find(i=>i.id===sword.id),sword);
 g.floats=[];g.float=(_p,text,kind)=>g.floats.push({text,kind});for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};
 if(optIn){const enabled=g.enableDevelopmentWarriorReference({lifecycleRenewal:true});assert(enabled.ok,JSON.stringify(enabled));}
 return g;
}
function target(g,{defense=70,hp=10000,evasion=0,x=0,z=-1}={}) {
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));group.position.copy(g.actor.position).add(new T.Vector3(x,0,z));
 const e={id:++serial,group,home:group.position.clone(),hp,max:hp,boss:false,dummy:false,spawnGeneration:0,respawnKey:'MECHANICAL-'+serial,definition:{defense,magicDefense:300},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion,marked:false,weakPoint:false};
 g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));g.faceTarget(e);return e;
}
function rng(g,values){const draws=[];g.rand=()=>{const v=values[draws.length];assert(draws.length<values.length,'unexpected combat RNG');draws.push(v);if(v instanceof Error)throw v;return v;};return draws;}
function ledger(g){const calls=[],original=g.hurtEnemy.bind(g);g.hurtEnemy=(...args)=>{const hp=args[0].hp,result=original(...args);calls.push({raw:args[1],attackerLevel:args[5],policy:args[7],delta:hp-args[0].hp,result});return result;};return calls;}
function before(g){return {hero:JSON.stringify(g.hero),seed:g.seed,cd:{...g.skillCooldowns},queue:g.skillHits.size,position:g.actor.position.toArray(),direction:g.direction.toArray(),lock:g.actionLock.active(g.combatTime)};}
function cast(g,id){const saved=Math.random;Math.random=()=>{if(new Error().stack.includes('resolveSkillAction')&&!new Error().stack.includes('Game.snapshot'))throw Error('legacy combat RNG forbidden');return saved();};try{const ok=g.castSkill(id),r=g.getDevelopmentWarriorResult();assert.equal(ok,r.ok);return r;}finally{Math.random=saved;}}
function advance(g,dt){g.stepSkillRuntime(dt);for(const k of Object.keys(g.hero.activeBuffs)){g.hero.activeBuffs[k]=Math.max(0,g.hero.activeBuffs[k]-dt);if(!g.hero.activeBuffs[k])delete g.hero.activeBuffs[k];}for(const k of Object.keys(g.skillCooldowns))g.skillCooldowns[k]=Math.max(0,g.skillCooldowns[k]-dt);}
function blocked(g){g.blocking=true;g.invincible=0;const save=g.rand;g.rand=()=>.99;g.hurtHero(10,'MECHANICAL_PHYSICAL_DIRECT');g.rand=save;g.blocking=false;assert.equal(g.defenseEvents.lastDefenseEvent.result,'blocked');}
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const skill of packageInput.skills)for(const row of skill.ranks)await test('LEGAL '+skill.name+' R'+row.rank+' at Lv'+row.cohort.level,()=>{
 const g=game(row.cohort.level,row.cohort.ranks),e=row.hitCountPerTarget?target(g):undefined,calls=ledger(g);
 if(skill.id==='v3-warrior-counter-slash')blocked(g);
 const draw=rng(g,e?[.25,0,.99]:[]),prior=before(g),r=cast(g,skill.id);assert(r.ok,JSON.stringify(r));
 assert.equal(r.rank,row.rank);assert.equal(r.level,row.cohort.level);assert.equal(g.hero.mana,JSON.parse(prior.hero).mana-row.mana);assert.equal(g.skillCooldowns[skill.id],row.baseCooldown);
 assert.equal(g.hero.skillPoints,row.cohort.availableSP);assert.equal(g.hero.skillProgressionV3.totalEarnedSP,row.cohort.earnedSP);assert.equal(g.hero.statPoints,row.cohort.unspentPrimary);
 assert.equal(g.hero.skillProgressionV3.grantedRanks['v3-adventurer-quick-slash'],1);
 if(e){const raw=(7+Math.floor(1.1*row.cohort.level)+33)*row.coefficientTotal;close(r.sample.totalRaw,raw);assert.equal(draw.length,3);assert.equal(calls.length,1);assert.equal(calls[0].attackerLevel,row.cohort.level);assert.equal(calls[0].policy,'REFERENCE_B_FINAL');
 const payoff=skill.id==='v3-warrior-counter-slash'?1+[15,18,22,26,30][row.rank-1]/100:1;const expected=Math.round(raw*payoff*(500+10*row.cohort.level)/(570+10*row.cohort.level));assert.equal(calls[0].delta,expected);assert(g.floats.some(f=>f.kind==='damage'&&f.text===String(expected)));
 }else{assert.equal(draw.length,0);assert.equal(calls.length,0);assert.equal(g.hero.activeBuffs[skill.id],row.effects.duration??row.effects.temporaryBuffs[0].duration);assert(g.getDevelopmentWarriorAvailability().ok);}
 const current=before(g);assert.equal(cast(g,skill.id).ok,false);assert.deepEqual(before(g),current);assert.equal(draw.length,e?3:0);
 const ui=presentation.resolveSkillPresentation(g.hero,awaitDefinition(skill.id),WARRIOR_V3_RUNTIME_MAP[skill.id],reference.warriorReferenceSkillMetadata(skill.id,row.rank));assert.equal(ui.isDamage,!!e);assert(!ui.damage.some(r=>r.label==='Base Damage'));evidence.push({case:'RANK',id:skill.id,rank:row.rank,level:g.hero.level,ledger:{earned:g.hero.skillProgressionV3.totalEarnedSP,available:g.hero.skillPoints},result:r,draws:draw,calls,feedback:g.floats});g.dispose();
});
function awaitDefinition(id){return packageInput.skills.find(s=>s.id===id) ? definitionMap[id] : null;}

const strike='v3-warrior-strike',guard='v3-warrior-guard-stance',counter='v3-warrior-counter-slash',armor='v3-warrior-armor-breaker',finale='v3-warrior-crushing-finale',cry='v3-warrior-battle-cry',focus='v3-warrior-battle-focus',unbroken='v3-warrior-unbroken-stance',charge='v3-warrior-iron-charge',sweep='v3-warrior-sweeping-slash',ground='v3-warrior-ground-breaker';
const allMax=Object.fromEntries(packageInput.skills.map(s=>[s.id,s.maxRank]));
function defer(g){const original=g.skillHits.schedule.bind(g.skillHits),entries=[];g.skillHits.schedule=(...args)=>entries.push(args);return {entries,flush(){for(const args of entries.splice(0))original(...args);}};}
await test('full 61-rank legal Lv61 ledger123/122/1 + legal STR/DEX allocation and separate skill cooldowns',()=>{
 const g=game(61,allMax);assert.equal(g.hero.skillPoints,1);assert.equal(g.hero.statPoints,120);assert(g.allocateStatPoint('str'));assert(g.allocateStatPoint('dex'));assert.equal(g.hero.statPoints,118);assert(g.getDevelopmentWarriorAvailability().ok);
 const e=target(g),calls=ledger(g);rng(g,[.5,0,.99,.25,0,.99]);assert(cast(g,strike).ok);assert(cast(g,armor).ok);
 close(calls[0].raw,(7+Math.floor(61*1.1)+1+34)*1.2+.18);assert.equal(g.skillCooldowns[strike],2.8);assert.equal(g.skillCooldowns[armor],8.5);assert.equal(g.hero.skillPoints,1);assert(e.hp<10000);
 evidence.push({case:'ALL_MAX_LEGAL',level:g.hero.level,ledger:g.hero.skillProgressionV3,available:g.hero.skillPoints,points:g.hero.statPoints,calls});g.dispose();
});
for(const outcome of ['Crit','Evade','Lethal'])await test('actual '+outcome+' HP/feedback/death once',()=>{
 const g=game(15,{[strike]:1}),e=target(g,{hp:outcome==='Lethal'?1:10000,evasion:outcome==='Evade'?50:0}),calls=ledger(g);
 if(outcome==='Lethal')delete e.definition;
 const values=outcome==='Evade'?[.25,.99]:[.25,0,outcome==='Crit'?0:.99],draws=rng(g,values),kills=g.hero.kills,mana=g.hero.mana;assert(cast(g,strike).ok);assert.equal(g.hero.mana,mana-5);assert.equal(draws.length,values.length);
 if(outcome==='Evade'){assert.equal(e.hp,10000);assert.equal(calls.length,0);assert(g.floats.some(f=>f.text==='EVADE'));assert(!e.sourceOwnedStatuses);}
 else if(outcome==='Crit'){assert.equal(calls[0].raw,56*1.5);assert.equal(calls[0].delta,Math.round(84*650/720));}
 else{assert.equal(e.hp,0);assert.equal(g.hero.kills,kills+1);g.skillHits.update(20);assert.equal(g.hero.kills,kills+1);assert.equal(calls.length,1);}
 evidence.push({case:outcome,draws,calls,feedback:g.floats});g.dispose();
});
await test('final precision differs from early rounding and target defense is live, budget frozen in original queue',()=>{
 const g=game(18,{[strike]:2}),e=target(g,{defense:45}),q=defer(g),calls=ledger(g),draws=rng(g,[.25,0,.99]);const r=cast(g,strike);assert(r.ok);assert.equal(draws.length,1);assert.equal(q.entries.length,1);
 // MECHANICAL post-commit mutations: snapshot must not be recalculated.
 g.hero.allocatedStats.str=10;g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).baseStats={attack:999};e.definition.defense=19;
 q.flush();const raw=59*1.02;close(r.sample.totalRaw,raw);assert.equal(calls[0].raw,raw);assert.equal(calls[0].delta,Math.round(raw*680/699));assert.notEqual(Math.round(raw*680/699),Math.round(Math.round(raw)*680/699));assert.equal(draws.length,3);g.dispose();
});
for(const invalid of ['actor','target','region','spawn','dead'])await test('deferred original impact rejects stale '+invalid,()=>{
 const g=game(15,{[strike]:1}),e=target(g),q=defer(g),calls=ledger(g),draws=rng(g,[.25]);assert(cast(g,strike).ok);
 if(invalid==='actor')g.hero=structuredClone(g.hero);if(invalid==='target')e.group.uuid='stale';if(invalid==='region')g.regionBuildToken++;if(invalid==='spawn')e.respawnDeadline=42;if(invalid==='dead')e.hp=0;
 q.flush();assert.equal(calls.length,0);assert.equal(draws.length,1);assert.equal(g.hero.mana,JSON.parse(before(g).hero).mana);g.dispose();
});
for(const kind of ['missing','expired','consumed','forged','periodic','unblockable','postdraw'])await test('Counter rejects '+kind+' without commitment',()=>{
 const g=game(30,{[guard]:2,[counter]:1});target(g);
 if(kind==='expired'||kind==='consumed'||kind==='postdraw'){blocked(g);if(kind==='expired')g.stepSkillRuntime(2.501);if(kind==='consumed')assert(g.consumeRecentDefenseEvent('blocked',2500));}
 if(kind==='forged')g.defenseEvents.record(g.hero,true,g.combatTime*1000,'FORGED');
 if(kind==='periodic'||kind==='unblockable'){g.blocking=true;g.invincible=0;g.rand=()=>.99;g.hurtHero(10,'MECHANICAL',undefined,kind==='periodic'?'dot':'direct',kind!=='unblockable');g.blocking=false;}
 const prior=before(g);let attempts=0;g.rand=()=>{attempts++;if(kind==='postdraw')g.defenseEvents.clear();return .25;};const r=cast(g,counter);assert(!r.ok);assert.deepEqual(before(g),prior);assert.equal(attempts,kind==='postdraw'?1:0);g.dispose();
});
await test('Counter original Parry receipt then one-shot consume; mechanical parry status not a new Warrior ability',()=>{
 const g=game(30,{[guard]:2,[counter]:1});target(g);status.applyStatus(g.hero,'parry',1);g.hurtHero(10,'MECHANICAL_PHYSICAL_DIRECT');status.removeStatus(g.hero,'parry');
 rng(g,[.25,0,.99]);assert(cast(g,counter).ok);assert(g.defenseEvents.lastDefenseEvent.consumed);g.dispose();
});
await test('Guard/Unbroken DR points add once; Cry/Focus legitimate buffs permit next cast, same-ID refresh, expiry',()=>{
 const g=game(61,allMax),e=target(g),draws=rng(g,[]);
 for(const id of [guard,unbroken,cry,focus])assert(cast(g,id).ok);
 const stats=rules.derivedStats(g.hero);assert.equal(stats.damageReduction,23);assert.equal(stats.blockRate,12);assert.equal(stats.accuracy,103);assert.equal(stats.criticalRate,5);assert.equal(draws.length,0);
 const calls=ledger(g);rng(g,[.25,0,.99]);assert(cast(g,strike).ok);close(calls[0].raw,(107*1.2)*1.07);assert(e.hp<10000);
 const priorHP=g.hero.hp;g.invincible=0;const incoming=rng(g,[.99,0]);g.hurtHero(100,'MECHANICAL_LANDED_BLOCK');assert.equal(incoming.length,2);assert(g.hero.hp<priorHP);assert.equal(g.defenseEvents.lastDefenseEvent.result,'blocked');
 advance(g,36);assert.equal(rules.derivedStats(g.hero).damageReduction,0);assert.equal(rules.derivedStats(g.hero).blockRate,0);assert(g.getDevelopmentWarriorAvailability().ok);
 rng(g,[]);assert(cast(g,guard).ok);advance(g,16);assert(cast(g,guard).ok);assert.equal(g.hero.temporaryModifiers.filter(e=>e.modifier.id===guard+'-buff').length,1);g.dispose();
});
for(const owner of ['own','foreign','expired'])await test('Armor Break/Finale '+owner+' status live ownership payoff once',()=>{
 const g=game(41,{[strike]:3,[armor]:3,[finale]:1}),e=target(g,{defense:70}),calls=ledger(g);
 if(owner==='own'){rng(g,[.25,0,.99]);assert(cast(g,armor).ok);assert(status.hasActiveStatusFromSource(e,'armor_break',g.hero.characterId,g.combatTime));assert.equal(calls[0].delta,Math.round(85*1.1*910/980));}
 else status.applySourceOwnedStatus(e,'armor_break',{sourceActorId:owner==='foreign'?'FOREIGN':g.hero.characterId,skillId:armor,strength:9,appliedAt:owner==='expired'?-10:0,duration:8},{refresh:'strongest',compatibilityTimer:true});
 rng(g,[.25,0,.99]);assert(cast(g,finale).ok);const reduction=owner==='expired'?0:.09,payoff=owner==='own'?1.1:1,expected=Math.round(85*1.45*payoff*910/(910+70*(1-reduction)));
 assert.equal(calls.at(-1).delta,expected);g.dispose();
});
await test('Armor Break strongest own refresh, weaker/foreign preservation and no status on evade',()=>{
 const g=game(55,{[strike]:3,[armor]:5}),e=target(g);rng(g,[.25,0,.99]);assert(cast(g,armor).ok);assert.equal(status.effectiveArmorBreakStrength(e,0),12);
 status.applySourceOwnedStatus(e,'armor_break',{sourceActorId:'FOREIGN',skillId:armor,strength:6,appliedAt:0,duration:8},{refresh:'strongest',compatibilityTimer:true});assert.equal(status.effectiveArmorBreakStrength(e,0),12);
 advance(g,9);assert.equal(status.effectiveArmorBreakStrength(e,g.combatTime),0);e.evasion=50;rng(g,[.25,.99]);assert(cast(g,armor).ok);assert.equal(status.effectiveArmorBreakStrength(e,g.combatTime),0);g.dispose();
});
for(const id of [sweep,ground])await test('AoE '+id+' one cast sample, full target budgets/cap/arc using actual selector',()=>{
 const g=game(61,allMax),calls=ledger(g);for(let i=0;i<8;i++)target(g,{x:(i-4)*.1,z:-1-i*.1});g.direction.set(0,0,-1);
 target(g,{z:1.5});g.direction.set(0,0,-1);const count=id===sweep?5:6,draws=rng(g,[.25,...Array(count).fill([0,.99]).flat()]);
 const mana=g.hero.mana;assert(cast(g,id).ok);assert.equal(calls.length,count);assert.equal(draws.length,1+2*count);assert(calls.every(c=>c.raw===calls[0].raw));assert.equal(g.hero.mana,mana-(id===sweep?15:19));g.dispose();
});
await test('Charge safe original movement, actual distance Stun and collision reject before draw/payment',()=>{
 const g=game(15,{[charge]:1}),e=target(g,{z:-6}),start=g.actor.position.clone(),draws=rng(g,[.25,0,.99,0]);
 assert(cast(g,charge).ok);close(g.groundDistance(start,g.actor.position),4.8);assert.equal(draws.length,4);assert.equal(e.stun,1.5);g.dispose();
 const b=game(15,{[charge]:1});target(b,{z:-6});b.treeColliders=[{x:b.hero.x,z:b.hero.z-2,radius:2,minY:-10,maxY:100}];const prior=before(b),d=rng(b,[]);assert(!cast(b,charge).ok);assert.deepEqual(before(b),prior);assert.equal(d.length,0);b.dispose();
});
const negatives={mirror:g=>g.hero.skillLevels[strike]=0,rank:g=>g.hero.skillProgressionV3.skillRanks[strike]=11,grant:g=>g.hero.skillProgressionV3.grantedRanks[strike]=1,ledger:g=>g.hero.skillProgressionV3.totalEarnedSP++,primary:g=>g.hero.allocatedStats.str++,job:g=>g.hero.job='thief',oldIron:g=>delete g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).authoredAttackVersion,item:g=>g.hero.inventory.push(g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand)),bonus:g=>g.hero.activeBuffs.forged=5,modifier:g=>g.hero.temporaryModifiers=[{modifier:{id:guard+'-buff',stats:{flat:{damageReduction:8}}},remaining:5}],mana:g=>g.hero.mana=0,cooldown:g=>g.skillCooldowns[strike]=1,NaN:g=>g.skillCooldowns[strike]=NaN,pause:g=>g.paused=true,dead:g=>g.dead=true,action:g=>g.actionLock.start(g.combatTime,1,false),Stun:g=>status.applyStatus(g.hero,'stun',1),target:g=>g.clearCurrentTarget(),host:g=>g.hero=structuredClone(g.hero)};
for(const [name,change] of Object.entries(negatives))await test('fail-closed '+name+' with no RNG/payment/queue/movement',()=>{const g=game(15,{[strike]:1});target(g);change(g);const prior=before(g),d=rng(g,[]);assert(!cast(g,strike).ok);assert.deepEqual(before(g),prior);assert.equal(d.length,0);g.dispose();});
for(const value of [-1,1,NaN,Infinity,new Error('MECHANICAL_RNG_THROW')])await test('invalid RNG attempted once '+String(value),()=>{const g=game(15,{[strike]:1});target(g);const prior=before(g),d=rng(g,[value]);assert(!cast(g,strike).ok);assert.deepEqual(before(g),prior);assert.equal(d.length,1);g.dispose();});
await test('legal upgrade/allocation/equip renewal preserves cooldown; forged clone and copied buff fail closed',()=>{
 const g=game(18,{[strike]:1});target(g);rng(g,[.25,0,.99]);assert(cast(g,strike).ok);const cd=g.skillCooldowns[strike];assert(g.learnSkill(strike));assert.equal(g.skillCooldowns[strike],cd);assert(g.getDevelopmentWarriorAvailability().ok);assert(g.allocateStatPoint('str'));assert.equal(g.skillCooldowns[strike],cd);assert(g.getDevelopmentWarriorAvailability().ok);
 const item=g.hero.equipment.mainHand;assert(g.unequipItem('mainHand'));assert(!g.getDevelopmentWarriorAvailability().ok);assert(g.equipItem(item,'mainHand'));assert(g.getDevelopmentWarriorAvailability().ok);assert.equal(g.skillCooldowns[strike],cd);
 const validHero=g.hero;assert(!g.learnSkill(strike));assert.equal(g.hero,validHero);assert(g.getDevelopmentWarriorAvailability().ok);g.hero=structuredClone(g.hero);assert(!g.getDevelopmentWarriorAvailability().ok);g.dispose();
});
await test('original save/new Game defaultOFF; death/respawn and lawful city travel restore only prior policy',async()=>{
 const g=game(15,{[strike]:1});target(g);rng(g,[.25,0,.99]);assert(cast(g,strike).ok);g.save();const next=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);next.started=true;
 assert.equal(next.getDevelopmentWarriorAvailability(),null);assert.deepEqual(next.hero.skillProgressionV3,g.hero.skillProgressionV3);assert.deepEqual(next.hero.equipment,g.hero.equipment);next.dispose();
 const cd=g.skillCooldowns[strike];g.invincible=0;rng(g,[.99]);g.hurtHero(1e9,'MECHANICAL_DEATH');assert(g.dead);assert(!g.getDevelopmentWarriorAvailability().ok);g.respawn();g.actor.position.set(g.hero.x,0,g.hero.z);assert(g.getDevelopmentWarriorAvailability().ok);assert.equal(g.skillCooldowns[strike],cd);
 assert(g.changeRegion('averion'));assert(!g.getDevelopmentWarriorAvailability().ok);while(g.transitioning)await new Promise(r=>setTimeout(r,10));assert(!g.regionLoadError);assert(g.getDevelopmentWarriorAvailability().ok);assert.equal(g.skillCooldowns[strike],cd);
 const off=game(15,{[strike]:1},false);assert(off.changeRegion('averion'));while(off.transitioning)await new Promise(r=>setTimeout(r,10));assert.equal(off.getDevelopmentWarriorAvailability(),null);off.dispose();g.dispose();
});
await test('original consumable clone renews only proven Warrior policy; failed item preserves binding and cooldown',()=>{
 const g=game(15,{[strike]:1},false),p=structuredClone(items.createItem('mana-potion-3',{id:'MECHANICAL_EXISTING_POTION'}));g.hero.inventory.push(p);
 assert(g.enableDevelopmentWarriorReference({lifecycleRenewal:true}).ok);target(g);rng(g,[.25,0,.99]);assert(cast(g,strike).ok);
 const mana=g.hero.mana,cd=g.skillCooldowns[strike],ledger=JSON.stringify(g.hero.skillProgressionV3);assert(g.useItem(p.id));assert(g.hero.mana>mana);assert(g.getDevelopmentWarriorAvailability().ok);assert.equal(g.skillCooldowns[strike],cd);assert.equal(JSON.stringify(g.hero.skillProgressionV3),ledger);
 const hero=g.hero;assert(!g.useItem('MISSING_MECHANICAL_ITEM'));assert.equal(g.hero,hero);assert(g.getDevelopmentWarriorAvailability().ok);assert.equal(g.skillCooldowns[strike],cd);g.dispose();
 const off=game(15,{[strike]:1},false);assert(!off.useItem('MISSING_MECHANICAL_ITEM'));assert.equal(off.getDevelopmentWarriorAvailability(),null);off.dispose();
});
await test('post-draw unsupported source rejects without cost or queue; attempted draw remains consumed',()=>{
 const g=game(15,{[strike]:1});target(g);const mana=g.hero.mana,cd={...g.skillCooldowns},position=g.actor.position.toArray();let draws=0;
 g.rand=()=>{draws++;g.hero.temporaryModifiers=[{modifier:{id:'MECHANICAL_FORGED_AFTER_DRAW',stats:{flat:{attack:5}}},remaining:5}];return .25;};
 assert(!cast(g,strike).ok);assert.equal(draws,1);assert.equal(g.hero.mana,mana);assert.deepEqual(g.skillCooldowns,cd);assert.deepEqual(g.actor.position.toArray(),position);assert.equal(g.skillHits.size,0);g.dispose();
});
await test('selected presentation has unique resolved effect labels and cannot mutate registry or Hero',()=>{
 const g=game(61,allMax),hero=JSON.stringify(g.hero),registry=JSON.stringify(WARRIOR_V3_RUNTIME_MAP),prior=before(g);
 for(const skill of packageInput.skills)for(const row of skill.ranks){
  const meta=reference.warriorReferenceSkillMetadata(skill.id,row.rank),ui=presentation.resolveSkillPresentation(g.hero,definitionMap[skill.id],WARRIOR_V3_RUNTIME_MAP[skill.id],meta);
  assert.equal(new Set(ui.effects.map(r=>r.label)).size,ui.effects.length);
  const dr=meta.temporaryBuffs?.[0]?.modifier.stats?.percent?.damageReduction;
  if(dr!==undefined)assert.equal(ui.effects.find(r=>r.label==='Damage Reduction').value,`+${dr}% · added to existing reduction`);
  if(meta.temporaryBuffs?.length)assert.throws(()=>{meta.temporaryBuffs[0].modifier.id='forged';},TypeError);
 }
 assert.equal(JSON.stringify(g.hero),hero);assert.equal(JSON.stringify(WARRIOR_V3_RUNTIME_MAP),registry);assert.deepEqual(before(g),prior);g.dispose();
});
after(async()=>{await server.close();fs.writeFileSync(path.join(output,'actual-warrior-evidence.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});});
