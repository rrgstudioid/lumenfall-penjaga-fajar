import type { CombatModifier } from './combat-modifiers.ts';
import type { ResolvedSkillAction } from './skill-action.ts';
import type { WeaponType } from './skills.ts';
import type { TreeScope } from './rank-ownership.ts';
export type StackDefinition = {
  triggerTree?: TreeScope;
  id: string;
  duration: number;
  maxStacks: 1 | 2 | 3;
  weaponStyle?: WeaponType;
  modifier: CombatModifier;
};
export type WindowDefinition = {
  triggerTree?: TreeScope;
  openOnSuccess?: boolean;
  id: string;
  duration: number;
  tags: string[];
  weaponStyle: WeaponType;
  modifier: CombatModifier;
};
export type CombatSupport = {
  stacks?: StackDefinition[];
  windows?: WindowDefinition[];
};
export type CombatStack = {
  id: string;
  stackCount: number;
  maxStacks: number;
  expiresAt: number;
  lastEligibleCastId: number;
  weaponStyle?: WeaponType;
};
const scaleModifier = (mod: CombatModifier, n: number): CombatModifier => {
  const result = structuredClone(mod);
  const scale = (record: object | undefined) =>
    record
      ? Object.fromEntries(
          Object.entries(record).map(([k, v]) => [
            k,
            typeof v === 'number' ? v * n : v,
          ]),
        )
      : undefined;
  result.action = scale(result.action);
  if (result.stats)
    result.stats = {
      flat: scale(result.stats.flat),
      percent: scale(result.stats.percent),
    };
  return result;
};
/** Bounded runtime state, no save data, resource bar or event bus. */
export class TransientCombatState {
  stacks = new Map<string, CombatStack>();
  windows = new Map<string, { expiresAt: number }>();
  /** V3 Berserker transient states; never serialized into Hero saves. */
  breakerEntryExpiresAt = 0;
  berserkerTrance: { rank: number; expiresAt: number } | null = null;
  frenzyGuard: { reductionPercent: number; expiresAt: number } | null = null;
  /** Blade Master 7A Flow Window; transient and never serialized. */
  bladeFlowExpiresAt = 0;
  bladeTempo: { stacks: number; expiresAt: number } | null = null;
  bladeTempoDrive: { stacks: number; rank: number; expiresAt: number; attackSpeedPercent: number; manaReductionPercent: number } | null = null;
  private nextId = 0;
  nextCastId() {
    return ++this.nextId;
  }
  clear() {
    this.stacks.clear();
    this.windows.clear();
    this.breakerEntryExpiresAt = 0;
    this.berserkerTrance = null;
    this.frenzyGuard = null;
    this.bladeFlowExpiresAt = 0;
    this.bladeTempo = null;
    this.bladeTempoDrive = null;
  }
  openBreakerEntry(now: number, duration = 4) { this.breakerEntryExpiresAt = now + duration; }
  breakerEntryActive(now: number) { return this.breakerEntryExpiresAt > now; }
  consumeBreakerEntry(now: number) { if (!this.breakerEntryActive(now)) return false; this.breakerEntryExpiresAt = 0; return true; }
  activateBerserkerTrance(now: number, rank: number, duration: number) { this.berserkerTrance = { rank, expiresAt: now + duration }; }
  updateBerserker(now: number) {
    if (this.breakerEntryExpiresAt <= now) this.breakerEntryExpiresAt = 0;
    if (this.berserkerTrance && this.berserkerTrance.expiresAt <= now) this.berserkerTrance = null;
    if (this.frenzyGuard && this.frenzyGuard.expiresAt <= now) this.frenzyGuard = null;
  }
  triggerFrenzyGuard(now: number, reductionPercent: number, duration = 2) {
    this.frenzyGuard = { reductionPercent, expiresAt: now + duration };
  }
  openBladeFlow(now: number, duration = 3) { this.bladeFlowExpiresAt = Math.max(this.bladeFlowExpiresAt, now + duration); }
  bladeFlowActive(now: number) { return this.bladeFlowExpiresAt > now; }
  consumeBladeFlow(now: number) { if (!this.bladeFlowActive(now)) return false; this.bladeFlowExpiresAt = 0; return true; }
  tempoCount(now: number) { return this.bladeTempo && this.bladeTempo.expiresAt > now ? this.bladeTempo.stacks : 0; }
  gainBladeTempo(now: number, lifetime: number) {
    const stacks = Math.min(3, this.tempoCount(now) + 1);
    this.bladeTempo = { stacks, expiresAt: now + lifetime };
    return stacks;
  }
  consumeBladeTempo(now: number) { const count = this.tempoCount(now); if (count) this.bladeTempo = null; return count; }
  activateBladeTempoDrive(now: number, rank: number) {
    const stacks = this.consumeBladeTempo(now);
    if (!stacks) return null;
    this.bladeTempoDrive = { stacks, rank, expiresAt: now + [0, 5.5, 7, 8.5][stacks], attackSpeedPercent: [0,4,5,6,7,8][rank] + stacks * 4, manaReductionPercent: [0,2,3,4,5,6][rank] + stacks * 4 };
    return this.bladeTempoDrive;
  }
  updateBladeTempo(now: number, eligible: boolean) {
    if (!eligible || this.bladeTempo?.expiresAt !== undefined && this.bladeTempo.expiresAt <= now) this.bladeTempo = null;
    if (!eligible || this.bladeTempoDrive?.expiresAt !== undefined && this.bladeTempoDrive.expiresAt <= now) this.bladeTempoDrive = null;
    if (this.bladeFlowExpiresAt <= now) this.bladeFlowExpiresAt = 0;
  }
  update(now: number, style: WeaponType, support: CombatSupport) {
    for (const [id, s] of this.stacks) {
      const def = support.stacks?.find((d) => d.id === id);
      if (
        !def ||
        s.expiresAt <= now ||
        (def.weaponStyle && def.weaponStyle !== style)
      )
        this.stacks.delete(id);
    }
    for (const [id, w] of this.windows) {
      const def = support.windows?.find((d) => d.id === id);
      if (!def || w.expiresAt <= now || def.weaponStyle !== style)
        this.windows.delete(id);
    }
  }
  successfulCast(
    castId: number,
    now: number,
    style: WeaponType,
    support: CombatSupport,
    action?: ResolvedSkillAction,
    consumedWindows: readonly string[] = [],
  ) {
    this.update(now, style, support);
    for (const def of support.stacks ?? []) {
      if (
        !(def.duration > 0) ||
        !Number.isFinite(def.duration) ||
        (def.weaponStyle && def.weaponStyle !== style) ||
        (def.triggerTree &&
          (!action || !sameTree(def.triggerTree, action.tree)))
      )
        continue;
      const previous = this.stacks.get(def.id);
      if (previous?.lastEligibleCastId === castId) continue;
      this.stacks.set(def.id, {
        id: def.id,
        stackCount: Math.min(def.maxStacks, 3, (previous?.stackCount ?? 0) + 1),
        maxStacks: Math.min(3, def.maxStacks),
        expiresAt: now + def.duration,
        lastEligibleCastId: castId,
        weaponStyle: def.weaponStyle,
      });
    }
    for (const def of support.windows ?? [])
      if (
        def.openOnSuccess &&
        action &&
        this.eligible(def, action) &&
        def.weaponStyle === style &&
        !consumedWindows.includes(def.id) &&
        def.duration > 0 &&
        Number.isFinite(def.duration)
      )
        this.windows.set(def.id, { expiresAt: now + def.duration });
  }
  stackModifiers(support: CombatSupport) {
    return (support.stacks ?? []).flatMap((def) => {
      const s = this.stacks.get(def.id);
      if (!s) return [];
      const mod = scaleModifier(def.modifier, s.stackCount);
      // Keep the gate on the derived payload too: equipment previews may run before a world tick.
      if (def.weaponStyle)
        mod.selector = { ...mod.selector, weaponStyles: [def.weaponStyle] };
      return [mod];
    });
  }
  private eligible(def: WindowDefinition, action: ResolvedSkillAction) {
    return (
      action.resolvedWeaponStyle === def.weaponStyle &&
      (!def.triggerTree || sameTree(def.triggerTree, action.tree)) &&
      def.tags.every((tag) => action.tags.includes(tag))
    );
  }
  windowModifiers(
    action: ResolvedSkillAction,
    support: CombatSupport,
    now: number,
  ) {
    return (support.windows ?? [])
      .filter(
        (def) =>
          this.eligible(def, action) &&
          (this.windows.get(def.id)?.expiresAt ?? 0) > now,
      )
      .map((def) => structuredClone(def.modifier));
  }
  commitWindows(
    action: ResolvedSkillAction,
    support: CombatSupport,
    now: number,
  ) {
    const consumed: string[] = [];
    for (const def of support.windows ?? [])
      if (this.eligible(def, action)) {
        if ((this.windows.get(def.id)?.expiresAt ?? 0) > now) {
          this.windows.delete(def.id);
          consumed.push(def.id);
        } else if (
          !def.openOnSuccess &&
          def.duration > 0 &&
          Number.isFinite(def.duration)
        )
          this.windows.set(def.id, { expiresAt: now + def.duration });
      }
    return consumed;
  }
}
const sameTree = (a: TreeScope, b?: TreeScope) =>
  a.id === b?.id && a.architecture === b.architecture;
