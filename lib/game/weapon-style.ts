import type { ItemData } from './items.ts';
import type { WeaponType } from './skills.ts';
import { isOneHandDagger, resolveDaggerEquipment, type DaggerOwner } from './dagger.ts';
export { isOneHandDagger } from './dagger.ts';
const warriorStyles = new Set<WeaponType>([
  'one_hand_sword',
  'two_hand_sword',
  'greatsword',
  'dual_sword',
  'shield',
  'dagger', 'dual_dagger',
]);

export const canonicalWeaponStyle = (style: WeaponType): WeaponType =>
  style === 'two_hand_sword' ? 'greatsword' : style;

/** Player-facing text for internal weapon requirement/style identifiers. */
export const weaponRequirementLabel = (style: WeaponType): string =>
  style === 'dual_sword' ? 'Dual One-Hand Swords' : style === 'dual_dagger' ? 'Dual Daggers' : style === 'dagger' ? 'Dagger' : style;

export function resolveWeaponStyle(
  main: ItemData | null,
  off: ItemData | null,
  owner?: DaggerOwner,
): WeaponType {
  if (isOneHandDagger(main) || isOneHandDagger(off)) {
    // Dagger access requires an owner; a saved weapon-style string cannot grant it.
    const dagger = resolveDaggerEquipment(owner ?? {}, main, off);
    if (dagger.state === 'DUAL_DAGGER') return 'dual_dagger';
    if (dagger.state === 'MAIN_DAGGER' || dagger.state === 'OFF_DAGGER') return 'dagger';
    if (isOneHandDagger(main)) return 'none';
  }
  if (!main) return 'none';
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
  owner?: DaggerOwner,
) {
  const styles = new Set<WeaponType>([resolveWeaponStyle(main, off, owner)]);
  const daggers = resolveDaggerEquipment(owner ?? {}, main, off);
  if(daggers.main || daggers.off)styles.add('dagger');
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
