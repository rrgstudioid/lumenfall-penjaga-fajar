// ACTUAL Game consumers; rendering/audio/DOM ONLY are offline stubs.
// All targets, schedules and RNG values below are MECHANICAL FIXTURE, NOT CP policy.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
import * as T from 'three';
const output=process.env.DIAGNOSTIC_CHECKPOINT;
assert(output,'Isolated evidence directory required');
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/diagnostic'},addEventListener(){},removeEventListener(){}},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:diagnostic-three')return '\0diagnostic-three';},load(id){if(id==='\0diagnostic-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:diagnostic-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items'),diagnostic=await load('adventurer-diagnostic-v2'),foundation=await load('adventurer-cp-foundation-v2'),workloads=await load('adventurer-diagnostic-workload-v2');
const evidence=[];after(async()=>{await server.close();fs.writeFileSync(path.join(output,'diagnostic-evidence.json'),JSON.stringify(evidence,null,2));});
const cp=await load('combat-power');
const producer=await load('adventurer-ranks-reference-v2');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const ids=['v3-adventurer-quick-slash','v3-adventurer-power-strike','v3-adventurer-minor-heal'];
const training='field-verdant-plains-sword',iron='field-ironveil-mines-sword';
const provenance={source:'MECHANICAL_FIXTURE',version:'DIAGNOSTIC_TEST_V1',label:'NOT CANONICAL'};
const targets=evasion=>[{provenance,variant:'normal',weight:1,physicalDefense:70,evasion,targetBonusPercent:0}];
const value=r=>{assert(r.ok,JSON.stringify(r));return r.value;},near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
let serial=0;
function game(level=14,ranks=[5,5,3],weapon=training,allocation='neutral',active=false){
 storage.clear();const h=rules.createV3AdventurerHero('diagnostic-'+(++serial));rules.saveCharacter(h,true);const g=new Game(element(),element(),element(),()=>{},()=>{},h.slotId);g.started=true;g.actor.position.set(g.hero.x,0,g.hero.z);
 while(g.hero.level<level)assert.equal(rules.gainXP(g.hero,rules.xpNeeded(g.hero.level)),1);
 for(let i=0;i<ids.length;i++)while((g.hero.skillLevels[ids[i]]??0)<ranks[i])assert(g.learnSkill(ids[i]));
 const item=items.createItem(weapon,{id:h.slotId+'-weapon'});g.hero.inventory.push(item);assert(g.equipItem(item.id,'mainHand'));
 for(let i=0,n=g.hero.statPoints;i<n&&allocation!=='neutral';i++)assert(g.allocateStatPoint(allocation==='mixed'?['str','vit','dex','int'][i%4]:allocation));
 for(const n of ['sound','effect','ring','pulse','arc'])g[n]=()=>{};g.testFloats=[];g.float=(...args)=>g.testFloats.push(args[1]);
 if(active)assert(g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true}).ok);return g;
}
function target(g){const group=new T.Group();group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));const e={id:++serial,group,home:group.position.clone(),hp:10000,max:10000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'mechanical-'+serial,definition:{defense:70,magicDefense:0},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:999999,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:0,attackRange:0,movementSpeed:0,evasion:0,marked:false,weakPoint:false};g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));return e;}
function state(g){return JSON.stringify({hero:g.hero,seed:g.seed,clock:g.combatTime,timer:g.attackTimer,combo:g.combo,window:g.comboWindow,CD:g.skillCooldowns,queue:g.skillHits.size,range:g.getDevelopmentAdventurerRange(),renew:g.getDevelopmentAdventurerRenewal(),storage:[...storage]});}
function means(actor,evasion=0){return value(diagnostic.evaluateAdventurerDiagnosticActions(actor,targets(evasion),['basic',...actor.actions.filter(a=>a.id!=='basic').map(a=>a.id)],provenance)).rows;}
function workload(actor,events,horizon=2){return {provenance,model:'INDEPENDENT_BASIC_SKILL_CONTINUOUS_CAPPED_MANA_V1',terminal:'IMPACT_STRICTLY_BEFORE_HORIZON',horizon,initialMana:actor.resources.mana,maxMana:actor.resources.maxMana,recoveryPerSecond:actor.resources.recovery,initialBasicDue:actor.clocks.basicRemaining,initialComboIndex:actor.clocks.comboIndex,initialComboExpires:actor.clocks.comboRemaining,initialLockUntil:0,skillReadyAt:{...actor.clocks.cooldowns},events:events.map(([id,at],order)=>({id,at,order}))};}
for(const weapon of [training,iron])for(let level=weapon===iron?10:1;level<=14;level++)await test(`ACTUAL adapter ${weapon} Lv${level}: neutral owned current profile, pure/defaultOFF`,()=>{
 const g=game(level,[1,0,0],weapon),before=state(g),a=value(diagnostic.readActualAdventurerDiagnostic(g));
 assert.equal(a.profile.core,7+Math.floor(level*1.1));assert.deepEqual(a.profile.weaponRange,weapon===iron?{min:32,max:36}:{min:9,max:11});
 for(let i=0;i<5;i++)value(diagnostic.readActualAdventurerDiagnostic(g));assert.equal(state(g),before);assert.equal(g.getDevelopmentAdventurerRange(),null);
 evidence.push({case:'LEVEL',weapon,level,core:a.profile.core,range:a.profile.weaponRange});g.dispose();
});
const tables=[[[1,1.05,.02,3,3.2],[3,1.08,.03,3,3.1],[6,1.12,.04,4,3],[9,1.16,.05,4,2.9],[13,1.2,.06,5,2.8]],[[2,1.2,.04,5,6],[7,1.26,.05,5,5.75],[10,1.32,.06,6,5.5],[12,1.38,.07,6,5.25],[14,1.45,.08,7,5]]];
for(let skill=0;skill<2;skill++)for(let rank=1;rank<=5;rank++)for(const weapon of [training,iron])await test(`ACTUAL paid ${ids[skill]} R${rank} ${weapon}: legal setup + raw/HP/cost`,()=>{
 const [gate,c,str,mana,cd]=tables[skill][rank-1],level=Math.max(gate,weapon===iron?10:gate),ranks=skill===0?[rank,0,0]:[1,rank,0];
 const g=game(level,ranks,weapon,'str',true),e=target(g),a=value(diagnostic.readActualAdventurerDiagnostic(g)),action=a.actions.find(a=>a.id===ids[skill]),bonus=2*(level-1),core=7+Math.floor(level*1.1)+bonus,min=weapon===iron?32:9,width=weapon===iron?4:2;
 near(action.expectedRaw,(core+min+width*.5)*c+bonus*str);assert.equal(action.mana,mana);assert.equal(action.cooldown,cd);const draws=[];g.rand=()=>{const u=[.25,0,.99][draws.length];assert(u!==undefined);draws.push(u);return u;};
 const mp=g.hero.mana,hp=e.hp;assert(g.castSkill(skill+1));const raw=(core+min+width*.25)*c+bonus*str,final=Math.round(raw*(500+10*level)/(570+10*level));assert.equal(hp-e.hp,final);assert(g.testFloats.includes(String(final)));assert.equal(mp-g.hero.mana,mana);near(g.skillCooldowns[ids[skill]],cd);assert.deepEqual(draws,[.25,0,.99]);
 evidence.push({case:'RANK',weapon,level,skill:ids[skill],rank,ledger:a.input.ledger,raw,HPDelta:hp-e.hp,mana,cd});g.dispose();
});
for(const [rank,level,percent] of [[1,2,6],[2,8,8],[3,14,10]])await test(`ACTUAL Heal${rank}: MaxHP, clamp, no attack draw`,()=>{
 const g=game(level,[1,0,rank],training,'vit',true),a=value(diagnostic.readActualAdventurerDiagnostic(g)),action=a.actions.find(a=>a.id===ids[2]);assert.equal(action.healCapacity,Math.round(a.stats.maxHP*percent/100));g.hurtHero(40,'MECHANICAL_INCOMING');const hp=g.hero.hp,mp=g.hero.mana;g.rand=()=>{throw Error('Heal must not draw combat RNG');};assert(g.castSkill(3));near(g.hero.hp-hp,Math.min(action.healCapacity,a.stats.maxHP-hp));assert.equal(mp-g.hero.mana,[8,10,12][rank-1]);g.dispose();
});
await test('Actual derived allocation contrasts; Accuracy pressure discrimination and pure previews',()=>{
 const outputs={};for(const allocation of ['neutral','str','vit','dex','int','mixed']){const g=game(14,[5,5,3],iron,allocation),before=state(g),a=value(diagnostic.readActualAdventurerDiagnostic(g));outputs[allocation]={core:a.profile.core,stats:a.stats,means:means(a,45)};const dto=structuredClone(a.input);dto.weapon={templateId:training,instanceLabel:'MATHEMATICAL_COMPARISON_ONLY',hand:'MAIN',enhancement:0,otherSources:'NONE'};const p=value(foundation.buildAdventurerDiagnosticProfile(dto));near(a.profile.actions[0].expectedRaw-p.actions[0].expectedRaw,24);assert.equal(state(g),before);g.dispose();}
 assert.equal(outputs.str.core,48);for(const k of ['vit','dex','int'])assert.equal(outputs[k].core,22);assert(outputs.vit.stats.maxHP>outputs.neutral.stats.maxHP);assert(outputs.int.stats.maxMana>outputs.neutral.stats.maxMana);assert(outputs.dex.means[0].evaluation.targets[0].hitChance>outputs.neutral.means[0].evaluation.targets[0].hitChance);evidence.push({case:'ALLOCATIONS',outputs});
});
await test('Explicit missing vs zero, malformed/weighted targets, no accessor evaluation',()=>{
 const g=game(),a=value(diagnostic.readActualAdventurerDiagnostic(g));assert.equal(diagnostic.evaluateAdventurerDiagnosticActions(a,undefined,['basic'],provenance).code,'INPUT_MISSING');const t=targets(0);const base=means(a);assert.equal(base[0].evaluation.targets[0].hitChance,1);delete t[0].evasion;assert(!diagnostic.evaluateAdventurerDiagnosticActions(a,t,['basic'],provenance).ok);let calls=0;Object.defineProperty(t[0],'evasion',{get(){calls++;return 0;}});assert(!diagnostic.evaluateAdventurerDiagnosticActions(a,t,['basic'],provenance).ok);assert.equal(calls,0);
 const weighted=[...targets(0),...targets(40)];weighted[0].weight=.25;weighted[1].weight=.75;const result=value(diagnostic.evaluateAdventurerDiagnosticActions(a,weighted,['basic'],provenance));near(result.rows[0].expectedInflicted,.25*base[0].expectedInflicted+.75*means(a,40)[0].expectedInflicted);weighted[0].weight=.3;assert(!diagnostic.evaluateAdventurerDiagnosticActions(a,weighted,['basic'],provenance).ok);g.dispose();
});
await test('Declared independent clocks: ordered same-time interleaving, third-delay, chain reset and Mana',()=>{
 const g=game(),a=value(diagnostic.readActualAdventurerDiagnostic(g)),w=workload(a,[['basic',0],[ids[0],0],[ids[1],0],['basic',.46],['basic',.92],['basic',2.1]],3),r=value(workloads.evaluateDeclaredAdventurerWorkload(a,w,means(a)));assert.deepEqual(r.events.filter(e=>e.id==='basic').map(e=>e.basicIndex),[1,2,3,1]);near(r.events[4].basicDue,.92+.68/(a.stats.attackSpeed/100));assert.equal(r.paidMana,12);near(r.finalMana,w.initialMana-12);assert.equal(r.finalCombatPower,null);evidence.push({case:'MODEL',input:w,result:r});g.dispose();
});
await test('Workload rejection matrix: CD/basic/cost/order/terminal/missing/cap/overflow/accessor',()=>{
 const g=game(),a=value(diagnostic.readActualAdventurerDiagnostic(g)),m=means(a),base=workload(a,[[ids[0],0]]);
 const cases=[w=>{w.events.push({id:ids[0],at:1,order:1});},w=>{w.events=[{id:'basic',at:0,order:0},{id:'basic',at:.1,order:1}];},w=>{w.initialMana=0;},w=>{w.events[0].at=w.horizon;},w=>{w.events.push({id:'basic',at:0,order:0});},w=>{delete w.terminal;},w=>{w.events=Array.from({length:4097},(_,order)=>({id:'basic',at:0,order}));},w=>{w.recoveryPerSecond=Number.MAX_VALUE;w.horizon=10;},w=>{w.model='greedy';}];
 for(const change of cases){const w=structuredClone(base);change(w);assert(!workloads.evaluateDeclaredAdventurerWorkload(a,w,m).ok);}let calls=0;const w=structuredClone(base);Object.defineProperty(w,'initialMana',{get(){calls++;return 0;}});assert.equal(workloads.evaluateDeclaredAdventurerWorkload(a,w,m).code,'ACCESSOR_INPUT');assert.equal(calls,0);g.dispose();
});
await test('ORIGINAL Game.tick/queue workload replay: independently conserved clocks/Mana/HP; no CD rewriting',()=>{
 const g=game(14,[5,5,3],training,'int',true),e=target(g),a=value(diagnostic.readActualAdventurerDiagnostic(g));e.group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));g.crystal=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());g.lastTime=1000;
 const events=[['basic',0],[ids[0],0],[ids[1],0],['basic',.5],['basic',1],['basic',2.2]],w=workload(a,events,2.4),model=value(workloads.evaluateDeclaredAdventurerWorkload(a,w,means(a)));
 const draws=[];g.rand=()=>{const u=[.25,0,.99][draws.length%3];draws.push(u);return u;};let time=0;const rows=[];const start=e.hp;
 for(const [id,at] of events){while(time<at){const next=Math.min(at,time+.02);g.tick(1000+next*1000);time=next;}const before=e.hp,mp=g.hero.mana,result=id==='basic'?g.attack():g.castSkill(ids.indexOf(id)+1);const definition=id==='basic'?null:a.actions.find(a=>a.id===id),core=22,raw=(core+9+.5)*(id===ids[0]?1.20:id===ids[1]?1.45:1);const expected=Math.round(raw*640/710);assert.equal(before-e.hp,expected);if(id!=='basic')assert(result);near(mp-g.hero.mana,definition?.mana??0);rows.push({id,at,clock:g.combatTime,mana:g.hero.mana,combo:g.combo,timer:g.attackTimer,HPDelta:before-e.hp});}
 while(time<w.horizon){const next=Math.min(w.horizon,time+.02);g.tick(1000+next*1000);time=next;}
 near(g.hero.mana,model.finalMana);near(g.skillCooldowns[ids[0]],2.8-2.4);near(g.skillCooldowns[ids[1]],5-2.4);assert.deepEqual(rows.filter(r=>r.id==='basic').map(r=>r.combo),[1,2,3,1]);assert.equal(draws.length,events.length*3);evidence.push({case:'ORIGINAL_TICK_REPLAY',input:w,model,rows,actualFinalMana:g.hero.mana,totalHP:start-e.hp,draws,frameStep:.02,statisticalMeanNotSampleOracle:true});g.dispose();
});
await test('Current lifecycle replacement/old Iron/death/respawn/save and no legacy CP mutation',async()=>{
 const g=game(14,[5,5,3],iron,'mixed',true),a=value(diagnostic.readActualAdventurerDiagnostic(g)),legacy=cp.calculateCombatPower(g.hero),before=state(g);for(let i=0;i<10;i++)means(value(diagnostic.readActualAdventurerDiagnostic(g)));assert.equal(state(g),before);assert.deepEqual(cp.calculateCombatPower(g.hero),legacy);
 const owned=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);assert(g.unequipItem('mainHand'));assert(!diagnostic.readActualAdventurerDiagnostic(g).ok);assert(g.equipItem(owned.id,'mainHand'));value(diagnostic.readActualAdventurerDiagnostic(g));
 const old={...structuredClone(owned),id:'historical-only',levelRequirement:8};delete old.authoredAttackVersion;g.hero.inventory.push(old);assert(g.equipItem(old.id,'mainHand'));assert(!diagnostic.readActualAdventurerDiagnostic(g).ok);assert(g.equipItem(owned.id,'mainHand'));g.save();const fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);fresh.started=true;assert.equal(fresh.getDevelopmentAdventurerRange(),null);assert.deepEqual(value(diagnostic.readActualAdventurerDiagnostic(fresh)).input.ledger,a.input.ledger);fresh.dispose();
 g.hurtHero(100000,'MECHANICAL_LETHAL');assert(g.dead);assert.equal(diagnostic.readActualAdventurerDiagnostic(g).code,'INACTIVE_LIFECYCLE');g.respawn();assert(!g.dead);value(diagnostic.readActualAdventurerDiagnostic(g));g.dispose();assert(!diagnostic.readActualAdventurerDiagnostic(g).ok);
});
await test('Adapter malformed identity/bonus/budget/old source fail visibly; unchanged inputs',()=>{
 for(const mutate of [g=>g.hero.inventory.push(structuredClone(g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand))),g=>g.hero.statPoints++,g=>g.hero.skillLevels[ids[0]]=4,g=>g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand).bonusStats.dex=1,g=>g.hero.level=15,g=>g.hero.pet={}]){const g=game();mutate(g);const before=JSON.stringify(g.hero);assert(!diagnostic.readActualAdventurerDiagnostic(g).ok);assert.equal(JSON.stringify(g.hero),before);g.dispose();}
 assert.equal(diagnostic.readActualAdventurerDiagnostic({hero:{}}).code,'NOT_ACTUAL_GAME');
});

await test('Iron mathematical input requires exact authored source; missing/wrong/accessor never converted',()=>{
 const g=game(14,[5,5,3],iron),dto=value(diagnostic.readActualAdventurerDiagnostic(g)).input;
 for(const change of [x=>{delete x.weapon.authored;},x=>{x.weapon.authored.authoredAttackVersion='legacy';},x=>{x.weapon.authored.levelRequirement=8;},x=>{x.weapon.authored.baseStats.attack=32;},x=>{x.weapon.authored.unapprovedRange=[32,36];}]){const x=structuredClone(dto);change(x);assert(!foundation.buildAdventurerDiagnosticProfile(x).ok);}
 let calls=0;const x=structuredClone(dto);Object.defineProperty(x.weapon.authored,'authoredAttackVersion',{get(){calls++;return 'IRON_SWORD_LV10_BASE_V1';}});assert(!foundation.buildAdventurerDiagnosticProfile(x).ok);assert.equal(calls,0);g.dispose();
});

await test('Explicit workload recovery caps and affordability at event time; actor resource is not overwritten',()=>{
 const g=game(),before=state(g),a=value(diagnostic.readActualAdventurerDiagnostic(g)),m=means(a),w=workload(a,[[ids[0],1]],3);
 w.initialMana=0;w.maxMana=8;w.recoveryPerSecond=6;
 const r=value(workloads.evaluateDeclaredAdventurerWorkload(a,w,m));assert.equal(r.paidMana,5);assert.equal(r.finalMana,8);assert.equal(r.effectiveRecoveredMana,13);
 const tooEarly=structuredClone(w);tooEarly.events[0].at=.5;assert.equal(workloads.evaluateDeclaredAdventurerWorkload(a,tooEarly,m).code,'MANA_CONSERVATION');
 const overCap=structuredClone(w);overCap.initialMana=9;assert.equal(workloads.evaluateDeclaredAdventurerWorkload(a,overCap,m).code,'MANA_CONSERVATION');assert.equal(state(g),before);g.dispose();
});

await test('Actual diagnostic read/evaluation never advances gameplay preparation serial or binding epoch',()=>{
 const g=game(14,[5,5,3],training,'mixed');
 const binding=value(producer.openAdventurerRanksBinding(g));
 const first=value(producer.prepareAdventurerBasic(binding,g,1)).snapshot;
 const before=state(g);for(let i=0;i<8;i++)means(value(diagnostic.readActualAdventurerDiagnostic(g)),40);assert.equal(state(g),before);
 const second=value(producer.prepareAdventurerBasic(binding,g,1)).snapshot;
 assert.deepEqual(second.owner,first.owner);assert.equal(Number(second.executionId.split(':').at(-1)),Number(first.executionId.split(':').at(-1))+1);g.dispose();
});
