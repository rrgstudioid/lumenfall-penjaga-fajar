'use client';
import { previewEquipmentChange } from '@/lib/game/character-view';
import { previewStatCombatPower } from '@/lib/game/combat-power';
import { characterNumber as fmt, PAPER_DOLL_SLOTS, type PrimaryAttribute } from '@/lib/game/character-screen';
import type { Hero } from '@/lib/game/rules';
import type { ItemData } from '@/lib/game/items';

export function CombatPowerComparison({ comparison }: {
  comparison: ReturnType<typeof previewEquipmentChange>['combatPower'];
}) {
  if (!comparison) return null;
  return <div className="combat-power-comparison" aria-label="Combat Power preview">
    <span>Current CP <b>{fmt(comparison.before.total)}</b></span>
    <span>After Equip <b>{fmt(comparison.after.total)}</b></span>
    <strong data-delta={Math.sign(comparison.delta)}>
      {comparison.delta > 0 ? '▲' : comparison.delta < 0 ? '▼' : '—'}{fmt(Math.abs(comparison.delta))}
    </strong>
  </div>;
}
export function InventoryCombatPowerPreview({ hero, item }: { hero: Hero; item: ItemData }) {
  if (!item.equipSlot || !['weapon', 'armor', 'accessory', 'pet'].includes(item.category)) return null;
  const preview = previewEquipmentChange(hero, item, item.equipSlot);
  return preview.validation.ok ? <>
    <small className="combat-power-preview-note">Preview: {PAPER_DOLL_SLOTS.find(s => s.id === item.equipSlot)?.label ?? item.equipSlot} · belum dipasang</small>
    <CombatPowerComparison comparison={preview.combatPower} />
  </> : <small>{preview.validation.reason}</small>;
}
export function AttributeCombatPowerPreview({ hero, attribute }: { hero: Hero; attribute: PrimaryAttribute }) {
  const preview = previewStatCombatPower(hero, { [attribute]: (hero.allocatedStats[attribute] ?? 0) + 1 });
  return <p>Combat Power: {fmt(preview.before.total)} → {fmt(preview.after.total)} ({preview.delta > 0 ? '+' : ''}{fmt(preview.delta)})</p>;
}
