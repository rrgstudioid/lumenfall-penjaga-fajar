import type { ItemData, StatBlock } from './items.ts';

export type DualWieldCapability = { canDualWieldOneHandSwords?: boolean };
export type DualWieldEquipReason =
  | 'DUAL_WIELD_CAPABILITY_REQUIRED'
  | 'TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON'
  | 'OFFHAND_WEAPON_REQUIRES_ONE_HAND_SWORD'
  | 'SHIELD_CONFLICT_WITH_OFFHAND_WEAPON';

export const isOneHandSword = (item: ItemData | null): item is ItemData => Boolean(
  item && item.equipmentType === 'one_hand_sword' && item.handedness === 'one_hand' && !item.twoHanded,
);
export const isTwoHandWeapon = (item: ItemData | null) => Boolean(item && (item.twoHanded || item.handedness === 'two_hand'));
export const isShield = (item: ItemData | null) => item?.equipmentType === 'shield';
export const dualWieldEnabled = (owner: DualWieldCapability | null | undefined) => owner?.canDualWieldOneHandSwords === true;

export function validateDualWieldEquip(
  owner: DualWieldCapability,
  main: ItemData | null,
  off: ItemData | null,
  incoming: ItemData,
  targetSlot: 'mainHand' | 'offHand',
) {
  const nextMain = targetSlot === 'mainHand' ? incoming : main;
  const nextOff = targetSlot === 'offHand' ? incoming : off;
  if (targetSlot === 'offHand' && isOneHandSword(incoming)) {
    if (!dualWieldEnabled(owner)) return { ok: false as const, reason: 'DUAL_WIELD_CAPABILITY_REQUIRED' as const };
    if (!isOneHandSword(main)) return { ok: false as const, reason: 'OFFHAND_WEAPON_REQUIRES_ONE_HAND_SWORD' as const };
  }
  if (targetSlot === 'mainHand' && isOneHandSword(incoming) && isOneHandSword(off) && !dualWieldEnabled(owner)) {
    return { ok: false as const, reason: 'DUAL_WIELD_CAPABILITY_REQUIRED' as const };
  }
  if (isTwoHandWeapon(nextMain) && nextOff && !isShield(nextOff) && nextOff.equipmentType !== 'quiver') {
    return { ok: false as const, reason: 'TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON' as const };
  }
  if (isOneHandSword(nextMain) && isTwoHandWeapon(nextOff)) {
    return { ok: false as const, reason: 'TWO_HAND_CONFLICT_WITH_OFFHAND_WEAPON' as const };
  }
  if (isShield(nextOff) && isOneHandSword(nextMain) && isOneHandSword(off) && off.id !== incoming.id) {
    return { ok: false as const, reason: 'SHIELD_CONFLICT_WITH_OFFHAND_WEAPON' as const };
  }
  return { ok: true as const, reason: null };
}

export type WeaponContributionMode = 'SINGLE_MAIN' | 'SINGLE_OFF' | 'DUAL_COMBINED' | 'DUAL_SEQUENCE';
export type WeaponHand = 'MAIN' | 'OFF';
export type WeaponHitDefinition = {
  weaponHand: WeaponHand;
  sharedContributionWeight: number;
  weaponContributionCoefficient: number;
  skillCoefficient: number;
  delay?: number;
};
export type WeaponAttackContext = {
  mode: WeaponContributionMode;
  sharedPhysicalCore: number;
  mainHandWeaponAttack: number;
  offHandWeaponAttack: number;
  totalWeaponAttack: number;
};

const weaponAttack = (item: ItemData | null) => item ? (item.baseStats.attack ?? 0) * (1 + item.enhancementLevel * .08) : 0;
export function resolveWeaponAttackContext(
  main: ItemData | null,
  off: ItemData | null,
  mode: WeaponContributionMode = 'SINGLE_MAIN',
  sharedPhysicalCore = 0,
): WeaponAttackContext {
  const mainHandWeaponAttack = weaponAttack(main);
  const offHandWeaponAttack = weaponAttack(off);
  const totalWeaponAttack = mode === 'SINGLE_OFF' ? offHandWeaponAttack : mode === 'DUAL_COMBINED' ? mainHandWeaponAttack + offHandWeaponAttack : mode === 'SINGLE_MAIN' ? mainHandWeaponAttack : 0;
  return { mode, sharedPhysicalCore, mainHandWeaponAttack, offHandWeaponAttack, totalWeaponAttack };
}

export type UniqueEffectDescriptor = { id: string; magnitude: number; priority: number; stackable: boolean; hand: WeaponHand };
export function resolveUniqueEffects(main: ItemData | null, off: ItemData | null): UniqueEffectDescriptor[] {
  const all = [
    main?.uniqueEffectData ? { ...main.uniqueEffectData, hand: 'MAIN' as const } : null,
    off?.uniqueEffectData ? { ...off.uniqueEffectData, hand: 'OFF' as const } : null,
  ].filter((entry): entry is UniqueEffectDescriptor => Boolean(entry));
  const result: UniqueEffectDescriptor[] = [];
  for (const entry of all) {
    if (entry.stackable || !result.some(active => active.id === entry.id)) { result.push(entry); continue; }
    const active = result.find(candidate => candidate.id === entry.id)!;
    if (entry.magnitude > active.magnitude || (entry.magnitude === active.magnitude && entry.priority > active.priority) || (entry.magnitude === active.magnitude && entry.priority === active.priority && entry.hand === 'MAIN')) {
      result[result.indexOf(active)] = entry;
    }
  }
  return result;
}

export function aggregateEquipmentStatOnce(main: ItemData | null, off: ItemData | null): StatBlock {
  const result: StatBlock = {};
  for (const item of [main, off]) if (item) {
    const factor = 1 + item.enhancementLevel * .08;
    for (const block of [item.baseStats, item.bonusStats]) for (const [key, value] of Object.entries(block)) result[key as keyof StatBlock] = (result[key as keyof StatBlock] ?? 0) + (value ?? 0) * factor;
    for (const socket of item.sockets) if (socket.rune) for (const [key, value] of Object.entries(socket.rune.affixes.reduce((stats, affix) => ({ ...stats, [affix.stat]: (stats[affix.stat] ?? 0) + affix.value }), {} as StatBlock))) result[key as keyof StatBlock] = (result[key as keyof StatBlock] ?? 0) + (value ?? 0) * factor;
  }
  return result;
}
