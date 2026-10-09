export const SERPENT_GUARDIAN_ID =
  'abysal-trench-underwater-v1-serpent-guardian';
export const SERPENT_BOSS_ID = 'abysal-trench-underwater-v1-sea-serpent';
export const isSeaSerpent = (id?: string) =>
  id === SERPENT_GUARDIAN_ID || id === SERPENT_BOSS_ID;
export type SerpentAttack = {
  id: string;
  label: string;
  windup: number;
  recovery: number;
  damage: number;
  shape: 'bite' | 'sweep' | 'circle' | 'line' | 'target';
  reach: number;
  width: number;
  skill: boolean;
  color: string;
};
export const GUARDIAN_ATTACKS: readonly SerpentAttack[] = [
  {
    id: 'guardian-bite',
    label: 'Guardian Bite',
    windup: 1.45,
    recovery: 1.65,
    damage: 1,
    shape: 'bite',
    reach: 3.2,
    width: 4,
    skill: false,
    color: '#ffa66c',
  },
  {
    id: 'guardian-tail',
    label: 'Guardian Tail Sweep',
    windup: 1.6,
    recovery: 1.85,
    damage: 1,
    shape: 'sweep',
    reach: 10,
    width: 7,
    skill: false,
    color: '#ffa66c',
  },
];
export const BOSS_ATTACKS: readonly SerpentAttack[] = [
  {
    id: 'serpent-bite',
    label: 'Crushing Bite',
    windup: 1.5,
    recovery: 2.2,
    damage: 1,
    shape: 'bite',
    reach: 5.6,
    width: 10,
    skill: false,
    color: '#ff965f',
  },
  {
    id: 'serpent-tail',
    label: 'Titan Tail Sweep',
    windup: 1.9,
    recovery: 2.2,
    damage: 1,
    shape: 'sweep',
    reach: 27,
    width: 18,
    skill: false,
    color: '#ff965f',
  },
  {
    id: 'serpent-slam',
    label: 'Abyssal Head Slam',
    windup: 1.8,
    recovery: 2.4,
    damage: 1.1,
    shape: 'target',
    reach: 30,
    width: 8,
    skill: false,
    color: '#ff965f',
  },
  {
    id: 'serpent-coil',
    label: 'Coiling Crush',
    windup: 2,
    recovery: 2.3,
    damage: 1.1,
    shape: 'circle',
    reach: 26,
    width: 26,
    skill: false,
    color: '#ff965f',
  },
  {
    id: 'serpent-pressure',
    label: 'Crimson Pressure Jet',
    windup: 2.4,
    recovery: 3,
    damage: 1.3,
    shape: 'line',
    reach: 48,
    width: 8,
    skill: true,
    color: '#ff3e54',
  },
  {
    id: 'serpent-pulse',
    label: 'Abyssal Rupture',
    windup: 2.6,
    recovery: 3.2,
    damage: 1.35,
    shape: 'target',
    reach: 50,
    width: 13,
    skill: true,
    color: '#bb76ff',
  },
];
export type SerpentStrike = {
  attack: SerpentAttack;
  elapsed: number;
  hit: boolean;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
};
/** Locked tells and horizontal hit shapes; visuals never move the gameplay root. */
export function serpentStrikeContains(
  s: SerpentStrike,
  p: { x: number; z: number },
  bodyReach: number,
) {
  const dx = p.x - s.x,
    dz = p.z - s.z;
  const forward = -dx * Math.sin(s.yaw) - dz * Math.cos(s.yaw);
  const side = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
  switch (s.attack.shape) {
    case 'bite':
      return (
        forward >= -2 &&
        forward <= bodyReach + s.attack.reach &&
        Math.abs(side) <= s.attack.width
      );
    case 'line':
      return (
        forward >= 0 &&
        forward <= bodyReach + s.attack.reach &&
        Math.abs(side) <= s.attack.width / 2
      );
    case 'target':
      return Math.hypot(p.x - s.targetX, p.z - s.targetZ) <= s.attack.width;
    case 'sweep':
      return Math.hypot(dx, dz) <= s.attack.reach;
    case 'circle':
      return Math.hypot(dx, dz) <= s.attack.reach;
  }
}
