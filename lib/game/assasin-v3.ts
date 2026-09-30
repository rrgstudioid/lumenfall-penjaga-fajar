import type { SkillDefinitionV3 } from './skill-progression-v3.ts';
import type { SkillDefinition } from './skills.ts';
import type { Hero } from './rules.ts';
import type { AssasinPoisonProfile } from './assasin-poison.ts';
import { thiefJobCapabilities } from './thief-job-capabilities.ts';

export type AssasinSkillConfig = {
  normalPoison?: 'ADD_STACK' | 'REFRESH_OR_APPLY';
  maxPoisonStacksGrantedPerExecution?: number;
  crippling?: { bonusPPByRank: number[]; duration: number };
  backward?: boolean;
  vanish?: boolean;
  execution?: boolean;
  eclipse?: boolean;
};
export const EXECUTION_HP_THRESHOLD = .30;
export const EXECUTION_PAYOFF = [.04, .08, .12, .16, .20] as const;
export const ECLIPSE_DURATION = 10;
export const ECLIPSE_TICK_INTERVAL = 1;
export const ECLIPSE_STACK_MULTIPLIERS = [1, 1.12, 1.24, 1.36, 1.48, 1.60] as const;
export const VENOM_PROFILES: readonly AssasinPoisonProfile[] = [
  [16,24,.10,.10], [20,28,.12,.12], [24,33,.14,.14], [28,38,.16,.16], [32,44,.18,.18],
].map(([baseDamageMin,baseDamageMax,patkCoefficient,dexCoefficient], i) => ({
  id: 'v3-assasin-venom-mastery', baseDamageMin, baseDamageMax, patkCoefficient, dexCoefficient,
  rank: i + 1, skillPowerFactor: 8, baseRollPolicy: 'PER_TICK',
}));
export const VENOM_THROWN_ACCURACY = [2,4,6,8,10] as const;
export const ECLIPSE_PROFILES = [
  { min: 24, max: 34, physical: .15, dex: .18 },
  { min: 30, max: 42, physical: .18, dex: .22 },
  { min: 36, max: 50, physical: .22, dex: .26 },
] as const;
type RankData = { min?: number[]; max?: number[]; physical?: number[]; str?: number[]; dex?: number[];
  mana?: number[]; cooldown?: number[]; duration?: number[]; distance?: number[] };
type AssasinNode = { slug: string; name: string; description: string; gate: number; ranks: number;
  data: RankData; range?: number; dual?: boolean; passive?: boolean; ultimate?: boolean;
  hands?: Array<'MAIN'|'OFF'|'BOTH'>; weights?: number[]; mechanics?: AssasinSkillConfig;
  prerequisites?: Array<{ skillId: string; requiredRank: number }> };
const id = (slug: string) => `v3-assasin-${slug}`;
const requires = (slug: string, rank: number) => [{ skillId: id(slug), requiredRank: rank }];
const poison: AssasinSkillConfig = { normalPoison: 'ADD_STACK', maxPoisonStacksGrantedPerExecution: 1 };
const nodes: AssasinNode[] = [
  { slug: 'venom-mastery', name: 'Venom Mastery', description: 'Master lethal venom techniques, improving Poison damage and thrown dagger accuracy.', gate: 60, ranks: 5, passive: true, data: {} },
  { slug: 'poison-dagger', name: 'Poison Dagger', description: 'Throws a poisoned dagger that damages, slows, and poisons the target.', gate: 60, ranks: 8, range: 10, prerequisites: requires('venom-mastery',1), mechanics: poison,
    data: { min:[80,87,94,101,108,115,122,130], max:[115,123,132,141,150,160,170,180], physical:[.70,.74,.78,.82,.86,.90,.95,1], str:[.02,.025,.03,.035,.04,.045,.05,.055], dex:[.15,.17,.19,.21,.23,.25,.28,.30], mana:[12,13,14,15,16,17,18,19], cooldown:[5.5,5.3,5.1,4.9,4.7,4.5,4.35,4.2] } },
  { slug: 'twin-venom-throw', name: 'Twin Venom Throw', description: 'Throws both daggers in rapid succession, poisoning the target with each successful hit.', gate:60, ranks:5, range:10, dual:true, hands:['MAIN','OFF'], weights:[.45,.55], prerequisites:requires('poison-dagger',3), mechanics:{ ...poison, maxPoisonStacksGrantedPerExecution:2 },
    data:{ min:[110,125,140,155,170], max:[150,168,188,208,230], physical:[.90,.98,1.05,1.12,1.20], str:[.03,.04,.05,.06,.07], dex:[.20,.235,.27,.305,.34], mana:[18,20,22,24,26], cooldown:[8,7.6,7.2,6.8,6.5] } },
  { slug:'crippling-dagger', name:'Crippling Dagger', description:'Throws a crippling poisoned dagger that greatly reduces the target’s movement speed.', gate:63, ranks:5, range:10, prerequisites:requires('poison-dagger',3), mechanics:{ ...poison, crippling:{ bonusPPByRank:[3,4,5,6,7], duration:3 } },
    data:{ min:[60,70,80,90,100], max:[90,100,112,125,140], physical:[.55,.61,.67,.73,.80], str:[.01,.02,.025,.03,.04], dex:[.12,.145,.17,.195,.22], mana:[16,18,20,22,24], cooldown:[10,9.5,9,8.5,8] } },
  { slug:'backstep-fang', name:'Backstep Fang', description:'Throw a dagger while quickly stepping backward to create distance.', gate:63, ranks:5, range:8, prerequisites:requires('poison-dagger',2), mechanics:{ ...poison, normalPoison:'REFRESH_OR_APPLY', backward:true },
    data:{ min:[90,102,115,130,145], max:[125,140,155,175,195], physical:[.90,.98,1.06,1.15,1.25], str:[.03,.04,.05,.06,.07], dex:[.18,.215,.25,.285,.32], mana:[15,17,19,21,23], cooldown:[9,8.6,8.2,7.8,7.5], distance:[2.5,2.75,3,3.25,3.5] } },
  { slug:'venom-pursuit', name:'Venom Pursuit', description:'Throws a pursuing venom dagger that strengthens and refreshes Poison on the target.', gate:65, ranks:5, range:12, prerequisites:requires('twin-venom-throw',2), mechanics:poison,
    data:{ min:[75,87,100,112,125], max:[105,118,135,152,170], physical:[.70,.78,.86,.94,1.02], str:[.02,.025,.03,.035,.04], dex:[.18,.21,.24,.27,.30], mana:[14,16,18,20,22], cooldown:[7,6.6,6.2,5.8,5.5] } },
  { slug:'vanish', name:'Vanish', description:'Disappear from sight briefly to reposition and prepare another attack.', gate:65, ranks:5, prerequisites:requires('venom-mastery',2), mechanics:{ vanish:true },
    data:{ duration:[3.5,4,4.5,5,5.5], mana:[20,22,24,26,28], cooldown:[32,30,28,26,24] } },
  { slug:'executioner', name:'Executioner', description:'Execute a weakened poisoned enemy with a lethal dagger strike.', gate:67, ranks:5, range:2.5, dual:true, hands:['BOTH'], prerequisites:requires('venom-pursuit',3), mechanics:{ execution:true },
    data:{ min:[220,250,280,315,350], max:[300,340,380,425,480], physical:[1.60,1.72,1.84,1.97,2.10], str:[.06,.07,.08,.09,.10], dex:[.35,.40,.45,.50,.55], mana:[24,27,30,33,36], cooldown:[16,15,14,13,12.5] } },
  { slug:'venom-eclipse', name:'Venom Eclipse', description:'Throws a lethal venom dagger that inflicts an extremely powerful poison over time.', gate:70, ranks:3, range:12, ultimate:true, prerequisites:requires('venom-mastery',3), mechanics:{ eclipse:true },
    data:{ min:[70,85,100], max:[100,115,135], physical:[.55,.65,.75], str:[.02,.025,.03], dex:[.12,.15,.18], mana:[34,39,44], cooldown:[80,76,72] } },
];
export const ASSASIN_V3_SKILLS: readonly SkillDefinitionV3[] = nodes.map(node => ({
  id:id(node.slug), name:node.name, jobId:'assasin', jobTier:'specialization', jobRequirement:'assasin', ancestryRequirement:['adventurer','thief'],
  unlockLevel:node.gate, maxRank:node.ranks, rankLevelRequirements:Array(node.ranks).fill(node.gate), spCostPerRank:node.ultimate ? 5 : 3,
  prerequisiteSkills:node.prerequisites ?? [], ...(node.ultimate ? { jobInvestmentRequirement:{ jobId:'assasin', minimumSP:18 } } : {}),
  skillType:node.passive ? 'MASTERY' : node.ultimate ? 'ULTIMATE' : node.data.min ? 'ACTIVE_DAMAGE' : 'UTILITY',
  weaponRequirement:node.dual ? ['dual_dagger'] : node.data.min ? ['dagger','dual_dagger'] : [],
  targeting:{ targetType:node.data.min ? 'single' : 'self', maxTargets:node.data.min ? 1 : undefined },
  ...(node.data.min ? { baseDamageMinByRank:node.data.min, baseDamageMaxByRank:node.data.max,
    // The small direct physical impact is separate from the x10 Eclipse DoT.
    skillPowerFactor:8, rankPowerFactorByRank:Array.from({length:node.ranks},(_,i)=>1+.05*i),
    damageProfile:{ physicalCoefficient:node.data.physical![0], statScaling:{ str:node.data.str![0], dex:node.data.dex![0] } } } : {}),
  resourceCost:{ mana:node.data.mana?.[0] ?? 0 }, cooldown:node.data.cooldown?.[0] ?? 0,
  presentation:{ description:node.description }, effects:{ tags:['v3-assasin','single-target','no-stun','no-knockback'] },
}));
export const ASSASIN_V3_SKILL_MAP = Object.fromEntries(ASSASIN_V3_SKILLS.map(skill=>[skill.id,skill]));
export const ASSASIN_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = nodes.map((node,index) => {
  const canonical=ASSASIN_V3_SKILLS[index], v=node.data, damaging=!!v.min;
  const hands=node.hands ?? ['MAIN'], weights=node.weights ?? [1];
  return {
    id:canonical.id, name:node.name, description:node.description, job:'thief', specialization:'assasin', slot:1,
    unlockLevel:node.gate, maxLevel:node.ranks, manaCost:v.mana?.[0] ?? 0, cooldown:v.cooldown?.[0] ?? 0,
    castingTime:.3, actionLockDuration:.3, movementAllowedDuringLock:false, nonDamaging:!damaging,
    baseDamage:0, scalingStat:damaging ? 'attack' : 'none', damageCoefficient:0, damageType:'physical',
    combatScaling:{physical:damaging ? 1 : 0,magic:0,damageType:'physical'}, physicalCoefficient:v.physical?.[0] ?? 0, magicCoefficient:0,
    baseDamageMinByRank:v.min, baseDamageMaxByRank:v.max, skillPowerFactor:canonical.skillPowerFactor, rankPowerFactorByRank:canonical.rankPowerFactorByRank,
    weaponMode:damaging ? node.mechanics?.execution ? 'DUAL_COMBINED' : hands.length > 1 ? 'THROWN_SEQUENCE' : 'THROWN_MAIN' : undefined,
    progressionMode:'rank_values', rankValues:Array.from({length:node.ranks},(_,i)=>({
      physicalCoefficient:v.physical?.[i] ?? 0, statScaling:{str:v.str?.[i] ?? 0,dex:v.dex?.[i] ?? 0},
      manaCost:v.mana?.[i] ?? 0,cooldown:v.cooldown?.[i] ?? 0,duration:v.duration?.[i] ?? 0,
      movementDistance:v.distance?.[i] ?? 0,range:node.range ?? 0,maxTargets:damaging ? 1 : 0,
    })),
    rankEffects:Array.from({length:node.ranks},(_,i)=>damaging ? {hitSequence:hands.map((weaponHand,n)=>({delay:n*.15,weaponHand,sharedContributionWeight:weights[n],weaponContributionCoefficient:1,physicalCoefficient:v.physical![i]*weights[n],knockbackStrength:0}))} : {}),
    assasin:node.mechanics, motionArchetype:`ASSASIN_${node.slug.replaceAll('-','_').toUpperCase()}`,
    targetType:damaging ? 'single' : 'self',range:node.range ?? 0,areaRadius:0,duration:v.duration?.[0] ?? 0,
    statusEffect:null,effect:damaging ? 'damage' : 'buff',canCrit:damaging,knockbackStrength:0,actionType:damaging ? 'skill' : 'buff',
    animation:damaging ? 'ranged_attack' : 'magic_cast',visualEffect:'',soundEffect:'',
    weaponRequirement:canonical.weaponRequirement as SkillDefinition['weaponRequirement'],prerequisites:node.prerequisites,masteryOptions:[],
    usableFromHotbar:!node.passive,skillType:node.passive ? 'passive' : 'active',hotbarCategory:'primary',modifierComposition:'scoped_additive',tags:['v3-assasin'],
  };
});
export function venomMasteryRank(hero: Hero) {
  return thiefJobCapabilities(hero).canUseAssasinSkills ? Math.max(0,Math.min(5,hero.skillProgressionV3?.skillRanks[id('venom-mastery')] ?? 0)) : 0;
}
export function assasinSkillDetails(skillId:string,rank:number) {
  const node=nodes.find(n=>id(n.slug)===skillId);
  if (!node) return null;
  const i=Math.max(0,Math.min(node.ranks-1,rank-1));
  return { passive:node.passive, mechanics:node.mechanics, duration:node.data.duration?.[i], distance:node.data.distance?.[i],
    hands:node.data.min ? node.hands ?? ['MAIN'] : [], weights:node.data.min ? node.weights ?? [1] : [],
    profile:node.passive ? VENOM_PROFILES[i] : undefined, accuracy:node.passive ? VENOM_THROWN_ACCURACY[i] : undefined,
    eclipse:node.ultimate ? ECLIPSE_PROFILES[i] : undefined };
}
