import {
  calculateEquipmentStats,
  calculatePassiveEffects,
  derivedStats,
  BASE_PRIMARY_STAT,
  type Hero,
  type DerivedStats,
} from './rules.ts';
import type { EquipSlot } from './items.ts';
import { getCombatPower } from './combat-power.ts';

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
  { id: 'movementSpeed', label: 'Move Speed', unit: '%' },
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
export const CHARACTER_STAT_ROWS: CharacterStat[] = [
  { id: 'maxHP', label: 'Max HP' },
  { id: 'maxMana', label: 'Max MP' },
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
  { id: 'gloves', label: 'Gloves', x: 11, y: 42 },
  { id: 'legs', label: 'Legs', x: 11, y: 59 },
  { id: 'boots', label: 'Boots', x: 11, y: 76 },
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
  const equipment = calculateEquipmentStats(hero),
    passive = calculatePassiveEffects(hero);
  return Object.fromEntries(
    PRIMARY_ATTRIBUTES.map(({ id }) => [
      id,
      BASE_PRIMARY_STAT +
        (hero.allocatedStats[id] ??
        (id === 'vit' ? hero.allocatedStats.sta : 0) ??
        0) +
        (equipment[id] ?? 0) +
        (passive[id] ?? 0),
    ]),
  ) as Record<PrimaryAttribute, number>;
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
