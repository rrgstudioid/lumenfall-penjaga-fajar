/** Current V3 job ownership. Equipment, branches and hotbar never grant a job.
 * Progression is persisted authority; live identity mirrors must agree before
 * execution is allowed. This does not register skills or unlock future jobs. */
export type ThiefJobActor = {
  skillArchitectureVersion?: number;
  coreJob?: string | null;
  specialization?: string | null;
  skillProgressionV3?: {
    chosenCoreJob: string | null;
    chosenSpecialization: string | null;
    chosenAdvancedJob?: string | null;
  };
};

export const THIEF_JOB_IDENTITY = {
  thief: { name: 'Thief', role: 'Fast Precision Skirmisher',
    description: 'Precision, mobility, Weakpoint, dan positioning. Cabang Core tidak menentukan specialization.' },
  rogue: { name: 'Rogue', role: 'High-Burst Backline Diver',
    description: 'Dual-Dagger direct burst, Ambush, positioning, dan short concealment; masuk lalu disengage.' },
  assasin: { name: 'Assasin', role: 'Stealth Poison Kiter / Continuous DoT DPS',
    description: 'Poison DoT, Movement Slow, thrown Daggers, kiting, dan low-HP execution.' },
} as const;

export function thiefJobCapabilities(actor: ThiefJobActor) {
  const state = actor.skillProgressionV3;
  const core = actor.skillArchitectureVersion === 3 && actor.coreJob === 'thief' && state?.chosenCoreJob === 'thief';
  const specialization = state?.chosenSpecialization ?? null;
  const aligned = core && (actor.specialization ?? null) === specialization && !state?.chosenAdvancedJob;
  const supportedIdentity = specialization === null || specialization === 'rogue' || specialization === 'assasin';
  const canUseCoreThiefSkills = aligned && supportedIdentity;
  const canUseRogueSkills = canUseCoreThiefSkills && specialization === 'rogue';
  const canUseAssasinSkills = canUseCoreThiefSkills && specialization === 'assasin';
  return { canUseCoreThiefSkills, canUseRogueSkills, canUseAssasinSkills,
    canGenerateAmbush: canUseRogueSkills, canApplyAssasinPoison: canUseAssasinSkills };
}

/** Additional live ownership gate; ordinary level/rank/SP checks remain intact. */
export function thiefSkillJobAllowed(actor: ThiefJobActor, jobId: string) {
  const capability = thiefJobCapabilities(actor);
  if (jobId === 'thief') return capability.canUseCoreThiefSkills;
  if (jobId === 'rogue') return capability.canUseRogueSkills;
  if (jobId === 'assasin') return capability.canUseAssasinSkills;
  return true;
}
