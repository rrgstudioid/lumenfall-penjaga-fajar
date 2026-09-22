import {
  Heart,
  Plus,
  Sparkles,
  Sword,
} from 'lucide-react';
import type { HotbarEntry } from '@/lib/game/hotbar';
import { ItemArtwork, type ItemArtworkSource } from './item-artwork';
import { SkillIcon } from './skill-icon';

export function ItemIcon({
  item,
  className,
}: {
  item: ItemArtworkSource;
  className?: string;
}) {
  return <ItemArtwork item={item} className={className} />;
}

export function EntryIcon({ entry }: { entry: HotbarEntry | null }) {
  if (!entry) return <Plus aria-hidden="true" />;
  if (entry.skill) return <SkillIcon id={entry.id} />;
  if (entry.item) return <ItemIcon item={entry.item} />;
  const Icon =
    entry.id === 'basic-attack'
      ? Sword
      : entry.id === 'rest'
        ? Heart
        : Sparkles;
  return <Icon aria-hidden="true" />;
}
