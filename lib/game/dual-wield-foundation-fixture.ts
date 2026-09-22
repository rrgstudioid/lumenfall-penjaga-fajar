import { createItem } from './items.ts';
import { aggregateEquipmentStatOnce, resolveUniqueEffects, resolveWeaponAttackContext } from './dual-wield.ts';

export class DualWieldFoundationFixture {
  run() {
    const main = createItem('legacy-fajar-blade', { id: 'fixture-main', baseStats: { attack: 100 }, bonusStats: { str: 8, critRate: 2 }, uniqueEffectData: { id: 'effect-x', magnitude: 10, priority: 0, stackable: false } });
    const off = createItem('legacy-fajar-blade', { id: 'fixture-off', baseStats: { attack: 70 }, bonusStats: { str: 7, critRate: 3 }, uniqueEffectData: { id: 'effect-x', magnitude: 6, priority: 0, stackable: false } });
    const stats = aggregateEquipmentStatOnce(main, off);
    const single = resolveWeaponAttackContext(main, off, 'SINGLE_MAIN', 200);
    const combined = resolveWeaponAttackContext(main, off, 'DUAL_COMBINED', 200);
    const effects = resolveUniqueEffects(main, off);
    return {
      status: 'PASS', worldImported: false, mapLoaded: false,
      mainHandWeaponLayer: single.mainHandWeaponAttack,
      offHandWeaponLayer: single.offHandWeaponAttack,
      singleMainRawWeaponAttack: single.totalWeaponAttack,
      dualCombinedRawWeaponAttack: combined.totalWeaponAttack,
      sharedPhysicalCore: combined.sharedPhysicalCore,
      equipmentSTR: stats.str ?? 0,
      equipmentCritRate: stats.critRate ?? 0,
      activeUniqueEffects: effects,
      noOffhandPenaltyField: true,
    };
  }
}
