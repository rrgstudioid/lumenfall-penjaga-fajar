import {
  calculateEquipmentStats,
  calculatePassiveEffects,
  derivedStats,
  BASE_PRIMARY_STAT,
  resourceProfileFor,
  canonicalResourceProfile,
  type Hero,
  type DerivedStats,
} from './rules.ts';
import type { EquipSlot } from './items.ts';
import { getCombatPower } from './combat-power.ts';
import { COMBAT_MECHANICS } from './combat-mechanics.ts';
import { resolveCastReductions } from './cast-timing.ts';
import { intrinsicClassResources } from './resource-profiles.ts';

/** Pure readout of the same intrinsic profile and final resolver used by gameplay. */
export function characterResourceBreakdown(hero: Hero) {
  const profile=resourceProfileFor(hero),approved=canonicalResourceProfile(hero),stats=derivedStats(hero);
  const intrinsic=approved ? intrinsicClassResources(approved,hero.level,stats.vit,Math.max(0,stats.int-BASE_PRIMARY_STAT)) : null;
  return Object.freeze({
    profile,
    hp:Object.freeze({base:profile.baseHP,growth:profile.hpPerLevel,
      levelContribution:profile.hpPerLevel*(hero.level-1),
      primaryContribution:stats.vit*(profile.vitBase+profile.vitPerLevel*(hero.level-1)),
      intrinsic:Math.round(intrinsic?.unroundedHP ?? profile.baseHP+profile.hpPerLevel*(hero.level-1)+stats.vit*(profile.vitBase+profile.vitPerLevel*(hero.level-1))),
      final:stats.maxHP}),
    mana:Object.freeze({levelFoundation:intrinsic?.levelMana ?? null,bonusInt:Math.max(0,stats.int-BASE_PRIMARY_STAT),
      primaryContribution:intrinsic?.intMana ?? null,intrinsic:intrinsic?.intrinsicMana ?? null,final:stats.maxMana}),
  });
}

export const PRIMARY_ATTRIBUTES = [
  { id: 'str', name: 'Strength', short: 'STR' },
  { id: 'vit', name: 'Vitality', short: 'VIT' },
  { id: 'dex', name: 'Dexterity', short: 'DEX' },
  { id: 'int', name: 'Intelligence', short: 'INT' },
] as const;
export type PrimaryAttribute = (typeof PRIMARY_ATTRIBUTES)[number]['id'];
export const characterNumber = (value: number) =>
  Number(value.toFixed(2)).toLocaleString('en-US');
export type CharacterStat = {
  id: keyof DerivedStats;
  label: string;
  unit?: string;
};
export const COMBAT_STATS: CharacterStat[] = [
  { id: 'physicalAttack', label: 'Physical Attack' },
  { id: 'physicalDefense', label: 'Physical Defense' },
  { id: 'magicAttack', label: 'Magic Attack' },
  { id: 'magicDefense', label: 'Magic Defense' },
  { id: 'criticalRate', label: 'Critical Rate', unit: '%' },
  { id: 'criticalDamage', label: 'Critical Damage', unit: '%' },
  { id: 'attackSpeed', label: 'Attack Speed', unit: '%' },
  { id: 'movementSpeed', label: 'Movement Speed', unit: '%' },
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'evasion', label: 'Evasion' },
];
export const SURVIVAL_STATS: CharacterStat[] = [
  { id: 'hpRecovery', label: 'HP Regen', unit: '/s' },
  { id: 'manaRecovery', label: 'MP Regen', unit: '/s' },
  { id: 'healingPower', label: 'Healing Power' },
  { id: 'blockRate', label: 'Block Rate', unit: '%' },
];
export const ADVANCED_STATS: CharacterStat[] = [
  { id: 'castStat', label: 'CastStat' },
  { id: 'cooldownReduction', label: 'Cooldown Reduction', unit: '%' },
  { id: 'damageReduction', label: 'Damage Reduction', unit: '%' },
  { id: 'physicalPenetration', label: 'Physical Penetration', unit: '%' },
  { id: 'magicPenetration', label: 'Magic Penetration', unit: '%' },
  { id: 'skillDamage', label: 'Skill Damage', unit: '%' },
  { id: 'skillPower', label: 'Skill Power' },
  { id: 'manaCostReduction', label: 'Mana Cost Reduction', unit: '%' },
  { id: 'bossDamage', label: 'Boss Damage', unit: '%' },
  { id: 'eliteDamage', label: 'Elite Damage', unit: '%' },
  { id: 'expGain', label: 'EXP Gain', unit: '%' },
  { id: 'goldDropRate', label: 'Gold Drop Rate', unit: '%' },
  { id: 'itemDropRate', label: 'Item Drop Rate', unit: '%' },
  { id: 'materialDropRate', label: 'Material Drop Rate', unit: '%' },
];
/** Consumer notes, not new conversions/caps or a replacement stat resolver. */
export function characterStatNote(id: keyof DerivedStats, stats?: DerivedStats): string | null {
  if (id === 'hpRecovery') return 'HP pulih per detik aktif, di dalam dan di luar combat selama hidup. Berhenti saat pause atau loading; tidak memberi pemulihan offline.';
  if (id === 'castStat') {
    const r=stats ? resolveCastReductions({castStat:stats.castStat,variablePercent:stats.variableCastReduction,fixedPercent:stats.fixedCastReduction}) : null;
    return `2 × Bonus DEX + Bonus INT. CastStat ÷ 4 mengurangi variable casting (maksimal 80% dari stat).${r ? ` Saat ini: stat ${characterNumber(r.statPercent)}%, total variable ${characterNumber(r.variablePercent)}%, fixed ${characterNumber(r.fixedPercent)}%.` : ''} Total variable maksimal 100%, fixed hanya dari sumber explicit maksimal 50%; charge dan action lock mengikuti skill.`;
  }
  if (id === 'criticalRate') return `Total sumber Critical Rate; peluang Crit physical normal dibatasi ${COMBAT_MECHANICS.criticalChanceCap * 100}%. Aturan Crit khusus mengikuti skill.`;
  if (id === 'blockRate') return `Total sumber Block; peluang efektif maksimal ${COMBAT_MECHANICS.blockChanceCap * 100}%, mengurangi damage 30% bila berhasil pada physical direct yang blockable. Periodic/magic tidak otomatis Block. Diagnostic CP memakai kontrak terpisah.`;
  if (id === 'magicAttack') return 'Nilai scalar compatibility untuk skill yang belum dimigrasikan. Fondasi baru: Base Magic universal + 2 × Bonus INT + sumber flat magic sah. Range weapon dan coefficient harus explicit; scalar Staff/Wand bukan range magic.';
  if (id === 'cooldownReduction') return 'Pengurangan cooldown efektif maksimal 40%. INT tidak memberi CDR otomatis; charge, action lock dan recovery tetap mengikuti skill.';
  if (id === 'evasion') return 'Rating Evasion. Peluang menghindar bergantung pada consumer dan Accuracy penyerang; bukan persentase menghindar tetap.';
  if (id === 'healingPower') return 'Dipakai hanya oleh heal yang mendeklarasikannya. Minor Heal memakai persentase Max HP, tanpa tambahan Healing Power.';
  return null;
}
export const CHARACTER_STAT_ROWS: CharacterStat[] = [
  { id: 'maxHP', label: 'Max HP' },
  { id: 'maxMana', label: 'Max Mana' },
  ...COMBAT_STATS,
  ...SURVIVAL_STATS,
  ...ADVANCED_STATS,
];

// All existing equipment slots, including legs and pet, remain directly accessible.
export const PAPER_DOLL_SLOTS: Array<{
  id: EquipSlot;
  label: string;
  hint?: string;
  x: number;
  y: number;
}> = [
  { id: 'head', label: 'Head', x: 11, y: 8 },
  { id: 'chest', label: 'Armor', x: 11, y: 25 },
  { id: 'legs', label: 'Legs', x: 11, y: 42 },
  { id: 'boots', label: 'Boots', x: 11, y: 59 },
  { id: 'mainHand', label: 'Main Hand', x: 89, y: 8 },
  { id: 'offHand', label: 'Off Hand', x: 89, y: 25 },
  { id: 'necklace', label: 'Necklace', x: 89, y: 42 },
  { id: 'accessory', label: 'Accessories', hint: 'Untuk wings dan aksesori tambahan.', x: 89, y: 59 },
  { id: 'pet', label: 'Pet', x: 89, y: 76 },
  { id: 'ring1', label: 'Ring 1', x: 20, y: 96 },
  { id: 'ring2', label: 'Ring 2', x: 40, y: 96 },
  { id: 'earring1', label: 'Earring 1', x: 60, y: 96 },
  { id: 'earring2', label: 'Earring 2', x: 80, y: 96 },
];

export function characterAttributes(hero: Hero) {
  const { str, vit, dex, int } = derivedStats(hero);
  return { str, vit, dex, int };
}

export function characterAttributeBreakdown(hero: Hero, attribute: PrimaryAttribute) {
  const equipment = calculateEquipmentStats(hero);
  const passive = calculatePassiveEffects(hero);
  const allocated = hero.allocatedStats[attribute] ?? (attribute === 'vit' ? hero.allocatedStats.sta : 0) ?? 0;
  const bonus = (equipment[attribute] ?? 0) + (passive[attribute] ?? 0);
  return { base: BASE_PRIMARY_STAT, allocated, bonus, final: BASE_PRIMARY_STAT + allocated + bonus };
}

/** Tooltip deltas use the live calculator, including modifiers and caps. */
export function attributeEffects(hero: Hero, attribute: PrimaryAttribute) {
  const before = derivedStats(hero);
  const after = derivedStats({
    ...hero,
    allocatedStats: {
      ...hero.allocatedStats,
      [attribute]: (hero.allocatedStats[attribute] ?? 0) + 1,
    },
  });
  return CHARACTER_STAT_ROWS.map((stat) => ({
    ...stat,
    delta: Number((after[stat.id] - before[stat.id]).toFixed(4)),
  })).filter((stat) => stat.delta !== 0);
}

export type CombatPowerReading = {
  total: number;
  contributions: ReadonlyArray<{ label: string; value: number }>;
};
export type CombatPowerCalculator = (hero: Hero) => CombatPowerReading;
/** Default binding is the shared production calculator, never an item gear score. */
export function readCharacterPower(
  hero: Hero,
  calculator?: CombatPowerCalculator,
): CombatPowerReading | null {
  const result = (calculator ?? getCombatPower)(hero);
  return Number.isFinite(result.total) && result.total >= 0 ? result : null;
}
