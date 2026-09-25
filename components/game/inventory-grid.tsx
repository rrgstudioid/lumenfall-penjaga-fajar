'use client';
import type { Hero } from '@/lib/game/rules';
import type { ItemData } from '@/lib/game/items';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { presentJobText } from '@/lib/game/job-presentation';
import {
  filterInventory,
  sortInventory,
  RARITY_META,
  type InventoryFilter,
  type InventorySort,
} from '@/lib/game/items';
import { getInventorySlots } from '@/lib/game/drag-drop';
import { useGameDrag } from './drag-drop-provider';
import { ItemIcon } from './entry-icon';

export function InventoryGrid({
  hero,
  filter,
  sort,
  selectedId,
  onSelect,
  onHover,
  renderActions,
}: {
  hero: Hero;
  filter: InventoryFilter;
  sort: InventorySort;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHover?: (id: string, position: { x: number; y: number } | null) => void;
  renderActions?: (item: ItemData, point: { x: number; y: number }) => ReactNode;
}) {
  const { begin } = useGameDrag();
  const [actionPoint, setActionPoint] = useState<{ x: number; y: number } | null>(null);
  const slots = getInventorySlots(hero);
  const byId = new Map(hero.inventory.filter((item) => !item.isEquipped).map((item) => [item.id, item]));
  const manual = sort === 'manual';
  const displayed = sortInventory(
    filterInventory(hero.inventory.filter((item) => !item.isEquipped), filter),
    sort === 'manual' ? 'combined' : sort,
  );
  const visibleItems = manual
    ? slots.map((id) => (id ? byId.get(id) : undefined))
    : displayed;
  return (
    <>
      <div className="inventory-grid" aria-label="Grid inventory">
        {Array.from({ length: slots.length }, (_, index) => {
          const item = visibleItems[index];
          return (
            <div className="inventory-slot-wrap" key={index}>
            <button
              type="button"
              data-drag-source={item ? 'item' : undefined}
              data-inventory-index={index}
              data-drop-type="inventory"
              data-drop-slot={index}
              // Drop validation uses the persisted slot occupant, even while
              // Sort is showing a temporary reordered view.
              data-drop-item={slots[index] ?? ''}
              data-item-id={item?.id}
              data-window-no-drag
              className={`inventory-slot ${item ? `rarity-${item.rarity}` : 'empty'} ${selectedId === item?.id ? 'selected' : ''}`}
              onPointerEnter={(event) => item && onHover?.(item.id, { x: event.clientX, y: event.clientY })}
              onPointerMove={(event) => item && onHover?.(item.id, { x: event.clientX, y: event.clientY })}
              onPointerLeave={() => onHover?.('', null)}
              onPointerDown={(event) =>
                item &&
                begin(event, {
                  dragType: 'item',
                  refId: item.id,
                  inventorySlot: slots.indexOf(item.id),
                })
              }
              onClick={(event) => {
                if (!item) return;
                if (selectedId === item.id) {
                  setActionPoint(null);
                  onSelect(null);
                  onHover?.('', null);
                  return;
                }
                onHover?.('', null);
                setActionPoint({ x: event.clientX, y: event.clientY });
                onSelect(item.id);
              }}
              aria-label={
                item
                  ? `${presentJobText(hero, item.name)}, ${RARITY_META[item.rarity].label}, ${item.quantity}`
                  : `Slot kosong ${index + 1}`
              }
            >
              {item ? (
                <>
                  <span className="inventory-icon">
                    <ItemIcon item={item} />
                  </span>
                  <small>
                    {item.stackable || item.quantity > 1
                      ? item.quantity
                      : item.enhancementLevel > 0
                        ? `+${item.enhancementLevel}`
                        : ''}
                  </small>
                </>
              ) : (
                <span className="slot-index">{index + 1}</span>
              )}
            </button>
            {item && selectedId === item.id && actionPoint && typeof document !== 'undefined'
              ? createPortal(renderActions?.(item, actionPoint), document.body)
              : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
