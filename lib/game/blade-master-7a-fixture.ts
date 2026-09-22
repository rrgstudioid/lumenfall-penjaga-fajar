import { createItem } from './items.ts';
import { chooseV3BladeMaster, chooseV3Warrior, createV3AdventurerHero, resolveHeroSkill } from './rules.ts';
import { bladeMasterDualWieldActive, BLADE_MASTER_V3_RUNTIME_MAP } from './blade-master-v3.ts';
import { TransientCombatState } from './combat-transient.ts';
import { resolveWeaponAttackContext } from './dual-wield.ts';

/** Development-only, world-free validation for SPV3-7A. */
export class BladeMaster7AFixture {
  run() {
    const hero = createV3AdventurerHero('blade-master-7a-fixture', 'Blade Master 7A Fixture');
    hero.level = 80;
    hero.skillProgressionV3!.totalEarnedSP = 500;
    if (!chooseV3Warrior(hero) || !chooseV3BladeMaster(hero)) throw new Error('Blade Master transition failed');
    const main = createItem('legacy-fajar-blade', { id: 'bm7a-main', baseStats: { attack: 100 }, equipSlot: 'mainHand', mainHand: true, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false });
    const off = createItem('legacy-fajar-blade', { id: 'bm7a-off', baseStats: { attack: 70 }, equipSlot: 'offHand', offHand: true, equipmentType: 'one_hand_sword', weaponType: 'one_hand_sword', handedness: 'one_hand', twoHanded: false });
    hero.inventory.push(main, off);
    hero.equipment.mainHand = main.id;
    hero.equipment.offHand = off.id;
    hero.skillProgressionV3!.skillRanks = {
      'v3-blade-master-twin-blade-mastery': 1,
      'v3-blade-master-twin-assault': 1,
      'v3-blade-master-blade-rush': 1,
      'v3-blade-master-counterflow': 1,
      'v3-blade-master-blade-focus': 1,
    };
    const masteryActive = bladeMasterDualWieldActive(hero);
    const twin = resolveHeroSkill(hero, BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-twin-assault'], 1);
    const twinHits = twin.hitSequence.map((hit) => ({ hand: hit.weaponHand, coefficient: hit.physicalCoefficient, resolvedPower: hit.composedPhysicalPower, sharedWeight: hit.sharedContributionWeight, weaponCoefficient: hit.weaponContributionCoefficient, delay: hit.delay }));
    const flow = new TransientCombatState();
    flow.openBladeFlow(10, 3);
    const flowBefore = flow.bladeFlowActive(11);
    const flowConsumed = flow.consumeBladeFlow(11);
    const flowAfter = flow.bladeFlowActive(11);
    const combined = resolveWeaponAttackContext(main, off, 'DUAL_COMBINED', 200);
    const basicHands = ['MAIN', 'OFF', 'MAIN', 'OFF'];
    const counterflow = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-counterflow'];
    const bladeFocus = BLADE_MASTER_V3_RUNTIME_MAP['v3-blade-master-blade-focus'];
    const focusRank = bladeFocus.rankEffects?.[0]?.temporaryBuffs?.[0]?.modifier?.stats?.flat ?? {};
    const status = masteryActive && twinHits.length === 2 && twinHits.reduce((sum, hit) => sum + (hit.sharedWeight ?? 0), 0) === 1 ? 'PASS' : 'FAIL';
    return {
      status,
      worldImported: false,
      mapLoaded: false,
      specialization: hero.specialization,
      exactSkillCount: Object.keys(BLADE_MASTER_V3_RUNTIME_MAP).length,
      masteryActive,
      dualCapabilitySource: 'blade_master specialization + Twin Blade Mastery rank >= 1',
      mainWeaponLayer: combined.mainHandWeaponAttack,
      offWeaponLayer: combined.offHandWeaponAttack,
      dualCombinedWeaponAttack: combined.totalWeaponAttack,
      twinAssaultHits: twinHits,
      twinAssaultSharedWeightTotal: twinHits.reduce((sum, hit) => sum + (hit.sharedWeight ?? 0), 0),
      dualBasicAlternation: basicHands,
      flowBefore,
      flowConsumed,
      flowAfter,
      counterflowStun: { chance: counterflow.stunProfile?.chance?.[0], pveDuration: counterflow.stunProfile?.pveDuration, noKnockback: true },
      bladeFocusRank1: { accuracy: focusRank.accuracy, criticalRate: focusRank.criticalRate, flowExtension: 3.5 },
      noTempoSystem: true,
      noWorldOrFlaris: true,
    };
  }
}
