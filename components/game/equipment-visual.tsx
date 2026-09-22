import { ItemArtwork, type ItemArtworkSource } from './item-artwork';

/** Existing Equipment API uses the same canonical art as all other item surfaces. */
export function EquipmentVisual({ item, className = '' }: {
  item: ItemArtworkSource;
  className?: string;
}) {
  return <ItemArtwork item={item} className={`equipment-visual ${className}`} />;
}
