/** OWNER-approved public restoration of the original Dragon Veil visuals. */
import {DRAGON_VEIL_PIECES,canonicalDragonVeilTemplateId,resolveDragonVeilTemplateId,type DragonVeilItemIdentity} from './dragon-veil.ts';
export {DRAGON_VEIL_PIECES} from './dragon-veil.ts';
export const DRAGON_VEIL_ROOT = '/assets/equipment/dragon-veil/';
export const DRAGON_VEIL_REVISION = 'original-b229218-v2';
export type DragonVeilSlot = typeof DRAGON_VEIL_PIECES[number]['slot'];
export type DragonVeilLoadout = Partial<Record<DragonVeilSlot,string>>;
export const dragonVeilVisualEnabled = () => true;
export function dragonVeilVisualId(id:string) {
  return canonicalDragonVeilTemplateId(id);
}
export function dragonVeilVisualIcon(id:string):string|null {
  if(!dragonVeilVisualEnabled())return null;
  const piece=DRAGON_VEIL_PIECES.find(p=>p.id===dragonVeilVisualId(id));
  return piece?`/assets/icons/items/${piece.id}.webp`:null;
}
export function dragonVeilLoadout(layers:ReadonlyArray<{slot:string;item:DragonVeilItemIdentity}>):DragonVeilLoadout {
  if(!dragonVeilVisualEnabled())return {};
  return Object.fromEntries(layers.filter(l=>DRAGON_VEIL_PIECES.some(p=>p.slot===l.slot&&p.id===resolveDragonVeilTemplateId(l.item)))
    .map(l=>[l.slot,resolveDragonVeilTemplateId(l.item)]));
}
