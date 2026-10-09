// Only imported by the localhost MemoryStorage fixture. No production population hook.
import * as R from '../../lib/game/rules.ts';
import { FIELDS } from '../../lib/game/regions.ts';
import {
  SUNKEN_ID,
  SUNKEN_ZONES,
  SUNKEN_OBSTACLES,
} from '../../lib/game/sunken-ruins-layout.ts';
import { disposeCharacterModel } from '../../lib/game/character-model.ts';

export function configure(g, job = 'adventurer', underwater = true) {
  g.clearSkillRuntime();
  g.clearInput();
  g.clearCurrentTarget();
  g.clearGroundLoot();
  g.assasinPoison.clear();
  g.assasinCombat.clear();
  for (const e of g.enemies) {
    g.unregisterTargetEnemy(e);
    e.group.removeFromParent();
    disposeCharacterModel(e.group);
  }
  g.enemies = [];
  g.enemyLabels.forEach((l) => l.remove());
  g.enemyLabels.clear();
  const legacy = ['hunter', 'wizard', 'acolyte'].includes(job);
  const h = legacy ? R.freshHero() : R.createV3AdventurerHero();
  h.level = 65;
  h.inventory = [];
  h.equipment = R.emptyEquipment();
  if (['warrior', 'berserker', 'blade_master'].includes(job)) {
    R.chooseV3Warrior(h);
    if (job === 'berserker') R.chooseV3Berserker(h);
    if (job === 'blade_master') R.chooseV3BladeMaster(h);
  } else if (['thief', 'rogue', 'assasin'].includes(job)) {
    R.chooseV3Thief(h);
    if (job === 'rogue') R.chooseV3Rogue(h);
    if (job === 'assasin') R.chooseV3Assasin(h);
  } else if (legacy) {
    h.coreJob = job;
    h.job = job;
    h.skillArchitectureVersion = undefined;
    h.skillProgressionV3 = undefined;
  }
  h.characterName = `Local ${job} combat`;
  h.characterId = 'sunken-memory-combat';
  h.currentField = underwater ? SUNKEN_ID : 'sunken-ruins';
  h.currentCity = 'jayantara';
  h.inCity = false;
  const center = underwater ? SUNKEN_ZONES[2] : { x: 18, z: 18 };
  h.x = center.x;
  h.z = center.z;
  const type =
    job === 'hunter'
      ? 'bow'
      : job === 'wizard'
        ? 'staff'
        : job === 'acolyte'
          ? 'mace'
          : h.coreJob === 'thief'
            ? 'dagger'
            : job === 'berserker'
              ? 'two_hand_sword'
              : 'one_hand_sword';
  for (const slot of h.coreJob === 'thief' || job === 'blade_master'
    ? ['mainHand', 'offHand']
    : ['mainHand']) {
    const item = R.createItem(
      h.coreJob === 'thief' ? 'anom-dagger' : 'legacy-fajar-blade',
    );
    Object.assign(item, {
      equipmentType: type,
      weaponType: type,
      attackType: type === 'bow' ? 'ranged' : 'melee',
    });
    h.inventory.push(item);
    h.equipment[slot] = item.id;
  }
  h.skillPoints = 1000;
  for (const skill of R.activeSkills(h)) {
    h.skillLevels[skill.id] = 1;
    if (h.skillProgressionV3) h.skillProgressionV3.skillRanks[skill.id] = 1;
  }
  const stats = R.derivedStats(h);
  h.hp = Math.floor(stats.maxHP * 0.6);
  h.mana = h.maxMana = stats.maxMana;
  if (job === 'hunter') {
    const ammo = R.createItem('arrows');
    ammo.quantity = 99;
    h.inventory.push(ammo);
  }
  g.hero = h;
  g.dead = false;
  g.paused = false;
  g.invincible = 0;
  g.attackTimer = 0;
  g.cooldown = 0;
  g.skillCooldowns = {};
  g.blocking = false;
  g.combatTime = 0;
  g.poisonTime = 0;
  g.elapsed = 0;
  g.combo = 0;
  g.comboWindow = 0;
  g.swing = 0;
  g.dualBasicEquipmentSignature = '';
  g.dualBasicNextHand = 'MAIN';
  g.actor.position.set(h.x, g.groundHeight(h.x, h.z), h.z);
  g.actor.rotation.y = 0;
  g.direction.set(0, 0, -1);
  const f = FIELDS['sunken-ruins'];
  [
    f.normalMonsters[0],
    f.normalMonsters[1],
    f.eliteMonsters[0],
    f.fieldBoss,
  ].forEach((d, i) =>
    g.makeEnemy(
      800 + i,
      h.x + (i ? i * 3 : 0),
      h.z - (i ? 8 : 1.6),
      i === 3,
      d,
    ),
  );
  for (const enemy of g.enemies) enemy.rewardless = true;
  g.setCurrentTarget(g.enemies[0]);
  g.characterModel.animator.update(0.2, {
    movementMode: underwater ? 'underwater' : 'ground',
  });
  return h;
}
export function runParity(g) {
  cancelAnimationFrame(g.frame);
  g.frame = 0;
  const originalRandom = Math.random,
    originalRand = g.rand;
  Math.random = () => 0.43;
  g.rand = () => 0.43;
  const results = [];
  try {
    for (const job of [
      'adventurer',
      'warrior',
      'berserker',
      'blade_master',
      'thief',
      'rogue',
      'assasin',
      'hunter',
      'wizard',
      'acolyte',
    ]) {
      configure(g, job, true);
      const ids = R.activeSkills(g.hero)
        .filter((s) => s.unlockLevel <= 65)
        .map((s) => s.id);
      for (const id of ['basic-attack', ...ids]) {
        const pair = [];
        for (const underwater of [false, true]) {
          configure(g, job, underwater);
          const h = g.hero,
            origin = { x: h.x, z: h.z },
            before = g.enemies.map((e) => e.hp),
            mana = h.mana,
            hp = h.hp;
          const accepted =
            id === 'basic-attack'
              ? (g.attack(), g.attackTimer > 0)
              : g.castSkill(id);
          for (let step = 0; step < 180; step++) g.stepSkillRuntime(1 / 60);
          pair.push({
            accepted: !!accepted,
            damage: g.enemies.map((e, i) =>
              Number((before[i] - e.hp).toFixed(6)),
            ),
            mana: Number((mana - h.mana).toFixed(6)),
            healed: Number((h.hp - hp).toFixed(6)),
            cooldowns: { ...g.skillCooldowns },
            attackTimer: g.attackTimer,
            buffs: { ...h.activeBuffs },
            statuses: g.enemies.map((e) => ({
              stun: e.stun,
              root: e.root,
              slow: e.slow,
              defenseDown: e.defenseDown,
              statuses: e.statusEffects,
            })),
            moved: [
              Number((h.x - origin.x).toFixed(5)),
              Number((h.z - origin.z).toFixed(5)),
            ],
          });
        }
        const comparable = (p) => ({ ...p, moved: undefined });
        results.push({
          job,
          id,
          ground: pair[0],
          underwater: pair[1],
          equal:
            JSON.stringify(comparable(pair[0])) ===
              JSON.stringify(comparable(pair[1])) &&
            pair[0].moved.every(
              (v, i) => Math.abs(v - pair[1].moved[i]) <= 0.15,
            ),
        });
      }
    }
  } finally {
    Math.random = originalRandom;
    g.rand = originalRand;
    g.paused = true;
  }
  return results;
}
export function runDefenseParity(g) {
  const out = [],
    originalRand = g.rand;
  try {
    for (const state of [
      'hit',
      'guard',
      'parry',
      'evade',
      'death',
      'critical',
    ]) {
      const pair = [];
      for (const underwater of [false, true]) {
        configure(g, 'warrior', underwater);
        g.rand = () => (state === 'evade' || state === 'critical' ? 0 : 0.99);
        if (state === 'guard') g.blocking = true;
        if (state === 'parry') g.hero.statusEffects.parry = 1;
        const hp = g.hero.hp,
          enemyHP = g.enemies[0].hp;
        if (state === 'critical') g.attack();
        else g.hurtHero(state === 'death' ? 100000 : 100, 'fixture');
        pair.push({
          damage: hp - g.hero.hp,
          enemyDamage: enemyHP - g.enemies[0].hp,
          dead: g.dead,
          mana: g.hero.mana,
          status: { ...g.hero.statusEffects },
        });
      }
      out.push({
        state,
        ground: pair[0],
        underwater: pair[1],
        equal: JSON.stringify(pair[0]) === JSON.stringify(pair[1]),
      });
    }
  } finally {
    g.rand = originalRand;
    g.paused = true;
  }
  return out;
}
export function runMonsterLifecycle(g) {
  const monsters = [];
  for (let index = 0; index < 4; index++) {
    configure(g, 'warrior', true);
    const e = g.enemies[index],
      o = SUNKEN_OBSTACLES.find((p) => p.kind === 'pillar');
    e.group.position.set(o.x - 5, g.groundHeight(o.x - 5, o.z), o.z);
    e.home.copy(e.group.position);
    g.actor.position.set(o.x + 4, g.groundHeight(o.x + 4, o.z), o.z);
    g.hero.x = o.x + 4;
    g.hero.z = o.z;
    const hp = g.hero.hp;
    let valid = true,
      min = Infinity;
    for (let i = 0; i < 1200; i++) {
      g.elapsed += 1 / 60;
      g.updateEnemy(e, 1 / 60);
      valid &&= g.sunken.navigation.valid(
        e.group.position,
        e.boss ? 1.8 : 0.55,
      );
      min = Math.min(min, g.groundDistance(e.group.position, g.actor.position));
    }
    const attacked = g.hero.hp < hp;
    g.hero.x = 45;
    g.hero.z = 225;
    g.actor.position.set(45, g.groundHeight(45, 225), 225);
    for (let i = 0; i < 1200; i++) {
      g.elapsed += 1 / 60;
      g.updateEnemy(e, 1 / 60);
      valid &&= g.sunken.navigation.valid(
        e.group.position,
        e.boss ? 1.8 : 0.55,
      );
    }
    const returned = g.groundDistance(e.group.position, e.home) < 1.1;
    const rewards = () =>
      JSON.stringify({
        xp: g.hero.xp,
        gold: g.hero.gold,
        kills: g.hero.kills,
        progress: g.hero.fieldProgress,
        bosses: g.hero.defeatedFieldBosses,
        bossTimestamps: g.hero.defeatedBossTimestamp,
        lootCount: g.groundLoot.length,
        goldCount: g.groundGold.length,
      });
    const beforeRewards = rewards();
    g.hurtEnemy(e, e.max * 10, 0);
    const died = e.hp <= 0;
    const noRewards = beforeRewards === rewards();
    e.respawnDeadline = Date.now() - 1;
    g.updateEnemy(e, 1 / 60);
    monsters.push({
      definition: e.definition.id,
      variant: e.definition.variant,
      valid,
      min,
      attacked,
      returned,
      died,
      noRewards,
      respawned: e.hp === e.max,
      rootOnFloor:
        Math.abs(
          e.group.position.y -
            g.groundHeight(e.group.position.x, e.group.position.z),
        ) < 1e-5,
    });
  }
  return {
    ...Object.fromEntries(
      [
        'valid',
        'attacked',
        'returned',
        'died',
        'respawned',
        'rootOnFloor',
        'noRewards',
      ].map((key) => [key, monsters.every((m) => m[key])]),
    ),
    monsters,
  };
}
