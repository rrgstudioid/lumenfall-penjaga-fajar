import { derivedStats, resolveHeroSkill, skillHealingPreview, skillLevel, type Hero } from './rules.ts';
import { skillHitDamage } from './skill-action.ts';
import type { SkillDefinition } from './skills.ts';
import type { SkillDefinitionV3 } from './skill-progression-v3.ts';
import { weaponRequirementLabel } from './weapon-style.ts';
import { FURY_HARVEST_RECOVERY_PERCENT } from './berserker-v3.ts';

export type SkillPresentationRow = { label: string; value: string };

export type SkillPresentationModel = {
  skillName: string;
  description: string;
  skillType: string;
  currentRank: number;
  maxRank: number;
  status: 'LEARNED' | 'AVAILABLE' | 'LOCKED' | 'MAX RANK';
  requirements: SkillPresentationRow[];
  damage: SkillPresentationRow[];
  specialMechanics: SkillPresentationRow[];
  area: SkillPresentationRow[];
  resource: SkillPresentationRow[];
  preview: {
    label: string;
    total?: number;
    perHit: number[];
    value?: string;
  };
  nextRank: SkillPresentationRow[];
  isDamage: boolean;
};

const weaponLabels: Record<string, string> = {
  one_hand_sword: 'One-Hand Sword',
  two_hand_sword: 'Two-Hand Sword',
  dual_sword: 'Dual One-Hand Swords',
  any_sword: 'Any Sword',
  none: 'None',
};

const effectLabels: Record<string, string> = {
  armor_break: 'Armor Break',
  accuracy: 'Accuracy',
  criticalRate: 'Critical Rate',
  physicalDamagePercent: 'Physical Damage',
  damageReduction: 'Damage Reduction',
  displacementResistance: 'Displacement Resistance',
  blockRate: 'Block',
  temporary_max_hp: 'Max HP',
  dual_wield_unlock: 'Unlocks Dual Wield',
  dual_wield_accuracy: 'Dual Wield Accuracy',
  blade_focus: 'Blade Focus',
  flow_extension: 'Flow Duration',
  tempo_drive: 'Tempo Drive',
};
const jobLabels: Record<string, string> = {
  adventurer: 'Adventurer',
  warrior: 'Warrior',
  berserker: 'Berserker',
  blade_master: 'Blade Master',
};

const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const effectLabel = (value: string) => effectLabels[value] ?? titleCase(value);
const coefficient = (value: number) => `×${value.toFixed(2)}`;
const percentage = (value: number) => `${value % 1 === 0 ? value : value.toFixed(1)}%`;
const rankIndex = (rank: number, maxRank: number) => Math.min(Math.max(1, rank), maxRank) - 1;

function runtimeRankValue(runtime: SkillDefinition, rank: number) {
  return runtime.rankValues?.[rankIndex(rank, runtime.maxLevel)] ?? {};
}

function rowsForEffects(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  const rows: SkillPresentationRow[] = [];
  for (const effect of [...(definition.effects?.buffs ?? []), ...(definition.effects?.debuffs ?? [])]) {
    rows.push({ label: effectLabel(effect), value: effectLabel(effect) });
  }
  const rankEffect = runtime.rankEffects?.[rankIndex(rank, runtime.maxLevel)];
  const buffs = rankEffect?.temporaryBuffs ?? [];
  for (const buff of buffs) {
    const stats = buff.modifier.stats;
    for (const [key, value] of Object.entries(stats?.flat ?? {})) rows.push({ label: effectLabel(key), value: `+${value}` });
    for (const [key, value] of Object.entries(stats?.percent ?? {})) rows.push({ label: effectLabel(key), value: `+${value}%` });
    if (buff.modifier.action?.damagePercent !== undefined) rows.push({ label: 'Physical Damage', value: `+${buff.modifier.action.damagePercent}%` });
  }
  return rows;
}

function rowsForMechanics(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  const rows: SkillPresentationRow[] = [];
  const tags = definition.effects?.tags ?? [];
  if (runtime.hitSequence?.some((hit) => hit.weaponHand)) {
    const hands = runtime.hitSequence.map((hit) => hit.weaponHand === 'MAIN' ? 'Main Hand' : hit.weaponHand === 'OFF' ? 'Off Hand' : 'Both Swords');
    rows.push({ label: 'Sequence', value: hands.join(' → ') });
  } else if (tags.some((tag) => tag.includes('dual-sequence'))) rows.push({ label: 'Sequence', value: 'Main Hand → Off Hand' });
  if (tags.some((tag) => tag.includes('dual-combined'))) rows.push({ label: 'Weapon Contribution', value: 'Both Swords' });
  if (tags.some((tag) => tag.includes('single-main'))) rows.push({ label: 'Weapon Contribution', value: 'Main Hand' });
  if (tags.some((tag) => tag.includes('flow-eligible'))) rows.push({ label: 'Flow', value: 'Successful skill +1 Flow' });
  if (tags.some((tag) => tag.includes('tempo'))) rows.push({ label: 'Tempo', value: 'Successful skill +1 Tempo' });
  if (tags.some((tag) => tag.includes('counter'))) rows.push({ label: 'Counter Payoff', value: 'After successful Block / Parry' });
  const counter = tags.find((tag) => tag.startsWith('counter-payoff:'));
  if (counter) rows.push({ label: 'Damage', value: `+${counter.split(':')[1].split(',')[rankIndex(rank, runtime.maxLevel)]}% after Block / Parry` });
  const armor = tags.find((tag) => tag.startsWith('armor-break-payoff:'));
  if (armor) rows.push({ label: 'Your Armor Break', value: `Final Damage +${armor.split(':')[1]}%` });
  if (runtime.armorBreakStrengthByRank) {
    rows.push({ label: 'Defense Reduction', value: `${runtime.armorBreakStrengthByRank[rankIndex(rank, runtime.maxLevel)]}%` });
    rows.push({ label: 'Duration', value: `${runtime.statuses?.[0]?.duration ?? 0}s` });
  }
  if (tags.includes('fury-harvest-recovery')) {
    rows.push({ label: 'Restore HP', value: `${FURY_HARVEST_RECOVERY_PERCENT[rankIndex(rank, FURY_HARVEST_RECOVERY_PERCENT.length)]}% Max HP` });
    rows.push({ label: 'Recovery', value: 'Per successful target' });
    rows.push({ label: 'Recovery Target Cap', value: '5' });
  }
  if (definition.stunProfile) {
    rows.push({ label: 'Stun Chance', value: percentage(definition.stunProfile.chance[rankIndex(rank, runtime.maxLevel)] * 100) });
    rows.push({ label: 'Stun Duration', value: `${definition.stunProfile.pveDuration}s PvE` });
    if (definition.stunProfile.minimumTravelDistance > 0) rows.push({ label: 'Minimum Stun Distance', value: `${definition.stunProfile.minimumTravelDistance} m` });
  }
  return rows;
}

function nextRankRows(definition: SkillDefinitionV3, runtime: SkillDefinition, rank: number) {
  if (rank >= definition.maxRank) return [];
  const current = runtimeRankValue(runtime, rank);
  const next = runtimeRankValue(runtime, rank + 1);
  const rows: SkillPresentationRow[] = [];
  const add = (label: string, before: number | undefined, after: number | undefined, format = String) => {
    if (before !== undefined && after !== undefined && before !== after) rows.push({ label, value: `${format(before)} → ${format(after)}` });
  };
  add('Physical Attack', current.physicalCoefficient, next.physicalCoefficient, coefficient);
  for (const stat of ['str', 'dex', 'vit', 'int'] as const) add(`Bonus ${stat.toUpperCase()}`, current.statScaling?.[stat], next.statScaling?.[stat], coefficient);
  add('Mana', current.manaCost, next.manaCost);
  add('Cooldown', current.cooldown, next.cooldown, (value) => `${value}s`);
  add('Radius', current.radius, next.radius, (value) => `${value} m`);
  add('Max Targets', current.maxTargets, next.maxTargets);
  if (definition.stunProfile) add('Stun Chance', definition.stunProfile.chance[rankIndex(rank, definition.maxRank)] * 100, definition.stunProfile.chance[rankIndex(rank + 1, definition.maxRank)] * 100, percentage);
  return rows;
}

export function resolveSkillPresentation(hero: Hero, definition: SkillDefinitionV3, runtime: SkillDefinition): SkillPresentationModel {
  const currentRank = skillLevel(hero, runtime);
  const rank = Math.max(1, currentRank);
  const values = runtimeRankValue(runtime, rank);
  const action = resolveHeroSkill(hero, runtime, rank);
  const stats = derivedStats(hero);
  const isDamage = definition.skillType === 'ACTIVE_DAMAGE' || definition.skillType === 'ACTIVE_MOBILITY' || definition.skillType === 'ULTIMATE';
  const perHit = isDamage ? action.hitSequence.map((hit) => Math.round(skillHitDamage(hit, stats))) : [];
  const status = currentRank >= definition.maxRank ? 'MAX RANK' : currentRank > 0 ? 'LEARNED' : hero.level >= (definition.unlockLevel ?? 0) ? 'AVAILABLE' : 'LOCKED';
  const isPassive = definition.skillType === 'PASSIVE' || definition.skillType === 'MASTERY';
  const requirements: SkillPresentationRow[] = [
    { label: 'Character Requirement', value: `Lv. ${definition.rankLevelRequirements?.[0] ?? definition.unlockLevel ?? 1}` },
    { label: 'Job Requirement', value: definition.jobRequirement ?? jobLabels[definition.jobId] ?? titleCase(definition.jobId) },
    { label: 'Skill Point Cost', value: `${Array.isArray(definition.spCostPerRank) ? definition.spCostPerRank[rankIndex(rank, definition.maxRank)] : definition.spCostPerRank ?? 0} SP` },
    { label: 'Prerequisite', value: definition.prerequisiteSkills?.map((entry) => `${entry.skillId.replace(/^v3-/, '').replaceAll('-', ' ')} R${entry.requiredRank}`).join(' + ') || 'None' },
    { label: 'Weapon', value: definition.weaponRequirement?.map((weapon) => weaponLabels[weapon] ?? weaponRequirementLabel(weapon as never)).join(' / ') || 'None' },
  ];
  const damage = isDamage ? [
    { label: 'Damage Type', value: 'Physical' },
    { label: 'Hits', value: String(action.hitSequence.length) },
    ...(values.physicalCoefficient ? [{ label: 'Physical Attack', value: coefficient(values.physicalCoefficient) }] : []),
    ...(['str', 'dex', 'vit', 'int'] as const).filter((stat) => (values.statScaling?.[stat] ?? 0) !== 0).map((stat) => ({ label: `Bonus ${stat.toUpperCase()}`, value: coefficient(values.statScaling![stat]!) })),
  ] : [];
  const area: SkillPresentationRow[] = [
    { label: 'Target Type', value: definition.targeting?.targetType === 'single' ? 'Single Target' : definition.targeting?.targetType === 'frontal_arc' ? 'Frontal Area' : definition.targeting?.targetType === 'area' ? 'Area Around You' : 'Self' },
    ...(action.range ? [{ label: 'Range', value: `${action.range} m` }] : []),
    ...(action.radius ? [{ label: 'Radius', value: `${action.radius} m` }] : []),
    ...(action.maxTargets ? [{ label: 'Max Targets', value: String(action.maxTargets) }] : []),
  ];
  const resource = isPassive ? [] : [{ label: 'Mana', value: `${action.manaCost} MP` }, { label: 'Cooldown', value: `${action.cooldown}s` }];
  const preview = isDamage ? { label: 'CURRENT DAMAGE PREVIEW', total: Math.round(perHit.reduce((sum, value) => sum + value, 0)), perHit } : definition.skillType === 'ACTIVE_HEAL' ? { label: 'CURRENT HEAL PREVIEW', value: `${skillHealingPreview(hero, runtime, rank)} HP`, perHit: [] } : { label: 'CURRENT EFFECT PREVIEW', value: rowsForEffects(definition, runtime, rank).map((row) => `${row.label} ${row.value}`).join(' · ') || 'Passive effect', perHit: [] };
  return { skillName: definition.name, description: definition.presentation?.description ?? runtime.description, skillType: definition.skillType, currentRank, maxRank: definition.maxRank, status, requirements, damage, specialMechanics: rowsForMechanics(definition, runtime, rank), area, resource, preview, nextRank: nextRankRows(definition, runtime, rank), isDamage };
}