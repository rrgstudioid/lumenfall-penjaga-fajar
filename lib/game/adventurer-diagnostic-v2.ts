import { Game } from './world.ts';
import { readAdventurerDiagnosticSource, adventurerReferenceSkillMetadata } from './adventurer-ranks-reference-v2.ts';
import { buildAdventurerDiagnosticProfile, type AdventurerDiagnosticInput } from './adventurer-cp-foundation-v2.ts';
import { evaluateExpectedFinal, type ExpectedFinalInput, type Provenance } from './expected-final-damage-v2.ts';
import { combatProfile, equipItem, allocateStatPoint } from './rules.ts';
import type { Hero } from './rules.ts';
import { COMBAT_MECHANICS } from './combat-mechanics.ts';
import { resolveSkillAction } from './skill-action.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS } from './adventurer-v3.ts';

export const DIAGNOSTIC_VERSION = 'ADVENTURER_ACTUAL_DIAGNOSTIC_V1';
const unavailable = (code: string, path: string) => Object.freeze({ ok: false as const, code, path, reason: code, value: null });
/** Actual local Game boundary. No security claim for hostile Proxy/prototype/save.
 * Never authorizes an execution. Re-read current references on EVERY invocation. */
export function readActualAdventurerDiagnostic(game: Game) {
  if (!(game instanceof Game)) return unavailable('NOT_ACTUAL_GAME', 'game');
  if (!game.isDevelopmentDiagnosticLifecycleAvailable()) return unavailable('INACTIVE_LIFECYCLE', 'game');
  return readHeroDiagnostic(game.hero, game);
}
function readHeroDiagnostic(hero: Hero, game: Game) {
  const source = readAdventurerDiagnosticSource(hero);
  if (!source.ok) return source;
  const s = source.value, stats = s.stats;
  const provenance = Object.freeze({ source: 'actual Game current Hero/owned MAIN; narrow admission', version: s.version, label: 'ACTUAL READOUT — NOT CAST AUTHORIZATION' });
  const input: AdventurerDiagnosticInput = Object.freeze({ kind: 'MATHEMATICAL_COHORT_NOT_RUNTIME_AUTHORITY',
    provenance, job: 'adventurer', level: s.level, allocation: s.allocation, unspentPoints: s.unspentPoints,
    ranks: s.ranks, ledger: s.ledger, weapon: s.weapon, maxHP: stats.maxHP });
  const profile = buildAdventurerDiagnosticProfile(input);
  if (!profile.ok) return profile;
  const actions = profile.value.actions.map(a => {
    if (a.id === 'basic') return Object.freeze({ ...a, mana: 0, cooldown: null, lock: 0, delay: 0 });
    const definition = ADVENTURER_V3_RUNTIME_SKILLS.find(d => d.id === a.id)!;
    const metadata = adventurerReferenceSkillMetadata(a.id, a.rank)!;
    // Cost/timing consumer only; remove obsolete damage arithmetic in a COPY.
    const safeDefinition = { ...definition, baseDamage: 0, physicalCoefficient: 0, magicCoefficient: 0,
      skillPowerCoefficient: 0, statScaling: {}, baseDamageMinByRank: undefined, baseDamageMaxByRank: undefined,
      skillPowerFactor: 0, rankPowerFactorByRank: [1,1,1,1,1],
      rankValues: Array.from({ length: a.rank }, () => ({ manaCost: metadata.mana, cooldown: metadata.cooldown,
        physicalCoefficient: 0, statScaling: {} })), knockbackStrength: 0 };
    const resolved = resolveSkillAction(safeDefinition, { stats, rank: a.rank, masteryPower: 1,
      masteryCooldown: 1, equipmentDamage: 0, weaponAllowed: true, weaponStyle: 'one_hand_sword',
      rng: () => { throw new Error('Diagnostic metadata may not draw RNG'); } });
    return Object.freeze({ ...a, mana: resolved.manaCost, cooldown: resolved.cooldown,
      lock: resolved.actionLockDuration!, delay: resolved.timing.impact });
  });
  const numeric = [stats.accuracy, stats.criticalRate, stats.criticalDamage, stats.physicalPenetration,
    stats.attackSpeed, stats.maxMana, stats.manaRecovery, stats.manaCostReduction, stats.cooldownReduction,
    hero.mana, game.attackTimer, game.comboWindow, game.combatTime];
  if (numeric.some(n => !Number.isFinite(n) || n < 0) || stats.attackSpeed <= 0 || hero.mana > stats.maxMana)
    return unavailable('INVALID_ACTUAL_RESOURCE_OR_CLOCK', 'game');
  const cooldowns = Object.freeze(Object.fromEntries(actions.filter(a => a.id !== 'basic').map(a => [a.id, game.skillCooldowns[a.id] ?? 0])));
  if (Object.values(cooldowns).some(n => !Number.isFinite(n) || n < 0)) return unavailable('INVALID_ACTUAL_COOLDOWN', 'game');
  return Object.freeze({ ok: true as const, value: Object.freeze({ version: DIAGNOSTIC_VERSION,
    authority: 'CURRENT_ACTOR_READOUT_NOT_ENROLLMENT', input, profile: profile.value, actions: Object.freeze(actions),
    stats, actorId: s.actorId, itemId: s.weapon.instanceLabel,
    clocks: Object.freeze({ basicInterval: combatProfile(hero).cooldown, thirdDelay: COMBAT_MECHANICS.comboFinisherDelay,
      comboLifetime: 1.1, attackSpeed: stats.attackSpeed, basicRemaining: game.attackTimer,
      comboIndex: game.combo, comboRemaining: game.comboWindow, cooldowns,
      actionLocked: game.actionLock.active(game.combatTime), now: game.combatTime }),
    resources: Object.freeze({ mana: hero.mana, maxMana: stats.maxMana, recovery: stats.manaRecovery }) }) });
}
export type DiagnosticPreview = Readonly<{ itemId?: string; allocate?: readonly ('str'|'vit'|'dex'|'int')[] }>;
/** Actual legal consumers on a private copy. Never an equip/cast permission. */
export function previewActualAdventurerDiagnostic(game: Game, request: DiagnosticPreview) {
  const current = readActualAdventurerDiagnostic(game);
  if (!current.ok) return current;
  if (!request || Object.keys(request).some(k => k !== 'itemId' && k !== 'allocate') ||
      request.allocate !== undefined && (!Array.isArray(request.allocate) || request.allocate.length > game.hero.statPoints))
    return unavailable('INVALID_PREVIEW', 'request');
  let hero = structuredClone(game.hero);
  if (request.itemId !== undefined) {
    if (typeof request.itemId !== 'string' || hero.inventory.filter(i => i.id === request.itemId).length !== 1)
      return unavailable('INVALID_PREVIEW_ITEM', 'itemId');
    const equipped = equipItem(hero, request.itemId, 'mainHand');
    if (!equipped.ok) return unavailable('ILLEGAL_PREVIEW_EQUIP', 'itemId');
  }
  for (const stat of request.allocate ?? []) {
    if (!['str','vit','dex','int'].includes(stat)) return unavailable('INVALID_PREVIEW_STAT', 'allocate');
    const allocated = allocateStatPoint(hero, stat);
    if (!allocated.ok) return unavailable('ILLEGAL_PREVIEW_ALLOCATION', 'allocate');
    hero = allocated.hero;
  }
  return readHeroDiagnostic(hero, game);
}
export type ActualDiagnostic = Extract<ReturnType<typeof readActualAdventurerDiagnostic>, { ok: true }>['value'];
export type DiagnosticTargets = ExpectedFinalInput['targets'];
/** Caller selection, never a learned-kit/loadout scoring default. */
export function evaluateAdventurerDiagnosticActions(actor: ActualDiagnostic, targets: DiagnosticTargets | undefined,
  selected: readonly string[] | undefined, provenance: Provenance | undefined) {
  if (!targets || !selected || !provenance) return unavailable('INPUT_MISSING', 'targets/selectedActions/provenance');
  if (!selected.length || selected.length > 64 || new Set(selected).size !== selected.length)
    return unavailable('INVALID_ACTION_SELECTION', 'selectedActions');
  const rows = [];
  for (const id of selected) {
    const a = actor.actions.find(a => a.id === id);
    if (!a) return unavailable('UNLEARNED_OR_UNSUPPORTED_ACTION', id);
    if (a.channel === 'heal') rows.push(Object.freeze({ id, rank: a.rank, expectedInflicted: null, healCapacity: a.healCapacity,
      reason: 'CAPACITY_ONLY; missingHP/exposure not supplied', evaluation: null }));
    else {
      const result = evaluateExpectedFinal({ scope: 'PHYSICAL_DIRECT_SINGLE_MAIN_FIXED_DEFENSE', attack: a.snapshot!,
        attacker: { provenance, level: actor.input.level, accuracy: actor.stats.accuracy, canCrit: true,
          criticalRate: actor.stats.criticalRate, criticalDamage: actor.stats.criticalDamage,
          physicalPenetration: actor.stats.physicalPenetration }, targets });
      if (!result.ok) return result;
      rows.push(Object.freeze({ id, rank: a.rank, expectedInflicted: result.value.weightedExpectedInflictedDamage,
        healCapacity: null, reason: null, evaluation: result.value }));
    }
  }
  return Object.freeze({ ok: true as const, value: Object.freeze({ version: DIAGNOSTIC_VERSION, provenance,
    rows: Object.freeze(rows), finalCombatPower: null, unsupported: Object.freeze(['Q6/Block/barrier/EHP','magic/DoT/AoE','usable sustain/utility']) }) });
}
