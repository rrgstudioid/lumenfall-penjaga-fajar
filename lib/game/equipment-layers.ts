import { ITEMIZATION_RULES } from './canonical-config.ts';
import type { ItemData, StatBlock } from './items.ts';
export type ArmorSet = { id: string; level: number; pieces: readonly string[];
  bonuses: Partial<Record<2 | 3 | 4, StatBlock>>; enabled: boolean };
/** Membership and bonus numbers are unresolved: no guessed membership by name. */
export const ARMOR_SETS: readonly ArmorSet[] = [];
export function validateArmorSet(set: ArmorSet) {
  return ITEMIZATION_RULES.setLevels.some(level => level === set.level) &&
    new Set(set.pieces).size === 4 && set.pieces.length === 4 &&
    Object.keys(set.bonuses).every(n => [2,3,4].includes(Number(n))) &&
    Object.values(set.bonuses).every(block => Object.values(block ?? {}).every(Number.isFinite));
}
export function resolveArmorSets(items: readonly ItemData[], sets = ARMOR_SETS): StatBlock {
  const result: StatBlock = {};
  const templates = new Set(items.filter(i => i.category === 'armor').map(i => i.templateId));
  const seen = new Set<string>();
  for (const set of sets) {
    if (!set.enabled || seen.has(set.id) || !validateArmorSet(set)) continue;
    seen.add(set.id);
    const count = set.pieces.filter(id => templates.has(id)).length;
    for (const threshold of ITEMIZATION_RULES.setThresholds) if (count >= threshold)
      for (const [key, value] of Object.entries(set.bonuses[threshold] ?? {}))
        result[key as keyof StatBlock] = (result[key as keyof StatBlock] ?? 0) + (value ?? 0);
  }
  return result;
}
