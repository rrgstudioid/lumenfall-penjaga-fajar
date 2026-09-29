import type { SkillDefinitionV3 } from './skill-progression-v3.ts';
import type { SkillDefinition } from './skills.ts';
import type { CombatModifier } from './combat-modifiers.ts';
import type { Hero } from './rules.ts';
import type { RogueAmbushConfig } from './rogue-ambush.ts';
import { isRogueActor } from './rogue-ambush.ts';
import { resolveDaggerEquipment } from './dagger.ts';

type RankData = {
  min?: number[]; max?: number[]; physical?: number[]; str?: number[]; dex?: number[];
  mana?: number[]; cooldown?: number[]; duration?: number[]; distance?: number[];
  accuracy?: number[]; crit?: number[];
};
type RogueNode = {
  slug: string; name: string; gate: number; ranks: number; description: string;
  data: RankData; dual?: boolean; passive?: boolean; ultimate?: boolean;
  hands?: Array<'MAIN' | 'OFF' | 'BOTH'>; weights?: number[];
  prerequisites?: Array<{ skillId: string; requiredRank: number }>;
  movement?: 'APPROACH' | 'INPUT_REPOSITION'; ambush?: RogueAmbushConfig;
};
const id = (slug: string) => `v3-rogue-${slug}`;
const defaultAmbush: RogueAmbushConfig = { ambushEligible: true, interaction: { mode: 'DEFAULT_FINAL_DAMAGE' } };
const nodes: RogueNode[] = [
  { slug: 'dual-dagger-mastery', name: 'Dual Dagger Mastery', gate: 60, ranks: 5, dual: true, passive: true,
    description: 'Master the use of Dual Daggers, improving precision and critical capability.',
    data: { accuracy: [2,4,6,8,10], crit: [1,1.5,2,2.5,3] } },
  { slug: 'flash-cut', name: 'Flash Cut', gate: 60, ranks: 8, movement: 'APPROACH', ambush: defaultAmbush,
    description: 'Dash toward an enemy and deliver a fast dagger strike.',
    data: { min: [110,118,126,134,142,151,160,170], max: [155,165,175,185,195,206,218,230],
      physical: [.90,.95,1,1.05,1.10,1.15,1.20,1.25], str: [.05,.06,.07,.08,.09,.10,.11,.12], dex: [.14,.16,.18,.20,.23,.26,.29,.32],
      mana: [12,13,14,15,16,17,18,19], cooldown: [6.5,6.3,6.1,5.9,5.7,5.5,5.35,5.2], distance: Array(8).fill(5) } },
  { slug: 'crosscut', name: 'Crosscut', gate: 60, ranks: 5, dual: true, hands: ['MAIN','OFF'], weights: [.45,.55], ambush: defaultAmbush,
    description: 'Cross both daggers through a single enemy in two rapid strikes.',
    data: { min: [150,170,190,210,230], max: [210,235,260,290,320], physical: [1.20,1.28,1.36,1.45,1.55], str: [.06,.08,.10,.12,.14], dex: [.20,.24,.28,.32,.36], mana: [15,17,19,21,23], cooldown: [8,7.7,7.4,7.1,6.8] } },
  { slug: 'slipstep', name: 'Slipstep', gate: 60, ranks: 5, movement: 'INPUT_REPOSITION',
    description: 'Quickly slip around an enemy to gain an advantageous position.',
    ambush: { generator: { source: 'SLIPSTEP' } },
    data: { mana: [10,11,12,13,14], cooldown: [9,8.6,8.2,7.8,7.5], distance: [3.5,3.75,4,4.25,4.5] } },
  { slug: 'smoke-veil', name: 'Smoke Veil', gate: 63, ranks: 5,
    description: 'Conceal yourself briefly to prepare a lethal attack.',
    prerequisites: [{ skillId: id('slipstep'), requiredRank: 2 }], ambush: { generator: { source: 'SMOKE_VEIL' } },
    data: { duration: [2.5,2.75,3,3.25,3.5], mana: [18,20,22,24,26], cooldown: [30,28.5,27,25.5,24] } },
  { slug: 'backpierce', name: 'Backpierce', gate: 63, ranks: 5,
    description: 'Drive a dagger into the target, dealing greater damage from an advantageous position.',
    prerequisites: [{ skillId: id('crosscut'), requiredRank: 2 }],
    ambush: { ambushEligible: true, interaction: { mode: 'POSITION_OVERRIDE', position: 'rear' } },
    data: { min: [175,195,220,245,270], max: [240,270,300,335,370], physical: [1.25,1.35,1.45,1.55,1.65], str: [.07,.09,.11,.13,.15], dex: [.24,.28,.32,.37,.42], mana: [18,20,22,24,26], cooldown: [10,9.6,9.2,8.8,8.5] } },
  { slug: 'razor-flurry', name: 'Razor Flurry', gate: 65, ranks: 5, dual: true, hands: ['MAIN','OFF','MAIN','BOTH'], weights: [.20,.20,.25,.35], ambush: defaultAmbush,
    description: 'Unleash four rapid dagger strikes against a single enemy.', prerequisites: [{ skillId: id('crosscut'), requiredRank: 3 }],
    data: { min: [180,200,220,240,260], max: [250,275,305,335,365], physical: [1.40,1.48,1.57,1.66,1.75], str: [.06,.075,.09,.105,.12], dex: [.28,.32,.36,.40,.45], mana: [22,24,26,28,30], cooldown: [11,10.5,10,9.5,9] } },
  { slug: 'deadly-opportunity', name: 'Deadly Opportunity', gate: 67, ranks: 5, dual: true, hands: ['BOTH'],
    description: 'Exploit an Ambush with a devastating synchronized dual-dagger strike.', prerequisites: [{ skillId: id('backpierce'), requiredRank: 3 }],
    ambush: { ...defaultAmbush, requiresAmbush: true },
    data: { min: [220,245,270,295,320], max: [300,335,370,405,440], physical: [1.55,1.65,1.75,1.85,1.95], str: [.08,.10,.12,.14,.16], dex: [.32,.36,.41,.45,.50], mana: [24,26,29,31,34], cooldown: [14,13.4,12.8,12.2,11.5] } },
  { slug: 'perfect-ambush', name: 'Perfect Ambush', gate: 70, ranks: 3, dual: true, ultimate: true, hands: ['MAIN','OFF','MAIN','OFF','BOTH'], weights: [.15,.15,.20,.20,.30],
    description: 'Unleash a lethal five-hit dual-dagger assault from an Ambush.', prerequisites: [{ skillId: id('dual-dagger-mastery'), requiredRank: 3 }],
    ambush: { ...defaultAmbush, requiresAmbush: true },
    data: { min: [360,430,500], max: [480,560,650], physical: [2.20,2.50,2.80], str: [.12,.15,.18], dex: [.50,.60,.72], mana: [38,42,46], cooldown: [75,72,70] } },
];
export const ROGUE_V3_SKILLS: readonly SkillDefinitionV3[] = nodes.map(node => ({
  id: id(node.slug), name: node.name, jobId: 'rogue', jobTier: 'specialization', jobRequirement: 'rogue', ancestryRequirement: ['adventurer','thief'],
  unlockLevel: node.gate, maxRank: node.ranks,
  // Only skill gates are specified. No invented additional per-rank level gates.
  rankLevelRequirements: Array(node.ranks).fill(node.gate), spCostPerRank: node.ultimate ? 5 : 3,
  prerequisiteSkills: node.prerequisites ?? [],
  ...(node.ultimate ? { jobInvestmentRequirement: { jobId: 'rogue', minimumSP: 18 } } : {}),
  skillType: node.passive ? 'MASTERY' : node.ultimate ? 'ULTIMATE' : node.data.min ? 'ACTIVE_DAMAGE' : 'UTILITY',
  weaponRequirement: node.dual ? ['dual_dagger'] : node.data.min ? ['dagger','dual_dagger'] : [],
  targeting: { targetType: node.data.min || node.movement === 'INPUT_REPOSITION' ? 'single' : 'self', maxTargets: node.data.min ? 1 : undefined },
  ...(node.data.min ? { baseDamageMinByRank: node.data.min, baseDamageMaxByRank: node.data.max,
    skillPowerFactor: node.ultimate ? 10 : 8, rankPowerFactorByRank: Array.from({ length: node.ranks }, (_, i) => 1 + .05 * i),
    damageProfile: { physicalCoefficient: node.data.physical![0], statScaling: { str: node.data.str![0], dex: node.data.dex![0] } } } : {}),
  resourceCost: { mana: node.data.mana?.[0] ?? 0 }, cooldown: node.data.cooldown?.[0] ?? 0,
  presentation: { description: node.description }, effects: { tags: ['v3-rogue','no-stun','no-knockback','single-target'] },
}));
export const ROGUE_V3_SKILL_MAP = Object.fromEntries(ROGUE_V3_SKILLS.map(skill => [skill.id, skill]));
export const ROGUE_V3_RUNTIME_SKILLS: readonly SkillDefinition[] = nodes.map((node, index) => {
  const canonical = ROGUE_V3_SKILLS[index], v = node.data, damaging = !!v.min;
  const hands = node.hands ?? ['MAIN'], weights = node.weights ?? [1];
  const positional: CombatModifier[] = node.slug === 'backpierce' ? [
    { id: `${canonical.id}:flank`, layer: 'payoff', payoffGroup: 'rogue-position', condition: { targetPosition: 'side' }, action: { damagePercent: 8 } },
    { id: `${canonical.id}:rear`, layer: 'payoff', payoffGroup: 'rogue-position', condition: { targetPosition: 'rear' }, action: { damagePercent: 15 } },
  ] : [];
  return {
    id: canonical.id, name: node.name, description: node.description, job: 'thief', specialization: 'rogue', slot: 1,
    unlockLevel: node.gate, maxLevel: node.ranks, manaCost: v.mana?.[0] ?? 0, cooldown: v.cooldown?.[0] ?? 0,
    castingTime: .3, actionLockDuration: Math.max(.3, (hands.length - 1) * .15 + .15), movementAllowedDuringLock: false,
    nonDamaging: !damaging, baseDamage: 0, scalingStat: damaging ? 'attack' : 'none', damageCoefficient: 0,
    combatScaling: { physical: damaging ? 1 : 0, magic: 0, damageType: 'physical' }, damageType: 'physical',
    physicalCoefficient: v.physical?.[0] ?? 0, magicCoefficient: 0,
    baseDamageMinByRank: v.min, baseDamageMaxByRank: v.max, skillPowerFactor: canonical.skillPowerFactor, rankPowerFactorByRank: canonical.rankPowerFactorByRank,
    weaponMode: damaging ? hands.length > 1 ? 'DUAL_SEQUENCE' : hands[0] === 'BOTH' ? 'DUAL_COMBINED' : 'SINGLE_MAIN' : undefined,
    progressionMode: 'rank_values',
    rankValues: Array.from({ length: node.ranks }, (_, i) => ({
      physicalCoefficient: v.physical?.[i] ?? 0, statScaling: { str: v.str?.[i] ?? 0, dex: v.dex?.[i] ?? 0 },
      manaCost: v.mana?.[i] ?? 0, cooldown: v.cooldown?.[i] ?? 0, duration: v.duration?.[i] ?? 0,
      movementDistance: v.distance?.[i] ?? 0, range: node.movement ? v.distance![i] : damaging ? 3.5 : 0, maxTargets: damaging ? 1 : 0,
    })),
    rankEffects: Array.from({ length: node.ranks }, (_, i) => ({ modifiers: positional,
      ...(damaging ? { hitSequence: hands.map((hand, n) => ({ delay: n * .15, weaponHand: hand,
        sharedContributionWeight: weights[n], weaponContributionCoefficient: 1, physicalCoefficient: v.physical![i] * weights[n], knockbackStrength: 0 })) } : {}),
    })),
    rogueAmbush: node.ambush, rogueMovement: node.movement,
    motionArchetype: `ROGUE_${node.slug.replaceAll('-','_').toUpperCase()}`,
    targetType: canonical.targeting!.targetType!, range: node.movement ? v.distance![0] : damaging ? 3.5 : 0, areaRadius: 0,
    duration: v.duration?.[0] ?? 0, statusEffect: null, effect: damaging ? 'damage' : 'buff',
    canCrit: damaging, knockbackStrength: 0, actionType: damaging ? 'skill' : 'buff',
    animation: damaging ? 'basic_attack' : 'magic_cast', visualEffect: '', soundEffect: '',
    weaponRequirement: node.dual ? ['dual_dagger'] : damaging ? ['dagger','dual_dagger'] : [],
    prerequisites: node.prerequisites, masteryOptions: [], usableFromHotbar: !node.passive, skillType: node.passive ? 'passive' : 'active', hotbarCategory: 'primary',
    modifierComposition: 'scoped_additive', tags: ['v3-rogue'],
  };
});
export function rogueMasteryModifiers(hero: Hero): CombatModifier[] {
  if (!isRogueActor(hero)) return [];
  const main = hero.inventory.find(item => item.id === hero.equipment.mainHand) ?? null;
  const off = hero.inventory.find(item => item.id === hero.equipment.offHand) ?? null;
  if (resolveDaggerEquipment(hero, main, off).state !== 'DUAL_DAGGER') return [];
  const rank = Math.max(0, Math.min(5, hero.skillProgressionV3?.skillRanks[id('dual-dagger-mastery')] ?? 0));
  return rank ? [{ id: id('dual-dagger-mastery'), stats: { flat: { accuracy: nodes[0].data.accuracy![rank - 1], criticalRate: nodes[0].data.crit![rank - 1] } } }] : [];
}
export function rogueSkillDetails(skillId: string, rank: number) {
  const node = nodes.find(entry => id(entry.slug) === skillId);
  if (!node) return null;
  const i = Math.max(0, Math.min(node.ranks - 1, rank - 1));
  return { accuracy: node.data.accuracy?.[i], crit: node.data.crit?.[i], distance: node.data.distance?.[i], duration: node.data.duration?.[i],
    weights: node.data.min ? node.weights ?? [1] : [], hands: node.data.min ? node.hands ?? ['MAIN'] : [], ambush: node.ambush };
}
