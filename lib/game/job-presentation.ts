import type { Hero } from './rules.ts';
import { JOB_V2_REGISTRY } from './job-registry-v2.ts';
import { CORE_JOBS, SPECIALIZATIONS, legacyCoreJob } from './skills.ts';

type PresentationHero = Pick<Hero, 'coreJob' | 'specialization'> & Partial<Pick<Hero, 'progressionArchitecture' | 'level' | 'skillArchitectureVersion'>>;
const isV2Presentation = (hero: PresentationHero) => hero.progressionArchitecture === 'v2_test';
export const V3_SPECIALIZATION_PRESENTATION = [
  {
    id: 'berserker' as const,
    name: 'Berserker',
    role: 'Two-Hand Sword / AoE / Mobbing',
    description: 'Heavy Two-Hand Sword specialist for controlling enemy packs.',
  },
  {
    id: 'blade_master' as const,
    name: 'Blade Master',
    role: 'Dual Wield / Single Target / Precision',
    description: 'Precise dual-sword specialist focused on mobility and single targets.',
  },
] as const;
export type V3SpecializationId = (typeof V3_SPECIALIZATION_PRESENTATION)[number]['id'];
export const v3SpecializationName = (id: string | null | undefined) =>
  V3_SPECIALIZATION_PRESENTATION.find((entry) => entry.id === id)?.name;
/** Read-only presentation; never authorizes a job, modifies an item or migrates a save. */
const branches = Object.values(JOB_V2_REGISTRY).filter(j => j.tier === 1).map(job => ({
    ...job,
    status: job.id === 'warrior' ? 'Implemented · development only' : 'Locked · not yet implemented',
    children: Object.values(JOB_V2_REGISTRY).filter(j => j.parent === job.id).map(spec => ({
      ...spec, status: 'Locked · not yet implemented',
      children: Object.values(JOB_V2_REGISTRY).filter(j => j.parent === spec.id).map(advanced => ({ ...advanced, status: 'Future · locked' })),
    })),
  }));
export function getVisibleJobArchitecture(hero: PresentationHero) {
  const v2 = isV2Presentation(hero);
  const v3 = hero.skillArchitectureVersion === 3;
  const core = v2 ? branches.find(j => j.id === hero.coreJob) : undefined;
  const v3SpecializationChoices = hero.skillArchitectureVersion === 3 && hero.coreJob === 'warrior'
    ? V3_SPECIALIZATION_PRESENTATION.map((choice) => ({
        ...choice,
        coreJob: 'warrior' as const,
        selected: hero.specialization === choice.id,
        available: !hero.specialization && (hero.level ?? 1) >= 60,
        status: hero.specialization === choice.id
          ? 'Selected · V3'
          : hero.specialization
            ? 'Locked · Sibling specialization already selected'
            : (hero.level ?? 1) >= 60
              ? 'Available · V3'
              : 'Locked · Requires Level 60',
      }))
    : [];
  const currentV3Name = v3SpecializationName(hero.specialization);
  return {
    v2,
    v3,
    legacyProgression: !v2 && !v3,
    currentName: v2 ? core?.name ?? 'Adventurer' : v3 && currentV3Name ? currentV3Name : hero.specialization ? SPECIALIZATIONS[hero.specialization].name : hero.coreJob ? legacyCoreJob(hero.coreJob)?.name ?? 'Adventurer' : 'Adventurer',
    coreChoices: v2 ? [] : Object.values(CORE_JOBS),
    v2CoreChoices: v2 && !hero.coreJob ? branches.map(job => ({
      ...job,
      available: job.id === 'warrior' && (hero.level ?? 1) >= 15,
      status: job.id === 'warrior' && (hero.level ?? 1) >= 15 ? 'Available · implemented' : 'Locked · coming later',
    })) : [],
    specializationChoices: v2 || hero.skillArchitectureVersion === 3 ? [] : Object.entries(SPECIALIZATIONS).filter(([, j]) => j.coreJob === hero.coreJob),
    v3SpecializationChoices,
    futureSpecializations: core ? branches.find(j => j.id === core.id)!.children : [],
    branches,
    hint: v3 ? (currentV3Name ? `${currentV3Name} V3 · Adventurer dan Warrior tetap tersedia` : hero.coreJob ? 'Warrior V3 · Berserker / Blade Master terbuka Lv. 60' : 'Adventurer V3 · Warrior terbuka Lv. 15') : v2 ? (core ? `${core.name} · development only · Specialization locked` : 'Adventurer · Job V2 development only') : null,
  };
}
export const showJobQuest = (hero: PresentationHero, quest: { category: string }) =>
  getVisibleJobArchitecture(hero).legacyProgression || quest.category !== 'class';

/** Item flavour/requirements may mention retired classes. Display aliases ONLY;
 * preserve original IDs, restrictions, names and descriptions in source/save. */
export function presentJobText(hero: PresentationHero | undefined, text: string): string {
  if (!hero || !isV2Presentation(hero)) return text;
  return text.replace(/\b(Gatotkaca|Garda|Caroq|Anom|Srikandi|Jagawana|Resi|Pujangga|Pandita|Bajra)\b/gi, 'Legacy');
}
