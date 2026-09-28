import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UIInputBlockers } from './ui-input.ts';
void test('chat and HUD input ownership survives unrelated drag cleanup', () => {
  const input = new UIInputBlockers();
  input.set('chat', true);
  input.set('item-drag', true);
  input.set('item-drag', false);
  input.set('legacy-hotbar', false);
  assert.equal(input.blocked, true);
  assert.equal(input.has('chat'), true);
  input.set('hud-drag', true);
  input.set('chat', false);
  assert.equal(input.blocked, true);
  input.set('hud-drag', false);
  assert.equal(input.blocked, false);
});
