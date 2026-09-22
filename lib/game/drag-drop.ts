import { equipItem, type Hero } from './rules.ts';
import { canonicalItemTemplateId, type EquipSlot } from './items.ts';
import {
  assignPrimaryHotbarSlot,
  primaryHotbarAssignmentReason,
  removePrimaryHotbarSlot,
  resolvePrimaryHotbarEntry,
  swapHotbarEntries,
  assignQuickHotbarSlot,
  removeQuickHotbarSlot,
  hotbarAssignment,
  hotbarSwapReason,
  isHotbarSlot,
  isQuickHotbarId,
  type HotbarSlot,
} from './hotbar.ts';

/** Drag payloads contain references only, never gameplay objects. */
export type DragSource =
  | { dragType: 'skill'; refId: string }
  | { dragType: 'item'; refId: string; inventorySlot: number }
  | { dragType: 'hotbar-binding'; refId: string; hotbarSlot: HotbarSlot };
export type DropTarget =
  | { type: 'equipment'; slot: EquipSlot; expectedId: string | null }
  | { type: 'hotbar'; slot: HotbarSlot }
  | { type: 'inventory'; slot: number; expectedId: string | null }
  | { type: 'empty' }
  | { type: 'invalid' };
export type DropValidation = {
  ok: boolean;
  reason: string;
  operation?: 'assign' | 'swap' | 'move' | 'remove' | 'equip';
};

/** Slot references preserve gaps without changing the dense inventory used by combat/loot. */
export function getInventorySlots(
  hero: Pick<Hero, 'inventory' | 'inventoryCapacity' | 'inventoryLayout'>,
): Array<string | null> {
  const ids = new Set(hero.inventory.filter((item) => !item.isEquipped).map((item) => item.id));
  const slots: Array<string | null> = Array(
    Math.max(hero.inventoryCapacity, ids.size),
  ).fill(null);
  const placed = new Set<string>();
  if (Array.isArray(hero.inventoryLayout)) {
    hero.inventoryLayout.slice(0, slots.length).forEach((id, index) => {
      if (typeof id === 'string' && ids.has(id) && !placed.has(id)) {
        slots[index] = id;
        placed.add(id);
      }
    });
  }
  for (const item of hero.inventory.filter((entry) => !entry.isEquipped)) {
    if (!placed.has(item.id)) {
      slots[slots.indexOf(null)] = item.id;
      placed.add(item.id);
    }
  }
  return slots;
}

export function dragSourceReason(
  hero: Hero,
  source: DragSource,
): string | null {
  if (source.dragType === 'hotbar-binding') {
    return isHotbarSlot(source.hotbarSlot) &&
      hotbarAssignment(hero, source.hotbarSlot) === source.refId &&
      !!resolvePrimaryHotbarEntry(hero, source.refId)
      ? null
      : 'Shortcut sudah berubah. Ulangi drag dari slot terbaru.';
  }
  if (source.dragType === 'item') {
    const item = hero.inventory.find((item) => item.id === source.refId);
    if (!item || item.quantity <= 0)
      return 'Item sudah habis atau berpindah dari inventory.';
    if (getInventorySlots(hero)[source.inventorySlot] !== source.refId)
      return 'Slot inventory sudah berubah. Ulangi drag.';
    return null;
  }
  const entry = resolvePrimaryHotbarEntry(hero, source.refId);
  if (entry?.kind !== 'skill')
    return 'Passive tidak dapat dipasang di PrimaryHotbar.';
  return primaryHotbarAssignmentReason(hero, entry);
}

export function canDrop(
  hero: Hero,
  source: DragSource,
  target: DropTarget,
  hotbarEditMode = true,
): DropValidation {
  const invalid = (reason: string): DropValidation => ({ ok: false, reason });
  if (
    !hotbarEditMode &&
    (target.type === 'hotbar' || source.dragType === 'hotbar-binding')
  )
    return invalid('Klik tombol Edit Mode di hotbar untuk mengubah isinya.');
  const stale = dragSourceReason(hero, source);
  if (stale) return invalid(stale);
  if (target.type === 'equipment') {
    if (source.dragType !== 'item') return invalid('Hanya equipment dari inventory yang bisa dipasang.');
    if (!Object.hasOwn(hero.equipment, target.slot) || (hero.equipment[target.slot] ?? null) !== target.expectedId)
      return invalid('Slot equipment sudah berubah. Ulangi drag.');
    const preview = { ...hero, inventory: [...hero.inventory], equipment: { ...hero.equipment }, petRecords: { ...hero.petRecords } };
    const result = equipItem(preview, source.refId, target.slot);
    if (!result.ok) return invalid(result.reason);
    if (hero.equipment.offHand && !preview.equipment.offHand)
      return invalid('Gunakan tombol Equip untuk mengonfirmasi pelepasan Off Hand.');
    return { ok: true, operation: 'equip', reason: 'Pasang equipment' };
  }
  if (target.type === 'hotbar') {
    if (!isHotbarSlot(target.slot))
      return invalid('Slot PrimaryHotbar tidak valid.');
    if (source.dragType === 'hotbar-binding') {
      const reason = hotbarSwapReason(hero, source.hotbarSlot, target.slot);
      if (reason) return invalid(reason);
      return {
        ok: true,
        operation: 'swap',
        reason: hotbarAssignment(hero, target.slot)
          ? 'Tukar shortcut'
          : 'Pindahkan shortcut',
      };
    }
    const id =
      source.dragType === 'item'
        ? canonicalItemTemplateId(
            hero.inventory.find((item) => item.id === source.refId)!.templateId,
          )
        : source.refId;
    if (source.dragType === 'item') {
      const item = hero.inventory.find((item) => item.id === source.refId)!;
      if (
        item.isQuestItem ||
        item.isLocked ||
        !item.usableFromHotbar ||
        !item.useEffect
      )
        return invalid('Item ini tidak dapat digunakan dari PrimaryHotbar.');
    }
    const reason = primaryHotbarAssignmentReason(
      hero,
      resolvePrimaryHotbarEntry(hero, id),
      !isQuickHotbarId(target.slot),
    );
    if (reason) return invalid(reason);
    const assignment = isQuickHotbarId(target.slot)
      ? assignQuickHotbarSlot(hero, target.slot, id)
      : assignPrimaryHotbarSlot(hero, target.slot, id);
    if (!assignment.ok) return invalid(assignment.reason);
    return {
      ok: true,
      operation: 'assign',
      reason: hero.primaryHotbar.includes(id)
        ? 'Pindahkan / tukar shortcut yang sudah ada'
        : hotbarAssignment(hero, target.slot)
          ? 'Ganti shortcut'
          : 'Pasang shortcut',
    };
  }
  if (target.type === 'inventory' && source.dragType === 'item') {
    const slots = getInventorySlots(hero);
    if (
      !Number.isInteger(target.slot) ||
      target.slot < 0 ||
      target.slot >= slots.length ||
      slots[target.slot] !== target.expectedId
    )
      return invalid('Slot tujuan sudah berubah. Ulangi drag.');
    return {
      ok: true,
      operation: 'move',
      reason: target.expectedId ? 'Tukar posisi item' : 'Pindahkan item',
    };
  }
  if (target.type === 'empty' && source.dragType === 'hotbar-binding')
    return { ok: true, operation: 'remove', reason: 'Lepas shortcut saja' };
  return invalid('Tujuan tidak sesuai. Item / skill tetap di tempat asal.');
}

/** Every drop is revalidated against current authoritative state, then committed atomically. */
export function commitDrop(
  hero: Hero,
  source: DragSource,
  target: DropTarget,
  hotbarEditMode = true,
): DropValidation & { hero: Hero } {
  const validation = canDrop(hero, source, target, hotbarEditMode);
  if (!validation.ok) return { ...validation, hero };
  if (target.type === 'equipment' && source.dragType === 'item') {
    const next = { ...hero, inventory: [...hero.inventory], equipment: { ...hero.equipment }, petRecords: { ...hero.petRecords } };
    const result = equipItem(next, source.refId, target.slot);
    return { ...validation, ...result, hero: result.ok ? next : hero };
  }
  if (target.type === 'hotbar') {
    if (source.dragType === 'hotbar-binding')
      return {
        ...validation,
        hero: swapHotbarEntries(hero, source.hotbarSlot, target.slot),
      };
    return {
      ...validation,
      ...(isQuickHotbarId(target.slot)
        ? assignQuickHotbarSlot(hero, target.slot, source.refId)
        : assignPrimaryHotbarSlot(hero, target.slot, source.refId)),
    };
  }
  if (target.type === 'inventory' && source.dragType === 'item') {
    const inventoryLayout = getInventorySlots(hero);
    [inventoryLayout[source.inventorySlot], inventoryLayout[target.slot]] = [
      inventoryLayout[target.slot],
      inventoryLayout[source.inventorySlot],
    ];
    return { ...validation, hero: { ...hero, inventoryLayout } };
  }
  if (target.type === 'empty' && source.dragType === 'hotbar-binding')
    return {
      ...validation,
      hero: isQuickHotbarId(source.hotbarSlot)
        ? removeQuickHotbarSlot(hero, source.hotbarSlot)
        : removePrimaryHotbarSlot(hero, source.hotbarSlot),
    };
  return { ok: false, reason: 'Tujuan tidak sesuai.', hero };
}
