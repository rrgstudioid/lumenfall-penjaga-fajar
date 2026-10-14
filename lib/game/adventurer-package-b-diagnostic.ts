import type { Game } from './world.ts';
import { readActualAdventurerDiagnostic, previewActualAdventurerDiagnostic,
  type ActualDiagnostic, type DiagnosticPreview } from './adventurer-diagnostic-v2.ts';
import { evaluateNominalOffense, produceNominalEvents } from './adventurer-nominal-offense-v3.ts';
import { evaluateDeclaredAdventurerWorkload } from './adventurer-diagnostic-workload-v2.ts';
import { evaluatePassiveEHP, PACKAGE_B_POLICY } from './diagnostic-incoming-ehp-v1.ts';

const fail = (code: string, path: string) => Object.freeze({ ok: false as const, code, path, value: null });
/** Mathematical projection only. Actual reads/previews below must prove current sources first. */
export function evaluatePackageB(actor: ActualDiagnostic) {
  if (actor.stats.blockRate !== 0) return fail('UNSUPPORTED_BLOCK_SOURCE', 'actor');
  const ehp = evaluatePassiveEHP({ kind: 'MATHEMATICAL_INPUT_NOT_ACTOR_AUTHORITY', source: actor.profile.sourceVersion,
    level: actor.input.level, maxHP: actor.stats.maxHP, physicalDefense: actor.stats.physicalDefense,
    magicDefense: actor.stats.magicDefense, evasion: actor.stats.evasion, damageReduction: actor.stats.damageReduction,
    block: { source: 'NONE', chancePercent: 0, efficiencyBonus: 0 } });
  if (!ehp.ok) return ehp;
  const offense = evaluateNominalOffense(actor);
  if (!offense.ok) return offense;
  const means = [...offense.value.actions, ...actor.actions.filter(a => a.channel === 'heal').map(a =>
    ({ id: a.id, expectedInflicted: null, healCapacity: a.healCapacity }))];
  const channels = [];
  for (const defense of ehp.value.channels) {
    const runs = [];
    for (const useHeal of [false,true]) {
      const generated = produceNominalEvents(actor, offense.value.chosen.subset, means, {
        maxHP: actor.stats.maxHP, useHeal,
        packets: Array.from({length:PACKAGE_B_POLICY.lastPacket}, (_,i) => ({at:i+1,damage:defense.landedPacket})),
      });
      if (!generated.ok) return generated;
      const audit = evaluateDeclaredAdventurerWorkload(actor, generated.value, means);
      if (!audit.ok) return audit;
      const result = generated.exposure!;
      // Audit commitments using the existing independent ledger. Its final recovery
      // to 30 is NOT credited after death; B reports its own stopped event ledger.
      const casts = result.trace.filter(e => e.kind === 'cast');
      // Packet deadlines partition continuous regeneration differently from the
      // commitment-only auditor. Bound floating summation error, never alter a
      // deadline, affordability decision, payment, or HP value to force a match.
      const auditBound = Number.EPSILON * 64 * Math.max(1,actor.resources.maxMana) * Math.max(1,casts.length);
      const maxAuditDifference = Math.max(0,...casts.map((e,i) => Math.abs(e.mana-audit.value.events[i].manaAfter)));
      if (audit.value.paidMana !== result.paidMana || maxAuditDifference > auditBound)
        return fail('RESOURCE_LEDGER_MISMATCH', defense.channel);
      runs.push(Object.freeze({ useHeal, ...result, commitments: generated.value.events,
        resourceAudit: 'EXISTING_WORKLOAD_COMMITMENTS_MATCH; no post-death recovery credit',
        maxAuditDifference, auditBound }));
    }
    channels.push(Object.freeze({ channel: defense.channel, landedPacket: defense.landedPacket,
      noHeal: runs[0], withHeal: runs[1], offenseDelta: runs[1].expectedOffenseDPS-runs[0].expectedOffenseDPS }));
  }
  return Object.freeze({ ok: true as const, value: Object.freeze({ policy: PACKAGE_B_POLICY,
    sourceVersion: actor.profile.sourceVersion, level: actor.input.level, itemId: actor.itemId,
    offense: offense.value, ehp: ehp.value, channels: Object.freeze(channels),
    shield: null, shieldReason: 'UNSUPPORTED_KIT', hpRegen: null, hpRegenReason: 'NO_ACTIVE_CONSUMER',
    utility: null, totalCombatPower: null, reason: 'COMPOSITE_NORMALIZATION_HOLD',
    assumptions: 'Conditioned landed nonCrit/unblocked traces; not stochastic lifespan or optimal rotation. Lower healing may mean less incoming damage. One shared Mana/time ledger.' }) });
}
export function readPackageB(game: Game) {
  const actor = readActualAdventurerDiagnostic(game);
  if (!actor.ok) return actor;
  if (game.blocking || game.invincible > 0) return fail('TEMPORARY_DEFENSE_STATE', 'game');
  return evaluatePackageB(actor.value);
}
export function previewPackageB(game: Game, request: DiagnosticPreview) {
  const current = readPackageB(game);
  if (!current.ok) return current;
  const actor = previewActualAdventurerDiagnostic(game, request);
  if (!actor.ok) return actor;
  const projected = evaluatePackageB(actor.value);
  if (!projected.ok) return projected;
  const metric = (before: number, after: number) => Object.freeze({ before, after, delta: after-before,
    relativePercent: before > 0 ? (after-before)/before*100 : null,
    relativeReason: before > 0 ? null : 'ZERO_REFERENCE_NOT_APPLICABLE' });
  return Object.freeze({ ok: true as const, value: projected.value, comparison: Object.freeze({
    authority: 'LEGAL_PROJECTION_NOT_CAST_OR_EQUIP_PERMISSION',
    offense: metric(current.value.offense.expectedDPS,projected.value.offense.expectedDPS),
    geometric: metric(current.value.ehp.geometric,projected.value.ehp.geometric),
    channels: Object.freeze(current.value.channels.map((c,i) => Object.freeze({ channel:c.channel,
      retainedOffense: metric(c.withHeal.expectedOffenseDPS,projected.value.channels[i].withHeal.expectedOffenseDPS),
      usableHPS: metric(c.withHeal.usableHPS,projected.value.channels[i].withHeal.usableHPS) }))),
    winner: null, reason: 'DIMENSIONAL_COMPARISON_NO_TOTAL_SCORE' }) });
}
