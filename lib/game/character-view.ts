import {
  itemById,
  resolveEquipmentAsset,
  type EquipSlot,
  type ItemData,
} from './items.ts';
import { activeSkills, derivedStats, equipItem, type Hero } from './rules.ts';
import { getCombatPower } from './combat-power.ts';
import { getVisibleJobArchitecture, v3SpecializationName } from './job-presentation.ts';
import {
  ALL_PASSIVES,
  ALL_SKILLS,
  CORE_JOBS,
  SPECIALIZATIONS,
  skillArchitectureAllowed,
} from './skills.ts';
import { CITIES, getQuestRegistry, getQuestRequirements } from './regions.ts';

export const CHARACTER_SLOTS: Array<{
  id: EquipSlot;
  label: string;
  side: 'left' | 'right';
}> = [
  { id: 'head', label: 'Head', side: 'left' },
  { id: 'chest', label: 'Body Armor', side: 'left' },
  { id: 'gloves', label: 'Gloves', side: 'left' },
  { id: 'boots', label: 'Boots', side: 'left' },
  { id: 'necklace', label: 'Necklace', side: 'left' },
  { id: 'earring1', label: 'Earring 1', side: 'left' },
  { id: 'earring2', label: 'Earring 2', side: 'left' },
  { id: 'mainHand', label: 'Main Weapon', side: 'right' },
  { id: 'offHand', label: 'Off Hand', side: 'right' },
  { id: 'ring1', label: 'Ring 1', side: 'right' },
  { id: 'ring2', label: 'Ring 2', side: 'right' },
];
export const resolveEquipmentVisual = (item: ItemData) => ({
  ...resolveEquipmentAsset(item),
  itemId: item.id,
  templateId: item.templateId,
  rarity: item.rarity,
});
export const getCharacterEquipmentLayers = (hero: Hero) =>
  Object.entries(hero.equipment).flatMap(([slot, id]) => {
    const item = itemById(hero.inventory, id);
    return item
      ? [
          {
            slot: slot as EquipSlot,
            item,
            visual: resolveEquipmentVisual(item),
          },
        ]
      : [];
  });
export function previewEquipmentChange(
  hero: Hero,
  item: ItemData,
  slot: EquipSlot,
) {
  const previewHero = {
    ...hero,
    equipment: { ...hero.equipment },
    inventory: [...hero.inventory],
    petRecords: { ...hero.petRecords },
  };
  const validation = equipItem(previewHero, item.id, slot);
  const beforePower = getCombatPower(hero);
  const afterPower = validation.ok ? getCombatPower(previewHero) : null;
  return {
    validation,
    hero: previewHero,
    before: derivedStats(hero),
    after: derivedStats(previewHero),
    combatPower: afterPower
      ? {
          before: beforePower,
          after: afterPower,
          delta: afterPower.total - beforePower.total,
        }
      : null,
  };
}
export type JobStageId =
  | 'adventurer'
  | 'core'
  | 'specialization'
  | 'mastery'
  | 'capstone';
export function getJobProgression(hero: Hero) {
  const architecture = getVisibleJobArchitecture(hero);
  if (architecture.v3) return [
    { id: 'adventurer' as JobStageId, name: 'Adventurer', level: 1, done: true },
    { id: 'core' as JobStageId, name: 'Warrior', level: 15, done: !!hero.coreJob },
    { id: 'specialization' as JobStageId, name: v3SpecializationName(hero.specialization) ?? 'Berserker / Blade Master', level: 60, done: !!hero.specialization },
  ].map((entry, index) => ({ ...entry,
    status: entry.done ? (index === (hero.specialization ? 2 : hero.coreJob ? 1 : 0) ? 'Current' : 'Completed') : 'Locked',
    requirements: entry.done ? [] : [`Level ${entry.level}`, 'Pilih job melalui trainer'],
    quest: undefined, npc: undefined, history: hero.jobHistory?.[entry.id],
  }));
  if (architecture.v2)
    return [
      {
        id: 'adventurer' as JobStageId,
        name: 'Adventurer',
        level: 1,
        done: true,
        status: hero.coreJob ? 'Completed' : 'Current',
        requirements: [] as string[],
        quest: undefined,
        npc: undefined,
        history: hero.jobHistory?.adventurer,
      },
      {
        id: 'core' as JobStageId,
        name: hero.coreJob
          ? architecture.currentName
          : 'Core Job · development only',
        level: 15,
        done: !!hero.coreJob,
        status: hero.coreJob ? 'Current' : 'Locked',
        requirements: ['Development/test authorization only'],
        quest: undefined,
        npc: undefined,
        history: hero.jobHistory?.core,
      },
    ];
  const registry = getQuestRegistry();
  const capstone = hero.specialization
    ? ALL_PASSIVES.find(
        (p) =>
          p.specialization === hero.specialization && p.tier === 'capstone',
      )
    : undefined;
  const specs = hero.coreJob
    ? (CORE_JOBS[hero.coreJob as keyof typeof CORE_JOBS]?.specializations ?? [])
        .map((id) => SPECIALIZATIONS[id].name)
        .join(' / ')
    : 'Specialization';
  const stages: Array<{
    id: JobStageId;
    name: string;
    level: number;
    questId?: string;
    done: boolean;
    requirements: string[];
  }> = [
    {
      id: 'adventurer',
      name: 'Adventurer',
      level: 1,
      done: true,
      requirements: [],
    },
    {
      id: 'core',
      name: hero.coreJob ? CORE_JOBS[hero.coreJob as keyof typeof CORE_JOBS]?.name ?? 'Core Job' : 'Core Job',
      level: 10,
      questId: 'class-core',
      done: !!hero.coreJob,
      requirements: [],
    },
    {
      id: 'specialization',
      name: hero.specialization
        ? hero.specialization === 'berserker' ? 'Berserker' : SPECIALIZATIONS[hero.specialization].name
        : specs,
      level: 25,
      questId: 'class-specialization',
      done: !!hero.specialization,
      requirements: [],
    },
    {
      id: 'mastery',
      name: 'Advanced Job · Mastery',
      level: 40,
      questId: 'class-mastery',
      done: hero.masteryQuestClaimed,
      requirements: [],
    },
    {
      id: 'capstone',
      name: capstone?.name ?? 'Capstone',
      level: 50,
      done: !!capstone && !!hero.passiveLevels[capstone.id],
      requirements: [
        'Level 50',
        'Selesaikan Mastery Quest',
        'Passive utama level 3',
        '1 Skill Point',
      ],
    },
  ];
  const current = stages.findLastIndex((stage) => stage.done);
  return stages.map((stage, index) => {
    const quest = registry.find((q) => q.id === stage.questId);
    const requirements = quest
      ? getQuestRequirements(quest, hero)
      : stage.requirements;
    const npc = quest
      ? CITIES[quest.giverMapId]?.npcList.find((n) => n.id === quest.giverNpcId)
      : undefined;
    const available = quest
      ? requirements.length === 0
      : index === 4 &&
        hero.level >= 50 &&
        hero.masteryQuestClaimed &&
        !!capstone &&
        (hero.passiveLevels[capstone.prerequisiteSkillIds?.[0] ?? ''] ?? 0) >=
          3;
    return {
      ...stage,
      quest,
      npc,
      requirements,
      status: stage.done
        ? index === current
          ? 'Current'
          : 'Completed'
        : available
          ? 'Available'
          : 'Locked',
      history: hero.jobHistory?.[stage.id],
    };
  });
}
export function getJobSkillNodes(hero: Hero, stage: JobStageId) {
  if (hero.skillArchitectureVersion === 3) return {
    active: activeSkills(hero).filter(skill => stage === 'adventurer' ? skill.job === 'adventurer'
      : stage === 'core' ? skill.job === 'warrior' && !skill.specialization
      : stage === 'specialization' ? !!hero.specialization && skill.specialization === hero.specialization : false),
    passive: [],
  };
  const active = ALL_SKILLS.filter((skill) =>
    stage === 'adventurer'
      ? skill.job === 'adventurer'
      : stage === 'core'
        ? !!hero.coreJob && skill.job === hero.coreJob && !skill.specialization
        : stage === 'specialization' || stage === 'mastery'
          ? !!hero.specialization &&
            skill.specialization === hero.specialization
          : false,
  );
  const passive = ALL_PASSIVES.filter(
    (skill) =>
      skill.tier === stage &&
      (skill.job === 'adventurer' || skill.job === hero.coreJob) &&
      (!skill.specialization || skill.specialization === hero.specialization),
  );
  return {
    active: active.filter((s) => skillArchitectureAllowed(hero, s)),
    passive: passive.filter((s) => skillArchitectureAllowed(hero, s)),
  };
}
