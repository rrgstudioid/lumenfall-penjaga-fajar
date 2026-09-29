import type { EquipmentLoadout, ItemData } from './items.ts';

/** Compatibility only: this list does not register/unlock any future job. */
export const THIEF_LINEAGE_JOBS = ['thief', 'rogue', 'spectre', 'assasin', 'reaper'] as const;
export type DaggerOwner = { coreJob?: string | null; specialization?: string | null; job?: string | null };
export function isThiefLineage(owner: DaggerOwner) {
  // The old core ID `rogue` already belongs to this lineage. An unrelated core
  // cannot borrow access through stale specialization metadata.
  const job = (owner.coreJob ?? owner.specialization ?? owner.job ?? '').toLowerCase();
  return (THIEF_LINEAGE_JOBS as readonly string[]).includes(job);
}

type DaggerIdentity = Pick<ItemData, 'equipmentType' | 'itemType'>;
export const isDaggerItem = (item: DaggerIdentity | null | undefined) => Boolean(item && (
  item.equipmentType === 'dagger' || item.equipmentType === 'off_hand_dagger' ||
  ['dagger', 'dualDagger', 'offHandDagger'].includes(item.itemType)
));
export const isOneHandDagger = (item: ItemData | null | undefined): item is ItemData => Boolean(
  item && item.id && item.category === 'weapon' && item.equipmentType === 'dagger' &&
  item.handedness === 'one_hand' && !item.twoHanded && !item.stackable && item.quantity === 1,
);

/** Clean break: retain the original item and all its values, never mint a pair. */
export function canonicalizeDaggerItem<T extends DaggerIdentity>(item: T): T {
  if (!isDaggerItem(item)) return item;
  return { ...item, category: 'weapon', itemType: 'dagger', equipmentType: 'dagger',
    weaponType: 'dagger', handedness: 'one_hand', attackType: 'melee',
    mainHand: true, offHand: false, twoHanded: false, equipSlot: 'mainHand',
    allowedSlots: ['mainHand', 'offHand'], allowedJobFamily: 'THIEF_LINEAGE',
    allowedJobs: ['rogue'], requiredCoreJob: null, requiredSpecialJob: null,
    stackable: false, maxStack: 1, ...('quantity' in item ? { quantity: 1 } : {}),
  };
}

export type DaggerEquipmentState = 'NO_DAGGER' | 'MAIN_DAGGER' | 'OFF_DAGGER' | 'DUAL_DAGGER';
export function resolveDaggerEquipment(owner: DaggerOwner, main: ItemData | null, off: ItemData | null) {
  const permitted = isThiefLineage(owner);
  const mainDagger = permitted && isOneHandDagger(main) ? main : null;
  // Prefer Main when reconciling an obsolete mirrored instance.
  const offDagger = permitted && isOneHandDagger(off) && off.id !== main?.id &&
    (!main || mainDagger) ? off : null;
  const state: DaggerEquipmentState = mainDagger && offDagger ? 'DUAL_DAGGER'
    : mainDagger ? 'MAIN_DAGGER' : offDagger ? 'OFF_DAGGER' : 'NO_DAGGER';
  return { state, main: mainDagger, off: offDagger,
    label: state === 'DUAL_DAGGER' ? 'Dual Daggers' : state === 'NO_DAGGER' ? null : 'Dagger' };
}

export function validateDaggerEquip(owner: DaggerOwner, main: ItemData | null, off: ItemData | null,
  incoming: ItemData, slot: 'mainHand' | 'offHand') {
  const reject = (code: string, reason: string) => ({ ok: false as const, code, reason });
  if (!isDaggerItem(incoming) && !isDaggerItem(main) && !isDaggerItem(off)) return { ok: true as const };
  if (isDaggerItem(incoming)) {
    if (!isThiefLineage(owner)) return reject('THIEF_LINEAGE_REQUIRED', 'Dagger hanya untuk Thief lineage.');
    if (!isOneHandDagger(incoming)) return reject('INVALID_DAGGER_INSTANCE', 'Dagger harus satu instance senjata one-hand yang valid.');
    if ((slot === 'mainHand' ? off : main)?.id === incoming.id)
      return reject('DUPLICATE_WEAPON_INSTANCE', 'Lepaskan item dari tangan lain terlebih dahulu; satu Dagger hanya untuk satu tangan.');
  }
  const nextMain = slot === 'mainHand' ? incoming : main;
  const nextOff = slot === 'offHand' ? incoming : off;
  if (isDaggerItem(nextOff) && nextMain && !isOneHandDagger(nextMain))
    return reject('DAGGER_OFFHAND_CONFLICT', 'Off Hand Dagger membutuhkan Main Hand Dagger atau Main Hand kosong.');
  return { ok: true as const };
}

/** Save reconciliation never deletes inventory items or creates virtual weapons. */
export function reconcileDaggerEquipment(owner: DaggerOwner, inventory: ItemData[], equipment: EquipmentLoadout) {
  const result = { ...equipment };
  const main = inventory.find(item => item.id === result.mainHand) ?? null;
  const off = inventory.find(item => item.id === result.offHand) ?? null;
  const resolved = resolveDaggerEquipment(owner, main, off);
  if (!main || (isDaggerItem(main) && !resolved.main)) result.mainHand = null;
  if (!off || (isDaggerItem(off) && !resolved.off)) result.offHand = null;
  if (isDaggerItem(main) && inventory.filter(item => item.id === main!.id).length !== 1) result.mainHand = null;
  if (isDaggerItem(off) && inventory.filter(item => item.id === off!.id).length !== 1) result.offHand = null;
  // A dagger instance cannot masquerade as another equipment slot either.
  for (const slot of Object.keys(result) as Array<keyof EquipmentLoadout>) {
    if (slot !== 'mainHand' && slot !== 'offHand' && isDaggerItem(inventory.find(item => item.id === result[slot]))) result[slot] = null;
  }
  return result;
}
