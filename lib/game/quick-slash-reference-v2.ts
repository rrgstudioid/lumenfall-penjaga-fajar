import { composeAttackCore, composeBonusScaling, prepareRawAttackExecution,
  type AttackExecutionSnapshot, type AttackSource, type FoundationResult } from './attack-range-v2.ts';
import { BASIC_REFERENCE_B, openBasicReferenceBinding, prepareBasicReferenceAttack,
  type BasicReferenceBinding } from './basic-attack-reference-v2.ts';
import { calculateBaseStats, type Hero, type DerivedStats } from './rules.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS } from './adventurer-v3.ts';
import { resolveSkillAction, type ResolvedSkillAction } from './skill-action.ts';
import type { SkillDefinition } from './skills.ts';

/** Separate skill authorization. Basic B supplies ONLY its unchanged neutral
 * actor/equipment proof; neither its token nor coefficient authorizes a skill. */
export const QUICK_SLASH_REFERENCE = Object.freeze({ version: 'Q2_Q4_QUICK_SLASH_R1_1',
  skillId: 'v3-adventurer-quick-slash', coefficient: 1.05, bonusSTRCoefficient: .02,
  mana: 3, cooldown: 3.2, range: 3.8 });
type Host = { hero: Hero };
export type QuickSlashBinding = Readonly<{ version: typeof QUICK_SLASH_REFERENCE.version }>;
type State = { host: Host; neutralProof: BasicReferenceBinding; serial: number };
const bindings = new WeakMap<QuickSlashBinding, State>();
const failure = (code: string, path: string): FoundationResult<never> =>
  Object.freeze({ ok: false, code, path, reason: `Quick Slash reference rejected: ${code} (${path})` });

export function openQuickSlashBinding(host: Host): FoundationResult<QuickSlashBinding> {
  const neutral = openBasicReferenceBinding(host);
  if (!neutral.ok) return neutral;
  const binding = Object.freeze({ version: QUICK_SLASH_REFERENCE.version });
  bindings.set(binding, { host, neutralProof: neutral.value, serial: 0 });
  return Object.freeze({ ok: true, value: binding });
}

export type PreparedQuickSlash = Readonly<{ snapshot: AttackExecutionSnapshot;
  stats: Readonly<DerivedStats>; action: ResolvedSkillAction; hero: Hero }>;
export function prepareQuickSlash(binding: QuickSlashBinding, host: Host,
  definition: SkillDefinition): FoundationResult<PreparedQuickSlash> {
  const state = bindings.get(binding);
  if (!state || state.host !== host) return failure('BINDING_IDENTITY_MISMATCH', 'host');
  const hero = host.hero, progression = hero.skillProgressionV3;
  if (!progression || progression.skillArchitectureVersion !== 3 ||
      progression.skillRanks[QUICK_SLASH_REFERENCE.skillId] !== 1 ||
      progression.grantedRanks[QUICK_SLASH_REFERENCE.skillId] !== 1 ||
      hero.skillLevels[QUICK_SLASH_REFERENCE.skillId] !== 1 || progression.totalEarnedSP !== 0 || hero.skillPoints !== 0 ||
      progression.chosenCoreJob !== null || progression.chosenSpecialization !== null || progression.chosenAdvancedJob !== null)
    return failure('UNSUPPORTED_RANK_OR_GRANT', 'hero.skillProgressionV3');
  if (definition !== ADVENTURER_V3_RUNTIME_SKILLS[0] || definition.id !== QUICK_SLASH_REFERENCE.skillId ||
      definition.rankValues?.[0].physicalCoefficient !== QUICK_SLASH_REFERENCE.coefficient ||
      definition.rankValues?.[0].statScaling?.str !== QUICK_SLASH_REFERENCE.bonusSTRCoefficient ||
      definition.manaCost !== 3 || definition.cooldown !== 3.2 || definition.range !== 3.8 ||
      definition.targetType !== 'single' || definition.effect !== 'damage' || definition.castTiming !== undefined ||
      definition.hitSequence !== undefined || definition.statusEffect !== null || definition.canCrit !== true ||
      definition.damageType !== 'physical' || definition.progressionMode !== 'rank_values' ||
      definition.weaponRequirement?.length !== 1 || definition.weaponRequirement[0] !== 'one_hand_sword' ||
      definition.modifiers !== undefined || definition.statuses !== undefined || definition.rankMechanics !== undefined ||
      definition.temporaryBuffs !== undefined || definition.weaponMode !== undefined || definition.nonDamaging ||
      definition.tags?.length !== 1 || definition.tags[0] !== 'v3-adventurer')
    return failure('SKILL_PROVENANCE_MISMATCH', 'skill');
  // Reuse actual neutral-source checks on a clone for resolved stats, without
  // broadening Basic B or using its damage budget for skill execution.
  const neutral = prepareBasicReferenceAttack(state.neutralProof, host, 1);
  if (!neutral.ok) return neutral;
  const owner = neutral.value.snapshot.owner;
  const source = (category: AttackSource['category'], suffix: string): AttackSource =>
    Object.freeze({ category, sourceId: `${owner.actorId}:${owner.epoch}:QS:${suffix}`, owner });
  const primary = calculateBaseStats(hero);
  const core = composeAttackCore({ damageType: 'physical', owner,
    base: { value: 8, source: source('BASE', 'approved-lv1') },
    primary: { stat: 'STR', effective: primary.str, source: source('PRIMARY_STAT', 'bonus-str') }, globalFlat: [] });
  if (!core.ok) return core;
  const scaling = composeBonusScaling({ STR: primary.str, VIT: primary.vit, DEX: primary.dex, INT: primary.int },
    { STR: QUICK_SLASH_REFERENCE.bonusSTRCoefficient });
  if (!scaling.ok) return scaling;
  const identity = neutral.value.snapshot.instances.MAIN!;
  const prepared = prepareRawAttackExecution({
    context: { validation: 'VALIDATED_EXECUTION_CONTEXT', executionId: `${owner.actorId}:${owner.epoch}:QS:${++state.serial}`,
      owner, mode: 'SINGLE_MAIN', dualWeaponAuthorized: false, thrownAuthorized: false, magicSourceHands: [], instances: { MAIN: identity } },
    core: core.value,
    layers: { MAIN: { hand: 'MAIN', identity, damageType: 'physical', source: source('RAW_WEAPON', identity.instanceId),
      composition: { stage: 'BASE', range: BASIC_REFERENCE_B.baseRange, enhancementMultiplier: 1, contributionMultiplier: 1 } } },
    attackModifier: { scope: 'ATTACK_RANGE', damageType: 'physical', multiplier: 1, sources: [] },
    rankBudget: { coefficient: QUICK_SLASH_REFERENCE.coefficient, scaling: scaling.value, source: source('SKILL_RANK', 'quick-r1') },
    hits: [{ hand: 'MAIN', weight: 1 }],
  });
  if (!prepared.ok) return prepared;
  // Metadata seam only: strip legacy arithmetic on a fresh definition, never the
  // registry. No BaseRoll, default RNG, skill multiplier or stat term can run.
  const metadata: SkillDefinition = { ...definition, baseDamage: 0, physicalCoefficient: 0, magicCoefficient: 0,
    skillPowerCoefficient: 0, statScaling: {}, baseDamageMinByRank: undefined, baseDamageMaxByRank: undefined,
    skillPowerFactor: 0, rankPowerFactorByRank: [1], rankValues: [{ physicalCoefficient: 0, statScaling: {}, manaCost: 3, cooldown: 3.2 }],
    // Existing kit explicitly rules out knockback; no default legacy .45 cue.
    knockbackStrength: 0 };
  const action = resolveSkillAction(metadata, { stats: neutral.value.stats, rank: 1,
    masteryPower: 1, masteryCooldown: 1, equipmentDamage: 0, weaponAllowed: true,
    weaponStyle: 'one_hand_sword', rng: () => { throw new Error('Metadata must not draw RNG'); } });
  if (action.manaCost !== 3 || action.cooldown !== 3.2 || action.hitSequence.length !== 1 ||
      action.hitSequence[0].delay !== 0 || action.damageMultiplier !== 1 || action.hitSequence[0].damageMultiplier !== 1 ||
      action.statuses.length || action.targetModifiers.length)
    return failure('UNSUPPORTED_ACTION_METADATA', 'action');
  return Object.freeze({ ok: true, value: Object.freeze({ snapshot: prepared.value, stats: neutral.value.stats, action, hero }) });
}
