import { canonicalItemTemplateId } from './items.ts';
import { ITEM_ICON_MANIFEST } from './item-icon-manifest.ts';

export { ITEM_ICON_MANIFEST };
export const FALLBACK_ITEM_ICON = '/assets/icons/items/unknown-item.svg';

/** Accept the catalog/template ID, never a unique inventory instance ID or display name. */
export function getItemIconPath(templateId: string): string {
  const id = canonicalItemTemplateId(templateId);
  return Object.hasOwn(ITEM_ICON_MANIFEST, id)
    ? ITEM_ICON_MANIFEST[id]
    : FALLBACK_ITEM_ICON;
}

const reported = new Set<string>();
export function reportMissingItemIcon(templateId: string, path: string) {
  if (process.env.NODE_ENV !== 'production' && !reported.has(templateId)) {
    reported.add(templateId);
    console.warn(`[Lumenfall] Missing item icon: ${templateId} (${path})`);
  }
}
