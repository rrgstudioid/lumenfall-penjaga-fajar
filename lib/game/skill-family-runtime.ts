import { ADVENTURER_V3_SKILL_MAP } from './adventurer-v3.ts';
import { WARRIOR_V3_SKILL_MAP } from './warrior-v3.ts';
import { BERSERKER_V3_SKILL_MAP } from './berserker-v3.ts';
import { BLADE_MASTER_V3_SKILL_MAP } from './blade-master-v3.ts';
import { THIEF_V3_SKILL_MAP } from './thief-v3.ts';
import { familyBinding, familyCooldownRemaining, isActiveFamilyMember, isFamilyBinding, reconcileSkillFamilies, resolveFamilyCooldownKey, resolveFamilySkillReference } from './skill-family.ts';
import { getSkillFamilyNodeState, type SkillDefinitionV3, type SkillProgressionContextV3 } from './skill-progression-v3.ts';
import type { Hero } from './rules.ts';

/** Canonical definitions, not UI copies. Future content joins the normal registry;
 * family metadata alone opts it in. No current lineage is migrated here. */
export const skillFamilyDefinitions: Record<string, SkillDefinitionV3> = {
  ...ADVENTURER_V3_SKILL_MAP, ...WARRIOR_V3_SKILL_MAP,
  ...BERSERKER_V3_SKILL_MAP, ...BLADE_MASTER_V3_SKILL_MAP,
  ...THIEF_V3_SKILL_MAP,
};

export function heroFamilyContext(hero: Hero): SkillProgressionContextV3 | null {
  return hero.skillArchitectureVersion === 3 && hero.skillProgressionV3
    ? { state: hero.skillProgressionV3, level: hero.level, skills: skillFamilyDefinitions, jobs: {} }
    : null;
}

export function heroFamilySkillActive(hero: Hero, skillId: string): boolean {
  const context = heroFamilyContext(hero);
  if (!context && hero.skillArchitectureVersion === 3 && skillFamilyDefinitions[skillId]?.familyId) return false;
  return !context || isActiveFamilyMember(context, skillId);
}

export function heroFamilySkillReference(hero: Hero, reference: string, followPredecessor = false): string | null {
  const context = heroFamilyContext(hero);
  return context ? resolveFamilySkillReference(context, reference, followPredecessor) : isFamilyBinding(reference) ? null : reference;
}

export function heroFamilyHotbarBinding(hero: Hero, id: string): string {
  const familyId = heroFamilyContext(hero)?.skills[id]?.familyId;
  return familyId ? familyBinding(familyId) : id;
}

export function heroFamilyNodeStates(hero: Hero, id: string) {
  const context = heroFamilyContext(hero);
  return context?.skills[id]?.familyId ? getSkillFamilyNodeState(context, id) : [];
}

export function heroSkillCooldownKey(hero: Hero, id: string): string {
  return heroFamilyContext(hero) ? resolveFamilyCooldownKey(id, skillFamilyDefinitions) : id;
}

export function heroSkillCooldownRemaining(hero: Hero, id: string, cooldowns: Record<string, number>): number {
  return heroFamilyContext(hero) ? familyCooldownRemaining(id, skillFamilyDefinitions, cooldowns) : Math.max(0, cooldowns[id] ?? 0);
}

/** Job changes can clear old non-family cooldowns as before, but not family debt. */
export function retainFamilyCooldowns(cooldowns: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, remaining] of Object.entries(cooldowns)) {
    const key = resolveFamilyCooldownKey(id, skillFamilyDefinitions);
    if (isFamilyBinding(key) && remaining > 0) result[key] = Math.max(result[key] ?? 0, remaining);
  }
  return result;
}

export function reconcileHeroSkillFamilies(hero: Hero): void {
  const context = heroFamilyContext(hero);
  if (!context) return;
  reconcileSkillFamilies(context);
  for (const definition of Object.values(context.skills)) {
    if (!definition.familyId) continue;
    const rank = context.state.skillRanks[definition.id] ?? 0;
    hero.skillLevels[definition.id] = rank;
    if (definition.familyRole === 'PASSIVE') hero.passiveLevels[definition.id] = rank;
  }
}
