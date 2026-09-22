/** Phase 3A contract. Data only; no live promotion or implicit grants. */
import type {
  SkillDefinition,
  PassiveDefinition,
  SkillRankValues,
  WeaponType,
} from './skills.ts';
import type { CombatModifier } from './combat-modifiers.ts';
export const WARRIOR_TREE = { id: 'warrior', architecture: 'v2' } as const;
export const WARRIOR_STYLES: WeaponType[] = [
  'one_hand_sword',
  'greatsword',
  'dual_sword',
];
export const WARRIOR_COUNTER_WINDOW_MS = 2500;
const id = (name: string) => `v2-warrior-${name}`;
const req = (name: string, rank: number) => ({
  skillId: id(name),
  requiredRank: rank,
});
const scoped = { tree: WARRIOR_TREE };
const direct = { tree: WARRIOR_TREE, tags: ['physical'] };
const heavy = { tree: WARRIOR_TREE, tags: ['heavy'] };
type Extra = Partial<SkillDefinition>;
function active(
  slug: string,
  name: string,
  level: number,
  tags: string[],
  lock: number,
  rows: SkillRankValues[],
  extra: Extra = {},
): SkillDefinition {
  return {
    id: id(slug),
    name,
    description: 'Physical damage pada target terpilih.',
    job: 'warrior',
    specialization: null,
    slot: 1,
    tree: WARRIOR_TREE,
    unlockLevel: level,
    maxLevel: rows.length,
    progressionMode: 'rank_values',
    rankValues: rows,
    manaCost: 0,
    cooldown: 0,
    castingTime: 0,
    baseDamage: 0,
    physicalCoefficient: 0,
    magicCoefficient: 0,
    skillPowerCoefficient: 0,
    damageType: 'physical',
    canCrit: true,
    damageCoefficient: 0,
    scalingStat: 'attack',
    targetType: 'single',
    range: 3.8,
    areaRadius: 0,
    duration: 0,
    knockbackStrength: 0,
    statusEffect: null,
    effect: 'damage',
    animation: 'basic_attack',
    visualEffect: 'damage',
    soundEffect: 'attack',
    weaponRequirement: [...WARRIOR_STYLES],
    masteryOptions: [],
    tags: ['warrior', ...tags],
    actionType: 'skill',
    actionLockDuration: lock,
    movementAllowedDuringLock: false,
    modifierComposition: 'scoped_additive',
    usableFromHotbar: true,
    hotbarCategory: 'primary',
    skillType: 'active',
    ...extra,
  };
}
const damageRows = (rows: number[][]) =>
  rows.map(
    ([baseDamage, physicalCoefficient, _legacyValue, manaCost, cooldown]) => ({
      baseDamage,
      physicalCoefficient,
      manaCost,
      cooldown,
    }),
  );
function buff(
  slug: string,
  name: string,
  level: number,
  lock: number,
  rows: number[][],
  mods: (r: number) => CombatModifier[],
  extra: Extra = {},
): SkillDefinition {
  return active(
    slug,
    name,
    level,
    ['buff'],
    lock,
    rows.map(([duration, manaCost, cooldown]) => ({
      duration,
      manaCost,
      cooldown,
    })),
    {
      description: 'Buff sementara pada diri sendiri.',
      targetType: 'self',
      effect: 'buff',
      actionType: 'buff',
      canCrit: false,
      range: 0,
      movementAllowedDuringLock: true,
      rankEffects: rows.map(([duration], r) => ({
        temporaryBuffs: mods(r).map((modifier) => ({ duration, modifier })),
      })),
      ...extra,
    },
  );
}
const single = ['physical', 'melee', 'single_target'];
const area = ['physical', 'melee', 'aoe'];
const counter = (
  slug: string,
  blocked: number[] | undefined,
  parried: number[],
  normal: number[],
  _blockLegacy: number[] | undefined,
  _parryLegacy: number[],
) =>
  normal.map((_, r) => ({
    modifiers: [
      ...(blocked
        ? [
            {
              id: `${id(slug)}-block`,
              layer: 'payoff' as const,
              condition: { counter: ['blocked'] as ['blocked'] },
              action: { damagePercent: blocked[r] },
            },
          ]
        : []),
      {
        id: `${id(slug)}-parry`,
        layer: 'payoff' as const,
        condition: { counter: ['parried'] as ['parried'] },
        action: { damagePercent: parried[r] },
      },
    ],
  }));

export const WARRIOR_V2_ACTIVE: SkillDefinition[] = [
  active(
    'strike',
    'Warrior Strike',
    15,
    [...single],
    0.3,
    damageRows([
      [18, 1.05, 7, 6, 3.5],
      [22, 1.1, 8, 6, 3.5],
      [26, 1.15, 10, 6, 3.4],
      [30, 1.2, 11, 6, 3.3],
      [34, 1.25, 13, 6, 3.2],
    ]),
    { branch: 'assault' },
  ),
  active(
    'iron-charge',
    'Iron Charge',
    17,
    [...single, 'mobility'],
    0.55,
    damageRows([
      [15, 0.9, 8, 8, 7],
      [18, 0.95, 9, 8, 6.8],
      [21, 1, 10, 8, 6.6],
      [24, 1.05, 11, 8, 6.3],
      [27, 1.1, 13, 8, 6],
    ]).map((r, i) => ({
      ...r,
      range: [7, 7, 7.5, 8, 8.5][i],
      knockbackStrength: 0.3,
    })),
    {
      branch: 'control',
      prerequisites: [req('strike', 1)],
      effect: 'dash_damage',
      dash: { stopDistance: 2.5, impactRange: 2.5 },
      description:
        'Charge ke target; damage hanya bila berhasil mencapai jarak impact.',
    },
  ),
  active(
    'sweeping-slash',
    'Sweeping Slash',
    20,
    [...area, 'frontal_arc'],
    0.45,
    damageRows([
      [18, 1.05, 8, 10, 6],
      [22, 1.12, 9, 10, 6],
      [26, 1.18, 10, 10, 5.8],
      [30, 1.25, 11, 10, 5.8],
      [34, 1.32, 12, 10, 5.5],
    ]),
    {
      branch: 'assault',
      prerequisites: [req('strike', 2)],
      targetType: 'frontal_arc',
      range: 4.5,
      angle: 120,
      maxTargets: 5,
      description: 'Physical cleave di depan karakter, maksimal 5 target.',
    },
  ),
  buff(
    'guard-stance',
    'Guard Stance',
    20,
    0.25,
    [
      [5, 10, 14],
      [5.5, 10, 14],
      [6, 10, 13.5],
      [6.5, 10, 13],
      [7, 10, 12.5],
    ],
    (r) => [
      {
        id: id('guard-stance-buff'),
        stats: { flat: { blockRate: [4, 5, 7, 8, 10][r] } },
        incoming: { damageMultiplier: 1 - [12, 13.5, 15, 16.5, 18][r] / 100 },
      },
    ],
    {
      branch: 'guard',
      prerequisites: [req('strike', 2)],
      tags: ['warrior', 'guard', 'buff'],
      description:
        'Mengurangi incoming damage dan meningkatkan Block Rate sementara. Bukan Parry.',
    },
  ),
  active(
    'rising-slash',
    'Rising Slash',
    23,
    [...single, 'heavy'],
    0.5,
    damageRows([
      [22, 1.25, 20, 11, 7],
      [26, 1.33, 22, 11, 7],
      [30, 1.4, 24, 11, 6.8],
      [34, 1.48, 27, 11, 6.5],
      [38, 1.55, 30, 11, 6.3],
    ]),
    {
      branch: 'control',
      prerequisites: [req('iron-charge', 2)],
      knockbackStrength: 0.15,
      description:
        'Physical strike dengan knockback ringan. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    },
  ),
  active(
    'armor-breaker',
    'Armor Breaker',
    26,
    [...single, 'debuff', 'armor_break'],
    0.55,
    damageRows([
      [24, 1.3, 12, 12, 9],
      [28, 1.36, 12, 12, 9],
      [32, 1.42, 13, 12, 8.8],
      [36, 1.48, 14, 12, 8.5],
      [40, 1.55, 16, 12, 8.5],
    ]).map((r, i) => ({ ...r, duration: [4, 4.5, 5, 5.5, 6][i] })),
    {
      branch: 'assault',
      prerequisites: [req('sweeping-slash', 2)],
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration) => ({
        statuses: [{ id: 'armor_break', duration }],
      })),
      description:
        'Physical strike, lalu Armor Break: defense target menjadi 80% selama durasi efek.',
    },
  ),
  buff(
    'battle-cry',
    'Battle Cry',
    29,
    0.3,
    [
      [8, 14, 24],
      [9, 14, 24],
      [10, 14, 23],
      [10, 14, 23],
      [11, 14, 22],
    ],
    (r) => [
      {
        id: id('battle-cry-buff'),
        stats: {
          percent: { physicalAttack: [2.5, 3.5, 4.5, 5.5, 6.5][r] },
        },
      },
    ],
    {
      branch: 'control',
      prerequisites: [req('iron-charge', 2)],
      description:
        'Meningkatkan Physical Attack diri sendiri sementara.',
    },
  ),
  active(
    'counter-slash',
    'Counter Slash',
    32,
    [...single, 'counter'],
    0.35,
    damageRows([
      [15, 0.85, 7, 9, 6],
      [18, 0.9, 8, 9, 6],
      [21, 0.95, 9, 9, 5.8],
      [24, 1, 10, 9, 5.7],
      [27, 1.05, 11, 9, 5.5],
    ]),
    {
      branch: 'guard',
      prerequisites: [req('guard-stance', 3)],
      counterPolicy: {
        accepted: ['blocked', 'parried'],
        windowMs: WARRIOR_COUNTER_WINDOW_MS,
      },
      rankEffects: counter(
        'counter-slash',
        [55, 60, 65, 70, 75],
        [85, 90, 100, 110, 120],
        [7, 8, 9, 10, 11],
        [11, 12, 13, 14, 16],
        [14, 15, 17, 18, 20],
      ),
      description:
        'Lebih kuat setelah Block atau Parry dalam 2,5 detik; mengonsumsi satu kesempatan counter.',
    },
  ),
  active(
    'ground-breaker',
    'Ground Breaker',
    35,
    [...area, 'heavy'],
    0.65,
    damageRows([
      [24, 1.1, 24, 15, 11],
      [28, 1.15, 26, 15, 11],
      [32, 1.2, 28, 15, 10.5],
      [36, 1.26, 30, 15, 10.5],
      [40, 1.32, 34, 15, 10],
    ]).map((r, i) => ({ ...r, radius: [4, 4, 4.25, 4.25, 4.5][i] })),
    {
      branch: 'control',
      prerequisites: [req('rising-slash', 3)],
      targetType: 'area',
      range: 0,
      description:
        'Physical damage di sekitar karakter, tanpa knockback. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    },
  ),
  buff(
    'battle-focus',
    'Battle Focus',
    38,
    0.25,
    [
      [8, 14, 24],
      [8.5, 14, 24],
      [9, 14, 23],
      [9.5, 14, 23],
      [10, 14, 22],
    ],
    (r) => [
      {
        id: id('battle-focus-buff'),
        stats: {
          flat: {
            accuracy: [6, 8, 10, 11, 12][r],
            criticalRate: [1.5, 1.8, 2.2, 2.6, 3][r],
          },
        },
      },
    ],
    {
      branch: 'precision',
      prerequisites: [req('battle-cry', 2)],
      description: 'Meningkatkan Accuracy dan Critical Rate sementara.',
    },
  ),
  active(
    'severing-arc',
    'Severing Arc',
    41,
    [...area, 'frontal_arc', 'heavy'],
    0.6,
    damageRows([
      [28, 1.55, 16, 15, 9],
      [32, 1.65, 17, 15, 9],
      [36, 1.75, 18, 15, 8.8],
      [40, 1.85, 20, 15, 8.5],
      [44, 1.95, 22, 15, 8.5],
    ]),
    {
      branch: 'assault',
      prerequisites: [req('armor-breaker', 3)],
      targetType: 'frontal_arc',
      range: 5,
      angle: 70,
      maxTargets: 3,
      description:
        'Physical cleave sempit dan kuat di depan karakter, maksimal 3 target.',
    },
  ),
  active(
    'relentless-assault',
    'Relentless Assault',
    44,
    [...single, 'multi_hit'],
    0.75,
    [10, 10, 9.8, 9.7, 9.5].map((cooldown) => ({ manaCost: 18, cooldown })),
    {
      branch: 'precision',
      prerequisites: [req('battle-focus', 2), req('combat-instinct', 2)],
      effect: 'rapid_damage',
      description:
        'Tiga hit berurutan; hit terakhir paling kuat. Momentum/Rhythm maksimal satu trigger per cast.',
      rankEffects: [
        [
          [4, 0.5, 3],
          [4, 0.55, 4],
          [12, 0.85, 11],
        ],
        [
          [5, 0.54, 3],
          [5, 0.59, 5],
          [14, 0.9, 12],
        ],
        [
          [6, 0.58, 4],
          [6, 0.63, 5],
          [16, 0.96, 13],
        ],
        [
          [7, 0.62, 4],
          [7, 0.67, 6],
          [18, 1.02, 14],
        ],
        [
          [8, 0.66, 5],
          [8, 0.72, 6],
          [20, 1.1, 16],
        ],
      ].map((hits) => ({
        hitSequence: hits.map(
          ([baseDamage, physicalCoefficient], i) => ({
            delay: [0, 0.18, 0.42][i],
            baseDamage,
            physicalCoefficient,
            knockbackStrength: 0,
          }),
        ),
      })),
    },
  ),
  buff(
    'unbroken-stance',
    'Unbroken Stance',
    47,
    0.3,
    [
      [6, 16, 26],
      [6.5, 16, 26],
      [7, 16, 25.5],
      [7.5, 16, 25.5],
      [8, 16, 25],
    ],
    (r) => [
      {
        id: id('unbroken-stance-buff'),
        incoming: {
          damageMultiplier: 1 - [4, 5, 6, 6.5, 7][r] / 100,
          knockbackMultiplier: 1 - [20, 25, 30, 35, 40][r] / 100,
        },
      },
    ],
    {
      branch: 'guard',
      prerequisites: [req('guard-stance', 3), req('battle-cry', 2)],
      tags: ['warrior', 'guard', 'buff'],
      description:
        'Mengurangi incoming damage dan knockback sementara; bukan immunity.',
    },
  ),
  active(
    'iron-reversal',
    'Iron Reversal',
    50,
    [...single, 'counter'],
    0.5,
    damageRows([
      [22, 1.05, 14, 14, 10],
      [28, 1.15, 16, 14, 9.5],
      [34, 1.25, 18, 14, 9],
    ]),
    {
      branch: 'guard',
      prerequisites: [req('counter-slash', 3), req('guard-training', 3)],
      counterPolicy: {
        accepted: ['parried'],
        windowMs: WARRIOR_COUNTER_WINDOW_MS,
      },
      rankEffects: counter(
        'iron-reversal',
        undefined,
        [80, 95, 115],
        [14, 16, 18],
        undefined,
        [28, 34, 42],
      ),
      description:
        'Sangat diperkuat oleh Parry dalam 2,5 detik. Block tidak memberikan payoff khusus.',
    },
  ),
  active(
    'crushing-finale',
    'Crushing Finale',
    55,
    [...single, 'heavy', 'finisher'],
    0.85,
    damageRows([
      [36, 2.2, 30, 24, 18],
      [44, 2.4, 34, 24, 17],
      [52, 2.6, 38, 24, 16],
    ]),
    {
      branch: 'assault',
      range: 4,
      prerequisites: [req('armor-breaker', 4), req('ground-breaker', 3)],
      description:
        'Bonus damage terhadap target dengan Armor Break. REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
      rankEffects: [0, 1, 2].map((r) => ({
        modifiers: [
          {
            id: id('finale-armor'),
            layer: 'payoff',
            payoffGroup: id('finale-payoff'),
            condition: { targetStatuses: ['armor_break'] },
            action: { damagePercent: [10, 15, 20][r] },
          },
        ],
      })),
    },
  ),
  buff(
    'awakening',
    'Warrior Awakening',
    59,
    0.45,
    [
      [12, 32, 50],
      [13, 32, 48],
      [14, 32, 46],
    ],
    (r) => [
      {
        id: id('awakening-damage'),
        selector: direct,
        action: {
          damagePercent: [6, 8, 10][r],
        },
      },
      ...(r === 2
        ? [
            {
              id: id('awakening-mana'),
              selector: scoped,
              action: { manaPercent: -10 },
            },
          ]
        : []),
    ],
    {
      branch: 'general',
      investmentRequirement: { tree: WARRIOR_TREE, paidRanks: 25 },
      tags: ['warrior', 'buff', 'awakening'],
      description:
        'Memperkuat skill Warrior V2 berikutnya sementara. Tidak memengaruhi basic attack, Adventurer, atau hit yang sudah berjalan.',
    },
  ),
];

function passive(
  slug: string,
  name: string,
  level: number,
  rankModifiers: CombatModifier[][],
  extra: Partial<PassiveDefinition> = {},
): PassiveDefinition {
  return {
    id: id(slug),
    name,
    description: 'Passive Warrior.',
    job: 'warrior',
    specialization: null,
    tier: 'core',
    tree: WARRIOR_TREE,
    unlockLevel: level,
    maxLevel: rankModifiers.length,
    rankModifiers,
    ...extra,
  };
}
const ranks = (n: number, fn: (r: number) => CombatModifier[]) =>
  Array.from({ length: n }, (_, r) => fn(r));
const empty = (n: number) => ranks(n, () => []);
export const WARRIOR_V2_PASSIVES: PassiveDefinition[] = [
  passive(
    'conditioning',
    'Warrior Conditioning',
    15,
    ranks(5, (r) => [
      {
        id: id('conditioning'),
        stats: { percent: { maxHP: 2 * (r + 1), physicalDefense: r + 1 } },
      },
    ]),
    {
      branch: 'general',
      description: 'Per rank: Max HP +2%, Physical Defense +1%.',
    },
  ),
  passive(
    'weapon-discipline',
    'Weapon Discipline',
    18,
    ranks(5, (r) => [
      {
        id: id('weapon-discipline'),
        selector: { weaponStyles: WARRIOR_STYLES },
        stats: { percent: { physicalAttack: 0.8 * (r + 1) } },
      },
    ]),
    {
      branch: 'general',
      description:
        'Per rank: Physical Attack +0,8% dengan senjata Warrior yang sesuai.',
    },
  ),
  passive(
    'firm-footing',
    'Firm Footing',
    21,
    empty(5),
    {
      branch: 'guard',
      description: 'REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    },
  ),
  passive(
    'guard-training',
    'Guard Training',
    24,
    ranks(5, (r) => [
      {
        id: id('guard-training'),
        condition: { guardingOrBuff: id('guard-stance-buff') },
        stats: { flat: { blockRate: 3 * (r + 1) } },
      },
    ]),
    {
      branch: 'guard',
      prerequisites: [req('guard-stance', 1)],
      description:
        'Per rank: Block Rate +3 selama manual guard atau Guard Stance aktif. Tidak memberi Parry.',
    },
  ),
  passive(
    'combat-instinct',
    'Combat Instinct',
    27,
    ranks(5, (r) => [
      {
        id: id('combat-instinct'),
        stats: { flat: { accuracy: 2 * (r + 1), criticalRate: 0.5 * (r + 1) } },
      },
    ]),
    {
      branch: 'precision',
      description: 'Per rank: Accuracy +2 dan Critical Rate +0,5.',
    },
  ),
  passive(
    'heavy-impact',
    'Heavy Impact',
    30,
    empty(5),
    {
      branch: 'general',
      description: 'REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
    },
  ),
  passive('battle-momentum', 'Battle Momentum', 34, empty(5), {
    branch: 'general',
    description:
      'Cast skill Warrior yang menghasilkan damage membangun maksimal 3 stack, kedaluwarsa setelah 6 detik tanpa trigger. Bonus per stack 0,5/0,75/1/1,25/1,5%.',
    rankCombatSupport: [0.5, 0.75, 1, 1.25, 1.5].map((damagePercent) => ({
      stacks: [
        {
          id: id('battle-momentum'),
          duration: 6,
          maxStacks: 3,
          triggerTree: WARRIOR_TREE,
          modifier: {
            id: id('battle-momentum-bonus'),
            selector: direct,
            action: { damagePercent },
          },
        },
      ],
    })),
  }),
  passive(
    'counter-training',
    'Counter Training',
    38,
    ranks(5, (r) => [
      {
        id: id('counter-training'),
        selector: { tree: WARRIOR_TREE, tags: ['counter'] },
        condition: { counter: ['blocked', 'parried'] },
        action: { damagePercent: 2 * (r + 1) },
      },
    ]),
    {
      branch: 'guard',
      prerequisites: [req('guard-training', 2)],
      description:
        'Per rank: counter damage +2% bila kesempatan defense diterima skill tersebut.',
    },
  ),
  passive(
    'adrenaline',
    'Adrenaline',
    43,
    ranks(3, (r) => [
      {
        id: id('adrenaline'),
        condition: { hpAtOrBelow: 0.35 },
        incoming: { damageMultiplier: 1 - [5, 7.5, 10][r] / 100 },
      },
    ]),
    {
      branch: 'guard',
      description:
        'Saat HP ≤35% Max HP: incoming damage berkurang 5/7,5/10%. Tidak menambah damage serangan.',
    },
  ),
  passive('indomitable-will', 'Indomitable Will', 48, empty(3), {
    branch: 'guard',
    description: 'REQUIRES_REDESIGN_AFTER_WARRIOR_AUDIT.',
  }),
  passive(
    'great-weapon-familiarity',
    'Great Weapon Familiarity',
    25,
    ranks(5, (r) => [
      {
        id: id('great-weapon-familiarity'),
        selector: { ...heavy, weaponStyles: ['greatsword'] },
        action: { damagePercent: 0.8 * (r + 1) },
      },
    ]),
    {
      branch: 'great_weapon',
      description:
        'Dengan greatsword, per rank: heavy skill damage +0,8%.',
    },
  ),
  passive('great-weapon-momentum', 'Great Weapon Momentum', 40, empty(3), {
    branch: 'great_weapon',
    prerequisites: [req('great-weapon-familiarity', 3)],
    description:
      'Heavy Warrior yang mengenai target membuka bonus untuk heavy berikutnya selama 5 detik. Damage +3/4,5/6%; cast pemakai tidak membuka ulang window.',
    rankCombatSupport: [0, 1, 2].map((r) => ({
      windows: [
        {
          id: id('great-weapon-momentum'),
          duration: 5,
          tags: ['heavy'],
          weaponStyle: 'greatsword',
          triggerTree: WARRIOR_TREE,
          openOnSuccess: true,
          modifier: {
            id: id('great-weapon-momentum-bonus'),
            selector: heavy,
            action: {
              damagePercent: [3, 4.5, 6][r],
            },
          },
        },
      ],
    })),
  }),
  passive(
    'twin-blade-familiarity',
    'Twin Blade Familiarity',
    25,
    ranks(5, (r) => [
      {
        id: id('twin-blade-familiarity'),
        selector: { weaponStyles: ['dual_sword'] },
        stats: { flat: { accuracy: r + 1, criticalRate: 0.5 * (r + 1) } },
      },
    ]),
    {
      branch: 'twin_blade',
      description:
        'Dengan dua one-hand sword, per rank: Accuracy +1 dan Critical Rate +0,5.',
    },
  ),
  passive('twin-blade-rhythm', 'Twin Blade Rhythm', 40, empty(3), {
    branch: 'twin_blade',
    prerequisites: [req('twin-blade-familiarity', 3)],
    description:
      'Dengan dual sword, cast skill Warrior yang menghasilkan damage membangun maksimal 3 stack selama 5 detik. Bonus damage multi-hit per stack 1/1,5/2%; bukan per hit.',
    rankCombatSupport: [1, 1.5, 2].map((damagePercent) => ({
      stacks: [
        {
          id: id('twin-blade-rhythm'),
          duration: 5,
          maxStacks: 3,
          weaponStyle: 'dual_sword',
          triggerTree: WARRIOR_TREE,
          modifier: {
            id: id('twin-blade-rhythm-bonus'),
            selector: { ...direct, tags: ['physical', 'multi_hit'] },
            action: { damagePercent },
          },
        },
      ],
    })),
  }),
];
