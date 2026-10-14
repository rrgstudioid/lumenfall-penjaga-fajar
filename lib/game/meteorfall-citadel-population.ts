import {
  METEORFALL_BOSS,
  METEORFALL_BRIDGES,
  meteorPlatform,
  meteorWalkable,
  meteorSafe,
} from './meteorfall-citadel-layout.ts';
import type { FieldDefinition } from './regions.ts';
import type { MonsterSpawn } from './field-layout.ts';
export const METEORFALL_NORMAL_COUNT = 288;
/** Owner revision: six times the normals; legacy IDs/positions and all elites/boss remain stable. */
export function meteorMonsterSpawns(field: FieldDefinition): MonsterSpawn[] {
  const normals = Array.from({ length: 36 }, (_, id) => {
    const p = meteorPlatform(
      ['SW', 'W', 'NW', 'SE', 'E', 'NE'][Math.floor(id / 6)],
    );
    return {
      id,
      x: p.x + ((id % 3) - 1) * 30,
      z: p.z + (Math.floor((id % 6) / 3) - 0.5) * 30,
      definition: field.normalMonsters[id % field.normalMonsters.length],
    };
  });
  const elites = ['W', 'E', 'NW', 'NE', 'A'].map((id, i) => {
    const p = meteorPlatform(id);
    return {
      id: 90 + i,
      x: p.x,
      z: p.z + (id === 'A' ? 0 : 60),
      definition: field.eliteMonsters[i % field.eliteMonsters.length],
    };
  });
  const additional = ['SW', 'W', 'NW', 'SE', 'E', 'NE'].flatMap(
    (region, regionIndex) => {
      const p = meteorPlatform(region);
      const occupied = [...normals, ...elites].filter(
        (s) => Math.hypot(s.x - p.x, s.z - p.z) < 120,
      );
      const docks = METEORFALL_BRIDGES.filter(
        (b) => b.from === region || b.to === region,
      ).map((b) => (b.from === region ? b.a : b.b));
      const candidates = Array.from({ length: 63 }, (_, i) => ({
        x: p.x + ((i % 9) - 4) * 20,
        z: p.z + (Math.floor(i / 9) - 3) * 20,
        order: (i * 37 + regionIndex * 13) % 67,
      }))
        .sort((a, b) => a.order - b.order)
        .filter(
          (q) =>
            meteorWalkable(q, 2) &&
            !meteorSafe(q) &&
            occupied.every((s) => Math.hypot(s.x - q.x, s.z - q.z) >= 16) &&
            docks.every((d) => Math.hypot(d.x - q.x, d.z - q.z) >= 16),
        );
      if (candidates.length < 30)
        throw new Error(
          `Insufficient safe Meteorfall spawn anchors: ${region}`,
        );
      return candidates.slice(0, 30).map((q, i) => ({
        id: 200 + regionIndex * 30 + i,
        x: q.x,
        z: q.z,
        definition:
          field.normalMonsters[
            (regionIndex * 30 + i) % field.normalMonsters.length
          ],
      }));
    },
  );
  // Owner revision: add 24 normals to each central combat platform; keep every
  // existing spawn identity and timer, and leave the southern safe area empty.
  const central = ['L', 'C', 'A'].flatMap((region, regionIndex) => {
    const p = meteorPlatform(region),
      dx = Math.min(24, (p.width - 64) / 8),
      dz = Math.min(24, (p.depth - 40) / 4);
    const docks = METEORFALL_BRIDGES.filter(
      (b) => b.from === region || b.to === region,
    ).map((b) => (b.from === region ? b.a : b.b));
    const candidates = Array.from({ length: 45 }, (_, i) => ({
      x: p.x + ((i % 9) - 4) * dx,
      z: p.z + (Math.floor(i / 9) - 2) * dz,
      order: (i * 19 + regionIndex * 7) % 47,
    }))
      .sort((a, b) => a.order - b.order)
      .filter(
        (q) =>
          meteorWalkable(q, 2) &&
          !meteorSafe(q) &&
          docks.every((d) => Math.hypot(d.x - q.x, d.z - q.z) >= 12) &&
          elites.every((e) => Math.hypot(e.x - q.x, e.z - q.z) >= 16),
      );
    if (candidates.length < 24)
      throw new Error(`Insufficient central Meteorfall anchors: ${region}`);
    return candidates.slice(0, 24).map((q, i) => ({
      id: 400 + regionIndex * 24 + i,
      x: q.x,
      z: q.z,
      definition:
        field.normalMonsters[
          (regionIndex * 24 + i) % field.normalMonsters.length
        ],
    }));
  });
  const spawns = [
    ...normals,
    ...additional,
    ...central,
    ...elites,
    ...(field.fieldBoss
      ? [
          {
            id: 100,
            x: METEORFALL_BOSS.x,
            z: METEORFALL_BOSS.z,
            definition: field.fieldBoss,
          },
        ]
      : []),
  ];
  for (const p of spawns)
    if (!meteorWalkable(p, p.id === 100 ? 1.8 : 0.55) || meteorSafe(p, 0))
      throw new Error(`Invalid Meteorfall spawn ${p.id}`);
  return spawns;
}
