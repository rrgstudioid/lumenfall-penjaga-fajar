import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { freshHero } from './rules.ts';
import { createCharacterModel, disposeCharacterModel } from './character-model.ts';

test('only the +5 sword aura is active while newer weapon VFX stays disabled', t => {
  t.mock.method(T.TextureLoader.prototype, 'load', (_url: string, onLoad: (texture: T.Texture) => void) => {
    const texture = new T.Texture(); onLoad(texture); return texture;
  });
  const hero = freshHero();
  const item = hero.inventory.find(entry => entry.id === hero.equipment.mainHand)!;
  item.enhancementLevel = 10;
  const model = createCharacterModel(hero);
  assert.equal(model.aura.userData.swordFlames.length, 1);
  assert.equal(model.actor.getObjectByName('EnhancedSwordFlame13')!.children.length, 4);
  const flame = model.actor.getObjectByName('EnhancedSwordFlame13')!;
  const plane = flame.children[0] as T.Mesh<T.PlaneGeometry>;
  const bladeLength = item.equipmentType === 'two_hand_sword' ? 1.55 : 1.1;
  const previousWidth = (bladeLength > 1.4 ? .64 : .52) * 1.25;
  assert.ok(Math.abs(plane.geometry.parameters.width - previousWidth * 2) < 1e-9);
  assert.ok(Math.abs(plane.geometry.parameters.height - (bladeLength + .3) * 1.25 * 2) < 1e-9);
  assert.ok(Math.abs(flame.position.y - plane.geometry.parameters.height / 2 - .12) < 1e-9,
    'enlarged aura starts at the guard, never behind the hand');
  assert.equal(model.actor.getObjectByName('EnhancedSwordInferno13'), undefined);
  assert.equal(model.actor.getObjectByName('WeaponEnergyBallAura'), undefined);
  assert.ok(model.actor.getObjectByName('SwordTip'));
  disposeCharacterModel(model.actor);
});
