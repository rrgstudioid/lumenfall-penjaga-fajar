/** Memory-only controlled Thief entry, imported solely by localhost test harness. */
import {
  createV2CoreFoundationHero,
  derivedStats,
  emptyEquipment,
  learnSkill,
  learnPassive,
} from '../../lib/game/rules';
import {
  THIEF_V2_ACTIVE,
  THIEF_V2_PASSIVES,
  THIEF_TREE,
} from '../../lib/game/thief-v2';
import { createItem } from '../../lib/game/items';
import { paidTreeInvestment } from '../../lib/game/rank-ownership';
import { assignPrimaryHotbarSlot } from '../../lib/game/hotbar';
import { FIELDS } from '../../lib/game/regions';
export function makeThiefWorldFixture(params: URLSearchParams) {
  const level = [15, 30, 45, 59].includes(Number(params.get('level')))
    ? Number(params.get('level'))
    : 59;
  const h = createV2CoreFoundationHero('thief', level);
  h.slotId = 'slot-1';
  h.characterId = 'dev-thief-memory';
  h.characterName = `DEV Thief Lv${level}`;
  h.skillPoints = Math.max(
    0,
    Math.min(200, Number(params.get('sp') ?? level - 1) || 0),
  );
  h.statPoints = (level - 1) * 3;
  h.gold = 1000;
  h.inCity = false;
  h.currentField = 'verdant-plains';
  Object.assign(h, FIELDS[h.currentField].entry);
  h.lastSafePosition = { x: h.x, z: h.z };
  h.inventory = [];
  h.equipment = emptyEquipment();
  // Existing numerical item stats. Test-only authorization override, no catalog balance/restriction change.
  for (const hand of ['mainHand', 'offHand'] as const) {
    const d = {
      ...createItem('field-verdant-plains-dagger', {
        id: `dev-thief-${hand}`,
        isEquipped: true,
      }),
      allowedJobs: [],
      requiredCoreJob: null,
    };
    h.inventory.push(d);
    h.equipment[hand] = d.id;
  }
  const nodes = [...THIEF_V2_ACTIVE, ...THIEF_V2_PASSIVES];
  const acquire = (nodeId: string, rank = 1): void => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.unlockLevel > level) return;
    for (const p of node.prerequisites ?? [])
      acquire(p.skillId, p.requiredRank ?? 1);
    const active = THIEF_V2_ACTIVE.some((s) => s.id === nodeId);
    while (
      ((active ? h.skillLevels : h.passiveLevels)[nodeId] ?? 0) < rank &&
      h.skillPoints > 0
    )
      if (!(active ? learnSkill(h, nodeId) : learnPassive(h, nodeId))) break;
  };
  for (const s of [
    'quick-stab',
    'slipstep',
    'mark-prey',
    'smoke-veil',
    'twin-fang',
    'crippling-cut',
    'venom-edge',
    'evasive-feint',
    'shadow-lunge',
    'marked-strike',
    'blade-flurry',
    'silent-opening',
    'rear-rend',
    'disengage',
    'weakpoint-assault',
  ])
    acquire(`v2-thief-${s}`);
  for (const s of [
    'agile-conditioning',
    'dagger-discipline',
    'keen-instinct',
    'dual-dagger-familiarity',
    'mark-expertise',
    'rear-awareness',
    'opportunist',
    'silent-opportunity',
  ])
    acquire(`v2-thief-${s}`, 2);
  if (params.get('build') === 'all') {
    for (const n of nodes) acquire(n.id, n.maxLevel);
    acquire('v2-thief-instinct', 3);
  } else acquire('v2-thief-instinct');
  h.primaryHotbar = Array(10).fill(null);
  [
    'basic-attack',
    'v2-thief-quick-stab',
    'v2-thief-slipstep',
    'v2-thief-mark-prey',
    'v2-thief-smoke-veil',
    'v2-thief-twin-fang',
    'v2-thief-silent-opening',
    'v2-thief-blade-flurry',
    'v2-thief-disengage',
    'v2-thief-instinct',
  ].forEach((id, i) =>
    Object.assign(h, assignPrimaryHotbarSlot(h, i, id).hero),
  );
  const stats = derivedStats(h);
  h.hp = stats.maxHP;
  h.mana = h.maxMana = stats.maxMana;
  h.stamina = 0;
  return {
    hero: h,
    summary: {
      level,
      build: 'thief',
      weapon: 'two distinct test-authorized existing daggers',
      unspentSP: h.skillPoints,
      paidWarrior: 0,
      paidThief: paidTreeInvestment(h, THIEF_TREE, nodes),
      maxMana: stats.maxMana,
    },
  };
}
