'use client';
import { JobText, useJobText } from './job-presentation-context';

import { createElement, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { equipmentUsageDescription, RARITY_META, type ItemData } from '@/lib/game/items';
import { ItemIcon } from './entry-icon';

// Accept shop templates as well as actual owned instances. Never manufacture
// an inventory item just to show a tooltip (which could roll new random stats).
type HoverItem = Omit<ItemData, 'id' | 'quantity'> & Partial<Pick<ItemData, 'id' | 'quantity'>>;
type Point = { x: number; y: number };

function equipmentTooltipSections(item: HoverItem) {
  const lines = equipmentUsageDescription({ ...item, bonusStats: {} }).split(' · ');
  const isMetadata = (line: string) => /^(Level|Jenis|Slot|Syarat|Harga jual):/.test(line);
  return {
    metadata: lines.filter(line => /^(Level|Jenis|Slot):/.test(line)),
    requirement: lines.find(line => line.startsWith('Syarat:')),
    stats: lines.filter(line => !isMetadata(line)),
    price: lines.find(line => line.startsWith('Harga jual:')),
  };
}

function uniqueStatLines(item: HoverItem) {
  if (item.uniqueStatsLocked || !Object.keys(item.bonusStats).length) return [];
  return equipmentUsageDescription({ ...item, baseStats: {}, bonusStats: item.bonusStats })
    .split(' · ')
    .filter(line => !/^(Syarat|Level|Jenis|Slot|Harga jual):/.test(line));
}

function ItemHoverTooltip({ item, point, buyPrice }: { item: HoverItem; point: Point; buyPrice?: number }) {
  const text = useJobText();
  const popup = useRef<HTMLDivElement>(null);
  const equipmentSections = ['weapon', 'armor', 'accessory'].includes(item.category)
    ? equipmentTooltipSections(item)
    : null;
  const uniqueStats = equipmentSections ? uniqueStatLines(item) : [];
  const showUnmagnified = item.uniqueStatsLocked || uniqueStats.length === 0;
  useLayoutEffect(() => {
    const element = popup.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    const margin = 8, gap = 14;
    const left = Math.max(margin, Math.min(point.x + gap, window.innerWidth - width - margin));
    // Prefer above the pointer; flip below it when there is no room above.
    const preferredTop = point.y - height - gap;
    const top = Math.max(margin, Math.min(preferredTop >= margin ? preferredTop : point.y + gap, window.innerHeight - height - margin));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  }, [point, item, buyPrice]);

  const equipment = ['weapon', 'armor', 'accessory'].includes(item.category);
  return createPortal(
    <div ref={popup} className={`floating-item-tooltip npc-item-tooltip rarity-${item.rarity}`} role="tooltip" aria-label={`Detail ${text(item.name)}`}>
      <div className="floating-item-title">
        <ItemIcon item={item} className="item-symbol" />
        <div>
          <strong style={{ color: RARITY_META[item.rarity].color }}><JobText>{item.name}</JobText>{item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}</strong>
          <small>{RARITY_META[item.rarity].label} · {item.category}</small>
        </div>
      </div>

      <div className="floating-item-group">
        {equipmentSections ? (
          <>
            <div className="floating-item-equipment-meta">
              {equipmentSections.metadata.map(line => <small key={line} className="floating-item-detail-line"><JobText>{line}</JobText></small>)}
              {equipmentSections.requirement && <small className="floating-item-detail-line"><JobText>{equipmentSections.requirement}</JobText></small>}
            </div>
            <div className="floating-item-equipment-stats">
              {equipmentSections.stats.map(line => <small key={line} className="floating-item-detail-line floating-item-stat-line"><JobText>{line}</JobText></small>)}
            </div>
            <div className="floating-item-unique-stats">
              <small className="floating-item-unique-label">Unique status</small>
              {showUnmagnified
                ? <small className="floating-item-unmagnified">Unmagnified</small>
                : uniqueStats.map(line => <small key={line} className="floating-item-detail-line floating-item-stat-line"><JobText>{line}</JobText></small>)}
            </div>
          </>
        ) : (
          <p><JobText>{item.description}</JobText></p>
        )}
      </div>

      {item.category === 'rune' && <div className="floating-item-group npc-item-tooltip-stats">
        {item.affixes.map(affix => <p key={affix.id}>{affix.label} +{affix.value}{affix.unit === 'percent' ? '%' : ''}</p>)}
        {item.uniqueEffect && <p><JobText>{item.uniqueEffect}</JobText></p>}
        {item.runeJobRequirement && <small>Khusus job: <JobText>{item.runeJobRequirement}</JobText></small>}
      </div>}

      <div className="floating-item-group floating-item-meta-block">
        {equipment && <small>Socket: <JobText>{item.sockets.length ? item.sockets.map(socket => socket.rune?.name ?? 'Kosong').join(' · ') : 'Tidak memiliki socket'}</JobText></small>}
        {equipmentSections?.price && <small className="floating-item-price-line"><JobText>{equipmentSections.price}</JobText></small>}
        {buyPrice !== undefined && <small>Harga beli: {buyPrice.toLocaleString()} GOLD / item</small>}
        {!equipment && <small>Harga jual: {item.sellValue.toLocaleString()} GOLD / item</small>}
        {item.quantity !== undefined && <small>Jumlah: {item.quantity}</small>}
        {item.isLocked && <small>Item terkunci</small>}
        {item.isSoulbound && <small>Terikat karakter</small>}
      </div>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}

/** Reuses the existing row element; hover is read-only and never selects or trades. */
export function ItemHover({ as = 'span', item, buyPrice, children, ...props }: {
  as?: 'span' | 'div' | 'article' | 'section' | 'button' | 'label';
  item?: HoverItem | null;
  buyPrice?: number;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLElement>) {
  const [point, setPoint] = useState<Point | null>(null);
  const isOpen = Boolean(point);
  useEffect(() => {
    if (!isOpen) return;
    const hide = () => setPoint(null);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);
    window.addEventListener('keydown', key, true);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('resize', hide);
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [isOpen]);

  const follow = (event: PointerEvent<HTMLElement>) => {
    // Touch continues to use the existing click flow; dragging doesn't spawn tooltips.
    if (event.pointerType === 'touch' || event.buttons || !item) return;
    // A nested material target owns its own tooltip instead of the recipe's.
    if ((event.target as Element).closest('[data-item-hover]') !== event.currentTarget) {
      setPoint(null);
      return;
    }
    setPoint({ x: event.clientX, y: event.clientY });
  };
  return <>
    {createElement(as, {
      ...props,
      'data-item-hover': item?.templateId,
      onPointerEnter: (event: PointerEvent<HTMLElement>) => { props.onPointerEnter?.(event); follow(event); },
      onPointerMove: (event: PointerEvent<HTMLElement>) => { props.onPointerMove?.(event); follow(event); },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => { props.onPointerLeave?.(event); setPoint(null); },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => { props.onPointerCancel?.(event); setPoint(null); },
    }, children)}
    {item && point && <ItemHoverTooltip item={item} point={point} buyPrice={buyPrice} />}
  </>;
}


