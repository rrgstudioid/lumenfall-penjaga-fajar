import { relativePosition, type PositionContext, type PositionRelation } from './combat-position.ts';
import type { ImpactContext } from './combat-modifiers.ts';
import type { ResolvedSkillHit } from './skill-action.ts';
import { thiefJobCapabilities } from './thief-job-capabilities.ts';

export const AMBUSH_DURATION = 4;
export const AMBUSH_FINAL_DAMAGE = 1.15;
export type AmbushInteraction =
  | { mode: 'DEFAULT_FINAL_DAMAGE' }
  | { mode: 'POSITION_OVERRIDE'; position: PositionRelation }
  | { mode: 'SPECIAL'; handlerId: string }
  | { mode: 'REQUIRES_AMBUSH' };
export type RogueAmbushConfig = {
  ambushEligible?: boolean;
  requiresAmbush?: boolean;
  interaction?: AmbushInteraction;
  generator?:
    | { source: 'SMOKE_VEIL' }
    | { source: 'SLIPSTEP' }
    | { source: 'OTHER_CONFIGURED_SOURCE'; eventId: string };
};
export type AmbushActor = {
  characterId?: string;
  slotId: string;
  hp: number;
  coreJob?: string | null;
  specialization?: string | null;
  skillArchitectureVersion?: number;
  skillProgressionV3?: { chosenCoreJob: string | null; chosenSpecialization: string | null; chosenAdvancedJob?: string | null };
};
type AmbushSkill = { id: string; targetType: string; nonDamaging?: boolean; rogueAmbush?: RogueAmbushConfig };
type Opportunity = { actorId: string; sourceId: string; source: NonNullable<RogueAmbushConfig['generator']>['source']; expiresAt: number; consumedBy?: number };
export type AmbushRequirement = { ok: boolean; reason: string; code?: 'ROGUE_REQUIRED' | 'AMBUSH_REQUIRED' | 'AMBUSH_CONFIGURATION_INVALID' };
// Do not confuse the legacy CoreJobId "rogue" with the V3 Thief specialization.
export const isRogueActor = (actor: AmbushActor) => actor.hp > 0 && thiefJobCapabilities(actor).canGenerateAmbush;
const identity = (actor: AmbushActor) => actor.characterId ?? actor.slotId;
const eligible = (skill: AmbushSkill) => skill.rogueAmbush?.ambushEligible === true && !skill.nonDamaging && skill.targetType === 'single';
/** Pure hit transformation only; consumption always remains in commitDamage. */
type SpecialInteraction = (hit: ResolvedSkillHit, context: ImpactContext) => ResolvedSkillHit;

/** Actor-owned simulation state. Never attach to Hero, activeBuffs or save data. */
export class RogueAmbushState {
  private opportunity: Opportunity | null = null;
  private concealment: { actorId: string; sourceId: string; expiresAt: number } | null = null;
  private ownerId: string | null = null;
  private epoch = 0;
  private executionId = 0;
  private special = new Map<string, SpecialInteraction>();

  clear() { this.opportunity = null; this.concealment = null; this.ownerId = null; this.epoch++; }
  update(actor: AmbushActor, now: number) {
    if (!isRogueActor(actor) || !Number.isFinite(now) || this.ownerId !== null && this.ownerId !== identity(actor)) { this.clear(); return; }
    this.ownerId = identity(actor);
    if (this.opportunity && this.opportunity.expiresAt <= now) this.opportunity = null;
    if (this.concealment && this.concealment.expiresAt <= now) this.concealment = null;
  }
  status(actor: AmbushActor, now: number) {
    this.update(actor, now);
    return this.opportunity ? { active: true as const, actorId: this.opportunity.actorId, sourceId: this.opportunity.sourceId,
      source: this.opportunity.source, expiresAt: this.opportunity.expiresAt, remaining: this.opportunity.expiresAt - now } : null;
  }
  concealed(actor: AmbushActor, now: number) { this.update(actor, now); return this.concealment ? { ...this.concealment } : null; }
  breakConcealment(reason: 'ATTACK' | 'DIRECT_DAMAGE', damage = 0) {
    if (reason === 'ATTACK' || Number.isFinite(damage) && damage > 0) this.concealment = null;
  }
  registerSpecialInteraction(id: string, resolve: SpecialInteraction) {
    if (!id || this.special.has(id)) throw new Error('Ambush interaction must have a unique stable ID.');
    this.special.set(id, resolve);
  }
  requirement(actor: AmbushActor, skill: AmbushSkill, now: number): AmbushRequirement {
    const config = skill.rogueAmbush;
    if (!config) return { ok: true, reason: '' };
    this.update(actor, now);
    if (!isRogueActor(actor)) return { ok: false, code: 'ROGUE_REQUIRED', reason: 'Mekanik ini hanya untuk Rogue.' };
    if (config.ambushEligible && !eligible(skill) || config.interaction && !config.ambushEligible ||
      config.interaction?.mode === 'SPECIAL' && !this.special.has(config.interaction.handlerId))
      return { ok: false, code: 'AMBUSH_CONFIGURATION_INVALID', reason: 'Konfigurasi Ambush skill belum valid.' };
    if ((config.requiresAmbush || config.interaction?.mode === 'REQUIRES_AMBUSH') && !this.opportunity)
      return { ok: false, code: 'AMBUSH_REQUIRED', reason: 'Ambush harus aktif.' };
    return { ok: true, reason: '' };
  }
  /** Call only after the configured activation/movement/effect has succeeded. */
  generate(actor: AmbushActor, skill: AmbushSkill, now: number, event:
    | { type: 'ACTIVATED'; concealmentDuration: number }
    | { type: 'REPOSITION_COMPLETE'; moved: boolean; position?: PositionContext }
    | { type: 'CONFIGURED_EFFECT'; eventId: string }) {
    this.update(actor, now);
    const source = skill.rogueAmbush?.generator;
    if (!isRogueActor(actor) || !source || !Number.isFinite(now)) return false;
    if (source.source === 'SMOKE_VEIL') {
      if (event.type !== 'ACTIVATED' || !skill.nonDamaging || !Number.isFinite(event.concealmentDuration) || event.concealmentDuration <= 0) return false;
      this.concealment = { actorId: identity(actor), sourceId: skill.id, expiresAt: now + event.concealmentDuration };
    } else if (source.source === 'SLIPSTEP') {
      if (event.type !== 'REPOSITION_COMPLETE' || !event.moved || !event.position) return false;
      const relation = relativePosition(event.position);
      if (relation !== 'side' && relation !== 'rear') return false;
    } else if (event.type !== 'CONFIGURED_EFFECT' || !source.eventId || event.eventId !== source.eventId) return false;
    // Refresh the SAME opportunity, never create stacks or a second live token.
    if (this.opportunity) Object.assign(this.opportunity, { source: source.source, sourceId: skill.id, expiresAt: now + AMBUSH_DURATION });
    else this.opportunity = { actorId: identity(actor), source: source.source, sourceId: skill.id, expiresAt: now + AMBUSH_DURATION };
    return true;
  }
  /** Begin only after cast validation, before movement/impacts. Does not consume. */
  begin(actor: AmbushActor, skill: AmbushSkill, now: number) {
    this.update(actor, now);
    const token = this.requirement(actor, skill, now).ok && eligible(skill) && isRogueActor(actor) ? this.opportunity : null;
    const epoch = this.epoch, execution = ++this.executionId;
    const interaction = skill.rogueAmbush?.interaction ?? { mode: 'DEFAULT_FINAL_DAMAGE' as const };
    const valid = (current: AmbushActor, time: number) => {
      this.update(current, time);
      return !!token && epoch === this.epoch && isRogueActor(current) && token.actorId === identity(current) &&
        (token.consumedBy === undefined || token.consumedBy === execution);
    };
    return {
      // Cast snapshot survives natural expiry, but not death/job change/reset.
      context: (context: ImpactContext, current: AmbushActor, time: number): ImpactContext =>
        valid(current, time) && interaction.mode === 'POSITION_OVERRIDE' ? { ...context, positionOverride: interaction.position } : context,
      resolveHit: (hit: ResolvedSkillHit, context: ImpactContext, current: AmbushActor, time: number): ResolvedSkillHit => {
        if (!valid(current, time)) return hit;
        if (interaction.mode === 'POSITION_OVERRIDE') return hit; // No automatic +15% on top of Rear payoff.
        if (interaction.mode === 'SPECIAL') return this.special.get(interaction.handlerId)?.(hit, context) ?? hit;
        return { ...hit, damageMultiplier: hit.damageMultiplier * AMBUSH_FINAL_DAMAGE };
      },
      commitDamage: (current: AmbushActor, time: number, damage: number) => {
        if (!(damage > 0) || !valid(current, time)) return false;
        token!.consumedBy = execution;
        if (this.opportunity === token) this.opportunity = null;
        return true;
      },
    };
  }
}
