import {createRoot} from 'react-dom/client';
import Home from '../../../app/page';
import {registerDevelopmentHomeLifecycle} from '../../../lib/game/development-home-lifecycle';
import type {Game} from '../../../lib/game/world';
import * as rules from '../../../lib/game/rules';
import {createItem,addItemToInventory} from '../../../lib/game/items';
import {CITIES,type MonsterDefinition} from '../../../lib/game/regions';
import approved from '../../fixtures/warrior-specialization-approved-package.json';
let game:Game|null=null,generation=0,mechanicalId=90000;
const send=(v:object)=>{void fetch('/checkpoint-evidence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({UTC:new Date().toISOString(),...v})}).catch(()=>{});};
const state=(g:Game)=>{
 const h=g.hero,s=rules.derivedStats(structuredClone(h)),a=g.getDevelopmentSpecializationAvailability();
 return structuredClone({level:h.level,job:h.job,spec:h.specialization,id:h.characterId,slot:h.slotId,HP:h.hp,Mana:h.mana,maxHP:s.maxHP,maxMana:s.maxMana,stats:{STR:s.str,DEX:s.dex,accuracy:s.accuracy,Crit:s.criticalRate,CritDamage:s.criticalDamage,DR:s.damageReduction,AS:s.attackSpeed},allocation:{...h.allocatedStats},points:h.statPoints,SP:h.skillPoints,ledger:h.skillProgressionV3,items:h.inventory.filter(i=>Object.values(h.equipment).includes(i.id)).map(i=>({id:i.id,version:i.authoredAttackVersion,template:i.templateId,level:i.levelRequirement,base:i.baseStats})),hotbar:h.primaryHotbar,seed:g.seed,time:g.combatTime,queue:g.skillHits.size,cd:{...g.skillCooldowns},buffs:{...h.activeBuffs},paused:g.paused,dead:g.dead,transitioning:g.transitioning,region:g.activeLocationId,position:g.actor.position.toArray(),binding:a?{ok:a.ok,code:!a.ok?a.code:null}:null,renewal:g.getDevelopmentSpecializationRenewal(),range:g.getDevelopmentAdventurerRange(),targets:g.enemies.filter(e=>e.id>=90000).map(e=>({id:e.id,hp:e.hp,DEF:e.definition?.defense,position:e.group.position.toArray(),registered:g.targetEntities.get(e.id)===e,stun:e.stunState,armor:e.sourceOwnedStatuses?.defenseDown}))});
};
const record=(type:string,v:object={})=>{const current=game?state(game):null,event={type,generation,state:current,...v};send(event);document.querySelector('#readout')!.textContent=JSON.stringify({type,generation,level:current?.level,spec:current?.spec,HP:current?.HP,Mana:current?.Mana,SP:current?.SP,binding:current?.binding,...('accepted'in v?{accepted:v.accepted}:{}),...('result'in v?{result:v.result}:{})});};
window.addEventListener('error',e=>send({type:'PAGE_ERROR',message:e.message}));
window.addEventListener('unhandledrejection',e=>send({type:'REJECTION',message:String(e.reason)}));
type OracleSkill={id:string;currentRows:{rank:number;coefficient:number|null}[]};
const rows:OracleSkill[]=approved.families.flatMap(f=>f.skills as unknown as OracleSkill[]);
registerDevelopmentHomeLifecycle(event=>{
 if(event.type==='disposed'){record('HOME_DISPOSED');if(game===event.game)game=null;return;}
 game=event.game;generation++;const g=game;record('HOME_CREATED_DEFAULT_OFF',{browser:navigator.userAgent});
 const draws:object[]=[],impacts:object[]=[],feedback:object[]=[];let pendingHit=false;
 const rand=g.rand.bind(g);g.rand=function(...args){
  const seed=this.seed,stack=new Error().stack??'',value=Reflect.apply(rand,this,args);
  const visual=/Game\.(effect|ring|pulse|arc|update)/.test(stack);
  const category=stack.includes('sampleRawAttackExecution')?'ATTACK':stack.includes('resolveHitAgainstEvasion')?'HIT':pendingHit&&!visual?'CRIT':'VISUAL_OR_OTHER';
  pendingHit=category==='HIT';draws.push({value,seed,after:this.seed,category,callsite:stack.split('\n').slice(1,4).map(line=>line.trim().replace(/http[^ )]+/g,'module')).join(' | ')});if(draws.length>2000)draws.splice(0,1000);return value;
 };
 const hurt=g.hurtEnemy.bind(g);g.hurtEnemy=function(...args){
  const e=args[0],before=e.hp,strength=Math.max(0,...(e.sourceOwnedStatuses?.defenseDown??[]).filter(a=>a.expiresAt>g.combatTime).map(a=>a.strength));
  const defense=(e.definition?.defense??0)*(1-strength/100),denominator=500+10*(args[5]??g.hero.level),expected=args[7]==='REFERENCE_B_FINAL'?Math.round(args[1]*denominator/(denominator+defense)):args[1]*denominator/(denominator+defense);
  const result=Reflect.apply(hurt,this,args),proof={id:e.id,raw:args[1],before,after:e.hp,defense,level:args[5],policy:args[7],expected,HPmatches:Math.abs(e.hp-Math.max(0,before-expected))<1e-8};impacts.push(proof);send({type:'IMPACT',generation,time:g.combatTime,...proof});return result;
 };
 const float=g.float.bind(g);g.float=function(...args){feedback.push({text:args[1],kind:args[2]});return Reflect.apply(float,this,args);};
 for(const method of ['castSkill','attack'] as const){
  const original=g[method].bind(g);(g[method] as unknown)=(...args:unknown[])=>{
   const before=state(g),offset={draws:draws.length,impacts:impacts.length,feedback:feedback.length},result=Reflect.apply(original,g,args);
   const structured=method==='attack'?result:g.getDevelopmentSpecializationResult()??g.getDevelopmentWarriorResult();
   const accepted=method==='attack'?!!(result as {ok?:boolean})?.ok:result;
   const id=method==='attack'?'basic':String(args[0]),rank=before.ledger?.skillRanks[id]??0,row=rows.find(s=>s.id===id)?.currentRows.find(r=>r.rank===rank);
   const sample=structured&&typeof structured==='object'&&'sample'in structured?structured.sample as {u:number;totalRaw:number;hits:{raw:number;hand:string}[]}|undefined:undefined;
   const basicWeapon=before.spec==='berserker'?196+8*(sample?.u??0):32+4*(sample?.u??0);
   const expectedBasic=7+Math.floor(1.1*before.level)+Math.max(0,before.stats.STR-15)+basicWeapon*(before.items.length===2?1.5:1);
   record('NATIVE_'+method,{args,id,rank,accepted,before,after:state(g),sample,expectedBasic:method==='attack'?expectedBasic:null,rawMatches:method==='attack'&&sample?Math.abs(sample.totalRaw-expectedBasic)<1e-8:null,approvedCoefficient:row?.coefficient,draws:draws.slice(offset.draws),impacts:impacts.slice(offset.impacts),feedback:feedback.slice(offset.feedback),result:structured&&typeof structured==='object'&&'ok'in structured?{ok:structured.ok,code:'code'in structured?structured.code:null}:null});
   setTimeout(()=>record('SETTLED_'+method,{id,rank,accepted,before,after:state(g),impacts:impacts.slice(offset.impacts),draws:draws.slice(offset.draws),feedback:feedback.slice(offset.feedback)}),900);
   return result;
  };
 }
 for(const key of ['chooseCoreJob','chooseSpecialization','allocateStatPoint','equipItem','unequipItem','learnSkill','assignPrimaryHotbarSlot','respawn','changeRegion','npcBuy'] as const){
  const original=g[key].bind(g);(g[key] as unknown)=(...args:unknown[])=>{const before=state(g),result=Reflect.apply(original,g,args);record('ORIGINAL_'+key,{args,before,result});return result;};
 }
});
const button=(label:string,action:()=>void|Promise<void>)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{void Promise.resolve().then(action).catch(e=>record('FIXTURE_ERROR',{message:String(e)}));};document.querySelector<HTMLDivElement>('#controls')!.appendChild(b);};
button('Setup XP15 and Core trainer',()=>{
 const g=game;if(!g?.started)throw Error('Start original Home first');
 while(g.hero.level<15)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));
 for(const slot of Object.keys(g.hero.equipment) as (keyof typeof g.hero.equipment)[])if(g.hero.equipment[slot])g.unequipItem(slot);
 const npc=CITIES.arunika.npcList.find(n=>n.service==='core')!;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Core trainer unavailable');record('MECHANICAL_XP15_TRAINER');
});
button('Setup XP80 and specialization trainer',async()=>{
 const g=game;if(!g?.started||g.hero.coreJob!=='warrior')throw Error('Choose Warrior natively first');
 while(g.hero.level<80)rules.gainXP(g.hero,rules.xpNeeded(g.hero.level));
 for(const slot of Object.keys(g.hero.equipment) as (keyof typeof g.hero.equipment)[])if(g.hero.equipment[slot])g.unequipItem(slot);
 const original=g.onMapTransition;const finished=new Promise<void>((resolve,reject)=>{g.onMapTransition=s=>{original?.(s);if(s.id==='jayantara'&&!s.loading){g.onMapTransition=original;if(s.error)reject(Error(s.error));else resolve();}};});
 if(!g.changeRegion('jayantara'))throw Error('Legal travel rejected');await finished;
 const npc=CITIES.jayantara.npcList.find(n=>n.service==='special')!;g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Specialization trainer unavailable');record('MECHANICAL_XP80_TRAINER');
});
button('Supply owned approved weapons',()=>{
 const g=game;if(!g?.started)throw Error('Start Home first');
 const templates=g.hero.specialization==='berserker'?['jayantara-two-hand-sword']:['field-ironveil-mines-sword','field-ironveil-mines-sword'];
 for(const [index,template]of templates.entries()){const item=createItem(template,{id:g.hero.slotId+'-approved-'+template+'-'+index,sockets:[]}),added=addItemToInventory(g.hero.inventory,item,g.hero.inventoryCapacity);if(added.remaining)throw Error('Inventory full');g.hero.inventory=added.inventory;}
 g.emit();record('MECHANICAL_OWNED_WEAPONS');
});
button('Setup equipment merchant and fixture GOLD',()=>{
 const g=game;if(!g?.started||!g.hero.inCity)throw Error('Own actor must be in a city');
 g.hero.gold+=2000;const npc=CITIES[g.hero.currentCity].npcList.find(n=>n.service==='equipment')!;
 g.hero.x=npc.x;g.hero.z=npc.z;g.actor.position.set(npc.x,0,npc.z);g.emit();if(!g.openNpc(npc.id))throw Error('Original equipment merchant unavailable');record('MECHANICAL_GOLD_MERCHANT');
});
button('Explicit development activation',()=>{
 const g=game;if(!g)throw Error('Start Home first');
 const result=g.hero.specialization?g.enableDevelopmentWarriorSpecializationReference({lifecycleRenewal:true}):g.enableDevelopmentWarriorReference({lifecycleRenewal:true});
 record('EXPLICIT_ACTIVATION',{result});g.emit();
});
button('Mechanical registered targets',()=>{
 const g=game;if(!g?.started)throw Error('Start Home first');
 for(const dx of [-1,0,1]){const definition:MonsterDefinition={id:'verdant-plains-0',name:'MECHANICAL specialization target',level:g.hero.level,rank:'normal',variant:'normal',statusLabel:'MECHANICAL FIXTURE',nameColor:'#d9f7aa',visualScale:1,maxHP:10000,defense:70,magicDefense:0,attack:0,attackRange:0,movementSpeed:0,attackSpeed:1,respawnTime:999999,respawn:999999,exp:0,dropRate:0,lootTable:[]};g.makeEnemy(++mechanicalId,g.actor.position.x+dx,g.actor.position.z-2,false,definition);}
 record('MECHANICAL_RENDERED_TARGETS');
});
button('Original incoming physical 1000',()=>{game?.hurtHero(1000,'MECHANICAL_PHYSICAL_DIRECT');record('ORIGINAL_INCOMING');});
button('Original lethal incoming',()=>{game?.hurtHero(1e9,'MECHANICAL_LETHAL');record('ORIGINAL_DEATH');});
button('Observe purity and current state',()=>{
 const g=game;if(!g)return;const before=JSON.stringify(g.hero),seed=g.seed,queue=g.skillHits.size,cd=JSON.stringify(g.skillCooldowns);
 for(let n=0;n<20;n++){g.getDevelopmentAdventurerRange();for(const s of rows)g.getDevelopmentAdventurerSkillMetadata(s.id);}
 if(JSON.stringify(g.hero)!==before||g.seed!==seed||g.skillHits.size!==queue||JSON.stringify(g.skillCooldowns)!==cd)throw Error('Pure read mutated live state');
 record('PURITY',{webgl:g.renderer.getContext().constructor.name,viewport:[innerWidth,innerHeight],passed:true});
});
button('Original save and isolated reload',async()=>{
 if(!game)return;game.save();const own=(window as unknown as {__specializationStorage:{local:Map<string,string>}}).__specializationStorage;
 const entries=[...own.local].filter(([key])=>key===rules.SAVE_KEY);if(entries.length!==1)throw Error('Own collection missing');
 const response=await fetch('/fixture-handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries})});if(!response.ok)throw Error('Own handoff failed');location.reload();
});
button('Dispose own Game',()=>{game?.dispose();game=null;record('CLEANUP');});
createRoot(document.querySelector('#root')!).render(<Home/>);
