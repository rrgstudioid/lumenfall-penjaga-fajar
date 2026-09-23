import type { ItemData } from './items.ts';
import type { WeaponType } from './skills.ts';
const warriorStyles = new Set<WeaponType>([
  'one_hand_sword',
  'two_hand_sword',
  'greatsword',
  'dual_sword',
  'shield',
  'dagger', 'dual_dagger',
]);

/** Off-hand dagger is the existing slot-specific identity of a one-hand dagger. */
export const isOneHandDagger = (item: ItemData | null) => !!item && !item.twoHanded && (
  item.equipmentType === 'dagger' && item.handedness === 'one_hand' ||
  item.equipmentType === 'off_hand_dagger' && item.handedness === 'off_hand'
);

export const canonicalWeaponStyle = (style: WeaponType): WeaponType =>
  style === 'two_hand_sword' ? 'greatsword' : style;

/** Player-facing text for internal weapon requirement/style identifiers. */
export const weaponRequirementLabel = (style: WeaponType): string =>
  style === 'dual_sword' ? 'Dual One-Hand Swords' : style;

export function resolveWeaponStyle(
  main: ItemData | null,
  off: ItemData | null,
): WeaponType {
  if (!main) return 'none';
  if (main.equipmentType==='dagger' && isOneHandDagger(main))
    return isOneHandDagger(off) && off!.id!==main.id ? 'dual_dagger' : 'dagger';
  if (main.equipmentType === 'two_hand_sword') return 'greatsword';
  if (
    main.equipmentType === 'one_hand_sword' &&
    main.handedness === 'one_hand' &&
    !main.twoHanded
  ) {
    if (
      off &&
      off.id !== main.id &&
      off.equipmentType === 'one_hand_sword' &&
      off.handedness === 'one_hand' &&
      !off.twoHanded
    )
      return 'dual_sword';
    return 'one_hand_sword';
  }
  return main.weaponType && !warriorStyles.has(main.weaponType)
    ? main.weaponType
    : 'none';
}
/** Requirements are OR alternatives. Legacy labels remain available alongside actual equipment styles. */
export function meetsWeaponRequirement(
  requirements: readonly WeaponType[],
  main: ItemData | null,
  off: ItemData | null,
  legacy: WeaponType,
) {
  const styles = new Set<WeaponType>([resolveWeaponStyle(main, off)]);
  if(main?.equipmentType==='dagger'&&isOneHandDagger(main))styles.add('dagger');
  if (
    main?.equipmentType === 'one_hand_sword' &&
    main.handedness === 'one_hand' &&
    !main.twoHanded
  )
    styles.add('one_hand_sword');
  if (
    main &&
    !main.twoHanded &&
    main.handedness === 'one_hand' &&
    off?.equipmentType === 'shield' &&
    off.id !== main.id
  )
    styles.add('shield');
  return (
    requirements.length === 0 ||
    requirements.some((id) =>
      warriorStyles.has(id)
        ? styles.has(canonicalWeaponStyle(id))
        : id === legacy,
    )
  );
}
