import { thiefJobCapabilities, type ThiefJobActor } from './thief-job-capabilities.ts';

export type VanishJob = 'rogue' | 'assasin';
export type VanishConfig = { job: VanishJob };
type Actor = ThiefJobActor & { characterId?: string; slotId: string; hp: number;
  skillProgressionV3?: NonNullable<ThiefJobActor['skillProgressionV3']> & { skillRanks: Record<string, number> } };
export type VanishEndReason = 'OFFENSIVE_ACTION' | 'DIRECT_DAMAGE' | 'DEATH' | 'INVALID_STATE' | 'RESET' | 'REVEAL';
export type VanishRecord = { ownerActorId: string; sourceSkillId: string; sourceJob: VanishJob; cooldown: number; cooldownKey: string };
export type StealthObserver = { actorId: string; canDetectStealth?: (target: Readonly<VanishRecord>) => boolean };
const owner = (actor: Actor) => actor.characterId ?? actor.slotId;
const owns = (actor: Actor, job: VanishJob) => actor.hp > 0 &&
  (job === 'rogue' ? thiefJobCapabilities(actor).canUseRogueSkills : thiefJobCapabilities(actor).canUseAssasinSkills);

/** Runtime-only authority. No timer, saved buff, or opacity-based gameplay gate. */
export class VanishState {
  private state: VanishRecord | null = null;
  constructor(private onEnd: (state: Readonly<VanishRecord>, reason: VanishEndReason) => void) {}
  update(actor: Actor) {
    const state = this.state;
    if (state && (state.ownerActorId !== owner(actor) || !owns(actor, state.sourceJob) ||
      !((actor.skillProgressionV3?.skillRanks[state.sourceSkillId] ?? 0) > 0)))
      this.end(actor.hp <= 0 ? 'DEATH' : 'INVALID_STATE');
  }
  status(actor: Actor) { this.update(actor); return this.state ? { ...this.state } : null; }
  activate(actor: Actor, sourceSkillId: string, config: VanishConfig, cooldown: number, cooldownKey: string) {
    this.update(actor);
    if (this.state || !owns(actor, config.job) || !((actor.skillProgressionV3?.skillRanks[sourceSkillId] ?? 0) > 0) ||
      !Number.isFinite(cooldown) || cooldown < 0) return false;
    this.state = { ownerActorId: owner(actor), sourceSkillId, sourceJob: config.job, cooldown, cooldownKey };
    return true;
  }
  rogueOpeningAvailable(actor: Actor) { return this.status(actor)?.sourceJob === 'rogue'; }
  end(reason: VanishEndReason) {
    const state = this.state;
    if (!state) return null;
    this.state = null;
    this.onEnd(state, reason);
    return state;
  }
  directDamage(damage: number) {
    return Number.isFinite(damage) && damage > 0 ? this.end('DIRECT_DAMAGE') : null;
  }
  /** Detection is observer-local; only explicit Reveal removes global stealth. */
  canPerceive(actor: Actor, observer: StealthObserver) {
    const state = this.status(actor);
    return !state || observer.actorId === state.ownerActorId || observer.canDetectStealth?.(state) === true;
  }
  canAcquireDirectTarget(actor: Actor, observer: StealthObserver) { return this.canPerceive(actor, observer); }
  reveal() { return this.end('REVEAL'); }
}
