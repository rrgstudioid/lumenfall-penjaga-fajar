import test from 'node:test';
import assert from 'node:assert/strict';
import {
  characterLOD,
  characterPoseInterval,
  planCharacterCrowd,
} from './character-quality.ts';
await test('office never selects LOD0 and thresholds have hysteresis', () => {
  assert.equal(characterLOD(900, 'office', 1), 1);
  assert.equal(characterLOD(410, 'high', 1), 1);
  assert.equal(characterLOD(470, 'high', 1), 0);
  assert.equal(characterLOD(350, 'high', 0), 0);
  assert.equal(characterLOD(300, 'high', 0), 1);
  assert.equal(characterLOD(40, 'office', 1), 3);
});
await test('self animation is never throttled', () => {
  assert.equal(characterPoseInterval(200, true), 0);
  assert.equal(characterPoseInterval(10), 1 / 30);
  assert.equal(characterPoseInterval(25), 1 / 15);
  assert.equal(characterPoseInterval(100), 1 / 5);
});
await test('25 visible humanoids respect office geometry budget without hiding actors', () => {
  const entries = Array.from({ length: 25 }, (_, id) => ({
    id,
    pixels: 300,
    distance: 5 + id,
    visible: true,
    self: id === 0,
    previous: 1 as const,
  }));
  const plan = planCharacterCrowd(entries, 'office');
  assert.equal(plan.actors.length, 25);
  assert.ok(plan.triangles <= 250000);
  assert.equal(plan.actors[0].lod, 1);
  assert.equal(plan.actors[0].poseInterval, 0);
  assert.ok(plan.actors.every((a) => !a.shadow));
  assert.equal(
    planCharacterCrowd(
      entries.map((e) => ({ ...e, visible: false })),
      'office',
    ).actors.length,
    1,
  );
});
