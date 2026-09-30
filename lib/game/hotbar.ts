import { ALL_SKILLS, activeSkillsFor, skillsFor, type SkillDefinition } from './skills.ts';
import { ADVENTURER_V3_RUNTIME_SKILLS } from './adventurer-v3.ts';
import { THIEF_V3_RUNTIME_SKILLS } from './thief-runtime.ts';
import { ROGUE_V3_RUNTIME_SKILLS } from './rogue-v3.ts';
import { ASSASIN_V3_RUNTIME_SKILLS } from './assasin-v3.ts';
import { WARRIOR_V3_RUNTIME_SKILLS } from './warrior-v3.ts';
import { BERSERKER_V3_RUNTIME_SKILLS } from './berserker-v3.ts';
import { BLADE_MASTER_V3_RUNTIME_SKILLS } from './blade-master-v3.ts';
import {
  ITEM_CATALOG,
  POTION_ALIASES,
  canonicalItemTemplateId,
  type ItemData,
} from './items.ts';
import type { Hero } from './rules.ts';
import { heroFamilyHotbarBinding, heroFamilySkillActive, heroFamilySkillReference, heroFamilyContext } from './skill-family-runtime.ts';
import { isFamilyBinding } from './skill-family.ts';
import { thiefJobCapabilities } from './thief-job-capabilities.ts';

export const PRIMARY_HOTBAR_SIZE = 10;
const v3HotbarSkills = (hero: Hero) => [
  ...(thiefJobCapabilities(hero).canUseCoreThiefSkills ? THIEF_V3_RUNTIME_SKILLS : []),
  ...(thiefJobCapabilities(hero).canUseRogueSkills ? ROGUE_V3_RUNTIME_SKILLS : []),
  ...(thiefJobCapabilities(hero).canUseAssasinSkills ? ASSASIN_V3_RUNTIME_SKILLS : []),
  ...ADVENTURER_V3_RUNTIME_SKILLS,
  ...(hero.coreJob === 'warrior' ? WARRIOR_V3_RUNTIME_SKILLS : []),
  ...(hero.specialization === 'berserker' ? BERSERKER_V3_RUNTIME_SKILLS : []),
  ...(hero.specialization === 'blade_master' ? BLADE_MASTER_V3_RUNTIME_SKILLS : []),
];
export const primaryHotbarKeys = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
] as const;
export type HotbarLayout = { x: number; y: number } | null;
export type QuickHotbarId = 'q' | 'e';
export type HotbarSlot = number | QuickHotbarId;
export type QuickHotbars = Record<
  QuickHotbarId,
  { assignment: string | null; position: HotbarLayout }
>;
export const emptyQuickHotbars = (): QuickHotbars => ({
  q: { assignment: null, position: null },
  e: { assignment: null, position: null },
});
export type PrimaryHotbarState = {
  primaryHotbarVersion: 1;
  primaryHotbar: Array<string | null>;
  primaryHotbarLayout: HotbarLayout;
  primaryHotbarOverflow: string[];
  quickHotbars: QuickHotbars;
};
export type HotbarEntry = {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: 'skill' | 'item' | 'action';
  usableFromHotbar: boolean;
  hotbarCategory?: 'quick';
  skill?: SkillDefinition;
  item?: Omit<ItemData, 'id' | 'quantity'>;
  quantity?: number;
};
const actions: HotbarEntry[] = [
  {
    id: 'basic-attack',
    name: 'Basic Attack',
    description:
      'Serangan dasar / combo melalui senjata yang dipakai. Bow memakai anak panah; tidak memakai class resource.',
    kind: 'action',
    icon: 'attack',
    usableFromHotbar: true,
  },
  {
    id: 'rest',
    name: 'Sanctuary Rest',
    description:
      'Pulihkan HP di kota atau dekat kristal suaka. Dapat digunakan lewat hotbar atau tombol suaka.',
    kind: 'action',
    icon: 'heal',
    usableFromHotbar: true,
  },
];
export const defaultPrimaryHotbar = (
  hero: Pick<Hero, 'coreJob' | 'specialization'>,
): Array<string | null> => [
  ...skillsFor(hero.coreJob, hero.specialization).map((skill) => skill.id),
  'basic-attack',
  'health-potion-2',
  'health-potion-1',
  'mana-potion-1',
  'rice-meal',
  'rest',
];
const aliases: Record<string, string> = {
  ...POTION_ALIASES,
  attack: 'basic-attack',
  potion: 'health-potion-1',
  heal: 'rest',
  'minor-health-potion': 'health-potion-1',
  'small-health-potion': 'health-potion-1',
  'minor-mana-potion': 'mana-potion-1',
  'small-mana-potion': 'mana-potion-1',
};
function entryId(value: unknown): string | null {
  if (typeof value === 'string') return value.trim().slice(0, 200) || null;
  if (value && typeof value === 'object') {
    const entry = value as Record<string, unknown>;
    return entryId(
      entry.refId ??
        entry.entryId ??
        entry.skillId ??
        entry.itemId ??
        entry.entry ??
        entry.id,
    );
  }
  return null;
}
export function canonicalHotbarId(hero: Hero, value: unknown): string | null {
  const raw = entryId(value)?.replace(/^(skill|item|action):/, '');
  if (!raw) return null;
  if (raw === 'dodge') return null;
  if (heroFamilyContext(hero)?.skills[raw]?.familyId) return heroFamilyHotbarBinding(hero, raw);
  return (
    (hero.inventory.find((item) => item.id === raw)
      ? canonicalItemTemplateId(
          hero.inventory.find((item) => item.id === raw)!.templateId,
        )
      : null) ??
    aliases[raw] ??
    raw
  );
}
export function resolvePrimaryHotbarEntry(
  hero: Hero,
  id: string | null,
): HotbarEntry | null {
  if (!id) return null;
  id = heroFamilySkillReference(hero, id, true);
  if (!id) return null;
  const action = actions.find((entry) => entry.id === id);
  if (action) return action;
  const skill = (hero.skillArchitectureVersion === 3 ? v3HotbarSkills(hero) : ALL_SKILLS).find((entry) => entry.id === id);
  if (skill)
    return {
      id,
      name: skill.name,
      description: skill.description,
      icon: skill.visualEffect,
      kind: 'skill',
      skill,
      usableFromHotbar:
        skill.usableFromHotbar === true && skill.skillType === 'active' && heroFamilyContext(hero)?.skills[skill.id]?.familyRole !== 'PASSIVE',
    };
  const owned = hero.inventory.filter((item) => item.templateId === id);
  const item = owned[0] ?? ITEM_CATALOG[id];
  if (!item) return null;
  return {
    id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    kind: 'item',
    item,
    quantity: owned.reduce((sum, item) => sum + item.quantity, 0),
    usableFromHotbar: item.usableFromHotbar === true,
  };
}
export function canPlaceInPrimaryHotbar(entry: HotbarEntry | null): boolean {
  return (
    !!entry?.usableFromHotbar &&
    (entry.kind !== 'item' || !!entry.item?.useEffect)
  );
}
export function primaryHotbarAssignmentReason(
  hero: Hero,
  entry: HotbarEntry | null,
  allowLegacySkills = true,
): string | null {
  if (!canPlaceInPrimaryHotbar(entry))
    return 'Item atau passive ini tidak dapat digunakan dari PrimaryHotbar.';
  if (entry?.skill) {
    const definition = heroFamilyContext(hero)?.skills[entry.id];
    if (definition?.familyRole === 'PASSIVE' || !heroFamilySkillActive(hero, entry.id))
      return 'Skill family ini sudah digantikan atau bukan ability aktif.';
    if (
      !(hero.skillArchitectureVersion === 3
        ? v3HotbarSkills(hero)
        : allowLegacySkills || hero.progressionArchitecture==='v2_test'
        ? activeSkillsFor(hero.coreJob, hero.specialization,hero.progressionArchitecture === 'v2_test' ? 'v2_test' : 'legacy')
        : skillsFor(hero.coreJob, hero.specialization)
      ).some(
        (skill) => skill.id === entry.id,
      )
    )
      return 'Skill tidak sesuai job yang sedang digunakan.';
    if (hero.level < entry.skill.unlockLevel)
      return `Membutuhkan Level ${entry.skill.unlockLevel}.`;
    if (!((hero.skillArchitectureVersion === 3
      ? hero.skillProgressionV3?.skillRanks[entry.id]
      : hero.skillLevels[entry.id])! > 0))
      return 'Skill belum dipelajari. Buka Job Skill (J).';
  }
  if (entry?.kind === 'item' && !entry.quantity)
    return 'Item habis atau tidak ada di inventory.';
  return null;
}
function legacySlots(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.slots)) return record.slots;
    if (Array.isArray(record.assignments)) return record.assignments;
  }
  return [];
}
export function loadPrimaryHotbar(
  hero: Hero,
  source: Record<string, unknown>,
): PrimaryHotbarState {
  const hasPrimary =
    Array.isArray(source.primaryHotbar) ||
    !!(source.primaryHotbar && typeof source.primaryHotbar === 'object');
  const legacy = [
    ...legacySlots(
      source.comboSkillActionHotbar ?? source.ComboSkillActionHotbar,
    ),
    ...legacySlots(source.utilityHotbar ?? source.UtilityHotbar),
  ];
  const initial = hasPrimary
    ? legacySlots(source.primaryHotbar)
    : legacy.length
      ? []
      : defaultPrimaryHotbar(hero);
  const slots: Array<string | null> = Array(PRIMARY_HOTBAR_SIZE).fill(null);
  const overflow: string[] = [];
  const seen = new Set<string>();
  const archive = (id: string) => {
    if (!overflow.includes(id) && !slots.includes(id)) overflow.push(id);
  };
  for (let index = 0; index < initial.length; index++) {
    const id = canonicalHotbarId(hero, initial[index]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (
      index < PRIMARY_HOTBAR_SIZE &&
      (canPlaceInPrimaryHotbar(resolvePrimaryHotbarEntry(hero, id)) || knownFamilyBinding(hero, id))
    )
      slots[index] = id;
    else archive(id);
  }
  for (const raw of [...legacy, ...legacySlots(source.primaryHotbarOverflow)]) {
    const id = canonicalHotbarId(hero, raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const empty = slots.indexOf(null);
    // Archived assignments stay archived on later loads; removing a slot is intentional.
    if (
      legacy.includes(raw) &&
      empty >= 0 &&
      canPlaceInPrimaryHotbar(resolvePrimaryHotbarEntry(hero, id))
    )
      slots[empty] = id;
    else archive(id);
  }
  const layout = source.primaryHotbarLayout as
    | { x?: unknown; y?: unknown }
    | undefined;
  return {
    primaryHotbarVersion: 1,
    primaryHotbar: slots,
    primaryHotbarOverflow: overflow,
    quickHotbars: loadQuickHotbars(
      { ...hero, primaryHotbar: slots },
      source.quickHotbars,
    ),
    primaryHotbarLayout:
      layout && Number.isFinite(layout.x) && Number.isFinite(layout.y)
        ? { x: Math.max(0, Number(layout.x)), y: Math.max(0, Number(layout.y)) }
        : null,
  };
}
export function validatePrimaryHotbar(hero: Hero): Hero {
  const state = loadPrimaryHotbar(
    hero,
    hero as unknown as Record<string, unknown>,
  );
  return { ...hero, ...state };
}
const validIndex = (index: number) =>
  Number.isInteger(index) && index >= 0 && index < PRIMARY_HOTBAR_SIZE;
export function swapPrimaryHotbarSlots(
  hero: Hero,
  source: number,
  target: number,
): Hero {
  if (!validIndex(source) || !validIndex(target) || source === target)
    return hero;
  return swapHotbarEntries(hero, source, target);
}
export function assignPrimaryHotbarSlot(
  hero: Hero,
  index: number,
  rawId: string,
) {
  const familyReason = familyAssignmentReason(hero, rawId);
  if (familyReason) return { ok: false, hero, reason: familyReason };
  const id = canonicalHotbarId(hero, rawId),
    entry = resolvePrimaryHotbarEntry(hero, id);
  const reason = primaryHotbarAssignmentReason(hero, entry);
  if (!validIndex(index) || !id || reason)
    return { ok: false, hero, reason: reason ?? 'Slot tidak valid.' };
  const oldIndex = findHotbarEntry(hero, id);
  const swapReason =
    oldIndex === null ? null : hotbarSwapReason(hero, oldIndex, index);
  if (swapReason) return { ok: false, hero, reason: swapReason };
  const next =
    oldIndex !== null
      ? swapHotbarEntries(hero, oldIndex, index)
      : {
          ...hero,
          primaryHotbar: hero.primaryHotbar.map((old, i) =>
            i === index ? id : old,
          ),
        };
  return {
    ok: true,
    hero: {
      ...next,
      primaryHotbarOverflow: next.primaryHotbarOverflow.filter(
        (old) => old !== id,
      ),
    },
    reason: `${entry!.name} dipasang di slot ${index === 9 ? '0' : index + 1}.`,
  };
}
export function removePrimaryHotbarSlot(hero: Hero, index: number): Hero {
  if (!validIndex(index)) return hero;
  return {
    ...hero,
    primaryHotbar: hero.primaryHotbar.map((id, i) => (i === index ? null : id)),
  };
}
export function remapPrimaryHotbarForJob(
  hero: Hero,
  previousSkills: SkillDefinition[],
): void {
  const next = skillsFor(hero.coreJob, hero.specialization);
  hero.primaryHotbar = hero.primaryHotbar.map((id) => {
    if (id && (isFamilyBinding(id) || heroFamilyContext(hero)?.skills[id]?.familyId)) return heroFamilyHotbarBinding(hero, id);
    const prior = previousSkills.find((skill) => skill.id === id);
    return prior
      ? (next.find((skill) => skill.slot === prior.slot)?.id ?? id)
      : id;
  });
  // A job change invalidates old quick skills; do not silently grant a new skill.
  hero.quickHotbars = loadQuickHotbars(hero, hero.quickHotbars);
}

export const isQuickHotbarId = (id: unknown): id is QuickHotbarId =>
  id === 'q' || id === 'e';
export const isHotbarSlot = (slot: unknown): slot is HotbarSlot =>
  isQuickHotbarId(slot) || (typeof slot === 'number' && validIndex(slot));
export const hotbarSlotLabel = (slot: HotbarSlot) =>
  typeof slot === 'number' ? String((slot + 1) % 10) : slot.toUpperCase();
export const hotbarSlots: HotbarSlot[] = [
  ...Array.from({ length: 10 }, (_, i) => i),
  'q',
  'e',
];
export function hotbarAssignment(hero: Hero, slot: HotbarSlot): string | null {
  return typeof slot === 'number'
    ? (hero.primaryHotbar[slot] ?? null)
    : (hero.quickHotbars?.[slot]?.assignment ?? null);
}
function setHotbarAssignment(
  hero: Hero,
  slot: HotbarSlot,
  assignment: string | null,
): Hero {
  return typeof slot === 'number'
    ? {
        ...hero,
        primaryHotbar: hero.primaryHotbar.map((id, i) =>
          i === slot ? assignment : id,
        ),
      }
    : {
        ...hero,
        quickHotbars: {
          ...(hero.quickHotbars ?? emptyQuickHotbars()),
          [slot]: {
            ...hero.quickHotbars?.[slot],
            position: hero.quickHotbars?.[slot]?.position ?? null,
            assignment,
          },
        },
      };
}
function findHotbarEntry(hero: Hero, id: string): HotbarSlot | null {
  return (
    hotbarSlots.find((slot) => canonicalHotbarId(hero, hotbarAssignment(hero, slot)) === id) ?? null
  );
}
export function swapHotbarEntries(
  hero: Hero,
  source: HotbarSlot,
  target: HotbarSlot,
): Hero {
  if (!isHotbarSlot(source) || !isHotbarSlot(target) || source === target)
    return hero;
  if (hotbarSwapReason(hero, source, target)) return hero;
  const from = hotbarAssignment(hero, source),
    to = hotbarAssignment(hero, target);
  return setHotbarAssignment(
    setHotbarAssignment(hero, source, to),
    target,
    from,
  );
}
export const canPlaceInQuickHotbar = canPlaceInPrimaryHotbar;
export function hotbarSwapReason(
  hero: Hero,
  source: HotbarSlot,
  target: HotbarSlot,
): string | null {
  for (const [from, to] of [
    [source, target],
    [target, source],
  ] as const) {
    if (!isQuickHotbarId(to)) continue;
    const id = hotbarAssignment(hero, from);
    if (!id) continue;
    const entry = resolvePrimaryHotbarEntry(hero, id);
    if (!canPlaceInQuickHotbar(entry))
      return 'Entry tidak dapat dipasang di QuickHotbar.';
    if (entry?.skill) {
      const reason = primaryHotbarAssignmentReason(hero, entry, false);
      if (reason) return reason;
    }
  }
  return null;
}
export function resolveQuickHotbarEntry(
  hero: Hero,
  id: QuickHotbarId,
): HotbarEntry | null {
  const entry = resolvePrimaryHotbarEntry(hero, hotbarAssignment(hero, id));
  return entry ? { ...entry, hotbarCategory: 'quick' } : null;
}
export function assignQuickHotbarSlot(
  hero: Hero,
  hotbarId: QuickHotbarId,
  rawId: string,
) {
  const familyReason = familyAssignmentReason(hero, rawId);
  if (familyReason) return { ok: false, hero, reason: familyReason };
  const id = canonicalHotbarId(hero, rawId),
    entry = resolvePrimaryHotbarEntry(hero, id);
  const reason = primaryHotbarAssignmentReason(hero, entry, false);
  if (!isQuickHotbarId(hotbarId) || !id || reason)
    return { ok: false, hero, reason: reason ?? 'Slot tidak valid.' };
  const source = findHotbarEntry(hero, id);
  const swapReason =
    source === null ? null : hotbarSwapReason(hero, source, hotbarId);
  if (swapReason) return { ok: false, hero, reason: swapReason };
  const next =
    source === null
      ? setHotbarAssignment(hero, hotbarId, id)
      : swapHotbarEntries(hero, source, hotbarId);
  return {
    ok: true,
    hero: {
      ...next,
      primaryHotbarOverflow: next.primaryHotbarOverflow.filter(
        (old) => old !== id,
      ),
    },
    reason: `${entry!.name} dipasang di ${hotbarId.toUpperCase()}.`,
  };
}
export function removeQuickHotbarSlot(
  hero: Hero,
  hotbarId: QuickHotbarId,
): Hero {
  return isQuickHotbarId(hotbarId)
    ? setHotbarAssignment(hero, hotbarId, null)
    : hero;
}
export function moveQuickHotbarEntry(
  hero: Hero,
  source: QuickHotbarId,
  target: QuickHotbarId,
): Hero {
  return swapHotbarEntries(hero, source, target);
}
function loadQuickHotbars(hero: Hero, raw: unknown): QuickHotbars {
  const result = emptyQuickHotbars(),
    seen = new Set(hero.primaryHotbar.filter(Boolean));
  const data =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const key of ['q', 'e'] as const) {
    const value =
      data[key] && typeof data[key] === 'object'
        ? (data[key] as Record<string, unknown>)
        : {};
    const id = canonicalHotbarId(hero, value.assignment),
      entry = resolvePrimaryHotbarEntry(hero, id);
    // Known depleted consumables retain their reference so restocking works.
    if (
      id &&
      !seen.has(id) &&
      ((canPlaceInQuickHotbar(entry) && (!entry?.skill || !primaryHotbarAssignmentReason(hero, entry, false))) || knownFamilyBinding(hero, id))
    ) {
      result[key].assignment = id;
      seen.add(id);
    }
    const p = value.position as { x?: unknown; y?: unknown } | undefined;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y))
      result[key].position = {
        x: Math.max(0, Number(p.x)),
        y: Math.max(0, Number(p.y)),
      };
  }
  return result;
}
export function validateQuickHotbarAssignments(hero: Hero): Hero {
  return { ...hero, quickHotbars: loadQuickHotbars(hero, hero.quickHotbars) };
}
export function resetHotbarLayouts(hero: Hero): Hero {
  const quick = hero.quickHotbars ?? emptyQuickHotbars();
  return {
    ...hero,
    primaryHotbarLayout: null,
    quickHotbars: {
      q: { ...quick.q, position: null },
      e: { ...quick.e, position: null },
    },
  };
}
export function quickHotbarKey(
  event: Pick<
    KeyboardEvent,
    'code' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey'
  >,
): QuickHotbarId | null {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey)
    return null;
  return event.code === 'KeyQ' ? 'q' : event.code === 'KeyE' ? 'e' : null;
}
export function getPrimaryHotbarEntries(hero: Hero): HotbarEntry[] {
  const ids = [
    ...(hero.skillArchitectureVersion === 3
      ? v3HotbarSkills(hero)
      : activeSkillsFor(hero.coreJob, hero.specialization, hero.progressionArchitecture === 'v2_test' ? 'v2_test' : 'legacy')).map((skill) => skill.id),
    ...actions.map((entry) => entry.id),
    ...hero.inventory.map((item) => item.templateId),
    ...hero.primaryHotbarOverflow,
  ];
  return [...new Set(ids.filter(id => heroFamilySkillActive(hero, id)).map(id => canonicalHotbarId(hero, id)))]
    .map((id) => resolvePrimaryHotbarEntry(hero, id))
    .filter(
      (entry): entry is HotbarEntry =>
        !!entry && canPlaceInPrimaryHotbar(entry) && heroFamilyContext(hero)?.skills[entry.id]?.familyRole !== 'PASSIVE',
    );
}

function familyAssignmentReason(hero: Hero, raw: string): string | null {
  const id = entryId(raw)?.replace(/^skill:/, '') ?? raw;
  const context = heroFamilyContext(hero);
  if (!context?.skills[id]?.familyId) return null;
  return context.state.skillRanks[id] > 0 && heroFamilySkillActive(hero, id)
    ? null : 'Skill belum dipelajari atau sudah digantikan oleh anggota family aktif.';
}

function knownFamilyBinding(hero: Hero, id: string): boolean {
  const context = heroFamilyContext(hero);
  return !!context && isFamilyBinding(id) && Object.values(context.skills).some(s => s.familyId === id.slice(7) && s.familyRole !== 'PASSIVE');
}

/** Preserve slot identity across evolution/respec, including a temporarily empty
 * family after a full reset. An empty binding cannot activate or grant a skill. */
export function reconcileFamilyHotbarBindings(hero: Hero): void {
  const seen = new Set<string>();
  const bind = (id: string | null) => {
    if (!id) return null;
    const binding = canonicalHotbarId(hero, id);
    if (!binding || seen.has(binding)) return null;
    seen.add(binding);
    return binding;
  };
  hero.primaryHotbar = hero.primaryHotbar.map(bind);
  for (const key of ['q', 'e'] as const) {
    if (hero.quickHotbars?.[key]) hero.quickHotbars[key].assignment = bind(hero.quickHotbars[key].assignment);
  }
  hero.primaryHotbarOverflow = hero.primaryHotbarOverflow.map(bind).filter((id): id is string => !!id);
}
export function clampPrimaryHotbarLayout(
  position: HotbarLayout,
  viewport: { width: number; height: number },
  panel: { width: number; height: number },
): { x: number; y: number } {
  const margin = 8,
    maxX = Math.max(margin, viewport.width - panel.width - margin),
    maxY = Math.max(margin, viewport.height - panel.height - margin);
  return {
    x: Math.max(
      margin,
      Math.min(maxX, position?.x ?? (viewport.width - panel.width) / 2),
    ),
    y: Math.max(
      margin,
      Math.min(maxY, position?.y ?? viewport.height - panel.height - 44),
    ),
  };
}
export function primaryHotbarKeyIndex(
  event: Pick<
    KeyboardEvent,
    'code' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey'
  >,
): number {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return -1;
  return primaryHotbarKeys.indexOf(
    event.code as (typeof primaryHotbarKeys)[number],
  );
}
