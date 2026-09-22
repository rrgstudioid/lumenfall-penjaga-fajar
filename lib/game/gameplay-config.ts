import type { ProgressionArchitecture } from './progression.ts';

// Legacy switch only. V2 never enables stamina, even if this switch changes later.
export const STAMINA_ENABLED = false;

type ResourceOwner = { progressionArchitecture?: ProgressionArchitecture };
export type GameplayResource = 'hp' | 'mana' | 'stamina';

/** Shared gameplay/display policy; optional legacy override is for policy tests only. */
export function resourcePolicy(
  hero: ResourceOwner,
  legacyStaminaEnabled = STAMINA_ENABLED,
) {
  const legacy = hero.progressionArchitecture !== 'v2_test';
  return {
    hp: true,
    mana: true,
    stamina: legacy && legacyStaminaEnabled,
    retainLegacyStaminaStat: legacy,
  } as const;
}
export function isResourceEnabled(
  hero: ResourceOwner,
  resource: GameplayResource,
) {
  return resourcePolicy(hero)[resource];
}
/** Keep the old field/schema, but give V2 no build value from VIT or imported stamina modifiers. */
export function staminaDerivedValue(hero: ResourceOwner, legacyValue: number) {
  return resourcePolicy(hero).retainLegacyStaminaStat ? legacyValue : 0;
}
