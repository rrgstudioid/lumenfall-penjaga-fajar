import type { EquipSlot, ItemData, StatBlock } from './items.ts';

export const DRAGON_VEIL_SLOTS = ['head', 'chest', 'legs', 'boots'] as const;
export type DragonVeilSlot = (typeof DRAGON_VEIL_SLOTS)[number];
export const DRAGON_VEIL_PIECES: ReadonlyArray<{
  id: string;
  name: string;
  slot: DragonVeilSlot;
  piece: string;
  stats: StatBlock;
}> = [
  {
    id: 'dragon-veil-head',
    name: 'Dragon Veil Head',
    slot: 'head',
    piece: 'head',
    stats: {
      hp: 2000,
      defense: 250,
      magicDefense: 350,
      int: 100,
      maxMana: 1500,
      critRate: 25,
      critDamage: 100,
      cooldownReduction: 15,
    },
  },
  {
    id: 'dragon-veil-armor',
    name: 'Dragon Veil Armor',
    slot: 'chest',
    piece: 'armor',
    stats: {
      hp: 6000,
      defense: 750,
      magicDefense: 750,
      str: 200,
      vit: 200,
      attack: 1500,
      magicAttack: 1500,
      damageReduction: 25,
      bossDamage: 40,
    },
  },
  {
    id: 'dragon-veil-legs',
    name: 'Dragon Veil Legs',
    slot: 'legs',
    piece: 'legs',
    stats: {
      hp: 3000,
      defense: 400,
      magicDefense: 300,
      dex: 100,
      vit: 100,
      accuracy: 100,
      skillDamage: 45,
      cooldownReduction: 15,
    },
  },
  {
    id: 'dragon-veil-boots',
    name: 'Dragon Veil Boots',
    slot: 'boots',
    piece: 'boots',
    stats: {
      hp: 1000,
      defense: 200,
      magicDefense: 200,
      dex: 100,
      attackSpeed: 50,
      movementSpeed: 35,
      hpRecovery: 100,
      mpRecovery: 20,
    },
  },
];
/** Earlier saves called the Legs template Pants. Keep that identity readable. */
export const canonicalDragonVeilTemplateId = (id: string) =>
  id === 'dragon-veil-pants' ? 'dragon-veil-legs' : id;

export type DragonVeilItemIdentity = {
  templateId: string;
  name?: string;
  category?: string;
  equipSlot?: string | null;
  itemType?: string;
};

export function resolveDragonVeilTemplateId(
  item: DragonVeilItemIdentity,
): string {
  const id = canonicalDragonVeilTemplateId(item.templateId);
  if (DRAGON_VEIL_PIECES.some((p) => p.id === id)) return id;
  // Recover the specifically reported legacy name even if an older save used
  // an instance-derived template ID. Do not infer other items by partial names.
  if (
    item.name?.trim().toLowerCase() === 'dragon veil pants' &&
    item.category === 'armor' &&
    (item.equipSlot === 'legs' ||
      item.itemType === 'legs' ||
      item.itemType === 'pants')
  )
    return 'dragon-veil-legs';
  return id;
}

export const isDragonVeil = (id: string) =>
  DRAGON_VEIL_PIECES.some((p) => p.id === canonicalDragonVeilTemplateId(id));
export type DragonVeilLoadout = Partial<Record<DragonVeilSlot, string>>;
export type DragonVeilEnhancements = Partial<Record<DragonVeilSlot, number>>;
export function dragonVeilLoadout(
  layers: ReadonlyArray<{ slot: EquipSlot; item: ItemData }>,
): DragonVeilLoadout {
  return Object.fromEntries(
    layers
      .filter((l) =>
        DRAGON_VEIL_PIECES.some(
          (p) =>
            p.id === resolveDragonVeilTemplateId(l.item) && p.slot === l.slot,
        ),
      )
      .map((l) => [l.slot, resolveDragonVeilTemplateId(l.item)]),
  );
}
export const DRAGON_VEIL_ROOT = '/assets/equipment/dragon-veil/';
export const DRAGON_VEIL_REVISION = '2';
