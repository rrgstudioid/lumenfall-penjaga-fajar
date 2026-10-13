import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  applyEquipmentEmissive,
  cloneEquipmentEmissive,
  equipmentEmissiveStrength,
} from './equipment-emissive.ts';
import {
  createCharacterModel,
  disposeCharacterModel,
} from './character-model.ts';
import { ITEM_CATALOG, createItem } from './items.ts';
import { createNewCharacter, isEnhanceableEquipment } from './rules.ts';
import { bindDragonVeilMesh } from './dragon-veil-model.ts';
import {
  setupCrimsonSwordGlow,
  updateCrimsonSwordGlow,
} from './special-sword-model.ts';

await test('each enhancement adds emission, preserves authored shading, and can downgrade to zero', () => {
  const source = new T.MeshStandardMaterial({
    color: '#bc3120',
    emissive: '#ff8800',
    emissiveIntensity: 2,
    map: new T.Texture(),
    emissiveMap: new T.Texture(),
  });
  let priorHook = 0;
  source.onBeforeCompile = (shader) => {
    priorHook++;
    shader.uniforms.authored = { value: 3 };
  };
  source.customProgramCacheKey = () => 'authored';
  let previous = 0;
  for (let level = 1; level <= 12; level++) {
    const copy = cloneEquipmentEmissive(
      source,
      level,
    ) as T.MeshStandardMaterial;
    const shader = {
      uniforms: {},
      vertexShader: T.ShaderLib.standard.vertexShader,
      fragmentShader: T.ShaderLib.standard.fragmentShader,
    };
    copy.onBeforeCompile(
      shader as T.WebGLProgramParametersWithUniforms,
      {} as T.WebGLRenderer,
    );
    assert(copy.userData.equipmentEmissive.intensity > previous);
    previous = copy.userData.equipmentEmissive.intensity;
    assert(copy.color.equals(source.color));
    assert(copy.emissive.equals(source.emissive));
    assert.equal(copy.emissiveIntensity, 2);
    assert.equal(copy.map, source.map);
    assert.equal(copy.emissiveMap, source.emissiveMap);
    assert.match(shader.fragmentShader, /#include <emissivemap_fragment>/);
    assert.match(
      shader.fragmentShader,
      /totalEmissiveRadiance \+= diffuseColor.rgb/,
    );
    assert.equal(
      copy.customProgramCacheKey(),
      'authored:equipment-emissive-v1',
    );
    applyEquipmentEmissive(copy, 0);
    assert.equal(copy.userData.equipmentEmissive.uniform.value, 0);
    copy.dispose();
  }
  assert.equal(priorHook, 12);
  assert.equal(source.userData.equipmentEmissive, undefined);
  assert.equal(equipmentEmissiveStrength(-1).intensity, 0);
  assert.equal(equipmentEmissiveStrength(NaN).intensity, 0);
  assert.deepEqual(
    equipmentEmissiveStrength(500),
    equipmentEmissiveStrength(12),
  );
  source.map!.dispose();
  source.emissiveMap!.dispose();
  source.dispose();
});

await test('clones at different levels are isolated even when their source already has enhancement emission', () => {
  const source = new T.MeshStandardMaterial();
  applyEquipmentEmissive(source, 12);
  const low = cloneEquipmentEmissive(source, 1);
  const zero = cloneEquipmentEmissive(source, 0);
  assert.equal(source.userData.equipmentEmissive.level, 12);
  assert.equal(low.userData.equipmentEmissive.level, 1);
  assert.equal(zero.userData.equipmentEmissive, undefined);
  applyEquipmentEmissive(low, 6);
  assert.equal(source.userData.equipmentEmissive.level, 12);
  const shader = {
    uniforms: {},
    vertexShader: '',
    fragmentShader: '#include <emissivemap_fragment>',
  };
  low.onBeforeCompile(
    shader as T.WebGLProgramParametersWithUniforms,
    {} as T.WebGLRenderer,
  );
  assert.equal(
    shader.fragmentShader.match(/totalEmissiveRadiance \+=/g)?.length,
    1,
  );
  [source, low, zero].forEach((m) => m.dispose());
});

await test('generic weapon, armor and accessory types glow on both characters without lighting their body or aura', (t) => {
  t.mock.method(T.TextureLoader.prototype, 'load', () => new T.Texture());
  const templates = new Map(
    Object.values(ITEM_CATALOG)
      .filter(
        (i) =>
          isEnhanceableEquipment(i) &&
          !i.templateId.startsWith('dragon-veil') &&
          i.templateId !== 'field-meteorfall-citadel-sword',
      )
      .map((i) => [i.equipmentType, i]),
  );
  for (const gender of ['male', 'female'] as const)
    for (const template of templates.values()) {
      const hero = createNewCharacter('slot-1', 'Emission', { gender });
      hero.coreJob = 'thief';
      hero.job = 'thief';
      for (const slot of Object.keys(hero.equipment) as Array<
        keyof typeof hero.equipment
      >)
        hero.equipment[slot] = null;
      const item = createItem(template.templateId, { enhancementLevel: 12 });
      hero.inventory.push(item);
      hero.equipment[item.equipSlot!] = item.id;
      if (item.equipmentType === 'off_hand_dagger') {
        const main = createItem('caroq-daggers');
        hero.inventory.push(main);
        hero.equipment.mainHand = main.id;
      }
      const before = JSON.stringify(hero);
      const model = createCharacterModel(hero);
      const holder =
        model.actor.getObjectByName(`equipment:${item.equipSlot}`) ??
        model.actor.getObjectByName(`equipment:${item.equipSlot}:right`);
      assert(holder, template.templateId);
      const lit = new Set<T.Material>();
      holder.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          if (!(material instanceof T.MeshStandardMaterial)) continue;
          assert.equal(
            material.userData.equipmentEmissive.level,
            12,
            template.templateId,
          );
          lit.add(material);
        }
      });
      assert(lit.size > 0, template.templateId);
      const counts = new Map<T.Material, number>();
      lit.forEach((m) =>
        m.addEventListener('dispose', () =>
          counts.set(m, (counts.get(m) ?? 0) + 1),
        ),
      );
      disposeCharacterModel(model.actor);
      disposeCharacterModel(model.actor);
      lit.forEach((m) => assert.equal(counts.get(m), 1));
      assert.equal(JSON.stringify(hero), before);
    }
});

await test('skinned Dragon Veil clones only enhanced materials and never mutates a cached +0 asset', () => {
  const bone = new T.Bone();
  bone.name = 'root';
  const source = new T.SkinnedMesh(
    new T.BoxGeometry(),
    new T.MeshStandardMaterial({ map: new T.Texture() }),
  );
  source.add(bone);
  source.bind(new T.Skeleton([bone]));
  const high = bindDragonVeilMesh(source, source, 12);
  const zero = bindDragonVeilMesh(source, source, 0);
  assert.notEqual(high.material, source.material);
  assert.equal(zero.material, source.material);
  assert.equal(
    (high.material as T.MeshStandardMaterial).map,
    source.material.map,
  );
  assert.equal(source.material.userData.equipmentEmissive, undefined);
  assert.equal(
    (high.material as T.Material).userData.equipmentEmissive.level,
    12,
  );
  assert.equal(high.geometry, source.geometry);
  high.userData.enhancementMaterials.forEach((m: T.Material) => m.dispose());
  high.skeleton.dispose();
  zero.skeleton.dispose();
  source.skeleton.dispose();
  source.material.map!.dispose();
  source.material.dispose();
  source.geometry.dispose();
});

await test('late Wings loading uses the owning enhancement and Meteor Sword keeps its authored pulse', async () => {
  const hero = createNewCharacter('slot-1', 'Wings emissive');
  const wings = createItem('dragon-veil-wings', { enhancementLevel: 12 });
  hero.inventory.push(wings);
  hero.equipment.accessory = wings.id;
  const scene = new T.Group();
  const mesh = new T.Mesh(
    new T.BoxGeometry(2, 1, 0.5),
    new T.MeshStandardMaterial(),
  );
  scene.add(mesh);
  let finish!: (s: T.Group) => void;
  const model = createCharacterModel(hero, {
    accessoryAssetSource: () =>
      new Promise((r) => {
        finish = r;
      }),
  });
  finish(scene);
  assert(await model.accessoryReady);
  assert.equal(mesh.material.userData.equipmentEmissive.level, 12);
  mesh.material.name = 'sword';
  setupCrimsonSwordGlow(scene);
  updateCrimsonSwordGlow(scene, 1);
  assert(mesh.material.emissiveIntensity > 1);
  assert.equal(mesh.material.userData.equipmentEmissive.level, 12);
  disposeCharacterModel(model.actor);
});
