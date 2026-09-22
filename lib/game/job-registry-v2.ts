import { CORE_JOBS, SPECIALIZATIONS } from './skills.ts';

/** Metadata only. This registry does not authorize promotion, casting or UI choices. */
const branches = [
  [
    'warrior',
    'Warrior',
    [
      ['berserker', 'Berserker', 'executioner', 'Executioner'],
      ['blade_master', 'Blade Master', 'crimson_blade', 'Crimson Blade'],
    ],
  ],
  [
    'thief',
    'Thief',
    [
      ['rogue', 'Rogue', 'spectre', 'Spectre'],
      ['assasin', 'Assasin', 'reaper', 'Reaper'],
    ],
  ],
  [
    'acolyte',
    'Acolyte',
    [
      ['luminary', 'Luminary', 'stellar', 'Stellar'],
      ['sacred_fist', 'Sacred Fist', 'warmonk', 'Warmonk'],
    ],
  ],
  [
    'archer',
    'Archer',
    [
      ['ranger', 'Ranger', 'astral_ranger', 'Astral Ranger'],
      ['marksman', 'Marksman', 'sniper', 'Sniper'],
    ],
  ],
  [
    'knight',
    'Knight',
    [
      ['vanguard', 'Vanguard', 'royal_guard', 'Royal Guard'],
      ['phalanx', 'Phalanx', 'gladiator', 'Gladiator'],
    ],
  ],
  [
    'mage',
    'Mage',
    [
      ['summoner', 'Summoner', 'warlock', 'Warlock'],
      ['sorcerer', 'Sorcerer', 'arcanist', 'Arcanist'],
    ],
  ],
  [
    'smith',
    'Smith',
    [
      ['blacksmith', 'Blacksmith', 'mastersmith', 'Mastersmith'],
      ['specialist', 'Specialist', 'siege', 'Siege'],
    ],
  ],
] as const;
export type CoreJobV2Id = (typeof branches)[number][0];
export type SpecializationV2Id = (typeof branches)[number][2][number][0];
export type AdvancedJobV2Id = (typeof branches)[number][2][number][2];
export type JobV2Id =
  | 'adventurer'
  | CoreJobV2Id
  | SpecializationV2Id
  | AdvancedJobV2Id;
export type JobV2Definition = Readonly<{
  id: JobV2Id;
  name: string;
  tier: 0 | 1 | 2 | 3;
  parent: JobV2Id | null;
  architectureVersion: 2;
  playable: false;
  activation: 'inactive' | 'future_locked';
}>;
const definitions: JobV2Definition[] = [];
const add = (
  id: JobV2Id,
  name: string,
  tier: JobV2Definition['tier'],
  parent: JobV2Id | null,
) =>
  definitions.push(
    Object.freeze({
      id,
      name,
      tier,
      parent,
      architectureVersion: 2,
      playable: false,
      activation: tier === 3 ? 'future_locked' : 'inactive',
    }),
  );
add('adventurer', 'Adventurer', 0, null);
for (const [core, name, specializations] of branches) {
  add(core, name, 1, 'adventurer');
  for (const [spec, specName, advanced, advancedName] of specializations) {
    add(spec, specName, 2, core);
    add(advanced, advancedName, 3, spec);
  }
}
export const JOB_V2_REGISTRY: Readonly<Record<JobV2Id, JobV2Definition>> =
  Object.freeze(
    Object.fromEntries(definitions.map((job) => [job.id, job])) as Record<
      JobV2Id,
      JobV2Definition
    >,
  );
export function getJobV2(id: string): JobV2Definition | undefined {
  return Object.hasOwn(JOB_V2_REGISTRY, id)
    ? JOB_V2_REGISTRY[id as JobV2Id]
    : undefined;
}
/** A future identity schema, NOT added to or written into existing Hero saves. */
export type JobV2Identity = {
  jobArchitectureVersion: 2;
  coreJob: CoreJobV2Id | null;
  specialization: SpecializationV2Id | null;
  advancedJob?: AdvancedJobV2Id | null;
};
/** Parent-validated inheritance metadata; NEVER a playable-skill authorization list. */
export function resolveJobV2Lineage(
  identity: JobV2Identity,
): readonly JobV2Definition[] | null {
  if (identity.jobArchitectureVersion !== 2) return null;
  const lineage: JobV2Definition[] = [JOB_V2_REGISTRY.adventurer];
  let parent: JobV2Id = 'adventurer';
  for (const [i, id] of [
    identity.coreJob,
    identity.specialization,
    identity.advancedJob,
  ].entries()) {
    if (id == null) continue;
    const job = getJobV2(id);
    if (!job || job.tier !== i + 1 || job.parent !== parent) return null;
    lineage.push(job);
    parent = job.id;
  }
  return Object.freeze(lineage);
}
/** Version is explicit: 'rogue' is a legacy core but a V2 specialization.
 * Never map Gatotkaca/Garda or other legacy identities to V2 equivalents. */
export function resolveJobMetadata(id: string, architectureVersion: 1 | 2 = 1) {
  if (architectureVersion === 2) return getJobV2(id);
  if (id === 'adventurer')
    return { id, name: 'Adventurer', tier: 0, architectureVersion: 1 as const };
  const core = Object.values(CORE_JOBS).find((job) => job.id === id);
  if (core)
    return { id, name: core.name, tier: 1, architectureVersion: 1 as const };
  const spec = Object.entries(SPECIALIZATIONS).find(([key]) => key === id)?.[1];
  if (spec)
    return {
      id,
      name: spec.name,
      tier: 2,
      parent: spec.coreJob,
      architectureVersion: 1 as const,
    };
  // Original pre-core-job save identities remain distinct from identically named V2 IDs.
  const original = {
    guardian: 'Penjaga Fajar',
    ranger: 'Penjaga Rimba',
    arcanist: 'Penjaga Astral',
  } as const;
  if (Object.hasOwn(original, id))
    return {
      id,
      name: original[id as keyof typeof original],
      tier: 1,
      architectureVersion: 1 as const,
    };
  return undefined;
}
