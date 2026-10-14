import { evaluateAdventurerDiagnosticActions, readActualAdventurerDiagnostic, previewActualAdventurerDiagnostic,
  type ActualDiagnostic, type DiagnosticPreview, type DiagnosticTargets } from './adventurer-diagnostic-v2.ts';
import { evaluateDeclaredAdventurerWorkload, type DeclaredWorkload } from './adventurer-diagnostic-workload-v2.ts';
import { ADVENTURER_RANKS_REFERENCE } from './adventurer-ranks-reference-v2.ts';
import type { Game } from './world.ts';

/** OWNER ACC CP_V3_PROTOCOL_TRAVEL_OWNER_ACC. Natural units, never player CP. */
export const NOMINAL_OFFENSE_V3 = Object.freeze({ version: 'OFFENSE_NOMINAL_30S_V3',
  bankVersion: 'CP_ADV_BANK_V3_CANDIDATE_1', horizon: 30, displayDecimals: 2,
  eventLimit: 4096, method: 'ORDERED_EFFICIENCY_SUBSETS_V1' });
const provenance = Object.freeze({ source: 'CP_V3_PROTOCOL_TRAVEL_OWNER_ACC.txt / approved Package A',
  version: NOMINAL_OFFENSE_V3.version, label: 'Nominal offense — not total Combat Power' });
const failure = (code: string, path: string) => Object.freeze({ ok: false as const, code, path, reason: code, value: null });
const finite = (n: number) => Number.isFinite(n) && n >= 0;
/** Optional CP-only exposure. The default A producer has no HP state. */
export type NominalExposure = Readonly<{ maxHP: number; useHeal: boolean;
  packets: readonly Readonly<{ at: number; damage: number }>[] }>;
type ExposureRow = Readonly<{ kind: 'incoming'|'cast'|'impact'; at: number; id: string;
  hp: number; mana: number; amount: number; deficit: number }>;
export function nominalOffenseBank(level: number) {
  if (!Number.isSafeInteger(level) || level < 1 || level > 14) return failure('UNSUPPORTED_LEVEL', 'bank.level');
  const defense = Math.round(4 + 1.1 * level);
  const targets: DiagnosticTargets = Object.freeze(([
    ['normal', 1, .60], ['elite', 1.25, .25], ['boss', 1.5, .15],
  ] as const).map(([variant, multiplier, weight]) => Object.freeze({ provenance: Object.freeze({
    source: provenance.source, version: NOMINAL_OFFENSE_V3.bankVersion, label: `Fixed level-matched bank Lv${level}` }),
    variant, weight, physicalDefense: defense * multiplier, evasion: 10, targetBonusPercent: 0 })));
  return Object.freeze({ ok: true as const, value: targets });
}

/** An ordered mathematical producer, not an actor receipt or optimizer. Each
 * candidate is checked by the independent existing workload ledger afterwards. */
export function produceNominalEvents(actor: ActualDiagnostic, selected: readonly string[],
  means: readonly Readonly<{id: string; expectedInflicted: number | null}>[], exposure?: NominalExposure) {
  const basic = actor.actions.find(a => a.id === 'basic');
  const skills = selected.filter(id => id !== 'basic').map(id => actor.actions.find(a => a.id === id));
  if (!selected.includes('basic') || new Set(selected).size !== selected.length ||
      !basic || skills.some(a => !a || a.channel !== 'physical' || !ADVENTURER_RANKS_REFERENCE.skills.includes(a.id)))
    return failure('UNSUPPORTED_ACTION', 'selected');
  const actions = [basic, ...skills.filter(a => a !== undefined)];
  const heal = exposure?.useHeal ? actor.actions.find(a => a.channel === 'heal') : undefined;
  if (exposure && (!finite(exposure.maxHP) || exposure.maxHP <= 0 || typeof exposure.useHeal !== 'boolean' ||
      !Array.isArray(exposure.packets) || exposure.packets.length > NOMINAL_OFFENSE_V3.eventLimit ||
      exposure.packets.some((p,i) => !finite(p.at) || p.at >= NOMINAL_OFFENSE_V3.horizon || !finite(p.damage) || i > 0 && p.at <= exposure.packets[i-1].at)))
    return failure('INVALID_EXPOSURE', 'exposure');
  if (heal && (!finite(heal.mana) || heal.mana <= 0 || !finite(heal.cooldown!) || !heal.cooldown ||
      !finite(heal.lock) || !finite(heal.delay) || !finite(heal.healCapacity!) || !heal.healCapacity))
    return failure('INVALID_HEAL_SOURCE', 'heal');
  if (actions.some(a => !finite(a.mana) || !finite(a.lock) || !finite(a.delay) ||
      a.id !== 'basic' && (!a.cooldown || !finite(a.cooldown) || a.mana <= 0)) || basic.mana !== 0 ||
      ![actor.resources.maxMana, actor.resources.recovery, actor.clocks.thirdDelay, actor.clocks.comboLifetime].every(finite) ||
      !finite(actor.clocks.basicInterval) || actor.clocks.basicInterval <= 0 ||
      !finite(actor.clocks.attackSpeed) || actor.clocks.attackSpeed <= 0)
    return failure('UNSUPPORTED_COST_OR_CLOCK', 'actor');
  const expectations = new Map(means.map(m => [m.id, m.expectedInflicted]));
  if (actions.some(a => !finite(expectations.get(a.id) as number))) return failure('INVALID_EXPECTATION', 'means');
  const ordered = actions.filter(a => a.id !== 'basic').sort((a,b) =>
    expectations.get(b.id)! / b.mana - expectations.get(a.id)! / a.mana || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const initialReady = Object.fromEntries(actor.actions.filter(a => a.id !== 'basic').map(a => [a.id, 0]));
  const ready = { ...initialReady }, events: {id:string;at:number;order:number}[] = [];
  const horizon = NOMINAL_OFFENSE_V3.horizon, max = actor.resources.maxMana, rate = actor.resources.recovery;
  let time = 0, mana = max, due = 0, combo = 0, expires = 0, lock = 0;
  let hp = exposure?.maxHP ?? 0, packet = 0, deathAt: number | null = null;
  let paid = 0, totalRecovered = 0, dealt = 0, healed = 0, overheal = 0;
  const trace: ExposureRow[] = [], pending: { at: number; action: typeof basic }[] = [];
  const row = (kind: ExposureRow['kind'], id: string, amount: number) => {
    trace.push(Object.freeze({ kind, at: time, id, amount, hp, mana, deficit: (exposure?.maxHP ?? 0) - hp }));
  };
  while (time < horizon) {
    if (exposure) {
      // Recovery was settled at the preceding deadline. Incoming wins ties with impacts.
      if (exposure.packets[packet]?.at === time) {
        const damage = exposure.packets[packet++].damage;
        hp = Math.max(0, hp - damage); row('incoming', 'landed', damage);
        if (hp === 0) { deathAt = time; break; }
      }
      while (pending[0]?.at === time) {
        const action = pending.shift()!.action;
        if (action.channel === 'heal') {
          const gain = Math.min(action.healCapacity!, exposure.maxHP - hp);
          hp += gain; healed += gain; overheal += action.healCapacity! - gain;
          row('impact', action.id, gain);
        } else { const amount = expectations.get(action.id)!; dealt += amount; row('impact', action.id, amount); }
      }
      if (![hp,healed,overheal,dealt].every(finite)) return failure('ARITHMETIC_OVERFLOW', 'exposure');
    }
    const available = time >= lock;
    const eligibleHeal = heal && exposure!.maxHP - hp >= heal.healCapacity! && ready[heal.id] <= time && mana >= heal.mana && time + heal.delay < horizon ? heal : undefined;
    const action = available ? eligibleHeal ?? ordered.find(a => ready[a.id] <= time && mana >= a.mana && time + a.delay < horizon)
      ?? (due <= time && time + basic.delay < horizon ? basic : undefined) : undefined;
    if (action) {
      // Refuse overflow, never silently return the first 4096 events as success.
      if (events.length >= NOMINAL_OFFENSE_V3.eventLimit) return failure('SUPPORTED_EVENT_LIMIT', 'events');
      events.push(Object.freeze({ id: action.id, at: time, order: events.length }));
      const after = mana - action.mana;
      if (action.mana > 0 && after === mana) return failure('NUMERICAL_PROGRESS', 'mana');
      mana = after; lock = time + action.lock;
      if (exposure) {
        paid += action.mana;
        if (!finite(paid)) return failure('ARITHMETIC_OVERFLOW', 'paid');
        row('cast', action.id, action.mana);
        pending.push({ at: time + action.delay, action }); pending.sort((a,b) => a.at - b.at);
      }
      if (action.id === 'basic') {
        combo = time < expires ? combo % 3 + 1 : 1;
        expires = time + actor.clocks.comboLifetime;
        due = time + (actor.clocks.basicInterval + (combo === 3 ? actor.clocks.thirdDelay : 0)) / (actor.clocks.attackSpeed / 100);
        if (!(due > time) || !Number.isFinite(due)) return failure('NUMERICAL_PROGRESS', 'basic');
      } else {
        ready[action.id] = time + action.cooldown!;
        if (!(ready[action.id] > time) || !Number.isFinite(ready[action.id])) return failure('NUMERICAL_PROGRESS', 'cooldown');
      }
      if (!Number.isFinite(lock)) return failure('NUMERICAL_PROGRESS', 'lock');
      continue;
    }
    const deadlines: number[] = [horizon];
    if (exposure) {
      if (exposure.packets[packet]) deadlines.push(exposure.packets[packet].at);
      if (pending[0]) deadlines.push(pending[0].at);
    }
    const basicAt = Math.max(time, lock, due);
    if (basicAt > time && basicAt + basic.delay < horizon) deadlines.push(basicAt);
    for (const a of heal && exposure!.maxHP - hp >= heal.healCapacity! ? [heal, ...ordered] : ordered) {
      if (a.mana > max) continue;
      const affordable = mana >= a.mana ? time : rate > 0 ? time + (a.mana - mana) / rate : Infinity;
      const at = Math.max(lock, ready[a.id], affordable, time);
      if (at > time && at + a.delay < horizon) deadlines.push(at);
      else if (at === time && mana < a.mana && rate > 0) return failure('NUMERICAL_PROGRESS', 'affordability');
    }
    const next = Math.min(...deadlines);
    if (!Number.isFinite(next) || !(next > time)) return failure('NUMERICAL_PROGRESS', 'deadline');
    const recovered = Math.min(max - mana, (next - time) * rate);
    if (!finite(recovered)) return failure('NUMERICAL_PROGRESS', 'recovery');
    mana += recovered; time = next;
    if (exposure) {
      totalRecovered += recovered;
      if (!finite(totalRecovered)) return failure('ARITHMETIC_OVERFLOW', 'recovery');
    }
  }
  const workload: DeclaredWorkload = Object.freeze({ provenance,
    model: 'INDEPENDENT_BASIC_SKILL_CONTINUOUS_CAPPED_MANA_V1', terminal: 'IMPACT_STRICTLY_BEFORE_HORIZON',
    horizon, initialMana: max, maxMana: max, recoveryPerSecond: rate, initialBasicDue: 0,
    initialComboIndex: 0, initialComboExpires: 0, initialLockUntil: 0,
    skillReadyAt: Object.freeze(initialReady), events: Object.freeze(events) });
  const exposureResult = exposure ? Object.freeze({ maxHP: exposure.maxHP, finalHP: hp, deathAt,
    survivedHorizon: deathAt === null, censored: deathAt === null, expectedOffense: dealt,
    expectedOffenseDPS: dealt / horizon, usableHeal: healed, usableHPS: healed / horizon, overheal,
    paidMana: paid, recoveredMana: totalRecovered, finalMana: mana,
    canceledImpacts: pending.length, trace: Object.freeze(trace) }) : null;
  return Object.freeze({ ok: true as const, value: workload, exposure: exposureResult });
}

export function evaluateNominalOffense(actor: ActualDiagnostic) {
  const bank = nominalOffenseBank(actor.input.level);
  if (!bank.ok) return bank;
  const ids = [...new Set(actor.actions.filter(a => a.channel === 'physical').map(a => a.id))];
  const evaluated = evaluateAdventurerDiagnosticActions(actor, bank.value, ids, provenance);
  if (!evaluated.ok) return evaluated;
  const [quick, power] = ADVENTURER_RANKS_REFERENCE.skills;
  const subsets = [['basic'], ['basic',quick], ['basic',power], ['basic',quick,power]].filter(s => s.every(id => ids.includes(id)));
  const candidates = [];
  for (const subset of subsets) {
    const generated = produceNominalEvents(actor, subset, evaluated.value.rows);
    if (!generated.ok) return generated;
    const checked = evaluateDeclaredAdventurerWorkload(actor, generated.value, evaluated.value.rows);
    if (!checked.ok) return checked;
    const variants = bank.value.map((target, index) => {
      const total = checked.value.events.reduce((sum,event) => sum + evaluated.value.rows.find(a => a.id === event.id)!.evaluation!.targets[index].expectedInflictedDamage, 0);
      return Object.freeze({ variant: target.variant, weight: target.weight, expectedTotal: total,
        weightedTotal: total * target.weight, expectedDPS: total / NOMINAL_OFFENSE_V3.horizon });
    });
    candidates.push(Object.freeze({ subset: Object.freeze(subset), workload: generated.value,
      ledger: checked.value, variants: Object.freeze(variants) }));
  }
  let best = candidates[0];
  for (const c of candidates.slice(1)) if (c.ledger.expectedInflictedTotal > best.ledger.expectedInflictedTotal ||
      c.ledger.expectedInflictedTotal === best.ledger.expectedInflictedTotal && c.ledger.paidMana < best.ledger.paidMana) best = c;
  return Object.freeze({ ok: true as const, value: Object.freeze({ policy: NOMINAL_OFFENSE_V3, provenance,
    authority: 'MATHEMATICAL_RATING_NOT_CAST_AUTHORIZATION', sourceVersion: actor.profile.sourceVersion,
    bank: bank.value, level: actor.input.level, itemId: actor.itemId, actions: evaluated.value.rows,
    candidates: Object.freeze(candidates), chosen: best, expectedTotal: best.ledger.expectedInflictedTotal,
    expectedDPS: best.ledger.expectedInflictedPerSecond,
    healCapacity: Object.freeze(actor.actions.filter(a => a.channel === 'heal').map(a => Object.freeze({id:a.id,rank:a.rank,capacity:a.healCapacity,usableSustain:null}))),
    defense: null, sustain: null, utility: null, totalCombatPower: null,
    unsupportedReason: 'Conditional B numeric HOLD; no second Mana pool for sustain',
    limitation: 'Policy-selected continuous nominal model, not optimal rotation, finite HP loss, or native frame-exact execution. Cross-level banks differ.' }) });
}
/** No cache. Every read proves fresh lifecycle/source admission; no enrollment. */
export function readNominalOffense(game: Game) {
  const actor = readActualAdventurerDiagnostic(game);
  return actor.ok ? evaluateNominalOffense(actor.value) : actor;
}
export function previewNominalOffense(game: Game, request: DiagnosticPreview) {
  const actor = previewActualAdventurerDiagnostic(game, request);
  return actor.ok ? evaluateNominalOffense(actor.value) : actor;
}
