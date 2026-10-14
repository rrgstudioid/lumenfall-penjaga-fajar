import type { ActualDiagnostic } from './adventurer-diagnostic-v2.ts';
import type { Provenance } from './expected-final-damage-v2.ts';

export type DeclaredWorkload = Readonly<{
  provenance: Provenance; model: 'INDEPENDENT_BASIC_SKILL_CONTINUOUS_CAPPED_MANA_V1';
  terminal: 'IMPACT_STRICTLY_BEFORE_HORIZON'; horizon: number;
  initialMana: number; maxMana: number; recoveryPerSecond: number;
  initialBasicDue: number; initialComboIndex: number; initialComboExpires: number; initialLockUntil: number;
  skillReadyAt: Readonly<Record<string, number>>;
  events: readonly Readonly<{ id: string; at: number; order: number }>[];
}>;
type Means = readonly Readonly<{ id: string; expectedInflicted: number | null; healCapacity: number | null }>[];
class Invalid extends Error { constructor(readonly code: string, readonly path: string) { super(code); } }
const invalid = (code: string, path: string): never => { throw new Invalid(code, path); };
/** Mathematical input sanitation; does not claim hostile Proxy trust. */
function object(v: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return invalid('INPUT_MISSING', path);
  const d = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(d).some(k => typeof k !== 'string' || !keys.includes(k))) return invalid('UNSUPPORTED_INPUT', path);
  const result: Record<string, unknown> = {};
  for (const k of keys) {
    if (!d[k]) return invalid('INPUT_MISSING', path + '.' + k);
    if (!Object.hasOwn(d[k], 'value')) return invalid('ACCESSOR_INPUT', path + '.' + k);
    result[k] = d[k].value;
  }
  return result;
}
const number = (v: unknown, path: string) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : invalid('INVALID_NUMBER', path);
const sum = (a: number, b: number, path: string) => {
  const value = a + b;
  if (!Number.isFinite(value) || b > 0 && value === a) invalid('NUMERICAL_LIMIT', path);
  return value;
};
/** Validate precisely the caller's list. No generated events, defaults, optimizer,
 * workload policy or scoring. Frame quantization is an explicit runtime limitation. */
export function evaluateDeclaredAdventurerWorkload(actor: ActualDiagnostic, input: DeclaredWorkload | undefined, means: Means | undefined) {
  try {
    if (!means) invalid('INPUT_MISSING', 'perActionExpectations');
    const w = object(input, ['provenance','model','terminal','horizon','initialMana','maxMana','recoveryPerSecond',
      'initialBasicDue','initialComboIndex','initialComboExpires','initialLockUntil','skillReadyAt','events'], 'workload');
    const provenance = object(w.provenance, ['source','version','label'], 'provenance');
    if (Object.values(provenance).some(v => typeof v !== 'string' || !v.trim())) invalid('INPUT_MISSING', 'provenance');
    if (w.model !== 'INDEPENDENT_BASIC_SKILL_CONTINUOUS_CAPPED_MANA_V1' || w.terminal !== 'IMPACT_STRICTLY_BEFORE_HORIZON') invalid('UNSUPPORTED_CLOCK_MODEL', 'model/terminal');
    const horizon = number(w.horizon, 'horizon'), max = number(w.maxMana, 'maxMana'), rate = number(w.recoveryPerSecond, 'recoveryPerSecond');
    if (horizon === 0) invalid('INVALID_NUMBER', 'horizon');
    let mana = number(w.initialMana, 'initialMana');
    if (mana > max) invalid('MANA_CONSERVATION', 'initialMana');
    if (!Number.isFinite(horizon * rate)) invalid('ARITHMETIC_OVERFLOW', 'recovery');
    const skills = actor.actions.filter(a => a.id !== 'basic');
    const readiness = object(w.skillReadyAt, skills.map(a => a.id), 'skillReadyAt');
    const ready = new Map(skills.map(a => [a.id, number(readiness[a.id], 'skillReadyAt.' + a.id)]));
    let due = number(w.initialBasicDue, 'initialBasicDue'), index = number(w.initialComboIndex, 'initialComboIndex'),
      expires = number(w.initialComboExpires, 'initialComboExpires'), lock = number(w.initialLockUntil, 'initialLockUntil');
    if (!Number.isInteger(index) || index > 3 || expires > 0 && index === 0) invalid('INVALID_COMBO_STATE', 'initialComboIndex');
    const events = w.events;
    if (!Array.isArray(events)) return invalid('INPUT_MISSING', 'events');
    if (events.length > 4096) invalid('SUPPORTED_LIMIT', 'events');
    let time = 0, order = -1, paid = 0, recovered = 0, damage = 0, healCapacity = 0;
    const rows = [];
    const recover = (dt: number) => {
      const next = Math.min(max, mana + Math.min(max - mana, dt * rate));
      if (!Number.isFinite(next)) invalid('NUMERICAL_LIMIT','Mana');
      // Credit only the gain represented in this same model pool. A sub-ULP
      // request grants no Mana or ledger credit; it is not an overflow failure.
      const effective = next - mana;
      mana = next;
      recovered = sum(recovered, effective, 'recovery');
    };
    for (const entry of events) {
      const e = object(entry, ['id','at','order'], 'event');
      const at = number(e.at, 'at'), nextOrder = number(e.order, 'order');
      if (!Number.isSafeInteger(nextOrder) || nextOrder <= order || at < time || at >= horizon || at < lock) invalid('TIME_OR_ORDER_CONSERVATION', 'event');
      const action = actor.actions.find(a => a.id === e.id);
      const mean = means!.find(a => a.id === e.id);
      if (!action || !mean) invalid('UNSUPPORTED_OR_UNSELECTED_ACTION', 'event.id');
      const impact = sum(at, action!.delay, 'impact');
      if (impact >= horizon) invalid('TERMINAL_IMPACT', 'event');
      if (action!.id === 'basic') {
        if (at < due) invalid('BASIC_TIMER_CONSTRAINT', 'event');
        index = at < expires ? index % 3 + 1 : 1;
        expires = sum(at, actor.clocks.comboLifetime, 'comboWindow');
        due = sum(at, (actor.clocks.basicInterval + (index === 3 ? actor.clocks.thirdDelay : 0)) / (actor.clocks.attackSpeed / 100), 'basicTimer');
      } else if (at < ready.get(action!.id)!) invalid('COOLDOWN_CONSTRAINT', 'event');
      recover(at - time); time = at; order = nextOrder;
      if (mana < action!.mana) invalid('MANA_CONSERVATION', 'event');
      const afterMana = mana - action!.mana;
      if (action!.mana > 0 && afterMana === mana) invalid('NUMERICAL_LIMIT', 'payment');
      mana = afterMana; paid = sum(paid, action!.mana, 'paidMana');
      if (action!.id !== 'basic') ready.set(action!.id, sum(at, action!.cooldown!, 'skillCooldown'));
      lock = sum(at, action!.lock, 'actionLock');
      if (action!.channel === 'heal') healCapacity = sum(healCapacity, number(mean!.healCapacity, 'healCapacity'), 'healCapacity');
      else damage = sum(damage, number(mean!.expectedInflicted, 'expectedInflicted'), 'damage');
      rows.push(Object.freeze({ id: action!.id, rank: action!.rank, at, order, impact, basicIndex: action!.id === 'basic' ? index : null,
        manaAfter: mana, basicDue: due, comboExpires: expires, lockUntil: lock, skillReadyAt: Object.freeze(Object.fromEntries(ready)) }));
    }
    recover(horizon - time);
    const rateDamage = damage / horizon;
    if (!Number.isFinite(rateDamage)) invalid('NUMERICAL_LIMIT', 'rate');
    return Object.freeze({ ok: true as const, value: Object.freeze({ version: w.model, kind: 'CALLER_DECLARED_MODEL_NOT_RATING_POLICY',
      provenance: Object.freeze(provenance), horizon, expectedInflictedTotal: damage, expectedInflictedPerSecond: rateDamage,
      healCapacity, usableSustain: null, paidMana: paid, effectiveRecoveredMana: recovered, finalMana: mana,
      events: Object.freeze(rows), finalCombatPower: null,
      limitation: 'Continuous capped recovery; actual tick dt<=.04 and input frame quantization must be checked separately' }) });
  } catch (e) {
    if (!(e instanceof Invalid)) throw e;
    return Object.freeze({ ok: false as const, code: e.code, path: e.path, value: null, reason: e.message });
  }
}
