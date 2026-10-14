// ACTUAL Game consumers; rendering/audio/DOM ONLY are offline stubs.
// All targets, schedules and RNG values below are MECHANICAL FIXTURE, NOT CP policy.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {createServer} from 'vite';
const output=process.env.FINAL_STAT_CHECKPOINT;
assert(output,'Isolated evidence directory required');
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/diagnostic'},addEventListener(){},removeEventListener(){}},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:diagnostic-three')return '\0diagnostic-three';},load(id){if(id==='\0diagnostic-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:diagnostic-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items');
const evidence=[];
const {ADVENTURER_V3_RUNTIME_SKILLS}=await load('adventurer-v3');
const {targetIdentity}=await load('targeting');

const awaitModifier=await load('combat-modifiers');
for(const n of ['buildTerrain','buildShrine','buildEnemies','buildRegionDecor','placeActor','createPlayerStatusLabel','updateTargetPresentation','rebuildHeroAppearance','drawMap'])Game.prototype[n]=function(){};
Game.prototype.buildHero=function(){this.characterModel={animator:{play(){},update(){},reset(){}},ready:Promise.resolve(true),updateVisual(){},setQuality(){},dispose(){}};};
const ids=['v3-adventurer-quick-slash','v3-adventurer-power-strike','v3-adventurer-minor-heal'];
const training='field-verdant-plains-sword';

const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
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

await test('actual hurtHero Block physical-direct eligibility, no source no Block draw; periodic/unblockable use full post-defense amount',()=>{
 const run=(kind,blockable,source)=>{
  const g=game(2,[1,1,0]);g.hero.hp=200;
  if(source)g.hero.temporaryModifiers=[{remaining:10,modifier:{id:'MECHANICAL BLOCK SOURCE',stats:{flat:{blockRate:90}}}}];
  let draws=0;g.rand=()=>{draws++;return draws===1?.99:0;};
  const s=rules.derivedStats(g.hero),before=g.hero.hp;g.hurtHero(100,'MECHANICAL PHYSICAL',undefined,kind,blockable);
  const expected=100*520/(520+s.physicalDefense)*(source&&kind==='direct'&&blockable?.7:1);
  near(before-g.hero.hp,expected);assert.equal(draws,source&&kind==='direct'&&blockable?2:1);
  evidence.push({case:'actual-block',kind,blockable,source,draws,expected,delta:before-g.hero.hp});g.dispose();
 };
 run('direct',true,true);run('dot',true,true);run('direct',false,true);run('direct',true,false);
});
await test('original Game tick continuous recovery active/pause/dead/transition, no offline catchup and exact clamp',()=>{
 const g=game(2,[1,1,0]);g.hero.hp=100;let time=1000;g.lastTime=time;
 g.crystal=new T.Group(); // Offline visual stub; actual tick/recovery untouched.
 const calls=[];const original=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{calls.push(1);return original(...args);};
 const advance=()=>{time+=20;g.tick(time);};
 const s=rules.derivedStats(g.hero);advance();near(g.hero.hp,100+.02*s.hpRecovery);
 g.paused=true;advance();const paused=g.hero.hp;advance();assert.equal(g.hero.hp,paused);
 g.paused=false;g.transitioning=true;time+=10000;g.tick(time);assert.equal(g.hero.hp,paused);
 g.transitioning=false;advance();near(g.hero.hp,paused+.02*s.hpRecovery);
 g.dead=true;g.hero.hp=0;advance();assert.equal(g.hero.hp,0);g.dead=false;g.hero.hp=s.maxHP-.001;advance();assert.equal(g.hero.hp,s.maxHP);
 assert(calls.length>0);evidence.push({case:'actual-tick-recovery',activeDt:.02,rate:s.hpRecovery,pause:true,transition:true,dead:true});g.dispose();
});
await test('original temporary buff expiry clamps both resources without refill; saved state roundtrip/defaultOFF',()=>{
 const g=game(2,[1,1,0]);const {addTemporaryModifier}=awaitModifier;
 g.hero.hp=100;g.hero.mana=10;addTemporaryModifier(g.hero,{id:'MECHANICAL RESOURCE SOURCE',stats:{percent:{maxHP:50,maxMana:50}}},1);
 g.stepSkillRuntime(.1);assert.equal(g.hero.hp,100);assert.equal(g.hero.mana,10);
 const elevated=rules.derivedStats(g.hero);g.hero.hp=elevated.maxHP;g.hero.mana=elevated.maxMana;g.stepSkillRuntime(1);
 const now=rules.derivedStats(g.hero);assert.equal(g.hero.hp,now.maxHP);assert.equal(g.hero.mana,now.maxMana);assert.equal(g.hero.maxMana,now.maxMana);
 g.hero.hp=42;g.hero.mana=12;g.save();const fresh=new Game(element(),element(),element(),()=>{},()=>{},g.hero.slotId);fresh.started=true;
 assert.equal(fresh.hero.hp,42);assert.equal(fresh.hero.mana,12);assert.equal(fresh.getDevelopmentAdventurerRange(),null);
 assert.equal(fresh.hero.level,2);assert.equal(fresh.hero.skillLevels[ids[1]],1);fresh.dispose();g.dispose();
});


await test('MECHANICAL declared VCT/FCT/charge -> original applySkill/SkillHitQueue -> original physical HP impact, no early effect',async()=>{
 const g=game(11,[1,0,0],training,'dex');assert.equal(rules.derivedStats(g.hero).castStat,40);
 const definition={...ADVENTURER_V3_RUNTIME_SKILLS[0],castTiming:{vct:2,fct:.4,chargeTime:.3},actionLockDuration:.6,
 baseDamageMinByRank:undefined,baseDamageMaxByRank:undefined,skillPowerFactor:0,rankPowerFactorByRank:[1],
 statScaling:{str:0},physicalCoefficient:0,baseDamage:10,rankValues:[{baseDamage:10,physicalCoefficient:0,statScaling:{str:0}}]};
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
 group.position.copy(g.actor.position).add(new T.Vector3(0,0,-1));
 const enemy={id:9000,group,home:group.position.clone(),hp:1000,max:1000,boss:false,dummy:false,spawnGeneration:0,respawnKey:'MECHANICAL TIMING',
 definition:{defense:0,magicDefense:0},ring:new T.Mesh(new T.RingGeometry(),new T.MeshBasicMaterial()),windup:0,cooldown:0,flash:0,stun:0,slow:0,root:0,poison:0,defenseDown:0,statusEffects:{},attack:10,attackRange:2,movementSpeed:1,evasion:0,marked:false,weakPoint:false};
 g.scene.add(group);g.enemies.push(enemy);g.registerTargetEnemy(enemy);assert(g.setCurrentTarget(enemy));
 const stats=rules.derivedStats(g.hero),before=JSON.stringify(g.hero),a=rules.resolveHeroSkill(g.hero,definition,1,stats);
 near(a.castTiming.vct,1.8);near(a.castTiming.fct,.4);near(a.castTiming.chargeTime,.3);near(a.hitSequence[0].delay,2.5);near(a.actionLockDuration,.6);assert.equal(JSON.stringify(g.hero),before);
 a.targetIdentity=targetIdentity(enemy,g.regionBuildToken);
 let draws=0;g.rand=()=>{draws++;return .99;};g.applySkill(definition,1,undefined,a,stats);
 assert.equal(g.skillHits.size,1);assert.equal(enemy.hp,1000);g.skillHits.update(2.499);assert.equal(enemy.hp,1000);
 g.skillHits.update(.0011);assert.equal(enemy.hp,990);assert.equal(g.skillHits.size,0);assert.equal(draws,2);
 evidence.push({case:'ORIGINAL_QUEUE_EXPLICIT_TIMING',VCT:1.8,FCT:.4,charge:.3,delay:2.5,HPdelta:10,draws,source:'MECHANICAL ONLY, not player skill content'});
 g.dispose();
});

after(async()=>{await server.close();fs.writeFileSync(path.join(output,'final-stats-world-evidence.json'),JSON.stringify(evidence,null,2));});

