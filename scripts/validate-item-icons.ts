import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_CATALOG, POTION_ALIASES } from '../lib/game/items.ts';
import { ITEM_ICON_MANIFEST, getItemIconPath, FALLBACK_ITEM_ICON } from '../lib/game/item-icons.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors: string[] = [];
const paths = new Set<string>();
let valid = 0;
for (const [id, item] of Object.entries(ITEM_CATALOG)) {
  const path = getItemIconPath(id);
  const expected = Object.hasOwn(ITEM_ICON_MANIFEST, id) ? path : `/assets/icons/items/${id}.webp`;
  const fail = (reason: string) => errors.push(`${id} | ${item.name} | ${expected} | ${reason}`);
  if (!Object.hasOwn(ITEM_ICON_MANIFEST, id)) { fail('Missing canonical mapping'); continue; }
  if (paths.has(path)) fail('Another item uses this artwork path');
  paths.add(path);
  const local = resolve(root, `public${path}`);
  if (!existsSync(local)) { fail('Asset missing'); continue; }
  const bytes = readFileSync(local);
  const isWebP = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (!isWebP && !isPng) { fail('Invalid image asset'); continue; }
  valid++;
}
for (const id of Object.keys(ITEM_ICON_MANIFEST)) {
  if (!Object.hasOwn(ITEM_CATALOG, id)) errors.push(`Unknown catalog ID in manifest: ${id}`);
}
for (const [alias, id] of Object.entries(POTION_ALIASES)) {
  if (getItemIconPath(alias) !== getItemIconPath(id)) errors.push(`Legacy alias failed: ${alias}`);
}
if (getItemIconPath('unknown-future-item') !== FALLBACK_ITEM_ICON || !existsSync(resolve(root, `public${FALLBACK_ITEM_ICON}`))) errors.push('Safe fallback missing');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
console.log(`${valid}/${Object.keys(ITEM_CATALOG).length} item templates have valid individual icons. ${errors.length} errors.`);
