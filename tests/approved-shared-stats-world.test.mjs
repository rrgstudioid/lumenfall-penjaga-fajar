// ACTUAL Game consumers; rendering/audio/DOM ONLY are offline stubs.
// All targets, schedules and RNG values below are MECHANICAL FIXTURE, NOT CP policy.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {createServer} from 'vite';
const output=process.env.DIAGNOSTIC_CHECKPOINT;
assert(output,'Isolated evidence directory required');
const storage=new Map(),memory={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const element=()=>({style:{},children:[],clientWidth:1600,clientHeight:1000,appendChild(x){this.children.push(x);},setAttribute(){},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1600,height:1000}),remove(){},getContext:()=>({clearRect(){},fillRect(){}})});
Object.assign(globalThis,{localStorage:memory,devicePixelRatio:1,window:{localStorage:memory,location:{hostname:'localhost',pathname:'/tests/diagnostic'},addEventListener(){},removeEventListener(){}},document:{querySelector:()=>null,createElement:element,addEventListener(){},removeEventListener(){}},ResizeObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},requestAnimationFrame:()=>0});
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},cacheDir:path.join(output,'cache'),server:{middlewareMode:true,hmr:false},resolve:{alias:{'@':process.cwd()}},plugins:[{name:'offline-render-only',enforce:'pre',resolveId(id){if(id==='virtual:diagnostic-three')return '\0diagnostic-three';},load(id){if(id==='\0diagnostic-three')return `export * from 'three'; export class WebGLRenderer {shadowMap={};domElement={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};pixelRatio=1;setPixelRatio(v){this.pixelRatio=v;}getPixelRatio(){return this.pixelRatio;}setSize(){}render(){}dispose(){}forceContextLoss(){}}`;},transform(source,id){if(id.replaceAll('\\','/').endsWith('/lib/game/world.ts'))return source.replace("import * as T from 'three';","import * as T from 'virtual:diagnostic-three';");}}]});
const load=n=>server.ssrLoadModule('/lib/game/'+n+'.ts'),{Game}=await load('world'),rules=await load('rules'),items=await load('items');
const evidence=[];after(async()=>{await server.close();fs.writeFileSync(path.join(output,'approved-stats-world-evidence.json'),JSON.stringify(evidence,null,2));});

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
