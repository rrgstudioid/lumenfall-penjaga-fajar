import { CITIES } from './regions.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionHalfExtent } from './field-layout.ts';
import { ITEM_CATALOG, createRuneItem, rollEquipmentSockets, RUNE_RARITY_RULES, RARITY_META, resolveEquipmentAsset } from './items.ts';
import {
  collectPendingLoot,
  grantLoot,
  unequipItem,
  discardItem,
  buyPotion,
  evolvePet,
  socketRune,
  removeSocketedRune,
  resetCharacterStats,
  calculateTotalStatPoints,
  RESET_STATS_GOLD_COST,
  resetJobToAdventurer,
} from './rules.ts';
import {
  ALL_SKILLS,
  addItemToInventory,
  applyStatPreview,
  canEquipItem,
  CORE_JOBS,
  createItem,
  SPECIALIZATIONS,
  attackPower,
  chooseCoreJob,
  chooseMastery,
  chooseSpecialization,
  chooseV3Warrior,
  derivedStats,
  emptyEquipment,
  enhancementPreview,
  equipItem,
  enhanceItem,
  freshHero,
  gainXP,
  hasEquippedGear,
  createV3AdventurerHero,
  maxHP,
  parseSave,
  skillsFor,
  type CoreJobId,
} from './rules.ts';

await test('new characters begin as Adventurer with four data-driven skill slots', () => {
  const hero = freshHero();
  assert.equal(hero.job, 'adventurer');
  assert.equal(hero.jobTier, 'adventurer');
  assert.equal(hero.coreJob, null);
  assert.equal(skillsFor(null, null).length, 4);
  assert.equal(
    skillsFor(null, null)
      .map((skill) => skill.slot)
      .join(''),
    '1234',
  );
  assert.equal(maxHP(hero), hero.hp);
});

await test('progression caps at level 50 and grants skill points', () => {
  const hero = freshHero();
  const startingPoints = hero.skillPoints;
  gainXP(hero, 999999);
  assert.equal(hero.level, 50);
  assert.equal(hero.xp, 0);
  assert.ok(hero.skillPoints > startingPoints);
  assert.equal(hero.hp, maxHP(hero));
});

await test('all five Core Jobs and ten Special Jobs are represented', () => {
  assert.equal(Object.keys(CORE_JOBS).length, 5);
  assert.equal(Object.keys(SPECIALIZATIONS).length, 10);
  for (const core of Object.keys(CORE_JOBS) as CoreJobId[]) {
    const hero = freshHero();
    gainXP(hero, 999999);
    hero.equipment = emptyEquipment();
    hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
    assert.equal(chooseCoreJob(hero, core), true);
    assert.equal(hero.coreJob, core);
    assert.equal(skillsFor(core, null).length, 4);
  }
  assert.equal(ALL_SKILLS.filter((skill) => skill.specialization).length, 40);
});

await test('specialization and mastery do not add a fifth active skill', () => {
  const hero = freshHero();
  gainXP(hero, 80000);
  hero.equipment = emptyEquipment();
  hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
  chooseCoreJob(hero, 'wizard');
  assert.equal(chooseSpecialization(hero, 'resi'), true);
  assert.equal(skillsFor(hero.coreJob, hero.specialization).length, 4);
  assert.deepEqual(
    skillsFor(hero.coreJob, hero.specialization).map((skill) => skill.slot),
    [1, 2, 3, 4],
  );
  assert.equal(chooseMastery(hero, 'resi-1', 'power'), true);
  assert.equal(hero.masteryChoices['resi-1'], 'power');
});

await test('job reset returns to Adventurer without losing earned level points or duplicating stat/SP totals', () => {
  const hero = freshHero();
  gainXP(hero, 90000);
  hero.gold = 1500;
  hero.allocatedStats = { str: 7, vit: 5, dex: 3, int: 2 };
  hero.statPoints = 12;
  hero.skillPoints = 5;
  hero.coreJob = 'warrior';
  hero.job = 'warrior';
  hero.jobTier = 'core';
  hero.specialization = 'berserker';
  hero.skillProgressionV3 = {
    skillArchitectureVersion: 3,
    totalEarnedSP: 18,
    skillRanks: {
      'v3-adventurer-quick-slash': 1,
      'v3-adventurer-power-strike': 1,
      'v3-warrior-strike': 2,
      'v3-warrior-guard-stance': 1,
    },
    grantedRanks: {
      'v3-adventurer-quick-slash': 1,
      'v3-adventurer-power-strike': 1,
    },
    chosenCoreJob: 'warrior',
    chosenSpecialization: 'berserker',
    chosenAdvancedJob: null,
  };
  const sword = createItem('legacy-fajar-blade', { id: 'job-reset-sword' });
  hero.inventory.push(sword);
  equipItem(hero, sword.id, 'mainHand');

  const result = resetJobToAdventurer(hero);
  assert.equal(result.ok, true);
  assert.equal(result.hero.job, 'adventurer');
  assert.equal(result.hero.coreJob, null);
  assert.equal(result.hero.specialization, null);
  assert.equal(result.hero.jobTier, 'adventurer');
  assert.equal(result.hero.allocatedStats.str, 0);
  assert.equal(result.hero.allocatedStats.vit, 0);
  assert.equal(result.hero.allocatedStats.dex, 0);
  assert.equal(result.hero.allocatedStats.int, 0);
  assert.equal(result.hero.gold, 1000);
  assert.equal(result.hero.equipment.mainHand, null);
  assert.equal(result.hero.equipment.offHand, null);
  assert.ok(result.hero.statPoints >= calculateTotalStatPoints(hero.level, hero.progressionArchitecture));
  assert.equal(result.hero.skillProgressionV3?.totalEarnedSP, 18);
  assert.equal(result.hero.skillProgressionV3?.skillRanks['v3-adventurer-quick-slash'], 1);
  assert.equal(result.hero.skillProgressionV3?.chosenCoreJob, null);
  assert.equal(result.hero.skillProgressionV3?.chosenSpecialization, null);
});

await test('job promotion refuses to proceed while gear is still equipped', () => {
  const hero = createV3AdventurerHero();
  hero.level = 15;
  hero.inventory.push(createItem('legacy-fajar-blade', { id: 'v3-job-block-sword' }));
  equipItem(hero, 'v3-job-block-sword', 'mainHand');

  assert.equal(chooseV3Warrior(hero), false);
  assert.equal(hero.coreJob, null);
  assert.equal(hero.equipment.mainHand, 'v3-job-block-sword');
});

await test('old saves migrate to Adventurer without losing progress', () => {
  const old = {
    version: 2,
    slotId: 'slot-2',
    characterName: 'Ayla',
    job: 'ranger',
    level: 7,
    xp: 31,
    gold: 333,
    kills: 4,
    hp: 80,
    potions: 9,
    weapon: 2,
    questClaimed: false,
    bossDefeated: false,
    x: 4,
    z: 5,
    inventory: [{ id: 'old-sword', name: 'Pedang lama' }],
  };
  const restored = parseSave(JSON.stringify(old), 'slot-2');
  assert.ok(restored);
  assert.equal(restored?.job, 'adventurer');
  assert.equal(restored?.coreJob, null);
  assert.equal(restored?.level, 7);
  assert.equal(restored?.xp, 31);
  assert.equal(restored?.gold, 333);
  assert.equal(restored?.weapon, 2);
  assert.equal(restored?.inventory.length, 2);
  assert.ok(restored?.inventory.some((item) => item.itemType === 'potion'));
});

await test('save values are clamped and invalid payloads are ignored', () => {
  assert.equal(parseSave(null), null);
  assert.equal(parseSave('{broken'), null);
  const hero = parseSave(
    JSON.stringify({
      ...freshHero(),
      level: 999,
      gold: -20,
      hp: -3,
      x: 500,
      z: -500,
      weapon: 99,
    }),
  );
  assert.ok(hero);
  assert.equal(hero?.level, 50);
  assert.equal(hero?.gold, 0);
  assert.equal(hero?.hp, 1);
  assert.equal(hero?.x, regionHalfExtent(true)-1);
  assert.equal(hero?.z, 1-regionHalfExtent(true));
  assert.equal(hero?.weapon, 20);
  assert.ok(attackPower(hero!) > 0);
});

await test('inventory stacks consumables while equipment remains separate', () => {
  const first = createItem('lumut-fiber', { id: 'fiber-a', quantity: 40 });
  const second = createItem('lumut-fiber', { id: 'fiber-b', quantity: 70 });
  const result = addItemToInventory([first], second, 4);
  assert.equal(result.added, 70);
  assert.equal(result.remaining, 0);
  assert.equal(result.inventory.length, 2);
  assert.equal(result.inventory[0].quantity, 100);
  const blade = createItem('legacy-fajar-blade', { id: 'blade-a' });
  const gearResult = addItemToInventory(
    [blade],
    createItem('legacy-fajar-blade', { id: 'blade-b' }),
    4,
  );
  assert.equal(gearResult.inventory.length, 2);
});

await test('job weapon restriction and data-driven equipment work', () => {
  const hero = freshHero();
  gainXP(hero, 50000);
  hero.equipment = emptyEquipment();
  hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
  assert.equal(chooseCoreJob(hero, 'warrior'), true);
  assert.equal(chooseSpecialization(hero, 'gatotkaca'), true);
  const knuckle = createItem('guntur-knuckle', { id: 'test-knuckle' });
  const shield = createItem('garda-shield', { id: 'test-shield' });
  hero.inventory.push(knuckle, shield);
  assert.equal(equipItem(hero, knuckle.id).ok, true);
  assert.equal(canEquipItem(shield, hero).ok, false);
  assert.equal(hero.equipment.mainHand, knuckle.id);
});

await test('core job promotion requires empty gear and resets skills and hotbars without losing stats or items', () => {
  const hero = freshHero();
  gainXP(hero, 50000);
  hero.allocatedStats = { str: 4, vit: 5, dex: 2, int: 3 };
  hero.skillPoints = 7;
  hero.skillLevels['fajar-step'] = 3;
  hero.passiveLevels['adventurer-resolve'] = 2;
  hero.masteryChoices['fajar-step'] = 'power';
  hero.primaryHotbar = ['fajar-step', 'basic-attack', null, null, null, null, null, null, null, null];
  hero.primaryHotbarOverflow = ['fajar-step'];
  hero.quickHotbars.q.assignment = 'fajar-step';

  assert.equal(hasEquippedGear(hero), true);
  assert.equal(chooseCoreJob(hero, 'hunter'), true);
  assert.equal(hero.coreJob, 'hunter');
  assert.equal(hero.equipment.mainHand, null);
  assert.equal(hero.skillLevels['fajar-step'], 0);

  const bladeId = `${hero.slotId}-fajar-blade`;
  assert.equal(hasEquippedGear(hero), false);
  assert.equal(hero.equipment.mainHand, null);
  assert.equal(hero.inventory.find((item) => item.id === bladeId)?.isEquipped, false);
  const trainingBow = hero.inventory.find((item) => item.requiredCoreJob === 'hunter');
  assert.ok(trainingBow);
  assert.notEqual(trainingBow?.isEquipped, true);

  const next = freshHero();
  gainXP(next, 50000);
  next.equipment = emptyEquipment();
  next.inventory = next.inventory.map((item) => ({ ...item, isEquipped: false }));
  assert.equal(chooseCoreJob(next, 'hunter'), true);
  assert.equal(next.coreJob, 'hunter');
  assert.deepEqual(next.allocatedStats, { str: 0, vit: 0, dex: 0, int: 0 });
  assert.ok(next.skillPoints >= 7);
  assert.ok(Object.values(next.skillLevels).every((level) => level === 0));
  assert.ok(Object.values(next.passiveLevels).every((level) => level === 0));
  assert.deepEqual(next.masteryChoices, {});
  assert.ok(next.primaryHotbar.every((id) => id === null));
  assert.deepEqual(next.primaryHotbarOverflow, []);
  assert.equal(next.quickHotbars.q.assignment, null);
  assert.equal(next.quickHotbars.e.assignment, null);
  assert.equal(next.equipment.mainHand, null);
  assert.equal(next.selectedAmmo, null);
  assert.equal(next.inventory.find((item) => item.id === bladeId)?.isEquipped, false);
  const nextTrainingBow = next.inventory.find((item) => item.requiredCoreJob === 'hunter');
  assert.ok(nextTrainingBow);
  assert.notEqual(nextTrainingBow?.isEquipped, true);
});

await test('attribute preview changes derived stats and enhancement exposes risk', () => {
  const hero = freshHero();
  gainXP(hero, 5000);
  const before = derivedStats(hero).attack;
  assert.equal(
    applyStatPreview(hero, { str: 2, vit: 0, dex: 0, int: 0 }),
    true,
  );
  assert.ok(derivedStats(hero).attack > before);
  hero.inventory.push(
    createItem('iron', { id: 'iron-test', quantity: 5 }),
  );
  const target = hero.inventory.find(
    (item) => item.templateId === 'legacy-fajar-blade',
  );
  assert.ok(target);
  const preview = enhancementPreview(hero, target!.id);
  assert.ok(preview);
  assert.equal(preview?.materialId, 'iron');
  assert.equal(enhanceItem(hero, target!.id, 0).ok, true);
});

await test('full inventory retains loot across save and collects it without loss', () => {
  const hero = freshHero();
  hero.inventoryCapacity = 10;
  while (hero.inventory.length < 10)
    hero.inventory.push(createItem('forest-vest'));
  const gold = (hero.gold = 100);
  hero.inventory = hero.inventory.filter((item) => item.itemType !== 'potion');
  hero.inventory.push(createItem('forest-vest'));
  assert.equal(buyPotion(hero), false);
  assert.equal(hero.gold, gold);
  grantLoot(hero, true, 1);
  assert.equal(hero.pendingLoot.length, 1);
  const restored = parseSave(JSON.stringify(hero))!;
  restored.inventory.pop();
  assert.equal(collectPendingLoot(restored), 1);
  assert.equal(restored.pendingLoot.length, 0);
});

await test('all ten specializations receive legal equipment and four skills', () => {
  for (const [id, job] of Object.entries(SPECIALIZATIONS)) {
    const hero = freshHero();
    gainXP(hero, 999999);
    hero.equipment = emptyEquipment();
    hero.inventory = hero.inventory.map((item) => ({ ...item, isEquipped: false }));
    chooseCoreJob(hero, job.coreJob);
    chooseSpecialization(hero, id as keyof typeof SPECIALIZATIONS);
    assert.equal(skillsFor(hero.coreJob, hero.specialization).length, 4);
    const main = hero.inventory.find(
      (item) => item.id === hero.equipment.mainHand,
    )!;
    assert.ok(main, id);
    assert.equal(canEquipItem(main, hero).ok, true, id);
    for (const template of Object.values(ITEM_CATALOG).filter(
      (item) => item.requiredSpecialJob && item.requiredSpecialJob !== id,
    )) {
      assert.equal(
        canEquipItem(createItem(template.templateId), hero).ok,
        false,
      );
    }
  }
});

await test('enhancement reaches +12 and consumes rune, seal protects failed +8', () => {
  const hero = freshHero();
  const blade = hero.inventory.find((item) => item.category === 'weapon')!;
  hero.inventory.push(createItem('iron', { quantity: 99 }),createItem('titanium', { quantity: 99 }),createItem('vibranium', { quantity: 99 }),createItem('meteorite-core', { quantity: 99 }));
  hero.inventory.push(createItem('fate-rune-fragment'));
  for (let level = 1; level <= 12; level++) {
    assert.equal(enhanceItem(hero, blade.id, 0).ok, true);
    assert.equal(
      hero.inventory.find((item) => item.id === blade.id)?.enhancementLevel,
      level,
    );
  }
  assert.equal(enhancementPreview(hero, blade.id), null);
  assert.equal(
    hero.inventory.some((item) => item.itemType === 'fateRune'),
    false,
  );
  const protectedBlade = createItem('legacy-fajar-blade', {
    enhancementLevel: 8,
  });
  hero.inventory.push(protectedBlade, createItem('eternal-seal'),createItem('vibranium',{quantity:9}));
  enhanceItem(hero, protectedBlade.id, 1);
  assert.equal(
    hero.inventory.find((item) => item.id === protectedBlade.id)
      ?.enhancementLevel,
    8,
  );
  assert.equal(
    hero.inventory.some((item) => item.itemType === 'eternalSeal'),
    false,
  );
});

await test('equipment affixes, boss sockets, socket runes, restrictions, and migration work together',()=>{
  assert.equal(createItem('legacy-fajar-blade').affixes.length,0);
  for(const rarity of Object.keys(RUNE_RARITY_RULES) as Array<keyof typeof RUNE_RARITY_RULES>)assert.ok(createRuneItem('might',rarity).affixes.length>=RUNE_RARITY_RULES[rarity].minAffixes);
  const hero=freshHero();
  const gear=createItem('forest-vest',{id:'socket-gear',rarity:'epic',source:{type:'field_boss',sourceId:'ancient-treant',label:'Ancient Treant'},sockets:rollEquipmentSockets({type:'field_boss',sourceId:'ancient-treant',label:'Ancient Treant'},()=>0),affixes:[]});
  const rune=createRuneItem('vitality','rare',{id:'vitality-rune',affixes:[{id:'hp',stat:'hp',label:'Max HP',value:100,unit:'flat'}]});
  hero.inventory.push(gear,rune);equipItem(hero,gear.id);const before=derivedStats(hero).maxHP;
  assert.equal((hero.x=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!.x,hero.z=CITIES.arunika.npcList.find(n=>n.id==='aruna-3')!.z,socketRune(hero,gear.id,rune.id,0,'aruna-3')).ok,true);assert.equal(derivedStats(hero).maxHP,before+100);assert.equal(hero.inventory.some(item=>item.id===rune.id),false);
  hero.gold=500;assert.equal(removeSocketedRune(hero,gear.id,0,'aruna-3').ok,true);assert.equal(hero.gold,250);
  const old=parseSave(JSON.stringify({...hero,inventory:[{id:'old-armor',kind:'armor',name:'Old Armor',quantity:1}],equipment:{}}))!;
  assert.equal(old.inventory[0].rarity,'common');assert.equal(old.inventory[0].sockets.length,0);assert.equal(old.inventory[0].affixes.length,0);
});

await test('pet evolution survives unequip and reload; quest items cannot be discarded', () => {
  const hero = freshHero();
  const egg = hero.inventory.find((item) => item.category === 'pet')!;
  equipItem(hero, egg.id);
  hero.inventory.push(createItem('lumut-fiber', { quantity: 3 }));
  assert.equal(evolvePet(hero).ok, true);
  unequipItem(hero, 'pet');
  const restored = parseSave(JSON.stringify(hero))!;
  equipItem(restored, egg.id);
  assert.equal(restored.pet?.level, 2);
  const quest = createItem('lumut-fiber', {
    isQuestItem: true,
    category: 'quest',
  });
  restored.inventory.push(quest);
  assert.equal(discardItem(restored, quest.id).ok, false);
});

// Canonical Rune transactions are covered in rune-forge.test.ts.

await test('main/off-hand validation supports bow, shield, quiver, and dual wield safely',()=>{
  const hunter=freshHero();gainXP(hunter,999999);hunter.equipment=emptyEquipment();hunter.inventory=hunter.inventory.map(item=>({...item,isEquipped:false}));chooseCoreJob(hunter,'hunter');
  const bow=createItem('field-sunken-ruins-bow',{id:'ruin-bow-test'});const shield=createItem('ironveil-shield',{id:'shield-wrong-job',allowedJobs:['hunter']});const quiver=createItem('hunter-quiver',{id:'quiver-test'});
  hunter.inventory.push(bow,shield,quiver);
  assert.equal(bow.name,'Ruin Bow');assert.equal(bow.attackType,'ranged');assert.equal(bow.handedness,'two_hand');
  assert.equal(equipItem(hunter,bow.id,'offHand').reason,'Equipment ini tidak dapat digunakan pada slot tersebut.');
  assert.equal(equipItem(hunter,bow.id,'mainHand').ok,true);assert.equal(equipItem(hunter,shield.id).ok,false);assert.equal(equipItem(hunter,quiver.id).ok,true);

  const warrior=freshHero();gainXP(warrior,999999);warrior.equipment=emptyEquipment();warrior.inventory=warrior.inventory.map(item=>({...item,isEquipped:false}));chooseCoreJob(warrior,'warrior');
  const sword=createItem('field-verdant-plains-sword',{id:'one-hand-test'});const guard=createItem('ironveil-shield',{id:'shield-test'});const twoHand=createItem('field-sunken-ruins-bow',{id:'two-hand-test',allowedJobs:['warrior']});
  warrior.inventory.push(sword,guard,twoHand);assert.equal(equipItem(warrior,sword.id).ok,true);assert.equal(equipItem(warrior,guard.id).ok,true);assert.equal(equipItem(warrior,twoHand.id).ok,true);assert.equal(warrior.equipment.offHand,null);assert.equal(warrior.inventory.some(item=>item.id===guard.id),true);

  const rogue=freshHero();gainXP(rogue,999999);rogue.equipment=emptyEquipment();rogue.inventory=rogue.inventory.map(item=>({...item,isEquipped:false}));chooseCoreJob(rogue,'rogue');const rogueTrainingWeapon=rogue.inventory.find(item=>item.requiredCoreJob==='rogue');assert.ok(rogueTrainingWeapon);assert.equal(equipItem(rogue,rogueTrainingWeapon!.id).ok,true);const dagger=createItem('whispering-offhand-dagger',{id:'dual-off'});rogue.inventory.push(dagger);assert.equal(equipItem(rogue,dagger.id).ok,true);
});

await test('equipment metadata, assets, rarity colors, and reset stats share the migrated state',()=>{
  const bow=createItem('field-sunken-ruins-bow',{id:'asset-bow'});const asset=resolveEquipmentAsset(bow);
  assert.equal(bow.equipmentType,'bow');assert.match(asset.icon,/assets\/equipment\/field-sunken-ruins-bow\/icon\.png$/);
  assert.equal(RARITY_META.common.color,'#B8B8B8');assert.equal(RARITY_META.ancient.color,'#E6D37A');
  const hero=freshHero();gainXP(hero,5000);hero.gold=1000;applyStatPreview(hero,{str:2,vit:1,dex:1,int:0});
  const equipped=hero.inventory.find(item=>item.id===hero.equipment.mainHand)!;equipped.sockets=[{id:'socket-1',rune:null}];equipped.affixes=[{id:'optimizer-kept',stat:'attack',label:'Attack',value:4,unit:'flat',source:'runeOptimizer'}];
  const beforeId=equipped.id;const result=resetCharacterStats(hero);assert.equal(result.ok,true);assert.equal(result.hero.gold,1000-RESET_STATS_GOLD_COST);assert.equal(result.hero.statPoints,calculateTotalStatPoints(hero.level));assert.deepEqual(result.hero.allocatedStats,{str:0,vit:0,dex:0,int:0});
  const preserved=result.hero.inventory.find(item=>item.id===beforeId)!;assert.equal(preserved.affixes[0].id,'optimizer-kept');assert.equal(result.hero.equipment.mainHand,beforeId);
});
