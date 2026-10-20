'use client';
import {approvedQuestsEnabled} from '@/lib/game/public-rollout';
import { useEffect, useState, type CSSProperties } from 'react';
import { RARITY_META, type ItemRarity } from '@/lib/game/items';
import { FALLBACK_ITEM_ICON, getItemIconPath, reportMissingItemIcon } from '@/lib/game/item-icons';
import {ScrollText} from 'lucide-react';
import {mapScroll} from '@/lib/game/map-scroll-contract';

export type ItemArtworkSource = { templateId: string; rarity?: ItemRarity };

/** Presentation only: quantities, ownership and rarity stay in the caller's state. */
export function ItemArtwork({ item, className = '' }: {
  item: ItemArtworkSource;
  className?: string;
}) {
  const path = getItemIconPath(item.templateId);
  const scroll = approvedQuestsEnabled() && !!mapScroll(item.templateId);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  useEffect(() => {
    if (!scroll && path === FALLBACK_ITEM_ICON) reportMissingItemIcon(item.templateId, path);
  }, [item.templateId, path, scroll]);
  return (
    <span
      className={`item-artwork ${item.rarity ? `rarity-${item.rarity}` : ''} ${className}`}
      style={item.rarity ? { '--rarity-color': RARITY_META[item.rarity]?.color } as CSSProperties : undefined}
      data-item-icon={item.templateId}
      data-asset-ref={scroll?'existing-lucide:ScrollText':path}
      aria-hidden="true"
    >
      {/* Pre-optimized 256px WebP game assets; direct URLs also support the static host and error fallback. */}
      {/* oxlint-disable-next-line next/no-img-element */}
      {scroll?<ScrollText width="70%" height="70%" style={{margin:'15%',color:'#e5c77c'}}/>:<img
        src={failedPath === path ? FALLBACK_ITEM_ICON : path}
        alt=""
        width={256}
        height={256}
        draggable={false}
        decoding="async"
        onError={() => {
          reportMissingItemIcon(item.templateId, path);
          if (failedPath !== path) setFailedPath(path);
        }}
      />}
    </span>
  );
}
