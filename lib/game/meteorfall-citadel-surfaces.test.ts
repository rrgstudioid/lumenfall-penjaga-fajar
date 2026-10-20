import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METEORFALL_PLATFORMS,
  METEORFALL_DECKS,
  meteorTopCell,
  meteorTopPatches,
  meteorStrip,
  clipMeteorPolygon,
  meteorGroundHeight,
  meteorWalkable,
} from './meteorfall-citadel-layout.ts';
import { meteorCliffAccents } from './meteorfall-citadel-cliff-accents.ts';

const area = (poly: { x: number; z: number }[]) =>
  Math.abs(
    poly.reduce((sum, p, i) => {
      const q = poly[(i + 1) % poly.length];
      return sum + p.x * q.z - q.x * p.z;
    }, 0),
  ) / 2;
await test('terrain, roads and deck landings partition each surface without overlaps or missing area', () => {
  const decks = METEORFALL_DECKS.map((b) => meteorStrip(b.a, b.b, b.deckWidth));
  let cells = 0;
  for (const p of METEORFALL_PLATFORMS)
    for (let x = p.x - p.width / 2; x < p.x + p.width / 2; x += 4)
      for (let z = p.z - p.depth / 2; z < p.z + p.depth / 2; z += 4) {
        const cell = meteorTopCell(p, x, z),
          patches = meteorTopPatches(p, x, z);
        const deckArea = decks.reduce(
          (sum, d) => sum + area(clipMeteorPolygon(cell, d)),
          0,
        );
        assert(
          Math.abs(
            area(cell) -
              deckArea -
              patches.reduce((sum, v) => sum + area(v.polygon), 0),
          ) < 1e-6,
          `${p.id} missing floor at ${x},${z}`,
        );
        for (let i = 0; i < patches.length; i++) {
          for (let j = i + 1; j < patches.length; j++)
            assert(
              area(clipMeteorPolygon(patches[i].polygon, patches[j].polygon)) <
                1e-6,
              'overlapping road/top',
            );
          for (const d of decks)
            assert(
              area(clipMeteorPolygon(patches[i].polygon, d)) < 1e-6,
              'overlapping deck/top',
            );
        }
        cells++;
      }
  assert(cells > 20000);
});
await test('all rotated cliff accent bounds stay below walkable surfaces, including bridge approaches', () => {
  let samples = 0;
  for (const p of METEORFALL_PLATFORMS)
    for (const type of [0, 1])
      for (const rock of meteorCliffAccents(p, type)) {
        const top = rock.y + rock.sy / 2;
        for (let u = -0.5; u <= 0.5; u += 0.1)
          for (let v = -0.5; v <= 0.5; v += 0.1) {
            const point = {
              x:
                rock.x +
                u * rock.sx * Math.cos(rock.yaw) +
                v * rock.sz * Math.sin(rock.yaw),
              z:
                rock.z -
                u * rock.sx * Math.sin(rock.yaw) +
                v * rock.sz * Math.cos(rock.yaw),
            };
            if (!meteorWalkable(point, 0.45)) continue;
            assert(
              top < meteorGroundHeight(point)! - 1.99,
              `${p.id}: rock protrudes at ${point.x},${point.z}`,
            );
            samples++;
          }
      }
  assert(samples > 1000);
});
