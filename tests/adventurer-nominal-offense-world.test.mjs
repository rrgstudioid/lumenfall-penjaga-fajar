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
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items'),diagnostic=await load('adventurer-diagnostic-v2');
const evidence=[];after(async()=>{await server.close();fs.writeFileSync(path.join(output,'nominal-evidence.json'),JSON.stringify(evidence,null,2));});

const producer=await load('adventurer-ranks-reference-v2');
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
function target(g){const group=new T.Group();group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));const e={id:++serial,group,home:group.position.clone(),hp:10000,max:10000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'mechanical-'+serial,definition:{defense:70,magicDefense:0},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:999999,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:0,attackRange:0,movementSpeed:0,evasion:0,marked:false,weakPoint:false};g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));return e;}
const nominal=await load('adventurer-nominal-offense-v3');
function state(g){return JSON.stringify({hero:g.hero,seed:g.seed,clock:g.combatTime,CD:g.skillCooldowns,timer:g.attackTimer,queue:g.skillHits.size,range:g.getDevelopmentAdventurerRange(),renew:g.getDevelopmentAdventurerRenewal(),storage:[...storage]});}
const gates=[[1,3,6,9,13],[2,7,10,12,14]];
await test('Original city merchant inventory clone renews only prior valid policy; failed buy and OFF preserved',async()=>{
 const {CITIES}=await load('regions');
 for(const active of [true,false]){
  const g=game(8,[3,2,2],training,'neutral',active),npc=CITIES.arunika.npcList.find(n=>n.service==='equipment');
  window.dispatchEvent=()=>true;
  g.hero.gold=2000;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);assert(g.openNpc(npc.id));
  const old=g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand);g.skillCooldowns[ids[0]]=2;
  assert(g.npcBuy(iron));assert.notEqual(g.hero.inventory.find(i=>i.id===g.hero.equipment.mainHand),old);
  assert.equal(g.skillCooldowns[ids[0]],2);assert.equal(g.getDevelopmentAdventurerRange()?.ok,active?true:undefined);
  // Existing npcBuy saves even a rejected request: timestamp is not authority.
  const authority=()=>JSON.stringify({hero:{...g.hero,lastPlayedAt:0},range:g.getDevelopmentAdventurerRange(),renew:g.getDevelopmentAdventurerRenewal(),CD:g.skillCooldowns,seed:g.seed});
  const after=authority();assert(!g.npcBuy('missing-template'));assert.equal(authority(),after);
  if(active){const item=g.hero.inventory.find(i=>i.templateId===iron);assert(!g.equipItem(item.id,'mainHand'));assert(g.getDevelopmentAdventurerRange().ok);}
  evidence.push({case:'ORIGINAL_SHOP_CLONE',active,range:g.getDevelopmentAdventurerRange()});g.dispose();
 }
});
for(let skill=0;skill<2;skill++)for(let rank=1;rank<=5;rank++)await test(`Nominal actual paid rank ${skill}:${rank}, analytic oracle and independent ledger`,()=>{
 const ranks=skill===0?[rank,0,0]:[1,rank,0],g=game(gates[skill][rank-1],ranks),a=value(diagnostic.readActualAdventurerDiagnostic(g)),before=state(g),r=value(nominal.readNominalOffense(g));
 assert.equal(state(g),before);assert.equal(r.candidates.length,skill===0?2:4);assert.equal(r.totalCombatPower,null);
 const normal=Math.round(4+1.1*g.hero.level);assert.deepEqual(r.bank.map(t=>t.physicalDefense),[normal,normal*1.25,normal*1.5]);
 // Independent threshold integral (bounded low-damage mechanical oracle), not midpoint-final.
 const rounded=(lo,hi)=>{if(lo===hi)return Math.round(lo);let sum=0;for(let n=Math.floor(lo);n<=Math.ceil(hi);n++)sum+=n*Math.max(0,Math.min(hi,n+.5)-Math.max(lo,n-.5));return sum/(hi-lo);};
 for(const action of r.actions){const m=action.id==='basic'?{coefficient:1,bonusSTRCoefficient:0}:producer.adventurerReferenceSkillMetadata(action.id,action.rank);const lo=(7+Math.floor(g.hero.level*1.1)+9)*m.coefficient,hi=(7+Math.floor(g.hero.level*1.1)+11)*m.coefficient;
  // Neutral BonusDEX0 means Accuracy90; Evasion10 gives pHit .90, not old .915.
  // Keep the independent oracle explicit; do not read the evaluator's returned probability.
  assert.equal(a.stats.accuracy,90);
  // OWNER BonusDEX correction: neutral Crit2%; no compensation to old3.5%.
  let expected=0;for(const t of r.bank){assert.equal(t.evasion,10);const k=500+10*g.hero.level,f=k/(k+t.physicalDefense),p=.02;expected+=t.weight*.90*((1-p)*rounded(lo*f,hi*f)+p*rounded(lo*f*1.5,hi*f*1.5));}near(action.expectedInflicted,expected);
 }
 for(const c of r.candidates){let mana=a.resources.maxMana,t=0,paid=0,recovery=0,total=0,due=0,combo=0,expires=0;const ready={};for(const e of c.ledger.events){const action=a.actions.find(a=>a.id===e.id),rec=Math.min(a.resources.maxMana-mana,(e.at-t)*a.resources.recovery);mana+=rec;recovery+=rec;t=e.at;assert(mana>=action.mana);mana-=action.mana;paid+=action.mana;total+=r.actions.find(a=>a.id===e.id).expectedInflicted;assert(e.at<30&&e.impact<30);if(e.id==='basic'){assert(e.at>=due);combo=e.at<expires?combo%3+1:1;expires=e.at+1.1;due=e.at+(.46+(combo===3?.22:0))/(a.stats.attackSpeed/100);assert.equal(e.basicIndex,combo);}else{assert(e.at>=(ready[e.id]??0));ready[e.id]=e.at+action.cooldown;}}
  const rec=Math.min(a.resources.maxMana-mana,(30-t)*a.resources.recovery);mana+=rec;recovery+=rec;near(c.ledger.finalMana,mana);near(c.ledger.paidMana,paid);near(c.ledger.effectiveRecoveredMana,recovery);near(c.ledger.expectedInflictedTotal,total);near(c.variants.reduce((s,v)=>s+v.weightedTotal,0),total);
 }
 assert.equal(r.expectedTotal,Math.max(...r.candidates.map(c=>c.ledger.expectedInflictedTotal)));evidence.push({case:`RANK_${skill}_${rank}`,actor:a.input,result:r});g.dispose();
});
for(const weapon of [training,iron])for(const allocation of ['neutral','str','vit','dex','int','mixed'])await test(`Nominal ${weapon} ${allocation}, pure preview and actual cost invariance`,()=>{
 const g=game(14,[5,5,3],weapon,allocation,true),before=state(g),r=value(nominal.readNominalOffense(g));for(let i=0;i<3;i++)assert.deepEqual(value(nominal.readNominalOffense(g)),r);assert.equal(state(g),before);
 const alt=items.createItem(weapon===iron?training:iron,{id:'preview-owned'});g.hero.inventory.push(alt);const snap=state(g),p=value(nominal.previewNominalOffense(g,{itemId:alt.id}));assert(p.expectedDPS>0);assert.equal(state(g),snap);
 if(g.hero.statPoints>0){value(nominal.previewNominalOffense(g,{allocate:['str']}));assert.equal(state(g),snap);}else assert(!nominal.previewNominalOffense(g,{allocate:['str']}).ok);
 // Re-enable explicitly after mechanical inventory grant, then use original physical consumer.
 assert(g.enableDevelopmentAdventurerRanksReference({lifecycleRenewal:true}).ok);const e=target(g),mp=g.hero.mana;g.rand=()=>.5;assert(g.castSkill(1));assert(e.hp<10000);assert.equal(mp-g.hero.mana,5);assert.equal(g.skillCooldowns[ids[0]],2.8);near(value(nominal.readNominalOffense(g)).expectedDPS,r.expectedDPS);assert(!g.castSkill(1));near(value(nominal.readNominalOffense(g)).expectedDPS,r.expectedDPS);
 evidence.push({case:`CONTRAST_${weapon}_${allocation}`,result:r,preview:p,actualHP:e.hp});g.dispose();
});
await test('Mechanical policy ties, independent clocks, affordability, terminal and limits',()=>{
 const g=game(),a=value(diagnostic.readActualAdventurerDiagnostic(g)),q=ids[0],p=ids[1];
 const altered={...a,actions:a.actions.map(x=>x.id==='basic'?{...x}:({...x,mana:5,cooldown:6,lock:0,delay:0})),resources:{...a.resources,maxMana:10,recovery:0}};
 const means=[{id:'basic',expectedInflicted:1},{id:q,expectedInflicted:10},{id:p,expectedInflicted:10}];
 const schedule=value(nominal.produceNominalEvents(altered,['basic',q,p],means));assert.deepEqual(schedule.events.slice(0,3).map(e=>e.id),[p,q,'basic']);assert.equal(schedule.events.filter(e=>e.id!=='basic').length,2);
 const poor={...altered,resources:{...altered.resources,maxMana:4,recovery:1}};assert(value(nominal.produceNominalEvents(poor,['basic',q,p],means)).events.every(e=>e.id==='basic'));
 const zero={...altered,actions:altered.actions.map(x=>x.id===q?{...x,mana:0}:x)};assert.equal(nominal.produceNominalEvents(zero,['basic',q],means).code,'UNSUPPORTED_COST_OR_CLOCK');
 const fast={...a,clocks:{...a.clocks,basicInterval:.00001,thirdDelay:0}};assert.equal(nominal.produceNominalEvents(fast,['basic'],means).code,'SUPPORTED_EVENT_LIMIT');
 const delayed={...a,actions:a.actions.map(x=>({...x,delay:30}))};assert.equal(value(nominal.produceNominalEvents(delayed,['basic',q,p],means)).events.length,0);
 const regen={...altered,resources:{...altered.resources,maxMana:6,recovery:1}};const s=value(nominal.produceNominalEvents(regen,['basic',q],means));assert(s.events.some(e=>e.id===q&&e.at===6));g.dispose();
});
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
await test('Original changeRegion successful transaction preserves cooldown, exact binding and nominal map invariance',async()=>{
 const g=game(10,[4,3,2],training,'neutral',true),before=value(nominal.readNominalOffense(g));g.skillCooldowns[ids[0]]=2.25;
 let release;g.waitForRegionLoads=()=>new Promise(r=>release=r);assert(g.changeRegion('verdant-plains-v2'));assert.equal(g.getDevelopmentAdventurerRange().ok,false);assert(!nominal.readNominalOffense(g).ok);assert(!g.changeRegion('averion'));release();await flush();
 assert(g.getDevelopmentAdventurerRange().ok);assert.equal(g.getDevelopmentAdventurerRenewal().reason,'successful region transaction');assert.equal(g.skillCooldowns[ids[0]],2.25);near(value(nominal.readNominalOffense(g)).expectedDPS,before.expectedDPS);assert(g.changeRegion('averion'));release();await flush();assert(g.getDevelopmentAdventurerRange().ok);evidence.push({case:'TRAVEL_SUCCESS',renew:g.getDevelopmentAdventurerRenewal(),cooldown:g.skillCooldowns[ids[0]],nominal:before.expectedDPS});g.dispose();
});
for(const kind of ['off','failure','hero-replacement','item-replacement','unsupported','cancel','superseded','dispose'])await test(`Original travel ${kind} cannot renew`,async()=>{
 const g=game(10,[4,3,2],training,'neutral',kind!=='off');let release,reject;g.waitForRegionLoads=()=>new Promise((r,j)=>{release=r;reject=j;});assert(g.changeRegion('verdant-plains-v2'));
 if(kind==='failure')reject(new Error('MECHANICAL load failure'));else{if(kind==='hero-replacement')g.hero=structuredClone(g.hero);if(kind==='item-replacement')g.hero.inventory=g.hero.inventory.map(i=>({...i}));if(kind==='unsupported')g.hero.statPoints++;if(kind==='cancel')g.clearSkillRuntime();if(kind==='superseded')g.regionBuildToken++;if(kind==='dispose')g.dispose();release();}await flush();assert(!g.getDevelopmentAdventurerRange()?.ok);if(kind==='failure'){g.waitForRegionLoads=()=>Promise.resolve();assert(g.retryLocationLoad());await flush();assert(!g.getDevelopmentAdventurerRange()?.ok);}if(!g.disposed)g.dispose();
});
await test('Preview rejects old Iron, malformed allocation and inactive lifecycle; actual save/new Game OFF',()=>{
 const g=game(14,[5,5,3],iron,'neutral',true),old=items.createItem(iron,{id:'old'});delete old.authoredAttackVersion;old.levelRequirement=8;g.hero.inventory.push(old);assert(!nominal.previewNominalOffense(g,{itemId:'old'}).ok);assert(!nominal.previewNominalOffense(g,{allocate:['sta']}).ok);assert(!nominal.previewNominalOffense(g,{allocate:Array(27).fill('str')}).ok);
 g.save();const fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);fresh.started=true;assert.equal(fresh.getDevelopmentAdventurerRange(),null);value(nominal.readNominalOffense(fresh));fresh.dispose();g.dead=true;assert(!nominal.readNominalOffense(g).ok);g.dispose();
});
