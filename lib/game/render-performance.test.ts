import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderPerformance } from './render-performance.ts';

await test('frame sampling is bounded, skips inactive gaps, and resets between profiles', () => {
  const sampler = new RenderPerformance();
  sampler.record(1000, 2);
  for (let i = 1; i <= 300; i++) sampler.record(1000 + i * (1000 / 60), 3);
  assert.equal(sampler.snapshot().samples, 240);
  assert.equal(sampler.snapshot().fpsMedian, 60);
  assert.equal(sampler.snapshot().cpuSubmissionMsP95, 3);
  assert.equal(sampler.snapshot().gpuTimeMeasured, false);
  sampler.suspend();
  sampler.record(9000, 4);
  assert.equal(sampler.snapshot().frameMs.p99, 16.67);
  sampler.record(9500, 400);
  assert.equal(sampler.snapshot().frameMs.max, 500, 'active stalls must not be hidden');
  sampler.reset();
  assert.equal(sampler.snapshot().samples, 0);
  assert.equal(sampler.snapshot().fpsMedian, null);
});

await test('live FPS follows recent frame rate, includes stalls, and hides suspended samples', () => {
  const sampler = new RenderPerformance();
  let time = 1000;
  sampler.record(time, 1);
  assert.equal(sampler.currentFPS(), null);
  for (let i=0;i<180;i++) sampler.record(time += 1000/60, 1);
  assert.equal(sampler.currentFPS(), 60);
  for (let i=0;i<40;i++) sampler.record(time += 1000/30, 1);
  assert.equal(sampler.currentFPS(), 30, 'old faster map must not dominate current FPS');
  sampler.record(time += 500, 1);
  assert(sampler.currentFPS()! < 20, 'a real long render interval lowers displayed FPS');
  sampler.suspend();
  assert.equal(sampler.currentFPS(), null);
  sampler.reset();
  assert.equal(sampler.currentFPS(), null);
});
