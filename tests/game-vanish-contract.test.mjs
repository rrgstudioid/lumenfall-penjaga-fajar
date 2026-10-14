// Offline Game integration. Real constructor/state/cast/damage methods;
// graphics, DOM, audio and storage are synthetic. This is NOT browser parity.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import * as T from 'three';
import ts from 'typescript';

const storage = new Map();
const memory = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
const element = () => ({ style: {}, children: [], clientWidth: 1600, clientHeight: 1000,
  appendChild(x) { this.children.push(x); }, setAttribute() {}, addEventListener() {}, removeEventListener() {},
  getBoundingClientRect: () => ({left:0,top:0,width:1600,height:1000}), remove() {},
  getContext: () => ({clearRect() {}, fillRect() {}}) });
Object.assign(globalThis, { localStorage: memory, devicePixelRatio: 1,
  window: {localStorage:memory,location:{hostname:'localhost',pathname:'/tests/offline'},addEventListener() {},removeEventListener() {}},
  document: {createElement:element,addEventListener() {},removeEventListener() {}},
  ResizeObserver: class { observe() {} disconnect() {} }, cancelAnimationFrame() {} });
const server = await createServer({ configFile:false, appType:'custom', server:{middlewareMode:true},
  resolve:{alias:{'@':process.cwd()}}, plugins:[{
    name:'offline-vanish-renderer-only', enforce:'pre',
    resolveId(id) { if(id==='virtual:vanish-test-three') return '\0vanish-test-three'; },
    load(id) { if(id==='\0vanish-test-three') return `export * from 'three';
      export class WebGLRenderer { shadowMap={}; domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
      setPixelRatio(){} setSize(){} dispose(){} forceContextLoss(){} }`; },
    transform(source,id) { if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))
      return source.replace("import * as T from 'three';", "import * as T from 'virtual:vanish-test-three';"); }
  }] });
after(async () => { await server.close(); });
const load = path => server.ssrLoadModule('/lib/game/'+path+'.ts');
const {Game} = await load('world');
const rules = await load('rules');
const {createItem} = await load('items');
const {VanishState} = await load('vanish');
const {RogueAmbushState} = await load('rogue-ambush');
const {migrateVanishSkillMap} = await load('vanish-migration');
const {enterStealth,isStealthed} = await load('stealth');
const {ROGUE_V3_RUNTIME_SKILLS} = await load('rogue-v3');
const {ASSASIN_V3_RUNTIME_SKILLS} = await load('assasin-v3');
const runtimeSkills = [...ROGUE_V3_RUNTIME_SKILLS,...ASSASIN_V3_RUNTIME_SKILLS];
const skill = id => runtimeSkills.find(s=>s.id===id);
const renderMethods = ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation'];
// Never stub constructor, snapshot/feedback, combat, activation or cleanup.
for (const name of renderMethods) Game.prototype[name] = function() {};
Game.prototype.buildHero = function() { this.characterModel={animator:{play(){}},ready:Promise.resolve(true),dispose(){}}; };
let serial=0;
function hero(job='rogue') {
  const h=rules.createV3AdventurerHero('contract-'+(++serial));
  h.level=70; h.skillProgressionV3.totalEarnedSP=rules.getTotalSkillPointsForLevel(h.level);
  for(const slot of Object.keys(h.equipment)) if(h.equipment[slot]) rules.unequipItem(h,slot);
  assert(rules.chooseV3Thief(h));
  assert((job==='rogue'?rules.chooseV3Rogue:rules.chooseV3Assasin)(h));
  const ranks=job==='rogue'?{'dual-dagger-mastery':3,crosscut:3,slipstep:2,vanish:1,backpierce:3,'deadly-opportunity':1,'perfect-ambush':1,'razor-flurry':1}:
    {'venom-mastery':3,vanish:1,'poison-dagger':3,'venom-eclipse':1};
  for(const [slug,n] of Object.entries(ranks)) for(let i=0;i<n;i++) assert(rules.learnSkill(h,`v3-${job}-${slug}`),`legal purchase ${slug}`);
  for(const slot of ['mainHand','offHand']) { const item=createItem('whispering-offhand-dagger',{id:h.slotId+'-'+slot});h.inventory.push(item);assert(rules.equipItem(h,item.id,slot).ok); }
  h.hp=rules.derivedStats(h).maxHP; h.mana=rules.derivedStats(h).maxMana;
  return h;
}
function game(h=rules.createV3AdventurerHero('factory-'+(++serial))) {
  storage.clear(); rules.saveCharacter(h,true);
  const snapshots=[];
  const g=new Game(element(),element(),element(),s=>snapshots.push(s),()=>{},h.slotId);
  assert(snapshots.length>0,'actual constructor emit reached');
  g.started=true;
  // Peripheral effects only; no attacks/activation/state methods replaced.
  g.float=()=>{};g.sound=()=>{};g.effect=()=>{};g.ring=()=>{};g.pulse=()=>{};g.arc=()=>{};
  g.snapshots=snapshots;
  return g;
}
function target(g,distance=1) {
  const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
  group.position.copy(g.actor.position).add(new T.Vector3(0,0,-distance));
  const e={id:1,group,home:group.position.clone(),hp:100000,max:100000,boss:false,dummy:true,
    spawnGeneration:0,ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),
    windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,
    statusEffects:{},attack:10,attackRange:2,movementSpeed:1,marked:false,weakPoint:false};
  g.scene.add(group);g.enemies.push(e);g.registerTargetEnemy(e);assert(g.setCurrentTarget(e));assert(g.getCurrentTarget()===e);return e;
}
function activate(g) {
  const id=`v3-${g.hero.specialization}-vanish`;
  assert(g.castSkill(id),'real cast Vanish accepted');assert(g.vanish.status(g.hero));return id;
}
const opportunity = {id:'unit-skill',targetType:'single',rogueAmbush:{ambushEligible:true}};
const hit={damageMultiplier:1};

await test('T01 actual Game constructor reaches snapshot for factory, Rogue and Assassin',()=>{
  for(const h of [rules.createV3AdventurerHero('factory-boot'),hero(),hero('assasin')]){
    const g=game(h);assert.equal(g.hero.skillArchitectureVersion,3);
    assert.equal(g.vanish.status(g.hero),null);
    assert(!g.combatFeedbackSnapshot().indicators.some(x=>/vanish|ambush/.test(x.id)));
  }
});
await test('T01 no caller invokes removed concealment APIs or obsolete generator',()=>{
  const source=fs.readFileSync('lib/game/world.ts','utf8');
  assert(!/\.concealed\(|\.conceal\(|\.breakConcealment\(|\.clearSelf\(|SMOKE_VEIL|concealmentDuration/.test(source));
  const ast=ts.createSourceFile('world.ts',source,ts.ScriptTarget.Latest,true);
  const unknown=[];function walk(n){if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
    const owner=n.expression.expression.getText(ast),method=n.expression.name.text;
    if(owner==='this.vanish'&&typeof VanishState.prototype[method]!=='function')unknown.push(method);
    if(owner==='this.transientCombat.rogueAmbush'&&typeof RogueAmbushState.prototype[method]!=='function')unknown.push(method);
  }ts.forEachChild(n,walk);}walk(ast);assert.deepEqual(unknown,[]);
});
await test('T02 legal cast pays once, prevents repeat and defers resolved cooldown until end',()=>{
  for(const job of ['rogue','assasin']){const g=game(hero(job)),id=`v3-${job}-vanish`,mana=g.hero.mana;
    const action=rules.resolveHeroSkill(g.hero,skill(id),1,rules.derivedStats(g.hero));activate(g);
    assert.equal(g.hero.mana,mana-action.manaCost);assert.equal(g.skillCooldowns[id]??0,0);
    const paid=g.hero.mana;assert.equal(g.castSkill(id),false);assert.equal(g.hero.mana,paid);
    g.combatTime=100000;assert(g.vanish.status(g.hero),'no expiry clock');
    g.vanish.end('RESET');assert.equal(g.skillCooldowns[id],action.cooldown);
    g.skillCooldowns[id]=100;assert.equal(g.vanish.end('RESET'),null);assert.equal(g.skillCooldowns[id],100);
  }
});
await test('T02 rejected rank/job/death/mana and weapon/target preserve resources and concealment',()=>{
  const g=game(hero()),id='v3-rogue-vanish';g.hero.mana=0;assert.equal(g.castSkill(id),false);assert.equal(g.vanish.status(g.hero),null);
  g.hero.mana=rules.derivedStats(g.hero).maxMana;activate(g);const before=g.hero.mana;
  assert.equal(g.castSkill('v3-rogue-crosscut'),false,'missing target');assert(g.vanish.status(g.hero));assert.equal(g.hero.mana,before);
  const e=target(g);e.group.position.z-=100;assert.equal(g.castSkill('v3-rogue-crosscut'),false);assert(g.vanish.status(g.hero));e.group.position.z+=100;
  g.hero.mana=0;assert.equal(g.castSkill('v3-rogue-crosscut'),false);assert(g.vanish.status(g.hero));
  g.hero.mana=before;rules.unequipItem(g.hero,'offHand');assert.equal(g.castSkill('v3-rogue-crosscut'),false);assert(g.vanish.status(g.hero));
  for(const mutate of [h=>{h.hp=0;},h=>{h.specialization='assasin';},h=>{delete h.skillProgressionV3.skillRanks[id];}]){
    const h=hero();mutate(h);const v=new VanishState(()=>{});assert.equal(v.activate(h,id,{job:'rogue'},30,id),false);
  }
});
await test('T03 required-Ambush opening is granted before begin; accepted miss does not consume',()=>{
  const g=game(hero()),e=target(g);e.evasion=rules.derivedStats(g.hero).accuracy+100;activate(g);assert(g.canCastSkill('v3-rogue-deadly-opportunity').ok);
  // Offline deterministic miss, not RNG override of any browser/runtime session.
  g.rand=()=>.999;assert(g.castSkill('v3-rogue-deadly-opportunity'),JSON.stringify({notice:g.notice,failure:g.lastActionFailure,mana:g.hero.mana,target:g.currentTargetView()}));
  assert.equal(g.vanish.status(g.hero),null);assert(g.transientCombat.rogueAmbush.status(g.hero,g.combatTime));
  g.skillHits.update(1);assert(g.transientCombat.rogueAmbush.status(g.hero,g.combatTime),'miss keeps opportunity');
});
await test('T03 successful opening consumes once; basic offense grants opportunity; Assassin never grants it',()=>{
  const g=game(hero());target(g);activate(g);g.rand=()=>.99;
  assert(g.castSkill('v3-rogue-deadly-opportunity'),JSON.stringify({notice:g.notice,failure:g.lastActionFailure,mana:g.hero.mana,target:g.currentTargetView()}));g.skillHits.update(1);
  assert.equal(g.transientCombat.rogueAmbush.status(g.hero,g.combatTime),null);
  for(const job of ['rogue','assasin']){const b=game(hero(job));target(b);activate(b);b.rand=()=>0;b.attack();
    assert.equal(b.vanish.status(b.hero),null);assert.equal(!!b.transientCombat.rogueAmbush.status(b.hero,0),job==='rogue');}
});
await test('T04 Ambush refresh, expiry boundary, delayed hits, competing casts and epoch invalidation',()=>{
  const h=hero(),a=new RogueAmbushState();assert(a.grantVanishOpening(h,'vanish',0));
  assert.equal(a.status(h,0).remaining,4);a.grantVanishOpening(h,'vanish',1);assert.equal(a.status(h,1).remaining,4);
  const first=a.begin(h,opportunity,1),second=a.begin(h,opportunity,1);
  assert.equal(first.resolveHit(hit,{},h,5).damageMultiplier,1.15,'snapshot survives natural expiry');
  assert.equal(a.status(h,5),null);assert.equal(first.commitDamage(h,5,0),false);assert(first.commitDamage(h,5,10));
  assert.equal(second.commitDamage(h,5,10),false);assert.equal(first.resolveHit(hit,{},h,6).damageMultiplier,1.15);
  a.clear();assert.equal(first.resolveHit(hit,{},h,6).damageMultiplier,1);
  for(const mutate of [x=>{x.hp=0;},x=>{x.characterId='different';},x=>{x.specialization='assasin';}]){
    const actor=hero();a.grantVanishOpening(actor,'vanish',0);const execution=a.begin(actor,opportunity,0);mutate(actor);assert.equal(execution.commitDamage(actor,1,10),false);
  }
});
await test('T04 positional override has no extra multiplier; side/rear movement only generates',()=>{
  const h=hero(),a=new RogueAmbushState();const slip=skill('v3-rogue-slipstep');
  for(const [x,z,expected]of [[0,-1,false],[1,0,true],[0,1,true]]){
    a.clear();const position={attackerPosition:{x,z},targetPosition:{x:0,z:0},targetForward:{x:0,z:-1}};
    assert.equal(a.generate(h,slip,0,{type:'REPOSITION_COMPLETE',moved:true,position}),expected);
    a.clear();assert.equal(a.generate(h,slip,0,{type:'REPOSITION_COMPLETE',moved:false,position}),false);
  }
  a.grantVanishOpening(h,'vanish',0);const e=a.begin(h,skill('v3-rogue-backpierce'),0);
  assert.equal(e.context({},h,0).positionOverride,'rear');assert.equal(e.resolveHit(hit,{},h,0).damageMultiplier,1);
});
await test('T05 direct HP/full barrier/partial barrier break; dot/parry/invincible do not',()=>{
  for(const kind of ['hp','full','partial','dot','parry','invincible','guard']){
    const g=game(hero());activate(g);g.rand=()=>.99;const hp=g.hero.hp;
    g.hero.barrier=kind==='full'?10000:kind==='partial'?1:0;
    if(kind==='parry')g.hero.statusEffects.parry=5;
    if(kind==='invincible')g.invincible=1;
    if(kind==='guard')g.blocking=true;
    g.hurtHero(100,'unit',undefined,kind==='dot'?'dot':'direct');
    assert.equal(!!g.vanish.status(g.hero),['dot','parry','invincible'].includes(kind),kind);
    assert.equal(g.transientCombat.rogueAmbush.status(g.hero,0),null);
    if(kind==='full')assert.equal(g.hero.hp,hp);
  }
  const h=hero(),v=new VanishState(()=>{});v.activate(h,'v3-rogue-vanish',{job:'rogue'},30,'v');
  for(const n of [0,-1,NaN,Infinity]){assert.equal(v.directDamage(n),null);assert(v.status(h));}
});
await test('T06 clearSkillRuntime cancels opening/presentation without clearing target Poison/Eclipse store',()=>{
  const g=game(hero());activate(g);g.transientCombat.rogueAmbush.grantVanishOpening(g.hero,'unit',0);
  const active=g.transientCombat.rogueAmbush.begin(g.hero,opportunity,0);
  const poison=g.assasinPoison,combat=g.assasinCombat;
  // Tripwires on prohibited blanket clear, not replacements for any allowed state API.
  poison.clear=()=>{throw Error('must not clear target poison');};combat.clear=()=>{throw Error('must not clear target Eclipse');};
  g.clearSkillRuntime();assert.equal(g.vanish.status(g.hero),null);assert.equal(g.transientCombat.rogueAmbush.status(g.hero,0),null);
  assert.equal(active.commitDamage(g.hero,0,10),false);assert.equal(g.rogueSmoke,undefined);assert.equal(g.vanishMaterials.size,0);
  assert.equal(g.assasinPoison,poison);assert.equal(g.assasinCombat,combat);g.clearSkillRuntime();
});
await test('T06 identity/rank/death invalidation invokes end once; cleanup callsites remain connected',()=>{
  for(const mutate of [h=>{h.characterId='new';},h=>{h.skillProgressionV3.chosenSpecialization='assasin';},h=>{delete h.skillProgressionV3.skillRanks['v3-rogue-vanish'];},h=>{h.hp=0;}]){
    const h=hero(),calls=[],v=new VanishState((s,r)=>calls.push([s,r]));assert(v.activate(h,'v3-rogue-vanish',{job:'rogue'},30,'key'));
    mutate(h);assert.equal(v.status(h),null);v.update(h);v.end('RESET');assert.equal(calls.length,1);
  }
  const source=fs.readFileSync('lib/game/world.ts','utf8'),ast=ts.createSourceFile('world.ts',source,ts.ScriptTarget.Latest,true);
  for(const name of ['changeRegion','selectCharacter','returnToMainMenu','chooseSpecialization','resetSkillPoints','resetSkillFamilyBranch','resetJobToAdventurer','hurtHero','dispose','syncCombatModifiers']){
    let method;function walk(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)===name)method=n;ts.forEachChild(n,walk);}walk(ast);
    assert(method?.getText(ast).includes('this.clearSkillRuntime()'),name);
  }
});
await test('T07 feedback keeps separate Ambush timer, indefinite Vanish and V2 timer',()=>{
  const g=game(hero());activate(g);g.transientCombat.rogueAmbush.grantVanishOpening(g.hero,'unit',0);enterStealth(g.hero,3);
  const rows=g.combatFeedbackSnapshot().indicators;assert.equal(rows.find(x=>x.id==='rogue-ambush').remaining,4);
  assert.equal(rows.find(x=>x.id==='vanish').remaining,undefined);assert.equal(rows.find(x=>x.id==='vanish').iconSkillId,'v3-rogue-vanish');
  assert.equal(rows.find(x=>x.id==='stealth').remaining,3);
});
await test('T07 detection is observer-local, reveal global, AI acquisition blocked without cancelling committed windup',()=>{
  const g=game(hero()),id=activate(g),owner=g.hero.characterId??g.hero.slotId;
  assert(g.vanish.canPerceive(g.hero,{actorId:owner}));assert(!g.vanish.canAcquireDirectTarget(g.hero,{actorId:'enemy:1'}));
  assert(g.vanish.canPerceive(g.hero,{actorId:'detector',canDetectStealth:()=>true}));assert(g.vanish.status(g.hero));
  g.hero.inCity=false;g.hero.currentField='whispering-wilds';g.hero.x=100;g.hero.z=100;
  const e=target(g,1);e.dummy=false;g.updateEnemy(e,.1);assert.equal(e.windup,0);
  g.vanish.reveal();g.updateEnemy(e,.1);assert(e.windup>0);assert(g.skillCooldowns[id]>0);
  // Unit state for an already committed windup: Vanish is not damage immunity.
  assert(g.vanish.activate(g.hero,id,{job:'rogue'},30,id));g.rand=()=>.99;g.updateEnemy(e,1);
  assert.equal(g.vanish.status(g.hero),null);
});
await test('T08 aliases idempotent without V2 rename; synthetic save never serializes Game Vanish/Ambush',()=>{
  const old={'v3-rogue-smoke-veil':2,'v3-rogue-vanish':1,'v2-thief-smoke-veil':3};
  const migrated=migrateVanishSkillMap(old);assert.deepEqual(migrated,{'v3-rogue-vanish':2,'v2-thief-smoke-veil':3});assert.deepEqual(migrateVanishSkillMap(migrated),migrated);
  const g=game(hero());activate(g);g.transientCombat.rogueAmbush.grantVanishOpening(g.hero,'unit',0);g.save();
  const restored=rules.loadCharacter(g.hero.slotId);assert(!('vanish' in restored));assert(!('rogueAmbush' in restored));
  assert.deepEqual(restored.skillProgressionV3.skillRanks,g.hero.skillProgressionV3.skillRanks);
  const g2=game(restored);assert.equal(g2.vanish.status(g2.hero),null);assert.equal(g2.transientCombat.rogueAmbush.status(g2.hero,0),null);
});
await test('T08 legacy V2 barrier policy stays separate from V3 Vanish',()=>{
  const g=game(hero());activate(g);enterStealth(g.hero,3,{breakOn:['received_damage']});g.hero.barrier=10000;g.rand=()=>.99;
  g.hurtHero(100);assert.equal(g.vanish.status(g.hero),null);assert(isStealthed(g.hero));
});

await test('T05/T06 real Poison and Eclipse casts continue ticking during Vanish and self cleanup',()=>{
  const g=game(hero('assasin')),e=target(g);g.rand=()=>.5;
  assert(g.castSkill('v3-assasin-poison-dagger'));g.stepSkillRuntime(1);
  assert(g.castSkill('v3-assasin-venom-eclipse'));g.stepSkillRuntime(1);
  const owner=g.hero.characterId??g.hero.slotId;
  assert(g.assasinPoison.getPoisonStacks(owner,e,0)>0);assert(g.assasinCombat.hasPending(e));
  activate(g);let damageCalls=0;const hurt=g.hurtEnemy.bind(g);
  g.hurtEnemy=(...args)=>{damageCalls++;return hurt(...args);};
  g.assasinPoison.advanceTarget(e,1);g.assasinCombat.advanceTarget(e,1);
  assert(damageCalls>=2);assert(g.vanish.status(g.hero));assert.equal(g.transientCombat.rogueAmbush.status(g.hero,g.combatTime),null);
  g.clearSkillRuntime();assert(g.assasinPoison.getPoisonStacks(owner,e,1)>0);assert(g.assasinCombat.hasPending(e));
  const count=damageCalls;g.assasinPoison.advanceTarget(e,2);g.assasinCombat.advanceTarget(e,2);assert(damageCalls>count);
});
await test('T06 Game death, rank removal and job identity sync clear authority and feedback',()=>{
  for(const mode of ['death','rank','identity']){
    const g=game(hero()),id=activate(g);
    if(mode==='death'){g.hero.hp=1;g.rand=()=>.99;g.hurtHero(100000);assert(g.dead);}
    if(mode==='rank'){delete g.hero.skillProgressionV3.skillRanks[id];g.syncCombatModifiers();}
    if(mode==='identity'){g.hero.specialization=null;g.hero.skillProgressionV3.chosenSpecialization=null;g.syncCombatModifiers();}
    assert.equal(g.vanish.status(g.hero),null);assert(g.skillCooldowns[id]>0);
    assert(!g.combatFeedbackSnapshot().indicators.some(x=>x.id==='vanish'));
  }
});
await test('T06 menu, character switch and dispose execute cleanup; new actor cooldown dictionary resets',()=>{
  const g=game(hero()),id=activate(g);g.returnToMainMenu();assert(!g.started);assert.equal(g.vanish.status(g.hero),null);assert(g.skillCooldowns[id]>0);
  const other=rules.createV3AdventurerHero('other-synthetic');rules.saveCharacter(other,true);
  g.selectCharacter(other.slotId);assert.equal(g.hero.slotId,other.slotId);assert.deepEqual(g.skillCooldowns,{});assert.equal(g.vanish.status(g.hero),null);
  const d=game(hero());activate(d);d.dispose();assert(d.disposed);assert.equal(d.vanish.status(d.hero),null);d.dispose();
});
await test('T06 successful existing town travel ends Vanish before asynchronous rebuild',async()=>{
  const g=game(hero()),id=activate(g);g.hero.inCity=false;g.hero.currentField='whispering-wilds';g.hero.currentCity='arunika';
  assert(g.changeRegion('arunika'),g.notice);assert.equal(g.vanish.status(g.hero),null);assert(g.skillCooldowns[id]>0);
  // Drain the test's rebuild task; all asset/render builders remain synthetic.
  for(let i=0;i<10&&g.transitioning;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(g.regionLoadError,null);assert.equal(g.hero.currentCity,'arunika');
});
