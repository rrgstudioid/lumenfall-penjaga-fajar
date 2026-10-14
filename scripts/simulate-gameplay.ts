import { skillFamilyDefinitions } from '../lib/game/skill-family-runtime.ts';
import { writeFileSync } from 'node:fs';
import { createV3AdventurerHero, chooseV3Warrior, chooseV3Berserker, chooseV3BladeMaster, chooseV3Thief, chooseV3Rogue, chooseV3Assasin, equipItem, learnSkill, calculateTotalStatPoints, activeSkills, isSkillUnlocked } from '../lib/game/rules.ts';
import { createItem, emptyEquipment, ITEM_CATALOG } from '../lib/game/items.ts';
import { FIELDS } from '../lib/game/regions.ts';
import { totalSkillPoints } from '../lib/game/canonical-config.ts';
import { simulatePvE, SIMULATION_SCENARIOS } from '../lib/game/gameplay-simulation.ts';
import { auditGameplayCatalog } from '../lib/game/gameplay-catalog-audit.ts';
import { resolvePvPDamage, resolvePvPCC } from '../lib/game/pvp-layer.ts';
const plans={
 adventurer:['v3-adventurer-quick-slash'],
 warrior:['v3-warrior-strike','v3-warrior-sweeping-slash'],
 berserker:['v3-berserker-two-hand-mastery','v3-berserker-raging-cleave','v3-berserker-crushing-blow'],
 blade_master:['v3-blade-master-twin-blade-mastery','v3-blade-master-twin-assault','v3-blade-master-cross-sever'],
 thief:['v3-thief-dagger-training','v3-thief-quick-stab','v3-thief-twin-fang'],
 rogue:['v3-rogue-dual-dagger-mastery','v3-rogue-crosscut','v3-rogue-razor-flurry'],
 assasin:['v3-assasin-venom-mastery','v3-assasin-poison-dagger','v3-assasin-twin-venom-throw','v3-assasin-venom-eclipse'],
};
type Kit=keyof typeof plans;
function build(kit:Kit,level:number,allocation:'offense'|'sustain',rankLimit:number,weaponId?:string){
 const hero=createV3AdventurerHero('synthetic-'+kit,kit);hero.level=level;hero.equipment=emptyEquipment();hero.inventory=[];
 hero.skillProgressionV3!.totalEarnedSP=totalSkillPoints(level);hero.skillPoints=totalSkillPoints(level);
 if(['warrior','berserker','blade_master'].includes(kit)&&!chooseV3Warrior(hero))throw Error('Warrior transition');
 if(['thief','rogue','assasin'].includes(kit)&&!chooseV3Thief(hero))throw Error('Thief transition');
 const transitions={berserker:chooseV3Berserker,blade_master:chooseV3BladeMaster,rogue:chooseV3Rogue,assasin:chooseV3Assasin};
 if(kit in transitions&&!transitions[kit as keyof typeof transitions](hero))throw Error('Specialization transition');
 const purchaseLog:string[]=[];
 for(const id of plans[kit])for(let i=0;i<rankLimit;i++){if((hero.skillProgressionV3!.skillRanks[id]??0)>=rankLimit||!learnSkill(hero,id))break;purchaseLog.push(id);}
 const type=kit==='berserker'?'two_hand_sword':['thief','rogue','assasin'].includes(kit)?'dagger':'one_hand_sword';
 const template=weaponId??(kit==='berserker'?'jayantara-two-hand-sword':undefined)??Object.values(ITEM_CATALOG).filter(i=>i.equipmentType===type&&i.templateId.startsWith('field-verdant-plains-')).map(i=>i.templateId).sort((a,b)=>a.localeCompare(b))[0];
 if(!template)throw Error('Missing approved weapon for '+kit);
 const main=createItem(template,{id:kit+'-main',enhancementLevel:0});hero.inventory.push(main);
 if(!equipItem(hero,main.id,'mainHand').ok)throw Error('Main hand illegal '+kit+' '+template);
 if(['blade_master','thief','rogue','assasin'].includes(kit)){
 const off=createItem(template,{id:kit+'-off',enhancementLevel:0});hero.inventory.push(off);
 if(!equipItem(hero,off.id,'offHand').ok)throw Error('Off hand illegal '+kit);}
 const points=calculateTotalStatPoints(level), dexKit=['thief','rogue','assasin'].includes(kit);
 const vit=allocation==='sustain'?Math.floor(points*.3):0,int=allocation==='sustain'?Math.floor(points*.2):0;
 hero.allocatedStats={str:dexKit?0:points-vit-int,vit,dex:dexKit?points-vit-int:0,int};hero.statPoints=0;
 const rotation=plans[kit].filter(id=>activeSkills(hero).some(s=>s.id===id&&skillFamilyDefinitions[id]?.skillType==='ACTIVE_DAMAGE'&&isSkillUnlocked(hero,s)));
 if(!rotation.length)throw Error('Empty legal rotation '+kit);
 // Eclipse first, followed by poison builders; simple priority otherwise.
 rotation.sort((a,b)=>Number(b.endsWith('venom-eclipse'))-Number(a.endsWith('venom-eclipse')));
 return {hero,rotation,purchaseLog,weapon:{templateId:template,enhancement:0},allocation,rankLimit};
}
// User's global-map authority excludes East Gate; runtime drift is reported, not edited.
const excludedFields=[{id:'east-gate-arunika',status:'active-runtime/global-map-drift',benchmark:false}];
const fields=Object.values(FIELDS).filter(f=>f.fieldBoss && !excludedFields.some(x=>x.id===f.id));
const results=[];
for(const field of fields){
 const level=field.fieldBoss!.level;
 const kits:Kit[]=level<15?['adventurer']:['warrior','thief'];
 for(const kit of kits)for(const allocation of ['offense','sustain'] as const)for(const rankLimit of [1,10]){
  const family=field.contentFamilyId??(field.id==='verdant-plains-v2'?'verdant-plains':field.id);
  const b=build(kit,level,allocation,rankLimit,'field-'+family+'-'+(kit==='thief'?'dagger':'sword'));
  results.push({build:kit+'-lv'+level+'-'+allocation+'-r'+rankLimit,kit,field:field.id,level,allocation,rankLimit,weapon:b.weapon,purchaseLog:b.purchaseLog,
   runs:SIMULATION_SCENARIOS.flatMap(scenario=>[17,42,101].map(seed=>simulatePvE(b.hero,field.fieldBoss!,b.rotation,seed,scenario.damageWindow?120:300,scenario)))});
 }
}
// All supported specialist builds are reproducible, but no equal-level active boss exists.
// Do not relabel an overlevel calibration or mint an encounter as an active benchmark.
const unmatchedBuilds=[];
for(const kit of ['berserker','blade_master','rogue','assasin'] as Kit[])for(const level of [60,80])for(const allocation of ['offense','sustain'] as const)for(const rankLimit of [1,10]){
 const b=build(kit,level,allocation,rankLimit);
 unmatchedBuilds.push({kit,level,allocation,rankLimit,purchaseLog:b.purchaseLog,rotation:b.rotation,ranks:b.hero.skillProgressionV3!.skillRanks,
  allocatedStats:b.hero.allocatedStats,equipment:b.hero.inventory,reason:'NO_ACTIVE_LEVEL_MATCHED_FIELD_BOSS',status:'blocked-scenario-not-executed'});
}
const legacyCalibration={status:'historical-only-excluded-from-active-benchmark',artifact:'outputs/gameplay-migration/phase14-start-simulation.json',reason:'Contains overlevel Lv60/80 vs Lv50 runs and East Gate runtime/global-map drift; retained for comparison only'};
// Test-only numbers exercise safeguards. They are never installed in BALANCE_TARGETS.
const syntheticPvP = { damageMultiplier: .5, maxSingleHitHPFraction: .4, ccDurationMultiplier: .5, maxContinuousCCSeconds: 2, ccImmunitySeconds: 3 };
let cc = resolvePvPCC(null, 0, 2, syntheticPvP);
const ccTrace = [cc];
for (const time of [.5,1,1.5,2,3,4,5]) { cc = resolvePvPCC(cc, time, 8, syntheticPvP); ccTrace.push(cc); }
const pvp = { liveEnabled: false, reason: 'PVP_TUNING_REQUIRED', configuration: 'synthetic-test-only',
  hits: [100,1000,100000].map(raw => ({raw, ...resolvePvPDamage(raw,100,syntheticPvP)})), ccTrace };

const report={model:'bounded-runtime-formulas-v3-level-matched',releaseTuningApproved:false,browserParity:false,
 comparison:'Equal character and boss level; FIELDS entries excluding explicit global-map conflict East Gate. Registry presence establishes catalog activity, not browser reachability. Existing same-family weapons +0, no armor/accessory/potion. Offense or 50/30/20 primary/VIT/INT; rank1 or legal up-to-max purchases. Specialist scenarios blocked by absent Lv60+ encounters.',
 activeFields:fields.map(f=>({id:f.id,boss:f.fieldBoss})),excludedFields,legacyCalibration,unmatchedBuilds,pve:results,pvp,
 tuningProposal:{status:'proposal-only-no-live-change',targetSeconds:120,package:'Replay fixed seeds and build definitions against current HP/DEF/MDEF first, then a bounded sensitivity grid after browser trace parity.',
  parameters:fields.map(f=>({field:f.id,level:f.fieldBoss!.level,existing:{hp:f.fieldBoss!.maxHP,defense:f.fieldBoss!.defense,magicDefense:f.fieldBoss!.magicDefense},
   proposedSensitivity:{hpFactors:[.8,1,1.2],defenseFactors:[.8,1,1.2]},basis:'Existing registry center; +/-20 percent is a declared experimental perturbation, NOT inferred target HP or approved tuning'})),
  specialistEncounter:{level:[60,80],hp:null,defense:null,magicDefense:null,attack:null,reason:'Needs approved encounter catalog and intended gear/party size; no extrapolation from burst DPS'}}};
writeFileSync('docs/gameplay-simulation-results.json',JSON.stringify(report,null,2));
writeFileSync('docs/gameplay-catalog-audit.json',JSON.stringify(auditGameplayCatalog(),null,2));
if(results.some(b=>b.runs.some(r=>r.level!==r.targetLevel||r.totalDamage<=0||r.remainingMana<0)))throw Error('Invalid matched simulation');
const rows=['MODEL: diagnostic formulas only; no browser parity or live tuning approval.',
 'build | field | character/boss level | weapon+0 | STR/VIT/DEX/INT | scenario | seed | rotation@rank | DPS | burst10 DPS | sustained>10 DPS | TTK(s) | outcome | mana spent/remaining | uptime | incoming/remainingHP | movement cycle/pause'];
for(const b of results)for(const r of b.runs)rows.push([b.build,b.field,r.level+'/'+r.targetLevel,b.weapon.templateId,[r.allocatedStats.str,r.allocatedStats.vit,r.allocatedStats.dex,r.allocatedStats.int].join('/'),r.scenario,r.seed,r.rotation.map(id=>id+'@'+r.ranks?.[id]).join(' > '),r.dps.toFixed(2),r.burst10sDPS.toFixed(2),r.sustainedAfter10sDPS?.toFixed(2)??'N/A',r.ttk?.toFixed(2)??'N/A',r.outcome,r.manaSpent.toFixed(2)+'/'+r.remainingMana.toFixed(2),r.actualUptime.toFixed(3),r.incomingDamage.toFixed(2)+'/'+r.remainingHP.toFixed(2),r.movement.cycle+'/'+r.movement.seconds].join(' | '));
rows.push('Specialists: '+unmatchedBuilds.length+' reproducible builds blocked: no active Lv60/80 Field Boss. See JSON for full equipment, ranks, purchases and proposed scenarios.');
writeFileSync('docs/gameplay-field-boss-table.txt',rows.join('\n')+'\n');
console.log(JSON.stringify({builds:results.length,runs:results.reduce((n,b)=>n+b.runs.length,0),unmatchedBuilds:unmatchedBuilds.length,excludedFields,fields:fields.map(f=>f.id)},null,2));
