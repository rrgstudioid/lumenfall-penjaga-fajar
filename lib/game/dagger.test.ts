import test from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from './items.ts';
import { isOneHandDagger } from './dagger.ts';
import { resolveWeaponStyle } from './weapon-style.ts';

await test('dagger guard leaves non-dagger weapons available to the weapon-style resolver', () => {
  const sword = createItem('legacy-fajar-blade', { id: 'guard-sword' });
  const second = createItem('legacy-fajar-blade', { id: 'guard-second' });
  const greatsword = createItem('jayantara-two-hand-sword', {
    id: 'guard-greatsword',
  });
  assert.equal(isOneHandDagger(sword), false);
  assert.equal(isOneHandDagger(greatsword), false);
  assert.equal(resolveWeaponStyle(sword, null), 'one_hand_sword');
  assert.equal(resolveWeaponStyle(sword, second), 'dual_sword');
  assert.equal(resolveWeaponStyle(greatsword, null), 'greatsword');
});
await test('dagger recognition preserves lineage access and requires distinct valid instances', () => {
  const main = createItem('field-verdant-plains-dagger', { id: 'dagger-main' });
  const off = createItem('field-verdant-plains-dagger', { id: 'dagger-off' });
  assert.equal(isOneHandDagger(main), true);
  for (const invalid of [
    null,
    undefined,
    { ...main, twoHanded: true },
    { ...main, quantity: 2 },
    { ...main, stackable: true },
  ])
    assert.equal(isOneHandDagger(invalid), false);
  assert.equal(
    resolveWeaponStyle(main, off, { coreJob: 'thief' }),
    'dual_dagger',
  );
  assert.equal(resolveWeaponStyle(main, main, { coreJob: 'thief' }), 'dagger');
  assert.equal(resolveWeaponStyle(main, off, { coreJob: 'warrior' }), 'none');
  assert.equal(resolveWeaponStyle(main, off), 'none');
});
