// ACTUAL Game consumers; rendering/audio/DOM ONLY are offline stubs.
// All targets, schedules and RNG values below are MECHANICAL FIXTURE, NOT CP policy.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'vite';
const output=process.env.DIAGNOSTIC_CHECKPOINT;
assert(output,'Isolated evidence directory required');
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/diagnostic'},addEventListener(){},removeEventListener(){}},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:diagnostic-three')return '\0diagnostic-three';},load(id){if(id==='\0diagnostic-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:diagnostic-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items'),diagnostic=await load('adventurer-diagnostic-v2');
const evidence=[];after(async()=>{await server.close();fs.writeFileSync(path.join(output,'package-b-evidence.json'),JSON.stringify(evidence,null,2));});

const {CITIES}=await load('regions');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const ids=['v3-adventurer-quick-slash','v3-adventurer-power-strike','v3-adventurer-minor-heal'];
const training='field-verdant-plains-sword',iron='field-ironveil-mines-sword';

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
const nominal=await load('adventurer-nominal-offense-v3');
function state(g){return JSON.stringify({hero:g.hero,seed:g.seed,clock:g.combatTime,CD:g.skillCooldowns,timer:g.attackTimer,queue:g.skillHits.size,range:g.getDevelopmentAdventurerRange(),renew:g.getDevelopmentAdventurerRenewal(),storage:[...storage]});}

const incoming=await load('diagnostic-incoming-ehp-v1'), packageB=await load('adventurer-package-b-diagnostic');
const mechanical=(changes={})=>({kind:'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY',source:'MECHANICAL FIXTURE NOT ACTOR',level:10,maxHP:1000,physicalDefense:600,magicDefense:900,evasion:20,damageReduction:10,block:{source:'NONE',chancePercent:0,efficiencyBonus:0},...changes});
await test('B1/2 independent EHP oracle, DR once, geometric and channel eligibility',()=>{
 const input=mechanical(),r=value(incoming.evaluatePassiveEHP(input)),raw=28,k=600;
 near(r.bank.mean,raw);near(r.channels[0].expectedInflicted,raw*(k/(600+k))*.8*.9);
 near(r.channels[0].ehp,1000/(.5*.8*.9));near(r.channels[1].ehp,1000/(.4*.9));
 near(r.geometric,Math.sqrt((1000/(.5*.8*.9))*(1000/(.4*.9))));
 const blocked=value(incoming.evaluatePassiveEHP(mechanical({block:{source:'MECHANICAL_EXPLICIT',chancePercent:90,efficiencyBonus:0}})));
 near(blocked.channels[0].ehp,r.channels[0].ehp/.82);near(blocked.channels[1].ehp,r.channels[1].ehp);
 for(const [c,d,b] of [['physical','periodic',true],['magic','direct',true],['physical','direct',false]])
 assert.equal(value(incoming.diagnosticBlock({source:'MECHANICAL_EXPLICIT',chancePercent:90,efficiencyBonus:0},c,d,b)).chance,0);
 assert.equal(value(incoming.diagnosticBlock({source:'NONE',chancePercent:0,efficiencyBonus:0},'physical','direct',true)).chance,0);
 for(const block of [{source:'UNKNOWN',chancePercent:0,efficiencyBonus:0},{source:'NONE',chancePercent:1,efficiencyBonus:0},{source:'MECHANICAL_EXPLICIT',chancePercent:2,efficiencyBonus:1}])assert(!incoming.evaluatePassiveEHP(mechanical({block})).ok);
 evidence.push({case:'MECHANICAL_EHP',input,result:r});
});
await test('B2 validation, immunity, huge geometric without intermediate overflow; immutability',()=>{
 const input=mechanical(),before=JSON.stringify(input),r=value(incoming.evaluatePassiveEHP(input));assert(Object.isFrozen(r)&&Object.isFrozen(r.channels));assert.equal(JSON.stringify(input),before);
 for(const x of [NaN,Infinity,-1])assert(!incoming.evaluatePassiveEHP(mechanical({physicalDefense:x})).ok);
 assert.equal(incoming.evaluatePassiveEHP(mechanical({damageReduction:100})).code,'IMMUNITY_OR_ZERO_DENOMINATOR');
 const huge=value(incoming.evaluatePassiveEHP(mechanical({maxHP:1e200,physicalDefense:0,magicDefense:0,evasion:0,damageReduction:0})));assert(Number.isFinite(huge.geometric));assert(Math.abs(huge.geometric/1e200-1)<1e-14);
 assert(!incoming.evaluatePassiveEHP(mechanical({maxHP:Number.MAX_VALUE})).ok);
 const symmetric=value(incoming.evaluatePassiveEHP(mechanical({physicalDefense:400,magicDefense:400,evasion:0})));near(symmetric.geometric,symmetric.channels[0].ehp);
 let getter=0;const bad={...input};Object.defineProperty(bad,'maxHP',{get(){getter++;return 1000;}});assert(!incoming.evaluatePassiveEHP(bad).ok);assert.equal(getter,0);
});
for(const weapon of [training,iron])for(const allocation of ['neutral','str','vit','dex','int','mixed'])await test('B actual admitted '+weapon+' / '+allocation+', bank isolation and ledger',()=>{
 const g=game(14,[5,5,3],weapon,allocation,true),before=state(g),a=value(diagnostic.readActualAdventurerDiagnostic(g)),r=value(packageB.readPackageB(g));assert.equal(state(g),before);
 assert.deepEqual(r.offense,value(nominal.readNominalOffense(g)));near(r.ehp.bank.mean,32);
 for(const [i,ch] of r.ehp.channels.entries()){
  const f=640/(640+(i===0?a.stats.physicalDefense:a.stats.magicDefense)),p=i===0?1-Math.min(.5,a.stats.evasion/100):1;
  near(ch.expectedInflicted,32*f*p*(1-a.stats.damageReduction/100));near(ch.ehp,a.stats.maxHP/(f*p*(1-a.stats.damageReduction/100)));
 }
 for(const channel of r.channels)for(const run of [channel.noHeal,channel.withHeal]){
  let hp=a.stats.maxHP,mana=a.resources.maxMana,at=0,paid=0,regen=0,heal=0,out=0;const ready={};
  for(const e of run.trace){const rec=Math.min(a.resources.maxMana-mana,(e.at-at)*a.resources.recovery);mana+=rec;regen+=rec;at=e.at;
   if(e.kind==='incoming')hp=Math.max(0,hp-channel.landedPacket);
   if(e.kind==='cast'){const ac=a.actions.find(x=>x.id===e.id);assert(e.at>=(ready[e.id]??0));assert(mana>=ac.mana);mana-=ac.mana;paid+=ac.mana;if(e.id!=='basic')ready[e.id]=e.at+ac.cooldown;if(ac.channel==='heal')assert(a.stats.maxHP-hp>=ac.healCapacity);}
   if(e.kind==='impact'){const ac=a.actions.find(x=>x.id===e.id);if(ac.channel==='heal'){const n=Math.min(a.stats.maxHP-hp,ac.healCapacity);hp+=n;heal+=n;}else out+=r.offense.actions.find(x=>x.id===e.id).expectedInflicted;}
   near(e.hp,hp);near(e.mana,mana);
  }const terminal=run.deathAt??30,rec=Math.min(a.resources.maxMana-mana,(terminal-at)*a.resources.recovery);mana+=rec;regen+=rec;
  near(run.finalMana,mana);near(run.paidMana,paid);near(run.recoveredMana,regen);near(run.usableHeal,heal);near(run.expectedOffense,out);near(run.expectedOffenseDPS,out/30);near(run.usableHPS,heal/30);
  assert.equal(run.survivedHorizon,run.deathAt===null);assert.equal(run.censored,run.deathAt===null);
 }
 assert.equal(r.shield,null);assert.equal(r.hpRegen,null);assert.equal(r.totalCombatPower,null);
 const alternate=items.createItem(weapon===training?iron:training,{id:'B-preview'});g.hero.inventory.push(alternate);
 const snap=state(g),preview=value(packageB.previewPackageB(g,{itemId:alternate.id}));assert.equal(state(g),snap);assert.deepEqual(preview.ehp,r.ehp);
 evidence.push({case:'ACTUAL_B_'+weapon+'_'+allocation,input:a.input,result:r});g.dispose();
});
for(const [level,ranks] of [[1,[1,0,0]],[2,[1,0,1]],[8,[1,0,2]],[14,[5,5,3]]])await test('Actual paid Heal '+ranks[2]+' capacity / physical hurtHero / fullHP cost',()=>{
 const g=game(level,ranks,training,'neutral',true),r=value(packageB.readPackageB(g)),before=state(g);
 if(!ranks[2]){assert(r.channels.every(c=>c.withHeal.usableHeal===0));assert.equal(state(g),before);g.dispose();return;}
 const s=rules.derivedStats(g.hero),capacity=Math.round(s.maxHP*[6,8,10][ranks[2]-1]/100);g.rand=()=>.99;
 const hp=g.hero.hp,damage=100;g.hurtHero(damage);near(hp-g.hero.hp,damage*(500+10*level)/(s.physicalDefense+500+10*level));
 assert.equal(packageB.readPackageB(g).code,'TEMPORARY_DEFENSE_STATE');
 const missing=s.maxHP-g.hero.hp,mp=g.hero.mana;assert(g.castSkill(3));near(g.hero.hp-hp+missing,Math.min(capacity,missing));assert.equal(mp-g.hero.mana,[8,10,12][ranks[2]-1]);assert(!g.castSkill(3));
 const full=game(level,ranks);const fullMana=full.hero.mana;assert(full.castSkill(3));assert.equal(full.hero.hp,rules.maxHP(full.hero));assert.equal(fullMana-full.hero.mana,[8,10,12][ranks[2]-1]);full.dispose();
 evidence.push({case:'ACTUAL_HEAL_'+ranks[2],capacity,result:r});g.dispose();
});
await test('Mechanical exposure event order, death cancels delayed impact, trigger, lock and no second Mana pool',()=>{
 const g=game(),a=value(diagnostic.readActualAdventurerDiagnostic(g));
 const h=ids[2],basic=a.actions.find(x=>x.id==='basic'),heal=a.actions.find(x=>x.channel==='heal');
 const actor={...a,actions:[{...basic,delay:1,lock:0},{...heal,mana:10,cooldown:6,lock:0,delay:0,healCapacity:20}],resources:{...a.resources,maxMana:10,recovery:0},clocks:{...a.clocks,basicInterval:2,attackSpeed:100,thirdDelay:0,comboLifetime:1}};
 const means=[{id:'basic',expectedInflicted:5},{id:h,expectedInflicted:null}];
 const dead=nominal.produceNominalEvents(actor,['basic'],means,{maxHP:10,useHeal:true,packets:[{at:1,damage:10}]});
 assert(dead.ok);assert.equal(dead.exposure.deathAt,1);assert.equal(dead.exposure.expectedOffense,0);assert.equal(dead.exposure.canceledImpacts,1);assert.equal(dead.exposure.finalMana,10);
 const live=nominal.produceNominalEvents(actor,['basic'],means,{maxHP:100,useHeal:true,packets:[{at:1,damage:19},{at:2,damage:1},{at:3,damage:21}]});
 assert(live.ok);assert.equal(live.exposure.usableHeal,20);assert.equal(live.exposure.paidMana,10);assert.equal(live.exposure.finalHP,79);assert.equal(live.exposure.trace.find(e=>e.kind==='cast'&&e.id===h).at,2);
 const order=live.exposure.trace.filter(e=>e.at===1).map(e=>e.kind);assert.deepEqual(order,['incoming','impact']);
 assert(!nominal.produceNominalEvents(actor,['basic'],means,{maxHP:100,useHeal:true,packets:[{at:30,damage:10}]}).ok);
 const locked={...actor,actions:actor.actions.map(x=>({...x,lock:4}))},lockrun=nominal.produceNominalEvents(locked,['basic'],means,{maxHP:100,useHeal:true,packets:[{at:1,damage:20}]});assert(lockrun.ok);assert.equal(lockrun.exposure.trace.find(e=>e.kind==='cast'&&e.id===h).at,4);
 const delayed={...actor,actions:actor.actions.map(x=>({...x,delay:30}))};assert.equal(value(nominal.produceNominalEvents(delayed,['basic'],means,{maxHP:100,useHeal:true,packets:[]})).events.length,0);
 evidence.push({case:'MECHANICAL_DEADLINES',dead:dead.exposure,live:live.exposure});g.dispose();
});
await test('Real shop/travel/death/respawn/save parse and read purity; no policy enrollment',async()=>{
 const g=game(14,[5,5,3],training,'neutral',false),r=value(packageB.readPackageB(g));
 const other=items.createItem(iron,{id:'owned-iron'});g.hero.inventory.push(other);assert(g.equipItem(other.id,'mainHand'));
 assert(g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true}).ok);
 const npc=CITIES.arunika.npcList.find(n=>n.service==='equipment');
 window.dispatchEvent=()=>true;g.hero.gold=2000;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);
 assert(g.openNpc(npc.id));assert(g.npcBuy(training));assert(g.getDevelopmentAdventurerRange().ok);
 const snap=state(g);for(let n=0;n<3;n++)value(packageB.previewPackageB(g,{allocate:['vit']}));assert.equal(state(g),snap);
 let release;g.waitForRegionLoads=()=>new Promise(done=>release=done);assert(g.changeRegion('verdant-plains-v2'));assert(!packageB.readPackageB(g).ok);release();await new Promise(done=>setImmediate(done));assert(g.getDevelopmentAdventurerRange().ok);
 // Transition grants existing two-second protection: unavailable until ordinary clock elapses.
 assert.equal(packageB.readPackageB(g).code,'TEMPORARY_DEFENSE_STATE');
 g.invincible=0; // MECHANICAL offline removal of presentation/load protection, not browser reuse proof.
 const post=value(packageB.readPackageB(g));near(post.ehp.geometric,r.ehp.geometric);
 g.rand=()=>.99;g.hurtHero(1e9);assert(g.dead);assert(!packageB.readPackageB(g).ok);assert(!g.castSkill(3));g.respawn();assert(!g.dead);assert(g.getDevelopmentAdventurerRange().ok);
 g.save();const fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);fresh.started=true;
 assert.equal(fresh.getDevelopmentAdventurerRange(),null);assert.equal(fresh.hero.skillLevels[ids[2]],3);assert.equal(fresh.hero.equipment.mainHand,other.id);
 const saved=fresh.hero.inventory.find(i=>i.id===other.id);assert(saved&&saved!==other);fresh.invincible=0;value(packageB.readPackageB(fresh));assert.equal(fresh.getDevelopmentAdventurerRange(),null);
 fresh.hero.activeBuffs.damageReduction=1;assert(!packageB.readPackageB(fresh).ok);fresh.dispose();g.dispose();
});

