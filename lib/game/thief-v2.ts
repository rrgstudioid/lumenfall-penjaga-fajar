/** Phase 4C owner contract. Development authorization only; not a public promotion. */
import type {
  SkillDefinition,
  SkillRankValues,
  PassiveDefinition,
  WeaponType,
} from './skills.ts';
import type { CombatModifier } from './combat-modifiers.ts';
export const THIEF_TREE = { id: 'thief', architecture: 'v2' } as const;
export const THIEF_STYLES: WeaponType[] = ['dagger', 'dual_dagger'];
const id = (s: string) => `v2-thief-${s}`;
const req = (s: string, requiredRank: number) => ({
  skillId: id(s),
  requiredRank,
});
const single = ['physical', 'melee', 'single_target'];
const scope = { tree: THIEF_TREE };
const direct = { ...scope, tags: ['physical'] };
const descriptions: Record<string, string> = {
  'quick-stab':
    'Serangan physical singkat pada target pilihan. Rank 1 diberikan gratis saat otorisasi Thief development.',
  'twin-fang':
    'Dua hit nyata, hit kedua lebih kuat. Memerlukan dua dagger; bukan double basic attack.',
  'marked-strike':
    'Personal Mark milikmu menambah Crit Rate dan Crit Damage action ini. Tidak mengonsumsi Mark.',
  'silent-opening':
    'Snapshot Stealth pada cast valid menambah Crit Rate dan Crit Damage; commit mengakhiri Stealth.',
  'rear-rend':
    'Serangan dari sektor belakang 90° memperkuat total raw damage. Posisi diperiksa saat impact.',
  'weakpoint-assault':
    'Personal Mark dan posisi belakang menambah payoff dalam satu kelompok aditif. Mark tidak dikonsumsi.',
  'agile-conditioning':
    'Setiap rank: Max HP +1.5% dan Evasion +1 percentage point.',
  'dagger-discipline':
    'Setiap rank: Physical Attack +0.8% saat menggunakan dagger atau dual dagger.',
  'keen-instinct': 'Setiap rank: Critical Rate +0.5 percentage point.',
  'shadow-discipline':
    'Setiap rank: durasi skill Stealth Thief +5%. Bukan invisibility terhadap AI.',
  'dual-dagger-familiarity':
    'Dengan dual dagger, tiap rank: damage action physical Thief +0.5% dan Crit Rate +0.5 point. Tidak mengubah basic attack.',
  'mark-expertise':
    'Setiap rank: durasi personal Mark +0.5 detik; bukan bonus damage.',
  'fleet-footing':
    'Setiap rank: jarak Slipstep/Disengage +0.15m. Tidak menambah range targeted dash.',
  venomcraft:
    'Setiap rank: durasi Poison skill Thief +0.4 detik. Formula tick tetap.',
  'rear-awareness':
    'Setiap rank: Crit Rate +1 point hanya untuk skill rear-synergy saat benar-benar menyerang dari belakang.',
  opportunist:
    'Setiap rank: Crit Rate +1 point hanya pada skill mark-synergy terhadap personal Mark milikmu.',
  'twin-edge-control':
    'Dengan dual dagger: Crit Damage multi-hit Thief +5 / +10 / +15 points.',
  'rapid-technique':
    'Setiap rank: damage multi-hit Thief +1.5%. Timing hit tidak dipercepat.',
  'evasive-instinct':
    'Saat HP ≤35% Max HP efektif: Evasion +5 / +8 / +12 points, tetap mengikuti cap existing.',
  'silent-opportunity':
    'Satu cast offensive Thief dari Stealth: Crit Damage +5 / +10 / +15 points. Satu snapshot berlaku pada seluruh hit cast itu, bukan trigger ulang atau bonus cast berikutnya.',
};
function active(
  slug: string,
  name: string,
  level: number,
  lock: number,
  rows: SkillRankValues[],
  extra: Partial<SkillDefinition> = {},
): SkillDefinition {
  // Owner-final Core Thief melee range: 3.5m at every rank.
  // Mark Prey and Shadow Lunge retain their explicit range overrides.
  return {
    id: id(slug),
    name,
    description: descriptions[slug] ?? name,
    job: 'thief',
    specialization: null,
    tree: THIEF_TREE,
    slot: 1,
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
    range: 3.5,
    areaRadius: 0,
    duration: 0,
    knockbackStrength: 0,
    statusEffect: null,
    effect: 'damage',
    animation: 'basic_attack',
    visualEffect: 'damage',
    soundEffect: 'attack',
    weaponRequirement: [...THIEF_STYLES],
    masteryOptions: [],
    tags: ['thief', ...single],
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
const rows = (values: number[][]) =>
  values.map(
    ([baseDamage, physicalCoefficient, _legacyValue, manaCost, cooldown]) => ({
      baseDamage,
      physicalCoefficient,
      manaCost,
      cooldown,
    }),
  );
const tag = (...tags: string[]) => ['thief', ...single, ...tags];
const marked = (
  slug: string,
  crit: number,
  damage: number = 0,
): CombatModifier => ({
  id: id(slug),
  condition: { markedBySelf: true },
  action: { criticalRateBonus: crit, criticalDamageBonus: damage },
});
function self(
  slug: string,
  name: string,
  level: number,
  lock: number,
  values: number[][],
  extra: Partial<SkillDefinition> = {},
) {
  return active(
    slug,
    name,
    level,
    lock,
    values.map(([duration, manaCost, cooldown]) => ({
      duration,
      manaCost,
      cooldown,
    })),
    {
      targetType: 'self',
      effect: 'buff',
      actionType: 'buff',
      canCrit: false,
      range: 0,
      weaponRequirement: [],
      tags: ['thief', 'buff'],
      movementAllowedDuringLock: true,
      ...extra,
    },
  );
}
export const THIEF_V2_ACTIVE: SkillDefinition[] = [
  active(
    'quick-stab',
    'Quick Stab',
    15,
    0.22,
    rows([
      [14, 0.95, 3, 5, 3],
      [18, 1, 3, 5, 3],
      [22, 1.05, 4, 5, 2.9],
      [26, 1.1, 4, 5, 2.9],
      [30, 1.15, 5, 5, 2.8],
    ]),
  ),
  active(
    'slipstep',
    'Slipstep',
    17,
    0.3,
    [3.5, 3.75, 4, 4.25, 4.5].map((movementDistance, i) => ({
      movementDistance,
      manaCost: 6,
      cooldown: [6.5, 6.2, 6, 5.8, 5.5][i],
    })),
    {
      prerequisites: [req('quick-stab', 1)],
      targetType: 'self',
      effect: 'movement',
      actionType: 'movement',
      canCrit: false,
      weaponRequirement: [],
      range: 0,
      tags: ['thief', 'mobility', 'directional'],
      directionalMovement: { direction: 'input' },
      description:
        'Gerak sesuai input, atau arah hadap tanpa input. Tanpa invulnerability.',
    },
  ),
  active(
    'mark-prey',
    'Mark Prey',
    19,
    0.2,
    [10, 11, 12, 13, 14].map((duration) => ({
      duration,
      manaCost: 8,
      cooldown: 6,
    })),
    {
      prerequisites: [req('quick-stab', 2)],
      range: 8,
      effect: 'mark',
      actionType: 'debuff',
      canCrit: false,
      personalMark: true,
      weaponRequirement: [],
      tags: ['thief', 'mark'],
      movementAllowedDuringLock: true,
      description:
        'Satu personal Mark milik caster. Recast refresh; target baru memindahkan Mark sendiri.',
    },
  ),
  self(
    'smoke-veil',
    'Smoke Veil',
    21,
    0.3,
    [
      [3.5, 12, 18],
      [4, 12, 17.5],
      [4.5, 12, 17],
      [5, 12, 16.5],
      [5.5, 12, 16],
    ],
    {
      prerequisites: [req('slipstep', 2)],
      effect: 'stealth',
      tags: ['thief', 'buff', 'stealth'],
      stealthPolicy: {
        breakOn: ['basic_attack', 'offensive_skill', 'received_damage'],
      },
      description:
        'Stealth combat sementara; bukan invisibility terhadap AI. Serangan valid atau HP damage mengakhirinya.',
    },
  ),
  active(
    'twin-fang',
    'Twin Fang',
    23,
    0.42,
    [5.5, 5.4, 5.3, 5.1, 5].map((cooldown) => ({ manaCost: 9, cooldown })),
    {
      prerequisites: [req('quick-stab', 2)],
      weaponRequirement: ['dual_dagger'],
      tags: tag('multi_hit', 'dual_dagger'),
      effect: 'rapid_damage',
      rankEffects: [
        [
          [4, 0.5, 2],
          [8, 0.75, 4],
        ],
        [
          [5, 0.54, 2],
          [10, 0.79, 4],
        ],
        [
          [6, 0.58, 2],
          [12, 0.84, 5],
        ],
        [
          [7, 0.62, 3],
          [14, 0.89, 5],
        ],
        [
          [8, 0.65, 3],
          [16, 0.95, 6],
        ],
      ].map((hits) => ({
        hitSequence: hits.map(
          ([baseDamage, physicalCoefficient], i) => ({
            delay: [0, 0.2][i],
            baseDamage,
            physicalCoefficient,
            knockbackStrength: 0,
          }),
        ),
      })),
    },
  ),
  active(
    'crippling-cut',
    'Crippling Cut',
    25,
    0.35,
    rows([
      [18, 1.05, 4, 10, 7],
      [22, 1.1, 4, 10, 6.9],
      [26, 1.15, 5, 10, 6.8],
      [30, 1.22, 5, 10, 6.6],
      [34, 1.3, 6, 10, 6.5],
    ]),
    {
      prerequisites: [req('mark-prey', 1)],
      tags: tag('rear_synergy', 'debuff'),
      rankEffects: [2.5, 3, 3.5, 4, 4.5].map((duration, i) => ({
        statuses: [
          {
            id: 'slow',
            duration,
            potency: 0.2,
            rearDurationBonus: [0.75, 0.9, 1.1, 1.3, 1.5][i],
          },
        ],
      })),
      description: 'Slow 20%; serangan dari belakang hanya memperpanjang Slow.',
    },
  ),
  active(
    'venom-edge',
    'Venom Edge',
    28,
    0.35,
    rows([
      [18, 1.1, 0, 11, 8],
      [22, 1.16, 0, 11, 7.8],
      [26, 1.22, 0, 11, 7.5],
      [30, 1.28, 0, 11, 7.2],
      [34, 1.35, 0, 11, 7],
    ]),
    {
      prerequisites: [req('twin-fang', 2)],
      tags: tag('poison'),
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration) => ({
        statuses: [{ id: 'poison', duration }],
      })),
      description:
        'Direct physical damage + Poison dengan formula tick existing.',
    },
  ),
  self(
    'evasive-feint',
    'Evasive Feint',
    31,
    0.25,
    [
      [4, 10, 18],
      [4.5, 10, 17.5],
      [5, 10, 17],
      [5.5, 10, 16.5],
      [6, 10, 16],
    ],
    {
      prerequisites: [req('slipstep', 2)],
      tags: ['thief', 'buff', 'evasion'],
      rankEffects: [4, 4.5, 5, 5.5, 6].map((duration, i) => ({
        temporaryBuffs: [
          {
            duration,
            modifier: {
              id: id('evasive-feint-buff'),
              stats: { flat: { evasion: [8, 10, 12, 14, 16][i] } },
            },
          },
        ],
      })),
      description:
        'Evasion sementara, tetap mengikuti combat cap. Bukan iframe.',
    },
  ),
  active(
    'shadow-lunge',
    'Shadow Lunge',
    34,
    0.45,
    rows([
      [16, 0.85, 4, 11, 7.5],
      [19, 0.9, 4, 11, 7.3],
      [22, 0.95, 5, 11, 7],
      [25, 1, 5, 11, 6.8],
      [28, 1.05, 6, 11, 6.5],
    ]).map((r, i) => ({ ...r, range: [6.5, 6.75, 7, 7.5, 8][i] })),
    {
      prerequisites: [req('slipstep', 3), req('mark-prey', 1)],
      tags: tag('mobility', 'mark_synergy'),
      effect: 'dash_damage',
      dash: { stopDistance: 2.5, impactRange: 2.5 },
      rankEffects: [6, 7, 8, 9, 10].map((c) => ({
        modifiers: [marked('lunge-mark', c)],
      })),
      description:
        'Charge collision-aware ke target pilihan; personal Mark menambah Crit Rate.',
    },
  ),
  active(
    'marked-strike',
    'Marked Strike',
    37,
    0.32,
    rows([
      [20, 1.1, 0, 10, 6],
      [24, 1.16, 0, 10, 5.9],
      [28, 1.22, 0, 10, 5.8],
      [32, 1.28, 0, 10, 5.6],
      [36, 1.35, 0, 10, 5.5],
    ]),
    {
      prerequisites: [req('mark-prey', 3)],
      tags: tag('mark_synergy'),
      rankEffects: [8, 9, 10, 12, 14].map((c, i) => ({
        modifiers: [marked('strike-mark', c, [8, 10, 12, 14, 16][i])],
      })),
    },
  ),
  active(
    'blade-flurry',
    'Blade Flurry',
    40,
    0.68,
    [9, 8.8, 8.5, 8.2, 8].map((cooldown) => ({ manaCost: 15, cooldown })),
    {
      prerequisites: [req('twin-fang', 3)],
      tags: tag('multi_hit', 'dual_dagger'),
      weaponRequirement: ['dual_dagger'],
      effect: 'rapid_damage',
      rankEffects: [
        [
          [3, 0.4],
          [4, 0.45],
          [8, 0.7],
        ],
        [
          [4, 0.42],
          [5, 0.49],
          [9, 0.74],
        ],
        [
          [5, 0.45],
          [6, 0.53],
          [10, 0.79],
        ],
        [
          [6, 0.48],
          [7, 0.56],
          [12, 0.84],
        ],
        [
          [7, 0.5],
          [8, 0.6],
          [14, 0.9],
        ],
      ].map((hits, _r) => ({
        hitSequence: hits.map(([baseDamage, physicalCoefficient], i) => ({
          delay: [0, 0.16, 0.38][i],
          baseDamage,
          physicalCoefficient,
          knockbackStrength: 0,
        })),
      })),
      description:
        'Tiga hit nyata; ASPD tidak mengubah timing.',
    },
  ),
  active(
    'silent-opening',
    'Silent Opening',
    43,
    0.45,
    rows([
      [22, 1.2, 0, 14, 10],
      [26, 1.27, 0, 14, 9.8],
      [30, 1.34, 0, 14, 9.5],
      [34, 1.42, 0, 14, 9.2],
      [38, 1.5, 0, 14, 9],
    ]),
    {
      prerequisites: [req('smoke-veil', 3)],
      tags: tag('stealth_opener'),
      rankEffects: [12, 15, 18, 21, 24].map((c, i) => ({
        modifiers: [
          {
            id: id('opening-stealth'),
            conditionTiming: 'cast',
            condition: { attackerStealthed: true },
            action: {
              criticalRateBonus: c,
              criticalDamageBonus: [10, 12, 14, 16, 18][i],
            },
          },
        ],
      })),
    },
  ),
  active(
    'rear-rend',
    'Rear Rend',
    46,
    0.5,
    rows([
      [24, 1.25, 7, 13, 8.5],
      [28, 1.32, 8, 13, 8.3],
      [32, 1.4, 8, 13, 8],
      [36, 1.47, 9, 13, 7.8],
      [40, 1.55, 10, 13, 7.5],
    ]),
    {
      prerequisites: [req('crippling-cut', 3)],
      tags: tag('rear_synergy'),
      rankEffects: [12, 15, 18, 21, 25].map((damagePercent) => ({
        modifiers: [
          {
            id: id('rend-rear'),
            layer: 'payoff',
            condition: {
              targetPosition: 'rear',
              positionAngles: { rearAngle: 90 },
            },
            action: { damagePercent },
          },
        ],
      })),
    },
  ),
  active(
    'disengage',
    'Disengage',
    49,
    0.3,
    [4, 4.25, 4.5, 4.75, 5].map((movementDistance, i) => ({
      movementDistance,
      manaCost: 8,
      cooldown: [10, 9.6, 9.2, 8.8, 8.5][i],
    })),
    {
      prerequisites: [req('slipstep', 3), req('fleet-footing', 2)],
      targetType: 'self',
      effect: 'movement',
      actionType: 'movement',
      canCrit: false,
      weaponRequirement: [],
      range: 0,
      tags: ['thief', 'mobility', 'directional'],
      directionalMovement: { direction: 'backward' },
      description:
        'Mundur relatif arah hadap saat cast, tanpa berputar atau iframe.',
    },
  ),
  active(
    'weakpoint-assault',
    'Weakpoint Assault',
    54,
    0.65,
    rows([
      [32, 1.85, 10, 22, 16],
      [40, 2.05, 12, 22, 15],
      [48, 2.25, 14, 22, 14],
    ]),
    {
      prerequisites: [req('marked-strike', 3), req('rear-rend', 3)],
      tags: tag('mark_synergy', 'rear_synergy', 'finisher'),
      rankEffects: [8, 12, 16].map((damagePercent) => ({
        modifiers: [
          {
            id: id('weakpoint-mark'),
            layer: 'payoff',
            payoffGroup: id('weakpoint-payoff'),
            condition: { markedBySelf: true },
            action: { damagePercent },
          },
          {
            id: id('weakpoint-rear'),
            layer: 'payoff',
            payoffGroup: id('weakpoint-payoff'),
            condition: {
              targetPosition: 'rear',
              positionAngles: { rearAngle: 90 },
            },
            action: { damagePercent },
          },
        ],
      })),
    },
  ),
  self(
    'instinct',
    'Thief Instinct',
    59,
    0.4,
    [
      [10, 28, 50],
      [11, 28, 48],
      [12, 28, 46],
    ],
    {
      investmentRequirement: { tree: THIEF_TREE, paidRanks: 25 },
      tags: ['thief', 'buff', 'major_state'],
      rankEffects: [10, 11, 12].map((duration, r) => ({
        temporaryBuffs: [
          {
            duration,
            modifier: {
              id: id('instinct-buff'),
              selector: scope,
              action: {
                criticalRateBonus: [5, 7, 10][r],
                criticalDamageBonus: [10, 15, 20][r],
                manaPercent: r === 2 ? -10 : 0,
              },
            },
          },
        ],
      })),
      description:
        'Memperkuat action Thief V2 yang baru di-resolve, bukan basic/Adventurer/hit yang sudah dijadwalkan.',
    },
  ),
];
function passive(
  slug: string,
  name: string,
  level: number,
  max: number,
  mods: (rank: number) => CombatModifier[],
  extra: Partial<PassiveDefinition> = {},
): PassiveDefinition {
  return {
    id: id(slug),
    name,
    description: descriptions[slug] ?? name,
    job: 'thief',
    specialization: null,
    tier: 'core',
    tree: THIEF_TREE,
    unlockLevel: level,
    maxLevel: max,
    rankModifiers: Array.from({ length: max }, (_, i) => mods(i + 1)),
    ...extra,
  };
}
export const THIEF_V2_PASSIVES: PassiveDefinition[] = [
  passive('agile-conditioning', 'Agile Conditioning', 15, 5, (r) => [
    {
      id: id('agile-conditioning'),
      stats: { percent: { maxHP: 1.5 * r }, flat: { evasion: r } },
    },
  ]),
  passive('dagger-discipline', 'Dagger Discipline', 18, 5, (r) => [
    {
      id: id('dagger-discipline'),
      selector: { weaponStyles: THIEF_STYLES },
      stats: { percent: { physicalAttack: 0.8 * r } },
    },
  ]),
  passive('keen-instinct', 'Keen Instinct', 21, 5, (r) => [
    { id: id('keen-instinct'), stats: { flat: { criticalRate: 0.5 * r } } },
  ]),
  passive(
    'shadow-discipline',
    'Shadow Discipline',
    24,
    5,
    (r) => [
      {
        id: id('shadow-discipline'),
        selector: { ...scope, tags: ['stealth'] },
        action: { durationPercent: 5 * r },
      },
    ],
    { prerequisites: [req('smoke-veil', 1)] },
  ),
  passive(
    'dual-dagger-familiarity',
    'Dual Dagger Familiarity',
    25,
    5,
    (r) => [
      {
        id: id('dual-dagger-familiarity'),
        selector: { ...direct, weaponStyles: ['dual_dagger'] },
        action: { damagePercent: 0.5 * r, criticalRateBonus: 0.5 * r },
      },
    ],
    { prerequisites: [req('dagger-discipline', 2), req('twin-fang', 1)] },
  ),
  passive(
    'mark-expertise',
    'Mark Expertise',
    27,
    5,
    (r) => [
      {
        id: id('mark-expertise'),
        selector: { ...scope, tags: ['mark'] },
        action: { durationBonus: 0.5 * r },
      },
    ],
    { prerequisites: [req('mark-prey', 1)] },
  ),
  passive(
    'fleet-footing',
    'Fleet Footing',
    30,
    5,
    (r) => [
      {
        id: id('fleet-footing'),
        selector: { ...scope, tags: ['directional'] },
        action: { movementDistanceBonus: 0.15 * r },
      },
    ],
    { prerequisites: [req('slipstep', 2)] },
  ),
  passive(
    'venomcraft',
    'Venomcraft',
    33,
    5,
    (r) => [
      {
        id: id('venomcraft'),
        selector: { ...scope, tags: ['poison'] },
        action: { statusDurationBonus: 0.4 * r },
      },
    ],
    { prerequisites: [req('venom-edge', 1)] },
  ),
  passive(
    'rear-awareness',
    'Rear Awareness',
    36,
    5,
    (r) => [
      {
        id: id('rear-awareness'),
        selector: { ...scope, tags: ['rear_synergy'] },
        condition: {
          targetPosition: 'rear',
          positionAngles: { rearAngle: 90 },
        },
        action: { criticalRateBonus: r },
      },
    ],
    { prerequisites: [req('crippling-cut', 2)] },
  ),
  passive(
    'opportunist',
    'Opportunist',
    39,
    5,
    (r) => [
      {
        id: id('opportunist'),
        selector: { ...scope, tags: ['mark_synergy'] },
        condition: { markedBySelf: true },
        action: { criticalRateBonus: r },
      },
    ],
    { prerequisites: [req('mark-expertise', 2)] },
  ),
  passive(
    'twin-edge-control',
    'Twin Edge Control',
    40,
    3,
    (r) => [
      {
        id: id('twin-edge-control'),
        selector: {
          ...scope,
          tags: ['multi_hit'],
          weaponStyles: ['dual_dagger'],
        },
        action: { criticalDamageBonus: 5 * r },
      },
    ],
    {
      prerequisites: [
        req('dual-dagger-familiarity', 3),
        req('blade-flurry', 2),
      ],
    },
  ),
  passive(
    'rapid-technique',
    'Rapid Technique',
    42,
    5,
    (r) => [
      {
        id: id('rapid-technique'),
        selector: { ...scope, tags: ['multi_hit'] },
        action: { damagePercent: 1.5 * r },
      },
    ],
    { prerequisites: [req('blade-flurry', 1)] },
  ),
  passive(
    'evasive-instinct',
    'Evasive Instinct',
    45,
    3,
    (r) => [
      {
        id: id('evasive-instinct'),
        condition: {
          hpAtOrBelow: 0.35,
          hpThresholdBasis: 'unconditional_final',
        },
        stats: { flat: { evasion: [5, 8, 12][r - 1] } },
      },
    ],
    { prerequisites: [req('evasive-feint', 3)] },
  ),
  // Owner-final: resolve once from cast-time Stealth; every queued hit keeps
  // this snapshot. Offensive commit breaks Stealth, so later casts get no bonus.
  passive(
    'silent-opportunity',
    'Silent Opportunity',
    48,
    3,
    (r) => [
      {
        id: id('silent-opportunity'),
        selector: direct,
        conditionTiming: 'cast',
        condition: { attackerStealthed: true },
        action: { criticalDamageBonus: 5 * r },
      },
    ],
    { prerequisites: [req('smoke-veil', 3), req('keen-instinct', 2)] },
  ),
];
