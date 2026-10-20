'use client';
import { JobText, useJobText } from './job-presentation-context';
import { statBonusText } from '@/lib/game/stat-presentation';

import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RARITY_META, type ItemData } from '@/lib/game/items';
import { ItemIcon } from './entry-icon';
import type { Game } from '@/lib/game/world';
import { EquipmentDetail, ItemRangeContext, readEquipmentDetail } from './equipment-detail';
export { ItemRangeContext };
/** Text compatibility for existing read-only callers, from the same DTO. */
export function equipmentPresentation(item: HoverItem, game: Game | null, baseOnly=false) {
 const d=readEquipmentDetail(item,game);
 return [...d.metadata,...d.core.map(r=>r.label+': '+r.value),...d.intrinsic.map(r=>r.label+' '+r.value),...d.uncertain.map(r=>r.label+' '+r.value),...(!baseOnly?d.options.map(r=>r.label+' '+r.value):[]),...d.notes].join(' · ');
}
export function SelectedItemBaseStats({item,game}:{item:ItemData;game:Game|null}) { return <EquipmentDetail item={item} game={game} compact/>; }

// Accept shop templates as well as actual owned instances. Never manufacture
// an inventory item just to show a tooltip (which could roll new random stats).
type HoverItem = Omit<ItemData, 'id' | 'quantity'> & Partial<Pick<ItemData, 'id' | 'quantity'>>;
type Point = { x: number; y: number };

export function ItemHoverTooltip({ item, point, buyPrice, game, children, onPointerEnter, onPointerLeave }: { item: HoverItem; point: Point; buyPrice?: number; game?:Game|null; children?:ReactNode; onPointerEnter?:()=>void; onPointerLeave?:()=>void }) {
  const text = useJobText();
  const popup = useRef<HTMLDivElement>(null);
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
    <div ref={popup} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} className={`floating-item-tooltip npc-item-tooltip rarity-${item.rarity}`} role="tooltip" aria-label={`Detail ${text(item.name)}`}>
      <div className="floating-item-title">
        <ItemIcon item={item} className="item-symbol" />
        <div>
          <strong style={{ color: RARITY_META[item.rarity].color }}><JobText>{item.name}</JobText>{item.enhancementLevel > 0 ? ` +${item.enhancementLevel}` : ''}</strong>
          <small>{RARITY_META[item.rarity].label} · {item.category}</small>
        </div>
      </div>

      <div className="floating-item-group">
        {equipment ? <EquipmentDetail item={item} game={game} compact/> : <p><JobText>{item.description}</JobText></p>}
      </div>

      {item.category === 'rune' && <div className="floating-item-group npc-item-tooltip-stats">
        {item.affixes.map(affix => <p key={affix.id}>{statBonusText(affix.stat, affix.value)}</p>)}
        {item.uniqueEffect && <p><JobText>{item.uniqueEffect}</JobText></p>}
        {item.runeJobRequirement && <small>Khusus job: <JobText>{item.runeJobRequirement}</JobText></small>}
      </div>}

      <div className="floating-item-group floating-item-meta-block">
        {children}
        {equipment && <small>Harga jual: {item.sellValue.toLocaleString()} GOLD / item</small>}
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keep = () => {if(hideTimer.current)clearTimeout(hideTimer.current);};
  const leave = () => {keep();hideTimer.current=setTimeout(()=>setPoint(null),180);};
  useEffect(()=>()=>{if(hideTimer.current)clearTimeout(hideTimer.current);},[]);
  const isOpen = Boolean(point);
  useEffect(() => {
    if (!isOpen) return;
    const hide = (event?: Event) => {if(event?.target instanceof Element && event.target.closest('.floating-item-tooltip'))return;setPoint(null);};
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
  const HoverElement = as;
  return <>
    <HoverElement {...props} data-item-hover={item?.templateId}
      onPointerEnter={(event: PointerEvent<HTMLElement>) => { keep(); props.onPointerEnter?.(event); follow(event); }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => { props.onPointerMove?.(event); follow(event); }}
      onPointerLeave={(event: PointerEvent<HTMLElement>) => { props.onPointerLeave?.(event); leave(); }}
      onPointerCancel={(event: PointerEvent<HTMLElement>) => { props.onPointerCancel?.(event); setPoint(null); }}
    >{children}</HoverElement>
    {item && point && <ItemHoverTooltip item={item} point={point} buyPrice={buyPrice} onPointerEnter={keep} onPointerLeave={leave}/>}
  </>;
}


