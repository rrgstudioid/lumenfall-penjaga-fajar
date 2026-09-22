import test from 'node:test';
import assert from 'node:assert/strict';
import { EAST_GATE_TERRAIN, VERDANT_TERRAIN, terrainHeight, terrainWalkable } from './field-terrain.ts';
import { FIELDS } from './regions.ts';
import { fieldSpawns } from './field-layout.ts';

await test('Padang Arunika expands horizontally without scaling actors or elevation', () => {
  const padang = VERDANT_TERRAIN;
  const east = EAST_GATE_TERRAIN;
  assert.equal(padang.id, 'verdant-plains');
  assert.equal(padang.horizontalScale, 2);
  assert.equal(east.horizontalScale, undefined);

  const padangExtent = Math.max(...padang.boundary.flatMap(p => [Math.abs(p.x), Math.abs(p.z)]));
  const eastExtent = Math.max(...east.boundary.flatMap(p => [Math.abs(p.x), Math.abs(p.z)]));
  assert.ok(padangExtent > eastExtent * 1.7, `expected expanded Padang extent, got ${padangExtent}`);
  assert.ok(eastExtent < 100, 'East Gate must retain its original footprint');

  // The normalized terrain remains in a game-sized vertical range instead
  // of multiplying elevation along with horizontal spacing.
  const sourceSamples = [[0, 0], [12, 20], [-24, -16]] as const;
  for (const [x, z] of sourceSamples) {
    const expanded = terrainHeight(padang, x * 2, z * 2);
    assert.ok(Math.abs(expanded) < 20, `elevation was scaled at ${x},${z}`);
  }

  const spawns = fieldSpawns(FIELDS['verdant-plains']);
  assert.equal(spawns.length, 42);
  assert.ok(Math.max(...spawns.map(s => Math.abs(s.x)), ...spawns.map(s => Math.abs(s.z))) > 70);
  for (const spawn of spawns) assert.ok(terrainWalkable(padang, spawn, spawn.definition.variant === 'boss' ? 1.8 : .55, true));
  assert.ok(terrainWalkable(padang, padang.entry));
  assert.ok(terrainWalkable(padang, padang.camp));
  assert.ok(terrainWalkable(padang, padang.exit));
  assert.ok(terrainWalkable(padang, padang.arena, 1.8, true));
});
