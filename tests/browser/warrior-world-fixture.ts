import {
  createV2TestHero,
  authorizeV2Warrior,
  learnSkill,
  learnPassive,
  derivedStats,
  emptyEquipment,
  freshHero,
} from '../../lib/game/rules';
import { createItem } from '../../lib/game/items';
import {
  WARRIOR_V2_ACTIVE,
  WARRIOR_V2_PASSIVES,
} from '../../lib/game/warrior-v2';
import { paidTreeInvestment } from '../../lib/game/rank-ownership';
import { FIELDS } from '../../lib/game/regions';
import { assignPrimaryHotbarSlot } from '../../lib/game/hotbar';
import {makeThiefWorldFixture} from './thief-world-fixture';

export const presets: Record<string, string[]> = {
  general: [
    'strike',
    'iron-charge',
    'sweeping-slash',
    'armor-breaker',
    'battle-cry',
    'ground-breaker',
    'crushing-finale',
  ],
  counter: [
    'strike',
    'guard-stance',
    'counter-slash',
    'iron-reversal',
    'unbroken-stance',
  ],
  great: ['rising-slash', 'ground-breaker', 'severing-arc', 'crushing-finale'],
  dual: ['strike', 'battle-focus', 'relentless-assault', 'iron-charge'],
  blank: [],
  all: WARRIOR_V2_ACTIVE.map((s) => s.id.replace('v2-warrior-', '')),
};
const extras: Record<string, string[]> = {
  general: ['conditioning', 'battle-momentum'],
  counter: [
    'guard-training',
    'counter-training',
    'adrenaline',
    'indomitable-will',
  ],
  great: [
    'heavy-impact',
    'great-weapon-familiarity',
    'great-weapon-momentum',
    'battle-momentum',
  ],
  dual: [
    'combat-instinct',
    'twin-blade-familiarity',
    'twin-blade-rhythm',
    'battle-momentum',
  ],
};
export function makeWorldFixture(params: URLSearchParams) {
  if(params.get('core')==='thief')return makeThiefWorldFixture(params);
  // Isolated public-style test save, never a migration or production query flag.
  if (params.get('architecture') === 'legacy') {
    const h = freshHero('slot-1');
    h.characterName = 'DEV Legacy Targeting';
    h.level = 30;
    h.job = 'warrior';
    h.coreJob = 'warrior';
    h.jobTier = 'core';
    h.skillPoints = 29;
    h.inCity = false;
    h.currentField = 'verdant-plains';
    Object.assign(h, FIELDS[h.currentField].entry);
    h.lastSafePosition = { x: h.x, z: h.z };
    const ids = ['fajar-strike', 'warrior-breaker', 'warrior-charge', 'warrior-guard', 'guard-stance', 'nova-fajar'];
    for (const id of ids) learnSkill(h, id);
    h.primaryHotbar = Array(10).fill(null);
    ['basic-attack', ...ids].forEach((id, i) => Object.assign(h, assignPrimaryHotbarSlot(h, i, id).hero));
    const stats = derivedStats(h);
    h.hp = stats.maxHP;
    h.mana = h.maxMana = stats.maxMana;
    return { hero: h, summary: { level: h.level, build: 'legacy-targeting', weapon: 'existing starter', unspentSP: h.skillPoints, paidWarrior: 0, maxMana: stats.maxMana } };
  }
  const level = [15, 30, 45, 59].includes(Number(params.get('level')))
    ? Number(params.get('level'))
    : 59;
  const build = Object.hasOwn(presets, params.get('build') ?? '')
    ? params.get('build')!
    : 'general';
  const h = createV2TestHero();
  h.slotId = 'slot-1';
  h.characterId = 'dev-warrior-memory';
  h.characterName = `DEV ${build} Lv${level}`;
  h.level = level;
  h.skillPoints = Math.max(
    0,
    Math.min(200, Number(params.get('sp') || level - 1) || 0),
  );
  h.statPoints = Math.max(
    0,
    Math.min(500, Number(params.get('stats') || (level - 1) * 3) || 0),
  );
  // Intentionally unallocated baseline attributes; no invented stat bonuses.
  h.inCity = false;
  h.currentField = 'verdant-plains';
  Object.assign(h, FIELDS[h.currentField].entry);
  h.lastSafePosition = { x: h.x, z: h.z };
  h.inventory = [];
  h.equipment = emptyEquipment();
  const weapon =
    build === 'great' && level >= 24
      ? 'jayantara-two-hand-sword'
      : 'field-verdant-plains-sword';
  const sword = createItem(weapon, { id: 'dev-main', isEquipped: true });
  h.inventory.push(sword);
  h.equipment.mainHand = sword.id;
  if (build === 'dual' || build === 'counter') {
    const off = createItem(
      build === 'dual' ? 'field-verdant-plains-sword' : 'ironveil-shield',
      { id: 'dev-off', isEquipped: true },
    );
    h.inventory.push(off);
    h.equipment.offHand = off.id;
  }
  h.inventory.push(
    createItem('health-potion-1', { quantity: 20 }),
    createItem('mana-potion-1', { quantity: 20 }),
  );
  authorizeV2Warrior(h);
  const nodes = [...WARRIOR_V2_ACTIVE, ...WARRIOR_V2_PASSIVES];
  const acquire = (id: string, rank = 1, seen = new Set<string>()): void => {
    const node = nodes.find((s) => s.id === id);
    if (!node || node.unlockLevel > level || seen.has(id)) return;
    const next = new Set(seen).add(id);
    for (const pre of node.prerequisites ?? [])
      acquire(pre.skillId, pre.requiredRank, next);
    const active = WARRIOR_V2_ACTIVE.some((s) => s.id === id);
    while (
      ((active ? h.skillLevels : h.passiveLevels)[id] ?? 0) < rank &&
      h.skillPoints > 0
    ) {
      const result = active ? learnSkill(h, id) : learnPassive(h, id);
      if (!result) break;
    }
  };
  for (const slug of presets[build]) acquire(`v2-warrior-${slug}`);
  for (const slug of extras[build] ?? []) acquire(`v2-warrior-${slug}`, 3);
  if (build === 'all') {
    for (const node of nodes) acquire(node.id, node.maxLevel);
    acquire('v2-warrior-awakening', 3);
  }
  h.primaryHotbar = Array(10).fill(null);
  const slots = [
    'basic-attack',
    ...presets[build].map((s) => `v2-warrior-${s}`),
    'guard-stance',
    'mana-potion-1',
  ].slice(0, 10);
  slots.forEach((id, i) =>
    Object.assign(h, assignPrimaryHotbarSlot(h, i, id).hero),
  );
  const stats = derivedStats(h);
  h.hp = stats.maxHP;
  h.mana = stats.maxMana;
  h.maxMana = stats.maxMana;
  h.stamina = 0;
  return {
    hero: h,
    summary: {
      level,
      build,
      weapon,
      unspentSP: h.skillPoints,
      paidWarrior: paidTreeInvestment(
        h,
        { id: 'warrior', architecture: 'v2' },
        nodes,
      ),
      maxMana: stats.maxMana,
    },
  };
}
